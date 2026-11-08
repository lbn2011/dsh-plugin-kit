# admission-loader-fixture ORCHESTRATION unit slice — RECHECK (2026-11-04)

**Status: RUN ONCE. 45 tests, 40 pass, 5 fail, node exit 1. NOT green.**

The duplicate declaration is gone: both targets now load and execute, so this run is
a genuine test result rather than a file-load failure. Five assertions fail. They are
recorded below verbatim and were **not** repaired, and no second attempt was made.

## 1. Why this recheck exists

The first attempt
(`runs/20261103T201109Z-admission-loader-orchestration-unit-376656-12899/`) ended
with **both targets failing to load and zero assertions executed**, because
`prepare.mjs` declared `const entry` twice in one block scope — a load-time
`SyntaxError` at `prepare.mjs:334`.

The Lead read `prepare.mjs:329-341` and renamed only the second declaration to
`entryInspection` plus its three references. That is the sole source change between
the two runs, and the hash diff in §6 confirms it is the only file that moved.

This recheck asked one question: with that duplicate removed, do the two targets
execute, and what do they report? They execute, and they report five failures.

## 2. Constraints carried over, unchanged

Same two literal targets, one serial `node --test --test-concurrency=1`, same caps
(`Type=exec`, 768M, swap 0, TasksMax 32, CPUQuota 50%, RuntimeMaxSec 120, heap 384),
same shared acceptance lock, same single in-unit `MemAvailable >= 1200 MiB` gate,
same sandbox. One launch; no retry, no polling, no escalation, no automatic fix. The
first run directory was not edited, moved or deleted.

## 3. Run identity (read back)

| field | value |
|---|---|
| run id | `20261103T201548Z-admission-loader-orchestration-unit-376916-221` |
| unit | `admission-loader-orchestration-unit-20261103T201548Z-376916` |
| run directory | `experiments/acceptance/admission-loader-orchestration-unit/runs/20261103T201548Z-admission-loader-orchestration-unit-376916-221/` |
| repo HEAD | `effb9581687f995841d872304e03627473039957` (same as the first run) |
| node | `/www/server/nodejs/v24.21.0/bin/node` — path only, never probed |
| background jobs | none pending before launch |

## 4. The invocation

```
bash experiments/acceptance/admission-loader-orchestration-unit/run.sh
```

Unchanged runner, no arguments, executed once.

## 5. Evidence captured

| field | actual value |
|---|---|
| systemd-run exit | `1` (`systemd-run.rc`, 2 B) |
| node exit | `acc_node_rc=1` |
| tests / pass / fail / skipped | `45 / 40 / 5 / 0`, suites `0`, duration `420.58 ms` |
| gate sample | `acc_gate_memavailable_kib=1824228` ≥ `1228800` ⇒ `acc_gate=pass`, sampled once |
| cgroup readback | `memory.max=805306368`, `swap.max=0`, `pids.max=32`, `cpu.max="50000 100000"` |
| unit readback | `Type=exec`, `RuntimeMaxUSec=120000000` (resolved from `2min`), memory/swap/tasks as expected; `acc_capture_ok=yes` |
| memory.peak | `69681152` B (66.4 MiB) |
| memory.current at exit | `36159488` B |
| pids.peak | `20` of 32 |
| memory.events.local | `low 0 high 0 max 0 oom 0 oom_kill 0 oom_group_kill 0` |
| wall time | `acc_workload_wall_ms=791`; journal CPU `361 ms` |
| hashes before/after | `hash_status=identical`; both `.err` 0 B; no `hashes-diff.txt` |
| acceptance exit | `1` |
| unit state after | `LoadState=not-found`, `ActiveState=inactive`, `SubState=dead`; `admission-loader-*` list empty |

Raw paths (all under the run directory above): `argv.txt` 2674 B,
`hashes-before.txt` / `hashes-after.txt` 2966 B each, `unit.log` 9365 B,
`systemd-run.rc` `1`, `journal.txt` 853 B, `status.txt` 193 B.

## 6. The five failures, preserved

`prepare.test.mjs` — 2 failures:

```
✖ a work parent must exist, be a real directory and be canonical (prepare.test.mjs:134)
  assert.ok(missing.refusals.includes(PREPARE_CODES.workParentMissing))   :138
  AssertionError: The expression evaluated to a falsy value   (actual false, expected true)

✖ a green prepare returns exactly the collector options and lists what it made (:250)
  AssertionError: Expected values to be strictly equal: 5 !== 3            :290
  (actual 5, expected 3)
```

