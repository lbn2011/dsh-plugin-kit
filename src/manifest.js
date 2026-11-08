/**
 * Generated-host source builders.
 *
 * Every function here returns strings. Nothing is imported into a host and
 * nothing is registered: the emitted source declares a plain Cordis plugin
 * (`name` / `inject` / `Config` / `apply`) and lets the host's native effects
 * own the registration's lifetime.
 *
 * @packageDocumentation
 */

// The service name is imported rather than retyped: a generated plugin's
// `inject` list and the provider that satisfies it must agree on one literal.
// `admission-provider.js` imports nothing, so this adds no cycle and no effect
// to the library graph.
import { ADMISSION_SERVICE } from './admission-provider.js';
import {
  CORDIS_PACKAGE,
  GENERATED_DEPENDENCIES,
  HOST_ENGINE,
  HOST_VERSION,
  KIT_PACKAGE,
  KIT_SPECIFIER_PREFIX,
  KIT_VERSION,
  NODE_ENGINE,
  PROTOCOL_VERSION,
  SCHEMASTER_PACKAGE,
  TOOLS_PACKAGE,
} from './protocol.js';

/** Characters a Cordis plugin id (`name`) may use, matching the official packages. */
const PLUGIN_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
/** Published and scoped npm package names, the same rule the launcher applies. */
const PACKAGE_NAME_PATTERN = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
/**
 * Tool names: the host's `tool.register` rule is
 * `/^[A-Za-z0-9_-]{1,64}$/`. This template is narrower (no leading digit or
 * dash) so a generated name is also a safe JavaScript identifier, and the
 * host's reserved `run_code` is rejected separately.
 */
const TOOL_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/;

/** Tool name reserved by the DSH host (PTC presentation transport). */
export const RESERVED_TOOL_NAMES = Object.freeze(['run_code']);

/**
 * Pure validation of author-supplied identifiers. Returns issues instead of
 * throwing so the CLI can report every problem at once.
 *
 * @param {{ pluginId?: unknown, packageName?: unknown, toolName?: unknown }} input
 * @returns {Array<{ field: string, message: string }>}
 */
export function checkScaffoldInputs({ pluginId, packageName, toolName } = {}) {
  const issues = [];
  const check = (field, value, pattern, hint) => {
    if (typeof value !== 'string' || value.length === 0) {
      issues.push({ field, message: `${field} is required.` });
      return;
    }
    if (!pattern.test(value)) issues.push({ field, message: `${field} must match ${pattern.source} (${hint}).` });
    if (/\.\.|^[./]|[\\\u0000-\u001f]/.test(value)) {
      issues.push({ field, message: `${field} must not contain path separators, NUL/control characters or "." segments.` });
    }
  };
  check('pluginId', pluginId, PLUGIN_ID_PATTERN, 'lowercase letters, digits, ".", "_" or "-", starting with a letter or digit');
  check('packageName', packageName, PACKAGE_NAME_PATTERN, 'an npm name, optionally scoped with "@scope/"');
  check('toolName', toolName, TOOL_NAME_PATTERN, '1-64 letters, digits, "_" or "-", not starting with a digit or "-"');
  if (typeof toolName === 'string' && RESERVED_TOOL_NAMES.includes(toolName)) {
    issues.push({ field: 'toolName', message: `toolName "${toolName}" is reserved by the DSH host.` });
  }
  return issues;
}

/**
 * Structural check of the operator-supplied kit specifier used by the opt-in
 * managed template. Returns issues instead of throwing so the CLI can report
 * every problem at once; {@link requireKitSpecifier} is the throwing form used
 * at each builder boundary, so a caller that bypasses `planScaffold` still
 * cannot emit a package.json with an absent or invented kit dependency.
 *
 * Only the shape is checked — the `file:` prefix, a non-empty path and no
 * control characters. The path is never resolved, stat'ed, installed or
 * compared against the filesystem, and there is no default: the value must
 * come from the operator.
 *
 * @param {unknown} kitSpecifier
 * @returns {Array<{ field: string, message: string }>}
 */
export function checkKitSpecifier(kitSpecifier) {
  const field = 'kitSpecifier';
  if (kitSpecifier === undefined || kitSpecifier === null) {
    return [{
      field,
      message: `kitSpecifier is required: pass the local kit as "${KIT_SPECIFIER_PREFIX}<operator path>". The generator has no default, discovers nothing and installs nothing.`,
    }];
  }
  if (typeof kitSpecifier !== 'string') {
    return [{ field, message: `kitSpecifier must be a string such as "${KIT_SPECIFIER_PREFIX}<operator path>".` }];
  }
  if (kitSpecifier.trim() === '') {
    return [{ field, message: `kitSpecifier must not be empty: pass "${KIT_SPECIFIER_PREFIX}<operator path>".` }];
  }
  if (/[\u0000-\u001f\u007f]/.test(kitSpecifier)) {
    return [{ field, message: 'kitSpecifier must not contain control characters.' }];
  }
  if (!kitSpecifier.startsWith(KIT_SPECIFIER_PREFIX)) {
    return [{
      field,
      message: `kitSpecifier must be a local "${KIT_SPECIFIER_PREFIX}" specifier, not a registry range: this kit publishes nothing, so a range would name a version no registry serves.`,
    }];
  }
  if (kitSpecifier.slice(KIT_SPECIFIER_PREFIX.length).trim() === '') {
    return [{
      field,
      message: `kitSpecifier must name a path after "${KIT_SPECIFIER_PREFIX}", e.g. "${KIT_SPECIFIER_PREFIX}../dsh-plugin-kit".`,
    }];
  }
  return [];
}

/**
 * Throwing form of {@link checkKitSpecifier}. Called by every managed builder so
 * the refusal happens at the point of emission, not only during planning.
 *
 * @param {string} builder Name used in the error, e.g. `managedToolPackageJson`
 * @param {unknown} kitSpecifier
 * @returns {string} The validated specifier, unchanged.
 */
function requireKitSpecifier(builder, kitSpecifier) {
  const [issue] = checkKitSpecifier(kitSpecifier);
  if (issue !== undefined) throw new TypeError(`${builder}: ${issue.message}`);
  return kitSpecifier;
}

/**
 * @param {{ packageName: string, pluginVersion: string, description: string }} input
 * @returns {object} package.json for a generated host-tool plugin.
 *
 * Facts about this object and what they are *not*:
 * - `engines.dsh` and each dependency pin the exact versions read from the
 *   pinned official sources; none of them is a tested compatibility range.
 * - The three host packages are both peers and dev dependencies so a
 *   standalone checkout resolves them for type checking; the host's copies are
 *   the ones used at runtime.
 * - `dsh.bundle.patch` is the reviewed official bundle field. Nothing else is
 *   invented: there is no host-compatibility field, no format version and no
 *   license field in generated metadata.
 */
