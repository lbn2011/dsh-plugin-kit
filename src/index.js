/**
 * dsh-plugin-kit — author-side helpers for DSH plugins.
 *
 * This package is author tooling, not a runtime SDK and not a replacement for
 * Cordis. Nothing here registers with a host: the generator emits *source*
 * that the host's own loader picks up, and the host's effects own the
 * registrations. The single host-facing helper is `validateWith`, which takes
 * a caller-supplied validator instead of importing one.
 *
 * The public surface deliberately contains no protocol implementation: no
 * shape checker, no resource-kind list, no scope vocabulary and no path
 * formatter for protocol fields. Those rules belong to the protocol owner and
 * arrive through the injected validator.
 *
 * @packageDocumentation
 */

export {
  CORDIS_PACKAGE,
  CORDIS_VERSION,
  DEFAULT_SCOPE,
  EFFECT_CAPABILITY,
  GENERATED_DEPENDENCIES,
  HOST_ENGINE,
  HOST_PEERS,
  HOST_VERSION,
  KIT_PACKAGE,
  KIT_SPECIFIER_PREFIX,
  KIT_VERSION,
  NODE_ENGINE,
  PROTOCOL_VERSION,
  SCHEMASTER_PACKAGE,
  SCHEMASTER_VERSION,
  TOOLS_PACKAGE,
  TOOLS_VERSION,
  TOOL_TEMPLATE_CAPABILITY,
  describeDeclaration,
  toolDeclaration,
  validateWith,
} from './protocol.js';

export {
  ADMITTED_TOOL_SCOPE,
  RESERVED_TOOL_NAMES,
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

export {
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
} from './scaffold.js';
