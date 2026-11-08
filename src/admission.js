/**
 * dsh-plugin-kit — caller-owned concurrent claim admission.
 *
 * ## What this is
 *
 * One object, made by the caller, that decides *in memory* which `(kind, name,
 * scope)` resource claims are currently held, and hands back a lease when a
 * batch is free. It is author-side bookkeeping for concurrency, and it is meant
 * to be **shared**: the caller creates one coordinator and hands that same
 * object to every cooperating participant — every plugin activation, every
 * test path, every queue in the same process. One table, one answer.
 *
 * It is not per plugin. A coordinator per plugin would give each participant a
 * private table, so a claim one participant holds would be invisible to the
 * next and the "coordination" would be decorative.
 *
 * Two entry points:
 *
 * | method | shape | use |
 * | --- | --- | --- |
 * | `reserve(claims)` | synchronous, all-or-nothing | the primitive: take claims, get a lease, release or quarantine it yourself |
 * | `admit(claims, activate)` | asynchronous | reserve, run the activation callback, return a handle that releases on close |
 *
 * ## What this is not
 *
 * - **Not host atomic publish.** A reservation is honoured only by callers that
 *   go through this same coordinator. It does not block, queue or fence the
 *   host's `ctx.tools.register()`, a dispatch that is already in flight, or any
 *   participant that bypasses it. A coordinator *instance* that nobody else was
 *   given, and another process, never see these claims — sharing is the caller's
 *   obligation, not something the module can enforce.
 * - **Shared by cooperation, not by module state.** There is no module-level
 *   table and no ambient default instance: `createAdmissionCoordinator()`
 *   returns a fresh coordinator, and the caller is expected to create exactly
 *   one and pass it around. Two coordinators in one process are two disjoint
 *   truth tables, which is a bug the module cannot detect — so do not mint a
 *   second one to "get around" a held or quarantined claim.
 * - **Not a lock with a deadline.** There is no timeout, no lease expiry, no
 *   heartbeat and no `Promise.race` anywhere in this module. A lease is held
 *   until it is released or quarantined; a promise that never settles leaves
 *   `admit()` or `handle.close()` pending for as long as the caller's own code
 *   is pending. A caller that needs a deadline must race its own timer and
 *   treat the claims as unrecoverable when it fires.
 * - **Not a security boundary.** Claim *strings* are author-chosen labels. This
 *   module does not authenticate who wrote a claim, does not prevent a caller
 *   from using a name it does not own, and does not survive a caller that
 *   ignores the lease.
 * - **Not a force-clear.** There is no public API that drops held claims,
 *   empties the map, resets a quarantined lease, or "releases everything".
 *   Quarantine exists precisely because an unsafe automatic clear would be the
 *   one call that turns an unknown state into a silent one. Do **not** treat a
 *   fresh coordinator, a reload or a process restart as recovery: a fresh
 *   coordinator starts with an empty table, so the next activation succeeds
 *   while the old effect may still be installed — the exact double-activation
 *   quarantine is there to prevent. Those claims are only recoverable after
 *   host-level cleanup: the host proves the previous effect is gone, and only
 *   then does a new activation reserve the tuple again.
 *
 * ## The claim tuple and its key
 *
 * A claim is exactly `{ kind, name, scope }`:
 *
 * - `kind` must be exactly the string `'tool'` or `'service'` — no case folding,
 *   no aliases.
 * - `name` and `scope` must be non-empty strings that are **already trimmed**.
 *   Leading or trailing whitespace is rejected, not stripped: the coordinator
 *   never rewrites caller input, because normalisation silently merges two
 *   labels the caller deliberately kept distinct. `'demo'` and `'demo '` stay
 *   two different strings: the padded one is refused, never folded into the
 *   other, so a claim can only ever be held under the exact string given.
 * - The claim must carry **exactly those three own string keys**. An extra own
 *   key (including a symbol key) is rejected rather than ignored, so a caller
 *   cannot smuggle a fourth member of identity past the tuple. A key that is
 *   only inherited, or that is an accessor, does not satisfy the contract
 *   either: the tuple is own data or it is not a claim.
 *
 * Values are read through own property descriptors, so a getter is never
 * invoked while a batch is validated. That is ordinary good hygiene, not a
 * sandbox: a `Proxy` still runs its own traps when its descriptor is read, and
 * nothing here intercepts later property access on objects the caller still
 * holds.
 *
 * The key is the canonical `JSON.stringify([kind, name, scope])` of the tuple.
 * Because all three members are strings, `JSON.stringify` is injective here: no
 * separator guessing, no concatenation ambiguity (`['a,b','c']` and
 * `['a','b,c']` cannot collide).
 *
 * Batches are validated **completely before anything is mutated**: one bad
 * claim, or a tuple repeated inside the same batch, rejects the whole batch and
 * leaves the coordinator exactly as it was.
 *
 * ## Leases
 *
 * `reserve()` returns a frozen lease:
 *
 * | member | meaning |
 * | --- | --- |
 * | `state` | `'reserved'`, `'released'` or `'quarantined'` |
 * | `claims` | the frozen tuples this lease holds |
 * | `release()` | give the claims back; idempotent |
 * | `quarantine()` | keep the claims forever; idempotent while reserved |
 *
 * Identity, not names: the coordinator maps each key to the *record* that owns
 * it, and `release()` only deletes a mapping whose value is that same record.
 * A stale lease therefore cannot free a newer generation that holds the same
 * keys — the check is `held.get(key) === record`, never "delete the key".
 *
 * The three states are not symmetric, and a released lease is not a weaker
 * quarantined one:
 *
 * - `release()` on a reserved lease gives everything back. A second call is a
 *   no-op; a release after the lease was released costs nothing.
 * - `release()` on a **quarantined** lease throws `AdmissionLeaseStateError`
 *   (`attempted: 'release'`, `state: 'quarantined'`), and changes nothing.
 *   Quarantine is the caller's statement that the claim's state is unknown, and
 *   an ordinary release must not undo it.
 * - `quarantine()` on a **released** lease throws `AdmissionLeaseStateError`
 *   (`attempted: 'quarantine'`, `state: 'released'`), and changes nothing
 *   either. A released lease no longer owns its keys: a newer generation may
 *   hold them right now, and a stale lease must not be able to declare *that*
 *   owner's claims unknown. The refusal is the only safe answer; the stale lease
 *   stays `'released'` forever.
 * - `quarantine()` on a reserved lease is idempotent and terminal: the claims
 *   stay mapped for the lifetime of the coordinator, so every later reservation
 *   of those keys conflicts. Nothing releases them afterwards — that is the
 *   point.
 *
 * ## Conflicts
 *
 * A reservation either takes every claim in the batch or none. On any overlap
 * it throws `AdmissionConflictError` (fixed code `ERR_ADMISSION_CONFLICT`) with
 * `.conflicts` listing the overlapping tuples in batch order. Nothing is
 * mutated, and in `admit()` nothing of the caller's runs: the reservation
 * happens **before** the activation callback is invoked, so a loser never
 * executes its registration side effects.
 *
 * ## `admit()` and the activation contract
 *
 * `admit(claims, activate)` reserves first, then calls
 * `activate(context)`, where `context` is frozen and exposes exactly one
 * member, `defer(disposer, options?)`, backed by `createCleanupScope()`. The
 * callback may be asynchronous and may return any value; the returned value is
 * `await`ed (a returned promise is awaited before the handle exists, so the
 * handle's `.value` is the settled value, never a pending promise).
 *
 * **The callback must defer every cleanup it acquires, immediately, in the
 * callback itself.** The module can only close over disposers it was handed. It
 * cannot see, undo or even detect an effect the callback registered through
 * some other route — a host port called directly, a `ctx` effect created
 * outside the context, a mutated global. Consequently:
 *
 * - This module does **not** provide atomic publish. It provides claim
 *   admission plus a caller-supplied rollback. Whatever the callback does
 *   outside `defer()` is unknown to it and stays unknown.
 * - **A throwing activation always quarantines the claims, even when the
 *   rollback was clean.** An arbitrary callback can register an effect and
 *   throw before deferring it; nothing in this module can tell "no effects" from
 *   "effects I never heard about". Releasing on a clean rollback would turn that
 *   into a silent double-activation for the next caller, so the conservative
 *   choice is taken: the claims stay held. The activation error is rethrown
 *   unchanged (same value, same identity) when the rollback was clean, and
 *   `AdmissionActivationRollbackError` — an `AggregateError` carrying
 *   `[activationError, ...cleanupErrors]` — is thrown when the rollback also
 *   failed.
 * - A caller that *does* know its rollback was complete can say so itself with
 *   the primitive: `reserve()`, run its own activation, and call
 *   `lease.release()` on failure. That is an explicit, caller-owned
 *   attestation. `admit()` never makes it on the caller's behalf.
 * - Automatic retry is therefore only safe after a **successful** close: a
 *   handle whose `close()` resolved has had every deferred cleanup succeed, so
 *   nothing this module was told about is still live.
 *
 * ## Close
 *
 * A successful activation returns a frozen `{ value, close() }`. `close()` runs
 * the scope and, when every deferred cleanup succeeded, releases the claims —
 * then, and only then. Every call returns the **same promise object** (the
 * first call creates it; later calls hand it back, including after it settled
 * and including its rejection), so two callers cannot observe two different
 * settlements.
 *
 * A cleanup failure **quarantines** the lease and rejects with the scope's own
 * aggregate (`ERR_CLEANUP_SCOPE_FAILED`) — the original rejection value, not a
 * re-wrap. The caller already knows which disposer threw: it is `.errors[0]`,
 * in identity. Because the coordinator's reason for keeping the claims is
 * "teardown did not fully work", a retry through the same coordinator now
 * conflicts, which is the accurate outcome.
 *
 * ## Reentrancy and trust limits
 *
 * These are documented rather than prevented, because preventing them would
 * require guessing at the caller's intent:
 *
 * - **Awaiting `close()` from inside one of its own cleanups deadlocks.** The
 *   scope awaits that cleanup, whose await waits for the close. Calling
 *   `close()` reentrantly is safe as long as the promise is not awaited: the
 *   settlement promise is created *before* the first cleanup runs, so a cleanup
 *   that calls `close()` receives that same promise object. It is the
 *   settled-await cycle that hangs, not the call.
 * - **Deferring after `close()` started is refused**, not dropped: the
 *   `CleanupScopeClosedError` from the scope propagates. A cleanup callback that
 *   tries to defer during teardown therefore becomes a cleanup failure, which
 *   quarantines the lease.
 * - **Calling `release()` or `quarantine()` from inside a cleanup is allowed**
 *   but pointless in one direction: `close()` decides the outcome after the
 *   scope settles, so a release issued mid-teardown does not make a failing
 *   close succeed, and a quarantine issued mid-teardown is already what a
 *   failure would do.
 * - **`admit()` is not reentrant-safe against itself in a hostile callback.** A
 *   callback that calls `admit()` on the same coordinator with overlapping
 *   claims sees a normal conflict; there is no deadlock, because `reserve()` is
 *   synchronous. A callback that never returns leaves its claims held forever —
 *   there is no timeout to save it.
 * - **A claims array is read once, synchronously, and its members are copied.**
 *   Each accepted tuple becomes a new frozen object, so mutating the caller's
 *   array or claim objects afterwards cannot change what was reserved. A claim
 *   that is an accessor is rejected rather than invoked. This is not a `Proxy`
 *   sandbox: descriptor reads on a proxy still run its traps, and nothing here
 *   intercepts later property access on objects the caller still holds.
 *
 * @packageDocumentation
 */

