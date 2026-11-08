import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as admission from '../src/admission.js';
import {
  AdmissionActivationRollbackError,
  AdmissionClaimsError,
  AdmissionConflictError,
  AdmissionLeaseStateError,
  CLAIM_KINDS,
  createAdmissionCoordinator,
} from '../src/admission.js';

// Written against the documented contract, deliberately without running any
// host simulation: the coordinator owns no host state, so "does it hold the
// claim" is observed through the public surface only (a later reserve either
// conflicts or it does not).

const TOOL = (name, scope = 'plugin') => ({ kind: 'tool', name, scope });
const SERVICE = (name, scope = 'plugin') => ({ kind: 'service', name, scope });

/** Assert a thrown/rejected error carries one exact code. */
function code(expected) {
  return (error) => {
    assert.equal(error.code, expected);
    return true;
  };
}

test('the module exports exactly the documented surface', () => {
  assert.deepEqual(Object.keys(admission).sort(), [
    'AdmissionActivationRollbackError',
    'AdmissionClaimsError',
    'AdmissionConflictError',
    'AdmissionLeaseStateError',
    'CLAIM_KINDS',
    'createAdmissionCoordinator',
  ]);
  assert.deepEqual([...CLAIM_KINDS], ['tool', 'service']);
  assert.ok(Object.isFrozen(CLAIM_KINDS), 'CLAIM_KINDS must not be mutable');
});

test('reserve() takes a whole batch or nothing, and returns a frozen lease', () => {
  const coordinator = createAdmissionCoordinator();
  const a = TOOL('demo.a');
  const b = SERVICE('demo.b');
  const lease = coordinator.reserve([a, b]);

  assert.ok(Object.isFrozen(lease), 'the lease is frozen');
  assert.ok(Object.isFrozen(lease.claims), 'the claim list is frozen');
  assert.ok(Object.isFrozen(lease.claims[0]), 'each claim is frozen');
  assert.equal(lease.state, 'reserved');
  assert.deepEqual(lease.claims.map((claim) => [claim.kind, claim.name, claim.scope]), [
    ['tool', 'demo.a', 'plugin'],
    ['service', 'demo.b', 'plugin'],
  ]);
  assert.equal(coordinator.size, 2);

  // A second batch that overlaps one claim takes nothing at all.
  const c = TOOL('demo.c');
  assert.throws(() => coordinator.reserve([b, c]), (error) => {
    assert.ok(error instanceof AdmissionConflictError);
    assert.equal(error.code, 'ERR_ADMISSION_CONFLICT');
    assert.ok(Object.isFrozen(error.conflicts));
    assert.deepEqual(error.conflicts.map((claim) => claim.name), ['demo.b']);
    return true;
  });
  // `demo.c` was never taken, so it is free.
  const cLease = coordinator.reserve([c]);
  assert.equal(cLease.state, 'reserved');
  assert.equal(cLease.claims[0].name, 'demo.c');

  lease.release();
  assert.equal(coordinator.size, 1, 'only the c lease is still held');
  cLease.release();
  assert.equal(coordinator.size, 0);
});

test('every coordinator is an independent instance', () => {
  const one = createAdmissionCoordinator();
  const two = createAdmissionCoordinator();
  const claim = TOOL('shared.name');

  const leaseOne = one.reserve([claim]);
  const leaseTwo = two.reserve([claim]);
  assert.equal(leaseOne.state, 'reserved');
  assert.equal(leaseTwo.state, 'reserved');

  // A quarantine in one instance is invisible to the other.
  leaseOne.quarantine();
  assert.equal(leaseOne.state, 'quarantined');
  assert.throws(() => one.reserve([claim]), code('ERR_ADMISSION_CONFLICT'));
  assert.equal(two.size, 1, 'the other coordinator still holds its own claim');
  leaseTwo.release();
  assert.equal(two.size, 0);
});

test('each tuple member separates claims from its neighbours', () => {
  const coordinator = createAdmissionCoordinator();
  const claims = [
    TOOL('x', 's'),
    TOOL('x', 'other'),
    SERVICE('x', 's'),
    SERVICE('x', 'other'),
    TOOL('other', 's'),
  ];
  const lease = coordinator.reserve(claims);
  assert.equal(lease.claims.length, 5);
  assert.equal(coordinator.size, 5);
  // Same name in another scope is a different claim, so it is reservable.
  assert.equal(coordinator.reserve([TOOL('x', 'third')]).state, 'reserved');
  lease.release();
});

