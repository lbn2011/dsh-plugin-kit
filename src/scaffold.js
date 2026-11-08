/**
 * Scaffold generator: renders a template into a new directory.
 *
 * Safety rules (all enforced here, not by the CLI):
 * - the template id must be an exact, declared id;
 * - the target must not exist (the generator never merges, overwrites or
 *   deletes anything);
 * - every rendered path must resolve inside the target directory;
 * - a write that fails partway is reported with the files already written and
 *   the file that failed. The write is **not** transactional: the created
 *   directory and its partial contents are left in place for the author to
 *   inspect or remove, because deleting on failure could itself delete
 *   something the generator did not create.
 *
 * @packageDocumentation
 */

import { mkdir, open } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

import {
  ADMITTED_TOOL_SCOPE,
  admittedToolIndexJs,
  admittedToolPackageJson,
  admittedToolReadme,
  admittedToolTestJs,
  checkKitSpecifier,
  checkScaffoldInputs,
  hostToolDeclarationJson,
  hostToolIndexJs,
  hostToolJsConfig,
  hostToolPackageJson,
  hostToolPatch,
  hostToolReadme,
  hostToolTestJs,
  managedToolIndexJs,
  managedToolPackageJson,
  managedToolReadme,
  managedToolTestJs,
} from './manifest.js';
import { HOST_VERSION, KIT_VERSION, toolDeclaration } from './protocol.js';

/**
 * Declared template catalog. `host-tool` is the default; `host-tool-managed` and
 * `host-tool-admitted` are opt-in only, and both require an operator-supplied
 * kit specifier. `client` and `combined` are named as explicitly deferred so a
 * request fails loudly instead of producing a half-valid client scaffold.
 */
export const TEMPLATES = Object.freeze({
  'host-tool': Object.freeze({
    id: 'host-tool',
    version: '0.1.0',
    language: 'js',
    status: 'implemented',
    description: 'Host-only ESM tool plugin: name/inject/Config/apply, one defineTool registration, bundle patch, declaration, static test.',
    referenceHost: HOST_VERSION,
  }),
  'host-tool-managed': Object.freeze({
    id: 'host-tool-managed',
    version: '0.1.0',
    language: 'js',
    status: 'implemented',
    description: 'Opt-in variant of host-tool: the same single tool, mounted through dsh-plugin-kit/managed-registration, with apply returning the cleanup it owns. Requires an operator-supplied kitSpecifier: a local file: path recorded verbatim in dependencies.',
    referenceHost: HOST_VERSION,
  }),
  'host-tool-admitted': Object.freeze({
    id: 'host-tool-admitted',
    version: '0.1.0',
    language: 'js',
    status: 'implemented',
    description: 'Opt-in variant of host-tool: the same single tool, registered inside an activation of the externally owned pluginAdmission service (dsh-plugin-kit/admission-provider) instead of directly, so a second activation of the same claim never registers. The generated module creates no coordinator and mounts no provider; without one it stays PENDING. Requires an operator-supplied kitSpecifier: a local file: path recorded verbatim in dependencies.',
    referenceHost: HOST_VERSION,
  }),
});

/** Template ids that require an operator-supplied kit specifier. */
const KIT_DEPENDENT_TEMPLATES = Object.freeze(['host-tool-managed', 'host-tool-admitted']);

/** Whether a resolved template id records a kit dependency. */
function requiresKitSpecifier(templateId) {
  return KIT_DEPENDENT_TEMPLATES.includes(templateId);
}

/** Template ids that are intentionally not implemented in this release. */
export const DEFERRED_TEMPLATES = Object.freeze({
  'client': 'Deferred: no generated client code until the actual client registration signature and build artifacts are reviewed and smoke-tested against a real host.',
  'combined': 'Deferred: combined host+client templates depend on the client template landing first.',
});

/** The default template id. */
export const DEFAULT_TEMPLATE = 'host-tool';

/** Default plugin version written when the caller does not pass one. */
export const DEFAULT_PLUGIN_VERSION = '0.1.0';