import { createCleanupScope } from './cleanup.js';

/**
 * The only accepted `kind` values, in the order they are documented. Exact
 * strings: no case folding, no aliases.
 */
export const CLAIM_KINDS = Object.freeze(['tool', 'service']);

/**
 * Canonical key of one validated claim tuple.
 *
 * `JSON.stringify` over an array of three strings is injective, so no
 * separator can be smuggled in through one member to collide with another
 * tuple.
 *
 * @param {{ kind: string, name: string, scope: string }} claim
 * @returns {string}
 */
function canonicalKey(claim) {
  return JSON.stringify([claim.kind, claim.name, claim.scope]);
}

/**
 * Render a claim for a message only. Every member is a validated string, and
 * `JSON.stringify` keeps a hostile-looking name from forging the rest of the
 * sentence.
 *
 * @param {{ kind: string, name: string, scope: string }} claim
 * @returns {string}
 */
function describeClaim(claim) {
  return `${JSON.stringify(claim.kind)} ${JSON.stringify(claim.name)} in scope ${JSON.stringify(claim.scope)}`;
}

/**
 * Thrown when a batch of claims is malformed or repeats a tuple. Thrown before
 * any coordinator state is mutated, so a rejected batch costs nothing.
 */
export class AdmissionClaimsError extends Error {
  /** @param {string[]} problems One sentence per rejected claim, in batch order. */
  constructor(problems) {
    super(`admission claims rejected: ${problems.join('; ')}`);
    this.name = 'AdmissionClaimsError';
    /** Stable machine-readable discriminator. */
    this.code = 'ERR_ADMISSION_CLAIMS';
    /** One sentence per rejected claim (or per duplicate), in batch order. */
    this.problems = Object.freeze(problems.slice());
  }
}

