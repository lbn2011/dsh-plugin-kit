import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { ADMISSION_SERVICE, createAdmissionProvider } from '../src/admission-provider.js';
import { AdmissionConflictError, createAdmissionCoordinator } from '../src/admission.js';

// Written against the documented contract with a controlled `ctx`, and NOT RUN.
// Nothing here is evidence about a real host: the context is a two-line mock of
// `provide`, so no Loader, fiber, isolation scope or unload ordering takes part.
// What these cases can establish is what the provider alone does — that it
// publishes the exact coordinator it was given when apply runs, and adds
// neither admission logic, nor state, nor a fallback.

const SOURCE_JS = fileURLToPath(new URL('../src/admission-provider.js', import.meta.url));
const SOURCE_DTS = fileURLToPath(new URL('../src/admission-provider.d.ts', import.meta.url));

/** A real coordinator from the kit, for cases about pass-through. */
function coordinator() {
  return createAdmissionCoordinator();
}

/**
 * The smallest context this plugin can run against: it records each `provide`
 * call and hands back a disposer the plugin must never call.
 *
 * `disposed` is the point of the mock. A provider that cleaned up after itself
 * would show up here, and that is exactly the manual cleanup this module must
 * not do.
 */
function createCtx() {
  const provided = [];
  const disposed = [];
  return {
    provided,
    disposed,
    provide(name, value) {
      provided.push({ name, value });
      return () => disposed.push(value);
    },
  };
}

/** A coordinator that records any read or call the provider makes on it. */
function trapCoordinator() {
  const touched = [];
  return {
    touched,
    coordinator: {
      get size() {
        touched.push('size');
        return 0;
      },
      reserve() {
        touched.push('reserve');
        throw new Error('the provider must never reserve');
      },
      admit() {
        touched.push('admit');
        throw new Error('the provider must never admit');
      },
    },
  };
}

test('the module exports exactly the documented surface', async () => {
  const module = await import('../src/admission-provider.js');
  assert.deepEqual(Object.keys(module).sort(), ['ADMISSION_SERVICE', 'createAdmissionProvider']);
});

test('the package exposes the provider through its dedicated subpath', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.deepEqual(pkg.exports['./admission-provider'], {
    types: './src/admission-provider.d.ts',
    default: './src/admission-provider.js',
  });
});

test('the service name is the fixed literal a generated inject list names', () => {
  // One literal, not a tunable: the provider and the `inject` list in generated
  // source have to agree, and a configurable name would let them diverge without
  // either side failing.
  assert.equal(ADMISSION_SERVICE, 'pluginAdmission');
});

test('the factory returns a frozen { name, apply } plugin object with nothing else', () => {
  const plugin = createAdmissionProvider(coordinator());
  assert.deepEqual(Object.keys(plugin).sort(), ['apply', 'name']);
  assert.equal(plugin.name, ADMISSION_SERVICE, 'the plugin is named after the service it publishes');
  assert.equal(typeof plugin.apply, 'function');
  assert.ok(
    Object.isFrozen(plugin),
    'the plugin object must be frozen so the published coordinator cannot be re-pointed after creation',
  );
});

test('apply is non-constructible, so a host calls it as a plain function', () => {
  // Cordis asks `isConstructor(plugin.apply)` and, for a constructible apply,
  // invokes it with `new` and discards whatever it returns (vendored
  // cordis/src/fiber.ts, `_runner.execute`). An arrow has no `prototype`, so the
  // provider always takes the plainly-called path.
  const plugin = createAdmissionProvider(coordinator());
  assert.equal(Object.hasOwn(plugin.apply, 'prototype'), false, 'an arrow apply carries no prototype');
  assert.throws(() => new plugin.apply(createCtx()), TypeError, 'a non-constructible apply cannot be `new`-ed');
});

test('apply publishes the exact coordinator under the service name and returns no effect', () => {
  const shared = coordinator();
  const plugin = createAdmissionProvider(shared);
  const ctx = createCtx();

  const effect = plugin.apply(ctx);

  assert.equal(ctx.provided.length, 1, 'exactly one provide call per apply');
  assert.equal(ctx.provided[0].name, ADMISSION_SERVICE);
  assert.ok(
    Object.is(ctx.provided[0].value, shared),
    'the published value must be the identical object; a copy or wrapper would be a second table',
  );
  assert.equal(effect, undefined, 'a nullish effect is valid, and it keeps the provide disposer single-owner');
  assert.deepEqual(
    ctx.disposed,
    [],
    'the provider must not call the provide disposer itself: the providing fiber owns that teardown',
  );
});

