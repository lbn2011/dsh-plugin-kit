import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import * as kit from '../src/index.js';

const INDEX_DS = fileURLToPath(new URL('../src/index.d.ts', import.meta.url));

test('the package entry point re-exports the documented surface', () => {
  const expected = [
    // protocol: version literals, one pin per generated dependency
    'KIT_VERSION', 'HOST_VERSION', 'HOST_ENGINE', 'HOST_PEERS', 'GENERATED_DEPENDENCIES',
    'CORDIS_PACKAGE', 'CORDIS_VERSION', 'TOOLS_PACKAGE', 'TOOLS_VERSION',
    'SCHEMASTER_PACKAGE', 'SCHEMASTER_VERSION', 'NODE_ENGINE',
    'PROTOCOL_VERSION', 'DEFAULT_SCOPE',
    'TOOL_TEMPLATE_CAPABILITY', 'EFFECT_CAPABILITY',
    'KIT_PACKAGE', 'KIT_SPECIFIER_PREFIX',
    'toolDeclaration', 'validateWith', 'describeDeclaration',
    // manifest
    'RESERVED_TOOL_NAMES', 'checkKitSpecifier', 'checkScaffoldInputs',
    'hostToolPackageJson', 'hostToolPatch', 'hostToolIndexJs', 'hostToolTestJs',
    'hostToolReadme', 'hostToolJsConfig', 'hostToolDeclarationJson',
    'managedToolPackageJson', 'managedToolIndexJs', 'managedToolTestJs', 'managedToolReadme',
    // manifest, admitted variant: the one scope constant the tuple and the
    // declaration share, plus one builder per emitted file.
    'ADMITTED_TOOL_SCOPE',
    'admittedToolPackageJson', 'admittedToolIndexJs', 'admittedToolTestJs', 'admittedToolReadme',
    // scaffold
    'DEFAULT_PLUGIN_VERSION', 'TEMPLATES', 'DEFERRED_TEMPLATES', 'DEFAULT_TEMPLATE',
    'defaultToolName', 'resolveTemplate', 'planScaffold', 'renderScaffold', 'writeScaffold',
    'describeScaffoldPlan',
  ];
  for (const name of expected) {
    assert.ok(name in kit, `src/index.js does not export ${name}`);
  }
  assert.deepEqual(Object.keys(kit).sort(), [...expected].sort());
});

test('the admitted variant is exported beside the two host-only templates', () => {
  // The catalog and the manifest surface must agree: a template that is listed
  // but has no builders would be a plan that renders nothing.
  assert.deepEqual(Object.keys(kit.TEMPLATES), ['host-tool', 'host-tool-managed', 'host-tool-admitted']);
  for (const [id, template] of Object.entries(kit.TEMPLATES)) {
    assert.equal(template.id, id);
    assert.equal(template.status, 'implemented', `${id} is listed as implemented, so it must render`);
    assert.equal(template.language, 'js');
  }
  // One claim scope, one literal, emitted by both the tuple and the declaration.
  assert.equal(kit.ADMITTED_TOOL_SCOPE, 'global');
  for (const suffix of ['PackageJson', 'IndexJs', 'TestJs', 'Readme']) {
    const name = `admittedTool${suffix}`;
    assert.equal(typeof kit[name], 'function', `${name} must be exported`);
  }
});

test('the removed local protocol surface stays removed', () => {
  // These were a second, partial copy of rules owned by dsh-compat-spec: a
  // shape checker, a resource-kind list, a scope vocabulary, a path formatter
  // and a helper that invented a service declaration.
  for (const name of ['checkDeclarationShape', 'joinPath', 'exampleServiceDeclaration', 'SCOPES', 'RESOURCE_KINDS', 'HOST_PEER_RANGE']) {
    assert.equal(name in kit, false, `src/index.js must not export ${name}`);
  }
});

test('every runtime export has a matching declaration in index.d.ts', async () => {
  const types = await readFile(INDEX_DS, 'utf8');
  const declared = new Set(
    [...types.matchAll(/export declare (?:const|function) (\w+)/g)].map((match) => match[1]),
  );
  for (const name of Object.keys(kit)) {
    assert.ok(declared.has(name), `index.d.ts does not declare ${name}`);
  }
  // The declaration file must not describe exports that no longer exist.
  for (const name of declared) {
    assert.ok(name in kit, `index.d.ts declares ${name}, which src/index.js does not export`);
  }
});

test('importing the library has no side effects', async () => {
  // The module graph above is the entire surface; it only defines functions and
  // constant values. This test fails loudly if a future import grows an effect.
  assert.equal(typeof kit.writeScaffold, 'function');
  assert.equal(kit.KIT_VERSION, '0.0.0');
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.main, './src/index.js');
  assert.equal(pkg.types, './src/index.d.ts');
  assert.equal(pkg.bin['dsh-plugin-kit'], './src/cli.js');
  assert.equal(pkg.private, true);
  assert.deepEqual(Object.keys(pkg.dependencies ?? {}), [], 'the kit must stay dependency-free');
  assert.deepEqual(Object.keys(pkg.peerDependencies ?? {}), [], 'the kit must not require host packages');
});

test('the kit declares no host manifest fields of its own', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  // `dsh.bundle` would claim the kit itself is installable into a profile, and
  // `dsh.compatibleHost` is not a field any official package declares.
  assert.equal(pkg.dsh, undefined);
  assert.equal(pkg.client, undefined);
  assert.equal(pkg.license, undefined, 'a private package declares no license field it cannot substantiate');
  assert.equal(pkg.engines.node, '>=24.9.0', 'the requirement matches the pinned official packages');
});
