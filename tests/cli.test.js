import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import process from 'node:process';
import { test } from 'node:test';

const run = promisify(execFile);
const CLI = fileURLToPath(new URL('../src/cli.js', import.meta.url));

/**
 * Run the CLI in a child process. No shell, no wrapper: the assertions below
 * are about the exit code and the exact streams a user would see.
 */
async function cli(args, options = {}) {
  try {
    const { stdout, stderr } = await run(process.execPath, [CLI, ...args], { timeout: 20_000, encoding: 'utf8', ...options });
    return { code: 0, stdout, stderr };
  } catch (error) {
    return { code: error.code, stdout: error.stdout ?? '', stderr: error.stderr ?? '' };
  }
}

async function withTempParent(body) {
  const parent = await mkdtemp(join(tmpdir(), 'dsh-plugin-kit-cli-'));
  try {
    return await body(parent);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
}

/** Environment for a nested `node --test`: the runner's context must not leak. */
function childEnv() {
  return Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('NODE_TEST')));
}

/** Run the generated project's own test suite. */
async function generatedTest(cwd) {
  // Run the one generated test file directly: node:test still executes all three
  // assertions, without adding a nested test-runner subprocess under TasksMax.
  // This reduces process depth; it does not establish the prior timeout's cause.
  return run(process.execPath, ['test/plugin.test.js'], { cwd, timeout: 20_000, encoding: 'utf8', env: childEnv() })
    .then(({ stdout, stderr }) => ({ ok: true, output: `${stdout}${stderr}` }), (error) => ({
      ok: false,
      output: `${error.stdout ?? ''}${error.stderr ?? ''}\n${JSON.stringify({ code: error.code ?? null, signal: error.signal ?? null, killed: error.killed ?? false, message: error.message })}`,
    }));
}

test('help exits 0 and documents exactly the implemented commands', async () => {
  const result = await cli(['help']);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /dsh-plugin-kit scaffold <target>/);
  assert.match(result.stdout, /dsh-plugin-kit list-templates/);
  assert.match(result.stdout, /dsh-plugin-kit check \[declaration\.json\] --validator <module>/);
  assert.match(result.stdout, /never overwrites anything/);
  // `check` needs an explicit validator, and the usage text says so.
  assert.match(result.stdout, /REQUIRED\. File path or module specifier/);
  assert.match(result.stdout, /has no\s+built-in protocol rules/);
  assert.doesNotMatch(result.stdout, /serve|watch|install --/);
});

test('list-templates marks the deferred templates as deferred', async () => {
  const text = await cli(['list-templates']);
  assert.equal(text.code, 0);
  assert.match(text.stdout, /^host-tool {2}implemented {2}js {2}v0\.1\.0$/m);
  assert.match(text.stdout, /^host-tool-managed {2}implemented {2}js {2}v0\.1\.0$/m);
  assert.match(text.stdout, /^client {2}deferred/m);
  assert.match(text.stdout, /^combined {2}deferred/m);

  const json = await cli(['list-templates', '--json']);
  const parsed = JSON.parse(json.stdout);
  assert.deepEqual(Object.keys(parsed.templates), ['host-tool', 'host-tool-managed', 'host-tool-admitted']);
  assert.deepEqual(Object.keys(parsed.deferred).sort(), ['client', 'combined']);
});

test('the managed template is opt-in and needs an explicit kit specifier', async () => {
  await withTempParent(async (parent) => {
    // No `--kit-specifier`: refusal, exit 1, and the issue names the field.
    const refused = await cli([
      'scaffold', join(parent, 'acme-managed'),
      '--template', 'host-tool-managed',
      '--plugin-id', 'acme-managed',
      '--tool-name', 'acme_managed_hello',
      '--dry-run',
    ]);
    assert.equal(refused.code, 1, 'a managed scaffold without a kit specifier must fail');
    assert.match(refused.stderr, /error: kitSpecifier: /);
    assert.match(refused.stderr, /file:/);

    // A registry range is refused too: the kit publishes nothing, so a range
    // would name a version no registry serves.
    const ranged = await cli([
      'scaffold', join(parent, 'acme-ranged'),
      '--template', 'host-tool-managed',
      '--kit-specifier', '^0.0.0',
      '--dry-run',
    ]);
    assert.equal(ranged.code, 1);
    assert.match(ranged.stderr, /error: kitSpecifier: /);
  });
});

