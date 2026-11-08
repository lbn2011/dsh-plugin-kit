# Admission Loader fixture — static review

> Date: 2026-11-02. Status: static corrections reviewed; first bounded five-file attempt 88/91, then matcher-only corrections and an independent 91/91 recheck. The duration correction subsequently passed the six-file 110/110 bounded verification, including actual awk helper execution. The single real Loader attempt passed 57/57 assertions with zero step/launcher exits; see [the executed record](../testing/2026-11-02-admission-loader.md). §4 records the resolved pre-host issue. The findings below describe the original draft, not the current implementation. Related [acceptance plan](2026-11-02-admission-loader-dev-plan.md).

## 1. Current state and required corrections

The isolated fixture has received source-only corrections from three delegated areas. Lead additionally fixed the obsolete 51-assertion pin, `selfCheck.ok` field use, root-refusal fail-closed behavior, final JSON null rejection, cleared the supervisor record-check environment with an explicit heap flag, corrected a normalized-away `..` test input, and added gate release → pending fiber settlement → host disposal ordering. The existing kit implementation is not changed by this review. Those edits are not executed evidence; the unit attempt is recorded separately.

| Gap | Draft observation | Required correction |
|---|---|---|
| D1 | `experiments/dsh-live-lab/admission/fixtures/admission-core.mjs:39-48,123-124` floats admission, falsely claiming Loader update awaits activation | Await admission in the non-constructible async entry; record and rethrow failures. Actual `experiments/dsh-live-lab/build-checkout/vendor/loader/src/config/entry.ts:213-237` does not await fiber activation. |
| D2 | `experiments/dsh-live-lab/admission/lib/expectations.mjs:24` requires ACTIVE while gated | Require LOADING while gated, then ACTIVE after admission settles; rejected competitors must have independent trace and lifecycle evidence. |
| D3 | `experiments/dsh-live-lab/admission/lib/record.mjs:50-56,94-96` supplementary fields can override computed assertion/refusal fields | Reject reserved supplementary keys; add negative tests. Avoid forced exit after a host has booted. |
| D4 | `experiments/dsh-live-lab/admission/lib/record.mjs:134-197` structural validation is not success validation | Aggregate acceptance requires fixed assertion coverage, all true/no skipped, matching passed status, and exact zero process exits. Reject malformed collections without accidental success. |
| D5 | `experiments/dsh-live-lab/admission/lib/layout.mjs:15,101` uses pathToFileURL without import | Import explicitly and exercise path construction in bounded unit tests. |
| D6 | `experiments/dsh-live-lab/admission/lib/layout.mjs:140-144` permits root equal to approved work directory | Require a canonical fresh strict child of the fixed admission work root; independently enforce in launcher before creating logs or writable binds. |
| D7 | Draft calls hashes signed sources and treats a fixed token as identity proof | Describe selected content digests only; compare actual shared coordinator object and resolved URL. |

## 2. Additional launcher blockers

The draft `experiments/dsh-live-lab/admission/run-isolated.sh:105-118` accepts unlimited task/CPU limits; require finite positive values within the agreed bounds. At `:149`, it creates the supplied path before canonical containment validation; validate the fixed work parent and strict child first, then create only that fresh child. Its freshness check accepts existing artifacts and ignores hidden entries. At `:213-228`, it ignores nonzero payload status and can announce success from stale or inconsistent JSON; require exact zero status before accepting validated records. Invoke the launcher through explicit Bash, not a potentially non-executable source file. Compare runtime microseconds directly without rounding down.

`experiments/dsh-live-lab/admission/payload.sh:34-59` continues into host preparation/execution after a failed heap probe. Stop immediately on failed preconditions. V8 total heap statistics are not old-space measurements.

`experiments/dsh-live-lab/admission/arm.mjs:523-537` must release the explicit activation gate in failure cleanup before awaiting host disposal, and settle any pending activation appropriately. Its coverage calculation includes `expected-assertions-all-present` before recording that assertion, causing a self-referential missing item; exclude only the sentinel from its own preliminary check, then require the full set in the final external validator.

`experiments/dsh-live-lab/admission/validate-records.mjs:63,93-117` omits the prepare/arm exit statuses and the parser verdict from its success predicate. A self-check failure can leave a persisted `status: passed` even while the process exits nonzero. Derive one final verdict from parsing, exact fixed assertion coverage, assertion outcomes, matching arm status, and strict numeric zero step exits; use that verdict consistently for the stored record, stdout and process exit. Export pure verdict functions with an import-safe CLI guard for negative unit cases. Reject null/malformed assertions without throwing during `.filter()`.

## 3. Risks and acceptance boundary

[Decided] No execution until these findings are resolved and the completed launcher is reviewed. Preserve existing source/test evidence. Do not modify production, the kit, or the existing managed-cleanup slice during fixture repair.

### Repair ownership and acceptance order

- Lifecycle repair: fixture core/role entries, arm, expectations, preparation inspection and lifecycle-contract tests.
- Evidence repair: recorder, aggregate validator and negative verdict tests.
- Envelope repair: launcher, payload, path helpers, README and boundary tests.
- All three repairs are code-only. No result is accepted from the original draft's claims.
- Lead re-reads final files and verifies cross-file interfaces before one bounded unit-test attempt. The original record test hard-codes 51 assertions; replace that obsolete assumption after its author hands off. Required lifecycle coverage determines the list, never the other way around; retain newly necessary lifecycle checks and record the final count before execution. The unit suite must include malformed evidence, nonzero step exits, boundary refusals and lifecycle contract cases.
- Only after those checks pass may a separate bounded real Loader attempt run. Its executor must write the repository record, preserve refusals/failures and report actual observed limits and process outcomes. No implicit retry.

[Verified] Fixture/pure-module tests passed 91/91, then six files including the actual duration helper passed 110/110; these are not Loader evidence. [Verified] One pinned real Loader composition passed 57/57 required assertions; resource and evidence limits remain attached to its execution record. The async activation/disposal race is unverified; do not report a host defect from source inspection alone. This slice unloads admitted plugins only after observing ACTIVE.

## 4. Additional pre-host gate

The pre-correction admission launcher assumed `systemctl show --property=RuntimeMaxUSec --value` returns integer microseconds. This was resolved by `lib/duration.awk` plus the launcher's positive ≤120000000 check; see [the 110/110 verification](../testing/2026-11-02-admission-duration-recheck.md). The following was the correction requirement, now satisfied: The existing managed-cleanup launcher handles formatted durations, so this assumption requires correction before real Loader execution. Accept only fully parsed finite positive durations at or below 120000000 microseconds, with no rounding down at the boundary. Preserve the raw manager value in the record. Do not modify frozen source while the independent unit recheck is running. Passing source-shape tests alone cannot establish manager-output compatibility.

## Appendix: source anchors

- `projects/dsh-plugin-kit/src/admission.js:656-699`: reservation, asynchronous activation, quarantine and rollback.
- `experiments/dsh-live-lab/build-checkout/vendor/cordis/src/fiber.ts:362-380`: asynchronous effect result collects the resolved disposer.
- `experiments/dsh-live-lab/build-checkout/vendor/loader/src/config/entry.ts:219`: readiness observer, not an awaited activation barrier.
