/**
 * dsh-plugin-kit — managed registration: the kit's own acquire-and-unwind path.
 *
 * ## What this is
 *
 * `registerManagedResource(ports)` calls the caller's host ports in a fixed
 * order, records each acquired resource's *native* disposer in a caller-owned
 * cleanup scope (`./cleanup.js`), and returns a handle whose `close()` unwinds
 * them in reverse order. It is the kit's registration path: a plugin built from
 * this package can mount through it and unmount through the handle, instead of
 * hand-rolling an `active` flag.
 *
 * ## What this is not
 *
 * - **Not a broker, not an SDK.** It knows no tool descriptor, event name,
 *   endpoint address or resource kind. Ports are called with no arguments; the
 *   caller closes over its own identifiers.
 * - **Not a registry.** No module-level state, no table, no key. A registration
 *   is owned by the closure of the handle it returned, so closing one handle
 *   can never reach another, and nothing here ever deletes "the resource named
 *   x" — there is no name to delete.
 * - **Not a `ctx` patcher.** `ctx` is never imported, wrapped or monkey-patched.
 *   The tool-registration disposer stays the host's own function: this module
 *   stores it and calls it exactly once. It does not retry it, wrap it, or try
 *   to be idempotent on the host's behalf — if the host's disposer is not
 *   idempotent, it is still only called once from here.
 * - **Not a dispatch fence.** See "active" below.
 * - **Not a fix for the vendored adapter.** That adapter's own teardown is
 *   unchanged by anything here. A plugin that keeps unwinding that way keeps
 *   that behaviour.
 *
 * ## Ports
 *
 * Three *acquisitions* and one *release*:
 *
 * | port | role | called | must return |
 * | --- | --- | --- | --- |
 * | `register` (required) | tool registration | activation, first | the host's native unregister disposer |
 * | `subscribe` (optional) | event subscription | activation, second | the host's native unsubscribe disposer |
 * | `publish` (optional) | endpoint publication | activation, third | the host's native retract disposer |
 * | `deactivate` (optional) | release only | teardown, first | anything; a promise is awaited |
 *
 * Each acquired disposer is deferred as **its own** cleanup callback. Unsubscribing
 * and unregistering the tool are never combined into one callback, so a throwing
 * unsubscribe cannot cost the caller the tool unregister — that is exactly the
 * failure the scope exists to prevent.
 *
 * `deactivate` is asymmetric on purpose: it is the caller's own way to undo an
 * activation the *host* performed out of band (the host started the resource
 * before or around the tool registration). It is not an acquisition, so it is
 * deferred only once every acquisition has succeeded, and it is deferred last
 * so that it runs first — stop the resource, then retract its endpoint, then
 * unsubscribe, then unregister the tool.
 *
 * If a host exposes only a `deactivate()` call and no native disposer from its
 * registration, that is a host-port problem: pass `deactivate` for the
 * out-of-band part and let `register` return the registration's own disposer.
 * This module will not synthesise an unregister call from a name.
 *
 * ## Activation is synchronous
 *
 * Every acquisition port runs synchronously during `registerManagedResource()`
 * and must return its disposer *synchronously*. There is deliberately no async
 * activation API: a half-mounted plugin whose mount is still in flight is a
 * state this module has no honest way to describe, and the scope's disposers
 * are what teardown awaits — not the acquisitions. Teardown *may* be
 * asynchronous (any disposer may return a promise; `close()` awaits them one at
 * a time).
 *
 * ## A disposer is callable, not "not thenable"
 *
 * The check is **callable-first**: if a port returns a function, that function
 * *is* the disposer — exact identity, no wrapper, no name, no monkey-patching —
 * and its `then` property is never read. This matters because a host's native
 * disposer may legitimately be callable *and* thenable at once: Cordis'
 * `ctx.effect()` returns a wrapper function that also carries its own `then`
 * (see the vendored `vendor/cordis/lib/index.js`, the `effect()` method: the
 * returned `wrapper` gets `wrapper.then = async (...) => ...` before it is
 * handed back). That `then` is an *await the disposal* convenience for the
 * owner of the effect, not a promise standing in for the acquisition, and
 * reading the getter to discover it would execute or at least touch the host's
 * async disposal path for a resource this module has not yet taken ownership
 * of.
 *
 * So the refusal rules apply only to returns that are **not callable**:
 *
 * - a non-callable thenable (a promise, or any object with a callable `then`)
 *   is refused with `ManagedRegistrationAsyncPortError` — that really is an
 *   asynchronous acquisition;
 * - any other non-function return is refused with
 *   `ManagedRegistrationDisposerError`.
 *
 * A callable that owns a `then` is accepted, called exactly once at teardown,
 * and its `then` is neither read during acquisition nor invoked by this module.
 *
 * ## Failure and rollback
 *
 * If any acquisition fails, the entries acquired so far are rolled back through
 * the same scope (LIFO), and `registerManagedResource()` throws synchronously —
 * so a partially mounted plugin never escapes as a live handle. The thrown
 * error keeps the original thrown value untouched in `.primary` (never coerced,
 * never re-wrapped) and exposes the rollback settlement as `.rollback`:
 *
 * - `.rollback` resolves when the rollback was clean. The caller already has the
 *   primary failure.
 * - `.rollback` rejects with `ManagedRegistrationRollbackError` when a cleanup
 *   callback also threw; that error's `.errors` is `[primary, ...cleanupErrors]`
 *   and it keeps `.primary` and `.cleanupErrors` separately.
 *
 * The module attaches an internal no-op handler to `.rollback` so that a caller
 * which only inspects the synchronous throw does not crash the process with an
 * unhandled rejection. That handler hides nothing from a caller that awaits it.
 *
 * ## `active` is a flag, not a fence
 *
 * `handle.active` is `true` until `close()` is called. It is a value the
 * caller's own handler can read; this module does not intercept, wrap, queue or
 * block host dispatch, so it cannot stop a handler that is already running or
 * about to run, and it does not claim to. A caller that needs a real fence
 * implements it in its handler (for example by refusing work when
 * `handle.active` is false) — that enforcement is the caller's, not this
 * module's.
 *
 * ## Close
 *
 * `handle.close()` returns one promise: the first call creates it, every later
 * call returns that same promise, and a close with failures rejects that same
 * promise for every caller. Each acquired disposer runs at most once. This
 * module exposes no per-resource release handle, so there is no in-flight
 * release for `close()` to race and no `close()` that returns before a
 * registered disposer settled. As in the scope, there is no timeout: a disposer
 * that never settles means `close()` never settles.
 *
 * @packageDocumentation
 */

