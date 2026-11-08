# admission-loader unit run — ASI fix and close-rejection discriminators

**Status: RUN ONCE — 87 tests, 87 pass, 0 fail, node exit 0.** One launch, no retry.
Run directory
`experiments/acceptance/admission-loader-unit/runs/20261103T212950Z-admission-loader-unit-379897-6349/`.

This record was written as a PREPARED-NOT-RUN skeleton before the launch; §6 and the
envelope rows in §5 are transcribed from that run directory afterwards.

## 1. Why this run

A real Loader attempt
(`experiments/acceptance/admission-loader-real/runs/20261103T211530Z-admission-loader-real-379361-1731/`)
was refused at evaluation with
`EVIDENCE_OBSERVATION_INCOMPLETE: closeRejection: no rejection observation`. The
diagnosis recorded in §11 of `2026-11-04-admission-loader-real.md` names a grammar
defect in the fixture's throwing branch: a statement with no terminating semicolon
followed by a line beginning `(error)` is not split by ASI, so the two lines parse as
`error.name = 'SyntheticCleanupFault'(error).injectedBy = …`, a call on a string that
would throw before `ref.error = error` runs. That reading is a grammar conclusion from
the source text and the shape of the stored evidence — the thrown member was never
recorded, so it is a diagnosis, not a captured `TypeError` (§7.2). On that reading the
fixture never retained the Error it threw, and containment could not be computed.

Code-only corrections then applied:

- `fixtures/scenarios.mjs:311-321` — the throwing branch now uses
  `Object.assign(error, { name: 'SyntheticCleanupFault', injectedBy: … })`, so no line
  in that file begins with `(`.
- `fixtures/scenarios.mjs:859-882` — `close-settled` carries four scalar
  discriminators (`errorRefPresent`, `membersIsArray`, `memberCount`, `isAggregate`),
  so a future null can be attributed rather than merely recorded.
- `fixtures/scenarios.mjs:911-919` — the containment limitation is emitted only when
  `containsInjectedFailure === false`, i.e. only for a comparison that happened.
- `tests/scenarios-contract.test.mjs` — a regression drives the **real** kit
  coordinator's begin/close/finish for the cleanup-failure case and requires the
  retained Error to be a rejection member by identity.

This run asks whether those corrections behave as written. It is not a re-run of the
refused Loader attempt and cannot replace one.

## 2. What this run is, and is not

One transient systemd unit, one serial `node --test --test-concurrency=1` over two
literal files:

- `experiments/admission-loader-fixture/tests/evaluate.test.mjs`
- `experiments/admission-loader-fixture/tests/scenarios-contract.test.mjs`

**Is:** the fixture contract and evaluator suites plus the new in-process
real-coordinator regression, in the established bounded envelope.

**Is not:** real Loader acceptance. No Loader, no Cordis fiber, no host, no plugin
runtime, no browser. The regression builds the kit's own coordinator in the test
process — a real coordinator and a real cleanup scope, but not the Loader's lifecycle.
The canonical four-case acceptance remains unmeasured.

## 3. Scope of the launch

| Item | Value |
| --- | --- |
| Command | `bash experiments/acceptance/admission-loader-unit/run.sh` |
| Launcher / payload | unchanged; not edited for this run or after it |
| Targets | the two literal files above, published in `run.sh:62-65` and `payload.sh:27-30` |
| Attempts | one. No retry, no in-run edit, no post-run repair |
| Lock | `experiments/acceptance/runs/.acceptance.lock`, non-blocking |
| Network / install | none |
| Production | `projects/**` unmodified by this run |

`run.sh:85` builds `HASHED` from `TESTS` + `INPUTS` + the two scripts = 17 files. The
file carrying the regression is one of the two targets; the file carrying the fix,
`fixtures/scenarios.mjs`, is one of the 13 selected inputs. Both are inside the hash
set, so a change to either is visible below.

## 4. Pre-run state, read-only

| Item | Observed before launch |
| --- | --- |
| Prior run roots | `…-375881-2592/`, `…-376214-24737/` — retained, untouched |
| Active `admission-loader-*` units | none (empty list, rc 0) |
| `MemAvailable` | 1742032 kB (gate 1228800) |
| `fixtures/scenarios.mjs` sha256 | `24df6e3200979ff368f2cb12bae1cdfb393f182b76fbf3a7245174322daf18e4` |
| `tests/scenarios-contract.test.mjs` sha256 | `79c77686481d2eea9d0117548651d1e46ef200d988a096e261c907a6f958c06e` |

## 5. Run identity and envelope as measured

