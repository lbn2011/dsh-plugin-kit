/**
 * dsh-plugin-kit — a small, caller-owned cleanup scope.
 *
 * ## What this is
 *
 * One object that records disposers, runs them in reverse registration order
 * when the owner finishes, and settles exactly once no matter how many callers
 * ask. It is an author-side bookkeeping helper: the caller passes in disposers
 * it already owns, and the caller decides when to close. Nothing here talks to
 * a host, patches a host object, wraps `ctx`, or claims to be a resource
 * manager, a broker or a sandbox.
 *
 * ## What this is not
 *
 * - Not a registry: it holds no global state, no module-level store and no
 *   shared table. Every `createCleanupScope()` call is an independent object;
 *   closing one never affects another.
 * - Not a key store: disposers are never identified by a name, a kind or a
 *   composite key. A registration is owned by the handle that `defer()`
 *   returned, and only that handle can release it. Safety comes from identity,
 *   not from removal: each registration keeps its own entry and its own
 *   memoized run for the lifetime of the scope, so a stale handle can only
 *   ever observe its own settlement and never a newer registration that
 *   happens to reuse the same label.
 * - Not an owner of host effects: it runs the functions it was given and
 *   nothing else. If a host effect must be undone, the disposer that undoes it
 *   is what the caller defers.
 * - Not a deadline: see "Never-settling disposers" below.
 *
 * ## Why it exists
 *
 * The vendored adapter's teardown does roughly this
 * (`vendor/meta-protocols/dsh-std/packages/adapter-dsh/src/index.ts:1641`,
 * `:1745`, `:1748-1753`, and the mount closure at `:1436-1447`):
 *
 * ```js
 * let active = true
 * return () => {
 *   if (!active) return
 *   active = false
 *   for (const dispose of disposers.reverse()) dispose()
 * }
 * ```
 *
 * Four properties matter for a teardown helper, and each one is fixed here:
 *
 * 1. **A throwing disposer aborts the loop.** The rest never run, so the
 *    resources behind them stay live (reproduced as H2 in
 *    `experiments/legacy-gap-audit/test/legacy-gap.test.mjs`). Here every
 *    disposer is guarded on its own; a failure is recorded and the loop
 *    continues.
 * 2. **Only the first error survives.** Here every failure is collected and
 *    the close rejects with an `AggregateError` carrying all of them in the
 *    reverse registration order of the snapshot it took.
 * 3. **Repeated or concurrent close does not share settlement.** The `active`
 *    flag makes the second call return immediately, so it resolves before the
 *    first close finished, and after a failed close a retry resolves
 *    successfully even though nothing was cleaned up. Here the first call
 *    seals the scope and stores one settlement promise, and every later call
 *    returns that same promise, including its rejection.
 * 4. **A late registration is refused, not dropped.** `defer()` throws
 *    `CleanupScopeClosedError` once `close()` has started, so cleanup a caller
 *    asks for mid-teardown cannot disappear into a registration the close
 *    never sees.
 *
 * ## Ordering
 *
 * Disposers run LIFO (reverse registration order), one at a time, each one
 * awaited before the next starts. A disposer may return a promise; it is
 * awaited. The batch is snapshotted when `close()` is called, so a disposer
 * that tries to register another one is refused rather than silently dropped.
 * The batch is that snapshot reversed, so the order is registration order, not
 * wall-clock age: for registrations still pending when the close starts it is
 * also the invocation order, while a registration that already ran through
 * `release()` keeps the position of its registration, which is not necessarily
 * when it threw.
 *
 * ## Release versus close
 *
 * `handle.release()` runs that one disposer now and takes it out of the
 * pending set; a later `close()` will not invoke it again. The registration is
 * still retained, so `close()` re-awaits its settlement: a release that is
 * still in flight when the close starts is waited for, and a release that
 * already failed is folded into the close's aggregate instead of vanishing.
 * Both paths go through one per-entry run, so a disposer runs at most once
 * even if `release()` and `close()` race; `startEntry` stores that run before
 * any user code executes, so even a reentrant `release()` sees it, and a
 * second `release()` returns the same promise instead of reporting a
 * completion that has not happened yet.
 *
 * ## Never-settling disposers (known limitation)
 *
 * There is deliberately no timeout and no deadline. If a disposer returns a
 * promise that never settles, `close()` never settles either, every later
 * `close()` returns the same pending promise, and the scope cannot recover.
 * That is a property of the caller's disposer, not something this module can
 * decide unilaterally: a timeout would guess a duration, report a settlement
 * that did not happen, and leave the caller unable to tell "still running"
 * from "gave up". A caller that needs a deadline must race its own timer
 * around `close()` and treat the scope as unrecoverable when it fires.
 *
 * Awaiting `close()` from inside one of that scope's own disposers deadlocks
 * for the same reason. Calling it is safe (it returns the in-flight promise)
 * as long as the result is not awaited.
 *
 * ## Rejections are the caller's
 *
 * A close that had failures rejects. Callers must `await close()` (or attach a
 * handler); this module does not swallow the rejection to keep a host process
 * quiet, because a silently failed teardown is the failure mode the four notes
 * above exist to remove.
 *
 * `close()` waits for a `handle.release()` that is still in flight when it
 * starts: it settles every retained registration, so an in-flight release is
 * folded into the same settlement and its failure reaches `close()` too.
 *
 * @packageDocumentation
 */

/** Thrown by `defer()` once the scope has started closing. */
export class CleanupScopeClosedError extends Error {
  /**
   * @param {string | undefined} label Scope label, for the message only.
   */
  constructor(label) {
    super(label === undefined
      ? 'cleanup scope is closed: no disposer can be registered after close() has been called'
      : `cleanup scope ${JSON.stringify(label)} is closed: no disposer can be registered after close() has been called`);
    this.name = 'CleanupScopeClosedError';
    /** Stable machine-readable discriminator. */
    this.code = 'ERR_CLEANUP_SCOPE_CLOSED';
  }
}


