# Cleanup and managed-registration acceptance record

Date: 2026-11-01 (Asia/Shanghai).

## Attempt 1 verdict: FAIL (executed once)

The later, independently recorded recheck passed 37/37; see [cleanup recheck](<2026-11-01-cleanup-recheck.md>). It does not replace this failed attempt.

Attempt 1 (2026-11-01T22:13+08:00) ran the fixed entry once: envelope verified, workload started, 37 tests → 34 pass / 3 fail, acceptance exit 70. See "Attempt 1 — observed" below. The paragraph that follows is the original pre-execution text, kept unedited as history. After the run, the three failing message assertions were corrected on the test side; that correction has **not** been executed, so the verdict above still describes Attempt 1's bytes only (see "Alignment decision").

> Superseded (2026-11-01T22:13+08:00): this slice has now been executed once. Verdict: fail (3 failing assertions in `projects/dsh-plugin-kit/tests/cleanup.test.js`). No retry was made.

## Prior status before execution: NOT RUN

The cleanup scope and managed-registration implementation are under review. No test execution for this slice has been accepted yet. Written test cases are not passing test results. This record must be updated with observed results after execution; retain failures and deviations rather than replacing them with a green summary.

## Implementation under test

- `src/cleanup.js` and `src/cleanup.d.ts`: caller-owned cleanup scope.
- `src/managed-registration.js` and `src/managed-registration.d.ts`: synchronous resource acquisition with independently registered cleanup callbacks.
- Package subpaths: `dsh-plugin-kit/cleanup` and `dsh-plugin-kit/managed-registration`.

## Required checks

1. One throwing disposer does not prevent independent cleanup callbacks from running.
2. Multiple failures remain observable in an aggregate without coercing arbitrary thrown values.
3. Repeated/concurrent close returns the same settlement, including rejection.
4. Close waits for an already-started release and includes a release failure observed before close.
5. A callback runs at most once; exact stored callback ownership does not make an unsafe name-based disposer generation-safe.
6. Normal LIFO cleanup and acquisition rollback remain correct.
7. Actual legacy adapter and new kit registration implementation receive equivalent boundary faults in a caller-owned differential fixture.
8. When unregister throws before removing a resource, the new implementation must report the surviving resource honestly; it must still attempt other independent cleanup.

## Test files and execution entry

Kit tests:

- `tests/cleanup.test.js`
- `tests/managed-registration.test.js`

The caller-owned differential experiment and fixed acceptance launcher live in the parent research workspace, not in the kit's production dependency graph. Their exact paths and final command must be recorded after the corresponding files are delivered and reviewed. The launcher is being wired; do not infer that it is already execution-verified.

## Planned execution limits

- Serial workload; shared acceptance lock.
- Available-memory gate: at least 1200 MiB.
- Effective cgroup limits verified before Node: memory 768 MiB, swap 0, 32 tasks, CPU quota 50%.
- Systemd service type `exec`, wall timeout 120 seconds.
- Read-only source filesystem, private PID/network namespaces, temporary writable test directory, minimal environment.
- No build, dependency installation, production-profile modification or active GUI change.

These are planned requirements, not observed limits for this unexecuted slice.

## Evidence ledger

| Attempt | Result | Tests / assertions | Exit | Resource measurements | Evidence |
|---|---|---|---|---|---|
| None | NOT RUN | Not observed | Not observed | Not observed | Implementation and test authoring only |
| 1 — 2026-11-01T22:13:02+08:00 | FAIL | 37 tests, 34 pass, 3 fail | 70 (acceptance) / 1 (node) | mem peak 129261568 B (123.2M), pids peak 17, CPU 1.218s, wall 2.577s | `experiments/acceptance/runs/20261101T141302Z-cleanup-109657-28081/` (`receipt.txt`, `unit.log`) |

For each future attempt retain: timestamp/time zone, exact command and test list, implementation/test hashes or committed revision, unit name, requested and observed limits, test totals, actual exit codes, memory peak, failures, cleanup outcome, and log/report paths. Separate launch refusals from test failures. Explicitly disclose deviations from execution instructions.

## Interpretation limits

This is not a patch to the vendored legacy adapter. The differential fixture uses actual adapter code with host stand-ins and actual kit code with caller-provided ports; it does not establish real Loader/profile integration. Native resource disposers retain their own semantics. No deadline or cancellation of arbitrary disposer code is provided; a never-settling disposer can keep close pending. A disposer awaiting its own scope close can deadlock.