/** Exact SemVer literal (no ranges, no build metadata). */
const SEMVER_LITERAL = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/** Throws for an unknown or deferred template id. */
export function resolveTemplate(id) {
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error('template id is required');
  }
  if (Object.hasOwn(DEFERRED_TEMPLATES, id)) {
    throw new Error(`template "${id}" is deferred: ${DEFERRED_TEMPLATES[id]}`);
  }
  if (!Object.hasOwn(TEMPLATES, id)) {
    throw new Error(`unknown template "${id}"; implemented templates: ${Object.keys(TEMPLATES).join(', ')}`);
  }
  return TEMPLATES[id];
}

/** Directory-name fallback used for pluginId and packageName. */
function baseNameOf(absoluteTarget) {
  return absoluteTarget === '' ? '' : absoluteTarget.split(sep).pop() ?? '';
}

/**
 * Default tool name derived from a plugin id.
 *
 * The host accepts `/^[A-Za-z0-9_-]{1,64}$/`, but this template is narrower so
 * the generated name is also a safe JavaScript identifier: it must not start
 * with a digit or a dash. Characters the host rejects are folded to `_`.
 *
 * @param {string} pluginId
 * @returns {string} A tool name, or '' when the id is empty.
 */
export function defaultToolName(pluginId) {
  if (typeof pluginId !== 'string' || pluginId === '') return '';
  const folded = pluginId.replace(/[^A-Za-z0-9_-]/g, '_');
  return `${/^[A-Za-z_]/.test(folded) ? folded : `_${folded}`}_hello`;
}

/**
 * Normalize scaffold options and report every validation issue.
 *
 * `kitSpecifier` is the operator's own local kit path for the opt-in managed
 * template. It is **required** there and refused for `host-tool`: there is no
 * default, nothing is read from the environment, no sibling directory is
 * scanned, the path is never stat'ed, and the default template gains no
 * dependency. A relative path is written verbatim and is interpreted by a
 * package manager relative to the generated package directory.
 *
 * @param {{ target: string, template?: string, pluginId?: string, packageName?: string,
 *   toolName?: string, pluginVersion?: string, kitSpecifier?: string }} options
 * @param {{ dryRun?: boolean }} [runtime] planning for a dry run does not fail
 *   on an existing target (the dry run writes nothing, so nothing can collide)
 * @returns {{ ok: boolean, issues: Array<{ field: string, message: string }>, plan?: object }}
 */
export function planScaffold(options = {}, runtime = {}) {
  const issues = [];
  const target = options.target;
  if (typeof target !== 'string' || target.trim() === '') {
    issues.push({ field: 'target', message: 'target directory is required' });
  }
  const templateId = options.template ?? DEFAULT_TEMPLATE;
  let template = null;
  try {
    template = resolveTemplate(templateId);
  } catch (error) {
    issues.push({ field: 'template', message: error.message });
  }
  if (template !== null) {
    if (requiresKitSpecifier(template.id)) {
      issues.push(...checkKitSpecifier(options.kitSpecifier));
    } else if (options.kitSpecifier !== undefined && options.kitSpecifier !== null) {
      // Never drop a value silently: a caller who passes one for the default
      // template would otherwise believe a kit dependency was recorded.
      issues.push({
        field: 'kitSpecifier',
        message: `kitSpecifier only applies to template "host-tool-managed" or "host-tool-admitted"; template "${template.id}" emits no kit dependency.`,
      });
    }
  }

  const absoluteTarget = typeof target === 'string' && target !== '' ? resolve(target) : '';
  const baseName = baseNameOf(absoluteTarget);
  const pluginId = options.pluginId ?? baseName;
  const packageName = options.packageName ?? baseName;
  const toolName = options.toolName ?? defaultToolName(pluginId);
  const pluginVersion = options.pluginVersion ?? DEFAULT_PLUGIN_VERSION;

  issues.push(...checkScaffoldInputs({ pluginId, packageName, toolName }));
  if (typeof pluginVersion !== 'string' || !SEMVER_LITERAL.test(pluginVersion)) {
    issues.push({ field: 'pluginVersion', message: 'pluginVersion must be an explicit SemVer literal such as 0.1.0 (no ranges).' });
  }
  if (absoluteTarget && existsSync(absoluteTarget) && !runtime.dryRun) {
    issues.push({ field: 'target', message: `target already exists: ${absoluteTarget} (the generator never overwrites)` });
  }
  if (issues.length > 0) return { ok: false, issues };

  const plan = {
    template,
    target: absoluteTarget,
    pluginId,
    packageName,
    toolName,
    pluginVersion,
  };
  if (requiresKitSpecifier(template.id)) plan.kitSpecifier = options.kitSpecifier;
  return { ok: true, issues: [], plan };
}

