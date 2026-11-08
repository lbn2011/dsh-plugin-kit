/**
 * Admission-coordinator integration tests.
 *
 * The subject is `createAdmissionCoordinator()` from `../src/admission.js`: the
 * in-memory claim table that decides whether a resource tuple — `{ kind, name,
 * scope }` — may be mounted right now, and that keeps a claim conservatively
 * held whenever an activation threw or a release failed.
 *
 * ## What the host is here
 *
 * A FAKE host, and it is labelled as one: `mockHostPorts()` is a bag of closures
 * standing in for a host's tool-registration and subscription ports. It is NOT
 * the real Loader, not Cordis and not the vendored adapter, and no case here
 * claims anything about how those behave. What the fake pins is only what the
 * kit *asks* of a host: a port called with no arguments that returns a native
 * disposer.
 *
 * ## What is real
 *
 * The acquire/unwind path is the kit's own `registerManagedResource()` — every
 * activation below goes through it, immediately defers `() => managed.close()`
 * into the activation's `defer()`, and hands the managed handle back as the
 * activation's value. Nothing here re-implements the kit's port order, its
 * rollback, or its shared close promise, so a green case really does mean the
 * coordinator composes that implementation rather than a stand-in for it.
 *
 * ## Waiting
 *
 * No case sleeps. Where a case needs an activation or a close still in flight it
 * holds a deferred gate open. Where a case needs to know that a competing
 * admission was *refused* rather than merely queued, it releases the holder and
 * only then reads the competitor's settled outcome — so "the loser never got
 * installed" cannot pass just because the loser had not run yet.
 *
 * Run: node --test "tests/*.test.js"   (not run as part of this change)
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ManagedRegistrationActivationError,
  ManagedRegistrationFailure,
  registerManagedResource,
} from '../src/managed-registration.js';
import {
  AdmissionConflictError,
  AdmissionLeaseStateError,
  createAdmissionCoordinator,
} from '../src/admission.js';

/** One claim on one resource tuple. Two claim objects with equal fields are one claim. */
function claim(kind, name, scope) {
  return { kind, name, scope };
}

/** A one-shot gate: `open()` settles the promise it hands out. */
function gate() {
  let open;
  const promise = new Promise((resolve) => { open = resolve; });
  return { promise, open };
}

/**
 * A FAKE host registry's ports — mock, not the real Loader.
 *
 * `register` and `subscribe` count and log their calls and return a
 * native-style disposer, which is the whole of the contract
 * `registerManagedResource()` places on a host. `counts.register` is what "the
 * loser never installed a definition" is measured by; `unregisterGate` makes a
 * disposer stay pending so a close can be observed in flight.
 */
function mockHostPorts(options = {}) {
  const log = [];
  const counts = { register: 0, unregister: 0, subscribe: 0, unsubscribe: 0 };
  return {
    log,
    counts,
    ports: {
      register() {
        counts.register += 1;
        log.push('register');
        return () => {
          counts.unregister += 1;
          log.push('unregister');
          return options.unregisterGate === undefined ? undefined : options.unregisterGate.promise;
        };
      },
      subscribe() {
        counts.subscribe += 1;
        log.push('subscribe');
        if (options.subscribeThrowsOnAcquire !== undefined) throw options.subscribeThrowsOnAcquire;
        return () => {
          counts.unsubscribe += 1;
          log.push('unsubscribe');
          if (options.unsubscribeThrows !== undefined) throw options.unsubscribeThrows;
        };
      },
    },
  };
}

/**
 * The composition every activation below uses: acquire through the REAL kit,
 * hand the kit's own `close()` to the activation's `defer()` immediately, and
 * return the managed handle as the activation value.
 */
function activateThroughKit(host, label) {
  return (activation) => {
    const managed = registerManagedResource(host.ports, label === undefined ? {} : { label });
    activation.defer(() => managed.close());
    return managed;
  };
}

/** The managed handle an admission produced. */
function managedOf(handle) {
  assert.ok(handle !== null && typeof handle === 'object', 'admit() produced a handle object');
  assert.equal(typeof handle.close, 'function', 'the handle exposes close()');
  return handle.value;
}

/** Settle one admission attempt into a value or an error, a synchronous throw included. */
async function outcomeOf(run) {
  try {
    return await run();
  } catch (error) {
    return error;
  }
}

