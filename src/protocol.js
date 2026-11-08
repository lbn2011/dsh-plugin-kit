/**
 * dsh-plugin-kit — declaration adapter, not a protocol implementation.
 *
 * The declaration protocol is owned by another repository. This module only
 * *shapes* declarations and *forwards* them to a validator the caller passes
 * in. It contains no field-by-field protocol check and no closed list of
 * allowed values, so it cannot drift from the owner's rules.
 *
 * It is a pure, dependency-free library. Importing it never reads or writes
 * files, starts a server, installs packages, mutates a profile, or registers
 * anything with a host.
 *
 * @packageDocumentation
 */

import { isPromiseLike } from './internal/value.js';

// ---------------------------------------------------------------------------
// Identity and pinned source facts
// ---------------------------------------------------------------------------

/** Version of this toolkit. The scaffold CLI also prints it in `--help`. */
export const KIT_VERSION = '0.0.0';

/**
 * Declaration schema revision this kit emits.
 *
 * Re-stated as a literal so this package has no cross-repository dependency.
 * It is only the value written into `declaration.json`; whether that value is
 * acceptable is decided by the injected validator.
 */
export const PROTOCOL_VERSION = '0.1.0-draft.1';

/**
 * Package versions read from the pinned official sources (commit
 * `ce7073d51254c26cd63b22a60835b8f948deb447`).
 *
 * These are *source metadata* facts. The locally installed runtime is a
 * different build and is not evidence for them, and nothing here proves the
 * packages are available from a registry.
 */
export const CORDIS_PACKAGE = '@deepseek-ai/cordis';
export const CORDIS_VERSION = '4.0.6-alpha.1';
export const TOOLS_PACKAGE = '@deepseek-ai/dsh-tools';
export const TOOLS_VERSION = '0.2.2-alpha.2';
export const SCHEMASTER_PACKAGE = '@deepseek-ai/schemastery';
export const SCHEMASTER_VERSION = '3.18.6-alpha.1';

/**
 * The host build the reviewed interfaces belong to. A source pin, never a
 * runtime-compatibility claim.
 */
export const HOST_VERSION = '0.2.2-alpha.2';

/**
 * Exact dependency specifiers written into generated `package.json`s, one
 * version per package.
 *
 * No common range is used: the three packages have unrelated versions and a
 * `~0.2.2` style range would not even contain `0.2.2-alpha.2`. A caret/tilde
 * range also silently admits future prereleases of the same package, so the
 * generated project pins the exact reviewed versions instead.
 */
export const GENERATED_DEPENDENCIES = Object.freeze({
  [CORDIS_PACKAGE]: CORDIS_VERSION,
  [SCHEMASTER_PACKAGE]: SCHEMASTER_VERSION,
  [TOOLS_PACKAGE]: TOOLS_VERSION,
});

/** Package names a generated plugin shares with its host, in a stable order. */
export const HOST_PEERS = Object.freeze(Object.keys(GENERATED_DEPENDENCIES));

/**
 * This kit's own package name, as generated code imports it
 * (`dsh-plugin-kit/managed-registration`).
 *
 * The kit is private and `0.0.0` is not a published release: the name appears
 * in generated metadata because the opt-in managed template imports it, not
 * because a registry serves it.
 */
export const KIT_PACKAGE = 'dsh-plugin-kit';

/**
 * The only accepted shape for the operator-supplied kit dependency of the
 * opt-in managed template: a local `file:` specifier, written verbatim into
 * `dependencies["dsh-plugin-kit"]`.
 *
 * There is no default and no derivation. The kit publishes nothing, so a
 * registry range would name a version no registry serves; the generator
 * therefore refuses to invent one, never inspects the filesystem, and never
 * resolves the path. A relative path stays relative in the emitted
 * `package.json` and is interpreted by the package manager relative to the
 * generated package directory.
 *
 * The three host pins are unchanged and remain peers: the managed template adds
 * a `dependencies` entry and nothing else.
 */