test('the canonical key cannot be forged through delimiters in a member', () => {
  const coordinator = createAdmissionCoordinator();
  // Concatenation-based keys would collide here; a JSON tuple does not.
  const comma = coordinator.reserve([TOOL('a,b', 'c')]);
  const split = coordinator.reserve([TOOL('a', 'b,c')]);
  assert.equal(comma.state, 'reserved');
  assert.equal(split.state, 'reserved');
  assert.equal(coordinator.size, 2);

  const quote = coordinator.reserve([TOOL('a"b', 'c')]);
  assert.equal(quote.state, 'reserved');
  assert.equal(coordinator.size, 3);
});

test('a claim must carry exactly its own kind, name and scope as data', () => {
  const coordinator = createAdmissionCoordinator();
  const lease = coordinator.reserve([TOOL('exact.tool')]);
  assert.deepEqual(
    [lease.claims[0].kind, lease.claims[0].name, lease.claims[0].scope],
    ['tool', 'exact.tool', 'plugin'],
    'the lease exposes the tuple exactly as given',
  );
  lease.release();
  assert.equal(coordinator.reserve([TOOL('exact.tool')]).state, 'reserved');
});

test('name and scope must already be trimmed: outer whitespace is refused, never normalised', () => {
  // Normalising here would silently merge `'demo.tool'` and `' demo.tool '`,
  // which the caller may have meant as distinct claims. The contract refuses
  // the padded form instead.
  const padded = [
    [[{ kind: 'tool', name: '  demo.tool  ', scope: 'plugin' }], 'a padded name'],
    [[{ kind: 'tool', name: 'demo.tool', scope: ' plugin ' }], 'a padded scope'],
    [[{ kind: 'tool', name: 'demo.tool\n', scope: 'plugin' }], 'a trailing newline'],
    [[{ kind: 'tool', name: '\tdemo.tool', scope: 'plugin' }], 'a leading tab'],
    [[TOOL('ok'), { kind: 'tool', name: 'ok ', scope: 'plugin' }], 'one padded claim beside a good one'],
  ];

  for (const [claims, why] of padded) {
    const coordinator = createAdmissionCoordinator();
    assert.throws(() => coordinator.reserve(claims), (error) => {
      assert.ok(error instanceof AdmissionClaimsError, why);
      assert.equal(error.code, 'ERR_ADMISSION_CLAIMS', why);
      assert.match(error.problems.join(' '), /already be trimmed/, `${why}: the refusal says why`);
      return true;
    }, why);
    assert.equal(coordinator.size, 0, `${why}: nothing is held`);
    // The padded string was not quietly accepted under a trimmed key either.
    assert.equal(coordinator.reserve([TOOL('demo.tool')]).state, 'reserved', why);
  }

  // The empty string and a whitespace-only string are both refused, and each
  // keeps its own reason: '' is empty, '   ' is untrimmed.
  const empties = createAdmissionCoordinator();
  assert.throws(
    () => empties.reserve([{ kind: 'tool', name: '', scope: 'plugin' }]),
    (error) => {
      assert.match(error.problems.join(' '), /name must not be empty/);
      return true;
    },
  );
  assert.throws(
    () => empties.reserve([{ kind: 'tool', name: '   ', scope: 'plugin' }]),
    (error) => {
      assert.match(error.problems.join(' '), /name must already be trimmed/);
      assert.doesNotMatch(error.problems.join(' '), /must not be empty/);
      return true;
    },
  );
  assert.equal(empties.size, 0);
});