/** Walk an error's `cause`/`errors` chain looking for a match. Never throws. */
function findError(reason, predicate) {
  const queue = [reason];
  const seen = new Set();
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === null || typeof current !== 'object' || seen.has(current)) continue;
    seen.add(current);
    if (predicate(current)) return current;
    if (current.cause !== undefined) queue.push(current.cause);
    if (Array.isArray(current.errors)) queue.push(...current.errors);
  }
  return undefined;
}

/** The kit failure that ended an activation, wherever the coordinator left it. */
function kitFailureOf(reason) {
  return findError(reason, (error) => error instanceof ManagedRegistrationFailure);
}

/**
 * Fail unless an attempt was refused as an admission conflict. An admitted
 * handle is unwound first, so a failing case never leaves a definition mounted
 * behind it.
 */
async function assertConflict(outcome, message) {
  if (outcome !== null && typeof outcome === 'object' && typeof outcome.close === 'function') {
    await outcome.close();
    assert.fail(`${message}: it was admitted instead (that definition has been closed again)`);
  }
  assert.ok(outcome instanceof AdmissionConflictError, `${message}: received ${typeof outcome} instead`);
  assert.equal(outcome.code, 'ERR_ADMISSION_CONFLICT');
  return outcome;
}

test('an activation still in flight holds its claim, and the rival never reaches its host', async () => {
  const coordinator = createAdmissionCoordinator();
  const winnerHost = mockHostPorts();
  const rivalHost = mockHostPorts();
  const entered = gate();
  const hold = gate();

  const winner = coordinator.admit([claim('tool', 'weather', 'global')], async (activation) => {
    entered.open();
    await hold.promise; // the claim is held while this activation is still in flight
    return activateThroughKit(winnerHost, 'winner')(activation);
  });
  await entered.promise;
  assert.equal(coordinator.size, 1, 'the claim is already held before the activation finished');

  const rival = outcomeOf(() => coordinator.admit(
    [claim('tool', 'weather', 'global')], // equal fields, different object: the same claim
    activateThroughKit(rivalHost, 'rival'),
  ));

  hold.open();
  const winnerHandle = await winner;
  const winnerManaged = managedOf(winnerHandle);
  assert.equal(typeof winnerManaged.close, 'function', 'the activation value is the real managed handle');
  assert.equal(winnerManaged.active, true, 'that handle is live while the claim is held');
  assert.equal(winnerHost.counts.register, 1, 'the winner installed its definition exactly once');

  await winnerHandle.close();
  assert.equal(winnerManaged.active, false, 'closing the admission unwound the managed handle');
  assert.equal(winnerHost.counts.unregister, 1, 'closing the winner unwound the real kit registration');
  assert.equal(coordinator.size, 0, 'a clean close released the claim');

  await assertConflict(await rival, 'a claim held by an in-flight activation was admitted');
  assert.equal(rivalHost.counts.register, 0, 'the rival never installed a definition');

  // A clean close is a release, so the tuple is admissible again.
  const retryHost = mockHostPorts();
  const retry = await coordinator.admit([claim('tool', 'weather', 'global')], activateThroughKit(retryHost));
  assert.equal(retryHost.counts.register, 1, 'the released claim admitted a new definition');
  await retry.close();
  assert.equal(retryHost.counts.unregister, 1);
  assert.equal(coordinator.size, 0);
});

test('admissions on disjoint scopes coexist: the second activates while the first is mounted', async () => {
  const coordinator = createAdmissionCoordinator();
  const firstHost = mockHostPorts();
  const secondHost = mockHostPorts();

  const first = await coordinator.admit([claim('tool', 'weather', 'scope-a')], activateThroughKit(firstHost));
  let firstWasMountedDuringSecond = false;
  const second = await coordinator.admit([claim('tool', 'weather', 'scope-b')], (activation) => {
    firstWasMountedDuringSecond = firstHost.counts.unregister === 0;
    return activateThroughKit(secondHost)(activation);
  });

  assert.equal(firstWasMountedDuringSecond, true, 'the first admission was still mounted while the second activated');
  assert.equal(firstHost.counts.register, 1);
  assert.equal(secondHost.counts.register, 1, 'the second scope admitted its own definition');
  assert.equal(coordinator.size, 2, 'both scopes are held at once');

  await second.close();
  assert.equal(secondHost.counts.unregister, 1);
  assert.equal(firstHost.counts.unregister, 0, 'closing one scope left the other mounted');
  assert.equal(coordinator.size, 1);

  await first.close();
  assert.equal(firstHost.counts.unregister, 1);
  assert.equal(coordinator.size, 0);
});

