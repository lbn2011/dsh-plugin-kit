/**
 * dsh-plugin-kit public types.
 *
 * Hand-written .d.ts: this package ships no build step and no dependencies, so
 * the types are the source of truth for consumers rather than generated output.
 */

/** Kit release. */
export declare const KIT_VERSION: '0.1.0-draft.1';
/** Reference host version; a source pin, not a compatibility claim. */
export declare const HOST_VERSION: '0.2.2-alpha.2';
/** `engines.dsh` written into generated package.json files: the exact pinned build. */
export declare const HOST_ENGINE: '0.2.2-alpha.2';
/** `engines.node` of the pinned official sources. */
export declare const NODE_ENGINE: '>=24.9.0';
/** Shared host packages a generated plugin imports, in a stable order. */
export declare const HOST_PEERS: readonly ['@deepseek-ai/cordis', '@deepseek-ai/schemastery', '@deepseek-ai/dsh-tools'];
export declare const CORDIS_PACKAGE: '@deepseek-ai/cordis';
export declare const CORDIS_VERSION: '4.0.6-alpha.1';
export declare const TOOLS_PACKAGE: '@deepseek-ai/dsh-tools';
export declare const TOOLS_VERSION: '0.2.2-alpha.2';
export declare const SCHEMASTER_PACKAGE: '@deepseek-ai/schemastery';
export declare const SCHEMASTER_VERSION: '3.18.6-alpha.1';
/**
 * Exact dependency specifiers written into generated package.json files.
 * Keyed by package name; one exact version each, read from the pinned sources.
 */
export declare const GENERATED_DEPENDENCIES: Readonly<{
  '@deepseek-ai/cordis': '4.0.6-alpha.1';
  '@deepseek-ai/schemastery': '3.18.6-alpha.1';
  '@deepseek-ai/dsh-tools': '0.2.2-alpha.2';
}>;

/**
 * This kit's own package name, as generated code imports it
 * (`dsh-plugin-kit/managed-registration`). Private and unpublished: the name is
 * a module specifier root, not evidence of a registry release.
 */
export declare const KIT_PACKAGE: 'dsh-plugin-kit';

/**
 * The only accepted shape for the operator-supplied kit dependency of the opt-in
 * `host-tool-managed` template: a local `file:` specifier written verbatim into
 * `dependencies['dsh-plugin-kit']`. There is no default and no derivation — the
 * kit publishes nothing, so a registry range would name a version no registry
 * serves. Relative paths stay relative and resolve against the generated
 * package directory.
 */
export declare const KIT_SPECIFIER_PREFIX: 'file:';

/** Declaration schema revision this kit emits (owned by the protocol repository). */
export declare const PROTOCOL_VERSION: '0.1.0-draft.1';
export declare const TOOL_TEMPLATE_CAPABILITY: 'ctx.tools';
export declare const EFFECT_CAPABILITY: 'cordis.effect';
/** Default static scope label written for the template resource; a label only. */
export declare const DEFAULT_SCOPE: 'plugin';
/** Tool name the host reserves. */
export declare const RESERVED_TOOL_NAMES: readonly ['run_code'];

export interface DeclarationIssue {
  code: string;
  path: string;
  message: string;
}

export interface DeclarationCheck {
  valid: boolean;
  issues: DeclarationIssue[];
}

/**
 * One claimed resource. `kind` and `scope` are opaque strings here: the kit
 * neither enumerates kinds nor interprets scope labels.
 */
export interface DeclarationResource {
  kind: string;
  name: string;
  scope: string;
}

/** Explicit declaration as emitted into `declaration.json`. */
export interface PluginDeclaration {
  schemaVersion: '0.1.0-draft.1';
  plugin: { id: string; version: string };
  capabilities: { required: string[]; optional: string[] };
  resources: DeclarationResource[];
}

/**
 * A caller-supplied protocol validator, e.g. `validateDeclaration` from
 * dsh-compat-spec. Must be synchronous and return `{ valid, issues }`.
 */
export type DeclarationValidator = (value: unknown) => unknown;

export declare function toolDeclaration(input: {
  pluginId: string;
  pluginVersion: string;
  toolName?: string | null;
  tools?: readonly string[];
  capabilitiesRequired?: readonly string[];
  capabilitiesOptional?: readonly string[];
  scope?: string;
}): PluginDeclaration;

/**
 * Forward a declaration to an injected validator.
 *
 * Throws `TypeError` when `validator` is not a function. A throwing,
 * asynchronous or malformed validator result yields `valid: false` with an
 * adapter-level issue instead of a guess.
 */
export declare function validateWith(value: unknown, validator: DeclarationValidator): DeclarationCheck;

/** Read-back summary of a declaration; never an acceptance verdict. */
export declare function describeDeclaration(declaration: unknown): {
  pluginId: string | undefined;
  pluginVersion: string | undefined;
  schemaVersion: string | undefined;
  tools: string[];
  services: string[];
  requiredCapabilities: string[];
  optionalCapabilities: string[];
  note: string;
};

export interface ScaffoldIssue {
  field: string;
  message: string;
}

export declare function checkScaffoldInputs(input: {
  pluginId?: unknown;
  packageName?: unknown;
  toolName?: unknown;
}): ScaffoldIssue[];

/**
 * Structural check of the operator-supplied kit specifier: a non-empty `file:`
 * path with no control characters. Nothing is resolved, stat'ed or installed and
 * no default is derived from the environment, the module URL or a sibling scan.
 */
export declare function checkKitSpecifier(kitSpecifier: unknown): ScaffoldIssue[];