test('extra own keys, inherited fields and arrays are all refused', () => {
  const rejected = [
    [[{ kind: 'tool', name: 'x', scope: 's', extra: 1 }], 'an extra string key', /only the own keys/],
    [[Object.assign(TOOL('x'), { scope2: 'other' })], 'an extra key shaped like a member', /only the own keys/],
    [[(() => {
      const claim = TOOL('x');
      claim[Symbol('tag')] = 'smuggled';
      return claim;
    })()], 'an own symbol key', /own symbol key/],
    [[Object.create({ kind: 'tool', name: 'x', scope: 's' })], 'inherited-only fields', /must be an own property/],
    [[(() => {
      const claim = Object.create({ kind: 'tool' });
      claim.name = 'x';
      claim.scope = 's';
      return claim;
    })()], 'one field inherited, two own', /kind must be an own property/],
    [[['tool', 'x', 's']], 'an array standing in for a claim', /not an array/],
    [[Object.assign(['x'], { kind: 'tool', name: 'x', scope: 's' })], 'an array carrying tuple-shaped keys', /not an array/],
    [[{ kind: 'tool', name: new String('x'), scope: 's' }], 'a boxed string for the name', /must be a string/],
  ];

  for (const [claims, why, pattern] of rejected) {
    const coordinator = createAdmissionCoordinator();
    assert.throws(() => coordinator.reserve(claims), (error) => {
      assert.ok(error instanceof AdmissionClaimsError, why);
      assert.equal(error.code, 'ERR_ADMISSION_CLAIMS', why);
      assert.match(error.problems.join(' '), pattern, `${why}: the refusal names the problem`);
      return true;
    }, why);
    assert.equal(coordinator.size, 0, `${why}: nothing is held`);
    assert.equal(coordinator.reserve([TOOL('x')]).state, 'reserved', `${why}: the tuple is still free`);
  }
});

test('a getter is never invoked: fields must be own data, and validation stays side-effect free', () => {
  const reads = [];
  const accessorClaim = {
    get kind() {
      reads.push('kind');
      return 'tool';
    },
    get name() {
      reads.push('name');
      return 'x';
    },
    get scope() {
      reads.push('scope');
      return 's';
    },
  };

  const coordinator = createAdmissionCoordinator();
  assert.throws(() => coordinator.reserve([accessorClaim]), (error) => {
    assert.equal(error.code, 'ERR_ADMISSION_CLAIMS');
    assert.match(error.problems.join(' '), /data property, not an accessor/);
    return true;
  });
  assert.deepEqual(reads, [], 'no getter ran during validation');
  assert.equal(coordinator.size, 0, 'a refused batch mutates nothing');

  // A single accessor among two good data fields is still refused, and only
  // that one field is reported as an accessor.
  const mixed = {
    kind: 'tool',
    get name() {
      reads.push('mixed.name');
      return 'y';
    },
    scope: 's',
  };
  assert.throws(() => coordinator.reserve([mixed]), (error) => {
    assert.match(error.problems.join(' '), /name must be a data property/);
    return true;
  });
  assert.deepEqual(reads, [], 'the mixed claim’s getter never ran either');
});

test('a plain object with exactly the three own data keys is accepted, whatever its prototype', () => {
  const nullProto = Object.create(null);
  nullProto.kind = 'service';
  nullProto.name = 'null.proto';
  nullProto.scope = 'plugin';

  const plain = { kind: 'tool', name: 'plain', scope: 'plugin' };
  const coordinator = createAdmissionCoordinator();
  const lease = coordinator.reserve([nullProto, plain]);
  assert.deepEqual(lease.claims.map((claim) => claim.name), ['null.proto', 'plain']);
  assert.equal(Object.getPrototypeOf(lease.claims[0]), Object.prototype, 'stored claims are ordinary frozen objects');
  assert.ok(Object.isFrozen(lease.claims[0]));
  lease.release();
});

test('a malformed batch is refused before any state changes', () => {
  const malformed = [
    [undefined, 'no argument'],
    [null, 'null'],
    ['tool', 'a bare string'],
    [[], 'an empty batch'],
    [[null], 'a null claim'],
    [[{ name: 'x', scope: 's' }], 'a missing kind'],
    [[{ kind: 'Tool', name: 'x', scope: 's' }], 'a case-folded kind'],
    [[{ kind: 'tool ', name: 'x', scope: 's' }], 'a padded kind'],
    [[{ kind: 'resource', name: 'x', scope: 's' }], 'an unknown kind'],
    [[{ kind: 'tool', name: '', scope: 's' }], 'an empty name'],
    [[{ kind: 'tool', name: '   ', scope: 's' }], 'a whitespace-only name'],
    [[{ kind: 'tool', name: 7, scope: 's' }], 'a non-string name'],
    [[{ kind: 'tool', name: 'x' }], 'a missing scope'],
    [[{ kind: 'tool', name: 'x', scope: '' }], 'an empty scope'],
    [[{ kind: 'tool', name: 'x', scope: ' ' }], 'a whitespace-only scope'],
    [[TOOL('ok'), { kind: 'tool', name: 'bad', scope: 5 }], 'one bad claim among good ones'],
  ];

  for (const [claims, why] of malformed) {
    const coordinator = createAdmissionCoordinator();
    assert.throws(() => coordinator.reserve(claims), (error) => {
      assert.ok(error instanceof AdmissionClaimsError, why);
      assert.equal(error.code, 'ERR_ADMISSION_CLAIMS', why);
      assert.ok(Array.isArray(error.problems) && error.problems.length > 0, why);
      assert.ok(Object.isFrozen(error.problems), why);
      return true;
    }, why);
    assert.equal(coordinator.size, 0, `${why}: nothing may be held`);
    // The claims the batch would have taken are still free.
    assert.equal(coordinator.reserve([TOOL('x')]).state, 'reserved', why);
  }
});