/**
 * Thrown when a reservation overlaps claims this coordinator already holds.
 * No claim is taken and no caller callback runs.
 */
export class AdmissionConflictError extends Error {
  /** @param {{ kind: string, name: string, scope: string }[]} conflicts Overlapping claims, in batch order. */
  constructor(conflicts) {
    const listed = conflicts.map(describeClaim).join(', ');
    super(`admission conflict: ${conflicts.length === 1 ? 'claim' : 'claims'} already held (${listed})`);
    this.name = 'AdmissionConflictError';
    /** Stable machine-readable discriminator. */
    this.code = 'ERR_ADMISSION_CONFLICT';
    /** The overlapping claims, frozen, in batch order. */
    this.conflicts = Object.freeze(conflicts.slice());
  }
}

/**
 * Thrown when a lease is asked to do something its state forbids: `release()`
 * on a quarantined lease, or `quarantine()` on an already-released one. Both
 * refusals leave the lease's state and the coordinator's table untouched.
 */
export class AdmissionLeaseStateError extends Error {
  /**
   * @param {'release' | 'quarantine'} attempted The refused operation, for the message only.
   * @param {'quarantined' | 'released'} state The state that refused it.
   */
  constructor(attempted, state) {
    const why = state === 'quarantined'
      ? 'a quarantined lease keeps its claims until the coordinator is discarded'
      : 'a released lease no longer owns its claims, and a stale lease must not quarantine the claims a newer generation now holds';
    super(`admission lease is ${state}: ${attempted}() is refused — ${why}`);
    this.name = 'AdmissionLeaseStateError';
    /** Stable machine-readable discriminator. */
    this.code = 'ERR_ADMISSION_LEASE_STATE';
    /** The operation that was refused. */
    this.attempted = attempted;
    /** The lease state that refused it. */
    this.state = state;
  }
}