export const KIT_SPECIFIER_PREFIX = 'file:';

/**
 * `engines.dsh` written into generated packages: the exact host build, not a
 * range. Official readers treat `engines.dsh` as a declarative compatibility
 * field; this kit only states the build it was written against.
 */
export const HOST_ENGINE = HOST_VERSION;

/** `engines.node` of the official sources (root and CLI both declare it). */
export const NODE_ENGINE = '>=24.9.0';

/**
 * Capability strings this kit writes into a declaration. They are opaque
 * tokens for the protocol owner; the kit attaches no meaning to them and makes
 * no claim about which of them a host offers.
 */
export const TOOL_TEMPLATE_CAPABILITY = 'ctx.tools';
export const EFFECT_CAPABILITY = 'cordis.effect';

// ---------------------------------------------------------------------------
// Declaration builder
// ---------------------------------------------------------------------------

/**
 * A declaration for a host-tool plugin, as an explicit value.
 *
 * Every field is always present (`resources` is `[]` rather than omitted,
 * because the agreed contract requires an array). `scope` is a free-form
 * static label chosen by the author; the kit writes {@link DEFAULT_SCOPE} for
 * its own template and never narrows, enumerates or validates labels here.
 *
 * @param {{ pluginId: string, pluginVersion: string, toolName?: string | null,
 *   capabilitiesRequired?: readonly string[], capabilitiesOptional?: readonly string[],
 *   tools?: readonly string[], scope?: string }} input
 */
export function toolDeclaration(input) {
  const options = input ?? {};
  const inherited = options.toolName;
  const names = options.tools ?? (typeof inherited === 'string' && inherited !== '' ? [inherited] : []);
  const scope = options.scope ?? DEFAULT_SCOPE;
  return {
    schemaVersion: PROTOCOL_VERSION,
    plugin: { id: options.pluginId, version: options.pluginVersion },
    capabilities: {
      required: [...(options.capabilitiesRequired ?? [EFFECT_CAPABILITY, TOOL_TEMPLATE_CAPABILITY])],
      optional: [...(options.capabilitiesOptional ?? [])],
    },
    resources: names.map((name) => ({ kind: 'tool', name, scope })),
  };
}

/**
 * Default static scope label written for the kit's own template resource.
 *
 * It is a label in the declaration only. It does not describe an agent's
 * runtime scope, grant visibility, or match any host-side scope object.
 */
export const DEFAULT_SCOPE = 'plugin';

// ---------------------------------------------------------------------------
// Validator adapter
// ---------------------------------------------------------------------------

/** Prefix of every code this adapter itself emits (validator codes pass through). */
const ADAPTER_PREFIX = 'SELECTED_VALIDATOR_';

/** Longest user-visible render of an arbitrary value in an adapter message. */
const MAX_RENDER = 120;

function render(value) {
  if (typeof value === 'string') return JSON.stringify(value.length > MAX_RENDER ? `${value.slice(0, MAX_RENDER)}…` : value);
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  if (typeof value === 'function') return 'function';
  if (isPromiseLike(value)) return 'Promise';
  if (typeof value === 'symbol') return 'symbol';
  return String(value);
}

function describeError(error) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return render(error);
}

/** One adapter-level finding: the injected validator contract was not met. */
function malformed(what, message) {
  return {
    valid: false,
    issues: [{ code: `${ADAPTER_PREFIX}MALFORMED`, path: '', message: `${what}: ${message}` }],
  };
}

/** The adapter's single opaque code for "cannot tell". */
function contractViolation(message) {
  return {
    valid: false,
    issues: [{ code: 'SELECTED_VALIDATION_ERROR', path: '', message }],
  };
}