test('a tuple repeated inside one batch is refused', () => {
  const coordinator = createAdmissionCoordinator();
  assert.throws(() => coordinator.reserve([TOOL('dup'), TOOL('dup')]), (error) => {
    assert.equal(error.code, 'ERR_ADMISSION_CLAIMS');
    assert.equal(error.problems.length, 1);
    assert.match(error.problems[0], /claims\[1\]/, 'the later position is reported');
    return true;
  });
  // Identity is the exact tuple, so the three members still have to agree.
  assert.throws(
    () => coordinator.reserve([TOOL('dup', 'a'), TOOL('dup', 'a'), TOOL('dup', 'b')]),
    code('ERR_ADMISSION_CLAIMS'),
    'a repeat is found even when other claims in the batch differ',
  );
  // Two differently-padded names are not "the same claim after trimming": the
  // padded one is refused as untrimmed, so the batch never reaches duplicate
  // detection as a pair.
  assert.throws(
    () => coordinator.reserve([TOOL('dup'), { kind: 'tool', name: ' dup ', scope: 'plugin' }]),
    (error) => {
      assert.match(error.problems.join(' '), /already be trimmed/);
      assert.doesNotMatch(error.problems.join(' '), /repeats the claim/);
      return true;
    },
  );
  assert.equal(coordinator.size, 0);
});

test('a malformed claim beside a free one reserves nothing at all', () => {
  // The batch is validated in full before the first insert, so "free" never
  // means "partially taken": a caller cannot end up holding half a batch.
  const coordinator = createAdmissionCoordinator();
  const held = coordinator.reserve([TOOL('already.held')]);
  assert.equal(coordinator.size, 1);

  for (const bad of [
    { kind: 'tool', name: ' free.name ', scope: 'plugin' },
    { kind: 'tool', name: 'free.name', scope: 'plugin', extra: true },
    { kind: 'tool', name: 'free.name' },
  ]) {
    assert.throws(
      () => coordinator.reserve([TOOL('free.name'), bad]),
      code('ERR_ADMISSION_CLAIMS'),
    );
    assert.equal(coordinator.size, 1, 'only the pre-existing claim is held');
    // The free claim in that rejected batch is genuinely still free.
    const lease = coordinator.reserve([TOOL('free.name')]);
    assert.equal(lease.state, 'reserved');
    lease.release();
    assert.equal(coordinator.size, 1);
  }

  held.release();
  assert.equal(coordinator.size, 0);
});

test('release() is idempotent and a stale release never frees a newer generation', () => {
  const coordinator = createAdmissionCoordinator();
  const claim = TOOL('generation');

  const first = coordinator.reserve([claim]);
  first.release();
  assert.equal(first.state, 'released');
  assert.equal(coordinator.size, 0);
  first.release();
  first.release();
  assert.equal(first.state, 'released', 'release is idempotent');

  const second = coordinator.reserve([claim]);
  // The stale lease speaks only for its own record: the key now belongs to the
  // second lease, so no delete happens.
  first.release();
  assert.equal(second.state, 'reserved');
  assert.equal(coordinator.size, 1);
  assert.throws(() => coordinator.reserve([claim]), code('ERR_ADMISSION_CONFLICT'));

  second.release();
  assert.equal(coordinator.size, 0);
});