/**
 * The activation failed **and** at least one deferred cleanup also failed, so
 * the claims are quarantined and the environment's state is unknown.
 *
 * `errors[0]` is the original activation value, untouched; the rest are the
 * cleanup failures in the scope's own order (reverse registration order).
 */
export class AdmissionActivationRollbackError extends AggregateError {
  /**
   * @param {unknown} primary The activation value, exactly as thrown.
   * @param {unknown} rollbackFailure The scope's close rejection, unchanged.
   */
  constructor(primary, rollbackFailure) {
    const cleanupErrors = cleanupErrorsOf(rollbackFailure);
    super(
      [primary, ...cleanupErrors],
      `admission activation failed and the rollback failed too: ${cleanupErrors.length} cleanup callback(s) threw; `
        + 'the claims stay quarantined because neither the activation nor its teardown can be trusted',
    );
    this.name = 'AdmissionActivationRollbackError';
    /** Stable machine-readable discriminator. */
    this.code = 'ERR_ADMISSION_ROLLBACK';
    /** The original activation value. */
    this.primary = primary;
    /** The cleanup failures alone, in the scope's order. */
    this.cleanupErrors = Object.freeze(cleanupErrors);
    /** The scope's own aggregate, kept for diagnostics. */
    this.cause = rollbackFailure;
  }
}

