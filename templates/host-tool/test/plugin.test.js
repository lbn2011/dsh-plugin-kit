import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const plugin = await import('../index.js');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const declaration = JSON.parse(readFileSync(new URL('../declaration.json', import.meta.url), 'utf8'));

test('module exports the Cordis plugin contract', () => {
  assert.equal(plugin.name, 'sample-plugin');
  assert.equal(plugin.version, '0.1.0');
  assert.deepEqual([...plugin.inject], ['tools']);
  assert.equal(typeof plugin.apply, 'function');
  // `Schema.object({...})` returns a callable schema (Schemastery creates it as
  // a function whose prototype is Function.prototype), not a plain object.
  assert.equal(typeof plugin.Config, 'function');
  assert.equal(Object.getPrototypeOf(plugin.Config) !== Object.prototype, true);
  assert.equal(Object.getPrototypeOf(plugin.Config) instanceof Function, true);
  // Importing must not register anything: this test never calls apply().
});

test('package.json pins the reviewed host metadata', () => {
  // Version literals read from the pinned official sources (indent keeps them
  // out of this template literal's $ substitutions).
  const EXPECTED_PINS = {
  "@deepseek-ai/cordis": "4.0.6-alpha.1",
  "@deepseek-ai/schemastery": "3.18.6-alpha.1",
  "@deepseek-ai/dsh-tools": "0.2.2-alpha.2"
};
  assert.equal(pkg.type, 'module');
  assert.equal(pkg.engines.node, '>=24.9.0');
  assert.equal(pkg.engines.dsh, '0.2.2-alpha.2');
  assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml');
  const root = new URL('../', import.meta.url);
  assert.equal(new URL(pkg.dsh.bundle.patch, root).pathname, new URL('cordis.patch.yml', root).pathname);
  assert.ok(existsSync(new URL(pkg.dsh.bundle.patch, root)), 'the patch file must exist next to package.json');
  // One exact version per package; peers and dev dependencies agree.
  assert.deepEqual(pkg.peerDependencies, EXPECTED_PINS);
  assert.deepEqual(pkg.devDependencies, EXPECTED_PINS);
  assert.equal(pkg.dsh.manifestVersion, undefined);
  assert.equal(pkg.dsh.compatibleHost, undefined);
  assert.equal(pkg.license, undefined);
});

test('declaration.json claims exactly this tool, with every field explicit', () => {
  assert.equal(declaration.schemaVersion, '0.1.0-draft.1');
  assert.equal(declaration.plugin.id, 'sample-plugin');
  assert.equal(declaration.plugin.version, pkg.version);
  assert.deepEqual(declaration.capabilities, { required: ['cordis.effect', 'ctx.tools'], optional: [] });
  assert.deepEqual(declaration.resources, [{ kind: 'tool', name: 'sample_hello', scope: 'plugin' }]);
});
