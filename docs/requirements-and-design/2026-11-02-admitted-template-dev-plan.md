# Admitted template and shared provider — development plan

Date: 2026-11-02. **Status updated 2026-11-04** (§7 records the current state; the paragraphs below labelled *history* are preserved as originally written).

*Current:* provider and template are implemented; launcher, mount planning and the record validator are implemented and statically reviewed. The isolated real Loader attempt has now passed 35/35 assertions, with all predecessor steps and the external validator exiting 0; see [the real Loader record](<../testing/2026-11-04-admitted-template-loader.md>). This is bounded single-host evidence, not cross-version certification. The five arm/launcher/validator source-unit files ran once: **56 tests, 54 passed, 2 failed**, both failures being test-contract defects (a regex that skips a bare identifier, a missing import), not envelope refusals. Both test-only corrections were applied; the separate bounded recheck passed **56/56**, with both shell syntax checks passing and Node/systemd exit 0. See [the recheck record](<../testing/2026-11-04-admitted-launcher-recheck.md>). The subsequent single real Loader attempt is accepted within the report's stated boundaries; synthetic quarantine remains explicitly synthetic. The earlier 200/200 run of the original 13-file generated suite stands separately and is unaffected by the launcher slice.

*History (as written 2026-11-03):* provider and template implemented; the first bounded reference-generation attempt succeeded, but the regression failed (197/200 passed). Two template-test defects were corrected; nested generated-test process depth was reduced and failure diagnostics retained, without increasing timeout or resource limits. The corrected 13-file suite subsequently passed 200/200 in one bounded read-only attempt; this does not establish the historical timeout's cause. The separate arm source-contract tests and real Loader acceptance remain pending. See [the preserved first-attempt record](<../testing/2026-11-03-admitted-template-unit.md>), [the successful recheck](<../testing/2026-11-03-admitted-template-recheck.md>) and [the launcher regression record, 56/54/2](<../testing/2026-11-04-admitted-launcher-regression.md>).

> [Decided] Add `host-tool-admitted`; preserve both existing templates and the default.
> [Decided] Use required Cordis service injection. Missing service means native PENDING, not fallback creation.
> [Decided] The composition owner explicitly owns the coordinator. The provider publishes that exact instance and must not create/reset one on apply or disposal. Remount continuity requires the caller to reuse the instance.
> [Decided] Retain explicit operator-supplied `file:` kit dependency, no installation or production GUI changes.

## 1. Current state and gaps

`src/scaffold.js:45-62` declares two templates; `planScaffold` and public rendering both validate the optional managed template's kit dependency. `src/manifest.js:420-476` generates its non-constructible managed entry. `src/admission.js` already implements caller-shared tuple admission, clean-close release and quarantine on failure; its prior real Loader fixture passed 57 assertions, but did not exercise this generated template or service provider.

| Gap | Current | Required |
| --- | --- | --- |
| D1 | Callers manually share an admission object | Explicit provider factory, exact external object identity |
| D2 | Generated managed tool registers without admission | Separate admitted template reserves before registering |
| D3 | Previous Loader evidence uses handwritten roles | New generated-artifact and official service injection evidence |
| D4 | Provider recreation could lose quarantine | No implicit recreation; external owner retains the object |

## 2. Interfaces and ownership

- New kit subpath `./admission-provider`: `ADMISSION_SERVICE = 'pluginAdmission'`; `createAdmissionProvider(coordinator)` returns an ordinary Cordis plugin publishing the supplied object using `ctx.provide`.
- Consumer `inject` requires `tools` and the service constant. Its async arrow `apply` awaits `admit`, immediately defers the exact native registration disposer, and returns a closure calling the handle's shared `close()`.
- Claim fields are `kind: 'tool'`, `name: generated toolName`, `scope: 'global'`. The declaration must match. This string is a coordination label, not a Cordis isolation symbol.
- A missing provider does not execute the consumer. A malformed direct-call service must fail before native registration.
- Provider code does not release claims or erase quarantine. Native dependency unloading may cause consumers to cleanly close and release their own claims; rejected cleanup retains quarantine and may be logged/swallowed by Cordis. A never-settling cleanup can stall unloading. These are different cases.

## 3. Tasks and write scopes

