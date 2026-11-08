# Managed-cleanup template — development plan

Date: 2026-11-01. Status updated 2026-11-02: the optional template and explicit `file:` dependency contract are implemented. The latest bounded regression passed 169/169 tests across eight kit and five fixture files; evidence is retained in `reports/2026-11-02-managed-lifecycle-regression/` at the research workspace root. A subsequent fresh real Loader run passed after the callable-disposer and non-constructible-entry fixes: 23 generated-plugin checks, 53 synthetic-fault checks, and 10 run-envelope checks, with exit status 0. See [the repository acceptance record](../testing/2026-11-02-managed-loader-lifecycle-recheck.md). This is a pinned-host integration result, not cross-version or universal plugin certification.

> **[Decided, 2026-11-01]** The user selected a **new, optional** `host-tool-managed` template. `DEFAULT_TEMPLATE` stays `'host-tool'` (`src/scaffold.js:57`); the existing template directory `templates/host-tool/**` stays byte-identical. The new template consumes the existing `registerManagedResource` API. The initial no-runtime-edit plan was superseded by a verified host compatibility defect: `managed-registration.js` now accepts callable disposer values before testing non-callable thenables, preserving the exact native function. `cleanup.js` is unchanged by this integration.
> **[Decided, 2026-11-01]** The kit is private `0.0.0` and unpublished (`package.json`). Nothing in this plan asserts npm availability, publish flow, or installation into a host profile.
> **[Decided, 2026-11-01]** Native lifetime integration is approved for implementation, not yet accepted by execution. The user selected mandatory `--kit-specifier file:<operator path>` for the optional template, recorded in `dependencies.dsh-plugin-kit`; no guessed path or automatic installation. Relative paths are interpreted relative to the generated package directory. The generator now enforces this decision; no registry availability or automatic installation is implied.

## 1. Objective

Add one optional generator template that emits a host tool plugin whose unregistration is observable through the kit's managed handle instead of an untracked `ctx.tools.register()` return value, plus explicit operator-supplied local provisioning of `dsh-plugin-kit` — with the current default template, its bytes, and its documented limits unchanged.

## 2. Current state → gaps

| ID | Existing capability | Required increment |
|---|---|---|
| D6 | `TEMPLATES` has exactly one implemented entry; `renderScaffold` throws `template "…" has no renderer` for anything else (`src/scaffold.js:39`, `:161`) | A second implemented template with its own renderer and its own tests |
| D7 | Generated `package.json` carries only exact host pins in `peerDependencies`/`devDependencies` (`src/manifest.js:80-95`) | A metadata field that records operator-supplied local provisioning of the kit, without inventing registry availability |
| D8 | Generated `index.js` calls `ctx.tools.register(...)` and discards the disposer (`src/manifest.js:158-196`); the generated test is static (`:197`) | A generated plugin whose teardown is a kit `close()` promise, and acceptance that observes that promise and the registry separately |

Why the observable handle matters: real Cordis `_unload` runs `Promise.all` over disposers with per-disposer try/catch that only logs (`vendor/cordis/src/fiber.ts:712-730`), so a fiber dispose resolving is **not** evidence that cleanup succeeded.

Host and Cordis citations resolve inside the official baseline checkout `experiments/dsh-live-lab/build-checkout` at `ce7073d51254c26cd63b22a60835b8f948deb447` (read-only for this plan).

## 3. Proposed template

`host-tool-managed`, `language: 'js'`, `status: 'implemented'`, same `referenceHost: HOST_VERSION`, rendered files identical in count to the existing template (7) plus the directory's own `README.md` prose.

Generated `index.js` keeps `name`/`version`/`inject = ['tools']`/`Config` and changes only `apply`:

```js
import { registerManagedResource } from 'dsh-plugin-kit/managed-registration';
export const apply = (ctx, config) => {          // arrow: see the note below
  const handle = registerManagedResource({
    register: () => ctx.tools.register(defineTool(/* unchanged definition */)),
  }, { label: `host-tool-managed:${name}` });
  return () => handle.close();          // fiber unload routes through the kit handle
};
```