/**
 * Validate a declaration with an explicitly injected validator.
 *
 * `valid: true` is returned only when the validator returned an object that
 * has `valid === true` and an `issues` array (empty). Everything else — a
 * thrown exception, a `null`, a Promise, a non-array `issues`, or `valid:
 * false` with no issues — is reported as invalid, never as valid.
 *
 * The result is always a plain `{ valid: boolean, issues: DeclarationIssue[] }`.
 * The kit never deep-imports, resolves or defaults a validator: an absent
 * `validator` is a refusal, not a fallback to a local check.
 *
 * @param {unknown} value Declaration value.
 * @param {(value: unknown) => unknown} validator The protocol owner's
 *   `validateDeclaration`, supplied by the caller.
 * @returns {{ valid: boolean, issues: Array<{ code: string, path: string, message: string }> }}
 */
export function validateWith(value, validator) {
  if (typeof validator !== 'function') {
    throw new TypeError('validateWith(value, validator): validator must be a function, e.g. validateDeclaration from dsh-compat-spec');
  }

  let result;
  try {
    result = validator(value);
  } catch (error) {
    return contractViolation(`Injected validator threw ${describeError(error)}; its verdict is unknown, so this result is not valid.`);
  }
  if (isPromiseLike(result)) {
    return malformed('injected validator returned a Promise', 'the adapter is synchronous; pass a synchronous validator.');
  }
  if (result === null || typeof result !== 'object' || Array.isArray(result)) {
    return malformed(`injected validator returned ${render(result)}`, 'expected an object { valid, issues }.');
  }
  if (typeof result.valid !== 'boolean') {
    return malformed('injected validator result has no boolean "valid"', `got ${render(result.valid)}.`);
  }
  if (!Array.isArray(result.issues)) {
    return malformed('injected validator result has no "issues" array', `got ${render(result.issues)}.`);
  }
  if (result.valid && result.issues.length > 0) {
    return malformed('injected validator result is inconsistent', `valid: true with ${result.issues.length} issue(s).`);
  }
  if (!result.valid && result.issues.length === 0) {
    return malformed('injected validator result is inconsistent', 'valid: false with no issue explaining why.');
  }

  const issues = [];
  for (const [index, entry] of result.issues.entries()) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      return malformed('injected validator issue is not an object', `issues[${index}] is ${render(entry)}.`);
    }
    if (typeof entry.code !== 'string' || entry.code === '') {
      return malformed('injected validator issue has no "code"', `issues[${index}].code is ${render(entry.code)}.`);
    }
    if (typeof entry.path !== 'string') {
      return malformed('injected validator issue has no string "path"', `issues[${index}].path is ${render(entry.path)}.`);
    }
    if (typeof entry.message !== 'string' || entry.message === '') {
      return malformed('injected validator issue has no "message"', `issues[${index}].message is ${render(entry.message)}.`);
    }
    // Normalize instead of forwarding foreign fields: the adapter's output
    // shape is fixed even if a validator adds severity or metadata.
    issues.push({ code: entry.code, path: entry.path, message: entry.message });
  }
  return { valid: issues.length === 0, issues };
}

// ---------------------------------------------------------------------------
// Human summary
// ---------------------------------------------------------------------------

/**
 * Read back what a declaration contains, without judging it.
 *
 * The fields are copied defensively so a malformed value cannot throw; the
 * result is never an acceptance, loading or execution verdict.
 */
export function describeDeclaration(declaration) {
  const value = declaration !== null && typeof declaration === 'object' ? declaration : {};
  const resources = Array.isArray(value.resources) ? value.resources : [];
  const of = (kind) => resources.filter((resource) => resource !== null && typeof resource === 'object' && resource.kind === kind).map((resource) => resource.name);
  const strings = (list) => (Array.isArray(list) ? list.filter((entry) => typeof entry === 'string') : []);
  return {
    pluginId: value.plugin?.id,
    pluginVersion: value.plugin?.version,
    schemaVersion: value.schemaVersion,
    tools: of('tool'),
    services: of('service'),
    requiredCapabilities: strings(value.capabilities?.required),
    optionalCapabilities: strings(value.capabilities?.optional),
    note: 'Author declaration only: not host acceptance, loading or execution evidence.',
  };
}