test('a valid kit specifier is recorded verbatim in package.json', async () => {
  await withTempParent(async (parent) => {
    const target = join(parent, 'acme-managed');
    const specifier = 'file:../dsh-plugin-kit';
    const result = await cli([
      'scaffold', target,
      '--template', 'host-tool-managed',
      '--plugin-id', 'acme-managed',
      '--tool-name', 'acme_managed_hello',
      '--kit-specifier', specifier,
    ]);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /template: host-tool-managed@0\.1\.0 \(js, implemented\)/);
    assert.match(result.stdout, /index\.js/);
    // The exact string the caller passed, not a normalized or derived path.
    assert.match(result.stdout, /kit specifier: file:\.\.\/dsh-plugin-kit/);

    const pkg = JSON.parse(await readFile(join(target, 'package.json'), 'utf8'));
    assert.equal(pkg.dependencies['dsh-plugin-kit'], specifier);
    // Host peers are unchanged by the managed variant.
    assert.deepEqual(pkg.peerDependencies, {
      '@deepseek-ai/cordis': '4.0.6-alpha.1',
      '@deepseek-ai/schemastery': '3.18.6-alpha.1',
      '@deepseek-ai/dsh-tools': '0.2.2-alpha.2',
    });
    assert.deepEqual(Object.keys(pkg.dependencies), ['dsh-plugin-kit']);

    // An absolute specifier is preserved as given, not rewritten.
    const absolute = join(parent, 'kit-checkout');
    const second = await cli([
      'scaffold', join(parent, 'acme-absolute'),
      '--template', 'host-tool-managed',
      '--kit-specifier', `file:${absolute}`,
      '--dry-run', '--json',
    ]);
    assert.equal(second.code, 0, second.stderr);
    const planned = JSON.parse(second.stdout);
    assert.equal(planned.plan.kitSpecifier, `file:${absolute}`);
  });
});

test('the default template refuses a kit specifier instead of ignoring it', async () => {
  await withTempParent(async (parent) => {
    const result = await cli([
      'scaffold', join(parent, 'acme-tools'),
      '--kit-specifier', 'file:../dsh-plugin-kit',
      '--dry-run',
    ]);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /error: kitSpecifier: kitSpecifier only applies to template "host-tool-managed"/);
    assert.equal(await readFile(join(parent, 'acme-tools', 'package.json'), 'utf8').catch(() => null), null);
  });
});

test('scaffold reports the plan, the files and the next command', async () => {
  await withTempParent(async (parent) => {
    const target = join(parent, 'acme-tools');
    const result = await cli(['scaffold', target, '--plugin-id', 'acme-tools', '--tool-name', 'acme_hello']);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /plugin id: acme-tools/);
    assert.match(result.stdout, /tool name: acme_hello/);
    assert.match(result.stdout, /wrote .*package\.json/);
    assert.match(result.stdout, /Next: cd .* && node --test/);
    // The generated metadata carries the reviewed pins, not a shared range.
    const pkg = JSON.parse(await readFile(join(target, 'package.json'), 'utf8'));
    assert.deepEqual(pkg.engines, { node: '>=24.9.0', dsh: '0.2.2-alpha.2' });
    assert.deepEqual(pkg.peerDependencies, {
      '@deepseek-ai/cordis': '4.0.6-alpha.1',
      '@deepseek-ai/schemastery': '3.18.6-alpha.1',
      '@deepseek-ai/dsh-tools': '0.2.2-alpha.2',
    });
    assert.equal(pkg.dsh.manifestVersion, undefined);
    assert.equal(pkg.license, undefined);
  });
});

test('scaffold --dry-run writes nothing but reports the plan', async () => {
  await withTempParent(async (parent) => {
    const target = join(parent, 'acme-tools');
    const json = await cli(['scaffold', target, '--dry-run', '--json']);
    assert.equal(json.code, 0, json.stderr);
    const parsed = JSON.parse(json.stdout);
    assert.equal(parsed.mode, 'dry-run');
    assert.equal(parsed.written.length, 7);
    assert.deepEqual(parsed.issues, []);
    await assert.rejects(readFile(target), /ENOENT/);

    // A dry run over an existing directory reports the plan and still writes
    // nothing, so options can be inspected before a real run.
    const text = await cli(['scaffold', target, '--dry-run']);
    assert.equal(text.code, 0, text.stderr);
    assert.match(text.stdout, /plugin id: acme-tools/);
    assert.match(text.stdout, /would write /);
    assert.doesNotMatch(text.stdout, /Next: cd/);
    await assert.rejects(readFile(join(target, 'package.json')), /ENOENT/);
  });
});

