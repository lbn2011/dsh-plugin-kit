import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  CORDIS_VERSION,
  DEFAULT_SCOPE,
  EFFECT_CAPABILITY,
  GENERATED_DEPENDENCIES,
  HOST_ENGINE,
  HOST_PEERS,
  HOST_VERSION,
  KIT_VERSION,
  NODE_ENGINE,
  PROTOCOL_VERSION,
  SCHEMASTER_VERSION,
  TOOLS_VERSION,
  TOOL_TEMPLATE_CAPABILITY,
  describeDeclaration,
  toolDeclaration,
  validateWith,
} from '../src/protocol.js';

const sample = () => toolDeclaration({ pluginId: 'acme-tools', pluginVersion: '0.1.0', toolName: 'acme_hello' });

/** A validator that answers like the protocol owner's, for adapter tests only. */
const accepting = () => ({ valid: true, issues: [] });

test('kit and host versions are explicit literals, not ranges', () => {
  assert.equal(KIT_VERSION, '0.1.0-draft.1');
  assert.equal(HOST_VERSION, '0.2.2-alpha.2');
  assert.equal(PROTOCOL_VERSION, '0.1.0-draft.1');
  assert.equal(NODE_ENGINE, '>=24.9.0');
  assert.equal(HOST_ENGINE, HOST_VERSION);
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.version, KIT_VERSION);
  // The kit is not a host plugin: it declares no host manifest fields at all.
  // `dsh.bundle` would claim this package is installable into a profile.
  assert.equal(pkg.dsh, undefined);
  assert.equal(pkg.license, 'MIT', 'the license is the decided one, stated in LICENSE');
});

test('every generated dependency is pinned to one exact version, and they are not interchangeable', () => {
  assert.deepEqual(Object.keys(GENERATED_DEPENDENCIES).sort(), [...HOST_PEERS].sort());
  for (const [name, version] of Object.entries(GENERATED_DEPENDENCIES)) {
    assert.match(version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, `${name} is not an exact version: ${version}`);
    assert.doesNotMatch(version, /^[~^]|[*x]|\|\|| - /, `${name} must not carry a range operator: ${version}`);
  }
  // The three packages have unrelated versions; one shared range would be wrong.
  assert.equal(new Set(Object.values(GENERATED_DEPENDENCIES)).size, 3);
  assert.equal(GENERATED_DEPENDENCIES['@deepseek-ai/cordis'], CORDIS_VERSION);
  assert.equal(GENERATED_DEPENDENCIES['@deepseek-ai/schemastery'], SCHEMASTER_VERSION);
  assert.equal(GENERATED_DEPENDENCIES['@deepseek-ai/dsh-tools'], TOOLS_VERSION);
  assert.equal(Object.isFrozen(GENERATED_DEPENDENCIES), true);
});

test('toolDeclaration emits every protocol field explicitly', () => {
  const declaration = sample();
  assert.deepEqual(Object.keys(declaration).sort(), ['capabilities', 'plugin', 'resources', 'schemaVersion']);
  assert.equal(declaration.schemaVersion, PROTOCOL_VERSION);
  assert.deepEqual(declaration.plugin, { id: 'acme-tools', version: '0.1.0' });
  // Registering a tool needs the tool registry, so `ctx.tools` is required.
  assert.deepEqual(declaration.capabilities, {
    required: [EFFECT_CAPABILITY, TOOL_TEMPLATE_CAPABILITY],
    optional: [],
  });
  assert.deepEqual(declaration.resources, [{ kind: 'tool', name: 'acme_hello', scope: DEFAULT_SCOPE }]);
});

test('resources is always an explicit array, even when nothing is registered', () => {
  const empty = toolDeclaration({
    pluginId: 'x',
    pluginVersion: '0.0.1',
    toolName: null,
    capabilitiesRequired: [],
    capabilitiesOptional: [],
  });
  assert.deepEqual(empty.capabilities, { required: [], optional: [] });
  assert.deepEqual(empty.resources, []);
  assert.equal('resources' in empty, true, 'resources must be present, never omitted');
});

