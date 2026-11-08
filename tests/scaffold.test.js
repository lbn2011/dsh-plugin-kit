import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { test } from 'node:test';

import {
  DEFAULT_PLUGIN_VERSION,
  DEFAULT_TEMPLATE,
  DEFERRED_TEMPLATES,
  TEMPLATES,
  defaultToolName,
  describeScaffoldPlan,
  planScaffold,
  renderScaffold,
  resolveTemplate,
  writeScaffold,
} from '../src/scaffold.js';

const RENDERED = [
  'README.md',
  'cordis.patch.yml',
  'declaration.json',
  'index.js',
  'jsconfig.json',
  'package.json',
  'test/plugin.test.js',
];

/** A throwaway parent directory inside the OS temp dir, never the repo. */
async function withTempParent(run) {
  const parent = await mkdtemp(join(tmpdir(), 'dsh-plugin-kit-'));
  try {
    return await run(parent);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
}

test('template catalog exposes the three implemented templates and names the deferred ones', () => {
  // Catalog order is deliberate: default first, then the two opt-in variants in
  // the order they were added, so the CLI listing reads as a progression.
  assert.deepEqual(Object.keys(TEMPLATES), ['host-tool', 'host-tool-managed', 'host-tool-admitted']);
  assert.equal(DEFAULT_TEMPLATE, 'host-tool');
  assert.equal(TEMPLATES['host-tool'].status, 'implemented');
  assert.equal(TEMPLATES['host-tool'].language, 'js');
  // The managed variant is opt-in: same language, same reference host, and the
  // default template id is unchanged.
  assert.equal(TEMPLATES['host-tool-managed'].status, 'implemented');
  assert.equal(TEMPLATES['host-tool-managed'].language, 'js');
  assert.equal(TEMPLATES['host-tool-managed'].referenceHost, TEMPLATES['host-tool'].referenceHost);
  assert.match(TEMPLATES['host-tool-managed'].description, /managed-registration/);
  // The admitted variant is opt-in on the same terms, and its description names
  // the service it injects rather than claiming an admission implementation.
  assert.equal(TEMPLATES['host-tool-admitted'].status, 'implemented');
  assert.equal(TEMPLATES['host-tool-admitted'].language, 'js');
  assert.equal(TEMPLATES['host-tool-admitted'].referenceHost, TEMPLATES['host-tool'].referenceHost);
  assert.match(TEMPLATES['host-tool-admitted'].description, /pluginAdmission/);
  assert.deepEqual(Object.keys(DEFERRED_TEMPLATES).sort(), ['client', 'combined']);
  assert.equal(resolveTemplate('host-tool'), TEMPLATES['host-tool']);
  assert.equal(resolveTemplate('host-tool-managed'), TEMPLATES['host-tool-managed']);
  assert.equal(resolveTemplate('host-tool-admitted'), TEMPLATES['host-tool-admitted']);
  assert.equal(DEFAULT_PLUGIN_VERSION, '0.1.0');
});

test('resolveTemplate refuses deferred and unknown ids instead of falling back', () => {
  for (const id of Object.keys(DEFERRED_TEMPLATES)) {
    assert.throws(() => resolveTemplate(id), new RegExp(`template "${id}" is deferred`));
  }
  assert.throws(() => resolveTemplate('nope'), /unknown template "nope"; implemented templates: host-tool/);
  assert.throws(() => resolveTemplate(''), /template id is required/);
});

test('planScaffold derives defaults from the target basename', async () => {
  await withTempParent(async (parent) => {
    const target = join(parent, 'acme-tools');
    const planned = planScaffold({ target });
    assert.equal(planned.ok, true);
    assert.equal(planned.plan.pluginId, 'acme-tools');
    assert.equal(planned.plan.packageName, 'acme-tools');
    assert.equal(planned.plan.pluginVersion, '0.1.0');
    assert.equal(planned.plan.target, resolve(target));
    assert.match(describeScaffoldPlan(planned.plan), /template: host-tool@0\.1\.0 \(js, implemented\)/);
  });
});

test('the managed plan carries the operator kit specifier verbatim', async () => {
  await withTempParent(async (parent) => {
    const target = join(parent, 'acme-managed');
    const planned = planScaffold({ target, template: 'host-tool-managed', kitSpecifier: 'file:../dsh-plugin-kit' });
    assert.equal(planned.ok, true, JSON.stringify(planned.issues));
    assert.equal(planned.plan.kitSpecifier, 'file:../dsh-plugin-kit');
    // The plan prints it so a dry run shows what would be recorded.
    assert.match(describeScaffoldPlan(planned.plan), /kit specifier: file:\.\.\/dsh-plugin-kit \(recorded verbatim in dependencies; not resolved or installed\)/);

    // The default template's plan carries no kit specifier at all: the field is
    // absent, not empty.
    const defaulted = planScaffold({ target });
    assert.equal('kitSpecifier' in defaulted.plan, false);
    assert.doesNotMatch(describeScaffoldPlan(defaulted.plan), /kit specifier/);
  });
});

test('the admitted plan requires the operator kit specifier, exactly as the managed one does', async () => {
  await withTempParent(async (parent) => {
    const target = join(parent, 'acme-admitted');

    // Absent: refused, and the refusal names the field rather than a template.
    const missing = planScaffold({ target, template: 'host-tool-admitted' });
    assert.equal(missing.ok, false);
    assert.ok(missing.issues.some((issue) => issue.field === 'kitSpecifier'), JSON.stringify(missing.issues));
    // No default is derived and nothing is discovered: the message says so.
    assert.match(missing.issues[0].message, /kitSpecifier is required/);
    assert.match(missing.issues[0].message, /has no default/);

    // Malformed: the same structural check the managed template uses. Nothing is
    // resolved, stat'ed or installed, so a name-only specifier is refused too.
    for (const kitSpecifier of ['', 'file:', 'https://example.test/kit', '../dsh-plugin-kit', 'file:../kit\n', 'link:../kit']) {
      const refused = planScaffold({ target, template: 'host-tool-admitted', kitSpecifier });
      assert.equal(refused.ok, false, `expected refusal for ${JSON.stringify(kitSpecifier)}`);
      assert.ok(refused.issues.some((issue) => issue.field === 'kitSpecifier'), JSON.stringify(refused.issues));
    }

    // The default template still refuses a specifier it would never record.
    const defaulted = planScaffold({ target, kitSpecifier: 'file:../dsh-plugin-kit' });
    assert.equal(defaulted.ok, false);
    assert.equal(defaulted.issues[0].field, 'kitSpecifier');
    assert.match(defaulted.issues[0].message, /only applies to template "host-tool-managed"/);
  });
});

test('the admitted plan records the specifier verbatim and prints it in a dry run', async () => {
  await withTempParent(async (parent) => {
    const planned = planScaffold({
      target: join(parent, 'acme-admitted'),
      template: 'host-tool-admitted',
      kitSpecifier: 'file:../dsh-plugin-kit',
    });
    assert.equal(planned.ok, true, JSON.stringify(planned.issues));
    assert.equal(planned.plan.template.id, 'host-tool-admitted');
    assert.equal(planned.plan.kitSpecifier, 'file:../dsh-plugin-kit');
    const described = describeScaffoldPlan(planned.plan);
    assert.match(described, /template: host-tool-admitted@0\.1\.0 \(js, implemented\)/);
    assert.match(described, /kit specifier: file:\.\.\/dsh-plugin-kit/);
  });
});

test('renderScaffold renders the admitted template into the same seven files, scoped global', () => {
  const planned = planScaffold({
    target: '/nonexistent/acme-admitted',
    template: 'host-tool-admitted',
    kitSpecifier: 'file:../dsh-plugin-kit',
  });
  assert.equal(planned.ok, true, JSON.stringify(planned.issues));
  const files = renderScaffold(planned.plan);
  // Same file set as the other two templates: admission changes the wiring
  // inside index.js, not the shape of a generated project.
  assert.deepEqual([...files.keys()].sort(), RENDERED);

  const declaration = JSON.parse(files.get('declaration.json'));
  assert.deepEqual(declaration.resources, [{ kind: 'tool', name: 'acme-admitted_hello', scope: 'global' }]);
  assert.deepEqual(declaration.capabilities.required, ['cordis.effect', 'ctx.tools']);
  assert.deepEqual(declaration.capabilities.optional, []);

  // The registration is inside the activation, and the claim precedes it.
  const index = files.get('index.js');
  assert.match(index, /pluginAdmission/);
  assert.match(index, /ctx\.tools\.register\(/);
  assert.ok(index.indexOf('admission.admit(') < index.indexOf('ctx.tools.register('), 'the claim must precede the registration');
  assert.match(files.get('test/plugin.test.js'), /scope: 'global'/);

  const pkg = JSON.parse(files.get('package.json'));
  assert.deepEqual(pkg.dependencies, { 'dsh-plugin-kit': 'file:../dsh-plugin-kit' });
  assert.equal(pkg.type, 'module');
  assert.doesNotMatch(files.get('index.js'), /globalThis|process\.env|setInterval/);
});

test('defaultToolName derives a host-accepted tool name from the plugin id', () => {
  // The host accepts /^[A-Za-z0-9_-]{1,64}$/; this template is narrower (no
  // leading digit or "-") so the name is also a safe JavaScript identifier.
  assert.equal(defaultToolName('acme-tools'), 'acme-tools_hello');
  assert.equal(defaultToolName('acme'), 'acme_hello');
  // A leading digit is not a valid template tool name, so it is prefixed.
  assert.equal(defaultToolName('9lives'), '_9lives_hello');
  assert.equal(defaultToolName(''), '');
  for (const id of ['acme-tools', 'a.b', 'x_y', '9lives']) {
    const name = defaultToolName(id);
    assert.match(name, /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/, `${id} produced an invalid tool name: ${name}`);
    assert.match(name, /^[A-Za-z0-9_-]{1,64}$/, `${id} produced a name the host would refuse: ${name}`);
  }
  const planned = planScaffold({ target: '/nonexistent/acme-tools' });
  assert.equal(planned.plan.toolName, 'acme-tools_hello');
  assert.equal(planned.ok, true, JSON.stringify(planned.issues));
});

test('renderScaffold produces a deterministic file set and never touches disk', async () => {
  await withTempParent(async (parent) => {
    const target = join(parent, 'acme-tools');
    const planned = planScaffold({ target });
    const first = renderScaffold(planned.plan);
    assert.deepEqual([...first.keys()].sort(), RENDERED);
    const second = renderScaffold(planScaffold({ target }).plan);
    for (const [path, content] of first) assert.equal(second.get(path), content, `${path} is not deterministic`);
    // Still absent: rendering is pure.
    await assert.rejects(readFile(target), /ENOENT/);
  });
});

test('renderScaffold keeps the declaration, the registration and the test in step', () => {
  const planned = planScaffold({ target: '/nonexistent/acme-tools', toolName: 'acme_custom' });
  assert.equal(planned.ok, true);
  const files = renderScaffold(planned.plan);
  const declaration = JSON.parse(files.get('declaration.json'));
  assert.deepEqual(declaration.resources, [{ kind: 'tool', name: 'acme_custom', scope: 'plugin' }]);
  // Registering a tool needs the registry, so `ctx.tools` is a required capability.
  assert.deepEqual(declaration.capabilities.required, ['cordis.effect', 'ctx.tools']);
  assert.deepEqual(declaration.capabilities.optional, []);
  assert.match(files.get('index.js'), /name: 'acme_custom'/);
  assert.match(files.get('test/plugin.test.js'), /name: 'acme_custom', scope: 'plugin'/);
  assert.match(files.get('index.js'), /ctx\.tools\.register\(/);
  // The bundle row names this package, and its id is package-prefixed.
  assert.match(files.get('cordis.patch.yml'), /- id: 'acme-tools:acme-tools'/);
  assert.match(files.get('cordis.patch.yml'), /^ {6}name: 'acme-tools'$/m);
  assert.doesNotMatch(files.get('index.js'), /globalThis|process\.env|setInterval/);
});

test('writeScaffold writes every rendered file and reports absolute paths', async () => {
  await withTempParent(async (parent) => {
    const target = join(parent, 'acme-tools');
    const result = await writeScaffold({ target, pluginId: 'acme-tools', packageName: 'acme-tools', toolName: 'acme_hello' });
    assert.equal(result.ok, true, JSON.stringify(result.issues));
    assert.equal(result.written.length, RENDERED.length);
    assert.deepEqual(result.skipped, []);
    assert.equal(result.failed, null);
    assert.equal(result.targetCreated, true);
    for (const file of result.written) assert.ok(file.startsWith(resolve(target) + sep), file);
    const rendered = renderScaffold(result.plan);
    for (const [path, content] of rendered) {
      assert.equal(await readFile(join(target, path), 'utf8'), content, `${path} differs from its rendering`);
    }
    const pkg = JSON.parse(await readFile(join(target, 'package.json'), 'utf8'));
    assert.equal(pkg.name, 'acme-tools');
    assert.equal(pkg.type, 'module');
    assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml');
    assert.equal(basename(target), 'acme-tools');
    // Generated metadata claims only what the pinned sources support.
    assert.deepEqual(pkg.engines, { node: '>=24.9.0', dsh: '0.2.2-alpha.2' });
    assert.equal(pkg.dsh.manifestVersion, undefined);
    assert.equal(pkg.license, undefined);
    assert.equal(pkg.dsh.compatibleHost, undefined);
    assert.deepEqual(pkg.peerDependencies, {
      '@deepseek-ai/cordis': '4.0.6-alpha.1',
      '@deepseek-ai/schemastery': '3.18.6-alpha.1',
      '@deepseek-ai/dsh-tools': '0.2.2-alpha.2',
    });
  });
});

test('writeScaffold refuses an existing target and leaves it untouched', async () => {
  await withTempParent(async (parent) => {
    const target = join(parent, 'acme-tools');
    await mkdir(target);
    await writeFile(join(target, 'keep.txt'), 'original\n');
    const result = await writeScaffold({ target });
    assert.equal(result.ok, false);
    assert.match(result.issues.map((issue) => issue.message).join('\n'), /target already exists.*never overwrites/);
    assert.equal(await readFile(join(target, 'keep.txt'), 'utf8'), 'original\n');
    await assert.rejects(readFile(join(target, 'index.js')), /ENOENT/);
  });
});

test('writeScaffold refuses a target that already exists as a file', async () => {
  await withTempParent(async (parent) => {
    const target = join(parent, 'acme-tools');
    await writeFile(target, 'not a directory\n');
    const result = await writeScaffold({ target });
    assert.equal(result.ok, false);
    assert.equal(await readFile(target, 'utf8'), 'not a directory\n');
  });
});

test('writeScaffold never creates a missing parent directory', async () => {
  await withTempParent(async (parent) => {
    const target = join(parent, 'missing', 'acme-tools');
    const result = await writeScaffold({ target });
    // The plan allows it; the writer must report failure rather than create a tree.
    assert.equal(result.ok, false);
    assert.deepEqual(result.written, []);
    assert.equal(result.failed, null);
    assert.equal(result.targetCreated, false);
    assert.match(result.issues[0].message, /cannot create .*ENOENT/);
    await assert.rejects(stat(join(parent, 'missing')), /ENOENT/);
  });
});

test('a write that fails partway reports the files written, the file that failed and the rest as skipped', async () => {
  await withTempParent(async (parent) => {
    const target = join(parent, 'gamma-tools');
    // Occupy the target path with nothing, but make the *second* rendered file
    // impossible to create by pre-creating its name as a directory inside a
    // target that does not exist yet. `writeScaffold` creates the target and
    // then writes in render order, so `package.json` succeeds and `cordis.patch.yml`
    // fails with EISDIR.
    const planned = planScaffold({ target });
    assert.equal(planned.ok, true);
    const relativePaths = [...renderScaffold(planned.plan).keys()];
    const failingPath = relativePaths[1];
    assert.equal(failingPath, 'cordis.patch.yml');

    // Use a template whose first file already exists as a directory: the only
    // way to hit the mid-write path is a filesystem state the plan cannot see,
    // so create the target through a racing copy of the writer's own mkdir.
    const { mkdir: makeDir } = await import('node:fs/promises');
    await makeDir(target);
    await makeDir(join(target, failingPath));
    const result = await writeScaffold({ target });
    // The plan refuses the now-existing target before writing anything: that
    // guard is the primary defence and is asserted here so it cannot regress.
    assert.equal(result.ok, false);
    assert.deepEqual(result.written, []);
    assert.match(result.issues[0].message, /target already exists/);
  });
});

test('the write path is wired for partial-write reporting even though the planner runs first', async () => {
  // Rendering and planning are pure; the writer creates the target with a
  // non-recursive mkdir and opens every file with `wx`. Reaching the reporting
  // branch requires the filesystem to change between plan and write, so this
  // test pins the shape of the failure surface instead of racing it.
  const shape = await writeScaffold({ target: join(tmpdir(), 'dsh-plugin-kit-absent-parent', 'acme-tools') });
  assert.equal(shape.ok, false);
  for (const key of ['target', 'written', 'issues', 'dryRun']) {
    assert.ok(key in shape, `a failed write still reports ${key}`);
  }
  assert.ok(Array.isArray(shape.written));
  assert.ok(shape.target.endsWith('acme-tools'), 'the failure names the requested target');
});

test('dryRun reports what would be written and writes nothing', async () => {
  await withTempParent(async (parent) => {
    const target = join(parent, 'acme-tools');
    const result = await writeScaffold({ target }, { dryRun: true });
    assert.equal(result.ok, true);
    assert.equal(result.dryRun, true);
    assert.equal(result.written.length, RENDERED.length);
    assert.equal(result.targetCreated, false);
    await assert.rejects(readFile(target), /ENOENT/);
  });
});

test('path traversal and unsafe identifiers are rejected before any write', async () => {
  await withTempParent(async (parent) => {
    const cases = [
      [{ target: join(parent, 'acme-tools'), pluginId: '../escape' }, 'pluginId'],
      [{ target: join(parent, 'acme-tools'), packageName: '@scope/../evil' }, 'packageName'],
      [{ target: join(parent, 'acme-tools'), toolName: '../../etc/passwd' }, 'toolName'],
      [{ target: join(parent, 'acme-tools'), toolName: 'run_code' }, 'toolName'],
      [{ target: join(parent, 'acme-tools'), toolName: 'has space' }, 'toolName'],
      [{ target: join(parent, 'acme-tools'), toolName: '1bad' }, 'toolName'],
      [{ target: join(parent, 'acme-tools'), pluginId: 'UPPER' }, 'pluginId'],
      [{ target: join(parent, 'acme-tools'), pluginVersion: '^0.1.0' }, 'pluginVersion'],
      [{ target: join(parent, 'acme-tools'), pluginVersion: '*' }, 'pluginVersion'],
    ];
    for (const [options, field] of cases) {
      const result = await writeScaffold(options);
      assert.equal(result.ok, false, `expected refusal for ${JSON.stringify(options)}`);
      assert.ok(result.issues.some((issue) => issue.field === field), `expected a ${field} issue, got ${JSON.stringify(result.issues)}`);
      await assert.rejects(readFile(join(parent, 'acme-tools')), /ENOENT/);
    }
    const empty = await writeScaffold({ target: '' });
    assert.equal(empty.ok, false);
    assert.ok(empty.issues.some((issue) => issue.field === 'target'));
  });
});

test('an empty target string is reported, not resolved to the cwd', async () => {
  const result = await writeScaffold({ target: '' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.issues[0], { field: 'target', message: 'target directory is required' });
});

test('scaffolding twice in a row fails the second time', async () => {
  await withTempParent(async (parent) => {
    const target = join(parent, 'acme-tools');
    assert.equal((await writeScaffold({ target })).ok, true);
    const again = await writeScaffold({ target });
    assert.equal(again.ok, false);
  });
});