test('the provider retains the given coordinator by identity across repeated applies', () => {
  const shared = coordinator();
  const plugin = createAdmissionProvider(shared);

  const first = createCtx();
  const second = createCtx();
  plugin.apply(first);
  plugin.apply(first);
  plugin.apply(second);

  // Two applies on one context is what a real host refuses as a duplicate; the
  // provider itself keeps no state, so it neither dedupes nor substitutes. What
  // this pins down is identity: every call publishes the same object.
  assert.equal(first.provided.length, 2);
  assert.equal(second.provided.length, 1);
  for (const { value } of [...first.provided, ...second.provided]) {
    assert.ok(Object.is(value, shared), 'every apply publishes the one object the factory was given');
  }
});

test('two factories over one coordinator still publish that one object', () => {
  // A reload builds a new plugin object only if the caller builds a new one; when
  // it does, the coordinator handed to the factory is still the single table.
  const shared = coordinator();
  const one = createAdmissionProvider(shared);
  const two = createAdmissionProvider(shared);
  const ctxA = createCtx();
  const ctxB = createCtx();

  one.apply(ctxA);
  two.apply(ctxB);

  assert.ok(Object.is(ctxA.provided[0].value, shared));
  assert.ok(Object.is(ctxB.provided[0].value, shared));
  assert.equal(ctxA.provided[0].value, ctxB.provided[0].value);
  // The two plugin objects are still distinct: a host keys a plugin runtime by
  // its `apply` identity, so sharing one `apply` function would make the second
  // provider look like a re-application of the first instead of a second
  // registration the service store has to refuse.
  assert.notEqual(one.apply, two.apply);
});

test('two factories over two coordinators keep two disjoint tables', () => {
  // The provider adds no lookup of its own, so it cannot merge what the caller
  // kept apart — and must not appear to.
  const first = coordinator();
  const second = coordinator();
  const ctxA = createCtx();
  const ctxB = createCtx();

  createAdmissionProvider(first).apply(ctxA);
  createAdmissionProvider(second).apply(ctxB);

  assert.ok(Object.is(ctxA.provided[0].value, first));
  assert.ok(Object.is(ctxB.provided[0].value, second));
  assert.notEqual(ctxA.provided[0].value, ctxB.provided[0].value);
});

test('the published value is the working coordinator, not a facade over it', () => {
  // The dependent's proof that this is the caller's table: reserve through the
  // published object and watch the caller's own coordinator answer.
  const shared = coordinator();
  const ctx = createCtx();
  createAdmissionProvider(shared).apply(ctx);
  const published = ctx.provided[0].value;

  assert.equal(published.reserve, shared.reserve, `the methods are the caller's own functions`);
  assert.equal(published.admit, shared.admit);
  assert.equal(published.size, 0);

  const claim = { kind: 'tool', name: 'provider_probe', scope: 'provider-test' };
  published.reserve([claim]);
  assert.equal(shared.size, 1, `reserving through the published object is reserving on the caller's table`);
  assert.throws(() => shared.reserve([claim]), AdmissionConflictError);
});

test('apply reads no coordinator member, so nothing can release, reset or quarantine', () => {
  const { coordinator: trapped, touched } = trapCoordinator();
  const plugin = createAdmissionProvider(trapped);
  const ctx = createCtx();

  plugin.apply(ctx);
  plugin.apply(createCtx());

  // `touched` records every call and the `size` getter. Both stay empty: the
  // provider publishes and stops. There is no unload hook here to reach either —
  // `apply` returns undefined, so this module has no teardown path at all, and a
  // claim is not directly mutated by this provider. Native dependent cleanup
  // can separately release clean claims during a real host unload.
  assert.deepEqual(touched, [], 'a provider that touched the coordinator could disturb live claims');
  assert.ok(Object.is(ctx.provided[0].value, trapped), 'the trapped object itself is what gets published');
});

test('publishing the same external coordinator again retains quarantined claims', () => {
  const shared = coordinator();
  const claim = { kind: 'tool', name: 'quarantined_probe', scope: 'global' };
  const lease = shared.reserve([claim]);
  lease.quarantine();
  const first = createCtx();
  const second = createCtx();
  createAdmissionProvider(shared).apply(first);
  createAdmissionProvider(shared).apply(second);
  assert.equal(first.provided[0].value, second.provided[0].value);
  assert.equal(lease.state, 'quarantined');
  assert.equal(shared.size, 1);
  assert.throws(() => second.provided[0].value.reserve([claim]), AdmissionConflictError);
  // Mock publication only: no native provider-unload ordering is exercised.
});