test('an activation whose subscribe port throws is refused, its rollback awaited, and its claim kept', async () => {
  const coordinator = createAdmissionCoordinator();
  const primary = new Error('subscribe rejected by the mock host');
  const host = mockHostPorts({ subscribeThrowsOnAcquire: primary });

  const reason = await outcomeOf(() => coordinator.admit([claim('tool', 'notes', 'global')], activateThroughKit(host)));
  assert.ok(reason instanceof Error, 'the throwing activation refused the admission');

  const failure = kitFailureOf(reason);
  assert.ok(failure instanceof ManagedRegistrationActivationError, 'the kit activation failure reached the caller');
  assert.equal(failure.port, 'subscribe', 'the failing port is the one the mock threw from');
  assert.equal(failure.primary, primary, 'the mock host’s own thrown value, untouched');
  assert.equal(host.counts.register, 1, 'the tool was acquired before the subscribe port threw');
  assert.equal(coordinator.size, 1, 'the claim is still held after the refused admission');

  await failure.rollback; // awaited explicitly: it is part of the failure, not a side effect
  assert.equal(host.counts.unregister, 1, 'the tool acquired before subscribe was unregistered exactly once');

  // Conservative on purpose: a thrown activation keeps the claim even though
  // the rollback above was clean.
  const rivalHost = mockHostPorts();
  await assertConflict(
    await outcomeOf(() => coordinator.admit([claim('tool', 'notes', 'global')], activateThroughKit(rivalHost))),
    'a claim whose activation threw was released by the clean rollback',
  );
  assert.equal(rivalHost.counts.register, 0, 'the rival never installed a definition');
});

test('a throwing unsubscribe still unregisters once, and the failed close keeps the claim', async () => {
  const coordinator = createAdmissionCoordinator();
  const boom = new Error('unsubscribe threw at teardown');
  const host = mockHostPorts({ unsubscribeThrows: boom });
  const tuple = claim('service', 'cache', 'global');

  const handle = await coordinator.admit([tuple], activateThroughKit(host));
  const first = handle.close();
  const reason = await first.then(() => null, (error) => error);

  assert.ok(reason instanceof Error, 'close() rejected because a disposer threw');
  const scopeFailure = findError(reason, (error) => error instanceof AggregateError && Array.isArray(error.errors));
  assert.ok(scopeFailure, 'the kit scope reported the teardown failure');
  assert.ok(findError(reason, (error) => error === boom), 'the unsubscribe failure is carried through');
  assert.equal(host.counts.unregister, 1, 'the tool unregister still ran, exactly once');
  assert.equal(host.counts.unsubscribe, 1);
  assert.equal(coordinator.size, 1, 'the claims were retained, not released');

  const again = handle.close();
  assert.equal(again, first, 'close() keeps handing back the one shared promise');
  assert.equal(await again.then(() => null, (error) => error), reason, 'the same rejection value every time');

  const rivalHost = mockHostPorts();
  await assertConflict(
    await outcomeOf(() => coordinator.admit([tuple], activateThroughKit(rivalHost))),
    'a claim whose close failed was released anyway',
  );
  assert.equal(rivalHost.counts.register, 0, 'no definition was installed over a retained claim');
});