test('scaffold refuses an existing target with exit code 1', async () => {
  await withTempParent(async (parent) => {
    const target = join(parent, 'acme-tools');
    assert.equal((await cli(['scaffold', target])).code, 0);
    const before = await readFile(join(target, 'index.js'), 'utf8');
    const second = await cli(['scaffold', target]);
    assert.equal(second.code, 1);
    assert.match(second.stderr, /error: target: target already exists/);
    assert.match(second.stderr, /never overwrites/);
    assert.equal(await readFile(join(target, 'index.js'), 'utf8'), before);
  });
});

test('the JSON failure output names the write as non-transactional', async () => {
  await withTempParent(async (parent) => {
    const target = join(parent, 'acme-tools');
    assert.equal((await cli(['scaffold', target])).code, 0);
    const again = await cli(['scaffold', target, '--json']);
    assert.equal(again.code, 1);
    const parsed = JSON.parse(again.stdout);
    assert.equal(parsed.ok, false);
    assert.equal(parsed.transactional, false);
    assert.deepEqual(parsed.written, []);
    assert.equal(parsed.failed, null);
    assert.equal(parsed.targetCreated, false);
    assert.ok(parsed.issues.some((issue) => issue.field === 'target'));
  });
});

test('usage errors exit 2 without writing anything', async () => {
  const noTarget = await cli(['scaffold']);
  assert.equal(noTarget.code, 2);
  assert.match(noTarget.stderr, /scaffold requires a target directory/);

  const twoTargets = await cli(['scaffold', 'a', 'b']);
  assert.equal(twoTargets.code, 2);
  assert.match(twoTargets.stderr, /exactly one target directory/);

  const unknownFlag = await cli(['scaffold', 'x', '--nope']);
  assert.equal(unknownFlag.code, 2);
  assert.match(unknownFlag.stderr, /unknown option: --nope/);

  const missingValue = await cli(['scaffold', 'x', '--tool-name']);
  assert.equal(missingValue.code, 2);
  assert.match(missingValue.stderr, /--tool-name requires a value/);

  const unknownCommand = await cli(['build']);
  assert.equal(unknownCommand.code, 2);
  assert.match(unknownCommand.stderr, /unknown command: build/);
});

test('deferred templates fail loudly through the CLI', async () => {
  await withTempParent(async (parent) => {
    const result = await cli(['scaffold', join(parent, 'acme'), '--template', 'client']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /template "client" is deferred/);
    await assert.rejects(readFile(join(parent, 'acme')), /ENOENT/);
  });
});

test('check refuses to answer without an injected validator', async () => {
  await withTempParent(async (parent) => {
    const target = join(parent, 'acme-tools');
    assert.equal((await cli(['scaffold', target])).code, 0);

    // No validator: a usage error, not a silent "looks fine".
    const bare = await cli(['check', join(target, 'declaration.json')]);
    assert.equal(bare.code, 2);
    assert.match(bare.stderr, /check needs --validator <module> exporting validateDeclaration/);
    assert.match(bare.stderr, /implements no protocol rules of its own/);
    assert.equal(bare.stdout, '');

    // The default path is `declaration.json` in the cwd, still refused first.
    const implicit = await cli(['check'], { cwd: target });
    assert.equal(implicit.code, 2);
    assert.match(implicit.stderr, /--validator/);
  });
});

test('check reports only what the named validator says', async () => {
  await withTempParent(async (parent) => {
    const target = join(parent, 'acme-tools');
    assert.equal((await cli(['scaffold', target])).code, 0);

    // A validator stands in for the protocol owner: the CLI adds no rules.
    const acceptPath = join(parent, 'accept.js');
    await writeFile(acceptPath, 'export const validateDeclaration = () => ({ valid: true, issues: [] });\n');
    const ok = await cli(['check', join(target, 'declaration.json'), '--validator', acceptPath]);
    assert.equal(ok.code, 0, ok.stderr);
    assert.match(ok.stdout, /^ok: /);
    assert.match(ok.stdout, /plugin acme-tools@0\.1\.0 \(schema 0\.1\.0-draft\.1\)/);
    assert.match(ok.stdout, /tools: acme-tools_hello/);
    assert.match(ok.stdout, /required: cordis\.effect, ctx\.tools/);
    assert.match(ok.stdout, /verdict from .*accept\.js; not host acceptance, loading or execution evidence/);

    const rejectPath = join(parent, 'reject.js');
    await writeFile(rejectPath, [
      'export function validateDeclaration() {',
      "  return { valid: false, issues: [{ code: 'TYPE_MISMATCH', path: 'schemaVersion', message: 'unsupported version' }] };",
      '}',
      '',
    ].join('\n'));
    const bad = await cli(['check', join(target, 'declaration.json'), '--validator', rejectPath]);
    assert.equal(bad.code, 1);
    assert.match(bad.stderr, /schemaVersion: TYPE_MISMATCH: unsupported version/);
    assert.match(bad.stdout, /verdict from .*reject\.js/);

    const badJson = await cli(['check', join(target, 'declaration.json'), '--validator', rejectPath, '--json']);
    assert.equal(badJson.code, 1);
    const parsed = JSON.parse(badJson.stdout);
    assert.equal(parsed.valid, false);
    assert.equal(parsed.validator, rejectPath);
    assert.equal(parsed.issues[0].code, 'TYPE_MISMATCH');
  });
});

