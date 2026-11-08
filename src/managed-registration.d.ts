/**
 * dsh-plugin-kit/managed-registration public types.
 *
 * Hand-written, like `cleanup.d.ts`: this package ships no build step, so these
 * declarations are the source of truth for consumers.
 */

/** Port names `registerManagedResource()` accepts, in the order it reads them. */
export declare const PORT_NAMES: readonly ('register' | 'subscribe' | 'publish' | 'deactivate')[];

/**
 * Cleanup labels of the resources a full registration defers, in the order
 * their disposers run (reverse registration order).
 */
export declare const TEARDOWN_ORDER: readonly [
  'resource-deactivate',
  'endpoint-retract',
  'unsubscribe',
  'tool-unregister',
];

/**
 * Host ports, supplied by the caller as closures over its own identifiers.
 *
 * Every acquisition port takes no arguments and must return its own **native**
 * disposer synchronously. "Disposer" means *callable*: a returned function is
 * recorded and called as-is, exact identity, and it is accepted even when it is
 * also thenable — a Cordis `ctx.effect()` disposer is a wrapper function that
 * carries its own `then`. That `then` is never read during acquisition, so it
 * cannot behave like an async acquisition result.
 *
 * A returned value that is **not** callable is refused: a promise or other
 * thenable as an asynchronous acquisition (`ManagedRegistrationAsyncPortError`),
 * anything else as no disposer at all (`ManagedRegistrationDisposerError`).
 *
 * `deactivate` is different: it is a release-side port the caller supplies when
 * the host activated the resource out of band, and it is called once during
 * teardown.
 *
 * No `ctx` is passed in and none is patched: the returned registration disposer
 * stays the host's own function and this module calls it exactly once.
 */
export interface ManagedRegistrationPorts {
  /** Required. Acquire the tool registration; return the host's unregister disposer. */
  register(): () => unknown;
  /** Optional. Acquire the event subscription; return its unsubscribe disposer. */
  subscribe?(): () => unknown;
  /** Optional. Publish the endpoint; return its retract disposer. */
  publish?(): () => unknown;
  /**
   * Optional. Undo an activation the host performed out of band. Called once at
   * teardown, before the endpoint, subscription and tool registration are
   * withdrawn. A returned promise is awaited.
   */
  deactivate?(): unknown;
}

/** The one handle a successful `registerManagedResource()` returns. */
export interface ManagedRegistrationHandle {
  /** Label given to `registerManagedResource()`, used in messages only. */
  readonly label: string | undefined;
  /**
   * `false` from the moment `close()` is called.
   *
   * A flag for the caller's own handler to read, **not** a fence: this module
   * never intercepts, wraps or blocks host dispatch, so it cannot stop a
   * handler that is already running or about to run.
   */
  readonly active: boolean;
  /**
   * Unmount everything. Every call returns the same promise: the first call
   * creates it, later calls — including calls after it settled — hand it back
   * unchanged, so a close with failures rejects the same promise for every
   * caller. Each acquired disposer runs at most once. There is no timeout.
   */
  close(): Promise<void>;
}

/** Thrown before any port is called, when the port bag itself is wrong. */
export declare class ManagedRegistrationPortsError extends Error {
  constructor(problems: string[]);
  readonly name: 'ManagedRegistrationPortsError';
  readonly code: 'ERR_MANAGED_REGISTRATION_PORTS';
  readonly problems: readonly string[];
}

/**
 * Base class of the errors thrown when activation reaches a port and fails.
 * Each of these is thrown synchronously, so a partially mounted registration
 * never escapes as a live handle.
 */
export declare class ManagedRegistrationFailure extends Error {
  /** Port that was being activated when activation stopped. */
  readonly port: string;
  /** Label given to `registerManagedResource()`, used in messages only. */
  readonly label: string | undefined;
  /** The original thrown (or offending returned) value, untouched. */
  readonly primary: unknown;
  /**
   * Settlement of the rollback for everything acquired before the failure.
   *
   * Resolves when the rollback was clean. Rejects with
   * `ManagedRegistrationRollbackError` when a cleanup callback also threw.
   */
  readonly rollback: Promise<void>;
  readonly code: string;
}

/** A port threw while it was being called. */
export declare class ManagedRegistrationActivationError extends ManagedRegistrationFailure {
  readonly name: 'ManagedRegistrationActivationError';
  readonly code: 'ERR_MANAGED_REGISTRATION_ACTIVATION';
}

/**
 * A port returned a **non-callable** thenable (promise or other thenable): that
 * is an asynchronous acquisition, and activation here is synchronous by
 * contract. A callable that is also thenable is a valid disposer, not this.
 */
export declare class ManagedRegistrationAsyncPortError extends ManagedRegistrationFailure {
  readonly name: 'ManagedRegistrationAsyncPortError';
  readonly code: 'ERR_MANAGED_REGISTRATION_ASYNC_PORT';
}

/** A port returned something that is neither callable nor thenable: no disposer. */
export declare class ManagedRegistrationDisposerError extends ManagedRegistrationFailure {
  readonly name: 'ManagedRegistrationDisposerError';
  readonly code: 'ERR_MANAGED_REGISTRATION_DISPOSER';
}

/**
 * The rejection value of a rollback in which at least one cleanup callback also
 * threw. `errors[0]` is the primary activation failure; the rest are the
 * cleanup failures in invocation order.
 */
export declare class ManagedRegistrationRollbackError extends AggregateError {
  readonly name: 'ManagedRegistrationRollbackError';
  readonly code: 'ERR_MANAGED_REGISTRATION_ROLLBACK';
  /** Port whose activation failed first. */
  readonly port: string;
  /** The original activation failure, unchanged. */
  readonly primary: unknown;
  /** The cleanup failures alone, in invocation order. */
  readonly cleanupErrors: readonly unknown[];
}

/**
 * Mount one tool registration (and, optionally, its subscription and endpoint)
 * through caller-supplied host ports.
 *
 * Acquisitions run synchronously; teardown may be asynchronous. A port's
 * returned function is its disposer regardless of any `then` it carries
 * (callable-first); only non-callable returns are refused. On any acquisition
 * failure the entries acquired so far are rolled back through the caller-owned
 * cleanup scope and a `ManagedRegistrationFailure` is thrown.
 */
export declare function registerManagedResource(
  ports: ManagedRegistrationPorts,
  options?: { label?: string },
): ManagedRegistrationHandle;
