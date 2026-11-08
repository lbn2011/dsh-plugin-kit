# Admission optional-case unit slice — recheck 3

**Status: RUN ONCE, 188/188/0, node exit 0.** **188 tests / 10 suites / 188 pass /
0 fail / 0 cancelled / 0 skipped / 0 todo**, `1316.767591 ms`. The title that failed
in recheck 2 executed and passed: `✔ a lease whose state cannot be read is never
accepted as a clean release (1.408648ms)`. §7 appended from the run directory after
the launch.

- Slice: `experiments/acceptance/admission-optional-unit/` (unit only, no Loader).
- Preserved antecedents, none edited by this record:
  - `2026-11-04-admission-optional-unit.md` — **137 / 122 / 15**,
    `runs/20261104T141332Z-admission-optional-unit-403410-24542/`.
  - `2026-11-04-admission-optional-unit-recheck.md` — **161 / 160 / 1**,
    `runs/20261104T142934Z-admission-optional-unit-404004-9470/` (parse error at
    `optional-collection.test.mjs:377`, file did not load).
  - `2026-11-04-admission-optional-unit-recheck-2.md` — **188 / 187 / 1**,
    `runs/20261104T143340Z-admission-optional-unit-404290-29866/` (file loaded, all
    fourteen former failures passed per title; one assertion failed because the
    test expected `null` where `collect.mjs:573-581` returns `'unknown'`).

## 1. Why a fourth attempt exists

*(Pre-launch text, kept as written. "No test has measured that edit" was true when
this section was written and is a statement about that moment, not about the record
now: §7 is the measurement that followed.)*

Recheck 2's single failure was an assertion whose expectation was the wrong side:
`leaseStateOf` reports `'unknown'` by design. That one expectation has since been
changed to `'unknown'` and frozen, and the refusal assertions around it
(`envelope === null`, `TEARDOWN_INCOMPLETE`, `unverified-state`, `released === false`)
were left intact. No test has measured that edit. This attempt measures it once.

It revises nothing above: three runs measured three different byte sets, and each
one's failures stay failures.

## 2. Constraints fixed before the launch

- Exactly **one** invocation of the unchanged
  `bash experiments/acceptance/admission-optional-unit/run.sh`.
- Same five literal targets, same shared lock
  (`experiments/acceptance/runs/.acceptance.lock`), same fail-closed `admission-*`
  inspection, same exclusive run directory.
- Same envelope: `Type=exec`, 768M, swap 0, `TasksMax=32`, `CPUQuota=50%`,
  `RuntimeMaxSec=120`, heap `384`, bwrap read-only root with private pid/net/ipc/uts
  and `env -i`, one `MemAvailable >= 1200 MiB` gate.
- No automatic retry, no standalone syntax check, no version command, no source or
  runner edit, no Loader, no host, no install, no build.
- On failure: record and stop; diagnosis by reading only.

## 3. Identity

| Field | Value |
| --- | --- |
| run id | `20261104T143850Z-admission-optional-unit-404649-5285` |
| unit | `admission-optional-unit-20261104T143850Z-404649` |

## 4. Hash comparison — 25 selected files

Predicted: only `tests/optional-collection.test.mjs` differs from
`20261104T143340Z`; the other 24 byte-identical — **to be measured, not assumed**.
The set is a witness over identified inputs, not a closure; a differing line names a
changed file, not a cause, and the parent HEAD is not a version identifier for these
untracked `experiments/` sources.

## 5. Execution evidence — the title, not the total

§7 records whether `the guarded state read reports unknown` was reached and which
verdict the title `a lease whose state cannot be read is never accepted as a clean
release` received, quoted from `unit.log`, rather than inferring execution from a
rising total.

## 6. What this record will not claim

Not that the optional four cases are covered; not that the eight-case real-Loader
path works (no Loader here); not that any antecedent's failures were "really" passes;
not a dependency closure; not a certification; not causation beyond what the log
shows.

## 7. Outcome

Run `runs/20261104T143850Z-admission-optional-unit-404649-5285/`, unit
`admission-optional-unit-20261104T143850Z-404649`.

| Field | Measured |
| --- | --- |
| `systemd_run_rc` | `0` |
| `acc_node_rc` | `0` |
| `acceptance_exit` | `0` |
| `hash_status` | `identical` (25 before / 25 after, `cmp` equal) |
| tests / suites | `188` / `10` |
| pass / fail | `188` / `0` |
| cancelled / skipped / todo | `0` / `0` / `0` |
| duration | `1316.767591 ms` |
| envelope | `memory.max=805306368`, `swap.max=0`, `pids.max=32`, `cpu.max="50000 100000"`, `Type=exec`, runtime resolved `120000000` µs, `acc_capture_ok=yes` |
| gate | `pass` (single `MemAvailable >= 1200 MiB` sample) |
| heap cap | `384` MiB |
| wall / peak / current | `1650 ms` / `66985984` B / `28635136` B |
| pids peak | `20` |
| `memory.events.local` | all zero |
| unit after run | `LoadState=not-found`, `ActiveState=inactive`, `SubState=dead`, no `admission-*` unit listed |

**The previously failing title executed, and passed, by name.** From `unit.log`:

```
✔ a lease whose state cannot be read is never accepted as a clean release (1.408648ms)
```

That is the same title that failed in recheck 2 at `optional-collection.test.mjs:1016:1`.
It is quoted here rather than inferred from the total, because a total cannot
distinguish a test that ran from a file that never loaded.

**Hash delta vs recheck 2 (`20261104T143340Z`): exactly one line**, as predicted —
`tests/optional-collection.test.mjs` `1fffc7c7…` → `685d0beb…`. The other 24 files
are byte-identical. This names the file whose bytes changed between those two
attempts; it does not establish that the change caused the pass, and it says nothing
about files outside the 25 selected ones.

**What this does and does not mean.** It means: the unit suite over these five
targets, at these bytes, reports zero failures and node exits 0, and the assertion
that had been written against the wrong expectation now passes. It does **not** mean
the optional four admission-evidence cases are covered on the real path: this slice
boots no Loader, no host and no browser, so nothing here is eight-case evidence, no
document or diagnostics is produced, and no certification is implied. The four
earlier failures — 137/122/15, 161/160/1, 188/187/1 — stand exactly as recorded in
their own files; none of them is restated or superseded by this one.

Four attempts, one byte set each: 137/122/15 (import error in `run-loop.test.mjs`),
161/160/1 (parse error at `optional-collection.test.mjs:377`), 188/187/1 (wrong
expectation at `:1026`), 188/188/0 (this run). The progression is a history of
different bytes, not a record of one suite improving.