test('check rejects a module that exports no validator and a malformed verdict', async () => {
  await withTempParent(async (parent) => {
    const target = join(parent, 'acme-tools');
    assert.equal((await cli(['scaffold', target])).code, 0);
    const declaration = join(target, 'declaration.json');

    const useless = join(parent, 'useless.js');
    await writeFile(useless, 'export const somethingElse = 1;\n');
    const noExport = await cli(['check', declaration, '--validator', useless]);
    assert.equal(noExport.code, 2);
    assert.match(noExport.stderr, /does not export a validateDeclaration function/);

    // A verdict with no `issues` array is not an answer the CLI will report as ok.
    const malformed = join(parent, 'malformed.js');
    await writeFile(malformed, 'export const validateDeclaration = () => ({ valid: true });\n');
    const partial = await cli(['check', declaration, '--validator', malformed]);
    assert.equal(partial.code, 1);
    assert.match(partial.stderr, /SELECTED_VALIDATOR_MALFORMED/);

    const missingModule = await cli(['check', declaration, '--validator', join(parent, 'nope.js')]);
    assert.equal(missingModule.code, 2);
    assert.match(missingModule.stderr, /cannot load validator/);
  });
});

test('check reports unreadable and unparsable inputs with exit code 1', async () => {
  await withTempParent(async (parent) => {
    const target = join(parent, 'acme-tools');
    assert.equal((await cli(['scaffold', target])).code, 0);
    const acceptPath = join(parent, 'accept.js');
    await writeFile(acceptPath, 'export const validateDeclaration = () => ({ valid: true, issues: [] });\n');

    const invalid = join(target, 'broken.json');
    await writeFile(invalid, '{ not json');
    const unparsable = await cli(['check', invalid, '--validator', acceptPath]);
    assert.equal(unparsable.code, 1);
    assert.match(unparsable.stderr, /is not valid JSON/);

    const missing = await cli(['check', join(target, 'nope.json'), '--validator', acceptPath]);
    assert.equal(missing.code, 1);
    assert.match(missing.stderr, /cannot read/);
  });
});

test('the generated project test passes once the shared host packages resolve', async () => {
  await withTempParent(async (parent) => {
    const target = join(parent, 'acme-tools');
    assert.equal((await cli(['scaffold', target, '--plugin-id', 'acme-tools', '--tool-name', 'acme_hello'])).code, 0);

    // Build a throwaway node_modules in the temp parent with stub host
    // packages. This is NOT a host: it only proves the generated module is
    // syntactically valid, imports only the reviewed specifiers, and that the
    // generated static test passes. No DSH code runs here.
    //
    // Schemastery builds callable schemas (`Object.setPrototypeOf(schema,
    // Schema.prototype)` with a prototype derived from Function.prototype), so
    // the stub must do the same or the generated assertion is meaningless.
    const vendor = join(parent, 'node_modules', '@deepseek-ai');
    for (const [name, source] of Object.entries({
      schemastery: [
        'function makeSchema(options) {',
        '  const schema = function schema() {};',
        '  Object.assign(schema, options);',
        '  Object.setPrototypeOf(schema, makeSchema.prototype);',
        '  return schema;',
        '}',
        'makeSchema.prototype = Object.create(Function.prototype);',
        'const chained = makeSchema({',
        '  default: () => chained,',
        '  description: () => chained,',
        '  required: () => chained,',
        '});',
        'makeSchema.string = () => chained;',
        'makeSchema.object = (shape) => makeSchema({ shape });',
        'export default makeSchema;',
        '',
      ].join('\n'),
      'dsh-tools': "export const defineTool = (options) => options;\n",
      cordis: "export {};\n",
    })) {
      const directory = join(vendor, name);
      await mkdir(directory, { recursive: true });
      await writeFile(join(directory, 'package.json'), JSON.stringify({ name: `@deepseek-ai/${name}`, type: 'module', main: 'index.js', exports: { '.': './index.js' } }));
      await writeFile(join(directory, 'index.js'), source);
    }

    const generated = await generatedTest(target);
    assert.equal(generated.ok, true, generated.output);
    assert.match(generated.output, /pass 3/);
  });
});
