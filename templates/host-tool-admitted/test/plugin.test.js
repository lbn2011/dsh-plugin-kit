import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

import { ADMISSION_SERVICE } from 'dsh-plugin-kit/admission-provider';

// Importing `../index.js` resolves `dsh-plugin-kit/admission-provider`, so this
// suite needs that package resolvable, along with the three shared host
// packages. The kit is private and unpublished; this project records it in
// `dependencies` as the operator's local `file:` specifier, which must resolve
// from this directory. None of these tests starts a host, and no coordinator is
// created here: the stand-in below is a plain object, not the kit's coordinator.
const plugin = await import('../index.js');
const source = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const declaration = JSON.parse(readFileSync(new URL('../declaration.json', import.meta.url), 'utf8'));

/** The one tuple this plugin claims, in the exact shape `admit` receives. */
const CLAIM = { kind: 'tool', name: 'sample_admitted_hello', scope: 'global' };

test('module exports the Cordis plugin contract and nothing else', () => {
  // An exact export list: no test hooks, no fault switches, no extra surface.
  assert.deepEqual(Object.keys(plugin).sort(), ['Config', 'apply', 'generatedBy', 'inject', 'name', 'version']);
  assert.equal(plugin.name, 'sample-admitted');
  assert.equal(plugin.version, '0.1.0');
  assert.equal(plugin.generatedBy, 'dsh-plugin-kit@0.1.0-draft.1');
  assert.equal(typeof plugin.apply, 'function');
  // `Schema.object({...})` returns a callable schema (Schemastery creates it as
  // a function whose prototype is Function.prototype), not a plain object.
  assert.equal(typeof plugin.Config, 'function');
  assert.equal(Object.getPrototypeOf(plugin.Config) !== Object.prototype, true);
  assert.equal(Object.getPrototypeOf(plugin.Config) instanceof Function, true);
});

test('inject uses the imported service literal and no hand-written name', () => {
  assert.deepEqual([...plugin.inject], ['tools', ADMISSION_SERVICE]);
  assert.equal(ADMISSION_SERVICE, 'pluginAdmission');
  // The literal comes from the import, so plugin and provider cannot drift.
  assert.match(source, /import \{ ADMISSION_SERVICE \} from 'dsh-plugin-kit\/admission-provider';/);
  assert.match(source, /export const inject = \['tools', ADMISSION_SERVICE\];/);
});