- [x] Provider runtime, declaration and mock-port unit tests delivered.
- [x] Generator, template, CLI/catalog and generated tests delivered.
- [x] Lead reviewed exports and consistency and integrated the package subpath.
- [x] Sole execution worker ran the first bounded regression and wrote its failing repository record.
- [x] Corrected original 13-file regression passed a separate bounded attempt (200/200).
- [x] Arm/launcher source-contract and validator tests: first attempt **54/56**; two test-only corrections; separate bounded recheck **56/56**. Both historical and recheck records are retained. This is not real Loader evidence.
- [x] Isolated launcher, mount plan, preparation and record validator implemented and statically reviewed (`experiments/dsh-live-lab/admitted-template/`). Static review is not execution.
- [x] Real Loader fixture executed using unchanged generated artifacts and provider injection: **35/35**, one bounded isolated attempt.
- [x] Sole execution worker recorded command, actual envelope, exits, assertions, hashes and limitations; Lead reviewed the raw record.

No test starts while its sources are being changed. Execution budget: serial, 768 MiB memory, no swap, 32 tasks, 50% CPU, Type=exec, 120 seconds, Node old-space 384 MiB, one available-memory gate at 1200 MiB. Read back effective limits; no automatic retry or budget increase.

## 4. Acceptance

1. Old template outputs/default unchanged; explicit dependency remains mandatory only where used.
2. Provider publishes the exact supplied instance across remounts; no hidden registry or constructor fallback.
3. Missing provider prevents registration; same-domain duplicate provider is refused by the native host.
4. Two generated consumers share an actual service object; conflicting claim is rejected before the second native registration.
5. Clean unload permits explicit retry, stale cleanup cannot remove the new owner's registration.
6. Quarantine survives provider remount when the externally held instance is reused. Do not infer recovery from a new object/process.
7. Unit/source-shape evidence and real Loader evidence remain separately reported.

## 5. Risks and limits

| Risk | Mitigation |
| --- | --- |
| Distinct Cordis scopes or coordinator instances bypass mutual exclusion | Document shared service visibility and assert identity in host fixture |
| Reload mistaken for recovery | Factory never resets; retain external instance; no restart-safety claim |
| Native cleanup hides kit rejection | Independently observe close outcome and callback counts |
| Host lacks active artifacts or memory | Refuse the attempt; preserve evidence, do not alter production |
| Mock tests overstate integration | Require separate real generated-artifact host acceptance |

[Pending] Actual host evidence for this new slice. Browser UI, cross-version/cross-process coordination, arbitrary plugin interception, and recovery from process restart remain out of scope.

## 6. Static review follow-up (2026-11-03)

The initial template worker failed without delivery; its replacement is writing the generator. A full host-fixture worker also failed without delivery; the replacement task is reduced to a read-only reuse blueprint. Neither failure is a test result.

Before accepting generator delivery, recheck the generated README: a bare `new Context()` does not provide DSH tools and is not a supported full host launcher; show mounting into an existing host with explicit prerequisites instead. Limit unload-release wording to successful cleanup. Discarding the coordinator is not recovery or proof that external effects are gone. Mid-flight feedback could not be delivered through the subagent message interface, so these points remain pending review rather than assumed fixed.

Provider source and tests were statically reviewed: corrected a wrong expected error for an empty coordinator, added explicit subpath and quarantined-instance reuse tests. These tests were included in the first bounded 200-test attempt; that attempt as a whole failed. The corrected original suite subsequently passed 200/200. *Since this paragraph was written* the separately authored arm source-contract and launcher/validator tests have been written and run once (56 tests, 54 pass, 2 fail as recorded on 2026-11-04); no real Loader execution has occurred.

### Remaining host acceptance gates

- Preserve fresh-root refusal: preparation creates a previously nonexistent direct child of the fixed work directory. Do not widen the writable mount to the entire shared work directory to bypass this interface. A compatible candidate is a new, exclusive host backing directory bound over the fixed work path only inside the private mount namespace, with the runtime child initially absent. This gives preparation a writable parent without exposing sibling historical runs. Acceptance must report both the sandbox-visible path and its host backing path, verify the exact mount source, and read final records inside that namespace; a direct host-path interpretation of recorded module URLs would be incorrect. This mount layout is now implemented in `lib/mount-plan.mjs` and `lib/layout.mjs`, covered by source-unit tests only; it has not been exercised against a real host, so its behaviour there remains untested.
- Require both the consumer's FAILED state and `ERR_ADMISSION_CONFLICT` observed through public `fiber.await()`; unrelated startup failures are not admission evidence.
- The unchanged generated consumers expose no private close handle or registration counters. This arm observes public tool identity and claim state; the earlier handwritten-role evidence must remain separate for stale-close and callback-count claims.
- Label the arm-installed quarantine as synthetic state, not a generated cleanup failure.
- Validate exact assertion coverage and nonzero subprocess exits; a caught exception must force a failed record even if previous assertions passed.

