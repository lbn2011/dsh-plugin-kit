/**
 * `host-tool-admitted` template tests: the generated module against a REAL
 * admission coordinator and a labelled mock host.
 *
 * ## What is real
 *
 * Three things, and they are the ones that carry the properties below:
 *
 * - `createAdmissionCoordinator()` from `../src/admission.js` — the claim table
 *   that decides whether the generated resource may be mounted now, and that
 *   keeps a claim held when a teardown failed.
 * - `createAdmissionProvider()` from `../src/admission-provider.js` — the plugin
 *   that publishes that exact coordinator as `pluginAdmission`, so
 *   `ctx.pluginAdmission` in the generated module is the caller's own table by
 *   identity, not a stand-in with the same shape.
 * - The emitted `index.js` itself, imported as a module with its two *host*
 *   imports rewritten to one-line stand-ins. Nothing about the admitted logic is
 *   re-implemented here: the file under test is the file the generator ships.
 *
 * ## What the host is here
 *
 * A FAKE host, labelled as one. `tools.register` is one closure returning a
 * native-style disposer; it is NOT the real Loader, not Cordis and not the
 * vendored adapter. No case below claims anything about how those behave. What
 * the fake pins is only what the generated module asks of a host: one
 * registration inside the activation, and the exact disposer that registration
 * returned being the thing handed to `defer`.
 *
 * ## Reference copy
 *
 * `templates/host-tool-admitted/` is a byte-for-byte review copy that may not
 * have been committed yet. The check for it skips, with a stated reason, while
 * the directory is absent, and becomes a real byte comparison the moment the
 * copy lands. Nothing else in this file depends on it.
 *
 * Run: node --test "tests/*.test.js"   (written, not run as part of this change)
 */
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';

import { GENERATED_DEPENDENCIES } from '../src/protocol.js';
import { ADMISSION_SERVICE, createAdmissionProvider } from '../src/admission-provider.js';
import { AdmissionConflictError, createAdmissionCoordinator } from '../src/admission.js';
import { ADMITTED_TOOL_SCOPE } from '../src/manifest.js';
import { planScaffold, renderScaffold, resolveTemplate } from '../src/scaffold.js';

const TEMPLATE_DIR = fileURLToPath(new URL('../templates/host-tool-admitted', import.meta.url));

/** The same operator example the managed reference copy uses. */
const REFERENCE_KIT_SPECIFIER = 'file:../dsh-plugin-kit';

/** Ids used for the rendering under test. */
const REFERENCE_OPTIONS = {
  template: 'host-tool-admitted',
  pluginId: 'sample-admitted',
  packageName: 'sample-admitted',
  toolName: 'sample_admitted_hello',
  kitSpecifier: REFERENCE_KIT_SPECIFIER,
};

/**
 * The claim the generated project declares, in full: `kind`, `name` and the
 * one scope constant the generator writes for both the tuple and the
 * declaration. Built here from the public constant so a change to either side
 * fails the equality assertions below instead of sliding past them.
 */
const DECLARED_CLAIM = Object.freeze({
  kind: 'tool',
  name: REFERENCE_OPTIONS.toolName,
  scope: ADMITTED_TOOL_SCOPE,
});

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
  const parent = await mkdtemp(join(tmpdir(), 'dsh-plugin-kit-admitted-'));
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

/**
 * Code with every string and template literal blanked.
 *
 * A message may legitimately NAME an API the code must not call — the emitted
 * `TypeError` text mentions `createAdmissionProvider` — so a check for "this
 * file builds no admission state" has to look at code only, not at the prose the
 * code carries. Comments are stripped first so prose cannot hide a call either.
 */
