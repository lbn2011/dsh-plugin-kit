import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';

import { GENERATED_DEPENDENCIES, KIT_SPECIFIER_PREFIX } from '../src/protocol.js';
import { checkKitSpecifier, managedToolPackageJson } from '../src/manifest.js';
import { planScaffold, renderScaffold, resolveTemplate, writeScaffold } from '../src/scaffold.js';

const TEMPLATE_DIR = fileURLToPath(new URL('../templates/host-tool-managed', import.meta.url));
const HOST_TEMPLATE_DIR = fileURLToPath(new URL('../templates/host-tool', import.meta.url));

/** The operator example the checked-in copy was generated with (see its README). */
const REFERENCE_KIT_SPECIFIER = 'file:../dsh-plugin-kit';

/**
 * Ids used to produce the checked-in reference copy (see its README).
 *
 * `kitSpecifier` is a **portable operator example**, not a default: the
 * generator has no default value, and without this option the same call is
 * refused. See the "requires an explicit kit specifier" tests below.
 */
const REFERENCE_OPTIONS = {
  template: 'host-tool-managed',
  pluginId: 'sample-managed',
  packageName: 'sample-managed',
  toolName: 'sample_managed_hello',
  kitSpecifier: REFERENCE_KIT_SPECIFIER,
};

/** A throwaway parent directory inside the OS temp dir, never the repo. */
async function withTempParent(run) {
  const parent = await mkdtemp(join(tmpdir(), 'dsh-plugin-kit-managed-'));
  try {
    return await run(parent);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
}

async function listFiles(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) files.push(...(await listFiles(join(directory, entry.name), relative)));
    else files.push(relative);
  }
  return files.sort();
}

/** Code only: comments describe the host, so prose must not satisfy a check. */
function codeOnly(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//'))
    .join('\n');
}

function renderManaged(options = {}) {
  const planned = planScaffold({ target: '/nonexistent/managed-sample', ...REFERENCE_OPTIONS, ...options });
  assert.equal(planned.ok, true, JSON.stringify(planned.issues));
  return renderScaffold(planned.plan);
}

test('the checked-in managed reference matches the renderer byte for byte', async () => {
  const rendered = renderManaged();

  // `README.md` here is the directory's own explanation; the rendering's README
  // lives at `templates/host-tool-managed/generated-readme.md` instead.
  const onDisk = (await listFiles(TEMPLATE_DIR)).filter((path) => path !== 'README.md' && path !== 'generated-readme.md');
  assert.deepEqual(onDisk, [...rendered.keys()].filter((path) => path !== 'README.md').sort(), 'template directory and rendered file set differ');

  for (const [path, expected] of rendered) {
    if (path === 'README.md') {
      assert.equal(await readFile(join(TEMPLATE_DIR, 'generated-readme.md'), 'utf8'), expected, 'generated-readme.md differs from the rendering');
      continue;
    }
    const actual = await readFile(join(TEMPLATE_DIR, path), 'utf8');
    assert.equal(actual, expected, `${path} differs from its rendering; regenerate the reference copy or fix the renderer`);
  }
});

test('the managed reference README explains that it is a review copy', async () => {
  const readme = await readFile(join(TEMPLATE_DIR, 'README.md'), 'utf8');
  assert.match(readme, /review copy/i);
  assert.match(readme, /byte for byte/);
  assert.match(readme, /`host-tool-managed`/);
});

