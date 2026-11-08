# dsh-plugin-kit

Thin author tooling for host-only DSH plugins: a zero-dependency CLI/library that emits a minimal Cordis plugin (one registered tool), an explicit protocol declaration, and a static test. This is not the official subprocess/JSON-RPC SDK, it does not replace Cordis, and it does not install into the host.

Scope and historical requirements live in [Requirements and delivery plan](<docs/requirements-and-design/2026-10-31-plugin-kit-requirements.md>). For evidence-backed adaptation of existing plugins, start with the [migration guide](<docs/requirements-and-design/2026-11-06-plugin-migration-tech-plan.md>) and repository-local Skills: [scaffold](<skills/scaffold/SKILL.md>), [verify](<skills/verify/SKILL.md>), [migrate](<skills/migrate/SKILL.md>). These files are not installed or enabled in Skill Hub.

## Usage

No install step and no dependencies: run the CLI with `node` from this repository.

```sh
node src/cli.js list-templates        # host-tool, host-tool-managed, host-tool-admitted; client/combined deferred
node src/cli.js help                  # full flag list
node src/cli.js scaffold ../my-plugin --dry-run
node src/cli.js scaffold ../my-plugin \
  --plugin-id my-plugin --package-name my-plugin --tool-name my_hello
node src/cli.js scaffold ../my-plugin --template host-tool-managed \
  --kit-specifier file:../dsh-plugin-kit
node src/cli.js check ../my-plugin/declaration.json \
  --validator ../dsh-compat-spec/src/index.js
```

The generator writes seven files — `package.json`, `cordis.patch.yml`, `index.js`, `declaration.json`, `jsconfig.json`, `README.md`, `test/plugin.test.js` — and refuses any target that already exists: there is no update mode and no file is ever overwritten. Exit codes are `0` success, `1` refused/failed, `2` usage error. The CLI starts no server, watcher or network call.

The root library form (`import * as kit from './src/index.js'`) exposes the scaffold/declaration functions and pinned metadata listed above. Separate public subpaths are `dsh-plugin-kit/cleanup`, `dsh-plugin-kit/managed-registration`, `dsh-plugin-kit/admission`, `dsh-plugin-kit/admission-provider` and `dsh-plugin-kit/cli`; their hand-written declarations live beside each implementation. `./admission` is intentionally not re-exported from the root, so existing `Object.keys(kit)` remains unchanged.

## What a generated plugin is

An ordinary Cordis plugin with `name`, required service injection, a Schemastery `Config` and `apply(ctx, config)`, registering one tool through `ctx.tools.register(defineTool({...}))`. The default injects only `tools` and relies on native effect ownership. The managed variant additionally tracks cleanup settlement; the admitted variant injects `pluginAdmission` and tracks cooperative claims as described below. Neither replaces the native tool registry. Declarations use the fixed `0.1.0-draft.1` shape (`schemaVersion`, `plugin.{id,version}`, `capabilities.{required,optional}`, `resources[].{kind,name,scope}`), always with every field emitted; `scope` is a static label, never an agent scope claim.

The declaration checker delegates protocol validation: `check` requires `--validator <module>` and reports only what that module says. The separate admission helper validates its own bounded runtime arguments (`tool`/`service` tuples); it does not replace the protocol validator or infer host scopes. An authoritative verdict comes from the protocol owner (`dsh-compat-spec`), passed explicitly as `validateWith(value, validateDeclaration)`. No sibling path or unpublished npm name is declared as a dependency.

## The opt-in `host-tool-managed` template

`--template host-tool-managed` renders the same seven files for the same single tool, with one deliberate difference: `apply` mounts the tool through this kit's `managed-registration` entry point and returns that handle's cleanup.

```js
import { registerManagedResource } from 'dsh-plugin-kit/managed-registration';

export const apply = (ctx, config) => {
  const handle = registerManagedResource(
    { register: () => ctx.tools.register(defineTool({ /* … */ })) },
    { label: 'my-plugin' },
  );
  return () => handle.close();
};
// Non-constructible apply is intentional: Cordis collects its returned cleanup.
```

The port is called once, synchronously, and must return the exact disposer `ctx.tools.register()` produced; the kit records it and `close()` runs it once (one shared promise, no timeout). An acquisition failure starts reverse-order rollback and throws an error carrying a `rollback` promise; the caller must await that promise to observe cleanup settlement.

