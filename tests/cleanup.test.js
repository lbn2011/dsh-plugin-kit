/**
 * Cleanup-scope tests.
 *
 * Each case names the legacy behaviour it replaces. The legacy behaviour is
 * *described*, not imported: `vendor/meta-protocols/dsh-std/...` and
 * `experiments/legacy-gap-audit/` are other artifacts with their own runners,
 * and importing them here would give this package a sibling runtime dependency.
 * The executable side-by-side comparison belongs to the experiment that owns
 * the legacy fixture.
 *
 * Run: node --test "tests/*.test.js"
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import * as cleanup from '../src/cleanup.js';
import { CleanupScopeClosedError, createCleanupScope } from '../src/cleanup.js';

const tick = () => new Promise((resolve) => setImmediate(resolve));

test('disposers run in reverse registration order, one at a time', async () => {
  // Legacy: `for (const dispose of disposers.reverse()) dispose()` — LIFO, but
  // synchronous only, so asynchronous disposers are not sequenced at all.
  const scope = createCleanupScope();
  const log = [];
  let running = 0;
  const record = (name) => async () => {
    running += 1;
    assert.equal(running, 1, 'two disposers must never be in flight at once');
    await tick();
    log.push(name);
    running -= 1;
  };

  scope.defer(record('a'), { label: 'a' });
  scope.defer(record('b'), { label: 'b' });
  scope.defer(record('c'), { label: 'c' });
  assert.equal(scope.size, 3);
  assert.equal(scope.closed, false);

  await scope.close();

  assert.deepEqual(log, ['c', 'b', 'a'], 'registration order is unwound LIFO');
  assert.equal(scope.size, 0);
  assert.equal(scope.closed, true);
});

test('a throwing disposer does not skip the remaining disposers', async () => {
  // Legacy H2: one throwing disposer aborts the loop and every resource behind
  // the remaining disposers stays live.
  const scope = createCleanupScope();
  const ran = [];
  scope.defer(() => { ran.push('first'); });
  scope.defer(() => { throw new Error('middle failed'); });
  scope.defer(() => { ran.push('last'); });

  await assert.rejects(scope.close(), AggregateError);

  assert.deepEqual(ran, ['last', 'first'], 'both neighbours still ran');
  assert.equal(scope.size, 0, 'no registration is left behind');
});

test('multiple failures are aggregated in reverse registration order', async () => {
  // Legacy: only the first error propagates; the others are dropped.
  const scope = createCleanupScope({ label: 'plugin-x' });
  const firstFailure = new Error('c exploded');
  const secondFailure = new TypeError('a exploded');
  const ran = [];

  scope.defer(() => { ran.push('a'); throw secondFailure; }, { label: 'a-resource' });
  scope.defer(() => { ran.push('b'); });
  scope.defer(async () => { ran.push('c'); throw firstFailure; }, { label: 'c-resource' });

  const error = await scope.close().then(() => null, (reason) => reason);

  assert.ok(error instanceof AggregateError);
  assert.equal(error.code, 'ERR_CLEANUP_SCOPE_FAILED');
  assert.deepEqual(error.errors, [firstFailure, secondFailure], 'errors follow the reversed snapshot');
  assert.equal(error.errors[1], secondFailure, 'the original thrown value is preserved, not a copy');
  assert.match(error.message, /plugin-x/);
  assert.match(error.message, /2 of 3 disposer\(s\) threw/);
  // The message is built from counts only: labels and thrown text never appear.
  assert.doesNotMatch(error.message, /c exploded/);
  assert.doesNotMatch(error.message, /a exploded/);
  assert.doesNotMatch(error.message, /c-resource|a-resource/);
  assert.deepEqual(ran, ['c', 'b', 'a']);
});

test('concurrent close calls share one settlement and run each disposer once', async () => {
  // Legacy: `active` makes the second call return a fresh, already-resolved
  // promise, so "the teardown finished" and "somebody asked twice" look alike.
  const scope = createCleanupScope();
  let calls = 0;
  scope.defer(async () => { calls += 1; await tick(); });
  scope.defer(() => { calls += 1; });

  const first = scope.close();
  const second = scope.close();
  assert.equal(first, second, 'every caller receives the same promise');

  await Promise.all([first, second]);
  assert.equal(calls, 2, 'two registrations, two disposer invocations total');
  assert.equal(scope.close(), first, 'a settled close still hands back the same promise');
});

test('a failed close rejects every caller with the same aggregate and stays failed on retry', async () => {
  // Legacy: the first close rejects, the second resolves as a silent no-op even
  // though nothing was cleaned up (H2 retry).
  const scope = createCleanupScope();
  let calls = 0;
  const boom = new Error('boom');
  scope.defer(() => { calls += 1; throw boom; });

  const first = scope.close();
  const second = scope.close();
  assert.equal(first, second);

  const settled = await Promise.allSettled([first, second]);
  assert.equal(settled[0].status, 'rejected');
  assert.equal(settled[1].status, 'rejected', 'the second caller learns about the failure');
  assert.equal(settled[1].reason, settled[0].reason, 'identical rejection value');
  assert.equal(settled[0].reason.errors[0], boom);
  assert.equal(calls, 1, 'a throwing disposer is spent, never retried');

  const retry = await scope.close().then(() => null, (reason) => reason);
  assert.equal(retry, settled[0].reason, 'a retry cannot report a teardown that did not happen');
  assert.equal(calls, 1);
});

test('registrations after close are refused, before and after settlement', async () => {
  const scope = createCleanupScope({ label: 'plugin-x' });
  const closing = scope.close();
  const refuse = (error) => {
    assert.ok(error instanceof CleanupScopeClosedError, 'a typed error, not a bare Error');
    assert.equal(error.code, 'ERR_CLEANUP_SCOPE_CLOSED');
    assert.equal(error.name, 'CleanupScopeClosedError');
    assert.match(error.message, /plugin-x/);
    assert.match(error.message, /closed/);
    return true;
  };

  assert.throws(() => scope.defer(() => {}), refuse);
  await closing;
  assert.throws(() => scope.defer(() => {}), refuse);

  const unlabelled = createCleanupScope();
  unlabelled.close();
  assert.throws(() => unlabelled.defer(() => {}), (error) => error instanceof CleanupScopeClosedError
    && /^cleanup scope is closed/.test(error.message));
});

test('defer refuses a non-function disposer', () => {
  const scope = createCleanupScope();
  for (const value of [null, undefined, {}, 'dispose', 42]) {
    assert.throws(() => scope.defer(value), /disposer must be a function/);
  }
  assert.equal(scope.size, 0, 'a refused registration is not recorded');
});

test('a disposer may call close() reentrantly without restarting the teardown', async () => {
  const scope = createCleanupScope();
  const log = [];
  let reentrant;

  // Registered first, so it runs last: by then the close is already in flight.
  scope.defer(() => {
    log.push('inner');
    reentrant = scope.close();
  });
  scope.defer(() => { log.push('outer'); });

  const settlement = scope.close();
  await settlement;

  assert.equal(reentrant, settlement, 'the reentrant call observes the in-flight promise');
  assert.deepEqual(log, ['outer', 'inner'], 'the reentrant close did not re-run anything');
});

test('release runs its own disposer exactly once and close never re-invokes it', async () => {
  const scope = createCleanupScope();
  let calls = 0;
  const handle = scope.defer(() => { calls += 1; }, { label: 'tool' });

  assert.equal(handle.done, false);
  const first = handle.release();
  await first;
  assert.equal(calls, 1);
  assert.equal(handle.done, true);
  assert.equal(scope.size, 0, 'a released registration is no longer pending');

  const second = handle.release();
  assert.equal(second, first, 'a later release hands back the same settlement');
  await second;

  const closing = scope.close();
  await closing;
  assert.equal(calls, 1, 'the close re-awaits the settled run but does not re-run it');
  assert.equal(scope.close(), closing, 'and a settled close keeps its one promise');
  assert.equal(calls, 1);
});

test('concurrent release calls share one run instead of reporting early', async () => {
  const scope = createCleanupScope();
  let calls = 0;
  let finish;
  const handle = scope.defer(() => {
    calls += 1;
    return new Promise((resolve) => { finish = resolve; });
  });

  const first = handle.release();
  const second = handle.release();
  assert.equal(first, second, 'both callers await the same run');

  let settled = false;
  second.then(() => { settled = true; });
  await tick();
  assert.equal(calls, 1, 'the disposer is invoked once');
  assert.equal(settled, false, 'the second caller does not resolve while the disposer is still running');

  finish();
  await Promise.all([first, second]);
  await tick();
  assert.equal(settled, true);
});

test('a stale handle cannot release a newer registration with the same label', async () => {
  // Ownership is the handle, not the label: there is no key table to look the
  // name up in, and a retained entry keeps its own memoized run, so a spent
  // handle has nothing newer to reach.
  const scope = createCleanupScope();
  const calls = [];

  const first = scope.defer(() => { calls.push('first'); }, { label: 'tool' });
  await first.release();
  assert.deepEqual(calls, ['first']);

  const second = scope.defer(() => { calls.push('second'); }, { label: 'tool' });
  assert.equal(scope.size, 1, 'the newer registration is live');

  await first.release();

  assert.deepEqual(calls, ['first'], 'the stale handle must not run the newer disposer');
  assert.equal(scope.size, 1, 'and must not take it out of the pending set either');

  await scope.close();
  assert.deepEqual(calls, ['first', 'second'], 'the newer registration still runs at close');
});

test('a disposer that releases another entry keeps exactly-once semantics', async () => {
  const scope = createCleanupScope();
  const calls = [];
  const early = scope.defer(() => { calls.push('early'); });

  scope.defer(() => {
    calls.push('late');
    // Not awaited: `release()` starts the disposer synchronously. The close
    // re-awaits that run, but it never invokes the disposer again.
    early.release();
  });

  await scope.close();
  assert.deepEqual(calls, ['late', 'early'], 'the released entry ran on demand; the close awaited its run, not a new one');

  await early.release();
  assert.deepEqual(calls, ['late', 'early']);
});

test('a throwing released disposer rejects its own caller and is included in the close', async () => {
  // A release that already failed must not disappear: the close observes every
  // retained registration, so the caller who never saw the release still learns
  // that the teardown did not work.
  const scope = createCleanupScope({ label: 'plugin-z' });
  const boom = new Error('tool unregister failed');
  const handle = scope.defer(() => { throw boom; }, { label: 'tool' });

  await assert.rejects(handle.release(), (error) => error === boom, 'the releaser gets the raw failure');

  const error = await scope.close().then(() => null, (reason) => reason);

  assert.ok(error instanceof AggregateError, 'the close reports the failure it did not cause itself');
  assert.equal(error.code, 'ERR_CLEANUP_SCOPE_FAILED');
  assert.ok(Object.is(error.errors[0], boom), 'the original thrown value survives the re-await');
  assert.equal(error.errors.length, 1);
  assert.equal(error.message, 'cleanup scope "plugin-z" close failed: 1 of 1 disposer(s) threw',
    'the message names the JSON.stringify-quoted scope label plus the threw/attempted counts');
  assert.doesNotMatch(error.message, /tool unregister failed/, 'no thrown text is coerced into the message');
  assert.equal(scope.size, 0);
});

test('scopes are independent and share no module state', async () => {
  const a = createCleanupScope();
  const b = createCleanupScope();
  let closedA = 0;
  let closedB = 0;
  a.defer(() => { closedA += 1; });
  b.defer(() => { closedB += 1; });
  assert.equal(a.label, undefined);
  assert.equal(b.label, undefined);

  await a.close();
  assert.equal(closedA, 1);
  assert.equal(closedB, 0, 'closing one scope does not touch another');
  assert.equal(b.closed, false);
  assert.equal(b.size, 1);

  await b.close();
  assert.equal(closedB, 1);
});

test('close waits for a release that is still in flight and reports its later failure', async () => {
  // Gate: runningrelease/closewait. The close must not settle while a disposer
  // started by release() is still running, and its failure must arrive through
  // the close even though release() already started the run.
  const scope = createCleanupScope();
  const boom = new Error('slow release failed');
  let fail;
  let calls = 0;
  const handle = scope.defer(() => {
    calls += 1;
    return new Promise((resolve, reject) => { fail = reject; });
  }, { label: 'slow' });

  const released = handle.release();
  released.catch(() => {});
  const closing = scope.close();

  let settled = false;
  closing.then(() => { settled = true; }, () => { settled = true; });
  await tick();
  assert.equal(calls, 1, 'close did not start a second run');
  assert.equal(settled, false, 'close waits for the in-flight release');

  fail(boom);
  const error = await closing.then(() => null, (reason) => reason);

  assert.ok(error instanceof AggregateError);
  assert.ok(Object.is(error.errors[0], boom));
  assert.match(error.message, /1 of 1 disposer\(s\) threw/);
  await assert.rejects(released, (reason) => reason === boom);
  assert.equal(calls, 1);
});

test('a release that failed before close is not ignored by the close', async () => {
  // Gate: priorreleasefailure. Previously the close resolved here; the scope had
  // "nothing to run" while the teardown it recorded had actually failed.
  const scope = createCleanupScope({ label: 'plugin-y' });
  const boom = new Error('early unregister failed');
  const ok = scope.defer(() => {}, { label: 'fine' });
  const failing = scope.defer(() => { throw boom; }, { label: 'broken' });

  await ok.release();
  await assert.rejects(failing.release(), (error) => error === boom);

  const error = await scope.close().then(() => null, (reason) => reason);

  assert.ok(error instanceof AggregateError);
  assert.equal(error.code, 'ERR_CLEANUP_SCOPE_FAILED');
  assert.deepEqual(error.errors, [boom], 'only the failing registration appears');
  assert.equal(error.message, 'cleanup scope "plugin-y" close failed: 1 of 2 disposer(s) threw',
    'attempted counts every retained registration, not just the ones that threw');
  assert.equal(scope.size, 0);
});

test('repeated release returns one exact promise, even from inside the disposer', async () => {
  // Gate: repeatedrelease/exactPromise/sync reentrancy. The run is memoized
  // before user code, so a release issued synchronously by the disposer itself
  // observes the same promise rather than starting a second run or reporting
  // a completion that has not happened.
  const scope = createCleanupScope();
  let handle;
  let reentrant;
  let calls = 0;
  handle = scope.defer(() => {
    calls += 1;
    reentrant = handle.release();
  });

  const first = handle.release();
  const second = handle.release();
  assert.equal(first, second, 'two callers share one promise object');
  assert.equal(reentrant, first, 'the disposer sees the memoized run, not a new one');

  await Promise.all([first, second, reentrant]);
  assert.equal(calls, 1, 'exactly one invocation');

  const later = handle.release();
  assert.equal(later, first, 'a release after settlement still returns the same promise');
  await later;
  assert.equal(calls, 1);
  assert.equal(handle.done, true);
});

test('hostile thrown values are preserved untouched and never coerced into the message', async () => {
  // Gate: hostile thrown object / throw undefined. Building the aggregate must
  // not read or stringify the thrown values, or a throwing toString would turn
  // one disposer failure into an aggregation failure.
  const scope = createCleanupScope({ label: 'plugin-h' });
  const hostile = {
    code: 'weird',
    toString() { throw new Error('toString must not be called'); },
    get message() { throw new Error('message getter must not be called'); },
  };

  scope.defer(() => { throw undefined; }, { label: 'undef' });
  scope.defer(() => { throw hostile; }, { label: 'hostile' });

  const error = await scope.close().then(() => null, (reason) => reason);

  assert.ok(error instanceof AggregateError, 'the aggregate itself was built');
  assert.equal(error.errors.length, 2);
  assert.ok(Object.is(error.errors[0], hostile), 'the object is kept by identity');
  assert.equal(error.errors[1], undefined, 'a throw of undefined survives as undefined');
  assert.equal(typeof error.message, 'string');
  assert.equal(error.message, 'cleanup scope "plugin-h" close failed: 2 of 2 disposer(s) threw');
  assert.doesNotMatch(error.message, /\[object Object\]/);
  assert.doesNotMatch(error.message, /weird/);
  assert.doesNotMatch(error.message, /toString must not be called|message getter must not be called/);
});

test('a normal close is LIFO and a repeated close runs nothing again', async () => {
  // Gate: normal LIFO/repeatclose. Retaining entries must not turn a double
  // close into a second teardown.
  const scope = createCleanupScope();
  const log = [];
  scope.defer(async () => { await tick(); log.push('a'); });
  scope.defer(async () => { await tick(); log.push('b'); });
  scope.defer(() => { log.push('c'); });

  const first = scope.close();
  const second = scope.close();
  assert.equal(first, second);
  await first;
  assert.deepEqual(log, ['c', 'b', 'a'], 'reverse registration order, one at a time');

  const third = scope.close();
  assert.equal(third, first, 'a settled close keeps its promise');
  await third;
  await tick();
  assert.deepEqual(log, ['c', 'b', 'a'], 'nothing ran again');
});

test('an empty scope closes to a settled promise', async () => {
  const scope = createCleanupScope();
  assert.equal(scope.size, 0);
  await scope.close();
  assert.equal(scope.closed, true);
});

test('the module stays dependency-free and free of module-global state', () => {
  const source = readFileSync(new URL('../src/cleanup.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^import\s/m, 'no imports: the helper stays dependency-free');
  assert.doesNotMatch(source, /globalThis/, 'no global registry');
  assert.doesNotMatch(source, /require\(/, 'ESM only');
  assert.doesNotMatch(source, /setTimeout|setInterval/, 'no timer: close() has no deadline of its own');
  assert.deepEqual(Object.keys(cleanup).sort(), ['CleanupScopeClosedError', 'createCleanupScope'],
    'the module surface is one factory and one error type');
  assert.ok(Object.isFrozen(createCleanupScope()), 'a scope cannot be extended into a registry');
});