test('quarantine() keeps the claims and permanently refuses ordinary release', () => {
  const coordinator = createAdmissionCoordinator();
  const claim = SERVICE('quarantined');
  const lease = coordinator.reserve([claim]);

  lease.quarantine();
  assert.equal(lease.state, 'quarantined');
  lease.quarantine();
  assert.equal(lease.state, 'quarantined', 'quarantine is idempotent');
  assert.equal(coordinator.size, 1, 'the claim is retained');

  assert.throws(() => lease.release(), (error) => {
    assert.ok(error instanceof AdmissionLeaseStateError);
    assert.equal(error.code, 'ERR_ADMISSION_LEASE_STATE');
    assert.equal(error.attempted, 'release');
    assert.equal(error.state, 'quarantined');
    return true;
  });
  assert.equal(lease.state, 'quarantined', 'a refused release changes nothing');
  assert.throws(() => coordinator.reserve([claim]), code('ERR_ADMISSION_CONFLICT'));
});

test('quarantine() on a released lease is refused and leaves the state alone', () => {
  const coordinator = createAdmissionCoordinator();
  const claim = TOOL('released-then-quarantined');

  const lease = coordinator.reserve([claim]);
  lease.release();
  assert.equal(lease.state, 'released');

  assert.throws(() => lease.quarantine(), (error) => {
    assert.ok(error instanceof AdmissionLeaseStateError);
    assert.equal(error.code, 'ERR_ADMISSION_LEASE_STATE');
    assert.equal(error.attempted, 'quarantine');
    assert.equal(error.state, 'released');
    assert.match(error.message, /refused/);
    return true;
  });

  assert.equal(lease.state, 'released', 'the refusal changes nothing');
  assert.equal(coordinator.size, 0, 'no key was kept by the refused quarantine');
  // Releasing again stays a no-op, so the refusal did not wedge the lease.
  lease.release();
  assert.equal(lease.state, 'released');
  assert.equal(coordinator.reserve([claim]).state, 'reserved');
});

test('a released lease cannot quarantine the newer generation that took its claim', () => {
  const coordinator = createAdmissionCoordinator();
  const claim = SERVICE('successor');
  const held = coordinator.reserve([TOOL('bystander')]);

  const old = coordinator.reserve([claim]);
  old.release();

  const current = coordinator.reserve([claim]);
  assert.equal(current.state, 'reserved');
  assert.equal(coordinator.size, 2, 'the successor holds its own key');

  // The stale lease is refused, and the successor keeps both its state and its
  // claim: a late quarantine may never speak for an owner it no longer is.
  assert.throws(() => old.quarantine(), (error) => {
    assert.equal(error.code, 'ERR_ADMISSION_LEASE_STATE');
    assert.equal(error.attempted, 'quarantine');
    assert.equal(error.state, 'released');
    return true;
  });
  assert.equal(old.state, 'released');
  assert.equal(current.state, 'reserved');
  assert.equal(coordinator.size, 2);
  assert.throws(() => coordinator.reserve([claim]), code('ERR_ADMISSION_CONFLICT'), 'the successor still holds the key');

  // And the successor can still close its own life cleanly.
  current.release();
  assert.equal(current.state, 'released');
  assert.equal(coordinator.size, 1);
  assert.equal(coordinator.reserve([claim]).state, 'reserved', 'the key is free again, not poisoned');
  held.release();
});

test('the coordinator exposes no force-clear', () => {
  const coordinator = createAdmissionCoordinator();
  assert.deepEqual(Object.keys(coordinator).sort(), ['admit', 'reserve', 'size']);
  assert.ok(Object.isFrozen(coordinator));
  for (const name of ['clear', 'clearAll', 'reset', 'releaseAll', 'drain', 'forceRelease']) {
    assert.equal(name in coordinator, false, `coordinator must not expose ${name}()`);
  }

  // Even with a quarantined claim in the way, there is no way to free it.
  coordinator.reserve([TOOL('stuck')]).quarantine();
  assert.equal(coordinator.size, 1);
});