`apply` must be a **non-constructible arrow**, not a `function` declaration. The pinned loader resolves a `{ apply }` object plugin to that exact callback (`registry.ts:222-227`) and then decides how to call it by a constructibility test defined as "owns a `prototype`" (`utils.ts:80-89`; an ordinary function does, an arrow does not). For a constructible callback the loader does `new callback(ctx, config)` and afterwards only invokes the instance's `symbols.init` hook (`fiber.ts:254-265`), so a cleanup function *returned* from that call is dropped and the kit handle would never be closed. On the non-constructible path the loader uses the returned value directly, which is where `() => handle.close()` takes effect. The generated module therefore exports `const apply = (ctx, config) => {…}` and no `ctx.effect` call, and no test hook or extra export is added to make the shape observable.

The bare specifier `dsh-plugin-kit/managed-registration` is the constant import; the **only** place a local path appears is `package.json` metadata (§3.2). `registerManagedResource` activation is synchronous and each acquisition port must return its native disposer synchronously (`src/managed-registration.js:403-461`); `ctx.tools.register` returns exactly that (`packages/core/tools/src/index.ts:128`), so the managed template needs no new kit API. Returned disposer promises are awaited by Cordis, but a rejection is only logged — hence §6.

### 3.1 Generator API fields needed

| Site | Addition |
|---|---|
| `planScaffold(options, runtime)` `src/scaffold.js:109` | `kitSpecifier?: string`; validated into `issues` under field name `kitSpecifier`; optional only for `host-tool`, **required** for `host-tool-managed` (`kitSpecifier is required for template "host-tool-managed"`) |
| `ScaffoldPlan` `src/scaffold.js:141-148` | `kitSpecifier` present (managed) or absent (host-tool) |
| `renderScaffold(plan)` `src/scaffold.js:158` | second branch; throws `template "host-tool-managed" requires kitSpecifier` when absent, mirroring the existing refusal at `:161` |
| `writeScaffold` `src/scaffold.js:231` | unchanged behaviour; inherits the plan field |
| CLI `src/cli.js:62` (value flags), `:33` (`USAGE`), `:100` (`runScaffold`) | `--kit-specifier <file:…>`; passed through as `kitSpecifier` |
| `src/index.d.ts:153-207` | `TEMPLATES` key union gains `'host-tool-managed'`; `DEFAULT_TEMPLATE` stays `'host-tool'`; `ScaffoldOptions.kitSpecifier?`, `ScaffoldPlan.kitSpecifier?` |
| `src/manifest.js` (after `:300`) | `hostToolManagedPackageJson`, `hostToolManagedIndexJs`, `hostToolManagedTestJs`, `hostToolManagedReadme`; the four existing host-tool builders are untouched |
| `src/index.js` | re-export the four new builders (required by `tests/exports.test.js:43`) |

Hard rule: `kitSpecifier` has **no default**. The generator must not derive it from `import.meta.url`, `process.env`, the kit's own location, or by scanning sibling directories — an unset value is a refusal, never a guess.

### 3.2 Metadata representation options

| Option | `package.json` | Assessment |
|---|---|---|
| A. Explicit local package path | `"dependencies": { "dsh-plugin-kit": "file:<operator path>" }` | **Recommended.** Self-describing, no registry claim, the operator's path is recorded verbatim; a stale path fails loudly at install. |
| B. Operator-provided resolution | no kit entry; README states the operator must make it resolvable (workspace link / profile install) | Keeps paths out of generated metadata, but nothing is checkable and the dependency is ambient. Documented fallback only. |
| C. `peerDependencies` + manual provisioning | a compatible kit version is required externally | **Not selected by the user.** A peer declaration expresses a requirement, not proof that the host already supplies it; this option was viable but less explicit about the chosen local source. |

Recommended minimal verified option: **A**, with `file:` required and the value recorded verbatim. `file:` makes the local-only intent explicit and excludes registry-looking ranges the unpublished `0.0.0` kit cannot satisfy. Validation is structural only (non-empty, no control characters, `file:` prefix); the generator does **not** stat the path — existence is the operator's install-time concern, not a scaffold-time claim.

