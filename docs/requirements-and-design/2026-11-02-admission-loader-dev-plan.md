# Resource admission — real Loader acceptance plan

> Date: 2026-11-02. Status: first unit attempt 88/91 (three confirmed matcher defects); independent [unit recheck](../testing/2026-11-02-admission-fixture-recheck.md) passed 91/91. The manager's `RuntimeMaxUSec=2min` readback prompted strict duration parsing; the subsequent [six-file verification](../testing/2026-11-02-admission-duration-recheck.md) passed 110/110, including behavioural execution of the awk helper. The single isolated real Loader attempt passed all 57 required assertions with launcher and step exits 0; raw evidence is retained under `docs/testing/runs/20261102T150305Z-admission-loader/`. The [repository execution record](../testing/2026-11-02-admission-loader.md) is complete and reviewed. This is one pinned headless Loader composition, not universal host compatibility. Historical failure evidence is retained in [the unit record](../testing/2026-11-02-admission-fixture-unit.md).
> [Decided] Continue the accepted caller-shared helper into isolated real Loader verification. Preserve production, the current GUI, existing managed-cleanup evidence and kit source unless a separately reviewed defect requires correction. ds4.1flash authors fixtures and execution records; Lead reviews.

## 1. Current state and gaps

The prior [admission record](../testing/2026-11-02-resource-admission.md) reports 152 passing kit tests, including seven mock-port compositions. That is not Loader admission evidence.

| Gap | Existing evidence | Required increment |
|---|---|---|
| D1 | Synchronous tuple reservation before callback | Two real Loader entries share exactly one coordinator and compete while the first activation is gated |
| D2 | Mock-port clean close and retry | Real native tool registration, observed close settlement, unload and fresh retry |
| D3 | Quarantine and stale handle unit cases | Independent failure observations despite Loader error logging; old handle cannot disturb a newer admitted entry |

## 2. Implementation scope

New caller-owned fixtures live under `experiments/dsh-live-lab/admission/` in the research workspace. Reuse the existing headless boot helper, not direct plugin invocation or a fake Loader. Provision explicit local package links inside a fresh runtime root. Do not change the generated template to pretend it already integrates admission.

Use non-constructible async plugin entries returning the admission close callback. Inject or hand off one coordinator with a verifiable shared identity; independent coordinators are not a valid conflict test. Normal service provision is not monkeypatching, but this slice should use the narrowest explicit fixture handoff.

## 3. Acceptance sequence

1. Enable A; observe entry into the admitted callback and pause it with an explicit gate. Do not interpret `loader.update()` fulfillment as activation completion.
2. Enable B for the same tuple. Observe B's plugin entry, `ERR_ADMISSION_CONFLICT`, zero admitted callback/native registration counts, and unchanged claim count.
3. Release A's gate; observe ACTIVE and native tool identity. Only then unload A. Independently observe its close settling successfully and the claim count returning to baseline.
4. Retry B using a fresh Loader lifecycle. Observe a new definition and admitted handle. Invoke A's old close; require the same Promise, no new cleanup calls, and unchanged B identity/claims.
5. For a separate tuple, inject a labelled cleanup failure. Record close rejection independently of Loader unload outcome; verify later competing activation is rejected before its callback. Observe counted native cleanup rather than inferring it from tool absence.
6. Include the activation-failure scenario (case D). Distinguish rollback completion from claim release: the current helper deliberately quarantines any failed activation. Do not remove this case after execution to obtain a passing verdict.
7. Dispose the actual host; absent context or missing dispose support is failure, not successful teardown. Natural exit is required.

## 4. Evidence and execution gate

- One fresh attempt after source review; no automatic retry. No installation or build is required.
- Serial execution: MemoryMax=768M, MemorySwapMax=0, TasksMax=32, CPUQuota=50%, Type=exec, RuntimeMaxSec=120; Node old-space=384 MiB.
- Verify effective resource limits before workload. Sample MemAvailable once inside the unit; refuse below 1200 MiB. Do not poll until it passes.
- Read-only root, private PID/network/IPC/UTS, temporary home and explicit writable runtime bind; no production home configuration loads.
- Persist command, exits, raw structured assertions, source hashes before/after, effective caps, accounting when available, and all failures/refusals. Requested values and measured values are distinct. Post-collection defaults are not historical limits.
- Execution worker writes `docs/testing/2026-11-02-admission-loader.md`; skeleton status stays NOT RUN until actual evidence exists.

## 5. Risks and pending boundaries

| Risk | Mitigation |
|---|---|
| Async entry completes after disposal | This slice unloads only after observed ACTIVE; cancellation during activation remains unverified, not a claimed reproduced host defect |
| Loader logs cleanup errors but fulfills unload | Observe the exact admission close Promise and independent callback counters |
| Native effect removes tools without kit cleanup | Count the wrapper invoking the exact native disposer and assert claim transitions independently |
| Duplicate module instances | Verify coordinator handoff identity and import the exact provisioned fixture URL |
| A gate remains unresolved after failure | Arrange failure-path gate release and host disposal; outer unit deadline bounds the process, not plugin safety |

[Verified, bounded scope] One real headless Loader run passed 57/57 assertions: shared coordinator identity, gated LOADING → ACTIVE, conflict before admitted callback/native registration, clean unload and retry, stale close protection, and cleanup/activation failure quarantine. No Web, browser, cross-version, cross-process or universal compatibility claim. No forced quarantine reset or deadline API is added. The outer sampler observed cgroup high-water 174071808 bytes; collection prevented a guaranteed final peak reading. Execution-process deviations and historical failed unit attempts remain in the testing records.

## Appendix: reviewed source anchors

Paths below are research-workspace relative.

| Source | Relevant behavior |
|---|---|
| `projects/dsh-plugin-kit/src/admission.js:656-699` | `admit`: reserve before callback; activation failure quarantines and drains registered cleanup |
| `projects/dsh-plugin-kit/src/admission.js:716-754` | shared close Promise; release only after successful cleanup |
| `experiments/dsh-live-lab/managed-cleanup/lib/host.mjs:117-157` | real profile, overlays, app-boot and Loader |
| `experiments/dsh-live-lab/build-checkout/vendor/loader/src/config/entry.ts:213-237` | init attaches fiber readiness observer without awaiting activation completion |
| `experiments/dsh-live-lab/build-checkout/vendor/cordis/src/fiber.ts:362-380` | async effect result collects its resolved disposer |
| `experiments/dsh-live-lab/managed-cleanup/lib/host.mjs:528-541` | host teardown outcome, including explicit absent result |