import { createCleanupScope } from './cleanup.js';

/**
 * Port names this module accepts, in the order it reads them. Any other key on
 * the bag is ignored, not rejected: this module has no opinion about the rest
 * of the caller's host surface.
 */
export const PORT_NAMES = Object.freeze(['register', 'subscribe', 'publish', 'deactivate']);

/**
 * Cleanup labels of the resources a full registration defers, in the order
 * their disposers run (reverse registration order). `TEARDOWN_ORDER` is the
 * machine-readable form of the table in the module documentation.
 */
export const TEARDOWN_ORDER = Object.freeze([
  'resource-deactivate',
  'endpoint-retract',
  'unsubscribe',
  'tool-unregister',
]);

/** Acquisitions, in the order they are attempted and deferred. */
const ACQUISITIONS = Object.freeze([
  Object.freeze({ port: 'register', cleanup: 'tool-unregister' }),
  Object.freeze({ port: 'subscribe', cleanup: 'unsubscribe' }),
  Object.freeze({ port: 'publish', cleanup: 'endpoint-retract' }),
]);

/** Release-only step, deferred last so that it unwinds first. */
const DEACTIVATE = Object.freeze({ port: 'deactivate', cleanup: 'resource-deactivate' });

const UNPRINTABLE = '<unprintable thrown value>';

/**
 * Describe a thrown value without coercing it. Never throws: it reads no
 * caller-defined property except `name`, `message` and the built-in
 * `Object#toString` tag, and any getter that throws lands in `UNPRINTABLE`.
 *
 * @param {unknown} value
 */
