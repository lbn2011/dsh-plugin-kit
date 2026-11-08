# admission-loader-main-unit — two-target caller unit (RUN ONCE, 52/48/4, node exit 1)

**Status: RUN ONCE, 52 tests / 48 pass / 4 fail / 0 skipped, node exit 1, `systemd-run`
rc 1, the 23 selected inputs unchanged.** One GO, one invocation, no retry, no fix, no
rerun. The four failures are in a test file I wrote, not in the launcher; nothing was
edited after the launch and this record is filled from readback.

The real host launcher was not run. Nothing here is realLoader evidence.

## 1. What this slice ran

One transient systemd unit containing a bounded `bash -n` parse check of the real
slice's two scripts, then **one** `node --test --test-concurrency=1` invocation over
**two** literal test files:

    experiments/acceptance/admission-loader-real/tests/main.test.mjs
    experiments/acceptance/admission-loader-real/tests/main-open.test.mjs

Both paths were listed literally — no glob, no discovery, no walk — and both were
passed to the same node invocation, so `--test-concurrency=1` serialised the pair. The
recorded argv is in the run directory's `argv.txt` (`targets=` names both files).

No Loader, no fiber, no plugin runtime, no browser, no build, no install, no npm, no
network. Both targets are import-only module tests over injected seams.

## 2. Constraints, as read back

| Constraint | Value |
| --- | --- |
| unit type | `Type=exec` (read back) |
| memory | `memory.max=805306368`, `swap.max=0` |
| tasks | `pids.max=32` |
| cpu | `cpu.max=50000 100000` |
| runtime | `RuntimeMaxSec` resolved `120000000` µs (`busctl` numeric returned `<unavailable>`) |
| node heap | `--max-old-space-size=384` |
| memory gate | one sample `1830932` KiB ≥ `1228800` → `acc_gate=pass` |
| filesystem | `bwrap --ro-bind / /`, private pid/net/ipc/uts, `/tmp` tmpfs, `env -i` |
| serial queue | shared `experiments/acceptance/runs/.acceptance.lock` |
| attempts | one launch, no retry |

`acc_capture_ok=yes`. **Sandbox boundary:** the `bash -n` step ran inside the unit's
cgroup but *outside* `bwrap`; only the node workload ran under the read-only bind,
private namespaces and `env -i`. This record does not claim the whole payload ran
sandboxed.

## 3. Run identity

| Field | Value |
| --- | --- |
| run id | `20261103T210312Z-admission-loader-main-unit-378708-30780` |
| unit | `admission-loader-main-unit-20261103T210312Z-378708` |
| run directory | `experiments/acceptance/admission-loader-main-unit/runs/20261103T210312Z-admission-loader-main-unit-378708-30780/` |
| launched (UTC) | `2026-11-03T21:03:12Z` (run-id stamp) |
| service runtime | `898 ms`; workload wall `727 ms`; CPU time `353 ms` |
| HEAD | not captured by this runner (it records the hash set, not the commit) |
| unit state after | `LoadState=not-found`, `ActiveState=inactive`, `SubState=dead` |

## 4. Raw outcomes

| Artifact / field | Value |
| --- | --- |
| `systemd-run.rc` | `1` |
| `acc_node_rc` | `1` |
| tests / suites | `52` / `8` |
| pass / fail / skipped / cancelled / todo | `48` / `4` / `0` / `0` / `0` |
| duration | `386.13 ms` |
| `acc_syntax_rc` per subject | `admission-loader-real/run.sh` → `0`; `payload.sh` → `0`; `acc_syntax_status=pass` |
| `acc_workload_argv` | both target paths, one invocation |
| `memory.peak` | `66781184` (journal `63.6M`, swap `0B`) |
| `memory.current` at exit | `33054720` |
| `pids.peak` | `16` |
| `memory.events.local` | `low 0 high 0 max 0 oom 0 oom_kill 0 oom_group_kill 0` |
| journal result | `Main process exited, code=exited, status=1/FAILURE`; `Failed with result 'exit-code'` |
| `hash_status` | `identical` |
| hashes | `23` lines before, `23` after, `3397 B` each, both `.err` empty, no `hashes-diff.txt` |

### 4.1 The 23 hashed files