/**
 * Read the per-cleanup failures out of a scope rejection without coercing or
 * re-wrapping them.
 *
 * @param {unknown} rollbackFailure
 * @returns {unknown[]}
 */
function cleanupErrorsOf(rollbackFailure) {
  if (rollbackFailure !== null && typeof rollbackFailure === 'object') {
    const errors = /** @type {{ errors?: unknown }} */ (rollbackFailure).errors;
    if (Array.isArray(errors)) return errors.slice();
  }
  return rollbackFailure === undefined ? [] : [rollbackFailure];
}

/**
 * The three members of a claim's identity, and the only own keys a claim may
 * carry. Frozen so no caller can widen the accepted shape at runtime.
 */
const CLAIM_FIELDS = Object.freeze(['kind', 'name', 'scope']);

/**
 * Read one field as own data, without ever invoking an accessor.
 *
 * @param {object} claim
 * @param {'kind' | 'name' | 'scope'} field
 * @returns {{ present: boolean, value: unknown, accessor: boolean }}
 */
function readOwnField(claim, field) {
  const descriptor = Object.getOwnPropertyDescriptor(claim, field);
  if (descriptor === undefined) return { present: false, value: undefined, accessor: false };
  // An accessor is refused rather than called: validation must not run caller
  // code, and a getter would make "the claim" depend on when it was read.
  if (!Object.hasOwn(descriptor, 'value')) return { present: true, value: undefined, accessor: true };
  return { present: true, value: /** @type {PropertyDescriptor} */ (descriptor).value, accessor: false };
}

/**
 * Describe one unexpected own key for an error message, without calling into
 * it. A string key is quoted; anything else is described by kind only, so
 * `Symbol.prototype.description` is not even read.
 *
 * @param {string | symbol} key
 * @returns {string}
 */
function describeOwnKey(key) {
  return typeof key === 'string' ? `own key ${JSON.stringify(key)}` : 'an own symbol key';
}

/**
 * Validate a whole batch and return its frozen claims.
 *
 * Pure: it reads the array, reads each claim's own data descriptors, and
 * returns new frozen objects. It never touches coordinator state, so a throw
 * here cannot leave a half-reserved batch behind — not even when a valid claim
 * sits next to an invalid one.
 *
 * `name` and `scope` are used exactly as given. They must already be trimmed;
 * the validator refuses outer whitespace instead of stripping it, so the string
 * that is keyed is always the string the caller wrote.
 *
 * @param {unknown} claims
 * @returns {readonly { kind: 'tool' | 'service', name: string, scope: string }[]}
 */