No cross-version, arbitrary-plugin, Web GUI or universal compatibility claim follows from this slice. Prior successful suites are historical evidence for their own code snapshots, not proof that these new modules pass.

## Attempt 1 — observed

Appended 2026-11-01 (Asia/Shanghai) from the run's own retained artifacts. Nothing above this heading was rewritten: the FAIL verdict, the NOT RUN history and the unedited pre-execution paragraphs all stand. This section is a report of what the logs say, not a re-run.

### Run identity and evidence paths

All paths are repo-relative to the research workspace root `/root/dsh-ecosystem-spec`.

| Field | Observed value |
|---|---|
| invocation_id | `20261101T141302Z-cleanup-109657-28081` |
| receipt_format | `acceptance-kv-1-provisional` |
| layer / evidence_class / mode | `cleanup` / `unit` / `self-envelope` |
| lock | `exclusive-serialised` |
| unit name | `acc-clean-20261101t141302z-cleanup-109657-28081.service` |
| in-unit payload | `experiments/acceptance/lib/unit-cleanup-tests.sh` |
| started / ended (UTC, as recorded) | `2026-11-01T14:13:02Z` / `2026-11-01T14:13:05Z` |
| same instants in +08:00 | `22:13:02+08:00` / `22:13:05+08:00` |
| missing_sources | `<none>` (source gate passed; the layer was not refused) |
| receipt | `experiments/acceptance/runs/20261101T141302Z-cleanup-109657-28081/receipt.txt` |
| unit log | `experiments/acceptance/runs/20261101T141302Z-cleanup-109657-28081/unit.log` |

The receipt stores UTC only; the `+08:00` rendering is a conversion made while writing this appendix, not a value the run recorded.

### Exact command and frozen test set

From `unit.log:23`, the single workload node ever started for this slice:

```
node --test --test-concurrency=1 \
  projects/dsh-plugin-kit/tests/cleanup.test.js \
  projects/dsh-plugin-kit/tests/managed-registration.test.js \
  experiments/cleanup-differential/test/cleanup-differential.test.mjs
```

Environment actually applied (`unit.log:17-20`): node `v24.21.0`, `NODE_OPTIONS=--max-old-space-size=384 --experimental-transform-types`, `acc_node_heap_limit_bytes=452984832`, heap probe ok. The byte figure is **432 MiB**, the *total* V8 heap limit, and it is not 384 MiB. `--max-old-space-size=384` is a separate requested flag that caps the old-space generation only; V8's total heap limit sits above that cap because new space, read-only space and the other spaces are added on top. The two numbers measure different quantities and are not expected to be equal. The payload's own field `acc_node_heap_cap_mib=384` (`unit.log:18`) restates the requested cap rather than measuring the byte value, so it must not be used to equate them. The `--experimental-transform-types` flag is required to load the TypeScript differential fixture and produced one `ExperimentalWarning` (`unit.log:186-187`); it was not enumerated in the planned-limits list above, so it is disclosed here rather than treated as planned.

Three test files, listed literally by the payload (no glob, no discovery): `acc_cleanup_source_count=3` (`unit.log:2`).

### Envelope: requested vs observed

Requested (`receipt.txt:14`) vs observed (`receipt.txt:22`, `unit.log:3-15`):

| Knob | Requested | Observed | Match |
|---|---|---|---|
| unit type | `exec` | `exec` | yes |
| memory max | 768M | `805306368` B | yes |
| swap max | 0 | `0` | yes |
| pids/tasks max | 32 | `32` | yes |
| CPU quota | 50% | `cpu_max=50000 100000` | yes |
| runtime max | 120 s | `120000000` µs (`2min`) | yes |
| node old-space cap (requested flag) | `--max-old-space-size=384` | present verbatim in `acc_node_options` (`unit.log:20`) | yes — flag applied |
| node total heap limit (measured) | not requested as a byte value | `452984832` B = **432 MiB** | different quantity; no equality expected |
| node version | v24.21.0 | `v24.21.0` | yes |

`envelope_verified=yes` and `workload_started=yes`. Every cgroup and unit knob matches its request exactly (memory `805306368` B, swap `0`, pids `32`, cpu `50000 100000`, runtime `120000000` µs, type `exec`), so no envelope deviation is visible in those rows. The heap is deliberately split into two rows: the requested old-space flag is confirmed applied, while `452984832` B is the total V8 heap limit — 432 MiB — a different quantity that is neither equal to 384 MiB nor evidence that the flag was ignored.

### Result, totals and exit-code lineage

