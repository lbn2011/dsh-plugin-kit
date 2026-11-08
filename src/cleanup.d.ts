/**
 * dsh-plugin-kit/cleanup public types.
 *
 * Hand-written, like `index.d.ts`: this package ships no build step, so these
 * declarations are the source of truth for consumers.
 */

/**
 * Thrown by `defer()` once the scope has started closing. Registering a
 * disposer after `close()` is a programming error, not a no-op: silently
 * accepting it would drop the cleanup the caller just asked for.
 */
export declare class CleanupScopeClosedError extends Error {
  constructor(label?: string);
  readonly name: 'CleanupScopeClosedError';
  readonly code: 'ERR_CLEANUP_SCOPE_CLOSED';
}

/**
 * The rejection value of a close in which at least one disposer threw.
 *
 * `errors` holds the original thrown values — never copies, never coerced to
 * strings — in reverse registration order of the snapshot the close took. For
 * registrations that had not run yet that is the invocation order; a failure
 * that arrived through an earlier `release()` is ordered by its registration,
 * not by when it threw. Disposers that never ran are absent: a throwing
 * disposer does not stop the ones after it.
 *
 * The `message` is built from counts only, so a thrown object with a throwing
 * `toString` or `message` getter cannot break the aggregation.
 */
export interface CleanupCloseFailure extends AggregateError {
  readonly code: 'ERR_CLEANUP_SCOPE_FAILED';
}

/**
 * Ownership token for one registration. It is the only way to release that
 * registration: a stale handle stays bound to its own spent entry — identity,
 * not a label lookup — and can never reach a newer registration, even one
 * registered with the same label.
 */
export interface CleanupHandle {
  /** Label given to `defer()`, used in messages only. */
  readonly label: string | undefined;
  /** True once this registration's disposer has run or is running. */
  readonly done: boolean;
  /**
   * Run this registration's disposer now, at most once, and take it out of the
   * pending set. A later `close()` never invokes it again, but it still awaits
   * this settlement, so a failure here also reaches the close.
   *
   * Every call returns the same promise, including a call made reentrantly from
   * inside the disposer: a throwing disposer reports its own error (unwrapped,
   * not an aggregate) to each caller that released it.
   */
  release(): Promise<void>;
}

export interface CleanupScope {
  /** Label given to `createCleanupScope()`, used in messages only. */
  readonly label: string | undefined;
  /** True once `close()` has been called, whether or not it has settled. */
  readonly closed: boolean;
  /** Registrations still pending: not yet run and not released. */
  readonly size: number;
  /** Record a disposer to run at close. Throws once the scope is closing. */
  defer(disposer: () => unknown, options?: { label?: string }): CleanupHandle;
  /**
   * Run the recorded disposers in reverse registration order, one at a time,
   * awaiting each. Every call returns the same settlement promise; a close with
   * failures rejects once, with a `CleanupCloseFailure`, for every caller.
   *
   * Every retained registration is awaited, not just the pending ones: a
   * release still in flight is waited for, and a release that already failed is
   * included in the aggregate.
   *
   * There is no timeout: a disposer that returns a promise that never settles
   * means `close()` never settles, and awaiting `close()` from inside one of
   * the scope's own disposers deadlocks.
   */
  close(): Promise<void>;
}

/**
 * Create one independent cleanup scope. No shared state exists between scopes,
 * and none is kept anywhere else in this module.
 */
export declare function createCleanupScope(options?: { label?: string }): CleanupScope;