test('scope is an author label the kit does not enumerate or validate', () => {
  const custom = toolDeclaration({ pluginId: 'x', pluginVersion: '0.0.1', toolName: 'x_tool', scope: 'team/shared' });
  assert.deepEqual(custom.resources, [{ kind: 'tool', name: 'x_tool', scope: 'team/shared' }]);
  assert.equal(sample().resources[0].scope, 'plugin');
});

test('declaration input is not mutated and every call returns fresh arrays', () => {
  const required = ['cordis.effect'];
  const declaration = toolDeclaration({ pluginId: 'x', pluginVersion: '0.0.1', toolName: 'x_tool', capabilitiesRequired: required });
  declaration.capabilities.required.push('mutated');
  assert.deepEqual(required, ['cordis.effect']);

  const first = sample();
  first.resources.push({ kind: 'tool', name: 'extra', scope: 'plugin' });
  assert.equal(sample().resources.length, 1);
});

test('the kit ships no protocol rules of its own', async () => {
  const { readdir, readFile } = await import('node:fs/promises');
  const kit = await import('../src/index.js');
  // Removed surface: the local shape check and the closed vocabularies behind it.
  for (const name of ['checkDeclarationShape', 'joinPath', 'exampleServiceDeclaration', 'SCOPES', 'RESOURCE_KINDS', 'HOST_PEER_RANGE']) {
    assert.equal(name in kit, false, `src/index.js still exports ${name}`);
  }
  const srcDir = new URL('../src/', import.meta.url);
  for (const file of await readdir(srcDir, { recursive: true })) {
    if (!file.endsWith('.js')) continue;
    const text = await readFile(new URL(file, srcDir), 'utf8');
    assert.doesNotMatch(text, /RESOURCE_KINDS|checkDeclarationShape|exampleServiceDeclaration/, `${file} still implements protocol rules`);
  }
});

test('validateWith delegates to the injected validator and never imports one', () => {
  assert.equal(validateWith(sample(), accepting).valid, true);

  const strict = () => ({ valid: false, issues: [{ code: 'X', path: 'plugin.id', message: 'bad', severity: 'error', extra: 1 }] });
  assert.deepEqual(validateWith(sample(), strict), {
    valid: false,
    issues: [{ code: 'X', path: 'plugin.id', message: 'bad' }],
  });

  const thrown = validateWith(sample(), () => {
    throw new Error('validator exploded');
  });
  assert.equal(thrown.valid, false);
  assert.equal(thrown.issues[0].code, 'SELECTED_VALIDATION_ERROR');
  assert.match(thrown.issues[0].message, /validator exploded/);
});

test('validateWith requires an explicit function and explains how to inject one', () => {
  assert.throws(
    () => validateWith(sample(), undefined),
    /validateWith\(value, validator\): validator must be a function, e\.g\. validateDeclaration from dsh-compat-spec/,
  );
  assert.throws(() => validateWith(sample(), {}), /validator must be a function/);
});

test('validateWith never reports valid without a complete validator answer', () => {
  // Invalid with no issues is an incomplete answer, not a verdict.
  const noIssues = validateWith(sample(), () => ({ valid: false, issues: [] }));
  assert.equal(noIssues.valid, false);
  assert.equal(noIssues.issues[0].code, 'SELECTED_VALIDATOR_MALFORMED');

  // `{ valid: true }` without an `issues` array used to be accepted; a complete
  // answer always carries the array, so this is malformed rather than valid.
  const noArray = validateWith(sample(), () => ({ valid: true }));
  assert.equal(noArray.valid, false);
  assert.equal(noArray.issues[0].code, 'SELECTED_VALIDATOR_MALFORMED');
  assert.match(noArray.issues[0].message, /issues/);

  const inconsistent = validateWith(sample(), () => ({ valid: true, issues: [{ code: 'X', path: '', message: 'm' }] }));
  assert.equal(inconsistent.valid, false);

  for (const answer of [null, [], 'valid', 1, { issues: [] }]) {
    const result = validateWith(sample(), () => answer);
    assert.equal(result.valid, false, `${JSON.stringify(answer)} must not be accepted`);
    assert.equal(result.issues[0].code, 'SELECTED_VALIDATOR_MALFORMED');
  }
});