- TAP totals (`unit.log:268-275`): `tests 37`, `suites 0`, `pass 34`, `fail 3`, `cancelled 0`, `skipped 0`, `todo 0`, `duration_ms 2075.69344`.
- `acc_node_rc=1` (`unit.log:326`), `workload_rc=1`, `systemd_run_rc=1` (`receipt.txt:19-20`), `verdict=fail`, `reason=systemd_run_rc=1`.
- Acceptance launcher exit **70**: the `finish fail "systemd_run_rc=$SRUN_RC" 70` path (`experiments/acceptance/acceptance.sh:343`; code table at `:139` — `0 pass · 64 refused/unknown · 70 fail · 75 busy · 76 output dir · 78 unavailable`).
- systemd accounting (`unit.log:331-335`): `Finished with result: exit-code`, `status=1/FAILURE`, service runtime `2.577s`, CPU `1.218s`, `Memory peak: 123.2M (swap: 0B)`.

This is a test failure, not a launch refusal: the refusal markers are absent (`missing_sources=<none>`, envelope verified, workload started, digest unchanged).

### Resource peaks

| Measurement | Value |
|---|---|
| memory peak | `129261568` B (123.2 MiB), from `acc_memory_peak` and systemd's own peak |
| memory current, final | `43053056` B |
| pids peak | `17` |
| CPU time | `1.218s` |
| wall / service runtime | `2.577s` |
| memory events | `low 0 high 0 max 0 oom 0 oom_kill 0 oom_group_kill 0` |

### Frozen-file integrity

From the receipt's own fields: `tests_digest_before` = `tests_digest_after` = `bf78f60df3ea182cdaf40ac9cd2ad210ce46823858abd038871b7c29ec0be704`, `originals_match=yes`. What that proves is narrow, and it is all this record uses it for: **the three frozen test files did not change between run start and run end**, so the manifest the run hashed on entry is the manifest it hashed on exit. It is a run-stability observation about one interval.

It does **not** show that the executed bytes are what sits on disk now, and this revision withdraws that claim. After Attempt 1, three message assertions in `projects/dsh-plugin-kit/tests/cleanup.test.js` were edited (see "Alignment decision"), which changes that file and therefore the three-path manifest; the current on-disk set is *not* the executed set. The pre-edit digest value therefore cannot be asserted of today's files, and the failure rows below describe only the bytes that ran. Reproducing them would require re-running the current file, which this record does not do and does not claim.

### Differential D1–D4, as settled by this run

Read from `unit.log`, not from any earlier draft. All four passed in this run:

| Case | Result | Log line | What the arms did |
|---|---|---|---|
| D1 unregister throws before removal | ✔ pass (103.286608ms) | `unit.log:188` | old arm: rejected `host failed to unregister tool`, everything stays live (`active`, `deactivateCalls 0`), retry fulfils without removing; new arm: rejected `cleanup scope "diff-tool" close failed: 1 of 4 disposer(s) threw` but still ran all four steps and left `active: false` with the tool still in the host map |
| D2 unsubscribe throws | ✔ pass (7.163057ms) | `unit.log:189` | old arm keeps tool, endpoint and lifecycle; new arm still unregisters the tool (`toolInHostMap: false`) |
| D3 control | ✔ pass (4.687739ms) | `unit.log:190` | both arms release tool, endpoint, subscription and lifecycle |
| D4 concurrent close | ✔ pass (77.28726ms) | `unit.log:234` | old arm settles the second caller early; new arm hands every caller one promise (three fulfilments recorded) |

D1 and D2 are the cases required by items 7 and 8 above; D4 is the case behind item 3. No gap is visible between the required checks and these settled results.

### The three failures: exact location, actual vs expected

All three are in `projects/dsh-plugin-kit/tests/cleanup.test.js` and, in the executed bytes, all three used the `match` operator; the table records those executed patterns, which the current file no longer contains (see "Alignment decision").

| # | Test (declaration line) | Assertion site | Expected (regex) | Actual (string) |
|---|---|---|---|---|
| 1 | `a throwing released disposer rejects its own caller and is included in the close` (`:270:1`) | `:286:10` | `/plugin-z close failed: 1 of 1 disposer\(s\) threw/` | `cleanup scope "plugin-z" close failed: 1 of 1 disposer(s) threw` |
| 2 | `a release that failed before close is not ignored by the close` (`:344:1`) | `:360:10` | `/plugin-y close failed: 1 of 2 disposer\(s\) threw/` | `cleanup scope "plugin-y" close failed: 1 of 2 disposer(s) threw` |
| 3 | `hostile thrown values are preserved untouched and never coerced into the message` (`:394:1`) | `:415:10` | `/plugin-h close failed: 2 of 2 disposer\(s\) threw/` | `cleanup scope "plugin-h" close failed: 2 of 2 disposer(s) threw` |