/**
 * Build the rejection value for a close in which one or more disposers threw.
 *
 * `errors` keeps the original thrown values in reverse registration order of
 * the snapshot the close took, so `errors[0]` is the failure of the
 * last-registered registration that failed. For registrations that had not run
 * yet that is also the invocation order; a failure that came from an earlier
 * `release()` is ordered by its registration, not by when it threw.
 *
 * The message is built from counts alone and never from the thrown values, so a
 * hostile thrown object (a throwing `toString`, a `message` getter, a bare
 * `undefined`) cannot fail the aggregation itself.
 *
 * @param {{ label: string | undefined, error: unknown }[]} failures
 * @param {number} attempted Retained registrations the close observed; a
 *   registration is counted once whether it ran during the close or earlier.
 * @param {string | undefined} scopeLabel
 */
function closeFailure(failures, attempted, scopeLabel) {
  const subject = scopeLabel === undefined ? 'cleanup scope' : `cleanup scope ${JSON.stringify(scopeLabel)}`;
  const error = new AggregateError(
    failures.map((row) => row.error),
    `${subject} close failed: ${failures.length} of ${attempted} disposer(s) threw`,
  );
  error.code = 'ERR_CLEANUP_SCOPE_FAILED';
  return error;
}

/**
 * Create an independent cleanup scope.
 *
 * @param {{ label?: string }} [options] `label` is used in error messages only;
 *   it is not an identity and never groups scopes together.
 */
export function createCleanupScope(options = {}) {
  const label = typeof options.label === 'string' && options.label !== '' ? options.label : undefined;

  /**
   * Every registration ever made, in registration order. Entries are found by
   * identity (`indexOf`), never by key, and are retained after they run: the
   * close must still be able to observe a run that happened through
   * `release()`, including its failure.
   *
   * @type {{ state: 'pending' | 'running' | 'done', disposer: () => unknown, label: string | undefined, running?: Promise<void> }[]}
   */
  const entries = [];
  /** True from the moment `close()` is called; refuses further `defer()`. */
  let closing = false;
  /** The one settlement promise, created by the first `close()`. */
  let settlement;


  /**
   * Start an entry's run, or hand back the run that already started.
   *
   * The run promise is stored on the entry before the disposer is invoked, so
   * every concurrent `release()`, a reentrant one from inside the disposer,
   * and the close all await the same settlement instead of being told "done"
   * while the disposer is still in flight.
   */
  function startEntry(entry) {
    if (entry.running !== undefined) return entry.running;
    let resolveRun, rejectRun;
    entry.running = new Promise((resolve, reject) => {
      resolveRun = resolve;
      rejectRun = reject;
    });
    // Store settlement before invoking user code, including its synchronous prefix.
    entry.state = 'running';
    try {
      Promise.resolve(entry.disposer()).then(
        () => { entry.state = 'done'; resolveRun(); },
        error => { entry.state = 'done'; rejectRun(error); },
      );
    } catch (error) {
      entry.state = 'done';
      rejectRun(error);
    }
    return entry.running;
  }

  async function drain(batch, settle) {
    const failures = [];
    let attempted = 0;
    for (const entry of batch) {
      // Every retained registration counts: pending ones run here, and running
      // or already-released ones are awaited again, so close observes their
      // failures instead of ignoring a teardown that did not work.
      attempted += 1;
      try {
        await startEntry(entry);
      } catch (error) {
        failures.push({ label: entry.label, error });
      }
    }
    if (failures.length === 0) settle.resolve();
    else settle.reject(closeFailure(failures, attempted, label));
  }

  /**
   * @param {unknown} disposer
   * @param {{ label?: string }} [entryOptions]
   */
  function defer(disposer, entryOptions = {}) {
    if (typeof disposer !== 'function') {
      throw new TypeError('createCleanupScope().defer(disposer): disposer must be a function');
    }
    if (closing) throw new CleanupScopeClosedError(label);
    const entry = {
      state: /** @type {'pending'} */ ('pending'),
      disposer: /** @type {() => unknown} */ (disposer),
      label: typeof entryOptions.label === 'string' && entryOptions.label !== '' ? entryOptions.label : undefined,
    };
    entries.push(entry);
    return Object.freeze({
      get label() { return entry.label; },
      get done() { return entry.state === 'done'; },
      release: () => startEntry(entry),
    });
  }

  function close() {
    if (settlement !== undefined) return settlement;
    // Sealed before any disposer runs: a disposer that registers another one
    // gets CleanupScopeClosedError instead of a registration the close drops.
    closing = true;
    const batch = entries.slice().reverse();
    /** @type {{ resolve: () => void, reject: (reason: unknown) => void }} */
    let settle;
    settlement = new Promise((resolve, reject) => {
      settle = { resolve, reject };
    });
    // `settlement` is assigned before the first disposer can run, so a
    // reentrant close() inside a disposer returns this same promise.
    // `drain` routes every disposer outcome through `settle`; the trailing
    // catch only covers a bug in this module, so that a defect can never turn
    // into a settlement that is silently never reached.
    drain(batch, /** @type {{ resolve: () => void, reject: (reason: unknown) => void }} */ (settle))
      .catch((error) => settle.reject(error));
    return settlement;
  }

  return Object.freeze({
    get label() { return label; },
    /** True once `close()` has been called, whether or not it has settled. */
    get closed() { return closing; },
    /** Registrations still pending: not yet run and not released. */
    get size() { return entries.filter(entry => entry.state === 'pending').length; },
    defer,
    close,
  });
}
