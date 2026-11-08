# admission-loader-main-unit — caller unit slice (RUN ONCE, 31/31, node exit 0)

**Status: RUN ONCE, 31 tests / 31 pass / 0 fail, node exit 0, `systemd-run` rc 0,
inputs unchanged.** One GO, one invocation, no retry. The real host launcher was not
run; nothing here is realLoader evidence.

Prepared and run: 2026-11-04. Slice: `experiments/acceptance/admission-loader-main-unit/`.
Target: `experiments/acceptance/admission-loader-real/tests/main.test.mjs` (one file).

**Dated linkage (2026-11-04, later, NO RUN).** After this launch the source pin was
recorded in `main.mjs` (`SOURCE_REVIEW_PENDING` false, both kit digests filled). Two
cases in `main.test.mjs` described the pending era and were updated to current
semantics, and `tests/main-open.test.mjs` was written for the open branch. The slice's
runners therefore now name **two** targets and hash **23** files instead of one and 22.
This record still describes exactly what was measured — one target, 31/31, those bytes
— and is not rewritten, restated or superseded. What follows from the change is stated
without softening: the 31/31 above was taken over file contents that no longer exist at
those paths, so it does not validate either target as it stands now. The two-target
slice has its own record, `2026-11-04-admission-loader-main-open.md`, which was run once
afterwards and measured **48/52** (node exit 1) — four failures in that file's own
fixtures, no failing case reaching the caller's loop.

## 1. What this record is for

To hold, in one place, the identity, constraints and observed evidence of a single
bounded unit run of the real caller's tests. It is not a result about the acceptance
loop. A green run here shows that the caller's own gates behave as its tests say; it
does not show that the loop works against a real Loader.

## 2. Authority and limits

- One transient systemd unit, one serial `node --test --test-concurrency=1`, one
  literal test file. One GO, one invocation, no retry.
- No Loader, no Cordis fiber, no host, no plugin runtime, no browser. The target is
  import-only and never invokes the caller's loop: every test injects a stub
  `runLoop` or stops at a gate before the loop is constructed.
- No build, no install, no npm, no network, no copy, no deletion, no cleanup of old
  run roots.
- No production source is modified by the slice or by the run.
- The unit also performs a bounded `bash -n` parse check of the real slice's two
  scripts, and stops before node if either fails. `bash -n` proves parseability only.
- **Sandbox boundary, pre-registered and observed:** the `bash -n` step ran inside the
  unit's cgroup but *outside* `bwrap`, so it saw the real filesystem while the cgroup
  limits still applied to it; only the `node --test` workload ran under the read-only
  bind, private namespaces and `env -i`. This record does not claim that the whole
  payload ran sandboxed.

## 3. Run identity

| Field | Value |
| --- | --- |
| run id | `20261103T204706Z-admission-loader-main-unit-378110-9369` |
| unit name | `admission-loader-main-unit-20261103T204706Z-378110` |
| run directory | `experiments/acceptance/admission-loader-main-unit/runs/20261103T204706Z-admission-loader-main-unit-378110-9369/` |
| started (UTC) | `2026-11-03T20:47:06Z` (run-id stamp) |
| finished (UTC) | ≈ `2026-11-03T20:47:07Z`; service runtime `632 ms`, workload wall `500 ms` |
| wall clock | workload `500 ms`, service `632 ms`, CPU `245 ms` |
| HEAD at launch | `effb9581687f995841d872304e03627473039957` |
| tracked tree state | 7 `git status --porcelain` entries present, not inspected here |

HEAD identifies the tracked tree only. The `experiments/` sources used here are
untracked, so HEAD is **not** their version; the hashes below are the only identity
this run has for them.

## 4. Invocation

    bash experiments/acceptance/admission-loader-main-unit/run.sh

One argument-free invocation; the exact `systemd-run` argv is preserved verbatim in
`argv.txt` (unit, `Type=exec`, `MemoryMax=768M`, `MemorySwapMax=0`, `TasksMax=32`,
`RuntimeMaxSec=120`, `CPUQuota=50%`, `WorkingDirectory=…/admission-loader-main-unit`,
`-- /bin/bash …/payload.sh <unit>`).

## 5. Envelope

| Readback | Expected | Observed |
| --- | --- | --- |
| `memory.max` | 805306368 | `805306368` |
| `memory.swap.max` | 0 | `0` |
| `pids.max` | 32 | `32` |
| `cpu.max` | `50000 100000` | `50000 100000` |
| `Type` (unit) | `exec` | `exec` |
| `RuntimeMaxUSec` (unit) | 120000000 | `2min` → `120000000` |
| capacity gate | ≥ 1228800 KiB | `1790436` KiB — pass |
| `acc_capture_ok` | `yes` | `yes` |

`acc_cgroup_path=/system.slice/admission-loader-main-unit-20261103T204706Z-378110.service`.
`acc_runtime_usec_numeric=<unavailable>` (the `busctl` read did not yield `t <n>`), so
the numeric span came from the unit's own `RuntimeMaxUSec` readback; it converted to
exactly `120000000`. The envelope matched before any workload started.

## 6. Test outcome

| Field | Value |
| --- | --- |
| node exit code | `0` (`acc_node_rc=0`) |
| tests | `31` |
| suites | `5` |
| pass | `31` |
| fail | `0` |
| cancelled / skipped / todo | `0` / `0` / `0` |
| duration | `185.65 ms` (reported); workload wall `500 ms` |
| failing titles | none |