export declare function hostToolPackageJson(input: {
  packageName: string;
  pluginVersion: string;
  description: string;
}): Record<string, unknown>;
export declare function hostToolPatch(input: { packageName: string; pluginId: string }): string;
export declare function hostToolIndexJs(input: {
  pluginId: string;
  toolName: string;
  pluginVersion: string;
}): string;
export declare function hostToolTestJs(input: {
  pluginId: string;
  toolName: string;
  pluginVersion: string;
}): string;
export declare function hostToolReadme(input: {
  pluginId: string;
  toolName: string;
  packageName: string;
}): string;
export declare function hostToolJsConfig(): string;
export declare function hostToolDeclarationJson(declaration: PluginDeclaration): string;

/**
 * package.json for the opt-in managed variant: the same three host pins as
 * peers and dev dependencies, plus `dependencies['dsh-plugin-kit']` set to
 * `kitSpecifier` verbatim. Throws `TypeError` when the specifier is absent,
 * empty, not a `file:` path or carries control characters.
 */
export declare function managedToolPackageJson(input: {
  packageName: string;
  pluginVersion: string;
  description: string;
  kitSpecifier: string;
}): Record<string, unknown>;
/** index.js that mounts its tool through `dsh-plugin-kit/managed-registration`. */
export declare function managedToolIndexJs(input: {
  pluginId: string;
  toolName: string;
  pluginVersion: string;
}): string;
/** Generated suite; embeds the operator's kit specifier as an expected literal. */
export declare function managedToolTestJs(input: {
  pluginId: string;
  toolName: string;
  pluginVersion: string;
  kitSpecifier: string;
}): string;
export declare function managedToolReadme(input: {
  pluginId: string;
  toolName: string;
  packageName: string;
  kitSpecifier: string;
}): string;

/**
 * Claim scope every `host-tool-admitted` artifact emits: the tuple `apply`
 * passes to `admit` and the one `declaration.json` records. A label in the
 * operator's claim table, not a host-enforced boundary.
 */
export declare const ADMITTED_TOOL_SCOPE: 'global';

/**
 * package.json for the opt-in admitted variant: the same three host pins as
 * peers and dev dependencies, plus `dependencies['dsh-plugin-kit']` set to
 * `kitSpecifier` verbatim. The admission service is not a dependency: the
 * operator mounts its provider. Throws `TypeError` when the specifier is
 * absent, empty, not a `file:` path or carries control characters.
 */
export declare function admittedToolPackageJson(input: {
  packageName: string;
  pluginVersion: string;
  description: string;
  kitSpecifier: string;
}): Record<string, unknown>;

/**
 * index.js that admits its claim through the externally provided
 * `pluginAdmission` service and registers the tool inside that activation.
 */
export declare function admittedToolIndexJs(input: {
  pluginId: string;
  toolName: string;
  pluginVersion: string;
}): string;
/** Generated suite; embeds the operator's kit specifier as an expected literal. */
export declare function admittedToolTestJs(input: {
  pluginId: string;
  toolName: string;
  pluginVersion: string;
  kitSpecifier: string;
}): string;
export declare function admittedToolReadme(input: {
  pluginId: string;
  toolName: string;
  packageName: string;
  kitSpecifier: string;
}): string;

export interface TemplateInfo {
  id: string;
  version: string;
  language: 'js';
  status: 'implemented';
  description: string;
  referenceHost: string;
}

export declare const TEMPLATES: Readonly<Record<'host-tool' | 'host-tool-managed' | 'host-tool-admitted', TemplateInfo>>;
export declare const DEFERRED_TEMPLATES: Readonly<Record<'client' | 'combined', string>>;
export declare const DEFAULT_TEMPLATE: 'host-tool';
export declare const DEFAULT_PLUGIN_VERSION: '0.1.0';

export interface ScaffoldOptions {
  target: string;
  template?: string;
  pluginId?: string;
  packageName?: string;
  toolName?: string;
  pluginVersion?: string;
  /**
   * Required for `host-tool-managed` and `host-tool-admitted`, refused for
   * `host-tool`: the operator's own local kit path as `file:<path>`, recorded
   * verbatim in `dependencies['dsh-plugin-kit']`. No default, no environment
   * lookup, no sibling discovery, no stat and no install.
   */
  kitSpecifier?: string;
}

export interface ScaffoldPlan {
  template: TemplateInfo;
  target: string;
  pluginId: string;
  packageName: string;
  toolName: string;
  pluginVersion: string;
  /** Present only for the kit-dependent templates; absent for `host-tool`. */
  kitSpecifier?: string;
}

export type ScaffoldPlanResult =
  | { ok: true; issues: []; plan: ScaffoldPlan }
  | { ok: false; issues: ScaffoldIssue[] };

/**
 * Outcome of a scaffold write.
 *
 * A failed write is **not** transactional: `written` lists the files that
 * completed, `skipped` the ones never attempted, and `failed` the path that
 * errored. Directories created by the call are removed only when empty.
 */
export interface ScaffoldWriteResult {
  ok: boolean;
  target: string;
  plan?: ScaffoldPlan;
  written: string[];
  skipped?: string[];
  failed?: string | null;
  targetCreated?: boolean;
  issues: ScaffoldIssue[];
  dryRun: boolean;
  mode?: 'write' | 'dry-run';
}

export declare function resolveTemplate(id: string): TemplateInfo;
export declare function defaultToolName(pluginId: string): string;
export declare function planScaffold(
  options: Partial<ScaffoldOptions> & { target?: string },
  runtime?: { dryRun?: boolean },
): ScaffoldPlanResult;
export declare function renderScaffold(plan: ScaffoldPlan): Map<string, string>;
export declare function writeScaffold(options: ScaffoldOptions, runtime?: { dryRun?: boolean }): Promise<ScaffoldWriteResult>;
export declare function describeScaffoldPlan(plan: ScaffoldPlan): string;