function describeThrown(value) {
  try {
    if (typeof value === 'string') return `string ${JSON.stringify(value)}`;
    if (value instanceof Error) {
      const name = typeof value.name === 'string' && value.name !== '' ? value.name : 'Error';
      const message = typeof value.message === 'string' ? value.message : '';
      return message === '' ? name : `${name}: ${message}`;
    }
    if (value === null) return 'null';
    const type = typeof value;
    if (type === 'undefined' || type === 'symbol' || type === 'function') return type;
    if (type === 'number' || type === 'boolean' || type === 'bigint') return `${type} ${String(value)}`;
    return `object ${Object.prototype.toString.call(value)}`;
  } catch {
    return UNPRINTABLE;
  }
}

/** @param {string | undefined} label */
function subjectOf(label) {
  return label === undefined ? 'managed registration' : `managed registration ${JSON.stringify(label)}`;
}

/**
 * Is this return value an asynchronous acquisition rather than a disposer?
 *
 * Only ever called for a value that is **not** a function: a callable is a
 * disposer by identity, and its own `then` getter must not be read (a host
 * disposer may be a callable that is also thenable — see the module docs). This
 * predicate decides whether a *non-callable* return is a promise/thenable, which
 * this module refuses as an async acquisition.
 *
 * @param {unknown} value
 * @returns {boolean} true only when `value.then` is readable and callable.
 */
function isThenable(value) {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return false;
  try {
    return typeof (/** @type {{ then?: unknown }} */ (value).then) === 'function';
  } catch {
    // A throwing `then` getter cannot be a usable disposer either; the caller
    // gets the disposer error, which is the accurate report.
    return false;
  }
}

/**
 * Thrown before any port is called, when the port bag itself is wrong. Nothing
 * was acquired, so there is no rollback to wait for.
 */
export class ManagedRegistrationPortsError extends Error {
  /** @param {string[]} problems */
  constructor(problems) {
    super(`registerManagedResource(ports): invalid port bag — ${problems.join('; ')}`);
    this.name = 'ManagedRegistrationPortsError';
    /** Stable machine-readable discriminator. */
    this.code = 'ERR_MANAGED_REGISTRATION_PORTS';
    /** One sentence per rejected port, in `PORT_NAMES` order. */
    this.problems = Object.freeze(problems.slice());
  }
}

/**
 * Base class of the errors thrown when activation reaches a port and fails.
 *
 * `primary` is the original thrown value, exactly as it was thrown; `rollback`
 * is the settlement of the cleanup for everything acquired before it.
 */
export class ManagedRegistrationFailure extends Error {
  /**
   * @param {string} message
   * @param {string} port
   * @param {string | undefined} label
   * @param {unknown} primary
   */
  constructor(message, port, label, primary) {
    super(message);
    this.name = 'ManagedRegistrationFailure';
    /** Port that was being activated when activation stopped. */
    this.port = port;
    /** Label given to `registerManagedResource()`, used in messages only. */
    this.label = label;
    /** The original thrown (or offending returned) value, untouched. */
    this.primary = primary;
    /**
     * Settles when the rollback of the earlier acquisitions settles. Assigned by
     * this module before the error is thrown, so it is always set on a thrown
     * activation failure.
     *
     * @type {Promise<void> | undefined}
     */
    this.rollback = undefined;
  }
}

/** A port threw while it was being called. */
export class ManagedRegistrationActivationError extends ManagedRegistrationFailure {
  /** @param {{ port: string, label: string | undefined, primary: unknown }} detail */
  constructor({ port, label, primary }) {
    super(
      `${subjectOf(label)}: port ${JSON.stringify(port)} threw during activation (${describeThrown(primary)}); `
        + 'everything acquired before it was rolled back — await error.rollback to learn whether that rollback also failed',
      port,
      label,
      primary,
    );
    this.name = 'ManagedRegistrationActivationError';
    /** Stable machine-readable discriminator. */
    this.code = 'ERR_MANAGED_REGISTRATION_ACTIVATION';
  }
}

/**
 * A port returned a **non-callable** thenable (a promise or any other thenable),
 * which is an asynchronous acquisition; activation here is synchronous by
 * contract.
 *
 * A *callable* that happens to be thenable is not this error: a function is
 * taken as the disposer by identity, `then` and all (see the module docs). This
 * is only raised when the return value could not be called at all.
 */
