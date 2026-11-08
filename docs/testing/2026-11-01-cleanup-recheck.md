# Cleanup acceptance — single recheck run (2026-11-01)

Status: **executed once, verdict `pass`, exit 0.** This document records one
attempt of the fixed acceptance entry over the cleanup three-file suite. It is a
recheck record, not a redesign, not a repair, and not a claim about any suite
that was not run.

Ownership note: `2026-11-01-cleanup-acceptance.md` is a different record owned by
another worker. This file is the only artifact written by this run.

## 1. What was launched

| field | value |
| --- | --- |
| command | `bash experiments/acceptance/acceptance.sh run cleanup` |
| cwd | `/root/dsh-ecosystem-spec` |
| launcher | `bash` (the entry is the sanctioned single entry; no standalone `node`, no standalone `bash` test invocation) |
| attempts | exactly **one** — no retry, no preflight re-run, no fallback path |
| started | 2026-11-01T14:18:54Z = 2026-11-01T22:18:54+08:00 (Asia/Shanghai, UTC+08:00) |
| ended | 2026-11-01T14:18:57Z = 2026-11-01T22:18:57+08:00 |
| unit | `acc-clean-20261101t141854z-cleanup-114617-10438.service` |
| run id | `20261101T141854Z-cleanup-114617-10438` (unique, non-overwriting output dir) |

## 2. Entry/payload confirmation, read before the launch

Read-only inspection of `experiments/acceptance/acceptance.sh` and
`experiments/acceptance/lib/unit-cleanup-tests.sh` before launching confirmed
the mandatory shape rather than assuming it:

- **Mandatory three files, literal, no glob and no discovery**
  (`CLEANUP_TESTS`, acceptance.sh:111-115):
  1. `projects/dsh-plugin-kit/tests/cleanup.test.js`
  2. `projects/dsh-plugin-kit/tests/managed-registration.test.js`
  3. `experiments/cleanup-differential/test/cleanup-differential.test.mjs`

  All three are mandatory: the payload's source gate refuses the whole layer
  while any is absent (unit-cleanup-tests.sh:118-125), so a two-file run is
  impossible by construction.
- **Envelope literals** (acceptance.sh:64-82): `Type=exec` (oneshot is refused
  because it silently ignores `RuntimeMaxSec`), `MemoryMax=768M`,
  `MemorySwapMax=0`, `TasksMax=32`, `CPUQuota=50%`, `RuntimeMaxSec=120`,
  `NODE_HEAP_MB=384`, read-only availability gate `MIN_AVAIL_UNIT=1200` MiB.
- **Isolation and fail-closed order**: `bwrap --ro-bind / /` plus `--tmpfs /tmp`
  plus `--unshare-pid --unshare-net --unshare-ipc --unshare-uts`
  (unit-cleanup-tests.sh:247-251). The observed envelope is captured and compared
  **before** any `node` or `bwrap` process exists
  (unit-cleanup-tests.sh:19-25, 127-140); a mismatch or `<unreadable>` refuses
  with exit 70 and `acc_workload_started=no`. Verification therefore precedes
  Node, as required.

Nothing in the entry, payload, sources, tests, or runner was modified by this
run.

## 3. Requested vs effective caps

Requested is what the entry hands to `systemd-run`; effective is what the unit,
its cgroup, and the in-unit Node probe actually reported.

| cap | requested | effective (observed in-unit) |
| --- | --- | --- |
| unit type | `exec` | `exec` (`acc_unit_type=exec`) |
| memory max | `768M` | `memory.max=805306368` B (768 MiB) |
| swap max | `0` | `memory.swap.max=0` |
| tasks max | `32` | `pids.max=32` |
| CPU quota | `50%` | `cpu.max=50000 100000` (`acc_unit_cpu_quota=500ms`) |
| runtime max | `120 s` | `RuntimeMaxUSec=120000000` (raw text `2min`, normalized; numeric read via manager) |
| node heap cap | `384 MiB` | `--max-old-space-size=384`, `acc_node_heap_cap_mib=384`, `v8` heap limit `452984832` B (the payload compares the cap, 384, not the raw V8 number) |
| host availability gate | `>=1200 MiB` | `MemAvailable=1754 MiB` at gate time — gate passed |

`envelope_verified=yes`; no mismatch token was produced.

## 4. Result

| field | value |
| --- | --- |
| verdict | `pass` |
| acceptance exit code | `0` |
| `systemd_run_rc` | `0` |
| workload (node) rc | `0` |
| unit service result | `code=exited, status=0/SUCCESS` |
| service runtime | `2.998 s` |
| test files actually run | `acc_cleanup_source_count=3` |
| tests | **37** |
| pass | **37** |
| fail | **0** |
| cancelled / skipped / todo | `0 / 0 / 0` |
| test duration | `2485.178 ms` |
| memory peak | `130568192` B (124.5 MiB) |
| pids peak | `17` |
| memory.events | `low 0 high 0 max 0 oom 0 oom_kill 0 oom_group_kill 0` |
| node | `v24.21.0`, `--max-old-space-size=384 --experimental-transform-types` |
| workload argv | `node --test --test-concurrency=1 <the three files>` |
| digest before / after | `7ece18b4…b928a96` / identical (`originals_match=yes`) |