Recommended leans on the open items: **P2** accept `file:` only in this phase, because a registry-shaped range would describe an artifact that does not exist while the kit is unpublished `0.0.0`; **P3** keep the generator-scoped name `kitSpecifier` instead of a general `--resolution`, so the field cannot be read as a promise about how any other dependency resolves; **P4** accept relative and absolute `file:` paths verbatim and recommend relative in the generated README, since a relative path stays valid when the operator's workspace moves.

## 4. Task breakdown

**Phase 1 — generator and declarations** (D6, D7)
- [ ] `src/scaffold.js`: catalog entry, `kitSpecifier` validation, second renderer branch.
- [ ] `src/manifest.js`: four managed builders; existing builders untouched.
- [ ] `src/index.js`, `src/index.d.ts`: re-exports and declaration unions.
- [ ] `src/cli.js`: flag, `USAGE` line, `runScaffold` passthrough.

**Phase 2 — template directory** (D6)
- [ ] `templates/host-tool-managed/` with the 7 rendered files plus its own `README.md` prose (mirrors `templates/host-tool/README.md`), including the operator provisioning instruction.

**Phase 3 — acceptance harness** (D8)
- [ ] Generated-plugin probe: in-memory registry `Map` behind a fake `ctx.tools`; call `apply`; await the returned disposer; then assert **separately** (i) the kit `close()` promise settled fulfilled and (ii) the registry map is empty.
- [ ] Negative control: a port disposer that throws → `close()` rejects `ERR_CLEANUP_SCOPE_FAILED` **and** the map still holds that entry, demonstrating that a resolved unload is not cleanup evidence.
- [ ] Real Loader gate: scaffold the actual managed variant unchanged; mount, invoke through the native executor, disable, re-enable and verify a fresh definition. Fake-context tests above are unit evidence only.
- [ ] Separate synthetic-fault plugin: use the actual managed API, observe its close rejection and individual callbacks independently from native registry cleanup, then verify old-handle repeated close cannot remove the new binding. No fault switches or test records exported by the production template. Native effects also own the exact tool disposer, so tool absence alone cannot establish managed cleanup causality.
- [ ] Explicit non-claims: no deadline/cancellation guarantee (`close()` has no timeout), no malicious same-process isolation, no cross-version compatibility.

**Phase 4 — records**
- [ ] `docs/testing/2026-11-01-managed-template-acceptance.md` in the ledger format of `docs/testing/2026-11-01-cleanup-acceptance.md`: timestamp, exact command, test list, implementation/test hashes, totals, exit codes, failures, and the two observed facts recorded separately.

## 5. File structure and write scopes

| Path | Change |
|---|---|
| `src/scaffold.js` | edit (`:39`, `:109-150`, `:158-186`) |
| `src/manifest.js` | edit (append after `:300`) |
| `src/index.js`, `src/index.d.ts` | edit (exports, `:153-207`) |
| `src/cli.js` | edit (`:33`, `:62`, `:100`) |
| `templates/host-tool-managed/**` | new directory only |
| `tests/scaffold.test.js` | edit `:40` catalog test; new renderer/plan test |
| `tests/template.test.js` | new per-template comparison block; the existing bans (no `dispose`/`close` tokens) stay scoped to `templates/host-tool/` |
| `tests/cli.test.js` | new generated-project test with a stubbed `dsh-plugin-kit`, following `:277` |
| `docs/testing/2026-11-01-managed-template-acceptance.md` | new |
| **preserved** | `templates/host-tool/**`, `DEFAULT_TEMPLATE`, existing host version pins, `src/cleanup.js` |
| **verified runtime correction** | `src/managed-registration.js` accepts callable native disposers before examining non-callable thenables; exact disposer identity is retained |

## 6. Acceptance points