Failure rows: `unit.log:279-294`, `:296-308`, `:310-325`. Test 2's assertion carries the message `attempted counts every retained registration, not just the ones that threw`; all three report `code: 'ERR_ASSERTION'`, `operator: 'match'`, `diff: 'simple'`.

### Diagnosis: one shared literal mismatch, on the assertion side

Cause, common to all three: the regexes omit the closing `"` that `JSON.stringify` puts around the label. They also omit the `cleanup scope ` prefix, but that omission is **not** a cause — `assert.match` applies the pattern unanchored, with no implicit `^`, so `/plugin-z close failed: …/` would have matched inside `cleanup scope "plugin-z" close failed: …` on its own. The single character that breaks every match is the `"` sitting between the label and ` close failed`: the pattern asks for `plugin-z` followed immediately by a space, while the observed string has `plugin-z"` there. The `\(s\)` escapes are correct and do match the literal `(s)` in the message. The implementation at `projects/dsh-plugin-kit/src/cleanup.js:155-158` is

```js
const subject = scopeLabel === undefined ? 'cleanup scope' : `cleanup scope ${JSON.stringify(scopeLabel)}`;
const error = new AggregateError(…, `${subject} close failed: ${failures.length} of ${attempted} disposer(s) threw`);
```

so a labelled scope renders `cleanup scope "plugin-z" close failed: …`, which is exactly what the log shows. The counts agree with the expectation (`1 of 1`, `1 of 2`, `2 of 2`); only the literal around them differs.

Assessed as an **assertion issue, not a source defect**, for these code-supported reasons:

1. A failed assertion ends that individual test, and Node's runner reports only the first failure per test; the other tests in the file and the other files keep running, which is why the run still totals 37/34/3. The assertions this attempt can therefore speak for are exactly those in source order before the message check — had any of them failed, it would have been the reported failure instead. In test 1 that is the `assert.rejects` on the raw release plus `instanceof AggregateError`, `error.code`, `Object.is(error.errors[0], boom)` and `error.errors.length`; in test 2 the `assert.rejects` on the failing release plus `instanceof`, `error.code` and `deepEqual(error.errors, [boom])`; in test 3 `instanceof`, `errors.length`, `Object.is(error.errors[0], hostile)`, `errors[1] === undefined` and `typeof error.message === 'string'`. This is an ordering statement about those particular checks, **not** a verdict on the tests: it says nothing about the assertions after the message check, and nothing about the tests' semantic coverage as a whole.
2. The behaviour item 2 above is designed to protect — "failures stay observable without coercing arbitrary thrown values" — is not what failed: the message is built from counts alone (`cleanup.js:157-159`), and the three `actual` strings quoted in the log contain no thrown text at all (no `tool unregister failed`, no `[object Object]`, no `weird`). In test 3 the aggregate was constructed and reported `2 of 2` while the throwing `toString` and `message` getter were attached to the retained value, and an aggregate that had read either trap would have failed differently, not merely mismatched a literal. Caveat: the assertions that would test non-coercion directly — `doesNotMatch` in tests 1 and 3, plus test 3's remaining `doesNotMatch` lines — sit *after* the message check and were never reached in this attempt, as were test 1's and test 2's trailing `assert.equal(scope.size, 0)`. They remain unverified rather than passing; the non-coercion evidence here is the observed message text, not those assertions.
3. The implementation is internally consistent in its two message sites: `CleanupScopeClosedError` uses the same `cleanup scope ${JSON.stringify(label)}` form (`src/cleanup.js:127-128`), and the sibling assertion `test at cleanup.test.js:150` `/^cleanup scope is closed/` passed in this run.
4. No contract pins the bare-label form: no occurrence of `close failed` in `README.md` or `docs/`, and `src/cleanup.d.ts:33` pins only `readonly code: 'ERR_CLEANUP_SCOPE_FAILED'`, not the message text.

This is a formatting-contract disagreement between three regexes and one format string. It does not show a behavioural defect in aggregation, ordering, exactly-once semantics, waiting for an in-flight release, or honest reporting of a surviving resource — those tests passed. Which side to align was an open question when Attempt 1 was written; it has since been decided, and the decision is recorded in the next section.

