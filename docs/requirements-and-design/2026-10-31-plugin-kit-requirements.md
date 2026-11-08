# Plugin development kit — Requirements and delivery plan

Date: 2026-10-31, revised 2026-11-02; current-state counts refreshed 2026-11-08. Status: P1 delivered; **P2 met in a bounded, single-version form** (one real Loader launch on the pinned host observed the managed teardown); P3 unimplemented; **P4 partially implemented** (`migrate` exists as a Skill; `debug`, `release` and a measured second-version matrix do not). **Three** JavaScript templates are implemented as of 2026-11-08 (`host-tool`, `host-tool-managed`, and the kit-dependent `host-tool-admitted` added with the admission work); `client` and `combined` remain deferred. The catalog is three Skills (`scaffold`, `verify`, `migrate`) and twelve test files.

The executed-figure history is dated, not current. The `111` tests across 8 files, the `169` bounded regression and the `152` kit run were each produced by a specific run in 2026-11-02 and are kept as snapshots of the code as it stood then: none of them covers the three-template, twelve-file suite that exists now, and no case count is claimed for the current suite. The one separate launch recorded `86` assertions — two different runs from the suite figures, never summed (§8.10). The superseded first-slice figures (one template, 54 tests) are preserved and labelled historical in §8.1.

> **[Decided, 2026-10-31]** Independent local repository for a thin author dependency library, TS/JS templates, test utilities and development Skills. Do not replace Cordis authoring or install into the current host. No remote or publication in this phase.
>
> **[Decided, 2026-11-02]** Evidence classes are not additive. The one-launch Loader recheck (`86` assertions across three records) and the bounded `node --test` regression (`169` tests) were produced by different runs on different substrates; they are reported separately and never summed into a combined certification, and neither is a global host-admission claim.

## 1. Objective

Let authors build ordinary DSH plugins with protocol declarations, explicit ownership, repeatable checks and versioned instructions. The requested author library is distinct from the official SDK for driving a DSH subprocess over JSON-RPC.

## 2. Current state → gaps

| ID | Existing capability | Required increment |
|---|---|---|
| D1 | Cordis apply/Config exports, effects and service injection | Thin protocol validators/helpers preserving those exports |
| D2 | Native tools.register and scoped restrictions | Author examples and validation, not a second registration store |
| D3 | Official documentation and manual package conventions | Tested host/client/combined scaffolds and generated-project checks |
| D4 | Official skill registry plus existing Skill Hub | Versioned development Skills using the same CLI/checks |
| D5 | Direct Cordis tests are narrower than product integration | Test harness distinguishing direct mount from real Loader/profile and browser evidence |

Official source pin is `ce7073d51254c26cd63b22a60835b8f948deb447` (0.2.2-alpha.2); previously installed 0.2.1-rc.2 is a separate candidate baseline. No supported range is claimed at bootstrap.