function codeSkeleton(source) {
  return codeOnly(source)
    .replace(/`(?:[^`\\]|\\.)*`/g, '``')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""');
}

function renderAdmitted(options = {}) {
  const planned = planScaffold({ target: '/nonexistent/admitted-sample', ...REFERENCE_OPTIONS, ...options });
  assert.equal(planned.ok, true, JSON.stringify(planned.issues));
  return renderScaffold(planned.plan);
}

/** The declared resource, read from the generated `declaration.json`. */
function declaredResource(files = renderAdmitted()) {
  const declaration = JSON.parse(files.get('declaration.json'));
  assert.equal(declaration.resources.length, 1, 'the admitted template declares exactly one resource');
  return declaration.resources[0];
}

/**
 * One-line stand-ins for the two *host* packages the emitted `index.js` imports.
 *
 * `dsh-plugin-kit/admission-provider` is deliberately NOT doubled: the probe
 * imports the kit's own module, so the service name the generated plugin injects
 * and the value it reads are the shipped ones.
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

const PROVIDER_URL = new URL('../src/admission-provider.js', import.meta.url).href;

/**
 * Write the emitted module into `parent` with its bare specifiers rewritten, and
 * import it. Every bare specifier must be replaced: a silently missed
 * substitution would mean the probe is not importing the emitted module at all.
 */
async function loadEmitted(parent) {
  const rendered = renderAdmitted().get('index.js');
  const source = rendered
    .replace("from '@deepseek-ai/schemastery'", "from './stub-schemastery.mjs'")
    .replace("from '@deepseek-ai/dsh-tools'", "from './stub-dsh-tools.mjs'")
    .replace("from 'dsh-plugin-kit/admission-provider'", `from ${JSON.stringify(PROVIDER_URL)}`);

  assert.equal(source.match(/^import /gm)?.length, 3, 'the generated module keeps exactly three imports');
  assert.doesNotMatch(source, /from '(?:@deepseek-ai\/|dsh-plugin-kit\/)/, 'a bare host or kit specifier survived rewriting');

  for (const [name, content] of Object.entries(HOST_PACKAGE_DOUBLES)) {
    await writeFile(join(parent, name), content);
  }
  const entry = join(parent, 'index.mjs');
  await writeFile(entry, source);
  return import(pathToFileURL(entry).href);
}

/**
 * A FAKE host for the emitted module: the real provider publishes the caller's
 * real coordinator, and `tools.register` is one closure per call.
 *
 * `calls` records the disposer *function objects* that actually ran, so a case
 * can assert identity rather than a name: the thing deferred must be the exact
 * function the host's `register` returned, not a wrapper around it.
 */
function mockHost(coordinator, options = {}) {
  const provided = new Map();
  createAdmissionProvider(coordinator).apply({
    provide(name, value) {
      provided.set(name, value);
      return () => {
        provided.delete(name);
      };
    },
  });

  const registrations = [];
  const calls = [];
  const ctx = {
    tools: {
      register(definition) {
        const disposer = () => {
          calls.push(disposer);
          if (options.teardownThrows !== undefined) throw options.teardownThrows;
        };
        registrations.push({ definition, disposer });
        return disposer;
      },
    },
    // The generated module reads this exact property name; the provider
    // published the coordinator under the same literal.
    pluginAdmission: provided.get(ADMISSION_SERVICE),
  };
  return { ctx, provided, registrations, calls };
}

/** Settle an attempt into a value or an error, a synchronous throw included. */
async function outcomeOf(run) {
  try {
    return await run();
  } catch (error) {
    return error;
  }
}

/** Walk an error's `cause`/`errors` chain looking for a match. Never throws. */
function findError(reason, predicate) {
  const queue = [reason];
  const seen = new Set();
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === null || typeof current !== 'object' || seen.has(current)) continue;
    seen.add(current);
    if (predicate(current)) return current;
    if (current.cause !== undefined) queue.push(current.cause);
    if (Array.isArray(current.errors)) queue.push(...current.errors);
  }
  return undefined;
}

test('the admitted template is a third implemented catalog entry and renders the same seven files', () => {
  const template = resolveTemplate('host-tool-admitted');
  assert.equal(template.id, 'host-tool-admitted');
  assert.equal(template.status, 'implemented');
  assert.equal(template.language, 'js');
  assert.equal(template.referenceHost, resolveTemplate('host-tool').referenceHost);
  // The description must name the service the generated code actually injects.
  assert.match(template.description, /pluginAdmission/);
  assert.match(template.description, /PENDING/);

  const files = renderAdmitted();
  // Map key order is the order the renderer happened to write each file in, which
  // is not a property worth pinning: compare sorted copies of BOTH sides so the
  // assertion still pins the exact set of seven paths.
  const paths = [...files.keys()].sort();
  assert.deepEqual(paths, [...RENDERED].sort(), 'the rendering is exactly the seven reference files');
  assert.equal(paths.length, RENDERED.length, 'exactly seven files: none extra and none missing');
});

test('the declared resource is the full claim tuple in the admission global scope', () => {
  const files = renderAdmitted();
  const resource = declaredResource(files);
  // The whole tuple, not just the name: a scope that disagreed with the claim
  // the activation reserves would make the declaration describe a different
  // resource than the one held.
  assert.deepEqual(resource, { kind: 'tool', name: REFERENCE_OPTIONS.toolName, scope: 'global' });
  assert.deepEqual(resource, { ...DECLARED_CLAIM });
  assert.deepEqual(Object.keys(resource).sort(), ['kind', 'name', 'scope']);
  assert.equal(ADMITTED_TOOL_SCOPE, 'global', 'the one constant both the tuple and the declaration use');

  const declaration = JSON.parse(files.get('declaration.json'));
  // Registering still needs the registry, and admission adds no capability the
  // generated code does not already require.
  assert.deepEqual(declaration.capabilities.required, ['cordis.effect', 'ctx.tools']);
  assert.deepEqual(declaration.capabilities.optional, []);

  // Every scope literal in the emitted source is that same constant.
  const scopes = [...files.get('index.js').matchAll(/scope: '([^']*)'/g)].map((match) => match[1]);
  assert.deepEqual(scopes, ['global'], 'the emitted claim names exactly one scope, and it is the declared one');
});

test('the emitted module imports only the two host packages and the kit service name', () => {
  const index = renderAdmitted().get('index.js');
  assert.match(index, /^import Schema from '@deepseek-ai\/schemastery';$/m);
  assert.match(index, /^import \{ defineTool \} from '@deepseek-ai\/dsh-tools';$/m);
  // The service *name*, never a coordinator builder: the operator owns the table.
  assert.match(index, /^import \{ ADMISSION_SERVICE \} from 'dsh-plugin-kit\/admission-provider';$/m);
  assert.equal(index.match(/^import /gm)?.length, 3, 'the plugin must import nothing else');

  const code = codeOnly(index);
  assert.match(code, /^export const inject = \['tools', ADMISSION_SERVICE\];$/m);
  // Both required capabilities, in the fixed order: registry first, service second.
  // Code only: the emitted refusal message names `createAdmissionProvider` as the
  // thing the operator must mount, which is not this file mounting it.
  assert.doesNotMatch(codeSkeleton(index), /createAdmissionCoordinator|createAdmissionProvider|createCleanupScope/);
  // No test hooks, fault switches or observer registries in production code.
  // `\bfault\b`, not bare `fault`: `Schema.string().default(...)` contains it.
  assert.doesNotMatch(code, /__test|\bfault\b|observer|[Oo]bserver|_hooks|process\.env|child_process|setInterval/);
});

test('the emitted apply is an async non-constructible arrow that returns the handle close', () => {
  const code = codeOnly(renderAdmitted().get('index.js'));
  // `const` arrow: a constructible callback is called with `new`, and the
  // cleanup it returns is discarded — the handle would never be closed.
  assert.match(code, /^export const apply = async \(ctx, config\) => \{$/m);
  assert.doesNotMatch(code, /^export (async )?function apply\b/m);
  // Admission is asynchronous: the registration happens after `apply` returns.
  assert.match(code, /await admission\.admit\(/);
  assert.match(code, /return \(\) => handle\.close\(\);$/m);
});

test('the service is checked before anything is registered, and its absence registers nothing', async () => {
  const code = codeOnly(renderAdmitted().get('index.js'));
  const guardAt = code.indexOf('ctx.pluginAdmission');
  const registerAt = code.indexOf('ctx.tools.register');
  assert.ok(guardAt !== -1, 'the emitted module reads ctx.pluginAdmission');
  assert.ok(registerAt !== -1, 'the emitted module registers a tool');
  assert.ok(guardAt < registerAt, 'the service guard must come before the registration it protects');
  assert.match(code, /TypeError\(/);
  assert.match(code, /nothing was registered/);

  await withTempParent(async (parent) => {
    const plugin = await loadEmitted(parent);
    const coordinator = createAdmissionCoordinator();

    // Every shape that is not the published service. `inject` guarantees a real
    // host never calls `apply` in these states; this is the direct-call path a
    // test or a hand-written composition can reach.
    const malformed = {
      'no service at all': undefined,
      'explicit null': null,
      'a number': 42,
      'a string': 'pluginAdmission',
      'an empty object': {},
      'admit is not callable': { admit: 'not a function' },
      'admit is null': { admit: null },
    };

    for (const [label, pluginAdmission] of Object.entries(malformed)) {
      const host = mockHost(coordinator);
      const ctx = { tools: host.ctx.tools, ...(pluginAdmission === undefined ? {} : { pluginAdmission }) };
      const error = await outcomeOf(() => plugin.apply(ctx, { greeting: 'Hello' }));
      assert.ok(error instanceof TypeError, `${label}: expected a TypeError, got ${String(error)}`);
      assert.match(error.message, /ctx\.pluginAdmission/);
      assert.match(error.message, /nothing was registered/);
      assert.equal(host.registrations.length, 0, `${label}: nothing may be registered`);
      assert.equal(host.calls.length, 0);
      assert.equal(coordinator.size, 0, `${label}: no claim may be taken`);
    }
  });
});

test('the emitted apply resolves to a cleanup and defers the host’s exact disposer', async () => {
  await withTempParent(async (parent) => {
    const plugin = await loadEmitted(parent);
    const coordinator = createAdmissionCoordinator();

    // The module's own contract, before any host is involved.
    assert.equal(typeof plugin.apply, 'function');
    assert.equal(Object.hasOwn(plugin.apply, 'prototype'), false, 'apply must not own a prototype');
    assert.throws(() => Reflect.construct(plugin.apply, [{}, {}]), TypeError);
    assert.deepEqual([...plugin.inject], ['tools', ADMISSION_SERVICE]);
    assert.equal(ADMISSION_SERVICE, 'pluginAdmission');

    const host = mockHost(coordinator);
    // The generated module reads `ctx.pluginAdmission`; the property it reads is
    // the exact coordinator the caller created, by identity.
    assert.equal(host.ctx.pluginAdmission, coordinator, 'the published service is the caller’s own coordinator');

    const pending = plugin.apply(host.ctx, { greeting: 'Hi' });
    assert.equal(typeof pending.then, 'function', 'apply is async, so its effect is a thenable');
    const cleanup = await pending;
    assert.equal(typeof cleanup, 'function', 'apply must resolve to the cleanup');
    assert.equal(coordinator.size, 1, 'the claim is held while the tool is mounted');

    assert.equal(host.registrations.length, 1, 'exactly one registration per activation');
    const [registration] = host.registrations;
    assert.equal(registration.definition.name, REFERENCE_OPTIONS.toolName);
    assert.deepEqual(host.calls, [], 'the activation itself must not run the disposer');
    assert.equal(await registration.definition.execute({ who: 'Ada' }), 'Hi, Ada!');

    assert.equal(typeof registration.disposer, 'function', 'register returned a native-style disposer');
    await cleanup();
    // Identity, not a name: what ran is the very function the host handed back.
    assert.equal(host.calls.length, 1, 'the disposer ran exactly once');
    assert.equal(host.calls[0], registration.disposer, 'the deferred cleanup is the host’s exact disposer');
    assert.equal(coordinator.size, 0, 'a clean close released the claim');
  });
});

test('the claim the coordinator holds equals the declared resource, tuple for tuple', async () => {
  await withTempParent(async (parent) => {
    const plugin = await loadEmitted(parent);
    const coordinator = createAdmissionCoordinator();
    const declared = declaredResource();
    assert.deepEqual(declared, { ...DECLARED_CLAIM });

    const host = mockHost(coordinator);
    const cleanup = await plugin.apply(host.ctx, { greeting: 'Hi' });
    assert.equal(coordinator.size, 1);

    // The strongest available statement that declared and reserved agree: the
    // coordinator refuses a reservation of the declared tuple *because it is
    // already held*, and names that same tuple back.
    const conflict = await outcomeOf(() => coordinator.reserve([{ ...declared }]));
    assert.ok(conflict instanceof AdmissionConflictError, `expected a conflict, got ${String(conflict)}`);
    assert.equal(conflict.code, 'ERR_ADMISSION_CONFLICT');
    assert.deepEqual(conflict.conflicts, [{ ...declared }]);
    assert.equal(coordinator.size, 1, 'a refused reservation changes nothing');

    // Same name, different scope: still free, so the conflict above was the
    // scope matching too — not a stubbed-out comparison.
    const otherScope = coordinator.reserve([{ ...declared, scope: 'plugin' }]);
    assert.equal(otherScope.state, 'reserved');
    otherScope.release();

    await cleanup();
    assert.equal(coordinator.size, 0);
  });
});

test('a second activation on the same shared coordinator conflicts and registers nothing', async () => {
  await withTempParent(async (parent) => {
    const plugin = await loadEmitted(parent);
    const coordinator = createAdmissionCoordinator();

    const first = mockHost(coordinator);
    const firstCleanup = await plugin.apply(first.ctx, { greeting: 'Hi' });
    assert.equal(first.registrations.length, 1);
    assert.equal(coordinator.size, 1);

    // A second host, sharing the one coordinator — the double activation the
    // claim table exists to prevent.
    const second = mockHost(coordinator);
    const error = await outcomeOf(() => plugin.apply(second.ctx, { greeting: 'Hi' }));
    assert.ok(error instanceof AdmissionConflictError, `expected a conflict, got ${String(error)}`);
    assert.deepEqual(error.conflicts, [{ ...DECLARED_CLAIM }]);
    assert.equal(second.registrations.length, 0, 'the loser never reached ctx.tools.register');
    assert.deepEqual(second.calls, []);
    assert.equal(first.registrations.length, 1, 'the winner stayed mounted');
    assert.deepEqual(first.calls, [], 'the conflict did not unwind the winner');
    assert.equal(coordinator.size, 1);

    await firstCleanup();
    assert.equal(first.calls.length, 1);
    assert.equal(coordinator.size, 0);
  });
});

test('a clean close releases the claim, and a retried close is inert', async () => {
  await withTempParent(async (parent) => {
    const plugin = await loadEmitted(parent);
    const coordinator = createAdmissionCoordinator();

    const host = mockHost(coordinator);
    const cleanup = await plugin.apply(host.ctx, { greeting: 'Hi' });

    const first = cleanup();
    assert.equal(typeof first.then, 'function', 'the cleanup returns the handle’s close promise');
    assert.equal(coordinator.size, 1, 'the claim is still held while the close is in flight');
    await first;
    assert.equal(coordinator.size, 0, 'a clean close released the claim');
    assert.equal(host.calls.length, 1);

    // The retry: same promise object, no second teardown, no state change.
    const again = cleanup();
    assert.equal(again, first, 'close() keeps handing back the one shared promise');
    await again;
    assert.equal(host.calls.length, 1, 'the retried close did not run the disposer again');
    assert.equal(coordinator.size, 0);

    // Because the close was clean, the tuple is admissible: a new activation of
    // the same claim is accepted rather than blocked.
    const retry = mockHost(coordinator);
    const retryCleanup = await plugin.apply(retry.ctx, { greeting: 'Hi' });
    assert.equal(retry.registrations.length, 1, 'the released claim admitted a new activation');
    assert.equal(coordinator.size, 1);
    await retryCleanup();
    assert.equal(retry.calls.length, 1);
    assert.equal(coordinator.size, 0);
  });
});

test('a stale close cannot release the claim a newer activation now holds', async () => {
  await withTempParent(async (parent) => {
    const plugin = await loadEmitted(parent);
    const coordinator = createAdmissionCoordinator();

    const firstHost = mockHost(coordinator);
    const staleCleanup = await plugin.apply(firstHost.ctx, { greeting: 'Hi' });
    await staleCleanup();
    assert.equal(coordinator.size, 0);

    // New generation: the same tuple, now owned by a second activation.
    const ownerHost = mockHost(coordinator);
    const ownerCleanup = await plugin.apply(ownerHost.ctx, { greeting: 'Hi' });
    assert.equal(coordinator.size, 1);
    const ownerDisposer = ownerHost.registrations[0].disposer;

    // The old cleanup is called again. It settles against its own, already
    // released record: it must not speak for the current owner.
    const stale = staleCleanup();
    await stale;
    assert.equal(coordinator.size, 1, 'the stale close did not release the newer claim');
    assert.deepEqual(ownerHost.calls, [], 'the stale close did not unwind the newer registration');
    assert.equal(firstHost.calls.length, 1, 'the stale close stayed inert for its own host too');

    // The newer activation is still the live owner and closes itself.
    await ownerCleanup();
    assert.equal(ownerHost.calls.length, 1);
    assert.equal(ownerHost.calls[0], ownerDisposer);
    assert.equal(coordinator.size, 0);
  });
});

test('a quarantined activation cannot remount', async () => {
  await withTempParent(async (parent) => {
    const plugin = await loadEmitted(parent);
    const coordinator = createAdmissionCoordinator();
    const boom = new Error('host teardown failed');

    // The host's disposer throws, so the close fails after the tool was
    // registered: the claims are quarantined rather than released.
    const brokenHost = mockHost(coordinator, { teardownThrows: boom });
    const cleanup = await plugin.apply(brokenHost.ctx, { greeting: 'Hi' });
    assert.equal(brokenHost.registrations.length, 1);
    assert.equal(coordinator.size, 1);

    const failure = await outcomeOf(() => cleanup());
    assert.ok(failure instanceof Error, 'close() rejects because a disposer threw');
    const scopeFailure = findError(failure, (error) => error instanceof AggregateError && Array.isArray(error.errors));
    assert.ok(scopeFailure, 'the cleanup scope reported the teardown failure');
    assert.equal(scopeFailure.code, 'ERR_CLEANUP_SCOPE_FAILED');
    assert.ok(findError(failure, (error) => error === boom), 'the host’s own thrown value is carried through');
    assert.equal(brokenHost.calls.length, 1, 'the disposer ran, and threw');
    assert.equal(coordinator.size, 1, 'a failed close keeps the claim');

    // Every remount is refused, not queued: the claim is held for the
    // coordinator's lifetime, and nothing generated here can clear it.
    for (const label of ['first remount', 'second remount']) {
      const remount = mockHost(coordinator);
      const error = await outcomeOf(() => plugin.apply(remount.ctx, { greeting: 'Hi' }));
      assert.ok(error instanceof AdmissionConflictError, `${label}: expected a conflict, got ${String(error)}`);
      assert.deepEqual(error.conflicts, [{ ...DECLARED_CLAIM }]);
      assert.equal(remount.registrations.length, 0, `${label}: nothing may be registered over a quarantined claim`);
      assert.equal(coordinator.size, 1, `${label}: the claim stays held`);
    }

    // A different claim on the same coordinator is unaffected: only the
    // quarantined tuple is unavailable.
    const lease = coordinator.reserve([{ kind: 'service', name: 'cache', scope: ADMITTED_TOOL_SCOPE }]);
    assert.equal(lease.state, 'reserved');
    lease.release();
    assert.equal(coordinator.size, 1);
  });
});

test('the admitted package.json records the operator kit, and the host pins are unchanged', () => {
  const pkg = JSON.parse(renderAdmitted().get('package.json'));

  // Same three host pins as the other two templates: admission changes where
  // the registration happens, not what the package requires.
  assert.deepEqual(pkg.peerDependencies, GENERATED_DEPENDENCIES);
  assert.deepEqual(pkg.devDependencies, GENERATED_DEPENDENCIES);
  assert.equal(pkg.peerDependencies['dsh-plugin-kit'], undefined);
  // The service is published by the operator's composition, so the provider is
  // not a dependency of the generated project: the kit is.
  assert.deepEqual(pkg.dependencies, { 'dsh-plugin-kit': REFERENCE_KIT_SPECIFIER });
  assert.deepEqual(Object.keys(pkg.dependencies), ['dsh-plugin-kit']);
  assert.doesNotMatch(JSON.stringify(pkg.dependencies), /[\^~]|\*|latest/);
  assert.deepEqual(pkg.engines, { node: '>=24.9.0', dsh: '0.2.2-alpha.2' });
});

test('no generated admitted file starts a process, reads the environment or invents a coordinator', () => {
  const banned = [/child_process/, /node:http/, /globalThis\./, /process\.env/, /setInterval|setTimeout/, /require\(/];
  const rendered = renderAdmitted();
  for (const [path, content] of rendered) {
    for (const pattern of banned) {
      assert.doesNotMatch(content, pattern, `${path} matches ${pattern}`);
    }
  }
  // The generated project must not carry admission state of its own. `index.js`
  // is the file that would: the README and the generated suite may *name* the
  // builder the operator mounts, which is why this reads code, not prose.
  assert.doesNotMatch(codeSkeleton(rendered.get('index.js')), /createAdmissionCoordinator\(|createAdmissionProvider\(|new Map\(/);
  // The only admission call the emitted module can make is `admit` on the
  // injected service; a hand-rolled reservation would bypass the coordinator.
  const calls = [...codeSkeleton(rendered.get('index.js')).matchAll(/(\w+)\.(admit|reserve)\(/g)].map((match) => `${match[1]}.${match[2]}`);
  assert.deepEqual(calls, ['admission.admit'], 'the emitted module admits through the injected service and nothing else');
});

test('the checked-in admitted reference matches the renderer byte for byte', async (t) => {
  const present = await stat(TEMPLATE_DIR).then((info) => info.isDirectory(), () => false);
  if (!present) {
    // The review copy is a separate deliverable; this file must not assert on a
    // directory that has not been committed yet, and must not create one.
    t.skip('templates/host-tool-admitted has not been committed yet; this check becomes a byte comparison once the review copy lands');
    return;
  }

  const rendered = renderAdmitted();
  // The review copy is the scaffold output itself, so the directory holds the
  // generated `README.md` — not an explanation of the directory. Nothing here is
  // renamed or mapped to another file: the seven paths on disk are the seven
  // rendered paths, compared as sorted sets.
  const onDisk = (await listFiles(TEMPLATE_DIR)).sort();
  assert.deepEqual(onDisk, [...rendered.keys()].sort(), 'template directory and rendered file set differ');

  for (const [path, expected] of rendered) {
    const actual = await readFile(join(TEMPLATE_DIR, path), 'utf8');
    assert.equal(actual, expected, `${path} differs from its rendering; regenerate the reference copy or fix the renderer`);
  }
});