### Alignment decision (after Attempt 1, not executed)

Decided on the **test side**: the three exact full-message assertions were corrected, and nothing else. The executed bytes asserted a substring via `match`; the corrected form asserts the whole rendered message by equality, so the assertion now states the same text the implementation produces, including the `cleanup scope ` prefix and the `JSON.stringify` quoting:

| Test | Line | Corrected assertion |
|---|---|---|
| `a throwing released disposer rejects its own caller and is included in the close` | `cleanup.test.js:286-287` | `assert.equal(error.message, 'cleanup scope "plugin-z" close failed: 1 of 1 disposer(s) threw', …)` |
| `a release that failed before close is not ignored by the close` | `cleanup.test.js:361-362` | `assert.equal(error.message, 'cleanup scope "plugin-y" close failed: 1 of 2 disposer(s) threw', …)` |
| `hostile thrown values are preserved untouched and never coerced into the message` | `cleanup.test.js:416` | `assert.equal(error.message, 'cleanup scope "plugin-h" close failed: 2 of 2 disposer(s) threw')` |

Scope of the change: three assertions, in one file, test side only — no production source, no `src/cleanup.js` message formatting, and no other test assertion was touched. This is an alignment of the assertion to the implementation's existing rendering, not a change of behaviour: the counts (`1 of 1`, `1 of 2`, `2 of 2`), the aggregate's `code`, and the identity-preserving `errors` array are all as the run observed them.

**Not executed.** This correction was made after Attempt 1 and was not run in Attempt 1, so nothing in this record observes it passing or failing, and no result is claimed for it. Attempt 1's 37/34/3 totals belong to the pre-correction bytes. A recheck of the corrected file is a separate record — [2026-11-01-cleanup-recheck.md](<2026-11-01-cleanup-recheck.md>), written by the execution subagent — and this document deliberately says nothing about its outcome; that file's own numbers are the only authority for it.

### Unknown gaps in this attempt's evidence

- **Implementation hashes were not retained.** The receipt digests only the three test files; `src/cleanup.js`, `src/cleanup.d.ts`, `src/managed-registration.js` and `src/managed-registration.d.ts` were never hashed by the run. Values read after the run, at times that were not recorded: `src/cleanup.js` = `5fab080e82c7f30523d28bdc8b3904be25ab5bf14a9580c2562f8fe7909f5d10`, `tests/cleanup.test.js` = `c04a4619327c5d40877bf838b9d7af03441d52e92a48d9be53a8820e8b0f069d`, with mtimes `22:01:37` and `22:00:59` (+08:00) then observed to precede the run start. These are *after-run observations of unknown timing*: they describe the moment of measurement, not the executed state and not the current state, are not part of the run's retained evidence, and are not authoritative for either. The `tests/cleanup.test.js` value in particular belongs to a file that was edited afterwards. The strongest available link between the executed formatter and the source read here is the log's own quoted message text (`unit.log:279-325`), which matches the format string at `src/cleanup.js:155-158`.
- **No committed revision exists to cite.** `git status` reports `projects/dsh-plugin-kit/`, `experiments/acceptance/` and `experiments/cleanup-differential/` as untracked (`??`); `HEAD` is `effb958`, which does not contain this code. The attempt cannot be tied to a revision id.
- **The differential fixture's supporting code is not pinned.** Only `experiments/cleanup-differential/test/cleanup-differential.test.mjs` is in the digest; the vendored adapter copy and host stubs the D-cases exercise are outside it, so their executed content is unverified by the receipt.
- **Raw `systemctl show` output was not retained** — only the payload's parsed `acc_*` lines, which is what the envelope table above rests on.
- **Post-run cleanup of the failing scopes is only observable through assertions.** No independent accounting of leftover host-map/endpoint/lifecycle state was captured outside the tests.
- **No requirement-to-test mapping was retained** by the run; items 1–6 can be matched to passing test names by reading, but that mapping is this appendix's reading, not a run artifact.
- **One execution only.** No retry was made for Attempt 1. The post-correction recheck is a separate recorded attempt.

### Documentation process deviations

The appendix author disclosed read-only shell inspection and hash recomputation despite a no-execution documentation task. The subsequent correction author also disclosed a directory-listing command despite the same restriction. These are process deviations, not additional test executions or run-time provenance. The after-run values above must not be promoted into evidence captured during Attempt 1. The Lead completed this closing note and corrected the recheck link using file tools after both authors had finished; no further test was run for this documentation review.