**Implemented surface (P1, still current).** `src/cli.js` (`scaffold`, `list-templates`, `check`, `help`), `src/protocol.js` (explicit `0.1.0-draft.1` declarations plus `validateWith(value, validator)` at `src/protocol.js:217`), `src/manifest.js` (input checks and file renderers), `src/scaffold.js` (plan/render/write with refusal on an existing target), `src/internal/value.js` (thenable predicate shared by the adapter and the CLI), and `skills/{scaffold,verify,migrate}/SKILL.md`. The template catalog is `src/scaffold.js:50` (`TEMPLATES`: `host-tool` default, `host-tool-managed` opt-in, `host-tool-admitted` kit-dependent); `src/scaffold.js:78` lists the kit-dependent ids and `src/scaffold.js:86` (`DEFERRED_TEMPLATES`) refuses `client` and `combined`. The kit has no runtime dependencies and no peer dependencies; the *generated* project pins each host package to its own exact reviewed version — `@deepseek-ai/cordis@4.0.6-alpha.1`, `@deepseek-ai/schemastery@3.18.6-alpha.1`, `@deepseek-ai/dsh-tools@0.2.2-alpha.2` — as both peer and dev dependencies, because those three versions are unrelated and one shared range would be wrong. `engines` declares `node: ">=24.9.0"` (the official packages' requirement) and `dsh: "0.2.2-alpha.2"` as exact literals.

**Implemented surface (P2).** Two author-side modules carry managed teardown, both reachable as package entry points (`./cleanup`, `./managed-registration`) and re-exported from the root index. `src/cleanup.js:170` (`createCleanupScope`) is a caller-owned scope: it records disposers the caller already owns, drains them in reverse registration order, and settles once; it holds no module-level registry and identifies registrations by handle identity, not by name or kind. `src/managed-registration.js:450` (`registerManagedResource`) mounts one native registration through four named ports (`PORT_NAMES` at `src/managed-registration.js:144`: `register`, `subscribe`, `publish`, `deactivate`), validates them, records the exact disposer the port returned, and exposes a `close()` that runs it once and returns one shared promise. Acquisition failures throw typed errors (`ManagedRegistrationPortsError`, `ManagedRegistrationFailure` and subclasses at `:227`–`:341`) after rolling back what was acquired in `TEARDOWN_ORDER` (`:151`). Neither module talks to a host, patches `ctx`, or claims to be a resource manager.

## 3. Required behavior

The author library imports without registering plugins, starting servers or changing profiles. Preserve native `apply`, `Config`, `inject`, Service and effect semantics. Do not deep-import private compiled model-selection helpers. Use public package exports and validated peer dependencies; avoid bundling another host-service instance.

Scaffolds must emit ESM packages with explicit host/client build boundaries, appropriate native bundle metadata, tests and documentation. Actual client registration signatures must be reviewed before generating client code. The generator must not overwrite existing user files silently.

Skills cover design, scaffold, implement, migrate, verify, debug and release. They call the same versioned library/CLI checks rather than duplicating algorithms in prompts. Skill discovery stays with the official registry and existing Skill Hub; bootstrap creates no active SKILL.md and installs nothing.

| Proposed input/output | Important fields | Authority |
|---|---|---|
| Scaffold request | target directory, template ID/version, host target, language | Explicit user selection |
| Declaration validation | protocol version, findings, source locations | Protocol schema plus actual source |
| Verification report | runner/version, scenarios, host version, evidence class, limitations | Executed runner; skipped tests remain skipped |
| Skill compatibility | supported kit/protocol/template versions | Released artifact metadata, not guessed versions |

## 4. Dependency and ownership boundaries

Consume versioned contracts from dsh-compat-spec. dsh-compat-platform may consume this kit; the kit must work without the platform installed. Missing required managed coordination is an explicit refusal, while SDK-only operation must not claim global reservations.

Keep ownership with native fibers/effects. Additional protocol metadata records declarations and diagnostic identities, not a replacement resource manager. Cross-repository integrations use explicit release versions or immutable development references, never absolute paths to this workspace.

## 5. Delivery and acceptance

- [x] Create scope, roadmap and empty package/template/skill/test directories.
- [x] P0 (partial): protocol subset fixed at `0.1.0-draft.1` with `plugin`/`capabilities`/`resources`; exported interfaces reviewed against the pinned sources (`defineTool`, `ctx.tools.register`, package-manifest `dsh.bundle`); host target pinned to `0.2.2-alpha.2`. A semver compatibility range is still [Pending].
- [x] P1 (host-only): explicit declarations, host `host-tool` template, zero-dependency CLI, `scaffold`/`verify` Skills. The thin validation library is deliberately limited to `validateWith` injection of the protocol owner's validator: the kit implements no protocol rules at all, has no shape checker, no resource-kind list and no scope vocabulary, and `check` refuses to run without `--validator <module>` (`src/cli.js:209-210`). A first draft shipped a kit-owned `checkDeclarationShape`, a closed `SCOPES`/`RESOURCE_KINDS` vocabulary, a `joinPath` formatter, an `exampleServiceDeclaration` helper and a shared `HOST_PEER_RANGE`; all were removed as a second, partial copy of the protocol owner's rules.
- [x] P2 (bounded, one host version): a generated plugin was booted in a real isolated profile and its fiber dispose was observed taking the tool down. The `host-tool-managed` artifact was scaffolded by the real generator, loaded, and torn down by the host; the pinned host's fiber cleanup called `close` exactly once, the scope kept draining past a throwing `unsubscribe`, and generation-2 cleanup ran exactly once at host teardown (`docs/testing/2026-11-02-managed-loader-lifecycle-recheck.md`, records `23/23`, `53/53`, `10/10`). **Not** claimed: cross-version behaviour (one pinned version only), any browser/client evidence, or that the synthetic-fault arm says anything about a real upstream defect.
- [ ] P3: client/combined template with actual browser integration and build-artifact smoke. Not implemented: `DEFERRED_TEMPLATES` refuses both ids (`src/scaffold.js:86`), and no browser evidence exists for any template.
- [ ] P4 (partial): migration/debug/release workflows and a measured second-version matrix. **Partially implemented:** `migrate` exists as a third Skill, but no `debug` or `release` Skill exists, and no second host version has been measured.

Acceptance: generated projects build independently; missing required capability fails; duplicate tool registration follows host semantics; cleanup failures and concurrency are tested; no hidden live-profile mutations; published artifacts rather than source-only imports are exercised. No package.json or test-success claim is emitted before real implementation exists.

## 6. Risks and pending decisions

| Risk | Mitigation |
|---|---|
| SDK becomes another framework | Preserve native exports and effects; justify every helper with a consumer |
| Templates drift from host | Generated-project CI on pinned versions |
| Skills become a parallel implementation | Call shared executable checks; version Skill metadata |
| Duplicate SDK copies split state | No module-global registry; test multiple copies at the service boundary |
| One passing launch read as a compatibility claim | Report the launch with its single version, single root and synthetic-fault labelling; never sum it with the suite run |

**[Pending]** License, npm scope, package names, first host release, build tooling and TS/JS fixture matrix. Recommendation: one pinned host first, no broad peer range without tests. Review upstream licenses before any code/template reuse; no upstream code is copied in this bootstrap.

## 7. Layout

`packages/` is reserved for author helpers, test utilities and CLI; `templates/` for generated project sources; `skills/` for future versioned workflows; `tests/` for generated-project and integration checks. Placeholder directories are not implemented packages or installable Skills.

The implemented kit lives at the repository root instead of `packages/` (decision: one package, no workspace), so the root `package.json` is the package itself:

| Path | Contents |
|---|---|
| `package.json` | private `dsh-plugin-kit@0.0.0`, `type: module`, `bin`/`main`/`types`, `exports` for `.`, `./cleanup`, `./managed-registration`, `./admission`, `./admission-provider`, `./cli`, `./package.json`, `files` = `src/`, `templates/`, `skills/`, `scripts.test` — no dependencies, no peers, no license chosen. |
| `src/protocol.js` | `PROTOCOL_VERSION`, `HOST_VERSION`, `HOST_ENGINE`, `NODE_ENGINE`, `GENERATED_DEPENDENCIES` (one exact pin per host package), `HOST_PEERS`, `DEFAULT_SCOPE`, `toolDeclaration`, `validateWith`, `describeDeclaration`. No local shape checker, resource-kind list or scope vocabulary. |
| `src/manifest.js` | `checkScaffoldInputs`, `checkKitSpecifier` and the generated-file renderers. The renderers are shared across all three implemented templates; the kit-dependent variants add the kit dependency row on top of the same base render set. |
| `src/scaffold.js` | `TEMPLATES` (`host-tool`, `host-tool-managed`, `host-tool-admitted`), `KIT_DEPENDENT_TEMPLATES` (`host-tool-managed`, `host-tool-admitted`), `DEFERRED_TEMPLATES` (`client`, `combined`), `DEFAULT_TEMPLATE`, `planScaffold`, `renderScaffold`, `writeScaffold`, `describeScaffoldPlan`, `resolveTemplate`. |
| `src/cleanup.js` | `createCleanupScope` (caller-owned LIFO drain, settle-once) and `CleanupScopeClosedError`. |
| `src/managed-registration.js` | `registerManagedResource`, `PORT_NAMES`, `TEARDOWN_ORDER` and the typed failure classes. |
| `src/internal/value.js` | `isPromiseLike` — shared by the adapter and the CLI; not part of the public surface. |
| `src/cli.js` | `scaffold`/`list-templates`/`check`/`help`; exit `0`/`1`/`2`; no server, watcher or network. |
| `src/index.js`, `src/index.d.ts` | Public re-exports and hand-written types. |
| [templates/host-tool/](../../templates/host-tool/) | Byte-compared reference rendering of the default template ([tests/template.test.js](../../tests/template.test.js)). |
| [templates/host-tool-managed/](../../templates/host-tool-managed/) | Byte-compared reference rendering of the opt-in managed variant ([tests/managed-template.test.js](../../tests/managed-template.test.js)). |
| [templates/host-tool-admitted/](../../templates/host-tool-admitted/) | Byte-compared reference rendering of the kit-dependent admitted variant ([tests/admitted-template.test.js](../../tests/admitted-template.test.js)). |
| [skills/scaffold](../../skills/scaffold/), [skills/verify](../../skills/verify/), [skills/migrate](../../skills/migrate/) | Repository-local workflows; not installed into any registry. |
| `tests/*.test.js` | Twelve files as of 2026-11-08: `admission`, `admission-integration`, `admission-provider`, `admitted-template`, `cleanup`, `cli`, `exports`, `managed-registration`, `managed-template`, `protocol`, `scaffold`, `template`. The recorded suite count for this set is **200**, and it is not a kit-only figure: the run named twelve `tests/*.test.js` files plus one experiment file, [experiments/dsh-live-lab/admitted-template/tests/layout.test.mjs](../../../../experiments/dsh-live-lab/admitted-template/tests/layout.test.mjs), as thirteen literal paths with no glob. Two runs used exactly that list and nothing else in it: the [reference-generation run](../testing/2026-11-03-admitted-template-unit.md) **failed** at 200 tests / 197 pass / 3 fail and was recorded as a failure, and the [read-only recheck](../testing/2026-11-03-admitted-template-recheck.md) passed 200/200 over frozen sources. Two of the twelve files (`admitted-template.test.js`, `cli.test.js`) were edited between those two runs, so the two 200-figures are not the same bytes. This round did not re-run the suite and did not diff current bytes against the 2026-11-03 sources, so treat 200 as the 2026-11-03 figure for this file set, not as a measurement of today's tree. Earlier dated figures cover smaller sets: [2026-11-02 `152`-case run](../testing/2026-11-02-resource-admission.md) at ten files (111 kit + 34 admission + 7 mock-port, before `admitted-template.test.js` existed) and the 8-file / `111`-case regression before the admitted template. The [admitted review-regressions slice](../testing/2026-11-03-admitted-review-regressions.md) is 16/16 over two experiment files and explicitly does not re-establish the 200 result, which covered eleven other kit files outside its scope. None of these figures is additive. |

## 8. Implementation limits (verified)

These are the states the current code actually reaches; anything absent here is unimplemented. Every item below is bounded by the run that produced it — none is a compatibility range, a release claim or a global admission claim.

1. **Three templates, JavaScript only.** `host-tool` is the default; `host-tool-managed` is opt-in and requires an explicit local kit specifier; `host-tool-admitted` is the third, kit-dependent variant added with the admission work. `client` and `combined` are listed as deferred and refused with exit `1`. No TypeScript output, no build step, no bundler config.
2. **Host evidence: one pinned version, one method split.** The reviewed interface is `0.2.2-alpha.2` at pin `ce7073d51254c26cd63b22a60835b8f948deb447`. The *suite* still checks the emitted plugin by reading the generated test's assertions against a stub of the three host packages; the *real-host* evidence is the separate 2026-11-02 launch against the pinned `build-checkout` (itself at `ce7073d5…`, version `0.2.2-alpha.2`). No second version, no range and no upgrade path is measured; `engines.dsh` is an exact version literal, not a tested range, but it is **not** inert: the host's own compatibility check reads it and can refuse an incompatible declaration, as the [toolkit exemption record](../testing/2026-11-06-toolkit-loader-exemption.md) shows from the other side — `Plugin @deepseek-ai/dsh-toolkit@0.0.1 is incompatible … Exact-version exemption: not active`. An approved temporary-profile exemption is a local experimental grant, not native compatibility, and none of it establishes a supported range.
3. **Live-profile evidence exists, in a bounded form.** One launch, one transient unit, one fresh isolated DSH home inside one `bwrap` sandbox: the generated `host-tool-managed` artifact booted, the host's fiber cleanup called `close` once, the scope drained past a throwing `unsubscribe` to run the counted disposer exactly once, and host teardown removed the live registration. **Bounds:** a single launch with no retry; `memory.peak` unavailable because `--collect` deleted the transient unit; the fault arm injects a *synthetic* `SyntheticUnsubscribeFault` and therefore says nothing about any real upstream or generated defect; the generated arm asserts the artifact's cleanup path is *not* failing. Nothing here is installed into a persistent profile, no `dsh plugin add` is run, and the run root is spent.
4. **`check` still delegates; the kit owns no rules.** `check` requires `--validator <module>` and exits `2` without one (`src/cli.js:209-210`), then reports exactly what that module answers; a verdict is always labelled as that validator's, never as host acceptance, loading or execution evidence. The authoritative verdict comes from `validateWith(value, validateDeclaration)` with the `dsh-compat-spec` validator. The caller-shared `./admission` helper is now implemented and covered by the 2026-11-02 [152-case kit run](../testing/2026-11-02-resource-admission.md) at 10 files, including 34 admission cases and seven real-kit/mock-port compositions; that run predates `admitted-template.test.js`, so it does not cover the current twelve-file suite. Its tuple checks are bounded runtime argument validation, not a replacement for the injected protocol validator. That **152-case batch** establishes no real Loader admission and no global host claim; separate later records do cover a real Loader — the [2026-11-02 admission-loader launch](../testing/2026-11-02-admission-loader.md) (57/57 assertions, `run.json` `status=passed`) and the [2026-11-04 admitted-template Loader run](../testing/2026-11-04-admitted-template-loader.md) (35/35 assertions, 3/3 predecessor steps rc 0) — each bounded to its own single launch, version and scope.
5. **No packaging or release.** No `npm publish`, no tarball, no version-stamping audit published as such; `files` is declared but unexercised. The suite is invoked directly as `node --test "tests/*.test.js"`; whether an `npm` client exists on a given host is environment state and is deliberately not asserted here.
6. **No platform runtime integration.** `dsh-compat-platform` is not consumed. The kit can reserve tuples within an explicitly shared admission coordinator and refuse competing callbacks; callers bypassing that coordinator, other processes and native host registrations remain outside its control.
7. **Skills are local files only.** [skills/scaffold/SKILL.md](../../skills/scaffold/SKILL.md), [skills/verify/SKILL.md](../../skills/verify/SKILL.md) and [skills/migrate/SKILL.md](../../skills/migrate/SKILL.md) describe the implemented CLI commands; none is registered in any skill registry. The hand-execution history belongs to `scaffold` and `verify` only, which were run by hand against a scratch directory rather than by a runner. `migrate` is newer than that history: its file exists, but no execution of it was recorded, so its presence is not evidence that it was ever run.
8. **Generator guarantees and their bounds.** Refusal is an `existsSync` check followed by `mkdir` without `recursive` and per-file `open(path, 'wx')`, so an existing target and an existing file both fail; containment is checked against the resolved target. This is not atomic across a teardown race, and `--dry-run` still reports the plan for an existing directory.
9. **Declaration schema is fixed.** `0.1.0-draft.1` with `schemaVersion`, `plugin.{id,version}`, `capabilities.{required,optional}` and `resources[].{kind,name,scope}`; every field is always emitted (never omitted, `[]` when empty). The kit emits no additional fields and has no migration path for a later schema revision.
10. **Two evidence classes, not one certification.** `docs/testing/2026-11-02-managed-lifecycle-regression.md` records `169/169` in one bounded unit (`768M` memory, swap off, 32 tasks, 50 % CPU, `120 s`), of which `111` are kit tests across 8 files and `58` are fixture tests across 5; `memory.peak = 76361728` B (≈ 72.82 MiB) and `38/38` compared files were byte-identical. That record explicitly does **not** cover a real Loader boot, a managed teardown, or a plugin host. The lifecycle recheck covers exactly those and nothing statistical. Summing `86 + 169` would describe no run that happened; the two are cited separately. (That regression also preserves a `TEST_FILES=0` parse defect in its own derived summary, against an invocation that plainly reads `13` files.)

### 8.1 Historical first slice (2026-10-31, superseded)

Kept as written so the earlier claim stays checkable, and explicitly **not** current:

- One template only (`host-tool`), with `client`/`combined` deferred; no managed variant.
- A single suite of **54 tests** in `tests/*.test.js`, before `cleanup`, `managed-registration`, `managed-template` and the fixture arms existed.
- No real Loader ever booted: the emitted plugin was verified only against stubs, and "no live-profile evidence" was the correct statement then — P2 had not been attempted.
- `check` already required `--validator <module>`; that part is unchanged.

Where the older text asserted host-package absence in this workspace or the absence of an `npm` client, those were environment inventories rather than kit facts and are replaced by §8 items 2 and 5 above: what is documented is the evidence class, not a snapshot of a machine.

## Appendix A. Sources

- [Official tool registration and restrictions](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/core/tools/src/index.ts#L120-L188).
- [Application launch through profiles, lines 41–47](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/docs/architecture.md#L41-L47).
- [Real entry-path testing, lines 35–41](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/docs/testing.md#L35-L41).
- [Shipped child-tool exports, lines 16–35](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/subagent/tool-subagent/package.json#L16-L35).

## Appendix B. Evidence index (in-repository)

| Document | What it is evidence for |
|---|---|
| [2026-11-02-managed-loader-lifecycle-recheck](../testing/2026-11-02-managed-loader-lifecycle-recheck.md) | The single real launch: launcher exit `0`, records `23/23` + `53/53` + `10/10`, the four lifecycle questions, the unchanged 7-file generated artifact, and its interpretation limits. |
| [2026-11-02-managed-lifecycle-regression](../testing/2026-11-02-managed-lifecycle-regression.md) | The bounded `node --test` envelope: `169/169`, kit/fixture split, cgroup readings, `38/38` hash identity, and what it explicitly does *not* support. |
| [2026-11-02-managed-loader-768-acceptance](../testing/2026-11-02-managed-loader-768-acceptance.md) | The predecessor attempt that never launched — recorded as a non-result, not as Loader evidence. |
| [2026-11-03-admitted-template-unit](../testing/2026-11-03-admitted-template-unit.md) | Generation passed, suite **failed**: 200 tests / 197 pass / 3 fail over the thirteen literal files, launcher exit `1`, no retry. |
| [2026-11-03-admitted-template-recheck](../testing/2026-11-03-admitted-template-recheck.md) | The same thirteen files at 200/200 under a read-only sandbox with the reference tree frozen; not Loader evidence. |
| [2026-11-03-admitted-review-regressions](../testing/2026-11-03-admitted-review-regressions.md) | A separate two-file experiment slice, 16/16, which explicitly does not re-establish the 200 result. |
| [2026-11-02-resource-admission](../testing/2026-11-02-resource-admission.md) | The 2026-11-02 bounded run at ten files / `152` cases (111 kit + 34 admission + 7 mock-port). |
| [2026-11-02-admission-loader](../testing/2026-11-02-admission-loader.md) | A real Loader launch: 57/57 assertions, `run.json` `status=passed`. |
| [2026-11-04-admitted-template-loader](../testing/2026-11-04-admitted-template-loader.md) | The 2026-11-04 real Loader run for the admitted template: 35/35 assertions, 3/3 predecessor steps rc 0. |
| [2026-11-06-toolkit-loader-exemption](../testing/2026-11-06-toolkit-loader-exemption.md) | The host's own `engines.dsh` compatibility gate observed refusing an incompatible plugin, and what a temporary exemption does and does not mean. |
| [README.md](../../README.md) | Template catalog and the author-facing description of the managed variant's teardown limits. |