export class ManagedRegistrationAsyncPortError extends ManagedRegistrationFailure {
  /** @param {{ port: string, label: string | undefined, returned: unknown }} detail */
  constructor({ port, label, returned }) {
    super(
      `${subjectOf(label)}: port ${JSON.stringify(port)} returned ${describeThrown(returned)}; `
        + 'activation in this module is synchronous, so a port must return its disposer function — '
        + 'a thenable that cannot be called is an asynchronous acquisition, not a disposer',
      port,
      label,
      returned,
    );
    this.name = 'ManagedRegistrationAsyncPortError';
    /** Stable machine-readable discriminator. */
    this.code = 'ERR_MANAGED_REGISTRATION_ASYNC_PORT';
  }
}

/**
 * A port returned something that is neither a function nor a thenable, so there
 * is no disposer to record.
 */
export class ManagedRegistrationDisposerError extends ManagedRegistrationFailure {
  /** @param {{ port: string, label: string | undefined, returned: unknown }} detail */
  constructor({ port, label, returned }) {
    super(
      `${subjectOf(label)}: port ${JSON.stringify(port)} returned ${describeThrown(returned)} `
        + 'instead of a disposer function; this module unmounts by calling the disposer the host gave it '
        + 'and will not invent one',
      port,
      label,
      returned,
    );
    this.name = 'ManagedRegistrationDisposerError';
    /** Stable machine-readable discriminator. */
    this.code = 'ERR_MANAGED_REGISTRATION_DISPOSER';
  }
}

/**
 * The rejection value of a rollback in which at least one cleanup callback also
 * threw. `errors[0]` is the primary activation failure; the rest are the
 * cleanup failures in invocation order.
 */
export class ManagedRegistrationRollbackError extends AggregateError {
  /**
   * @param {ManagedRegistrationFailure} failure
   * @param {unknown} closeFailure
   * @param {string | undefined} label
   */
  constructor(failure, closeFailure, label) {
    const cleanupErrors = cleanupErrorsOf(closeFailure);
    super(
      [failure.primary, ...cleanupErrors],
      `${subjectOf(label)}: activation failed at port ${JSON.stringify(failure.port)} `
        + `(${describeThrown(failure.primary)}) and the rollback failed too — `
        + `${cleanupErrors.length} cleanup callback(s) threw; ${describeThrown(closeFailure)}`,
    );
    this.name = 'ManagedRegistrationRollbackError';
    /** Stable machine-readable discriminator. */
    this.code = 'ERR_MANAGED_REGISTRATION_ROLLBACK';
    /** Port whose activation failed first. */
    this.port = failure.port;
    /** The original activation failure, unchanged. */
    this.primary = failure.primary;
    /** The cleanup failures alone, in invocation order. */
    this.cleanupErrors = Object.freeze(cleanupErrors);
    /** The scope's own aggregate, kept for diagnostics. */
    this.cause = closeFailure;
  }
}

/** @param {unknown} closeFailure */
function cleanupErrorsOf(closeFailure) {
  if (closeFailure !== null && typeof closeFailure === 'object') {
    const errors = /** @type {{ errors?: unknown }} */ (closeFailure).errors;
    if (Array.isArray(errors)) return errors.slice();
  }
  return closeFailure === undefined ? [] : [closeFailure];
}

/**
 * Reject the port bag before anything is acquired.
 *
 * @param {unknown} ports
 */
function auditPorts(ports) {
  /** @type {string[]} */
  const problems = [];
  if (ports === null || typeof ports !== 'object') {
    problems.push('ports must be an object with at least a `register` function');
  } else {
    const bag = /** @type {Record<string, unknown>} */ (ports);
    if (typeof bag.register !== 'function') {
      problems.push('`register` is required and must be a function: it acquires the tool registration and returns the host\'s native unregister disposer');
    }
    for (const name of ['subscribe', 'publish']) {
      const port = bag[name];
      if (port !== undefined && typeof port !== 'function') {
        problems.push(`\`${name}\` must be a function when present (omit the key or leave it undefined to skip that acquisition)`);
      }
    }
    if (bag.deactivate !== undefined && typeof bag.deactivate !== 'function') {
      problems.push('`deactivate` must be a function when present; it is called once during teardown, never during activation');
    }
  }
  if (problems.length > 0) throw new ManagedRegistrationPortsError(problems);
}