| Field | Measured |
| --- | --- |
| Run id | `20261103T212950Z-admission-loader-unit-379897-6349` |
| Unit | `admission-loader-unit-20261103T212950Z-379897` |
| `systemd-run.rc` | `0` |
| `status.txt` | `hash_status=identical`, `acceptance_exit=0` |
| cgroup | `/system.slice/admission-loader-unit-20261103T212950Z-379897.service` |
| `memory.max` / `swap.max` / `pids.max` | `805306368` / `0` / `32` |
| `cpu.max` | `50000 100000` |
| `Type` | `exec` |
| `RuntimeMaxUSec` | `2min` resolved to `120000000` (`busctl` numeric returned `<unavailable>`) |
| `acc_capture_ok` | `yes` (every knob read back and matched) |
| Gate | `1807636 ≥ 1228800` KiB → `pass` |
| Heap cap | `acc_node_heap_cap_mib=384`, `NODE_OPTIONS=--max-old-space-size=384` |
| bwrap | `--ro-bind / / --dev /dev --proc /proc --tmpfs /tmp --unshare-pid --unshare-net --unshare-ipc --unshare-uts --die-with-parent` |
| `memory.peak` / current at exit | `68349952` / `33153024` |
| `pids.peak` | `20` (of 32) |
| `memory.events.local` | `low 0 high 0 max 0 oom 0 oom_kill 0 oom_group_kill 0` |
| Workload wall / node rc | `806` ms / `0` |
| Journal | `Deactivated successfully`, `365ms CPU`, `65.1M memory peak` |
| Unit after exit | `LoadState=not-found`, `ActiveState=inactive`, `SubState=dead`; active `admission-loader-*` list empty |

## 6. Test evidence, transcribed

The reporter summary in `unit.log:133-139`:

| Field | Value |
| --- | --- |
| tests | **87** |
| suites | 9 |
| pass | **87** |
| fail | **0** |
| cancelled / skipped / todo | 0 / 0 / 0 |
| duration_ms | `491.019105` |

No `✖` appears anywhere in `unit.log`. The new regression is green:

`unit.log:131  ✔ the real coordinator keeps the fixture error across a failed close (1.702645ms)`

The count moved from the earlier 86 to 87 — one added test — and that difference is
transcribed from this log, not assumed. Both targets ran: `acc_test_target=… exists=yes`
for each (`unit.log:4-5`), and `acc_workload_argv` (`:26`) names both files.

### 6.1 Hash pair and cross-run difference

`hashes-before.txt` and `hashes-after.txt` are both 2511 B, `.err` files are 0 B, and
`cmp` reports them identical: no drift inside the run. Diffing this run's
`hashes-before.txt` against the earlier 86/86 run names **exactly two** lines, both
disclosed before the launch:

| File | Earlier (86/86) | This run |
| --- | --- | --- |
| `tests/scenarios-contract.test.mjs` | `fd15b6f359aba9581a9d093e55bb13ba3dd03e4aafc6c314a707a58885fe2858` | `79c77686481d2eea9d0117548651d1e46ef200d988a096e261c907a6f958c06e` |
| `fixtures/scenarios.mjs` | `81b3bb189937b4b7fec62851af45d963ae4e3099a518d0b25d271e324f48b50b` | `24df6e3200979ff368f2cb12bae1cdfb393f182b76fbf3a7245174322daf18e4` |

The other 15 files are byte-identical, including both targets' companion
`evaluate.test.mjs` and both scripts.

Read that precisely, because the obvious shorthand is wrong: **the runner is
unchanged; the input set is not.** `run.sh` and `payload.sh` are byte-identical to the
previous run, so the launcher, the caps, the sandbox and the hashing procedure are the
same bytes. But two of the seventeen hashed files differ, and they differ exactly where
the correction was applied. An unchanged runner therefore says nothing about whether
the tested inputs were unchanged — which is the whole reason the runner hashes itself
alongside its inputs. Wording such as "not an unchanged-runner comparison" would
contradict the table above it and is not used here.

### 6.2 Raw paths, retained

| Artifact | Size |
| --- | --- |
| `argv.txt` | 2318 B |
| `hashes-before.txt` / `hashes-before.err` | 2511 B / 0 B |
| `hashes-after.txt` / `hashes-after.err` | 2511 B / 0 B |
| `unit.log` | 9665 B |
| `journal.txt` | 615 B |
| `status.txt` | 166 B |
| `systemd-run.rc` | 2 B |
| `hashes-diff.txt` | absent — no drift to report |

All three run roots under `runs/` are retained; nothing was deleted or rewritten.

## 7. What this record will not claim

1. Not real Loader evidence, and not a substitute for the refused real attempt.
2. **Not an observation of the original `TypeError`.** Nothing recorded that member's
   name or message; the grammar reading is a diagnosis from the source text plus the
   shape of the stored evidence, not a captured failure. A green regression is
   consistent with it and does not confirm it.
3. Not proof every path through the throwing branch is now safe. The narrower claim:
   no line in that file begins with `(`, and one leading-paren grep over the fixture
   tree found no other such statement.
4. Not a statement about canonical four-case acceptance, which needs the real slice.
5. Not a byte-completeness claim about what the tests load: 17 hashed files are a
   witness over identified inputs, not a closure over the import graph.
6. Not an unchanged-input comparison across runs: the runner bytes are unchanged, two
   inputs are not (§6.1).
7. Not a repair. Nothing was changed after the launch, and no failure was edited away.

## 8. Deviations

None in execution: one launch, one workload, exit 0, no intervention. Two disclosed
input differences from the earlier run (§6.1) are the authorised correction, not
drift. The pre-run read-only inspections were `sed`/`grep`/`ls`/`sha256sum`/`systemctl`
over sources and `/proc/meminfo`; no node, no loader, no host.

## 9. Gate

The authorised attempt is spent. A second attempt needs a new GO and its own record.
The real Loader slice stays refused and unmeasured until a separate GO.