### Evidence mapping for the unchanged generated consumers

| Requirement | Required observations in the new arm | Explicit limit |
| --- | --- | --- |
| Missing service does not downgrade | `boot-alpha-pending`, `boot-alpha-tool-absent`, `boot-alpha-claim-free` | No private apply counter is exposed |
| Native service injection activates the consumer | `provider-active`, `alpha-active-after-provider`, `observer-observed-coordinator` | Identity proves the supplied value, not publisher attribution by itself |
| Duplicate provider is refused | `duplicate-failed` with the native duplicate-service reason; `duplicate-did-not-replace-service` | A generic FAILED state is insufficient |
| Admission conflict protects the incumbent | `beta-failed-on-conflict` with `ERR_ADMISSION_CONFLICT`, `alpha-tool-identity-unchanged` | Does not directly count generated registration callbacks |
| Clean cleanup permits retry | `alpha-tool-absent-after-disable`, `alpha-claim-free-after-disable`, `beta-active-after-retry`, `beta-registration-fresh` | No generated private close handle is invoked by the fixture |
| Retained coordinator preserves quarantine across provider remount | `synthetic-quarantine-installed`, `provider-remount-same-coordinator`, `consumer-failed-under-quarantine`, `quarantine-remains` | Quarantine is installed synthetically, not produced by a generated cleanup fault |
| Evidence describes actual generated bytes | `generated-digest-before`, `generated-unchanged-after-run`, complete assertion coverage and successful process exits | Hashes cover selected files and are not authenticity or security certification |

Prior handwritten-role stale-close and cleanup-fault tests remain separately identified evidence. They must not be relabelled as unchanged-generated-template observations. The new arm's 35 assertions now passed in the isolated Loader attempt; this does not add private close-handle, callback-count or stale-close evidence for generated plugins.

## 7. Current state (2026-11-04)

| Slice | Implemented | Executed | Evidence |
| --- | --- | --- | --- |
| Provider runtime + declared service subpath | yes | unit/mock ports pass | `tests/admission-provider.test.js` |
| `host-tool-admitted` generator and template | yes | original 13-file generated suite 200/200, one bounded attempt | [recheck](<../testing/2026-11-03-admitted-template-recheck.md>) |
| Launcher `run-isolated.sh`, `payload.sh`, `prepare.mjs` | yes, statically reviewed | both syntax checks pass; five-file recheck 56/56 after first 54/56 | [launcher recheck](<../testing/2026-11-04-admitted-launcher-recheck.md>) |
| Mount plan `lib/mount-plan.mjs`, layout `lib/layout.mjs` | yes, statically reviewed | source-unit coverage; real host acceptance pending | same record |
| Record validator `validate-records.mjs` | yes, statically reviewed | source-unit recheck passes after missing test import corrected | same record |
| Arm observations against real Loader | implemented | **35/35**, single isolated attempt | [host acceptance](<../testing/2026-11-04-admitted-template-loader.md>) |

Two failures in the 56-test run are test-contract defects: an id list extracted by a
quoted-literal regex excludes the trailing bare `COVERAGE_ID` identifier, and
`validator.test.mjs` omits `EXTERNALLY_OWNED_STEPS` from its import block. These failures were traced to the tests, not a runtime failure. Both tests have now
been corrected without runtime edits. The separate corrected recheck passed 56/56;
this does not establish real Loader behaviour. The 200/200 figure belongs to
the original generated suite and to nothing in this launcher slice.

## Appendix A. Source anchors

Paths below are relative to the research workspace unless noted.

| Context | Source |
| --- | --- |
| Native provide registration, duplicate check, retirement | `experiments/dsh-live-lab/build-checkout/vendor/cordis/src/reflect.ts:291-327` |
| Dependent cleanup then top-level effect cleanup | `experiments/dsh-live-lab/build-checkout/vendor/cordis/src/fiber.ts:712-736` |
| Existing template catalog and dependency validation (kit-relative) | `src/scaffold.js:45-62,130-181` |
| Existing generated managed entry (kit-relative) | `src/manifest.js:420-476` |
| Prior admission host evidence (kit-relative) | `docs/testing/2026-11-02-admission-loader.md` |