This variant requires an explicit kit specifier: `--kit-specifier file:<operator path>` on the CLI, or `kitSpecifier: 'file:<operator path>'` on the library call. The string is written **verbatim** into `dependencies['dsh-plugin-kit']` and is never rewritten, defaulted or completed — the kit is private and publishes nothing, so a registry range would name a version no registry serves, and the generator refuses to run without a local `file:` path. It reads no environment variable, scans no sibling directory, stats no path, and installs, links or resolves nothing. A **relative** path stays relative and is interpreted by the package manager relative to the **generated package directory**, not the directory the generator ran in, so it survives a moved workspace. Host peers are untouched: the same three pins stay in `peerDependencies` and `devDependencies`, and `host-tool-managed` adds no kit peer or dev dependency. The default `host-tool` template is byte-identical to before, declares no `dependencies`, and **refuses** a `kitSpecifier` instead of silently dropping it.

**Teardown limits, not guarantees.** The cleanup `apply` returns is awaited when the plugin's fiber unloads, but it is not the exclusive owner of the unregistration: the same exact disposer is also a native effect owned by the host fiber. Cordis disposes a fiber's top-level effects concurrently, not in reverse order, so the order between this cleanup and the host's own effect is not guaranteed — whichever runs first removes the tool and the other call is a no-op. Teardown failures are logged and swallowed by the host, so a rejected `close()` is not surfaced as a load error and is not retried. The isolated [managed Loader recheck](docs/testing/2026-11-02-managed-loader-lifecycle-recheck.md) independently observed a rejected kit close while Loader unload fulfilled. That single-version evidence is not a guarantee for other hosts or plugins.

## The opt-in `host-tool-admitted` template

`--template host-tool-admitted --kit-specifier file:<operator path>` emits a plugin that injects both `tools` and `pluginAdmission`. Its async arrow `apply` calls the shared coordinator's `admit()` before native registration and immediately defers the returned native disposer. It does not create a coordinator or mount a provider. Without a visible provider it remains pending.

The operator creates one coordinator with `createAdmissionCoordinator()` and passes it to `createAdmissionProvider(coordinator)` from `dsh-plugin-kit/admission-provider`. Cooperating plugins must resolve that same instance in the appropriate host service visibility scope. Preserve its lifetime across dependent reloads: replacing the coordinator or restarting is not proof that quarantined resources were cleaned. Provider unload removes the service, not the claim table. This is opt-in cooperation, not interception of unmanaged registrations or cross-process coordination.

The [admitted-template Loader record](<docs/testing/2026-11-04-admitted-template-loader.md>) records 35/35 assertions in one isolated composition. It does not establish browser behavior or automatic admission for unrelated plugins.

## Generated metadata

Everything the generator writes into `package.json` is read from the pinned official sources; nothing is invented:

| Field | Value | Note |
|---|---|---|
| `engines.node` | `>=24.9.0` | The official root and CLI packages declare this. |
| `engines.dsh` | `0.2.2-alpha.2` | The exact reviewed host version. An exact baseline, not a tested compatibility range. Official compatibility checks can refuse incompatible declarations; an explicitly approved temporary-profile exemption is not native compatibility. |
| `dsh.bundle.patch` | `./cordis.patch.yml` | The reviewed bundle field. |
| `peerDependencies` / `devDependencies` | three exact pins | `@deepseek-ai/cordis@4.0.6-alpha.1`, `@deepseek-ai/schemastery@3.18.6-alpha.1`, `@deepseek-ai/dsh-tools@0.2.2-alpha.2` — unrelated versions, so one shared range would be wrong. |
| `dependencies` (managed and admitted variants) | `dsh-plugin-kit: <the operator's literal>` | Required input, recorded verbatim: `file:<path>`. Not a peer, not a dev dependency, never a guessed version. Relative paths resolve against the generated package directory. |

There is no `license` field (none can be substantiated), no `dsh.manifestVersion` (a declarative format identifier that changes nothing the generated code does) and no `dsh.compatibleHost` (no official package declares it). The bundle patch row is `id: '<package-name>:<plugin-id>'` with `name: '<package-name>'`, matching the rule that a contributed row id is prefixed by its own package name.

## Repository map

| Path | Contents |
|---|---|
| `src/` | CLI (`cli.js`), declaration helpers (`protocol.js`), renderers (`manifest.js`), planning/writing (`scaffold.js`), re-exports and types. |
| `templates/host-tool/` | Review copy of the rendered template, compared byte for byte by `tests/template.test.js`. |
| `templates/host-tool-managed/` | Review copy of the opt-in managed variant, compared byte for byte by `tests/managed-template.test.js`. |
| `templates/host-tool-admitted/` | Review copy of the opt-in shared-admission variant. |
| `tests/` | `node --test` suite (assertion counts are not pinned here). |
| `skills/scaffold/`, `skills/verify/`, `skills/migrate/` | Repository-local author workflows; not installed into any registry. |
| `packages/` | Reserved; empty. The kit is the root package instead of a workspace member. |

## Tests