test('the managed index.js acquires its tool through the kit and returns the cleanup', () => {
  const index = renderManaged().get('index.js');

  // Exactly the three reviewed imports: two host packages and the kit entry.
  assert.match(index, /^import Schema from '@deepseek-ai\/schemastery';$/m);
  assert.match(index, /^import \{ defineTool \} from '@deepseek-ai\/dsh-tools';$/m);
  assert.match(index, /^import \{ registerManagedResource \} from 'dsh-plugin-kit\/managed-registration';$/m);
  assert.equal(index.match(/^import /gm)?.length, 3, 'the plugin must import nothing else');

  const code = codeOnly(index);
  // One registration, through one port, returning the host's exact disposer.
  assert.equal(code.match(/registerManagedResource\(/g)?.length, 1);
  assert.match(code, /register: \(\) =>\s+ctx\.tools\.register\(/);
  assert.match(code, /return \(\) => handle\.close\(\);$/m);
  // No test hooks, fault switches or observer registries in production code.
  // `\bfault\b`, not bare `fault`: the reviewed template calls
  // `Schema.string().default(...)`, and the plain substring also matches inside
  // "default", so the unanchored form rejected valid generated code.
  assert.doesNotMatch(code, /__test|\bfault\b|observer|Observer|_hooks|unregister/);
  assert.doesNotMatch(code, /dispose/);
  // Only fields the reviewed ToolDefinition/JSON-Schema subset allows.
  assert.doesNotMatch(index, /minLength|pattern|timeoutMs/);
});

/**
 * One-line stand-ins for the two host packages the emitted `index.js` imports,
 * used only by the emitted-module probe below. `dsh-plugin-kit` is **not**
 * doubled: the probe imports the kit's own `managed-registration`, so the close
 * path it exercises is the shipped one.
 */
const HOST_PACKAGE_DOUBLES = {
  'stub-schemastery.mjs': `export default {
  object: (shape) => Object.assign(function schema() {}, { shape }),
  string: () => ({ default: (value) => ({ default: value }) }),
};
`,
  'stub-dsh-tools.mjs': `export function defineTool(definition) {
  return definition;
}
`,
};

test('the emitted apply is non-constructible and its returned cleanup closes the kit handle', async () => {
  const rendered = renderManaged().get('index.js');

  // Source shape first: a `const` arrow, never a `function` declaration. A
  // `function` owns a `prototype`, and the reviewed loader treats exactly that
  // as "constructible": it calls `new apply(ctx, config)`, then reads only the
  // instance's `symbols.init` hook — so the cleanup `apply` returned is
  // discarded and the kit handle is never closed.
  const code = codeOnly(rendered);
  assert.match(code, /^export const apply = \(ctx, config\) => \{$/m);
  assert.doesNotMatch(code, /^export (async )?function apply\b/m);

  await withTempParent(async (parent) => {
    const kitUrl = new URL('../src/managed-registration.js', import.meta.url).href;
    const source = rendered
      .replace("from '@deepseek-ai/schemastery'", "from './stub-schemastery.mjs'")
      .replace("from '@deepseek-ai/dsh-tools'", "from './stub-dsh-tools.mjs'")
      .replace("from 'dsh-plugin-kit/managed-registration'", `from ${JSON.stringify(kitUrl)}`);
    // Every bare specifier must have been rewritten: a silently missed
    // replacement would leave this test importing something other than the
    // emitted module, and an unresolved bare import would fail for the wrong
    // reason.
    assert.equal(source.match(/^import /gm)?.length, 3);
    assert.doesNotMatch(source, /from '(?:@deepseek-ai\/|dsh-plugin-kit\/)/);

    for (const [name, content] of Object.entries(HOST_PACKAGE_DOUBLES)) {
      await writeFile(join(parent, name), content);
    }
    const entry = join(parent, 'index.mjs');
    await writeFile(entry, source);

    // Unit only: this imports the emitted text with stand-ins for the host
    // packages. It is not a loader run — no Cordis fiber, profile or registry
    // is involved, and it proves nothing about how a real host loads the file.
    const plugin = await import(pathToFileURL(entry).href);
    assert.equal(typeof plugin.apply, 'function');

    // Non-constructible, by the same predicate the reviewed loader uses: a
    // callback is a constructor when it owns a `prototype`.
    assert.equal(Object.hasOwn(plugin.apply, 'prototype'), false, 'apply must not own a prototype');
    assert.throws(() => Reflect.construct(plugin.apply, [{}, {}]), TypeError);

    const registered = [];
    const released = [];
    // The same plain stand-in for `ctx` the generated suite uses: `tools.register`
    // returns a native disposer and nothing else is read.
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

    // Called the way the plain-call path calls it: no `new`, no instance.
    const cleanup = plugin.apply(ctx, { greeting: 'Hi' });
    assert.equal(typeof cleanup, 'function', 'apply must return the cleanup');
    assert.deepEqual(registered.map((definition) => definition.name), [REFERENCE_OPTIONS.toolName]);
    assert.deepEqual(released, [], 'apply itself must not release anything');
    assert.equal(await registered[0].execute({ who: 'Ada' }), 'Hi, Ada!');

    // The returned cleanup, not an instance hook, is what closes the handle.
    await cleanup();
    await cleanup();
    assert.deepEqual(released, [REFERENCE_OPTIONS.toolName], 'the returned cleanup closes the kit handle exactly once');
  });
});

test('apply returns its cleanup and registers exactly one tool', () => {
  const index = renderManaged();
  // Same Cordis module contract as the default template.
  for (const name of ['name', 'generatedBy', 'version', 'inject', 'Config', 'apply']) {
    assert.match(index.get('index.js'), new RegExp(`^export const ${name}|^export (async )?function ${name}`, 'm'));
  }
  const declaration = JSON.parse(index.get('declaration.json'));
  assert.equal(declaration.resources.length, 1);
  assert.equal(declaration.resources[0].name, REFERENCE_OPTIONS.toolName);
});

test('the managed package.json records the operator kit in dependencies, not as a peer', () => {
  const pkg = JSON.parse(renderManaged().get('package.json'));

  // Host peers are exactly the same three pins as the default template, in both
  // sets: opting into kit-managed teardown does not change the host contract.
  assert.deepEqual(pkg.peerDependencies, GENERATED_DEPENDENCIES);
  assert.deepEqual(pkg.devDependencies, GENERATED_DEPENDENCIES);
  assert.equal(pkg.peerDependencies['dsh-plugin-kit'], undefined);
  assert.equal(pkg.devDependencies['dsh-plugin-kit'], undefined);
  // The kit is a solved dependency whose specifier is the operator's own
  // string, written verbatim: no 0.0.0 pin, no range, no normalization.
  assert.deepEqual(pkg.dependencies, { 'dsh-plugin-kit': REFERENCE_KIT_SPECIFIER });
  assert.deepEqual(Object.keys(pkg.dependencies), ['dsh-plugin-kit']);
  assert.equal(pkg.license, undefined);
  assert.doesNotMatch(JSON.stringify(pkg.dependencies), /[\^~]|\*|latest/);
});

test('the kit specifier is required for the managed template', () => {
  const planned = planScaffold({
    target: '/nonexistent/managed-sample',
    template: 'host-tool-managed',
    pluginId: 'sample-managed',
    packageName: 'sample-managed',
    toolName: 'sample_managed_hello',
  });
  assert.equal(planned.ok, false);
  assert.deepEqual(planned.issues.map((issue) => issue.field), ['kitSpecifier']);
  assert.match(planned.issues[0].message, /required/);
  assert.match(planned.issues[0].message, /file:/);
});

test('a missing, empty, ranged or control-character specifier is refused', () => {
  const refused = {
    missing: undefined,
    null: null,
    empty: '',
    whitespace: '   ',
    'no path after the prefix': KIT_SPECIFIER_PREFIX,
    'whitespace path': `${KIT_SPECIFIER_PREFIX}   `,
    'registry range': '^0.0.0',
    'exact version': '0.0.0',
    'bare specifier': 'dsh-plugin-kit',
    'workspace protocol': 'workspace:*',
    'html url': 'https://example.test/dsh-plugin-kit.tgz',
    'newline injection': `${KIT_SPECIFIER_PREFIX}../kit\nmalicious`,
    'tab': `${KIT_SPECIFIER_PREFIX}../\tkit`,
    'del character': `${KIT_SPECIFIER_PREFIX}../\u007fkit`,
    'carriage return': `${KIT_SPECIFIER_PREFIX}../kit\r`,
    'non-string': 42,
  };
  for (const [label, kitSpecifier] of Object.entries(refused)) {
    const planned = planScaffold({ ...REFERENCE_OPTIONS, target: '/nonexistent/managed-sample', kitSpecifier });
    assert.equal(planned.ok, false, `${label} must be refused`);
    assert.deepEqual(planned.issues.map((issue) => issue.field), ['kitSpecifier'], label);
    // The same value is refused by the validator used by the builders.
    assert.equal(checkKitSpecifier(kitSpecifier).length > 0, true, label);
  }
});

test('a valid specifier is accepted, preserved verbatim and never rewritten', () => {
  const accepted = [
    'file:../dsh-plugin-kit',
    'file:./kit',
    'file:/absolute/checkout/dsh-plugin-kit',
    'file:../nested dir/kit',
    'file:.../odd-but-accepted',
  ];
  for (const kitSpecifier of accepted) {
    const planned = planScaffold({ ...REFERENCE_OPTIONS, target: '/nonexistent/managed-sample', kitSpecifier });
    assert.equal(planned.ok, true, JSON.stringify(planned.issues));
    // The plan carries the exact string it was given.
    assert.equal(planned.plan.kitSpecifier, kitSpecifier);
    const pkg = JSON.parse(renderScaffold(planned.plan).get('package.json'));
    assert.deepEqual(pkg.dependencies, { 'dsh-plugin-kit': kitSpecifier });
  }
  assert.deepEqual(checkKitSpecifier(REFERENCE_KIT_SPECIFIER), []);
});

test('bypassing the planner does not yield a package.json without the kit dependency', () => {
  // A caller can hand-build a plan; the renderer must refuse rather than emit
  // an absent or invented dependency.
  const template = resolveTemplate('host-tool-managed');
  const handBuilt = {
    template,
    target: '/nonexistent/managed-sample',
    pluginId: 'sample-managed',
    packageName: 'sample-managed',
    toolName: 'sample_managed_hello',
    pluginVersion: '0.1.0',
  };
  assert.throws(() => renderScaffold(handBuilt), /template "host-tool-managed" requires kitSpecifier/);
  assert.throws(() => renderScaffold({ ...handBuilt, kitSpecifier: '0.0.0' }), /requires kitSpecifier/);
  assert.throws(() => renderScaffold({ ...handBuilt, kitSpecifier: '' }), /requires kitSpecifier/);
  assert.throws(() => renderScaffold({ ...handBuilt, kitSpecifier: 'file:' }), /requires kitSpecifier/);
});

test('the package.json builder refuses a missing or invalid specifier', () => {
  const input = { packageName: 'acme', pluginVersion: '0.1.0', description: 'acme' };
  assert.throws(() => managedToolPackageJson(input), TypeError);
  assert.throws(() => managedToolPackageJson({ ...input, kitSpecifier: '^1.0.0' }), TypeError);
  const pkg = managedToolPackageJson({ ...input, kitSpecifier: 'file:../dsh-plugin-kit' });
  assert.deepEqual(pkg.dependencies, { 'dsh-plugin-kit': 'file:../dsh-plugin-kit' });
  assert.deepEqual(pkg.peerDependencies, GENERATED_DEPENDENCIES);
  assert.deepEqual(pkg.devDependencies, GENERATED_DEPENDENCIES);
});

test('the default template refuses a kit specifier instead of ignoring it', () => {
  // Silently dropping the value would let a caller believe a dependency was
  // recorded in a project that declares none.
  const planned = planScaffold({ target: '/nonexistent/acme', pluginId: 'acme', kitSpecifier: REFERENCE_KIT_SPECIFIER });
  assert.equal(planned.ok, false);
  assert.deepEqual(planned.issues.map((issue) => issue.field), ['kitSpecifier']);
  assert.match(planned.issues[0].message, /only applies to template "host-tool-managed"/);
});

test('the generated README documents the operator-supplied dependency', () => {
  const readme = renderManaged().get('README.md');
  assert.match(readme, /dsh-plugin-kit/);
  // The recorded literal is shown, and described as the caller's own string.
  assert.match(readme, /"dsh-plugin-kit": "file:\.\.\/dsh-plugin-kit"/);
  assert.match(readme, /operator-supplied|operator passed/);
  assert.match(readme, /written verbatim and never rewritten, defaulted or completed/);
  // The generator states the negative: no environment, no sibling scan, no
  // resolution, no install.
  assert.match(readme, /reads no environment variable, scans no sibling directory, resolves no path/);
  // Relative-path semantics are spelled out, because the string stays relative.
  assert.match(readme, /relative\*\* to \*\*this\npackage directory|relative to \*\*this/);
  // Teardown limits are stated as limits, never as an ordering guarantee.
  assert.match(readme, /\*\*not\*\* the exclusive owner/);
  assert.match(readme, /concurrently/);
  assert.match(readme, /logged and swallowed/);
  assert.doesNotMatch(readme, /guarantee[sd]? (?:the )?order|ordered teardown/i);
});

test('no generated managed file invents a kit path of its own', () => {
  // Only the operator's exact literal may appear; nothing else may be derived,
  // discovered or hardcoded (an agent path, a sibling checkout, a node_modules
  // path). A bare `file:` prefix is allowed: the prose names the required shape.
  const banned = [/\/root\//, /\/www\//, /node_modules\/dsh-plugin-kit/, /build-checkout/, /vendor\/cordis/];
  for (const [path, content] of renderManaged()) {
    for (const pattern of banned) {
      assert.doesNotMatch(content, pattern, `${path} matches ${pattern}`);
    }
    // The token class excludes whitespace: generated prose such as
    // "must be a local file: path" is English, not a specifier, and a class that
    // accepted spaces parsed it as `file: path` and failed on valid output. A
    // `file:` followed by any path character is still captured in full and must
    // equal the operator's literal (or nothing but the bare prefix).
    for (const match of content.match(/file:[A-Za-z0-9._@/+-]*/g) ?? []) {
      const trimmed = match.trimEnd();
      assert.equal(
        trimmed === KIT_SPECIFIER_PREFIX || trimmed === REFERENCE_KIT_SPECIFIER,
        true,
        `${path} contains an unexpected specifier: ${JSON.stringify(match)}`,
      );
    }
  }
});

test('no generated managed file starts a process, reads the environment or registers globally', () => {
  const banned = [/child_process/, /node:http/, /globalThis\./, /process\.env/, /setInterval|setTimeout/, /require\(/];
  for (const [path, content] of renderManaged()) {
    for (const pattern of banned) {
      assert.doesNotMatch(content, pattern, `${path} matches ${pattern}`);
    }
  }
});

test('the default host-tool output is unchanged by the managed template', async () => {
  const planned = planScaffold({ target: '/nonexistent/acme', pluginId: 'acme', packageName: 'acme', toolName: 'acme_hello' });
  assert.equal(planned.ok, true, JSON.stringify(planned.issues));
  const rendered = renderScaffold(planned.plan);
  assert.deepEqual([...rendered.keys()], ['package.json', 'cordis.patch.yml', 'index.js', 'declaration.json', 'jsconfig.json', 'README.md', 'test/plugin.test.js']);

  const pkg = JSON.parse(rendered.get('package.json'));
  // Default output keeps the three host pins and adds no kit peer.
  assert.equal(pkg.peerDependencies['dsh-plugin-kit'], undefined);
  assert.equal(pkg.dependencies, undefined);
  // Default output never imports the kit: no runtime coupling for users who do
  // not opt in.
  assert.doesNotMatch(rendered.get('index.js'), /managed-registration|registerManagedResource/);
  assert.doesNotMatch(rendered.get('README.md'), /dsh-plugin-kit\/managed-registration/);
  assert.equal(await stat(join(HOST_TEMPLATE_DIR, 'index.js')).then((info) => info.isFile()), true);
});

test('the managed template resolves, describes itself and writes the same seven files', async () => {
  const template = resolveTemplate('host-tool-managed');
  assert.equal(template.id, 'host-tool-managed');
  assert.equal(template.status, 'implemented');
  assert.equal(template.language, 'js');
  assert.equal(template.referenceHost, resolveTemplate('host-tool').referenceHost);

  await withTempParent(async (parent) => {
    const target = join(parent, 'acme-managed');
    const dry = await writeScaffold({ ...REFERENCE_OPTIONS, target }, { dryRun: true });
    assert.equal(dry.ok, true, JSON.stringify(dry.issues));
    assert.equal(dry.written.length, 7);
    assert.equal(await stat(target).catch(() => null), null, 'a dry run must not create the target');

    const written = await writeScaffold({ ...REFERENCE_OPTIONS, target });
    assert.equal(written.ok, true, JSON.stringify(written.issues));
    assert.equal(written.written.length, 7);

    const onDisk = (await listFiles(target)).sort();
    assert.deepEqual(onDisk, [...renderManaged().keys()].sort());
    // A second write refuses rather than overwriting the managed project.
    const again = await writeScaffold({ ...REFERENCE_OPTIONS, target });
    assert.equal(again.ok, false);
    assert.match(again.issues.map((issue) => issue.message).join('\n'), /target already exists.*never overwrites/);
    assert.deepEqual(await listFiles(target).then((files) => files.sort()), onDisk);
  });
});