test('admit() reserves before the callback, so a conflicting caller never runs it', async () => {
  const coordinator = createAdmissionCoordinator();
  const claims = [TOOL('contended'), SERVICE('contended.endpoint')];

  let openGate;
  const gate = new Promise((resolve) => { openGate = resolve; });
  let winnerCalls = 0;
  let loserCalls = 0;

  const winner = coordinator.admit(claims, async () => {
    winnerCalls += 1;
    await gate;
    return 'winner';
  });
  // The reservation is synchronous inside admit(): it is already held here.
  assert.equal(coordinator.size, 2);
  assert.equal(winnerCalls, 1, 'the winner ran');

  await assert.rejects(coordinator.admit(claims, () => { loserCalls += 1; }), code('ERR_ADMISSION_CONFLICT'));
  assert.equal(loserCalls, 0, 'the loser never runs any of its activation');
  assert.throws(() => coordinator.reserve(claims), code('ERR_ADMISSION_CONFLICT'));

  // The losing batch takes nothing: an unrelated claim is still free.
  assert.equal(coordinator.reserve([TOOL('free')]).state, 'reserved');

  openGate();
  const handle = await winner;
  assert.equal(handle.value, 'winner');
  await handle.close();
  assert.equal(coordinator.size, 1, 'only the unrelated claim remains');
});

test('admit() allows an asynchronous callback and hands back its settled value', async () => {
  const coordinator = createAdmissionCoordinator();
  const settlement = { token: Symbol('value'), nested: { deep: true } };

  const handle = await coordinator.admit([TOOL('async')], async () => {
    await Promise.resolve();
    return settlement;
  });
  assert.equal(handle.value, settlement, 'the settled value is returned as-is, not a promise');
  assert.ok(Object.isFrozen(handle), 'the handle is frozen');
  assert.deepEqual(Object.keys(handle).sort(), ['close', 'value']);
  await handle.close();
});

test('admit() passes a frozen context whose defer() is the only member', async () => {
  const coordinator = createAdmissionCoordinator();
  const seen = [];
  const handle = await coordinator.admit([TOOL('context')], (context) => {
    assert.ok(Object.isFrozen(context));
    assert.deepEqual(Object.keys(context), ['defer']);
    assert.equal(typeof context.defer, 'function');
    seen.push(context);
    return 1;
  });
  assert.equal(seen.length, 1);
  await handle.close();
});

test('close() is one shared promise, and a closed handle never re-runs its cleanups', async () => {
  const coordinator = createAdmissionCoordinator();
  let cleanups = 0;
  const handle = await coordinator.admit([TOOL('shared-close')], (context) => {
    context.defer(() => { cleanups += 1; });
    return 'ok';
  });

  const first = handle.close();
  const second = handle.close();
  assert.equal(first, second, 'every call returns the same promise object');
  await first;
  assert.equal(handle.close(), first, 'a settled close is still the same promise');
  assert.equal(cleanups, 1, 'the cleanup ran exactly once');
  assert.equal(coordinator.size, 0, 'the claim is free after a clean close');
});

test('a cleanup that reentrantly calls close() gets the same promise, without self-await', async () => {
  // The settlement promise must exist before the first cleanup runs, otherwise
  // a reentrant call would build a second chain over the same teardown. The
  // cleanup therefore only *compares* the promise and returns; awaiting it from
  // inside itself would be the documented deadlock, and this test would hang
  // rather than fail, so it deliberately does not.
  const coordinator = createAdmissionCoordinator();
  const claim = TOOL('reentrant-close');
  let inner;
  let outer;
  const order = [];

  const handle = await coordinator.admit([claim], (context) => {
    context.defer(() => {
      order.push('cleanup');
      inner = handle.close();
    });
    return 'reentrant';
  });

  outer = handle.close();
  assert.equal(inner, outer, 'the reentrant call observes the one shared promise');
  await outer;
  assert.deepEqual(order, ['cleanup'], 'the teardown ran once, not twice');
  assert.equal(handle.close(), outer, 'the identity survives settlement');
  assert.equal(coordinator.size, 0, 'a clean close still released the claim');
});

test('close() keeps the claims until every cleanup has succeeded', async () => {
  const coordinator = createAdmissionCoordinator();
  const claim = TOOL('pending-cleanup');

  let finishCleanup;
  const pending = new Promise((resolve) => { finishCleanup = resolve; });
  let cleanups = 0;

  const handle = await coordinator.admit([claim], (context) => {
    context.defer(async () => {
      cleanups += 1;
      await pending;
    });
    return 'value';
  });

  const closing = handle.close();
  // While the cleanup is in flight the claim stays reserved.
  assert.equal(cleanups, 1, 'the cleanup started');
  assert.throws(() => coordinator.reserve([claim]), code('ERR_ADMISSION_CONFLICT'));
  assert.equal(coordinator.size, 1);

  finishCleanup();
  await closing;
  assert.equal(coordinator.size, 0);
  // A new generation may now take the claim.
  const next = coordinator.reserve([claim]);
  assert.equal(next.state, 'reserved');
  next.release();
});