test('the module creates no coordinator and mounts no provider of its own', () => {
  // Ownership is external: this file is a dependent, never a fallback.
  // Check call syntax, not descriptive names inside diagnostics.
  assert.doesNotMatch(source, /createAdmissionCoordinator\s*\(/);
  assert.doesNotMatch(source, /createAdmissionProvider\s*\(/);
  assert.doesNotMatch(source, /from 'dsh-plugin-kit\/admission';/);
});

test('apply is a non-constructible async callback', async () => {
  assert.equal(Object.hasOwn(plugin.apply, 'prototype'), false, 'apply must not be constructible');
  assert.equal(Object.getPrototypeOf(plugin.apply), Object.getPrototypeOf(async () => {}));
  assert.equal(plugin.apply.constructor.name, 'AsyncFunction');
  const returned = plugin.apply({ tools: { register: () => () => {} } }, { greeting: 'Hi' });
  assert.equal(typeof returned.then, 'function', 'apply must return a promise');
  // The stand-in has no service at all; the refusal itself is asserted below.
  await assert.rejects(returned, TypeError);
});

test('apply admits one claim, registers inside it, and returns handle.close()', async () => {
  const registered = [];
  const released = [];
  const calls = [];
  // A plain stand-in for `ctx`, not a Cordis context. `admit` is modelled on the
  // reviewed coordinator: claims first, callback second, deferred disposers run
  // by `close()`, one promise per handle.
  const ctx = {
    tools: {
      register(definition) {
        registered.push(definition);
        return () => {
          released.push(definition.name);
        };
      },
    },
    pluginAdmission: {
      admit(claims, activate) {
        calls.push({ claims, registeredBefore: registered.length });
        const deferred = [];
        let settlement;
        return Promise.resolve(activate({ defer: (disposer) => deferred.push(disposer) })).then((value) => {
          calls.push({ activationValue: value });
          return {
            value,
            close() {
              settlement ??= Promise.resolve().then(async () => {
                for (const disposer of deferred.reverse()) await disposer();
                calls.push({ closed: true });
              });
              return settlement;
            },
          };
        });
      },
    },
  };

  const cleanup = await plugin.apply(ctx, { greeting: 'Hi' });
  assert.equal(typeof cleanup, 'function', 'apply must resolve to the cleanup');
  assert.deepEqual(calls[0].claims, [CLAIM], 'one batch, exactly the declared claim');
  assert.equal(calls[0].registeredBefore, 0, 'nothing may be registered before the claim is reserved');
  assert.equal(calls[1].activationValue, undefined, 'the activation itself returns nothing');
  assert.deepEqual(registered.map((definition) => definition.name), ['sample_admitted_hello']);
  assert.deepEqual(released, [], 'apply must not release anything');

  // The registered tool keeps the reviewed defineTool contract.
  assert.equal(await registered[0].execute({ who: 'Ada' }), 'Hi, Ada!');
  assert.deepEqual(registered[0].output.render({}, 'Hi, Ada!'), [{ type: 'text', text: 'Hi, Ada!' }]);

  await cleanup();
  await cleanup();
  // `close()` returns the same promise on every call, so the disposer runs once.
  assert.deepEqual(released, ['sample_admitted_hello']);
  assert.equal(calls.filter((call) => call.closed === true).length, 1);
});

test('apply refuses every malformed service before registering anything', async () => {
  const registered = [];
  const tools = {
    register(definition) {
      registered.push(definition);
      return () => {};
    },
  };
  const hostile = [undefined, null, {}, { admit: 'later' }, 'pluginAdmission'];
  for (const pluginAdmission of hostile) {
    await assert.rejects(plugin.apply({ tools, pluginAdmission }, { greeting: 'Hi' }), (error) => {
      assert.equal(error instanceof TypeError, true, 'a malformed service is a TypeError');
      assert.match(error.message, /pluginAdmission/);
      return true;
    });
    assert.deepEqual(registered, [], 'a malformed service must not register a tool');
  }
});

test('package.json pins the reviewed host metadata and the operator kit dependency', () => {
  const EXPECTED_PINS = {
  "@deepseek-ai/cordis": "4.0.6-alpha.1",
  "@deepseek-ai/schemastery": "3.18.6-alpha.1",
  "@deepseek-ai/dsh-tools": "0.2.2-alpha.2"
};
  // The kit specifier is the operator's own string, recorded verbatim when this
  // project was generated. The generator invents none: no default, no
  // environment lookup, no sibling scan, no version guess.
  const EXPECTED_KIT_SPECIFIER = "file:../dsh-plugin-kit";
  assert.ok(EXPECTED_KIT_SPECIFIER.startsWith('file:'), 'the recorded kit specifier must be a local file: path');
  assert.ok(EXPECTED_KIT_SPECIFIER.length > 'file:'.length, 'the recorded kit specifier must name a path');
  assert.equal(pkg.type, 'module');
  assert.equal(pkg.engines.node, '>=24.9.0');
  assert.equal(pkg.engines.dsh, '0.2.2-alpha.2');
  assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml');
  const root = new URL('../', import.meta.url);
  assert.equal(new URL(pkg.dsh.bundle.patch, root).pathname, new URL('cordis.patch.yml', root).pathname);
  assert.ok(existsSync(new URL(pkg.dsh.bundle.patch, root)), 'the patch file must exist next to package.json');
  assert.deepEqual(pkg.peerDependencies, EXPECTED_PINS);
  assert.deepEqual(pkg.devDependencies, EXPECTED_PINS);
  assert.equal(pkg.peerDependencies['dsh-plugin-kit'], undefined);
  assert.equal(pkg.devDependencies['dsh-plugin-kit'], undefined);
  assert.deepEqual(pkg.dependencies, { 'dsh-plugin-kit': EXPECTED_KIT_SPECIFIER });
  assert.doesNotMatch(JSON.stringify(pkg.dependencies), /[\^~]|\*|latest/);
});

test('declaration.json claims exactly what the activation claims', () => {
  assert.equal(declaration.schemaVersion, '0.1.0-draft.1');
  assert.equal(declaration.plugin.id, 'sample-admitted');
  assert.equal(declaration.plugin.version, pkg.version);
  assert.deepEqual(declaration.capabilities, { required: ['cordis.effect', 'ctx.tools'], optional: [] });
  // Same kind, same name, same scope as the tuple in `apply`; the scope is a
  // declaration label, not a host-enforced boundary.
  assert.deepEqual(declaration.resources, [CLAIM]);
  assert.match(source, /scope: 'global'/);
});