2 targets (`tests/main.test.mjs`, `tests/main-open.test.mjs`) + 17 selected inputs
(`admission-loader-real/main.mjs`; fixture `prepare.mjs`, `run-loop.mjs`, `collect.mjs`,
`evaluate.mjs`; fixtures `scenarios.mjs`, `trace.mjs`, `scenario.plugin.mjs`,
`coordinator.plugin.mjs`, `scenarios.patch.yml`; `managed-cleanup/lib/{layout,host}.mjs`;
`dsh-plugin-kit/src/{admission,cleanup}.js`; canonical validator, driver projector,
analyzer diagnoser) + the 2 `bash -n` subjects (`admission-loader-real/run.sh`,
`payload.sh`) + this slice's `run.sh` and `payload.sh`.

### 4.2 The four failures, verbatim

All four are in `main-open.test.mjs`. Every `main.test.mjs` describe passed
(`judgeOutcome` ×2 groups, `parseArgs`, `main: refusals happen before any host work`,
`isDirectInvocation`), and within `main-open` the whole
`the recorded pin as it actually stands` group (3 cases) passed along with 8 of 11 in
`checkSourceReview: the pin is compared over real bytes`.

1. `main-open.test.mjs:155` `✖ refuses bytes that do not match the recorded digest` —
   `AssertionError: true !== false` at `:162` (expected `result.ok === false`, got `true`).
2. `main-open.test.mjs:305` `✖ calls the loop once with the trusted flag raised, and
   accepts what it returns` — `one loop call, not a retry`: `0 !== 1` at `:317`.
3. `main-open.test.mjs:361` `✖ lets a later artifact write fault dominate a successful
   loop` — `the loop did run`: `0 !== 1` at `:372`.
4. `main-open.test.mjs:378` `✖ refuses a pending pin (null digest) before the loop, even
   with a clean tree` — `11 !== 10` at `:390` (drift instead of pending).

## 5. Diagnosis of those failures, attributed

Author's reading of the test source. Not a verified result: nothing was edited or rerun
to confirm it.

- (1) The fixture builds its "altered" bytes with `REVIEWED_TEXT.replace('reject();',
  'rejectNow();')`. `REVIEWED_TEXT` contains `function reject() {`, which does not
  contain the searched `reject();`, so the replacement matched nothing and the "altered"
  buffer was byte-identical to the reviewed one. The digest therefore agreed and
  `checkSourceReview` correctly returned `ok:true`. The assertion was wrong about its
  own fixture; the comparison under test behaved as designed.
