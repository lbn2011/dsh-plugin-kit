/**
 * Managed-registration tests.
 *
 * The host here is a fake: three closures that log what they were asked to do
 * and hand back a disposer, which is what the official host ports
 * (`ctx.tools.register`, a subscription call, an endpoint publish) do. Nothing
 * in this file imports a host, a vendor adapter or another artifact — the
 * registration path under test is the kit's own, and no case here claims the
 * vendored adapter behaves differently.
 *
 * Two cases cover a native disposer that is callable *and* thenable at once
 * (the shape Cordis' `ctx.effect()` returns): a live loader run refused such a
 * disposer as an async acquisition, so the accepted shape and the still-refused
 * shapes are pinned separately here.
 *
 * Run: node --test "tests/*.test.js"
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ManagedRegistrationActivationError,
  ManagedRegistrationAsyncPortError,
  ManagedRegistrationDisposerError,
  ManagedRegistrationPortsError,
  ManagedRegistrationRollbackError,
  TEARDOWN_ORDER,
  registerManagedResource,
} from '../src/managed-registration.js';

const tick = () => new Promise((resolve) => setImmediate(resolve));

/** Resource name in the log → cleanup label the module defers it under. */
const CLEANUP_LABEL = Object.freeze({
  tool: 'tool-unregister',
  subscription: 'unsubscribe',
  endpoint: 'endpoint-retract',
  resource: 'resource-deactivate',
});

const RELEASE_ORDER = ['release:resource', 'release:endpoint', 'release:subscription', 'release:tool'];

/**
 * A host whose ports log every call. `overrides` may make a release throw or
 * go async; acquisitions always succeed unless a case builds its own bag.
 */
function makeHost(overrides = {}) {
  const log = [];
  const acquisition = (name) => () => {
    log.push(`acquire:${name}`);
    return () => {
      log.push(`release:${name}`);
      return overrides[name]?.();
    };
  };
  return {
    log,
    ports: {
      register: acquisition('tool'),
      subscribe: acquisition('subscription'),
      publish: acquisition('endpoint'),
      deactivate: () => {
        log.push('release:resource');
        return overrides.resource?.();
      },
    },
  };
}

/** Capture a synchronous throw, whatever its value. */
function catchThrow(run) {
  try {
    run();
  } catch (error) {
    return error;
  }
  assert.fail('expected the call to throw');
}

/**
 * A native-disposer stand-in with the exact shape Cordis' `ctx.effect()` hands
 * back: a callable that also carries its own `then` (see the vendored
 * `vendor/cordis/lib/index.js`, `effect()` — the returned `wrapper` is assigned
 * `wrapper.then = async (...) => ...` before it is returned). Both reading the
 * `then` getter and calling `then` are recorded, so a case can prove that neither
 * happened.
 */
function nativeDisposer(name, log) {
  const disposer = () => { log.push(`release:${name}`); };
  Object.defineProperty(disposer, 'then', {
    configurable: true,
    get() {
      log.push(`read-then:${name}`);
      return () => { log.push(`call-then:${name}`); return Promise.resolve(); };
    },
  });
  return disposer;
}

test('acquires through the caller ports and unwinds them in reverse order', async () => {
  const host = makeHost();
  const handle = registerManagedResource(host.ports, { label: 'weather' });

  assert.deepEqual(host.log, ['acquire:tool', 'acquire:subscription', 'acquire:endpoint'], 'acquisition order is fixed');
  assert.equal(handle.label, 'weather');
  assert.equal(handle.active, true);

  const first = handle.close();
  assert.equal(handle.close(), first, 'every close() call returns the same promise');
  assert.equal(handle.active, false, 'close() is visible to the caller immediately');

  await first;

  assert.deepEqual(host.log.slice(3), RELEASE_ORDER, 'teardown is LIFO and deactivates first');
  assert.equal(handle.close(), first, 'a settled close hands back the same promise');
  assert.deepEqual(host.log.slice(3), RELEASE_ORDER, 'nothing ran twice');

  const labelsInReleaseOrder = host.log
    .filter((entry) => entry.startsWith('release:'))
    .map((entry) => CLEANUP_LABEL[entry.slice('release:'.length)]);
  assert.deepEqual(labelsInReleaseOrder, [...TEARDOWN_ORDER], 'documented teardown order matches the real one');
});