No refusal, no preflight blocker, no deviation from the entry's own contract, no
retry, and no error to record.

## 5. Current source and test digests (captured live, not historical)

Taken with `sha256sum` in `/root/dsh-ecosystem-spec` immediately before the
launch, so these name the exact bytes this run read:

```
47f52a5455eadb5cec5f5fcbfa87f6f74cc917e83a89b20be79830400cde2e44  projects/dsh-plugin-kit/tests/cleanup.test.js
7ac81f2416ea52870bfe44ca836a72170bcee2624b63332fa24faacef890fc13  projects/dsh-plugin-kit/tests/managed-registration.test.js
451e3f387f3cf6d027eb59ae93194728acfe00e839d21e56a4c49a00f0b005ac  experiments/cleanup-differential/test/cleanup-differential.test.mjs
5fab080e82c7f30523d28bdc8b3904be25ab5bf14a9580c2562f8fe7909f5d10  projects/dsh-plugin-kit/src/cleanup.js
8341e9fdebb392ce12b59c5077b5e6458234ef38827ba17ee010d327be57df34  projects/dsh-plugin-kit/src/cleanup.d.ts
8f94a719754f24b1693d0a95aff5cdd2c765b04d0d6fc893db16a21a47a72ffe  experiments/cleanup-differential/src/harness.mjs
```

The entry's own combined digest over the three test files
(`tests_digest_before`/`_after`, `7ece18b48dc9568d52d691b330a99864b4fe7267e9d1059da848b3443b928a96`)
agrees with itself across the launch, so the run read one unchanged file set.

## 6. Delta against the earlier record (reported context, not re-verified here)

The prior record for this suite was **37 tests / 34 pass / 3 fail**. Since that
record, the only reported change is **three exact message assertions inside
`projects/dsh-plugin-kit/tests/cleanup.test.js`**; the other two files and all
sources are reported unchanged. This run observes **37 / 37 / 0**.

Two things follow, and they are kept separate on purpose:

- The three previously failing assertions are no longer failing. That is the
  effect of asserting the exact message text; it is consistent with "only three
  message assertions changed".
- The three are identifiable and count to exactly three:
  `assert.equal(error.message, …)` at
  `projects/dsh-plugin-kit/tests/cleanup.test.js:286`, `:361`, and `:416`
  (`grep -c "assert.equal(error.message,"` → `3`). They pin the full string
  `cleanup scope "<label>" close failed: <n> of <m> disposer(s) threw`, which is
  the format the kit builds at `projects/dsh-plugin-kit/src/cleanup.js:158`:
  `` `${subject} close failed: ${failures.length} of ${attempted} disposer(s) threw` ``.
  So the assertions now match the implementation's own wording rather than a
  paraphrase.
- Nothing else was relaxed to reach green: the frozen set is still three files,
  the counts are 37 in and 37 out with `cancelled/skipped/todo = 0`, and the
  entry's own digest check passed. I did not diff these edits against the earlier
  revision — `projects/` is untracked in this checkout, so `git diff` cannot show
  them — and this document claims no more than what the current bytes show.

Claims about other suites, and the earlier 34/3 split, are not restated as
verified by this run.

## 7. What the tests exercise, and what they do not

The suite is a **differential** comparison of two arms:

- **OLD arm**: the *real legacy* vendored implementation together with **host
  stubs** — a stub host map, stub publication, stub endpoints. The legacy code
  path is genuine; the host around it is a stub.
- **NEW arm**: the plugin-kit implementation driven through **caller-supplied
  ports**.

Neither arm runs the **real loader**, and this suite does **not** cover a
**repaired vendor**. A pass here means the kit's port-based teardown behaves as
the differential case describes against a stubbed host — it is not evidence that
the real loader, or a repaired vendor tree, behaves the same way.

## 8. Known limitation carried forward

An **infinite disposer remains a limitation**: a disposer that never resolves is
not bounded by this suite, and the green result above says nothing about it. It
is recorded as an open limitation rather than a passing case.

## 9. Evidence paths

- Run directory:
  `experiments/acceptance/runs/20261101T141854Z-cleanup-114617-10438/`
- Receipt (requested limits, expected/observed envelope, peaks, verdict):
  `experiments/acceptance/runs/20261101T141854Z-cleanup-114617-10438/receipt.txt`
- Raw in-unit report / full node TAP output:
  `experiments/acceptance/runs/20261101T141854Z-cleanup-114617-10438/unit.log`

Reproduce with exactly the same single command from
`/root/dsh-ecosystem-spec`; the entry acquires an exclusive lock, so a concurrent
invocation refuses with exit 75 rather than interleaving.