function auditClaims(claims) {
  if (!Array.isArray(claims)) {
    throw new AdmissionClaimsError(['claims must be an array of { kind, name, scope } resource claims']);
  }
  if (claims.length === 0) {
    throw new AdmissionClaimsError([
      'claims must contain at least one claim: an empty reservation would hold nothing and admit nothing',
    ]);
  }

  /** @type {string[]} */
  const problems = [];
  /** @type {{ kind: 'tool' | 'service', name: string, scope: string }[]} */
  const accepted = [];
  /** @type {number[]} Index in `claims` of each entry in `accepted`. */
  const positions = [];

  for (let index = 0; index < claims.length; index += 1) {
    const raw = claims[index];
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      problems.push(`claims[${index}] must be a plain object of exactly { kind, name, scope }, not an array, function or primitive`);
      continue;
    }
    const claim = /** @type {object} */ (raw);
    let usable = true;

    const ownKeys = Reflect.ownKeys(claim);
    const extra = ownKeys.filter((key) => !CLAIM_FIELDS.includes(/** @type {any} */ (key)));
    if (extra.length > 0) {
      problems.push(
        `claims[${index}] must carry only the own keys kind, name and scope; found ${extra.map(describeOwnKey).join(', ')}`,
      );
      usable = false;
    }

    const kindField = readOwnField(claim, 'kind');
    if (!kindField.present) {
      problems.push(`claims[${index}].kind must be an own property, not an inherited one`);
      usable = false;
    } else if (kindField.accessor) {
      problems.push(`claims[${index}].kind must be a data property, not an accessor`);
      usable = false;
    } else if (kindField.value !== 'tool' && kindField.value !== 'service') {
      problems.push(`claims[${index}].kind must be exactly 'tool' or 'service'`);
      usable = false;
    }

    /** @type {Record<'name' | 'scope', string>} */
    const text = { name: '', scope: '' };
    for (const field of /** @type {const} */ (['name', 'scope'])) {
      const { present, value, accessor } = readOwnField(claim, field);
      if (!present) {
        problems.push(`claims[${index}].${field} must be an own property, not an inherited one`);
        usable = false;
        continue;
      }
      if (accessor) {
        problems.push(`claims[${index}].${field} must be a data property, not an accessor`);
        usable = false;
        continue;
      }
      if (typeof value !== 'string') {
        problems.push(`claims[${index}].${field} must be a string`);
        usable = false;
        continue;
      }
      if (value === '') {
        problems.push(`claims[${index}].${field} must not be empty`);
        usable = false;
        continue;
      }
      if (value.trim() !== value) {
        // Refused, never normalised: stripping would silently merge this claim
        // with a differently-spaced one the caller may have meant to keep apart.
        problems.push(
          `claims[${index}].${field} must already be trimmed: leading or trailing whitespace is rejected, not removed (${JSON.stringify(value)})`,
        );
        usable = false;
        continue;
      }
      text[field] = value;
    }
    if (!usable) continue;

    accepted.push(
      /** @type {{ kind: 'tool' | 'service', name: string, scope: string }} */ (
        { kind: /** @type {'tool' | 'service'} */ (kindField.value), name: text.name, scope: text.scope }
      ),
    );
    positions.push(index);
  }

  // Duplicates are decided on the exact tuple: the same claim twice in one
  // batch is a caller bug, and reserving it twice would silently make one
  // lease's release free the other's claim.
  /** @type {Map<string, number>} */
  const seen = new Map();
  for (let offset = 0; offset < accepted.length; offset += 1) {
    const key = canonicalKey(accepted[offset]);
    const first = seen.get(key);
    if (first !== undefined) {
      problems.push(`claims[${positions[offset]}] repeats the claim already given at claims[${first}]`);
      continue;
    }
    seen.set(key, positions[offset]);
  }

  if (problems.length > 0) throw new AdmissionClaimsError(problems);

  return Object.freeze(accepted.map((claim) => Object.freeze(claim)));
}

/**
 * Create one admission coordinator.
 *
 * Create exactly one per process and share that object with every cooperating
 * participant: the coordinator is the shared claim table, not a per-plugin
 * detail. Two of them in one process are two disjoint tables, which silently
 * defeats the coordination they exist for.
 *
 * @returns {{
 *   reserve: (claims: unknown) => AdmissionLease,
 *   admit: (claims: unknown, activate: (context: AdmissionContext) => unknown) => Promise<AdmissionHandle>,
 *   readonly size: number,
 * }}
 */