test('an invalid coordinator is refused at factory time, with no fallback', () => {
  // Every one of these is a caller bug that must fail where the provider is
  // built. None of them may produce a plugin: a plugin that failed later would
  // fail inside the host's load lifecycle, and one that fell back to a fresh
  // coordinator would silently hand its dependents a private table.
  const cases = [
    ['no argument', () => createAdmissionProvider()],
    ['null', () => createAdmissionProvider(null)],
    ['undefined', () => createAdmissionProvider(undefined)],
    ['a number', () => createAdmissionProvider(42)],
    ['a string naming the service', () => createAdmissionProvider(ADMISSION_SERVICE)],
    ['an empty object', () => createAdmissionProvider({})],
    ['reserve only', () => createAdmissionProvider({ reserve() {} })],
    ['admit only', () => createAdmissionProvider({ admit() {} })],
    ['a non-callable reserve', () => createAdmissionProvider({ reserve: 'reserve', admit() {} })],
    ['a null admit', () => createAdmissionProvider({ reserve() {}, admit: null })],
    ['an array of two functions', () => createAdmissionProvider([() => {}, () => {}])],
    ['a lease-shaped object', () => createAdmissionProvider({ state: 'reserved', claims: [], release() {} })],
  ];

  for (const [label, build] of cases) {
    assert.throws(
      build,
      (error) => {
        assert.ok(error instanceof TypeError, `${label} must be refused with TypeError`);
        assert.match(error.message, /createAdmissionProvider\(coordinator\)/, `${label}: the message names the call`);
        return true;
      },
      `${label} must be refused`,
    );
  }
});

test('the refusal names the missing member and never creates a coordinator', () => {
  assert.throws(
    () => createAdmissionProvider({ reserve() {} }),
    (error) => {
      assert.match(error.message, /coordinator\.admit must be a function/);
      return true;
    },
  );
  assert.throws(
    () => createAdmissionProvider({}),
    (error) => {
      assert.match(error.message, /coordinator\.reserve must be a function/);
      return true;
    },
  );
});

test('a duplicate provide from the host propagates unchanged out of apply', () => {
  // The second provider in one scope is the host's to refuse: its service store
  // is what knows the scope. The provider therefore adds no guard of its own and
  // must not inspect, wrap or swallow the error — the host's lifecycle needs the
  // original value.
  const duplicate = new Error(`service "${ADMISSION_SERVICE}" has been registered at <pluginAdmission>`);
  const ctx = {
    provided: [],
    provide(name, value) {
      ctx.provided.push({ name, value });
      throw duplicate;
    },
  };
  const plugin = createAdmissionProvider(coordinator());

  assert.throws(
    () => plugin.apply(ctx),
    (error) => {
      assert.ok(Object.is(error, duplicate), 'the identical error object reaches the caller');
      return true;
    },
  );
  assert.equal(ctx.provided.length, 1, 'the provider did not retry the refused registration');
});

test('creating and applying a provider leaves no global trace', () => {
  // "No global registry" is observable: publishing a service must change the
  // context, and nothing else.
  const before = Reflect.ownKeys(globalThis);
  const plugin = createAdmissionProvider(coordinator());
  const ctx = createCtx();
  plugin.apply(ctx);
  const after = Reflect.ownKeys(globalThis);

  assert.deepEqual(after, before, 'no module-level or global registry was added');
  assert.equal(globalsMentioning(ADMISSION_SERVICE), 0, 'the service name is not smuggled onto a global object');
});

/** Count global keys that mention the service name, without reading their values. */
function globalsMentioning(name) {
  return Reflect.ownKeys(globalThis).filter((key) => typeof key === 'string' && key.includes(name)).length;
}

test('the module imports no host package and no sibling module state', async () => {
  // Pure by construction: no Cordis import means no runtime dependency on the
  // framework, which is why the provider object is a plain data structure the
  // host happens to accept.
  const source = await readFile(SOURCE_JS, 'utf8');
  assert.doesNotMatch(source, /^\s*import\s/m, 'the module has no imports');
  assert.doesNotMatch(source, /require\s*\(/);
  assert.doesNotMatch(source, /@deepseek-ai\/cordis/);
});

test('the declaration file matches the runtime exports', async () => {
  const types = await readFile(SOURCE_DTS, 'utf8');
  const declared = [...types.matchAll(/export declare (?:const|function) (\w+)/g)].map((match) => match[1]);
  assert.deepEqual(
    declared.sort(),
    ['ADMISSION_SERVICE', 'createAdmissionProvider'],
    `the declarations describe exactly the module's exports`,
  );
  assert.match(types, /export declare const ADMISSION_SERVICE: 'pluginAdmission'/, 'the literal is declared, not widened');
});