test('a pending close blocks the claim, a clean close lets the retry through, and the stale close is inert', async () => {
  const coordinator = createAdmissionCoordinator();
  const releaseGate = gate();
  const host = mockHostPorts({ unregisterGate: releaseGate });
  const tuple = claim('tool', 'forecast', 'global');

  const handle = await coordinator.admit([tuple], activateThroughKit(host));
  const closing = handle.close();

  const rivalHost = mockHostPorts();
  const rival = outcomeOf(() => coordinator.admit([tuple], activateThroughKit(rivalHost)));

  releaseGate.open(); // the in-flight release settles here
  await closing;
  assert.equal(host.counts.unregister, 1, 'the pending release reached its disposer');
  assert.equal(coordinator.size, 0, 'the clean close released the claim');

  await assertConflict(await rival, 'a claim was handed out while its release was still settling');
  assert.equal(rivalHost.counts.register, 0, 'the rival never installed a definition');

  // A settled clean close is a release, so the retry is admitted.
  const retryHost = mockHostPorts();
  const retry = await coordinator.admit([tuple], activateThroughKit(retryHost));
  assert.equal(retryHost.counts.register, 1, 'the retry installed the definition once');

  assert.equal(handle.close(), closing, 'the settled close still returns the same promise');
  await handle.close();
  assert.equal(retryHost.counts.unregister, 0, 'the stale close did not unwind the new definition');
  assert.equal(retryHost.counts.register, 1);

  await retry.close();
  assert.equal(retryHost.counts.unregister, 1);
  assert.equal(coordinator.size, 0);
});

test('a multi-claim admission with one conflicting claim acquires nothing at all', async () => {
  const coordinator = createAdmissionCoordinator();
  const heldTuple = claim('service', 'telemetry', 'global');
  const freeTuple = claim('tool', 'planner', 'global');

  const heldHost = mockHostPorts();
  const held = await coordinator.admit([heldTuple], activateThroughKit(heldHost));
  assert.equal(heldHost.counts.register, 1);

  const batchHost = mockHostPorts();
  await assertConflict(
    await outcomeOf(() => coordinator.admit([freeTuple, heldTuple], activateThroughKit(batchHost))),
    'a batch containing a conflicting claim was admitted',
  );
  assert.equal(batchHost.counts.register, 0, 'the earlier free claim was not acquired either');
  assert.equal(coordinator.size, 1, 'the refused batch reserved nothing');

  // The conflict did not leak into the free tuple: on its own it is admitted.
  const soloHost = mockHostPorts();
  const solo = await coordinator.admit([freeTuple], activateThroughKit(soloHost));
  assert.equal(soloHost.counts.register, 1, 'the free claim was still available after the refused batch');

  await solo.close();
  assert.equal(soloHost.counts.unregister, 1);
  await held.close();
  assert.equal(heldHost.counts.unregister, 1);
});

test('a reserved lease releases idempotently, and quarantine is not undone by a release', async () => {
  const coordinator = createAdmissionCoordinator();
  const tuple = claim('tool', 'search', 'global');

  const lease = coordinator.reserve([tuple]);
  assert.equal(lease.state, 'reserved');
  assert.equal(coordinator.size, 1);

  const blockedHost = mockHostPorts();
  await assertConflict(
    await outcomeOf(() => coordinator.admit([tuple], activateThroughKit(blockedHost))),
    'a claim covered by a live reservation was admitted',
  );
  assert.equal(blockedHost.counts.register, 0);

  lease.release();
  lease.release(); // idempotent: a second release neither throws nor regresses
  assert.equal(lease.state, 'released');
  const afterReleaseHost = mockHostPorts();
  const admitted = await coordinator.admit([tuple], activateThroughKit(afterReleaseHost));
  assert.equal(afterReleaseHost.counts.register, 1, 'the release freed the claim');
  await admitted.close();
  assert.equal(afterReleaseHost.counts.unregister, 1);

  const quarantined = coordinator.reserve([tuple]);
  quarantined.quarantine();
  quarantined.quarantine(); // idempotent and terminal
  assert.equal(quarantined.state, 'quarantined');

  // "Irreversible" has to mean an ordinary release cannot undo it: the module
  // refuses the release outright rather than silently dropping it.
  const refusal = await outcomeOf(() => quarantined.release());
  assert.ok(refusal instanceof AdmissionLeaseStateError, 'release() on a quarantined lease is refused');
  assert.equal(refusal.code, 'ERR_ADMISSION_LEASE_STATE');

  const stillBlockedHost = mockHostPorts();
  await assertConflict(
    await outcomeOf(() => coordinator.admit([tuple], activateThroughKit(stillBlockedHost))),
    'a quarantined claim was freed by release()',
  );
  assert.equal(stillBlockedHost.counts.register, 0, 'no definition was installed over a quarantined claim');
  assert.equal(coordinator.size, 1, 'the quarantined claim stays held for the coordinator’s lifetime');
});