```sh
node --test "tests/*.test.js"
```

Pass `DSH_COMPAT_SPEC=/path/to/dsh-compat-spec/src/index.js` to also run the opt-in cross-repository validator check. Quote the glob: some shells expand it differently, and a bare `node --test` would also pick up the template's own test file, which cannot resolve the host packages.

Raw run artifacts behind the records in `docs/testing/` are kept on the
maintainer's machine and excluded from Git; see
[docs/testing/runs/README.md](docs/testing/runs/README.md) for the mapping. They
are not downloadable by anyone who clones this repository.

## Caller-shared resource admission

`dsh-plugin-kit/admission` exports `createAdmissionCoordinator()`. Share one instance among cooperating activations in a domain; separate instances cannot detect each other's claims. `reserve(claims)` synchronously reserves a whole batch or none. `admit(claims, activate)` reserves before calling `activate`, which receives `{ defer }` for immediately registering cleanup.

Claims are exact own data properties `{ kind, name, scope }`, with kind `tool` or `service` and non-empty, already-trimmed strings. A clean `close()` releases the claims after cleanup settles. Activation or cleanup failure retains them in quarantine; there is no forced reset. Low-level lease `release()` is caller-attested bookkeeping, not proof that host resources disappeared. Stale handles cannot release a newer owner's claims. This helper neither intercepts native registration nor coordinates across processes, and has no deadline.

The [admission record](docs/testing/2026-11-02-resource-admission.md) covers 152 passing suite tests, including 34 admission unit cases and seven compositions with real kit cleanup and **mock host ports**. That suite alone does not establish Loader integration. A subsequent [real Loader acceptance](docs/testing/2026-11-02-admission-loader.md) passed 57/57 assertions in one isolated pinned host composition: shared coordinator identity, conflict before admitted callbacks/native registration, clean unload and retry, failed cleanup/activation quarantine, and stale-handle protection. This uses caller-owned fixtures, not automatic admission in generated templates or unmanaged plugins.

## Status and limits (2026-11-06)

Implemented: the CLI, three JavaScript ESM host templates, explicit declarations, the injected-validator adapter, cleanup/admission helpers and provider. Executed evidence is recorded per run below; the scaffold/verify/migrate Skills are authoring instructions, not themselves proof of execution.

The earlier unexecuted managed-template status is superseded by the [169-test regression record](docs/testing/2026-11-02-managed-lifecycle-regression.md), the separate [real Loader recheck](docs/testing/2026-11-02-managed-loader-lifecycle-recheck.md), and the newer [152-test kit/admission suite](docs/testing/2026-11-02-resource-admission.md). These are different test scopes and historical snapshots, not counts to add into a compatibility certification.

Third-party pilot evidence is also available: [Toolkit original/modified Loader lifecycle](<docs/testing/2026-11-06-toolkit-loader-exemption.md>) used explicitly approved exact-version exemptions in temporary profiles; [Harbor original/modified Loader and HTTP lifecycle](<docs/testing/2026-11-06-harbor-loader-path-gates-recheck.md>) recorded 55/55 assertions. Their [83-test fixture regression](<docs/testing/2026-11-06-harbor-path-gates-unit.md>) is a different scope, not an additional host-certification total. These experiments did not install or publish either adaptation.

Remaining limits:

- **Three host templates, JavaScript only.** `host-tool-managed` and `host-tool-admitted` are opt-in and need an explicitly supplied local kit `file:` path; admitted additionally needs an externally owned, visible shared provider. `client` and `combined` remain deferred and refused (exit `1`); no TypeScript output, bundler or build step.
- **Bounded host evidence only.** One real Loader run against the isolated official checkout at `0.2.2-alpha.2`, commit `ce7073d51254c26cd63b22a60835b8f948deb447`, exercised a kit-generated managed template and a synthetic disposer-failure fixture. It does not establish cross-version compatibility, Web/browser behavior, universal teardown ordering, or host surfacing of disposer failures. `engines.dsh` remains an exact version literal, not a tested compatibility range.
- **Live-profile evidence is isolated and bounded.** A temporary profile and home were used; production `/root/.dsh`, `/data/tests` originals and GUI port `3080` were not modified. This is not an installation or release certification.
- **No release.** No publish, tarball, version stamping or `files` audit. License and npm identity remain pending — no reuse license is granted.
- **Platform integration remains limited**, and `skills/` are repository files, not registered Skills.
- **Scaffold refusal is not atomic** across concurrent teardown: it is an existence check plus non-recursive `mkdir` and exclusive file creation, not a transactional write. A write that fails partway reports the files written, the file that failed and the files skipped; it does not roll back.
- **No upstream code or template was copied**; only public interfaces and the JSON-Schema subset were read.