test('a throwing unsubscribe still retracts the endpoint and unregisters the tool', async () => {
  // The point of one deferred callback per acquisition: unsubscribe and tool
  // unregister are not the same callback, so one failure cannot swallow both.
  const boom = new Error('unsubscribe failed');
  const host = makeHost({ subscription: () => { throw boom; } });
  const handle = registerManagedResource(host.ports);

  const first = handle.close();
  const reason = await first.then(() => null, (error) => error);

  assert.ok(reason instanceof AggregateError);
  assert.equal(reason.code, 'ERR_CLEANUP_SCOPE_FAILED');
  assert.deepEqual(reason.errors, [boom], 'the unsubscribe failure is the only failure');
  assert.deepEqual(host.log.slice(3), RELEASE_ORDER, 'deactivate, retract and unregister all still ran');
  assert.equal(host.log.filter((entry) => entry === 'release:tool').length, 1, 'the tool is unregistered exactly once');

  assert.equal(handle.close(), first, 'later close() calls get the same rejected promise');
  assert.equal(await handle.close().then(() => null, (error) => error), reason, 'the same rejection value');
});

test('a registration with only the required port still unmounts', async () => {
  const host = makeHost();
  const handle = registerManagedResource({ register: host.ports.register, deactivate: host.ports.deactivate });

  assert.deepEqual(host.log, ['acquire:tool']);
  await handle.close();
  assert.deepEqual(host.log, ['acquire:tool', 'release:resource', 'release:tool']);
});

test('ports are called with no arguments and are not mutated', async () => {
  const seen = [];
  const ports = {
    register(...args) { seen.push(args.length); return () => {}; },
    subscribe(...args) { seen.push(args.length); return () => {}; },
    publish(...args) { seen.push(args.length); return () => {}; },
    deactivate(...args) { seen.push(args.length); return undefined; },
  };
  const keysBefore = Object.keys(ports);

  const handle = registerManagedResource(ports);

  assert.deepEqual(seen, [0, 0, 0], 'acquisition ports take no arguments; deactivate is not an acquisition');
  assert.deepEqual(Object.keys(ports), keysBefore, 'the caller bag is left exactly as it was');
  assert.equal(Object.isFrozen(ports), false, 'the kit does not freeze the caller object');

  await handle.close();
  assert.deepEqual(seen, [0, 0, 0, 0], 'deactivate is called once, at teardown, with no arguments');
});

test('an acquisition failure rolls back what was acquired and keeps the original thrown value', async () => {
  const primary = new Error('subscribe blew up');
  const host = makeHost();
  const failure = catchThrow(() => registerManagedResource({
    register: host.ports.register,
    subscribe: () => { host.log.push('acquire:subscription'); throw primary; },
    publish: host.ports.publish,
  }));

  assert.ok(failure instanceof ManagedRegistrationActivationError);
  assert.equal(failure.code, 'ERR_MANAGED_REGISTRATION_ACTIVATION');
  assert.equal(failure.port, 'subscribe');
  assert.equal(failure.primary, primary, 'the original thrown value is preserved, not copied');
  assert.match(failure.message, /"subscribe" threw during activation/);

  assert.equal(typeof failure.rollback.then, 'function', 'the rollback settlement is reachable from the throw');
  await failure.rollback;
  assert.deepEqual(host.log, ['acquire:tool', 'acquire:subscription', 'release:tool'], 'the tool was unregistered');
});

test('a failing rollback reports the primary failure and the cleanup failure together', async () => {
  const cleanupError = new Error('unregister failed');
  const primary = new TypeError('subscribe threw');
  const host = makeHost({ tool: () => { throw cleanupError; } });
  const failure = catchThrow(() => registerManagedResource({
    register: host.ports.register,
    subscribe: () => { throw primary; },
  }));

  const rollbackFailure = await failure.rollback.then(() => null, (error) => error);

  assert.ok(rollbackFailure instanceof ManagedRegistrationRollbackError);
  assert.equal(rollbackFailure.code, 'ERR_MANAGED_REGISTRATION_ROLLBACK');
  assert.equal(rollbackFailure.port, 'subscribe');
  assert.equal(rollbackFailure.primary, primary);
  assert.deepEqual(rollbackFailure.cleanupErrors, [cleanupError]);
  assert.deepEqual(rollbackFailure.errors, [primary, cleanupError], 'primary first, cleanup failures after');
  assert.ok(rollbackFailure.cause instanceof AggregateError, 'the scope aggregate is kept for diagnostics');
  assert.match(rollbackFailure.message, /1 cleanup callback\(s\) threw/);
});