`run-loop.test.mjs` — 3 failures:

```
✖ the trusted source-review flag defaults to false and is copied, not aliased (:163)
  "the run must keep what the caller said at call time"                    :171
  actual 'ce7073d51254c26cd63b22a60835b8f948deb447'  expected 'someone-else'

✖ a thrown evaluator is a fixed label and keeps prepare and collect (:323)
  actual 'unknown'  expected 'evaluate-threw'                              :339

✖ a thrown chain keeps evaluation and reports chain-threw (:348)
  actual 'unknown'  expected 'chain-threw'                                 :366
```

Read at face value, these are disagreement between what the tests expect and what
the sources return — not envelope or runner faults. The three `run-loop` failures
share a shape: a label the loop reports is `'unknown'` (or a replaced value) where
the test expects a specific one. The `prepare` failures concern a missing
`workParentMissing` refusal and a count of `5` where `3` was expected. **No
diagnosis beyond that is offered here**: the sources are frozen and owned elsewhere,
and this slice reports what came back.

## 7. Hash comparison with the failed run

A full diff of the two `hashes-before.txt` files yields **exactly one changed line**:

| file | first run | recheck | actual |
|---|---|---|---|
| `prepare.mjs` | `81a375f9…09a9a7` | `59b3f2d7…e058f` | **differs** — the `entryInspection` rename |
| the other 19 hashed files | first run's record | same | identical — verified by diff, not assumed |

So the outcome moved from "both files fail to load" to "45 tests run, 40 pass" for a
disclosed, single-file reason, with the runner and every other selected input
byte-identical. As before, the set is 20 identified files — two targets, two runner
scripts, sixteen selected inputs — so this is a **witness over identified inputs, not
a closure**; node builtins are excluded and a deeper module that changed without
appearing in the list would not be caught.

## 8. What this recheck does not claim

- Not real Loader acceptance. `prepare.test.mjs` exercises filesystem preparation
  against directories it creates under `os.tmpdir()`; `run-loop.test.mjs` drives the
  loop with every stage mocked, no Loader booted, no directory created, no document
  judged by the real validator. Nothing here may be quoted as realLoader evidence,
  and the collect-against-a-real-Loader gap stays open.
- Not a re-baseline of the first run: its 2 file-load failures, 0 assertions and its
  artifacts stand exactly as measured. The two runs are a pair, not a correction of
  the record.
- Not a diagnosis of the five failures, and no fix was attempted.
- Not a claim that the 40 passing tests prove the mocked stage shapes match the real
  stages, or that `cleanupForwardingReviewed` is genuinely verified anywhere.

## 9. Gate

The Lead authorised exactly one recheck, and it has run. **40/45, node exit 1.** No
third run is authorised, nothing was retried, and no source was edited in response.
A further attempt would need a fresh GO after the failing expectations or the
corresponding sources are resolved by their owners.

## 10. Diagnosis and correction applied afterwards (NOT RUN)

§§1–9 stand exactly as measured: **45 tests, 40 pass, 5 fail, node exit 1**, the five
failure dumps, the hash pair and the 20-file caveat. This section records a
subsequent diagnosis and a proposed **source/interface normalization plus test
corrections**. These edits have **not been executed** — no `node`, no `--test`, no
`--check`, no runner. Nothing below is evidence that the five failures now pass, and
none of it is real Loader evidence.

### 10.1 What the five failures turned out to be

| # | assertion | measured | cause, read at source | class |
|---|---|---|---|---|
| 1 | `prepare.test:138` | `WORK_PARENT_MISSING` absent; element was `WORK_PARENT_MISSING:ENOENT` | `prepare.mjs` appended the errno on **both** branches, so the closed token never appeared bare and `Array.includes` (exact equality) was false | implementation |
| 2 | `prepare.test:290` | `5 !== 3` | `notClaimed` holds five claims; the three-claim expectation predates the review round that added the digest/kit-revision/rows claims | stale expectation |
| 3 | `run-loop.test:171` | `'ce7073d5…' !== 'someone-else'` | `{ ...INPUT }` is shallow: it aliased `INPUT.baseline`, so mutating the copy rewrote the value used as the expectation | test fixture |
| 4 | `run-loop.test:339` | `'unknown' !== 'evaluate-threw'` | the mock returned a function override as a **result** instead of calling it, so no throw occurred; the non-catch path produced `String(undefined ?? 'unknown')` | test fixture |
| 5 | `run-loop.test:366` | `'unknown' !== 'chain-threw'` | identical mechanism for `chain` | test fixture |