/**
 * The plan's kit specifier, revalidated at render time.
 *
 * `renderScaffold` is a public entry point: a caller can build a plan object by
 * hand instead of calling {@link planScaffold}. Skipping planning must not
 * degrade into emitting a package.json without the kit dependency, so the
 * renderer refuses instead of guessing.
 *
 * @param {object} plan
 * @returns {string} The validated, unchanged specifier.
 */
function requirePlanKitSpecifier(plan) {
  const [issue] = checkKitSpecifier(plan.kitSpecifier);
  if (issue !== undefined) {
    // The template id comes from the plan so the message names the template the
    // caller actually asked for, not a hard-coded one.
    throw new Error(`template "${plan.template?.id}" requires kitSpecifier: ${issue.message}`);
  }
  return plan.kitSpecifier;
}

/**
 * Render every file of a plan without touching the filesystem.
 *
 * Each implemented template has exactly one renderer and both write the same
 * seven files; a template without one is a refusal, never a partial scaffold.
 *
 * @param {object} plan Result of {@link planScaffold}
 * @returns {Map<string, string>} POSIX-relative path → file content
 */
export function renderScaffold(plan) {
  const template = plan.template;
  const renderers = {
    'host-tool': renderHostTool,
    'host-tool-managed': renderManagedHostTool,
    'host-tool-admitted': renderAdmittedHostTool,
  };
  if (!Object.hasOwn(renderers, template.id)) {
    throw new Error(`template "${template.id}" has no renderer`);
  }
  return renderers[template.id](plan);
}

/** Renderer for the default `host-tool` template. Output is unchanged by the managed variant. */
function renderHostTool(plan) {
  const { pluginId, packageName, toolName, pluginVersion } = plan;
  const files = new Map();
  files.set('package.json', `${JSON.stringify(hostToolPackageJson({
    packageName,
    pluginVersion,
    description: `Host-only DSH tool plugin (${toolName}) generated by dsh-plugin-kit.`,
  }), null, 2)}\n`);
  files.set('cordis.patch.yml', hostToolPatch({ packageName, pluginId }));
  files.set(
    'index.js',
    hostToolIndexJs({ pluginId, toolName, pluginVersion }).replace(
      'export const version =',
      `/** Kit that generated this file, for provenance only. */\nexport const generatedBy = 'dsh-plugin-kit@${KIT_VERSION}';\n\nexport const version =`,
    ),
  );
  files.set('declaration.json', hostToolDeclarationJson(toolDeclaration({ pluginId, pluginVersion, toolName })));
  files.set('jsconfig.json', hostToolJsConfig());
  files.set('README.md', hostToolReadme({ pluginId, toolName, packageName }));
  files.set('test/plugin.test.js', hostToolTestJs({ pluginId, toolName, pluginVersion }));
  return files;
}

/** Renderer for the opt-in `host-tool-managed` template. */
function renderManagedHostTool(plan) {
  const { pluginId, packageName, toolName, pluginVersion } = plan;
  // Validate here, not only during planning: a hand-built plan must not be able
  // to emit a package.json with a missing or invented kit dependency.
  const kitSpecifier = requirePlanKitSpecifier(plan);
  const files = new Map();
  files.set('package.json', `${JSON.stringify(managedToolPackageJson({
    packageName,
    pluginVersion,
    description: `Host-only DSH tool plugin (${toolName}) with kit-managed teardown, generated by dsh-plugin-kit.`,
    kitSpecifier,
  }), null, 2)}\n`);
  // Same patch, jsconfig and declaration shape as `host-tool`: the bundle row
  // and the declared resources do not change when the kit mediates teardown.
  files.set('cordis.patch.yml', hostToolPatch({ packageName, pluginId }));
  files.set('index.js', managedToolIndexJs({ pluginId, toolName, pluginVersion }));
  files.set('declaration.json', hostToolDeclarationJson(toolDeclaration({ pluginId, pluginVersion, toolName })));
  files.set('jsconfig.json', hostToolJsConfig());
  files.set('README.md', managedToolReadme({ pluginId, toolName, packageName, kitSpecifier }));
  files.set('test/plugin.test.js', managedToolTestJs({ pluginId, toolName, pluginVersion, kitSpecifier }));
  return files;
}