/**
 * Start the rollback and hang its settlement on the failure.
 *
 * @param {ManagedRegistrationFailure} failure
 * @param {import('./cleanup.js').CleanupScope} scope
 * @param {string | undefined} label
 */
function withRollback(failure, scope, label) {
  // Called here, synchronously: the scope is sealed before the caller can see
  // the error, so nothing new can be deferred into the rollback it is running.
  const rollback = scope.close().then(
    () => undefined,
    (closeFailure) => {
      throw new ManagedRegistrationRollbackError(failure, closeFailure, label);
    },
  );
  // Marked handled so that a caller inspecting only the synchronous throw does
  // not produce an unhandled rejection. Awaiting it still rejects.
  rollback.catch(() => {});
  failure.rollback = rollback;
  return failure;
}

/**
 * Mount one tool registration (and, optionally, its subscription and endpoint)
 * through caller-supplied host ports, and return the handle that unmounts it.
 *
 * @param {{
 *   register: () => unknown,
 *   subscribe?: () => unknown,
 *   publish?: () => unknown,
 *   deactivate?: () => unknown,
 * }} ports Host ports. `register` is required; the others are skipped when
 *   absent. Each acquisition port is called with no arguments and must return
 *   its own native disposer synchronously. A returned **function** is that
 *   disposer, exact identity, even when it is also thenable (its `then` is never
 *   read); a returned **non-callable thenable** is refused as an async
 *   acquisition.
 * @param {{ label?: string }} [options] `label` appears in error messages only.
 *   It is not an identity and never groups registrations together.
 * @returns {{ readonly label: string | undefined, readonly active: boolean, close: () => Promise<void> }}
 *   A frozen handle. `active` is a flag for the caller's own handler, not a
 *   fence; `close()` returns one shared promise.
 */
export function registerManagedResource(ports, options = {}) {
  auditPorts(ports);
  const bag = /** @type {Record<string, unknown>} */ (ports);
  const requested = options === null || typeof options !== 'object' ? undefined : options.label;
  const label = typeof requested === 'string' && requested !== '' ? requested : undefined;
  const scope = createCleanupScope(label === undefined ? {} : { label });

  try {
    for (const step of ACQUISITIONS) {
      const port = bag[step.port];
      if (typeof port !== 'function') continue;
      let returned;
      try {
        returned = port();
      } catch (thrown) {
        throw new ManagedRegistrationActivationError({ port: step.port, label, primary: thrown });
      }
      // Callable first, before anything looks at `.then`. A function returned by
      // an acquisition port is the disposer, exactly as the host handed it over
      // — including a native disposer that is also thenable (Cordis `ctx.effect`
      // returns a wrapper function with its own `then`). Its `then` getter is
      // deliberately not read here.
      if (typeof returned === 'function') {
        // One deferred callback per acquired resource, in acquisition order,
        // holding the host's own function: no wrapper, no renamed proxy.
        scope.defer(/** @type {() => unknown} */ (returned), { label: step.cleanup });
        continue;
      }
      // Not callable: a thenable here really is an async acquisition, and
      // anything else is not a disposer at all.
      if (isThenable(returned)) {
        throw new ManagedRegistrationAsyncPortError({ port: step.port, label, returned });
      }
      throw new ManagedRegistrationDisposerError({ port: step.port, label, returned });
    }

    const deactivate = bag.deactivate;
    if (typeof deactivate === 'function') {
      // Deferred last, so LIFO makes it run first during teardown.
      scope.defer(/** @type {() => unknown} */ (deactivate), { label: DEACTIVATE.cleanup });
    }
  } catch (failure) {
    throw withRollback(/** @type {ManagedRegistrationFailure} */ (failure), scope, label);
  }

  /** @type {Promise<void> | undefined} */
  let closing;

  return Object.freeze({
    /** Label given to `registerManagedResource()`, used in messages only. */
    get label() {
      return label;
    },
    /** False from the moment `close()` is called. A flag, not a fence. */
    get active() {
      return !scope.closed;
    },
    /**
     * Unmount everything, or hand back the promise that is already doing so.
     *
     * @returns {Promise<void>}
     */
    close() {
      if (closing === undefined) closing = scope.close();
      return closing;
    },
  });
}