// A promise is not callable, so the callable-first rule does not soften this:
// a pending acquisition is still refused, and the acquisitions already made are
// still rolled back.
test('a port that returns a promise is refused and the earlier acquisition is rolled back', async () => {
  const host = makeHost();
  const pending = Promise.resolve(() => {});
  const failure = catchThrow(() => registerManagedResource({
    register: host.ports.register,
    subscribe: () => pending,
  }));

  assert.ok(failure instanceof ManagedRegistrationAsyncPortError);
  assert.equal(failure.code, 'ERR_MANAGED_REGISTRATION_ASYNC_PORT');
  assert.equal(failure.port, 'subscribe');
  assert.equal(failure.primary, pending, 'the refused return value is carried through untouched');
  assert.match(failure.message, /activation in this module is synchronous/);

  await failure.rollback;
  assert.deepEqual(host.log, ['acquire:tool', 'release:tool']);
});

test('a callable disposer that is also thenable is accepted, and its then is neither read nor called', async () => {
  // The live regression: the host's native disposer is a function that also
  // carries its own `then`. Treating "has a readable then" as "async
  // acquisition" refused a perfectly good disposer; reading that `then` would
  // also touch the host's async disposal path, and calling it would dispose the
  // resource twice.
  const log = [];
  const ports = {
    register: () => { log.push('acquire:tool'); return nativeDisposer('tool', log); },
    subscribe: () => { log.push('acquire:subscription'); return nativeDisposer('subscription', log); },
    publish: () => { log.push('acquire:endpoint'); return nativeDisposer('endpoint', log); },
  };

  const handle = registerManagedResource(ports, { label: 'native-disposer' });

  assert.deepEqual(log, ['acquire:tool', 'acquire:subscription', 'acquire:endpoint'],
    'all three acquisitions were accepted, and no then getter was read');
  assert.equal(handle.active, true);

  await handle.close();

  assert.deepEqual(log.slice(3), ['release:endpoint', 'release:subscription', 'release:tool'],
    'each native disposer ran exactly once, LIFO');
  assert.deepEqual(log.filter((entry) => entry.startsWith('read-then')), [], 'no then getter was ever read');
  assert.deepEqual(log.filter((entry) => entry.startsWith('call-then')), [], 'no then was ever called');
  assert.equal(log.includes('release:tool'), true, 'the tool disposer itself ran');
});

test('the native disposer is deferred by exact identity: no wrapper, no rename', async () => {
  // The scope must hold the host's own function. A wrapper would be invisible
  // in call counts, so this pins the observable side of identity: the function
  // object keeps its own name and its own property set across the whole
  // acquire/teardown cycle, and the same object is what gets invoked.
  const log = [];
  const disposer = nativeDisposer('tool', log);
  const namesBefore = Object.getOwnPropertyNames(disposer);
  const nameBefore = disposer.name;

  const handle = registerManagedResource({ register: () => disposer });
  await handle.close();

  assert.equal(disposer.name, nameBefore, 'the disposer was not renamed');
  assert.deepEqual(Object.getOwnPropertyNames(disposer), namesBefore, 'the disposer was not decorated or proxied');
  assert.deepEqual(log, ['release:tool'], 'the same object was called once at teardown');
});

test('a non-callable thenable is still refused, and the callable disposers acquired before it roll back', async () => {
  const log = [];
  const thenable = {
    then(onFulfilled) {
      log.push('thenable:then');
      onFulfilled?.();
    },
  };

  const failure = catchThrow(() => registerManagedResource({
    register: () => nativeDisposer('tool', log),
    subscribe: () => nativeDisposer('subscription', log),
    publish: () => thenable,
  }));

  assert.ok(failure instanceof ManagedRegistrationAsyncPortError);
  assert.equal(failure.code, 'ERR_MANAGED_REGISTRATION_ASYNC_PORT');
  assert.equal(failure.port, 'publish');
  assert.equal(failure.primary, thenable, 'the offending thenable is carried through untouched');
  assert.match(failure.message, /a thenable that cannot be called is an asynchronous acquisition/);
  assert.deepEqual(log.filter((entry) => entry.startsWith('read-then')), [],
    'the refused return was not made callable, and no earlier disposer had its then read');

  await failure.rollback;
  assert.deepEqual(log, ['release:subscription', 'release:tool'],
    'the two callable acquisitions rolled back LIFO; the refused thenable was never subscribed to');
});