/** Renderer for the opt-in `host-tool-admitted` template. */
function renderAdmittedHostTool(plan) {
  const { pluginId, packageName, toolName, pluginVersion } = plan;
  // Same render-time rule as the managed variant: a hand-built plan must not be
  // able to emit a package.json with a missing or invented kit dependency.
  const kitSpecifier = requirePlanKitSpecifier(plan);
  const files = new Map();
  files.set('package.json', `${JSON.stringify(admittedToolPackageJson({
    packageName,
    pluginVersion,
    description: `Host-only DSH tool plugin (${toolName}) admitted through an operator-owned coordinator, generated by dsh-plugin-kit.`,
    kitSpecifier,
  }), null, 2)}\n`);
  // Same patch and jsconfig as `host-tool`: the bundle row and the editor hints
  // do not change because the claim is admitted rather than registered directly.
  files.set('cordis.patch.yml', hostToolPatch({ packageName, pluginId }));
  files.set('index.js', admittedToolIndexJs({ pluginId, toolName, pluginVersion }));
  // The declaration's scope is the one constant the claim tuple also uses, so
  // what the author declares and what the activation reserves cannot diverge.
  files.set(
    'declaration.json',
    hostToolDeclarationJson(toolDeclaration({ pluginId, pluginVersion, toolName, scope: ADMITTED_TOOL_SCOPE })),
  );
  files.set('jsconfig.json', hostToolJsConfig());
  files.set('README.md', admittedToolReadme({ pluginId, toolName, packageName, kitSpecifier }));
  files.set('test/plugin.test.js', admittedToolTestJs({ pluginId, toolName, pluginVersion, kitSpecifier }));
  return files;
}

/** Reject any rendered path that would escape the target directory. */
function assertInside(target, relativePath) {
  if (typeof relativePath !== 'string' || relativePath.length === 0 || isAbsolute(relativePath)) {
    throw new Error(`unsafe scaffold path: ${JSON.stringify(relativePath)}`);
  }
  const absolute = resolve(target, relativePath);
  const back = relative(target, absolute);
  if (back.startsWith('..') || isAbsolute(back) || back === '') {
    throw new Error(`unsafe scaffold path "${relativePath}" resolves outside ${target}`);
  }
  return absolute;
}

/** Remove the directories a failed write created, deepest first and only if empty. */
async function removeEmptyDirs(createdDirs) {
  const { rmdir } = await import('node:fs/promises');
  for (const directory of [...createdDirs].reverse()) {
    try {
      // Non-recursive: a directory that gained a file (from us or anyone else)
      // is left alone, so nothing but our own empty directories disappears.
      await rmdir(directory);
    } catch {
      // Keep going: an occupied directory is expected once files exist.
    }
  }
}

/**
 * Write a scaffold to a new directory.
 *
 * Uses `wx` opens so an existing file can never be truncated, and creates the
 * target with `mkdir` (non-recursive) so an existing parent structure with the
 * same name is rejected rather than reused.
 *
 * On failure the result is `ok: false` with `written` listing the files that
 * were completed before the failure, `failed` naming the path that failed, and
 * `targetCreated` reporting whether this call created the target directory.
 * Directories created by this call are removed again when they are empty; the
 * target directory itself is kept when it holds completed files, because those
 * files are the author's to inspect or delete.
 *
 * @param {object} options Same shape as {@link planScaffold}
 * @param {{ dryRun?: boolean }} [runtime]
 * @returns {Promise<{ ok: boolean, target: string, plan?: object, written: string[],
 *   skipped?: string[], failed?: string | null, targetCreated?: boolean,
 *   issues: Array<{ field: string, message: string }>, dryRun: boolean }>}
 */
