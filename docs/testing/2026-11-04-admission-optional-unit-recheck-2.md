# Admission optional-case unit slice — recheck 2

**Status: RUN ONCE, 188/187/1, NOT GREEN.** **188 tests / 10 suites / 187 pass /
1 fail / 0 cancelled / 0 skipped / 0 todo**, node exit 1, `1384.354053 ms`.
`optional-collection.test.mjs` **now loads**: all fourteen formerly failing titles
executed and passed, measured one by one (§7). The one failure is a different,
new title in the same file. §7 appended from the run directory after the launch.

- Slice: `experiments/acceptance/admission-optional-unit/` (unit only, no Loader).
- Preserved antecedents, neither edited by this record:
  - `2026-11-04-admission-optional-unit.md` — **137 / 122 / 15**, run
    `runs/20261104T141332Z-admission-optional-unit-403410-24542/`.
  - `2026-11-04-admission-optional-unit-recheck.md` — **161 / 160 / 1**, run
    `runs/20261104T142934Z-admission-optional-unit-404004-9470/`, whose single
    failure was a load-time `SyntaxError` at `optional-collection.test.mjs:377`.
- Author: subagent session under the Lead identified in the antecedent records.

## 1. Why a third attempt exists

Recheck 1 failed at parse time: `optional-collection.test.mjs` never compiled, so
none of its tests ran and its fourteen earlier failures were neither reproduced nor
cleared. The file has since been corrected (three orphaned lines at `:369-391`
removed). No collector or runtime change is claimed or measured here. This attempt
measures that corrected file once.

It does not revise either antecedent. Both measured what they measured.

## 2. Constraints fixed before the launch

- Exactly **one** invocation of the unchanged
  `bash experiments/acceptance/admission-optional-unit/run.sh`.
- Same five literal targets, same shared lock
  (`experiments/acceptance/runs/.acceptance.lock`), same fail-closed
  `admission-*` inspection, same exclusive run directory.
- Same envelope: `Type=exec`, 768M, swap 0, `TasksMax=32`, `CPUQuota=50%`,
  `RuntimeMaxSec=120`, heap `384`, bwrap read-only root with private
  pid/net/ipc/uts and `env -i`, one `MemAvailable >= 1200 MiB` gate.
- No retry, no polling, no cap change, no source edit, no standalone check, no
  Loader, no host, no install, no build.
- On failure: record and stop; diagnosis by reading only.

## 3. Identity

| Field | Value |
| --- | --- |
| run id | `20261104T143340Z-admission-optional-unit-404290-29866` |
| unit | `admission-optional-unit-20261104T143340Z-404290` |

## 4. Hash comparison — the question this attempt answers

Same 25 selected files as before; the set is a witness over identified inputs, not
a closure. Predicted: only `tests/optional-collection.test.mjs` differs from
`20261104T142934Z`, the other 24 byte-identical — **to be measured, not assumed**.
A difference identifies changed files; it does not establish causation, and the
parent HEAD is not a version identifier for untracked `experiments/` sources.

## 5. Execution evidence — per title, not inferred from totals

Because total counts cannot distinguish "the file ran and most tests passed" from
"the file never loaded", §7 records, from `unit.log`, **whether
`optional-collection.test.mjs` loaded at all**, and **which of the fourteen
formerly failing titles actually appear as `✔` or `✖`**. A rising total is not
evidence that a specific title executed.

## 6. What this record will not claim

Not that the optional four cases are covered; not that the eight-case real-Loader
path works (no Loader here); not that either antecedent's failures were "really"
passes; not a dependency closure; not a certification; not causal explanation
beyond what the log shows.

## 7. Outcome

Run `runs/20261104T143340Z-admission-optional-unit-404290-29866/`, unit
`admission-optional-unit-20261104T143340Z-404290`.

| Field | Measured |
| --- | --- |
| `systemd_run_rc` | `1` |
| `acc_node_rc` | `1` |
| `acceptance_exit` | `1` |
| `hash_status` | `identical` (25 before / 25 after, `cmp` equal) |
| tests / suites | `188` / `10` |
| pass / fail | `187` / `1` |
| cancelled / skipped / todo | `0` / `0` / `0` |
| duration | `1384.354053 ms` |
| envelope | `memory.max=805306368`, `swap.max=0`, `pids.max=32`, `cpu.max="50000 100000"`, `Type=exec`, runtime resolved `120000000` µs, `acc_capture_ok=yes` |
| gate | `pass` (single `MemAvailable >= 1200 MiB` sample) |
| heap cap | `384` MiB |
| wall / peak / current | `1772 ms` / `72802304` B / `33071104` B |
| pids peak | `20` |
| unit after run | `LoadState=not-found`, `ActiveState=inactive`, `SubState=dead`, no `admission-*` unit listed |