export function createAdmissionCoordinator() {
  /**
   * Every held key, mapped to the one record that owns it. Quarantined records
   * stay here for the lifetime of the coordinator: their keys are what makes
   * the claims permanently unavailable.
   *
   * @type {Map<string, LeaseRecord>}
   */
  const held = new Map();

  /**
   * Validate, check for overlap, and only then mutate. Synchronous throughout,
   * so no caller code can interleave between the conflict check and the insert.
   *
   * @param {unknown} claims
   * @returns {{ record: LeaseRecord, lease: AdmissionLease }}
   */
  function reserveInternal(claims) {
    const frozenClaims = auditClaims(claims);

    /** @type {{ kind: 'tool' | 'service', name: string, scope: string }[]} */
    const conflicts = [];
    for (const claim of frozenClaims) {
      if (!held.has(canonicalKey(claim))) continue;
      // A batch can never repeat a tuple here (audit refused duplicates), so
      // each conflicting claim is reported once.
      conflicts.push(claim);
    }
    if (conflicts.length > 0) throw new AdmissionConflictError(conflicts);

    /** @type {LeaseRecord} */
    const record = {
      state: 'reserved',
      claims: frozenClaims,
      keys: Object.freeze(frozenClaims.map(canonicalKey)),
    };
    for (const key of record.keys) held.set(key, record);

    return { record, lease: leaseView(record) };
  }

  /**
   * @param {LeaseRecord} record
   * @returns {AdmissionLease}
   */
  function leaseView(record) {
    return Object.freeze({
      get state() {
        return record.state;
      },
      get claims() {
        return record.claims;
      },
      release() {
        releaseRecord(record);
      },
      quarantine() {
        quarantineRecord(record);
      },
    });
  }

  /**
   * Give claims back. Idempotent; refuses only on a quarantined lease.
   *
   * The ownership check is `held.get(key) === record`: a stale record whose
   * keys were already handed to a newer generation deletes nothing, so a late
   * release can only ever speak for itself.
   *
   * @param {LeaseRecord} record
   */
  function releaseRecord(record) {
    if (record.state === 'quarantined') throw new AdmissionLeaseStateError('release', 'quarantined');
    if (record.state === 'released') return;
    record.state = 'released';
    for (const key of record.keys) {
      if (held.get(key) === record) held.delete(key);
    }
  }

  /**
   * Keep claims forever — but only for a lease that still owns them.
   *
   * Idempotent and terminal while reserved: the keys stay mapped, so any later
   * reservation of them conflicts, and no ordinary release can undo it.
   *
   * A **released** record is refused, not converted. Its keys may already belong
   * to a newer generation, and quarantining a stale lease would declare that
   * newer owner's live claims permanently unsafe. The record keeps `'released'`
   * and the table is never touched.
   *
   * @param {LeaseRecord} record
   */
  function quarantineRecord(record) {
    if (record.state === 'quarantined') return;
    if (record.state === 'released') throw new AdmissionLeaseStateError('quarantine', 'released');
    record.state = 'quarantined';
  }

  /**
   * Reserve a batch, all-or-none, and return its lease.
   *
   * @param {unknown} claims
   * @returns {AdmissionLease}
   */
  function reserve(claims) {
    return reserveInternal(claims).lease;
  }

  /**
   * Reserve, activate, and return a handle that releases on a clean close.
   *
   * Reservation happens before the callback runs, so a conflicting caller never
   * executes any part of its activation.
   *
   * @param {unknown} claims
   * @param {(context: AdmissionContext) => unknown} activate
   * @returns {Promise<AdmissionHandle>}
   */
  async function admit(claims, activate) {
    if (typeof activate !== 'function') {
      throw new TypeError(
        'createAdmissionCoordinator().admit(claims, activate): activate must be a function that defers its cleanups',
      );
    }

    // Conflict and malformed-batch errors propagate untouched, before any of
    // the caller's code runs and before any coordinator mutation. Only the
    // record is kept: this path never hands the caller a lease, because the
    // handle's close() is the only thing allowed to release these claims.
    const { record } = reserveInternal(claims);

    const scope = createCleanupScope();
    /** @type {AdmissionContext} */
    const context = Object.freeze({
      defer(disposer, options) {
        return scope.defer(disposer, options);
      },
    });

    /** @type {unknown} */
    let value;
    try {
      // Awaited, so a promise-returning activation is fully settled before the
      // handle exists and `.value` is always the settled value.
      value = await activate(context);
    } catch (activationError) {
      // Always quarantine: an arbitrary callback may have registered an effect
      // and thrown before deferring it, and this module cannot distinguish
      // "nothing acquired" from "effects it never heard about". A release here
      // would be an unsafe guess, so no automatic release exists on this path.
      quarantineRecord(record);
      /** @type {unknown} */
      let rollbackFailure;
      let rollbackFailed = false;
      try {
        await scope.close();
      } catch (error) {
        rollbackFailure = error;
        rollbackFailed = true;
      }
      if (!rollbackFailed) throw activationError;
      throw new AdmissionActivationRollbackError(activationError, rollbackFailure);
    }

    /** @type {Promise<void> | undefined} */
    let settlement;

    return Object.freeze({
      /** The activation's settled return value, whatever it was. */
      get value() {
        return value;
      },
      /**
       * Run every deferred cleanup, then release the claims — or quarantine
       * them if any cleanup failed. Every call returns the same promise.
       *
       * @returns {Promise<void>}
       */
      close() {
        if (settlement !== undefined) return settlement;
        // The one promise object is created *before* the scope starts, because
        // the scope invokes its first cleanup synchronously: a cleanup that
        // calls close() reentrantly must receive this same object, not a second
        // chain over the same teardown.
        /** @type {(value: void) => void} */
        let resolveSettlement;
        /** @type {(reason: unknown) => void} */
        let rejectSettlement;
        settlement = new Promise((resolve, reject) => {
          resolveSettlement = resolve;
          rejectSettlement = reject;
        });
        const shared = settlement;
        scope.close().then(
          () => {
            try {
              // Claims are released only after every cleanup settled
              // successfully: that settlement is the caller's only evidence
              // that nothing is still live.
              releaseRecord(record);
            } catch (error) {
              rejectSettlement(error);
              return;
            }
            resolveSettlement();
          },
          (cleanupFailure) => {
            // Rejected with the scope's own aggregate, unchanged: the caller
            // already has the thrown value in `cleanupFailure.errors`.
            // `record` is still reserved here: `admit()` never hands the caller
            // a lease, so the only release for these claims is the clean path
            // above, which this branch did not take.
            quarantineRecord(record);
            rejectSettlement(cleanupFailure);
          },
        );
        return shared;
      },
    });
  }

  return Object.freeze({
    reserve,
    admit,
    /** Distinct claims currently held — reserved or quarantined. */
    get size() {
      return held.size;
    },
  });
}

/**
 * @typedef {{ kind: 'tool' | 'service', name: string, scope: string }} ResourceClaim
 *
 * @typedef {'reserved' | 'released' | 'quarantined'} LeaseState
 *
 * @typedef {object} LeaseRecord
 * @property {LeaseState} state
 * @property {readonly ResourceClaim[]} claims
 * @property {readonly string[]} keys
 *
 * @typedef {object} AdmissionLease
 * @property {LeaseState} state
 * @property {readonly ResourceClaim[]} claims
 * @property {() => void} release
 * @property {() => void} quarantine
 *
 * @typedef {object} AdmissionContext
 * @property {(disposer: () => unknown, options?: { label?: string }) => import('./cleanup.js').CleanupHandle} defer
 *
 * @typedef {object} AdmissionHandle
 * @property {unknown} value
 * @property {() => Promise<void>} close
 */
