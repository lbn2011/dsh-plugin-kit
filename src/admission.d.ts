/**
 * dsh-plugin-kit/admission public types.
 *
 * Hand-written, like `cleanup.d.ts`: this package ships no build step, so these
 * declarations are the source of truth for consumers.
 */

/**
 * The only accepted `kind` values, in the order they are documented. Exact
 * strings: no case folding, no aliases.
 */
export declare const CLAIM_KINDS: readonly ['tool', 'service'];

/**
 * One resource claim: the tuple that is reserved, keyed and leased.
 *
 * The object must carry **exactly** `kind`, `name` and `scope` as own data
 * properties — no extra own keys (symbol keys included), no inherited-only
 * fields, no accessors, and no array. `name` and `scope` must be non-empty and
 * **already trimmed**: outer whitespace is rejected, never stripped, so the
 * string that is keyed is always the string the caller wrote.
 */
export interface ResourceClaim {
  readonly kind: 'tool' | 'service';
  readonly name: string;
  readonly scope: string;
}

/** Lifecycle of one lease. `quarantined` is terminal and keeps its claims. */
export type LeaseState = 'reserved' | 'released' | 'quarantined';

/**
 * A held reservation.
 *
 * The lease is the only handle to the claims it took, and it is bound to them
 * by identity: the coordinator remembers which record owns which key, so a
 * stale lease can never free a newer generation that reuses the same tuple.
 * Nothing here releases claims as a side effect of dropping the object — an
 * abandoned lease keeps its claims for the lifetime of the coordinator.
 */
export interface AdmissionLease {
  /** Current state. Read it; do not cache it. */
  readonly state: LeaseState;
  /** The frozen tuples this lease holds. Stable for the lease's life. */
  readonly claims: readonly ResourceClaim[];
  /**
   * Give every claim back. Idempotent: a second call is a no-op, and releasing
   * an already-released lease costs nothing.
   *
   * Throws `AdmissionLeaseStateError` when the lease is quarantined: quarantine
   * is the caller's statement that the claim's state is unknown, so ordinary
   * release must not undo it.
   *
   * Synchronous — there is no host call behind it. What the caller does with
   * its own resources before releasing is the caller's business.
   */
  release(): void;
  /**
   * Keep every claim forever. Idempotent and terminal while reserved: the
   * claims stay held for the lifetime of the coordinator, so later reservations
   * of those tuples conflict, and no public API clears them.
   *
   * Throws `AdmissionLeaseStateError` (`state: 'released'`) when the lease was
   * already released, and changes nothing. A released lease no longer owns its
   * keys — a newer generation may hold them — so a stale lease must not be able
   * to declare that owner's live claims permanently unsafe.
   *
   * Use it when teardown failed or was never attempted, and the caller cannot
   * prove the associated effects are gone.
   */
  quarantine(): void;
}

/**
 * The frozen object an activation callback receives.
 *
 * It exposes exactly one member on purpose: the only cleanup this module can
 * ever run is a disposer the callback hands it, immediately, at acquisition
 * time.
 */
export interface AdmissionContext {
  /**
   * Record one acquired cleanup. Call it for **every** acquisition, immediately
   * after the acquisition, inside the callback.
   *
   * Throws `TypeError` for a non-function, and `CleanupScopeClosedError` once
   * the close has started — a late registration is refused, never dropped.
   * Returns the scope's handle, whose `release()` the callback may use to undo
   * one acquisition early.
   */
  defer(disposer: () => unknown, options?: { label?: string }): import('./cleanup.js').CleanupHandle;
}

/**
 * The handle a successful `admit()` resolves to.
 */
export interface AdmissionHandle {
  /** The activation's settled return value, whatever it was. */
  readonly value: unknown;
  /**
   * Run every deferred cleanup, then release the claims — or quarantine them
   * when any cleanup failed.
   *
   * Every call returns the **same promise object**, including after it settled
   * and including its rejection. That object is created before the first cleanup
   * runs, so a cleanup that calls `close()` reentrantly gets the very same
   * promise — the call is safe; only awaiting it from inside its own cleanup
   * deadlocks. Cleanup failure quarantines the lease and rejects with the
   * scope's own aggregate (`ERR_CLEANUP_SCOPE_FAILED`), not a re-wrap.
   *
   * There is no timeout: a cleanup that never settles leaves this promise
   * pending forever.
   */
  close(): Promise<void>;
}