For 4 and 5 the distinction is provable rather than inferred: the catch clauses
install `'evaluate-threw'` / `'chain-threw'` as **both** the stage code and the
refusal detail, so an observed `'unknown'` can only have come from the non-catch
path. The port was never invoked.

### 10.2 Corrections applied

- **`prepare.mjs`** — the work-parent lstat branch is split: `ENOENT` yields the
  bare, closed `WORK_PARENT_MISSING`; every other errno yields
  `WORK_PARENT_INSPECTION_FAILED:<code>`. Absence and "cannot tell" stay distinct; no
  error is read as absence.
- **`tests/prepare.test.mjs`** — not-claimed is asserted as **five** entries, each by
  content (booted-nothing, rows-not-enabled, digests-certify-nothing,
  kit-revision-unknown, rows-not-parsed), plus non-empty-string checks, so one claim
  cannot be swapped for another behind a correct count.
- **`tests/run-loop.test.mjs`** —
  - `mockPorts` now treats a **function** override as the port (invoked with the same
    arguments the real stage receives, so it can throw, reject or return a thenable)
    and a **literal** override as the result, for all four stages, while keeping
    `calls.*`, `evaluateOptions` and `chainDeps` recording;
  - the argument gate drops `root` and `workParent` **separately** (the old version
    dropped `root` twice, so "no work parent" was never exercised) and restoring the
    dropped field re-validates, proving the refusal came from that field;
  - the baseline test deep-copies `baseline` and `coordination` and snapshots the
    expected values **before** mutating;
  - the thrown-stage tests now count their own invocations and assert the port was
    really called once with the expected arguments, so they cannot pass without a
    throw;
  - two missing throw paths were added: a thrown **preparer** and a thrown
    **collector**, each asserting the fixed label, that downstream stages were never
    entered (`null`, zero calls), and that no thrown-value text reaches the record.

No change weakens a contract: the refusal vocabulary stays closed, the mock-vs-host
distinction is unchanged, and `run-loop.mjs` — the acceptance logic itself — was not
edited. The coarse `'unknown'` label for a port that returns a non-object remains;
labelling it more precisely would be a behaviour change and was not done.

### 10.3 What this does not claim

- **Not** that the five now pass. The edits are unrun; §6's dumps remain the last
  measurement, and 40/45 with node exit 1 remains this slice's outcome.
- **Not** that anything after `prepare.test:290` was ever verified: the green test
  aborted there, so its `describePrepared` assertions were never reached.
- **Not** real Loader acceptance, and not a fix to the open collect-against-a-real-
  Loader gap. §8 holds unchanged.
- §8's line "Not a diagnosis of the five failures, and no fix was attempted"
  describes the state **at the time of the run**. It is superseded as a description
  of the current tree by this section, and left in place rather than rewritten.

A recheck still needs a fresh GO and a real launch of the same two literal targets
into a fresh run directory.

## 11. Process deviation disclosure

- The standing procedural rule for these corrections was **file tools only — no
  shell, no node, no commands**. While diagnosing §10.1 and verifying the A–E edits,
  I used shell `grep`/`awk`/`sed` for **read-only** inspection: reading the recheck
  log, listing duplicate declarations in `prepare.mjs`, and confirming that edited
  text was present. No write, no `node`, no `--test`, no `--check`, and no runner was
  executed at any point. Nothing in §§4–9 was produced by those scans; they only
  re-read what the run had already emitted.
- One of those scans was a **delimiter-count balance check** over
  `tests/prepare.test.mjs` (it reported braces 91/90 and parens 363/361, while
  `prepare.mjs` and `tests/run-loop.test.mjs` came out balanced). The Lead stopped it
  and ruled that delimiter counting is **not** a JS validity proof. It is recorded
  here as an **unresolved observation, not a finding**: it is neither evidence of a
  syntax error nor evidence that the file is well-formed. The edited block itself
  reads balanced on inspection, but no validity claim is made either way.
- Consequence for the reader: §10.2 lists edits that are **on disk and unrun**. No
  statement in this document should be read as "the module now parses" or "the tests
  now pass".