test('admit() with nothing to clean up still closes cleanly and frees the claim', async () => {
  const coordinator = createAdmissionCoordinator();
  const handle = await coordinator.admit([TOOL('noop')], () => 0);
  assert.equal(handle.value, 0, 'a falsy activation value is preserved');
  await handle.close();
  assert.equal(coordinator.size, 0);
  assert.equal(coordinator.reserve([TOOL('noop')]).state, 'reserved');
});

test('a failed close quarantines the claim and rejects the scope aggregate unchanged', async () => {
  const coordinator = createAdmissionCoordinator();
  const claim = TOOL('failing-cleanup');
  const unwindError = new Error('unwind failed');

  const handle = await coordinator.admit([claim], (context) => {
    context.defer(() => { throw unwindError; });
    return 'kept';
  });

  const closing = handle.close();
  assert.equal(handle.close(), closing);
  await assert.rejects(closing, (error) => {
    assert.equal(error.code, 'ERR_CLEANUP_SCOPE_FAILED');
    assert.equal(error.errors.length, 1);
    assert.equal(error.errors[0], unwindError, 'the thrown value is not copied or stringified');
    return true;
  });

  assert.equal(coordinator.size, 1, 'the claim is retained');
  assert.throws(() => coordinator.reserve([claim]), code('ERR_ADMISSION_CONFLICT'));
  await assert.rejects(handle.close(), code('ERR_CLEANUP_SCOPE_FAILED'), 'the same rejection reaches every caller');
});

test('a throwing activation quarantines the claim even when the rollback was clean', async () => {
  const coordinator = createAdmissionCoordinator();
  const claims = [TOOL('activation-throw'), SERVICE('activation-throw.endpoint')];
  const activationError = new Error('activation failed');
  let cleanups = 0;

  await assert.rejects(
    coordinator.admit(claims, (context) => {
      context.defer(() => { cleanups += 1; });
      throw activationError;
    }),
    (error) => {
      assert.equal(error, activationError, 'the original value is rethrown by identity');
      return true;
    },
  );

  assert.equal(cleanups, 1, 'the deferred cleanup still ran');
  assert.equal(coordinator.size, 2, 'the claims stay held: an undeferred effect cannot be ruled out');
  assert.throws(() => coordinator.reserve(claims), code('ERR_ADMISSION_CONFLICT'));
});

test('a throwing activation with a failing rollback throws the combined aggregate', async () => {
  const coordinator = createAdmissionCoordinator();
  const claim = TOOL('double-failure');
  const activationError = new Error('activation failed');
  const cleanupError = new Error('cleanup failed');

  await assert.rejects(
    coordinator.admit([claim], (context) => {
      context.defer(() => { throw cleanupError; });
      throw activationError;
    }),
    (error) => {
      assert.ok(error instanceof AdmissionActivationRollbackError);
      assert.ok(error instanceof AggregateError);
      assert.equal(error.code, 'ERR_ADMISSION_ROLLBACK');
      assert.equal(error.errors.length, 2);
      assert.equal(error.errors[0], activationError, 'errors[0] is the activation value');
      assert.equal(error.errors[1], cleanupError, 'the rest are the cleanup failures');
      assert.equal(error.primary, activationError);
      assert.deepEqual([...error.cleanupErrors], [cleanupError]);
      return true;
    },
  );

  assert.equal(coordinator.size, 1);
  assert.throws(() => coordinator.reserve([claim]), code('ERR_ADMISSION_CONFLICT'));
});