1. `list-templates` shows both ids; `DEFAULT_TEMPLATE` remains `'host-tool'`; `scaffold <target>` with no `--template` renders the unchanged host-tool bytes.
2. `scaffold <t> --template host-tool-managed` without `--kit-specifier` exits `1` with the field-named issue; with `--kit-specifier file:…` it writes the template and records the string verbatim.
3. `templates/host-tool-managed/` equals `renderScaffold(plan)` byte-for-byte for the same inputs (`tests/template.test.js` pattern).
4. Acceptance observation: the kit `close()` promise outcome **and** the registry contents are asserted as two separate facts; no assertion reads a plugin/fiber unload result as cleanup evidence.
5. Negative control (§4 Phase 3) passes, proving the observation can distinguish success from swallowed failure.

## 7. Risks

| Risk | Mitigation |
|---|---|
| A recorded `file:` path goes stale | Failure is loud at install; README states re-running the generator is how the path is updated; the generator never pre-checks existence, so no false "verified" claim |
| Byte-comparison test entanglement weakens host-tool guarantees | Assertions stay per-template; the host-tool directory keeps its stricter token bans |
| Requirement §4 boundary ("never absolute paths to this workspace") vs a local path field | Operator-supplied and never auto-derived; `file:` prefix marks it as a local development reference; P4 asks for the explicit ruling |
| Acceptance reduces to "unload resolved" | Enforced by §6.4 and the §4 negative control; documented as a standing rule in the acceptance record |

## 8. Execution gate — draft fixture review

These observations apply to the in-progress fixture and must be rechecked after its author finishes; they are not executed failures.

- `experiments/dsh-live-lab/managed-cleanup/lib/host.mjs`, `treeDigest`: recursive `stat` follows dependency symlinks. Hash the explicit generated-file list, refusing redirected files, rather than traversing linked dependencies. Do not run the draft traversal after provisioning links.
- `experiments/dsh-live-lab/managed-cleanup/lib/host.mjs`, native invocation result: require an actual result with `isError === false`; absent or malformed outcomes must fail, not fall through to success.
- `experiments/dsh-live-lab/managed-cleanup/lib/record.mjs`, `emit`/`refuse`: supplementary fields must not overwrite computed status, type or assertions.
- `experiments/dsh-live-lab/managed-cleanup/lib/layout.mjs`, protected signatures: directory stat equality is only metadata evidence, not recursive content equality. Read-only filesystem mounts enforce the write boundary.
- Fixture scaffolding must explicitly supply the newly confirmed `kitSpecifier`; earlier task messages could not be delivered mid-flight, so verify the final source rather than assuming receipt.
- `fixtures/managed-fault.plugin.mjs`: its draft relative kit import resolves under `experiments/projects`, not the repository's `projects`; if copied to a temporary directory, both relative external imports become invalid. Use the provisioned bare package imports and verify module identity through the actual loaded fixture.
- The synthetic fault draft returns the native disposer directly without independently counting the managed unregister callback. Tool absence can therefore be entirely due to native fiber cleanup. Instrument a fixture-owned callback that invokes the exact native disposer and records invocation; assert that callback separately. Keep the original native effect intact, and correct comments claiming tool absence alone demonstrates continued kit cleanup.

## Appendix A. Source index

`src/scaffold.js:39` `TEMPLATES`; `:51` `DEFERRED_TEMPLATES`; `:57` `DEFAULT_TEMPLATE`; `:66` `resolveTemplate`; `:109` `planScaffold`; `:158` `renderScaffold`; `:161` refusal literal; `:231` `writeScaffold`. `src/manifest.js:80` `hostToolPackageJson`; `:123` `hostToolIndexJs`; `:158` `apply`; `:197` `hostToolTestJs`; `:300` `hostToolDeclarationJson`. `src/managed-registration.js:102-108` close/no-timeout; `:403` `registerManagedResource`. `src/index.d.ts:153-207` template and option declarations. `src/cli.js:33` `USAGE`; `:62` value flags; `:100` `runScaffold`. `tests/scaffold.test.js:40` catalog; `tests/cli.test.js:277` generated-project harness; `tests/exports.test.js:43` declaration parity. `packages/core/tools/src/index.ts:128` `register`, synchronous disposer. `vendor/cordis/src/fiber.ts:712-730` unload catch-and-log.