Observed suites, all green: `judgeOutcome: the acceptance stage is checked, not
assumed` (9), `judgeOutcome: teardown, schema and diagnostics stay required` (7),
`parseArgs: one output directory, no flag for the trusted review` (6), `main:
refusals happen before any host work` (6), `isDirectInvocation: the import guard is a
function, not a side effect` (3).

Two of those are worth naming, because they pin the gate that stays closed: `refuses
a pending review before the loop is constructed` and `still refuses a pending review
when both digests are filled in`.

## 6.1 Parse check of the real slice's scripts

| Subject | rc | Result |
| --- | --- | --- |
| `experiments/acceptance/admission-loader-real/run.sh` | `0` | parses |
| `experiments/acceptance/admission-loader-real/payload.sh` | `0` | parses |

`acc_syntax_status=pass`, 30 s timeout per subject, `acc_syntax_note=parse only;
nothing is executed`. These are parse results, not proof that either launcher does
what its comments say, and they ran outside `bwrap` (see §2).

## 7. Resource accounting and hash pair

| Field | Value |
| --- | --- |
| `memory.peak` | `65327104` (62.3M; journal confirms swap `0B`) |
| `memory.current` at exit | `30265344` |
| `pids.peak` | `16` of 32 |
| `memory.events.local` | `low 0 high 0 max 0 oom 0 oom_kill 0 oom_group_kill 0` |
| `systemd-run.rc` | `0` |
| `hash_status` | `identical` |
| `acceptance_exit` | `0` |
| `hashes-diff.txt` | not produced |

22 hashed files: 1 target + 17 selected inputs + the 2 `bash -n` subjects + this
slice's `run.sh` and `payload.sh`. Before and after lists are byte-identical
(`diff` empty), 3236 B each, both `.err` files empty. Sample hashes:
`tests/main.test.mjs` `6e56282239f8…b72525`, `real/main.mjs` `d9e071837ba0…356ff7`,
`prepare.mjs` `b580215e2899…112c99`.

"Identical" means *these 22 files did not change during the run*. It is a selected
witness, not a closure over everything the tests load, and it says nothing about the
state before or after this pair of samples.

## 8. What this record does not claim

1. **Not realLoader evidence.** No Loader, fiber, host, plugin runtime or browser was
   launched, and the caller's loop was never invoked. This cannot be used as evidence
   about the real slice.
2. **Not the real slice's verdict.** A green unit run cannot stand in for a real
   acceptance run, and does not predict one.
3. **Not a closure over inputs.** The 22-file hash set is a selected witness.
4. **Not whole-payload sandboxing.** Only node ran under `bwrap`; the parse step ran
   in the unit cgroup on the real filesystem.
5. **Not a proof of behaviour.** `bash -n` returned 0: it parses. It is not evidence
   that the parsed launcher behaves as documented, and it authorises nothing.
6. **Not a version identity.** HEAD is the tracked tree; these sources are untracked;
   sha256 is evidence that bytes matched at two sampled moments, never provenance.
7. **Not a certification.** No admission certification is issued, implied or
   supported by this slice, whatever the result.
8. **Not a stability claim.** One run of one file is one sample.
9. **Not valid after a pin change.** The target asserted
   `SOURCE_REVIEW_PENDING === true` and two `null` digests at the moment of this run.
   Both have since moved (see §10); this slice must be re-reviewed rather than run
   as-is, and this record is not evidence about the new state.

## 9. Unit disposition and outcome

After the unit exited: `LoadState=not-found`, `ActiveState=inactive`, `SubState=dead`;
`systemctl list-units --state=active,activating 'admission-loader-*'` returned
nothing, so no unit from this ladder was left running. The unit was `--collect`ed and
its journal is retained in `journal.txt`.

Outcome: 31/31, node exit 0, inputs unchanged, envelope matched, both parse checks
clean. The GO is spent. No further run of this slice is authorised by this record, and
the next step it enables — a real Loader run of `admission-loader-real` — remained
blocked on the source-review digests at the time of this run.

## 10. Later change: the pin is recorded, so `main.mjs` differs from the one measured here

After this run, and **without rerunning or amending anything above**, the real
slice's `main.mjs` changed: both `SOURCE_REVIEW` digests were filled from the Lead's
read-only `sha256sum` and `SOURCE_REVIEW_PENDING` was set to `false`, in one diff.

Consequences, stated plainly:

- The `main.mjs` measured here had `SOURCE_REVIEW_PENDING === true` and two `null`
  digests. The file on disk no longer does. The hash recorded in §7
  (`d9e071837ba0…356ff7`) identifies **the bytes this run measured**, not the current
  file; it was not recomputed and must not be read as the file's present identity.
- Two of the 31 cases pin the closed gate — `refuses a pending review before the loop
  is constructed` and `still refuses a pending review when both digests are filled in`.
  They described the pre-pin caller truthfully and are now stale. **This slice's 31/31
  therefore does not validate the open branch**, and nothing here should be cited as
  coverage of the pinned-and-open gate.
- Nothing was rerun to make the numbers match the new state, and the run's measured
  result stands exactly as recorded: it is a true statement about the bytes it
  measured, and an invalid statement about `main.mjs` as it now stands.

Post-pin coverage is designed but not written (`experiments/acceptance/admission-loader-real/README.md`,
section *Post-pin coverage — DESIGN, not written, not run*).