test('error values are carried, never stringified', async () => {
  const coordinator = createAdmissionCoordinator();

  // A thrown symbol: nothing may try to read a message off it.
  const symbol = Symbol('thrown');
  await assert.rejects(coordinator.admit([TOOL('symbol')], () => { throw symbol; }), (error) => {
    assert.equal(error, symbol);
    return true;
  });

  // A hostile object whose `toString` throws: it must still come through intact.
  const hostile = {
    name: 'hostile',
    toString() { throw new Error('do not stringify me'); },
  };
  await assert.rejects(coordinator.admit([TOOL('hostile')], () => { throw hostile; }), (error) => {
    assert.equal(error, hostile);
    return true;
  });

  // The same identity survives the cleanup path of a failed close.
  const cleanupValue = { reason: 'cleanup', toString() { throw new Error('nope'); } };
  const handle = await coordinator.admit([TOOL('hostile-cleanup')], (context) => {
    context.defer(() => { throw cleanupValue; });
    return 1;
  });
  await assert.rejects(handle.close(), (error) => {
    assert.equal(error.errors[0], cleanupValue);
    return true;
  });
});

test('defer() refuses a non-function, and that refusal quarantines the claim', async () => {
  const coordinator = createAdmissionCoordinator();
  const claim = TOOL('bad-disposer');

  await assert.rejects(coordinator.admit([claim], (context) => {
    context.defer('not a function');
  }), (error) => {
    assert.ok(error instanceof TypeError);
    return true;
  });

  assert.equal(coordinator.size, 1, 'the activation threw, so the claim is quarantined');
  assert.throws(() => coordinator.reserve([claim]), code('ERR_ADMISSION_CONFLICT'));
});

test('defer() after the close has started is refused, not dropped', async () => {
  // Variant A: the cleanup catches the refusal itself, so the close still
  // succeeds and the claims are released.
  const tolerant = createAdmissionCoordinator();
  let lateError;
  const tolerantHandle = await tolerant.admit([TOOL('late-tolerated')], (context) => {
    context.defer(() => {
      try {
        context.defer(() => {});
      } catch (error) {
        lateError = error;
      }
    });
    return 1;
  });
  await tolerantHandle.close();
  assert.equal(lateError.code, 'ERR_CLEANUP_SCOPE_CLOSED');
  assert.equal(tolerant.size, 0, 'a tolerated late defer leaves the close clean');

  // Variant B: the refusal escapes the cleanup, so the close fails and the
  // claims are quarantined.
  const strict = createAdmissionCoordinator();
  const strictHandle = await strict.admit([TOOL('late-thrown')], (context) => {
    context.defer(() => {
      context.defer(() => {});
    });
    return 1;
  });
  await assert.rejects(strictHandle.close(), (error) => {
    assert.equal(error.code, 'ERR_CLEANUP_SCOPE_FAILED');
    assert.equal(error.errors[0].code, 'ERR_CLEANUP_SCOPE_CLOSED');
    return true;
  });
  assert.throws(() => strict.reserve([TOOL('late-thrown')]), code('ERR_ADMISSION_CONFLICT'));
});

test('a non-function activate is refused before any claim is taken', async () => {
  const coordinator = createAdmissionCoordinator();
  const claims = [TOOL('no-callback')];

  await assert.rejects(coordinator.admit(claims, 'not a function'), (error) => {
    assert.ok(error instanceof TypeError);
    return true;
  });
  assert.equal(coordinator.size, 0, 'nothing was reserved');
  const lease = coordinator.reserve(claims);
  assert.equal(lease.state, 'reserved');
  lease.release();
});

test('a malformed batch reaches admit() as a claims error with nothing held', async () => {
  const coordinator = createAdmissionCoordinator();
  let calls = 0;
  await assert.rejects(coordinator.admit([{ kind: 'nope', name: 'x', scope: 's' }], () => { calls += 1; }), (error) => {
    assert.equal(error.code, 'ERR_ADMISSION_CLAIMS');
    assert.ok(Object.isFrozen(error.problems));
    return true;
  });
  assert.equal(calls, 0, 'the callback never ran');
  assert.equal(coordinator.size, 0);
});

test('claims are snapshotted: mutating the caller array afterwards changes nothing', async () => {
  const coordinator = createAdmissionCoordinator();
  const claim = TOOL('snapshot');
  const batch = [claim];
  const handle = await coordinator.admit(batch, () => 'v');
  batch.push(TOOL('smuggled'));
  batch[0] = TOOL('replaced');
  await handle.close();
  // The handled claim is the one that was reserved, and the smuggled one was
  // never taken.
  assert.equal(coordinator.size, 0);
  assert.equal(coordinator.reserve([TOOL('smuggled')]).state, 'reserved');
});