export interface AdmissionCoordinator {
  /** Distinct claims currently held — reserved or quarantined. */
  readonly size: number;
  /**
   * Reserve a batch, all-or-none, and return its lease.
   *
   * Synchronous: nothing of the caller's runs, and no coordinator state changes
   * unless the whole batch is valid and free. Throws `AdmissionClaimsError` for
   * a malformed batch (or a tuple repeated within it) and
   * `AdmissionConflictError` when any claim is already held. One invalid claim
   * rejects the whole batch, including any free claim beside it.
   *
   * This is the primitive for a caller that attests its own rollback: reserve,
   * run the activation, and release the lease itself when it knows every effect
   * was undone. `admit()` never makes that attestation on the caller's behalf.
   */
  reserve(claims: readonly ResourceClaim[]): AdmissionLease;
  /**
   * Reserve, run `activate`, and return a handle that releases on a clean close.
   *
   * The reservation happens **before** `activate` is invoked, so a conflicting
   * caller never runs any part of its activation. `activate` may be
   * asynchronous, may return any value, and that value is awaited before the
   * handle exists. It must defer every cleanup it acquires, immediately, via
   * `context.defer()`; effects it registers by any other route are invisible to
   * this module, which is why no atomic publish is claimed.
   *
   * On a throwing activation the claims are **always quarantined**, even when
   * the rollback was clean: an arbitrary callback can throw after an undeferred
   * effect, so releasing would be an unsafe guess. The activation error is
   * rethrown unchanged when the rollback was clean; otherwise an
   * `AdmissionActivationRollbackError` is thrown.
   *
   * Rejects with `TypeError` when `activate` is not a function (checked before
   * anything is reserved).
   */
  admit(
    claims: readonly ResourceClaim[],
    activate: (context: AdmissionContext) => unknown,
  ): Promise<AdmissionHandle>;
}

/**
 * Create one admission coordinator.
 *
 * Create **exactly one** per process and share that same object with every
 * cooperating participant — every plugin activation, every test path, every
 * queue. The coordinator is a shared claim table, not a per-plugin detail: a
 * coordinator per plugin gives each participant a private table, so a held
 * claim is invisible to the next one and the coordination is decorative.
 *
 * There is no module-level singleton and no default instance; sharing is the
 * caller's explicit act. Do **not** mint a second coordinator to get around a
 * held or quarantined claim: the new table starts empty, so the next activation
 * succeeds while the old effect may still be installed — the double activation
 * quarantine exists to prevent. Those claims are only recoverable after
 * host-level cleanup has proved the previous effect is gone.
 */
export declare function createAdmissionCoordinator(): AdmissionCoordinator;

/** Thrown before any state is mutated, when a batch is malformed or repeats a tuple. */
export declare class AdmissionClaimsError extends Error {
  constructor(problems: string[]);
  readonly name: 'AdmissionClaimsError';
  readonly code: 'ERR_ADMISSION_CLAIMS';
  /** One sentence per rejected claim (or per duplicate), in batch order. */
  readonly problems: readonly string[];
}

/** Thrown when a reservation overlaps claims this coordinator already holds. */
export declare class AdmissionConflictError extends Error {
  constructor(conflicts: ResourceClaim[]);
  readonly name: 'AdmissionConflictError';
  readonly code: 'ERR_ADMISSION_CONFLICT';
  /** The overlapping claims, frozen, in batch order. */
  readonly conflicts: readonly ResourceClaim[];
}

/**
 * Thrown when a lease is asked to do something its state forbids:
 * `release()` on a quarantined lease, or `quarantine()` on a released one.
 */
export declare class AdmissionLeaseStateError extends Error {
  constructor(attempted: 'release' | 'quarantine', state: 'quarantined' | 'released');
  readonly name: 'AdmissionLeaseStateError';
  readonly code: 'ERR_ADMISSION_LEASE_STATE';
  /** The operation that was refused. */
  readonly attempted: 'release' | 'quarantine';
  /** The lease state that refused it. */
  readonly state: 'quarantined' | 'released';
}

/**
 * The activation failed **and** at least one deferred cleanup also failed.
 *
 * `errors[0]` is the original activation value, untouched; the rest are the
 * cleanup failures in the scope's own order (reverse registration order). The
 * claims stay quarantined.
 */
export declare class AdmissionActivationRollbackError extends AggregateError {
  constructor(primary: unknown, rollbackFailure: unknown);
  readonly name: 'AdmissionActivationRollbackError';
  readonly code: 'ERR_ADMISSION_ROLLBACK';
  /** The original activation value. */
  readonly primary: unknown;
  /** The cleanup failures alone, in the scope's order. */
  readonly cleanupErrors: readonly unknown[];
}