**Hash delta vs recheck 1 (`20261104T142934Z`): exactly one line**, as predicted —
`tests/optional-collection.test.mjs` `bbac3ba3…` → `1fffc7c7…`. The other 24 files
are byte-identical. This identifies a changed file; it does not establish that the
change caused the difference in results, and it says nothing about files outside
the selected set.

**Did the file load, and did the fourteen titles actually execute?** Yes, measured
per title rather than inferred from the total. Each of the fourteen formerly failing
titles appears exactly once in `unit.log`, with a verdict and its own duration:

| Formerly failing title (recheck 1 failed at parse time) | Now |
| --- | --- |
| `an unknown case set is refused before anything boots` | `✔ 0.217126ms` |
| `all-8 appends four optional cases to the SAME cases map, in strict fact shape` | `✔ 3.946708ms` |
| `the remount facts compare live references and record both mounts by real state` | `✔ 2.590882ms` |
| `every temporary reservation is released and verified; the quarantine is kept and named` | `✔ 1.388925ms` |
| `a participant row that will not unload withholds the envelope` | `✔ 63.395967ms` |
| `a first release that throws still leaves the lease owned for cleanup` | `✔ 0.14661ms` |
| `real coordinator: normal all-8 cleanup never attempts the retained lease release` | `✔ 1.857004ms` |
| `real coordinator: a lease that will not release is still cleaned independently` | `✔ 0.806568ms` |
| `a release that throws after changing state is still a failure` | `✔ 0.931965ms` |
| `two captures that resolved nothing are not evidence of identity` | `✔ 1.968334ms` |
| `null coordinator references are a gap too, not a null identity` | `✔ 0.792098ms` |
| `two genuinely different coordinator objects are a retained false, not a refusal` | `✔ 0.90841ms` |
| `a ONE-SHOT probe failure is a gap that the evaluator refuses, with cleanup still clean` | `✔ 0.926725ms` |
| `a PERSISTENT probe failure fails the teardown gate by name` | `✔ 0.701517ms` |

**The one failure is a different title, new in this attempt**, at
`optional-collection.test.mjs:1016:1`:

```
✖ a lease whose state cannot be read is never accepted as a clean release (1.61595ms)
  AssertionError [ERR_ASSERTION]: the state was not readable

  'unknown' !== null

      at TestContext.<anonymous> (file:///…/optional-collection.test.mjs:1026:10)
    actual: 'unknown',
    expected: null,
    operator: 'strictEqual'
```

**Source-based diagnosis (from the sources, not from this log's totals).** The
producer is deliberate: `collect.mjs:573-581` `leaseStateOf(lease)` returns `'unknown'`
whenever the state is not a string or the read throws — the comment says "a
throwing accessor is `unknown`, never a guess". The test at
`optional-collection.test.mjs:1026` expected `null`, so **the expectation was the
wrong side**, not the collector. The four surrounding assertions are consistent with
that reading and were never in question: `result.envelope === null` (`:1022`),
`result.refusal.code === 'TEARDOWN_INCOMPLETE'` (`:1023`), `holder.probe ===
'unverified-state'` (`:1027`), `holder.released === false` (`:1028`) — an unreadable
lease state is refused as an unverified teardown, never accepted as a clean release.

**Post-run single-point correction — NOT RETESTED.** After this attempt, the
owning work changed that one expectation at `:1026` to `'unknown'`; the Lead reports
reading `:1020-1029` and confirming `'unknown'` with the refusal assertions intact.
I verified by reading (no execution) that the file now says `'unknown'` at `:1026`.
This edit is **after** the run: the bytes hashed in
`20261104T143340Z-admission-optional-unit-404290-29866` are the pre-fix bytes, so
this run's digest for that file must not be read as its current state, and the fix
is unmeasured. Nothing in this record's 188/187/1 changes.

**Correction to one figure in my own delivery.** A Chinese summary I sent described
the hash pair as "250/250"; the correct number is **25 selected files**, before and
after, `cmp`-identical. That was an error in my message text, not in any record or
artifact — the records, `argv.txt` and both hash files all say 25 — and it is noted
here so the wrong number is not carried forward.

Totals across the attempts, for orientation only, since counts alone prove
nothing: 137/122/15 (parse-level import error in `run-loop.test.mjs`, fourteen
failures in a file that did load), 161/160/1 (that file then failed to parse at
`:377`, contributing no tests), 188/187/1 (both files load; one assertion failure
whose expectation was wrong). Each run measured a different byte set.