export async function writeScaffold(options, { dryRun = false } = {}) {
  const planned = planScaffold(options, { dryRun });
  const requestedTarget = typeof options?.target === 'string' && options.target !== '' ? resolve(options.target) : '';
  if (!planned.ok) {
    return { ok: false, target: requestedTarget, written: [], failed: null, issues: planned.issues, dryRun };
  }
  const { plan } = planned;
  let entries;
  try {
    const files = renderScaffold(plan);
    entries = [...files.entries()].map(([path, content]) => [path, assertInside(plan.target, path), content]);
  } catch (error) {
    // Rendering is pure, so nothing has been created yet.
    return {
      ok: false,
      target: plan.target,
      plan,
      written: [],
      skipped: [],
      failed: null,
      targetCreated: false,
      issues: [{ field: 'template', message: `cannot render scaffold: ${error.message}` }],
      dryRun,
    };
  }

  if (dryRun) {
    return {
      ok: true,
      target: plan.target,
      plan,
      written: entries.map(([, absolute]) => absolute),
      skipped: [],
      failed: null,
      targetCreated: false,
      issues: [],
      dryRun: true,
      mode: 'dry-run',
    };
  }

  try {
    await mkdir(plan.target, { recursive: false });
  } catch (error) {
    // A missing parent, a permission problem or a race that created the
    // target after the plan was made: report it, never work around it.
    return {
      ok: false,
      target: plan.target,
      plan,
      written: [],
      skipped: [],
      failed: null,
      targetCreated: false,
      issues: [{ field: 'target', message: `cannot create ${plan.target}: ${error.code ?? 'error'} (${error.message})` }],
      dryRun: false,
    };
  }

  const written = [];
  const skipped = [];
  const createdDirs = [];
  let failedPath = null;
  let failure = null;

  for (const [path, absolute, content] of entries) {
    try {
      await mkdir(dirname(absolute), { recursive: true });
      createdDirs.push(dirname(absolute));
      const handle = await open(absolute, 'wx');
      try {
        await handle.writeFile(content, 'utf8');
      } finally {
        await handle.close();
      }
      written.push(absolute);
    } catch (error) {
      failedPath = absolute;
      failure = error;
      const remaining = entries.slice(entries.findIndex((entry) => entry[0] === path) + 1);
      skipped.push(...remaining.map(([, rest]) => rest));
      break;
    }
  }

  if (failure !== null) {
    await removeEmptyDirs(createdDirs);
    return {
      ok: false,
      target: plan.target,
      plan,
      written,
      skipped,
      failed: failedPath,
      targetCreated: true,
      issues: [{
        field: 'write',
        message: `writing ${relative(plan.target, failedPath) || failedPath} failed with ${failure.code ?? failure.name ?? 'error'} (${failure.message}); `
          + `${written.length} of ${entries.length} file(s) were written before the failure and ${skipped.length} were skipped. `
          + 'This write is not transactional: inspect or remove the partial directory yourself.',
      }],
      dryRun: false,
    };
  }

  return {
    ok: true,
    target: plan.target,
    plan,
    written,
    skipped: [],
    failed: null,
    targetCreated: true,
    issues: [],
    dryRun: false,
  };
}

/** Human-readable summary of a plan (deterministic, no clock, no host reads). */
export function describeScaffoldPlan(plan) {
  if (!plan) throw new TypeError('describeScaffoldPlan(plan): a resolved plan is required');
  const lines = [
    `template: ${plan.template.id}@${plan.template.version} (${plan.template.language}, ${plan.template.status})`,
    `target: ${plan.target}`,
    `plugin id: ${plan.pluginId}`,
    `package name: ${plan.packageName}`,
    `tool name: ${plan.toolName}`,
    `plugin version: ${plan.pluginVersion}`,
    `reference host: ${plan.template.referenceHost} (pinned; not a compatibility claim)`,
  ];
  // Only the managed template records a kit dependency; printing an empty value
  // for the default template would suggest one exists.
  if (plan.kitSpecifier !== undefined) {
    lines.push(`kit specifier: ${plan.kitSpecifier} (recorded verbatim in dependencies; not resolved or installed)`);
  }
  return lines.join('\n');
}