export function hostToolPackageJson({ packageName, pluginVersion, description }) {
  const pins = { ...GENERATED_DEPENDENCIES };
  return {
    name: packageName,
    version: pluginVersion,
    private: true,
    type: 'module',
    description,
    engines: { node: NODE_ENGINE, dsh: HOST_ENGINE },
    dsh: { bundle: { patch: './cordis.patch.yml' } },
    peerDependencies: pins,
    devDependencies: { ...pins },
    scripts: { test: 'node --test' },
  };
}

/** @returns {string} cordis.patch.yml that inserts the plugin by package name. */
export function hostToolPatch({ packageName, pluginId }) {
  return [
    '# Bundle layer contributed by this package. The official launcher applies it',
    '# when the package is installed into a profile.',
    '#',
    '# The row id is prefixed with the package name (plus a colon) and the module',
    '# name is the installed package name, so Node resolution finds the entry',
    '# point instead of a relative source path. Row order carries no load',
    '# semantics; activation is service-availability driven.',
    '',
    '- insert:',
    `    - id: ${quoteYaml(`${packageName}:${pluginId}`)}`,
    `      name: ${quoteYaml(packageName)}`,
    '',
  ].join('\n');
}

/** Minimal YAML single-quote scalar. Safe for the names the CLI accepts. */
function quoteYaml(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * @param {{ pluginId: string, toolName: string, pluginVersion: string }} input
 * @returns {string} ESM plugin entry point (index.js).
 */
export function hostToolIndexJs({ pluginId, toolName, pluginVersion }) {
  return `/**
 * ${pluginId} — host-only DSH tool plugin.
 *
 * Generated by dsh-plugin-kit ${KIT_VERSION}. This is an ordinary Cordis plugin:
 * the loader calls \`apply\` once \`inject\`ed services are available, and the
 * registration below is owned by the native effect system.
 *
 * Written against the interfaces of @deepseek-ai/dsh ${HOST_VERSION} at
 * commit ce7073d51254c26cd63b22a60835b8f948deb447. This file has never been
 * loaded by that build or any other.
 */

import Schema from '${SCHEMASTER_PACKAGE}';
import { defineTool } from '${TOOLS_PACKAGE}';

export const name = '${pluginId}';
export const version = '${pluginVersion}';

/** Required service: the host's tool registry (\`ctx.tools\`). */
export const inject = ['tools'];

/**
 * Schemastery schema. \`Schema.object({...})\` returns a callable schema
 * function (its prototype derives from \`Function.prototype\`), which the loader
 * uses to validate \`config\` and fill the defaults below.
 */
export const Config = Schema.object({
  greeting: Schema.string().default('Hello'),
});

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {{ greeting: string }} config
 */
export function apply(ctx, config) {
  const greeting = config.greeting;

  // \`ctx.tools.register()\` returns the exact disposer and is registered as a
  // native effect: when this plugin's fiber is disposed, the host unregisters
  // the tool. No disposer is stored or reused here, so this module holds no
  // registration state of its own. Disposal order is the host's to decide.
  ctx.tools.register(
    defineTool({
      name: '${toolName}',
      description: 'Greet someone by name.',
      parameters: {
        who: { type: 'string', required: true, description: 'Name to greet' },
      },
      output: {
        schema: { type: 'string' },
        render: (_args, value) => [{ type: 'text', text: value }],
      },
      async execute(args) {
        return \`\${greeting}, \${args.who}!\`;
      },
    }),
  );
}
`;
}

/**
 * Generated test: static assertions about the emitted module, package and
 * declaration.
 *
 * The expected metadata is written as literals here rather than imported from
 * the kit, so a generated project checks itself without a dependency on the
 * generator. The file imports `../index.js`, which needs the three host
 * packages to be resolvable; the generator does not install them, and nothing
 * here exercises a running host.
 *
 * @param {{ pluginId: string, toolName: string, pluginVersion: string }} input
 */
export function hostToolTestJs({ pluginId, toolName, pluginVersion }) {
  const pins = JSON.stringify(GENERATED_DEPENDENCIES, null, 2);
  return `import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const plugin = await import('../index.js');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const declaration = JSON.parse(readFileSync(new URL('../declaration.json', import.meta.url), 'utf8'));

test('module exports the Cordis plugin contract', () => {
  assert.equal(plugin.name, '${pluginId}');
  assert.equal(plugin.version, '${pluginVersion}');
  assert.deepEqual([...plugin.inject], ['tools']);
  assert.equal(typeof plugin.apply, 'function');
  // \`Schema.object({...})\` returns a callable schema (Schemastery creates it as
  // a function whose prototype is Function.prototype), not a plain object.
  assert.equal(typeof plugin.Config, 'function');
  assert.equal(Object.getPrototypeOf(plugin.Config) !== Object.prototype, true);
  assert.equal(Object.getPrototypeOf(plugin.Config) instanceof Function, true);
  // Importing must not register anything: this test never calls apply().
});

test('package.json pins the reviewed host metadata', () => {
  // Version literals read from the pinned official sources (indent keeps them
  // out of this template literal's ${'$'} substitutions).
  const EXPECTED_PINS = ${pins};
  assert.equal(pkg.type, 'module');
  assert.equal(pkg.engines.node, '${NODE_ENGINE}');
  assert.equal(pkg.engines.dsh, '${HOST_ENGINE}');
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
  assert.equal(declaration.schemaVersion, '${PROTOCOL_VERSION}');
  assert.equal(declaration.plugin.id, '${pluginId}');
  assert.equal(declaration.plugin.version, pkg.version);
  assert.deepEqual(declaration.capabilities, { required: ['cordis.effect', 'ctx.tools'], optional: [] });
  assert.deepEqual(declaration.resources, [{ kind: 'tool', name: '${toolName}', scope: 'plugin' }]);
});
`;
}

/** @returns {string} README for the generated plugin. */
export function hostToolReadme({ pluginId, toolName, packageName }) {
  return `# ${packageName}

Host-only DSH tool plugin generated by \`dsh-plugin-kit\` ${KIT_VERSION}.
It exports an ordinary Cordis module — \`name\`, \`inject\`, \`Config\`, \`apply\` —
and registers one tool, \`${toolName}\`, into the host's \`ctx.tools\` registry.

Written against the interfaces of \`@deepseek-ai/dsh\` ${HOST_VERSION} at commit
\`ce7073d51254c26cd63b22a60835b8f948deb447\`. The version pins below are read
from those sources. This project has not been installed into a profile or
loaded by any host.

## Files

| File | Purpose |
|---|---|
| \`index.js\` | Plugin module: \`name\`, \`inject\`, \`Config\`, \`apply\`. |
| \`cordis.patch.yml\` | Bundle layer inserting plugin row \`${pluginId}\`. |
| \`declaration.json\` | Author declaration (\`${PROTOCOL_VERSION}\`); claims only, not host acceptance. |
| \`test/plugin.test.js\` | Static module/package/declaration checks; runs with \`node --test\`. |
| \`jsconfig.json\` | Editor/type-check hints for the shared peer packages. |

## Install into a profile (not executed by the generator)

\`\`\`sh
dsh plugin --profile <profile> add ./     # from this directory
dsh --profile <profile> --dump-config     # confirm the "${pluginId}" layer
dsh --profile <profile>                   # the ${toolName} tool is registered on boot
\`\`\`

Installing resolves the peer packages with the profile's package manager and
needs network access for them. None of these commands was run for this project.

## Limits

- No client/browser code: host-only template. A client template is deferred.
- The declaration is not checked by any host. Validate it with
  \`dsh-plugin-kit check <declaration.json> --validator <path-to-validateDeclaration.js>\`,
  which imports that trusted validator module; the kit implements no protocol
  rules itself.
- TypeScript, bundling, CI and publishing are not configured.
`;
}

/** @returns {string} jsconfig.json content (as text) for editor hints. */
export function hostToolJsConfig() {
  return `${JSON.stringify({ compilerOptions: { checkJs: false, module: 'nodenext', target: 'es2022', strict: false }, include: ['index.js', 'test/**/*.js'] }, null, 2)}\n`;
}

/** @returns {string} declaration.json content. */
export function hostToolDeclarationJson(declaration) {
  return `${JSON.stringify(declaration, null, 2)}\n`;
}

// ---------------------------------------------------------------------------
// Opt-in managed variant of the host-tool template
//
// Same host surface, same one tool, same bundle patch and declaration: the only
// differences are that the registration goes through
// `dsh-plugin-kit/managed-registration`, `apply` returns the cleanup, and
// package.json records the operator's own `file:` kit specifier in
// `dependencies`. Nothing here is layered under the `host-tool` template — that
// rendering is unchanged.
// ---------------------------------------------------------------------------

/**
 * @param {{ packageName: string, pluginVersion: string, description: string, kitSpecifier: string }} input
 * @returns {object} package.json for the opt-in managed host-tool variant.
 *
 * Identical to `hostToolPackageJson` except for one added entry:
 * `dependencies["dsh-plugin-kit"]` is the operator's `kitSpecifier`, written
 * verbatim. The three host pins stay peers *and* dev dependencies exactly as in
 * the default template, and the kit is not a peer or a dev dependency of this
 * project — it is the one solved dependency, supplied as a local path.
 *
 * The builder refuses (`TypeError`) when the specifier is absent, empty, not a
 * `file:` path or carries control characters: there is no default, no
 * environment lookup and no sibling scan, and the path is never resolved here.
 * A relative path stays relative in the emitted file, so a package manager
 * interprets it against this package's own directory.
 */
export function managedToolPackageJson(input) {
  return packageJsonWithKitDependency('managedToolPackageJson', input);
}

/**
 * package.json for the admitted variant.
 *
 * Identical to the managed variant's: the admission service is not a dependency
 * of the generated project. The provider is mounted by the operator's own
 * composition, so recording anything more here would claim an install step this
 * template does not perform.
 *
 * @param {{ packageName: string, pluginVersion: string, description: string, kitSpecifier: string }} input
 * @returns {object} package.json with one solved kit dependency.
 */
export function admittedToolPackageJson(input) {
  return packageJsonWithKitDependency('admittedToolPackageJson', input);
}

/**
 * Shared body of the kit-dependent package.json builders.
 *
 * The two opt-in templates (`host-tool-managed` and `host-tool-admitted`) both
 * record the operator's own `file:` specifier in
 * `dependencies["dsh-plugin-kit"]` and change nothing else, so the shape is
 * written once. The builder name is threaded through so a refusal names the
 * function the caller actually invoked.
 *
 * @param {string} builder Name used in the refusal message.
 * @param {{ packageName: string, pluginVersion: string, description: string, kitSpecifier: string }} input
 * @returns {object} package.json with one solved kit dependency.
 */
function packageJsonWithKitDependency(builder, { packageName, pluginVersion, description, kitSpecifier }) {
  requireKitSpecifier(builder, kitSpecifier);
  const pins = { ...GENERATED_DEPENDENCIES };
  return {
    name: packageName,
    version: pluginVersion,
    private: true,
    type: 'module',
    description,
    engines: { node: NODE_ENGINE, dsh: HOST_ENGINE },
    dsh: { bundle: { patch: './cordis.patch.yml' } },
    peerDependencies: pins,
    devDependencies: { ...pins },
    dependencies: { [KIT_PACKAGE]: kitSpecifier },
    scripts: { test: 'node --test' },
  };
}

/**
 * @param {{ pluginId: string, toolName: string, pluginVersion: string }} input
 * @returns {string} ESM plugin entry point (index.js) for the managed variant.
 *
 * The library import is written exactly as published subpath syntax
 * (`${KIT_PACKAGE}/managed-registration`) with no sibling, absolute or
 * repository-relative path, so nothing here assumes where a checkout lives.
 */
export function managedToolIndexJs({ pluginId, toolName, pluginVersion }) {
  return `/**
 * ${pluginId} — host-only DSH tool plugin with kit-managed teardown.
 *
 * Generated by dsh-plugin-kit ${KIT_VERSION}. This is an ordinary Cordis plugin:
 * the loader calls \`apply\` once \`inject\`ed services are available, and \`apply\`
 * returns the cleanup for what it mounted.
 *
 * Unlike the \`host-tool\` template, the single tool is mounted through
 * \`${KIT_PACKAGE}/managed-registration\`, which keeps the host's own disposer and
 * unwinds it from \`close()\`. The kit is private and unpublished, so this import
 * resolves only where an operator provisioned it locally; see \`README.md\`.
 *
 * Written against the interfaces of @deepseek-ai/dsh ${HOST_VERSION} at
 * commit ce7073d51254c26cd63b22a60835b8f948deb447 and of
 * ${KIT_PACKAGE}/managed-registration at kit ${KIT_VERSION}. This file has never
 * been loaded by that build or any other.
 */

import Schema from '${SCHEMASTER_PACKAGE}';
import { defineTool } from '${TOOLS_PACKAGE}';
import { registerManagedResource } from '${KIT_PACKAGE}/managed-registration';

export const name = '${pluginId}';
/** Kit that generated this file, for provenance only. */
export const generatedBy = '${KIT_PACKAGE}@${KIT_VERSION}';

export const version = '${pluginVersion}';

/** Required service: the host's tool registry (\`ctx.tools\`). */
export const inject = ['tools'];

/**
 * Schemastery schema. \`Schema.object({...})\` returns a callable schema
 * function (its prototype derives from \`Function.prototype\`), which the loader
 * uses to validate \`config\` and fill the defaults below.
 */
export const Config = Schema.object({
  greeting: Schema.string().default('Hello'),
});

/**
 * Exported as a \`const\` arrow on purpose: this callback must not be
 * constructible.
 *
 * The loader resolves this module's \`apply\` unchanged, then asks whether the
 * callback is a constructor, defined in the reviewed source as "has a
 * \`prototype\`" (a plain function does, an arrow does not). A constructible
 * callback is invoked with \`new\`, and only the instance's \`symbols.init\` hook is
 * read afterwards, so a cleanup function *returned* from such a call is
 * discarded. An arrow takes the plain-call path instead, and the cleanup
 * returned below is what the loader collects as this plugin's disposer.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {{ greeting: string }} config
 */
export const apply = (ctx, config) => {
  const greeting = config.greeting;

  // The kit calls this port once, synchronously, and records the exact
  // disposer \`ctx.tools.register()\` returns. Teardown is what the returned
  // cleanup does; this module caches no registration state of its own.
  //
  // Limits, not guarantees: that same disposer is also a native effect of this
  // plugin's fiber, so the host owns it too, and the host disposes top-level
  // effects concurrently rather than in reverse order. Whichever path runs
  // first removes the tool and the other is a no-op. A rejection from
  // \`close()\` is logged and swallowed by the host, never retried, and \`close()\`
  // has no timeout. Nothing here decides host disposal order.
  const handle = registerManagedResource(
    {
      register: () =>
        ctx.tools.register(
          defineTool({
            name: '${toolName}',
            description: 'Greet someone by name.',
            parameters: {
              who: { type: 'string', required: true, description: 'Name to greet' },
            },
            output: {
              schema: { type: 'string' },
              render: (_args, value) => [{ type: 'text', text: value }],
            },
            async execute(args) {
              return \`\${greeting}, \${args.who}!\`;
            },
          }),
        ),
    },
    { label: '${pluginId}' },
  );

  return () => handle.close();
};
`;
}

/**
 * Generated test for the managed variant: the `host-tool` checks plus the
 * cleanup contract, exercised against a plain stand-in `ctx` rather than a host.
 *
 * The stand-in is not a Cordis context and proves nothing about loading into a
 * host; it only pins the module's own contract (one registration, one cleanup,
 * idempotent close). No fault switches or test-only exports are generated: the
 * module under test is the shipped module.
 *
 * @param {{ pluginId: string, toolName: string, pluginVersion: string, kitSpecifier: string }} input
 */
export function managedToolTestJs({ pluginId, toolName, pluginVersion, kitSpecifier }) {
  requireKitSpecifier('managedToolTestJs', kitSpecifier);
  const pins = JSON.stringify(GENERATED_DEPENDENCIES, null, 2);
  return `import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

// Importing \`../index.js\` resolves \`${KIT_PACKAGE}/managed-registration\`, so this
// suite needs that package resolvable, along with the three shared host
// packages. The kit is private and unpublished; this project records it in
// \`dependencies\` as the operator's local \`file:\` specifier, which must resolve
// from this directory. None of these tests starts a host.
const plugin = await import('../index.js');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const declaration = JSON.parse(readFileSync(new URL('../declaration.json', import.meta.url), 'utf8'));

test('module exports the Cordis plugin contract and nothing else', () => {
  // An exact export list: no test hooks, no fault switches, no extra surface.
  assert.deepEqual(Object.keys(plugin).sort(), ['Config', 'apply', 'generatedBy', 'inject', 'name', 'version']);
  assert.equal(plugin.name, '${pluginId}');
  assert.equal(plugin.version, '${pluginVersion}');
  assert.equal(plugin.generatedBy, '${KIT_PACKAGE}@${KIT_VERSION}');
  assert.deepEqual([...plugin.inject], ['tools']);
  assert.equal(typeof plugin.apply, 'function');
  // \`Schema.object({...})\` returns a callable schema (Schemastery creates it as
  // a function whose prototype is Function.prototype), not a plain object.
  assert.equal(typeof plugin.Config, 'function');
  assert.equal(Object.getPrototypeOf(plugin.Config) !== Object.prototype, true);
  assert.equal(Object.getPrototypeOf(plugin.Config) instanceof Function, true);
});

test('apply mounts one tool through the kit and returns its cleanup', async () => {
  const registered = [];
  const released = [];
  // A plain stand-in for \`ctx\`, not a Cordis context: \`tools.register\` returns a
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
  assert.deepEqual(registered.map((definition) => definition.name), ['${toolName}']);
  assert.deepEqual(released, [], 'apply itself must not release anything');

  await cleanup();
  await cleanup();
  // The kit closes its scope once: the host disposer runs exactly once even
  // though the returned cleanup was awaited twice.
  assert.deepEqual(released, ['${toolName}']);
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
  // out of this template literal's ${'$'} substitutions).
  const EXPECTED_PINS = ${pins};
  // The kit specifier is the operator's own string, recorded verbatim when this
  // project was generated. The generator invents none: no default, no
  // environment lookup, no sibling scan, no version guess.
  const EXPECTED_KIT_SPECIFIER = ${JSON.stringify(kitSpecifier)};
  assert.ok(EXPECTED_KIT_SPECIFIER.startsWith('${KIT_SPECIFIER_PREFIX}'), 'the recorded kit specifier must be a local file: path');
  assert.ok(EXPECTED_KIT_SPECIFIER.length > '${KIT_SPECIFIER_PREFIX}'.length, 'the recorded kit specifier must name a path');
  assert.equal(pkg.type, 'module');
  assert.equal(pkg.engines.node, '${NODE_ENGINE}');
  assert.equal(pkg.engines.dsh, '${HOST_ENGINE}');
  assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml');
  const root = new URL('../', import.meta.url);
  assert.equal(new URL(pkg.dsh.bundle.patch, root).pathname, new URL('cordis.patch.yml', root).pathname);
  assert.ok(existsSync(new URL(pkg.dsh.bundle.patch, root)), 'the patch file must exist next to package.json');
  // One exact version per host package; peers and dev dependencies agree, and
  // the managed variant changes neither set.
  assert.deepEqual(pkg.peerDependencies, EXPECTED_PINS);
  assert.deepEqual(pkg.devDependencies, EXPECTED_PINS);
  // The kit is a solved dependency, not a peer or a dev dependency: it is
  // supplied locally as a \`file:\` path, never from a registry.
  assert.equal(pkg.peerDependencies['${KIT_PACKAGE}'], undefined);
  assert.equal(pkg.devDependencies['${KIT_PACKAGE}'], undefined);
  assert.deepEqual(pkg.dependencies, { '${KIT_PACKAGE}': EXPECTED_KIT_SPECIFIER });
  assert.doesNotMatch(JSON.stringify(pkg.dependencies), /[\\^~]|\\*|latest/);
  assert.equal(pkg.dsh.manifestVersion, undefined);
  assert.equal(pkg.dsh.compatibleHost, undefined);
  assert.equal(pkg.license, undefined);
});

test('declaration.json claims exactly this tool, with every field explicit', () => {
  assert.equal(declaration.schemaVersion, '${PROTOCOL_VERSION}');
  assert.equal(declaration.plugin.id, '${pluginId}');
  assert.equal(declaration.plugin.version, pkg.version);
  assert.deepEqual(declaration.capabilities, { required: ['cordis.effect', 'ctx.tools'], optional: [] });
  assert.deepEqual(declaration.resources, [{ kind: 'tool', name: '${toolName}', scope: 'plugin' }]);
});
`;
}

/**
 * @param {{ pluginId: string, toolName: string, packageName: string, kitSpecifier: string }} input
 * @returns {string} README for a generated managed-variant plugin.
 */
export function managedToolReadme({ pluginId, toolName, packageName, kitSpecifier }) {
  requireKitSpecifier('managedToolReadme', kitSpecifier);
  return `# ${packageName}

Host-only DSH tool plugin generated by \`${KIT_PACKAGE}\` ${KIT_VERSION}, using the
opt-in \`host-tool-managed\` template. It exports an ordinary Cordis module —
\`name\`, \`inject\`, \`Config\`, \`apply\` — and mounts one tool, \`${toolName}\`, into the
host's \`ctx.tools\` registry through \`${KIT_PACKAGE}/managed-registration\`.

Written against the interfaces of \`@deepseek-ai/dsh\` ${HOST_VERSION} at commit
\`ce7073d51254c26cd63b22a60835b8f948deb447\` and of \`${KIT_PACKAGE}\` ${KIT_VERSION}. The
version pins below are read from those sources. This project has not been
installed into a profile or loaded by any host.

## What the kit does here

\`apply\` acquires one resource through the kit and returns its cleanup:

- the \`register\` port is called once, synchronously, and returns the exact
  disposer \`ctx.tools.register()\` produced;
- \`handle.close()\` runs that disposer, is idempotent (one shared promise), and
  has no timeout;
- an acquisition failure throws from \`registerManagedResource\` inside \`apply\`,
  after the kit rolls back what it already acquired, in reverse order.

\`apply\` is exported as a non-constructible arrow for that reason: the reviewed
loader invokes a *constructible* callback with \`new\` and then only calls the
instance's \`symbols.init\` hook, so a cleanup returned from a \`function apply\`
would never be collected. An arrow has no \`prototype\`, so the plain-call path
runs instead and the returned cleanup is registered as the plugin's disposer.

## The kit dependency is operator-supplied

\`package.json\` records \`${KIT_PACKAGE}\` in \`dependencies\` with exactly the
specifier the operator passed when this project was generated:

\`\`\`json
"${KIT_PACKAGE}": ${JSON.stringify(kitSpecifier)}
\`\`\`

It is written verbatim and never rewritten, defaulted or completed. The kit
publishes nothing, so a registry range would name a version no registry serves:
the generator requires a local \`file:\` path and refuses to run without one. It
reads no environment variable, scans no sibling directory, resolves no path and
installs, links or fetches nothing.

A relative path is interpreted by your package manager relative to **this
package directory**, not the directory the generator was run from, so it keeps
working when the workspace moves. An absolute path is recorded as given and
stops working when that location changes. To change the value, edit this one
field or re-run the generator into a fresh directory.

## Files

| File | Purpose |
|---|---|
| \`index.js\` | Plugin module: \`name\`, \`inject\`, \`Config\`, \`apply\`. |
| \`cordis.patch.yml\` | Bundle layer inserting plugin row \`${pluginId}\`. |
| \`declaration.json\` | Author declaration (\`${PROTOCOL_VERSION}\`); claims only, not host acceptance. |
| \`test/plugin.test.js\` | Static module/package/declaration checks; runs with \`node --test\`. |
| \`jsconfig.json\` | Editor/type-check hints for the shared peer packages. |

## Install into a profile (not executed by the generator)

\`\`\`sh
dsh plugin --profile <profile> add ./     # from this directory
dsh --profile <profile> --dump-config     # confirm the "${pluginId}" layer
dsh --profile <profile>                   # the ${toolName} tool is registered on boot
\`\`\`

\`npm test\` runs only once the three shared host packages and \`${KIT_PACKAGE}\`
resolve locally. None of these commands was run for this project.

## Teardown limits

- The cleanup \`apply\` returns is awaited when the plugin's fiber unloads, but it
  is **not** the exclusive owner of the unregister step: the same exact disposer
  is also a native effect owned by the host fiber.
- Top-level effects are disposed concurrently, so the order between this cleanup
  and the host's own effect is not guaranteed. Whichever runs first removes the
  tool; the other call is a no-op.
- Teardown failures are logged and swallowed by the host, so a rejected
  \`close()\` is not surfaced as a plugin-load error and is not retried.
- This section records limits of the reviewed sources. It is not a host ordering
  guarantee and was not measured against a running host.

## Limits

- No client/browser code: host-only template. A client template is deferred.
- The declaration is not checked by any host. Validate it with
  \`${KIT_PACKAGE} check <declaration.json> --validator <path-to-validateDeclaration.js>\`,
  which imports that trusted validator module; the kit implements no protocol
  rules itself.
- The recorded \`${KIT_PACKAGE}\` dependency must resolve locally; an install that
  only reaches a registry cannot satisfy it.
- TypeScript, bundling, CI and publishing are not configured.
`;
}

// ---------------------------------------------------------------------------
// host-tool-admitted
// ---------------------------------------------------------------------------

/**
 * Claim scope every `host-tool-admitted` artifact emits.
 *
 * One constant feeds the generated claim tuple *and* the generated
 * `declaration.json`, so a generated project cannot claim one scope and ask the
 * coordinator for another. The value is a label in the operator's claim table;
 * nothing in this kit matches it against a host-side scope object.
 */
export const ADMITTED_TOOL_SCOPE = 'global';

/**
 * Entry point for the `host-tool-admitted` template.
 *
 * The tool is registered inside an admission activation instead of directly:
 * the module awaits `ctx.pluginAdmission.admit(...)` and hands the host's own
 * disposer to `defer`, so a conflicting activation never reaches
 * `ctx.tools.register`. The service itself is owned by the operator; this
 * module imports only the service *name* and never creates a coordinator or a
 * provider.
 *
 * The callback is an `async` arrow on purpose. It must not be constructible (a
 * constructible `apply` is called with `new` and its returned cleanup is
 * discarded), and it must be async because admission is. Cordis handles that
 * combination: `_execute` sees a thenable effect, awaits it, and collects the
 * function it resolves to as the plugin's disposer.
 *
 * @param {{ pluginId: string, toolName: string, pluginVersion: string }} input
 * @returns {string} ESM plugin entry point (index.js) for the admitted variant.
 */
export function admittedToolIndexJs({ pluginId, toolName, pluginVersion }) {
  return `/**
 * ${pluginId} — host-only DSH tool plugin admitted by an operator-owned
 * coordinator.
 *
 * Generated by dsh-plugin-kit ${KIT_VERSION}. This is an ordinary Cordis plugin:
 * the loader calls \`apply\` once every \`inject\`ed service is available, and the
 * single tool is registered inside an admission activation rather than straight
 * from \`apply\`.
 *
 * The \`${ADMISSION_SERVICE}\` service is published by
 * \`${KIT_PACKAGE}/admission-provider\` from a coordinator the operator created and
 * kept. This package neither creates a coordinator nor mounts that provider: if
 * nothing in this plugin's scope provides the service, the loader keeps this
 * plugin PENDING and never calls \`apply\`.
 *
 * Written against the interfaces of @deepseek-ai/dsh ${HOST_VERSION} at
 * commit ce7073d51254c26cd63b22a60835b8f948deb447 and of
 * ${KIT_PACKAGE}/admission-provider at kit ${KIT_VERSION}. This file has never
 * been loaded by that build or any other.
 */

import Schema from '${SCHEMASTER_PACKAGE}';
import { defineTool } from '${TOOLS_PACKAGE}';
import { ADMISSION_SERVICE } from '${KIT_PACKAGE}/admission-provider';

export const name = '${pluginId}';
/** Kit that generated this file, for provenance only. */
export const generatedBy = '${KIT_PACKAGE}@${KIT_VERSION}';

export const version = '${pluginVersion}';

/**
 * Required services, in one fixed order: the host's tool registry
 * (\`ctx.tools\`) and the admission coordinator service.
 *
 * \`ADMISSION_SERVICE\` is imported from the kit's own subpath rather than spelled
 * out as a string literal, so the name this plugin injects is by construction
 * the literal the provider publishes.
 *
 * While no providing fiber offers it in this plugin's visibility scope, Cordis
 * leaves the plugin PENDING: \`apply\` does not run, nothing is registered, and no
 * coordinator is invented here. Inventing one would give this plugin a private
 * claim table — exactly the double activation the shared coordinator exists to
 * prevent.
 */
export const inject = ['tools', ADMISSION_SERVICE];

/**
 * Schemastery schema. \`Schema.object({...})\` returns a callable schema
 * function (its prototype derives from \`Function.prototype\`), which the loader
 * uses to validate \`config\` and fill the defaults below.
 */
export const Config = Schema.object({
  greeting: Schema.string().default('Hello'),
});

/**
 * Exported as an \`async\` \`const\` arrow on purpose.
 *
 * \`const\` arrow: the callback must not be constructible. The loader asks whether
 * \`apply\` has a \`prototype\`; a constructible callback is invoked with \`new\` and
 * only its instance's \`symbols.init\` hook is read afterwards, so a cleanup
 * function *returned* from such a call is discarded.
 *
 * \`async\`: the callback may register synchronously after the coordinator has
 * reserved the claim; the returned Promise still tracks activation settlement.
 * \`_execute\` awaits that thenable and collects the function it resolves to as
 * this plugin's disposer — but it is a different path from the synchronous
 * templates, and it is the reason this comment exists.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {{ greeting: string }} config
 * @returns {Promise<() => Promise<void>>} Cleanup closing the admission handle:
 * it runs the deferred disposer, then releases the claim.
 */
export const apply = async (ctx, config) => {
  const greeting = config.greeting;

  // Read the operator's service and check it before anything is registered.
  // \`inject\` guarantees the service exists when the loader calls \`apply\`, so
  // this is the direct-call path: a test or a hand-written composition that
  // calls \`apply\` itself gets a TypeError instead of a registration that no
  // claim covers.
  const admission = ctx.pluginAdmission;
  if (admission === null || typeof admission !== 'object' || typeof admission.admit !== 'function') {
    throw new TypeError(
      '${pluginId}: ctx.pluginAdmission must expose a callable admit method; '
        + 'nothing was registered. Provide that plugin from an operator-owned coordinator, or do not load this plugin.',
    );
  }

  // One claim, matching declaration.json exactly: same kind, same name, same
  // scope string. \`admit\` reserves it before the callback runs, so a conflicting
  // activation throws here and never registers anything.
  const handle = await admission.admit(
    [{ kind: 'tool', name: '${toolName}', scope: '${ADMITTED_TOOL_SCOPE}' }],
    ({ defer }) => {
      // The host's own disposer, deferred immediately after the acquisition it
      // undoes. \`defer\` is the only route this activation exposes: an effect
      // registered any other way would be invisible to the coordinator's rollback.
      const release = ctx.tools.register(
        defineTool({
          name: '${toolName}',
          description: 'Greet someone by name.',
          parameters: {
            who: { type: 'string', required: true, description: 'Name to greet' },
          },
          output: {
            schema: { type: 'string' },
            render: (_args, value) => [{ type: 'text', text: value }],
          },
          async execute(args) {
            return \`\${greeting}, \${args.who}!\`;
          },
        }),
      );
      defer(release);
    },
  );

  // \`close()\` runs the deferred disposer and then releases the claim, and
  // returns the same promise on every call. This is what the loader collects as
  // the plugin's disposer (see the \`async\` note above).
  return () => handle.close();
};
`;
}

/**
 * Generated test for the admitted variant: the static contract plus the
 * activation ordering, exercised against a plain stand-in `ctx` rather than a
 * host.
 *
 * The stand-in is not a Cordis context and proves nothing about loading into a
 * host; it pins the module's own contract — one claim admitted, registration
 * only inside the activation, the host disposer deferred, `close()` returned,
 * and a malformed service refused before anything is registered. No fault
 * switches or test-only exports are generated: the module under test is the
 * shipped module.
 *
 * @param {{ pluginId: string, toolName: string, pluginVersion: string, kitSpecifier: string }} input
 */
export function admittedToolTestJs({ pluginId, toolName, pluginVersion, kitSpecifier }) {
  requireKitSpecifier('admittedToolTestJs', kitSpecifier);
  const pins = JSON.stringify(GENERATED_DEPENDENCIES, null, 2);
  return `import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

import { ADMISSION_SERVICE } from '${KIT_PACKAGE}/admission-provider';

// Importing \`../index.js\` resolves \`${KIT_PACKAGE}/admission-provider\`, so this
// suite needs that package resolvable, along with the three shared host
// packages. The kit is private and unpublished; this project records it in
// \`dependencies\` as the operator's local \`file:\` specifier, which must resolve
// from this directory. None of these tests starts a host, and no coordinator is
// created here: the stand-in below is a plain object, not the kit's coordinator.
const plugin = await import('../index.js');
const source = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const declaration = JSON.parse(readFileSync(new URL('../declaration.json', import.meta.url), 'utf8'));

/** The one tuple this plugin claims, in the exact shape \`admit\` receives. */
const CLAIM = { kind: 'tool', name: '${toolName}', scope: '${ADMITTED_TOOL_SCOPE}' };

test('module exports the Cordis plugin contract and nothing else', () => {
  // An exact export list: no test hooks, no fault switches, no extra surface.
  assert.deepEqual(Object.keys(plugin).sort(), ['Config', 'apply', 'generatedBy', 'inject', 'name', 'version']);
  assert.equal(plugin.name, '${pluginId}');
  assert.equal(plugin.version, '${pluginVersion}');
  assert.equal(plugin.generatedBy, '${KIT_PACKAGE}@${KIT_VERSION}');
  assert.equal(typeof plugin.apply, 'function');
  // \`Schema.object({...})\` returns a callable schema (Schemastery creates it as
  // a function whose prototype is Function.prototype), not a plain object.
  assert.equal(typeof plugin.Config, 'function');
  assert.equal(Object.getPrototypeOf(plugin.Config) !== Object.prototype, true);
  assert.equal(Object.getPrototypeOf(plugin.Config) instanceof Function, true);
});

test('inject uses the imported service literal and no hand-written name', () => {
  assert.deepEqual([...plugin.inject], ['tools', ADMISSION_SERVICE]);
  assert.equal(ADMISSION_SERVICE, 'pluginAdmission');
  // The literal comes from the import, so plugin and provider cannot drift.
  assert.match(source, /import \\{ ADMISSION_SERVICE \\} from '${KIT_PACKAGE}\\/admission-provider';/);
  assert.match(source, /export const inject = \\['tools', ADMISSION_SERVICE\\];/);
});

test('the module creates no coordinator and mounts no provider of its own', () => {
  // Ownership is external: this file is a dependent, never a fallback.
  // Check call syntax, not descriptive names inside diagnostics.
  assert.doesNotMatch(source, /createAdmissionCoordinator\\s*\\(/);
  assert.doesNotMatch(source, /createAdmissionProvider\\s*\\(/);
  assert.doesNotMatch(source, /from '${KIT_PACKAGE}\\/admission';/);
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
  // A plain stand-in for \`ctx\`, not a Cordis context. \`admit\` is modelled on the
  // reviewed coordinator: claims first, callback second, deferred disposers run
  // by \`close()\`, one promise per handle.
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
  assert.deepEqual(registered.map((definition) => definition.name), ['${toolName}']);
  assert.deepEqual(released, [], 'apply must not release anything');

  // The registered tool keeps the reviewed defineTool contract.
  assert.equal(await registered[0].execute({ who: 'Ada' }), 'Hi, Ada!');
  assert.deepEqual(registered[0].output.render({}, 'Hi, Ada!'), [{ type: 'text', text: 'Hi, Ada!' }]);

  await cleanup();
  await cleanup();
  // \`close()\` returns the same promise on every call, so the disposer runs once.
  assert.deepEqual(released, ['${toolName}']);
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
  const EXPECTED_PINS = ${pins};
  // The kit specifier is the operator's own string, recorded verbatim when this
  // project was generated. The generator invents none: no default, no
  // environment lookup, no sibling scan, no version guess.
  const EXPECTED_KIT_SPECIFIER = ${JSON.stringify(kitSpecifier)};
  assert.ok(EXPECTED_KIT_SPECIFIER.startsWith('${KIT_SPECIFIER_PREFIX}'), 'the recorded kit specifier must be a local file: path');
  assert.ok(EXPECTED_KIT_SPECIFIER.length > '${KIT_SPECIFIER_PREFIX}'.length, 'the recorded kit specifier must name a path');
  assert.equal(pkg.type, 'module');
  assert.equal(pkg.engines.node, '${NODE_ENGINE}');
  assert.equal(pkg.engines.dsh, '${HOST_ENGINE}');
  assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml');
  const root = new URL('../', import.meta.url);
  assert.equal(new URL(pkg.dsh.bundle.patch, root).pathname, new URL('cordis.patch.yml', root).pathname);
  assert.ok(existsSync(new URL(pkg.dsh.bundle.patch, root)), 'the patch file must exist next to package.json');
  assert.deepEqual(pkg.peerDependencies, EXPECTED_PINS);
  assert.deepEqual(pkg.devDependencies, EXPECTED_PINS);
  assert.equal(pkg.peerDependencies['${KIT_PACKAGE}'], undefined);
  assert.equal(pkg.devDependencies['${KIT_PACKAGE}'], undefined);
  assert.deepEqual(pkg.dependencies, { '${KIT_PACKAGE}': EXPECTED_KIT_SPECIFIER });
  assert.doesNotMatch(JSON.stringify(pkg.dependencies), /[\\^~]|\\*|latest/);
});

test('declaration.json claims exactly what the activation claims', () => {
  assert.equal(declaration.schemaVersion, '${PROTOCOL_VERSION}');
  assert.equal(declaration.plugin.id, '${pluginId}');
  assert.equal(declaration.plugin.version, pkg.version);
  assert.deepEqual(declaration.capabilities, { required: ['cordis.effect', 'ctx.tools'], optional: [] });
  // Same kind, same name, same scope as the tuple in \`apply\`; the scope is a
  // declaration label, not a host-enforced boundary.
  assert.deepEqual(declaration.resources, [CLAIM]);
  assert.match(source, /scope: '${ADMITTED_TOOL_SCOPE}'/);
});
`;
}

/**
 * README for a generated admitted-variant plugin.
 *
 * It documents the ownership boundary the template depends on — one
 * operator-created coordinator, reused across remounts, in the same Cordis
 * domain, with no reset on reload — because none of that can be enforced from
 * inside a generated module.
 *
 * @param {{ pluginId: string, toolName: string, packageName: string, kitSpecifier: string }} input
 * @returns {string}
 */
export function admittedToolReadme({ pluginId, toolName, packageName, kitSpecifier }) {
  requireKitSpecifier('admittedToolReadme', kitSpecifier);
  return `# ${pluginId}

A host-only DSH tool plugin generated by \`${KIT_PACKAGE}\` from the
\`host-tool-admitted\` template. It registers one tool, \`${toolName}\`, and does so
only after an operator-owned admission coordinator has reserved the claim.

## What this template changes

The \`host-tool\` template registers the tool directly in \`apply\`. This template
asks the \`${ADMISSION_SERVICE}\` service first and registers inside the activation
callback, so a second activation of the same claim never reaches
\`ctx.tools.register\`:

\`\`\`text
apply
 └─ ctx.pluginAdmission.admit([{ kind: 'tool', name: '${toolName}', scope: '${ADMITTED_TOOL_SCOPE}' }], activate)
     ├─ the coordinator reserves the claim   (a conflict throws here, nothing registers)
     ├─ activate({ defer })
     │   └─ ctx.tools.register(defineTool(...)) → host disposer → defer(disposer)
     └─ handle → close() runs the deferred disposer, then releases the claim
\`\`\`

\`apply\` is \`async\` and resolves to \`() => handle.close()\`, which the loader
collects as this plugin's disposer.

## The service is owned outside this package

This plugin never creates what it depends on:

- it imports only \`ADMISSION_SERVICE\` (the name literal) from
  \`${KIT_PACKAGE}/admission-provider\`, so its \`inject\` list cannot drift from the
  name the provider publishes;
- \`createAdmissionCoordinator\` and \`createAdmissionProvider\` appear nowhere in
  \`index.js\`;
- while nothing provides \`${ADMISSION_SERVICE}\` in this plugin's visibility scope,
  Cordis keeps the plugin **PENDING**: \`apply\` is never called, nothing is
  registered, and no fallback coordinator is invented. A pending plugin is not an
  error state and not a retry loop; it is a plugin waiting for a service.

\`ctx.pluginAdmission\` is checked before the first registration, so a direct
\`apply\` call against a wrong service fails with a \`TypeError\` instead of
registering a tool that no claim covers.

## Composition: one coordinator, created and kept by the operator

The coordinator and its provider are **not** installed or mounted by this
package, and no generated file mounts them. The operator owns both:

\`\`\`js
// composition.mjs — the operator's own file. Not generated, not shipped here.
import { createAdmissionCoordinator } from '${KIT_PACKAGE}/admission';
import { createAdmissionProvider } from '${KIT_PACKAGE}/admission-provider';
import * as admitted from './${pluginId}/index.js';

// ONE coordinator for the process, created here and kept here. Creating a
// second one anywhere gives you a second, disjoint claim table.
export const coordinator = createAdmissionCoordinator();

// Composition sketch, not a DSH launcher: ctx must be an existing host context
// with the native tools service and a shared visibility scope already provided.
export function mountIntoExistingHost(ctx) {
  // The provider publishes exactly this coordinator as '${ADMISSION_SERVICE}'.
  ctx.plugin(createAdmissionProvider(coordinator));
  // Loaded in the provider's own visibility scope, so the service resolves.
  ctx.plugin(admitted, { greeting: 'Hello' });
  return ctx;
}
\`\`\`

Both obligations below are the caller's; this kit cannot check either:

1. **Reuse one coordinator across remounts.** Unloading this plugin closes its
   admission handle. Only successful cleanup releases its claim; failed cleanup
   leaves it quarantined. After a clean close, reloading against the *same*
   coordinator can succeed. Reloading it against a *fresh* coordinator would reserve
   the same claim in a table nobody else consults — the coordination would be
   silently absent, not restored.
2. **Same Cordis domain.** The service resolves only where the providing fiber
   provides it inside this plugin's isolation/visibility scope. Putting the
   provider behind \`ctx.isolate(...)\` while loading the dependent outside it
   leaves the dependent PENDING while the required service remains unavailable.

## No implicit reset or restart recovery

- The provider never resets, releases or quarantines anything. A provider unload
  unregisters the *service*, which is not a claim release; dependents that lose
  the service may release their own claims only after successful cleanup.
- A claim held by a failed cleanup is **quarantined on the retained coordinator**
  and stays unavailable for that coordinator's lifetime. Replacing the coordinator
  discards tracking, not external effects: do not use replacement as recovery or
  proof that cleanup succeeded.
- Nothing about the coordinator survives a process restart, and two processes
  never share one. A restart is not recovery from a held claim: on a fresh
  coordinator every claim is free again, whatever the previous process was doing.

## The claim and the declaration

\`declaration.json\` claims
\`{ "kind": "tool", "name": "${toolName}", "scope": "${ADMITTED_TOOL_SCOPE}" }\` — the
same tuple \`apply\` passes to \`admit\`, and the only scope this template emits.
The declaration is an author statement; no host checks it here.

## Kit dependency

\`package.json\` records the kit under \`dependencies\`, verbatim:

\`\`\`json
"${KIT_PACKAGE}": ${JSON.stringify(kitSpecifier)}
\`\`\`

It is never rewritten, defaulted or completed. The kit publishes nothing, so a
registry range would name a version no registry serves: the generator requires a
local \`file:\` path and refuses without one. A relative path is interpreted by
your package manager relative to **this package directory**.

## Files

| File | Purpose |
|---|---|
| \`index.js\` | Plugin module: \`name\`, \`inject\`, \`Config\`, \`async apply\`. |
| \`cordis.patch.yml\` | Bundle layer inserting plugin row \`${pluginId}\`. |
| \`declaration.json\` | Author declaration (\`${PROTOCOL_VERSION}\`); claims only, not host acceptance. |
| \`test/plugin.test.js\` | Static and stand-in checks; runs with \`node --test\`. |
| \`jsconfig.json\` | Editor/type-check hints for the shared peer packages. |

## Install into a profile (not executed by the generator)

\`\`\`sh
dsh plugin --profile <profile> add ./     # from this directory
dsh --profile <profile> --dump-config     # confirm the "${pluginId}" layer
dsh --profile <profile>                   # the ${toolName} tool is registered on boot
\`\`\`

Installing this plugin does **not** install the provider. Until an operator
mounts \`createAdmissionProvider(coordinator)\` in the same scope, the plugin stays
PENDING and the tool is never registered.

\`npm test\` runs only once the three shared host packages and \`${KIT_PACKAGE}\`
resolve locally. None of these commands was run for this project.

## Teardown limits

- \`close()\` runs the deferred disposer and then releases the claim. A failing
  disposer rejects \`close()\` and **quarantines** the claim: the coordinator keeps
  it unavailable rather than risking a second activation.
- \`close()\` returns the same promise on every call, so a repeated teardown is a
  no-op rather than a second release.
- Teardown failures are logged and swallowed by the host, so a rejected
  \`close()\` is not surfaced as a plugin-load error and is not retried.
- This section records limits of the reviewed sources. It is not a host ordering
  guarantee and was not measured against a running host.

## Limits

- No client/browser code: host-only template.
- \`apply\` is asynchronous, so the tool appears after \`apply\` resolves rather than
  during the synchronous load step. Anything that reads \`ctx.tools\` in that
  window sees no such tool; the reviewed sources make no ordering promise here.
- The recorded \`${KIT_PACKAGE}\` dependency must resolve locally; an install that
  only reaches a registry cannot satisfy it.
- TypeScript, bundling, CI and publishing are not configured.
`;
}