test('validateWith reports an asynchronous validator instead of treating the Promise as a verdict', () => {
  const result = validateWith(sample(), async () => accepting());
  assert.equal(result.valid, false);
  assert.equal(result.issues[0].code, 'SELECTED_VALIDATOR_MALFORMED');
  assert.match(result.issues[0].message, /Promise/);
});

test('validateWith rejects a malformed issue instead of passing it through', () => {
  const cases = [[null], [{ path: '', message: 'm' }], [{ code: 'X', message: 'm' }], [{ code: 'X', path: '' }], ['nope']];
  for (const issues of cases) {
    const result = validateWith(sample(), () => ({ valid: false, issues }));
    assert.equal(result.valid, false, JSON.stringify(issues));
    assert.equal(result.issues[0].code, 'SELECTED_VALIDATOR_MALFORMED');
  }
});

test('describeDeclaration summarizes claims without claiming acceptance', () => {
  const info = describeDeclaration(sample());
  assert.equal(info.pluginId, 'acme-tools');
  assert.equal(info.schemaVersion, PROTOCOL_VERSION);
  assert.deepEqual(info.tools, ['acme_hello']);
  assert.deepEqual(info.services, []);
  assert.deepEqual(info.requiredCapabilities, [EFFECT_CAPABILITY, TOOL_TEMPLATE_CAPABILITY]);
  assert.deepEqual(info.optionalCapabilities, []);
  assert.match(info.note, /not host acceptance/);
  assert.deepEqual(describeDeclaration(sample()), info);
  // A malformed value is summarized, never thrown on.
  assert.doesNotThrow(() => describeDeclaration(null));
  assert.doesNotThrow(() => describeDeclaration({ resources: [null, 1], capabilities: {} }));
});

test('the kit does not import dsh-compat-spec or any sibling path', async () => {
  const { readdir, readFile } = await import('node:fs/promises');
  const srcDir = new URL('../src/', import.meta.url);
  const files = (await readdir(srcDir, { recursive: true })).filter((file) => file.endsWith('.js') || file.endsWith('.d.ts'));
  assert.ok(files.length >= 5);
  for (const file of files) {
    const text = await readFile(new URL(file, srcDir), 'utf8');
    // Prose may name the protocol owner; code must not import it.
    assert.doesNotMatch(text, /from\s+['"][^'"]*dsh-compat-spec|import\(\s*['"][^'"]*dsh-compat-spec/, `${file} imports dsh-compat-spec`);
    assert.doesNotMatch(text, /from\s+['"]\.\.\/\.\.\/|import\(\s*['"]\.\.\/\.\.\//, `${file} reaches outside this package`);
    assert.doesNotMatch(text, /\.cache\/upstream/, `${file} references the upstream cache`);
  }
});

test('validateWith accepts the real compat-spec validator when a path is supplied', async () => {
  const modulePath = process.env.DSH_COMPAT_SPEC;
  if (!modulePath) {
    // Opt-in integration check: no cross-repository dependency is baked in.
    assert.equal(modulePath, undefined);
    return;
  }
  const spec = await import(modulePath);
  const result = validateWith(sample(), spec.validateDeclaration);
  assert.equal(result.valid, true, JSON.stringify(result.issues));
  assert.ok(Array.isArray(result.issues));
  const broken = validateWith({ ...sample(), schemaVersion: '0.2.0' }, spec.validateDeclaration);
  assert.equal(broken.valid, false);
  assert.ok(broken.issues.length > 0);
});