test('a port that returns something other than a disposer is refused', async () => {
  const host = makeHost();
  const failure = catchThrow(() => registerManagedResource({
    register: host.ports.register,
    subscribe: host.ports.subscribe,
    publish: () => { host.log.push('acquire:endpoint'); return 'unregister-later'; },
  }));

  assert.ok(failure instanceof ManagedRegistrationDisposerError);
  assert.equal(failure.code, 'ERR_MANAGED_REGISTRATION_DISPOSER');
  assert.equal(failure.port, 'publish');
  assert.match(failure.message, /string "unregister-later"/);
  assert.match(failure.message, /will not invent one/);

  await failure.rollback;
  assert.deepEqual(host.log, [
    'acquire:tool', 'acquire:subscription', 'acquire:endpoint',
    'release:subscription', 'release:tool',
  ]);
});

test('a port bag without register is refused before any port runs', () => {
  const calls = [];
  const failure = catchThrow(() => registerManagedResource({
    subscribe() { calls.push('subscribe'); return () => {}; },
  }));

  assert.ok(failure instanceof ManagedRegistrationPortsError);
  assert.equal(failure.code, 'ERR_MANAGED_REGISTRATION_PORTS');
  assert.match(failure.message, /`register` is required/);
  assert.deepEqual(calls, [], 'no port was called');
  assert.equal(failure.rollback, undefined, 'nothing was acquired, so there is no rollback to await');

  assert.throws(() => registerManagedResource(null), ManagedRegistrationPortsError);
  assert.throws(
    () => registerManagedResource({ register: () => () => {}, subscribe: 'nope' }),
    (error) => error instanceof ManagedRegistrationPortsError && /`subscribe` must be a function/.test(error.message),
  );
  assert.throws(
    () => registerManagedResource({ register: () => () => {}, deactivate: 42 }),
    (error) => error instanceof ManagedRegistrationPortsError && /`deactivate` must be a function/.test(error.message),
  );
});

test('arbitrary thrown values are preserved and described without coercion', async () => {
  const unprintable = { get [Symbol.toStringTag]() { throw new Error('tag getter failed'); } };
  const cases = [
    ['plain string', /string "plain string"/],
    [Symbol('boom'), /symbol/],
    [unprintable, /unprintable thrown value/],
  ];

  for (const [thrown, pattern] of cases) {
    const failure = catchThrow(() => registerManagedResource({
      register: () => () => {},
      subscribe: () => { throw thrown; },
    }));
    assert.ok(failure instanceof ManagedRegistrationActivationError);
    assert.equal(failure.primary, thrown, 'the thrown value is carried through untouched');
    assert.match(failure.message, pattern);
    await failure.rollback;
  }
});

test('deactivate runs first and is awaited, and is never deferred when an acquisition failed', async () => {
  const host = makeHost({ resource: async () => { await tick(); host.log.push('deactivate:settled'); } });
  const handle = registerManagedResource(host.ports);
  await handle.close();

  assert.deepEqual(host.log.slice(3), [
    'release:resource', 'deactivate:settled',
    'release:endpoint', 'release:subscription', 'release:tool',
  ], 'the async deactivate settled before the endpoint was retracted');

  const failing = makeHost();
  const failure = catchThrow(() => registerManagedResource({
    register: failing.ports.register,
    subscribe: failing.ports.subscribe,
    publish: () => { throw new Error('publish failed'); },
    deactivate: failing.ports.deactivate,
  }));

  await failure.rollback;
  assert.equal(failing.log.includes('release:resource'), false, 'the resource was never fully handed over, so it is not deactivated');
  assert.deepEqual(failing.log, ['acquire:tool', 'acquire:subscription', 'release:subscription', 'release:tool']);
});

test('two registrations share no state', async () => {
  const first = makeHost();
  const second = makeHost();
  const firstHandle = registerManagedResource(first.ports);
  const secondHandle = registerManagedResource(second.ports);

  await firstHandle.close();

  assert.equal(secondHandle.active, true, 'closing one handle does not touch the other');
  assert.deepEqual(second.log, ['acquire:tool', 'acquire:subscription', 'acquire:endpoint']);

  await secondHandle.close();
  assert.deepEqual(second.log.slice(3), RELEASE_ORDER);
  assert.deepEqual(first.log.slice(3), RELEASE_ORDER, 'each host saw exactly its own teardown');
});