- (2), (3), (4) share one cause: these cases pass `io: fakeIo().io`, and that double's
  `readFile` throws by design ("the fake io serves no files; pass checkSourceReview its
  own reader"). `main()` reads the reviewed sources through `io`, so the read failed →
  `SOURCE_REVIEW_DRIFT` → the loop was never constructed. In (2) and (3) that gives zero
  loop calls where the test expected one; in (4) it gives exit 11 where the test expected
  10, because drift is decided before the null-digest check. The launcher did what its
  gate order says; the fixtures asked for something the double cannot supply.

What this does **not** show: that a fix would pass. The correction would be to give
those cases an `io` whose `readFile` returns the approved bytes (or to route the review
read through the `review`/`readFile` seam), and to alter bytes that actually differ.
Neither was done — the GO was one attempt, no retry.

### 5.1 Correction applied afterwards (NOT RUN)

Authorised by the Lead after reading `main-open.test.mjs:155-164` and `:300-399`, and
confined to that one test file. **Nothing was executed**: no `node`, no unit, no launch.
The count above stays `52 / 48 / 4` because that is what the one run measured; a new
count can only come from a new execution and a new GO.

What the fix does, by the sections the Lead named — all of it fixture-side, no
`main.mjs` and no runner edit:

- **`fakeIo` gained a `files` option.** It maps a path *suffix* to the bytes that path
  reads as; a path with no matching suffix still throws, so unreadable stays the
  default and a case that forgets to serve its bytes fails loudly. `calls` and `failOn`
  are unchanged. This is the one seam `main()` actually uses for reviewed sources: it
  passes `readFile: io.readFile` into `checkSourceReview()`, so no other injection point
  can make a read succeed.
- **(1) mismatch now uses bytes that really differ** — `REVIEWED_TEXT` plus an appended
  comment — with `!altered.equals(reviewed)` and `sha256(altered) !== sha256(reviewed)`
  asserted *before* the call, so the case cannot silently compare a buffer with itself
  again. The refusal assertions are unchanged, plus one that the reported digest is the
  altered one.
- **(2) the success case is wired to the double it inspects.** It serves the reviewed
  bytes, then asserts against `fake.calls`: exactly one `readFile`, targeting the
  reviewed path, with no encoding argument; a `mkdir` ending `/work`; and the five
  artifact writes in order, with `outcome.written` equal to that same list. The old
  `assert.deepEqual(calls, [])` compared an array that was never connected to the run.
- **(3) the drift case now observes a mismatch rather than an unreadable file.** It
  serves altered bytes, keeps one loop call as zero, and reads the `source-review.json`
  body the double recorded to check it carries the computed digest, the pin it was
  compared with, and `SOURCE_REVIEW_DRIFT`. The vacuous `altered.length !== 0` is gone.
- **(4) the pending case serves matching, readable bytes**, so the only thing left that
  can refuse is the null digest itself; it also checks the record names
  `SOURCE_REVIEW_PENDING` and carries the computed digest.

Two further cases were corrected in the same file because the same defect made them
test the double rather than the gate: the late-write case now serves matching bytes
(so the loop really runs and the four pre-fault artifacts are the ones claimed), and the
no-mutation case serves matching bytes and asserts `EXIT_ACCEPTED`, so its claim is
about a run that did the work instead of one that refused at gate 1. The write-fault
case keeps an unreadable double **deliberately**, and now says so: the accompanying
refusal is a drift, which is the point — the write fault must outrank a refusal the run
was already making. Unreadable-as-drift keeps its own dedicated case, untouched.

**Still unverified.** These are edits to a test file, reviewed by reading. They have not
been parsed, imported, or run; whether they pass, and what the count becomes, is
unknown. In particular the assertions that name artifact order and `outcome.written`
equality depend on `main()`'s push order, which was read rather than exercised.

## 6. What this record will not claim

- **Not green.** `48/52`, node exit `1`.
- **Not a launcher defect.** No failing case reached `runAcceptanceLoop`; the failures
  are in fixtures I wrote, and the launcher's gates behaved consistently with their
  documented order.
- **Not a test of the acceptance loop.** No Loader was booted; nothing here is realLoader
  evidence.
- **Not a re-run or revision of 31/31.** Different target set, different hash count; the
  earlier numbers are not comparable and are not restated here.
- **Not closure.** The 23 files are a *selected witness* over identified inputs, not a
  proven transitive closure, and not provenance: sha256 shows bytes matched at two
  sampled moments.
- **Not causal.** A result correlates with the pinned inputs; it cannot exclude an
  unlisted input or an environmental factor.
- **Not a certification.** Nothing here certifies the admission-evidence protocol.
- **Terminology, corrected.** The earlier `payload.sh` ran `"${TESTS[0]}"`. For its
  original one-file scope that was correct, not a defect; it became a limitation only
  when the target set grew to two files, and was then changed to `"${TESTS[@]}"`. The
  earlier 31/31 run is **not** retrospectively incomplete: it ran the file it named.

## 7. Linkage

- 2026-11-04: `2026-11-04-admission-loader-main-unit.md` recorded one launch over the
  single target `tests/main.test.mjs`, measured `31/31`, node exit 0, peak `65327104`.
  That record stands as measured and is not edited by this one.
- 2026-11-04 (later, no run): the source pin was recorded in `main.mjs`, two pending-era
  cases in `main.test.mjs` were updated to current semantics, `tests/main-open.test.mjs`
  was written, and this slice's runners moved from one target to two and 22 → 23 hashed
  files.
- 2026-11-04 (this launch): the two-target form was run once and measured `48/52`.
  Because two cases in the earlier file changed, the 31/31 describes bytes that no longer
  exist at those paths: it does not validate either target as it stands, and this run
  does not validate the earlier measurement.
- 2026-11-04 (later, separate record): the fixture corrections described in §5.1 were
  authorised and written, and the Lead authorised one recheck of the unchanged runner.
  That attempt is recorded in `2026-11-04-admission-loader-main-open-recheck.md`. This
  record keeps its own numbers; the recheck does not revise them.

## 8. Gate

The GO is spent: one launch, no retry, no fix in place. A second attempt — whether to
confirm the fixture diagnosis or to obtain a green count — needs a new GO and a new
record. Nothing was rerun to make this file read better than the run.
