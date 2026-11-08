import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

// Importing `../index.js` resolves `dsh-plugin-kit/managed-registration`, so this
// suite needs that package resolvable, along with the three shared host
// packages. The kit is private and unpublished; this project records it in
// `dependencies` as the operator's local `file:` specifier, which must resolve
// from this directory. None of these tests starts a host.
const plugin = await import('../index.js');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const declaration = JSON.parse(readFileSync(new URL('../declaration.json', import.meta.url), 'utf8'));

test('module exports the Cordis plugin contract and nothing else', () => {
  // An exact export list: no test hooks, no fault switches, no extra surface.
  assert.deepEqual(Object.keys(plugin).sort(), ['Config', 'apply', 'generatedBy', 'inject', 'name', 'version']);
  assert.equal(plugin.name, 'sample-managed');
  assert.equal(plugin.version, '0.1.0');
  assert.equal(plugin.generatedBy, 'dsh-plugin-kit@0.0.0');
  assert.deepEqual([...plugin.inject], ['tools']);
  assert.equal(typeof plugin.apply, 'function');
  // `Schema.object({...})` returns a callable schema (Schemastery creates it as
  // a function whose prototype is Function.prototype), not a plain object.
  assert.equal(typeof plugin.Config, 'function');
  assert.equal(Object.getPrototypeOf(plugin.Config) !== Object.prototype, true);
  assert.equal(Object.getPrototypeOf(plugin.Config) instanceof Function, true);
});

test('apply mounts one tool through the kit and returns its cleanup', async () => {
  const registered = [];
  const released = [];
  // A plain stand-in for `ctx`, not a Cordis context: `tools.register` returns a
  // disposer exactly as the reviewed host does, and nothing else is read.
  const ctx = {
    tools: {
      register(definition) {
        registered.push(definition);
        return () => {
          released.push(definition.name);
        };
      },
    },
  };

  const cleanup = plugin.apply(ctx, { greeting: 'Hi' });
  assert.equal(typeof cleanup, 'function', 'apply must return the cleanup');
  assert.deepEqual(registered.map((definition) => definition.name), ['sample_managed_hello']);
  assert.deepEqual(released, [], 'apply itself must not release anything');

  await cleanup();
  await cleanup();
  // The kit closes its scope once: the host disposer runs exactly once even
  // though the returned cleanup was awaited twice.
  assert.deepEqual(released, ['sample_managed_hello']);
});

test('the mounted tool keeps the configured greeting', async () => {
  const registered = [];
  const ctx = {
    tools: {
      register(definition) {
        registered.push(definition);
        return () => {};
      },
    },
  };
  const cleanup = plugin.apply(ctx, { greeting: 'Hi' });
  assert.equal(await registered[0].execute({ who: 'Ada' }), 'Hi, Ada!');
  await cleanup();
});

test('package.json pins the reviewed host metadata and the operator kit dependency', () => {
  // Version literals read from the pinned official sources (indent keeps them
  // out of this template literal's $ substitutions).
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
  // One exact version per host package; peers and dev dependencies agree, and
  // the managed variant changes neither set.
  assert.deepEqual(pkg.peerDependencies, EXPECTED_PINS);
  assert.deepEqual(pkg.devDependencies, EXPECTED_PINS);
  // The kit is a solved dependency, not a peer or a dev dependency: it is
  // supplied locally as a `file:` path, never from a registry.
  assert.equal(pkg.peerDependencies['dsh-plugin-kit'], undefined);
  assert.equal(pkg.devDependencies['dsh-plugin-kit'], undefined);
  assert.deepEqual(pkg.dependencies, { 'dsh-plugin-kit': EXPECTED_KIT_SPECIFIER });
  assert.doesNotMatch(JSON.stringify(pkg.dependencies), /[\^~]|\*|latest/);
  assert.equal(pkg.dsh.manifestVersion, undefined);
  assert.equal(pkg.dsh.compatibleHost, undefined);
  assert.equal(pkg.license, undefined);
});

test('declaration.json claims exactly this tool, with every field explicit', () => {
  assert.equal(declaration.schemaVersion, '0.1.0-draft.1');
  assert.equal(declaration.plugin.id, 'sample-managed');
  assert.equal(declaration.plugin.version, pkg.version);
  assert.deepEqual(declaration.capabilities, { required: ['cordis.effect', 'ctx.tools'], optional: [] });
  assert.deepEqual(declaration.resources, [{ kind: 'tool', name: 'sample_managed_hello', scope: 'plugin' }]);
});
