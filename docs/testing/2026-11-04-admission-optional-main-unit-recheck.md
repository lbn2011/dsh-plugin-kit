# Admission optional-main — recheck of the fixture correction

**Status: RUN ONCE — 60 tests / 60 pass / 0 fail, node exit 0.** The measurement below
is one launch of the unchanged runner over the two literal targets. The 60 / 57 / 3
attempt recorded in `2026-11-04-admission-optional-main-unit.md` is preserved there and
is not restated or corrected by this record.

## 1. Why this recheck exists

The first attempt of this slice measured **60 / 57 / 3** (node exit 1). All three
failures were in `experiments/acceptance/admission-loader-real/tests/main.test.mjs`, and
all three had one cause: those cases drove `main()` with a reader serving synthetic text
that could not hash to the recorded kit digests, so the launcher refused
`SOURCE_REVIEW_DRIFT` before the loop existed.

The fixture was then corrected (first record §5.2, NOT RETESTED). This run measures that
correction. It does not certify that the correction was correct in principle; it records
that these bytes, run once, passed.

## 2. Run identity

| field | value |
|---|---|
| run id | `20261104T151147Z-admission-loader-main-unit-405805-31685` |
| unit | `admission-loader-main-unit-20261104T151147Z-405805` |
| `systemd_run_rc` | `0` |
| `acceptance_exit` | `0` |
| `acc_node_rc` | `0` |
| `hash_status` | `identical` |
| HEAD | *not captured* — the runner does not record a commit for this slice |

## 3. Invocation, verbatim

```
systemd-run --wait --pipe --collect --unit=admission-loader-main-unit-20261104T151147Z-405805
  --property=Type=exec --property=MemoryMax=768M --property=MemorySwapMax=0
  --property=TasksMax=32 --property=RuntimeMaxSec=120 --property=CPUQuota=50%
  --property=WorkingDirectory=/root/dsh-ecosystem-spec/experiments/acceptance/admission-loader-main-unit
  -- /bin/bash .../payload.sh admission-loader-main-unit-20261104T151147Z-405805
```

Two targets hashed, nineteen selected inputs, two `bash -n` subjects and the two
scripts: 2 + 19 + 2 + 2 = **25 files** in `hashed_files=`.

## 4. Counts, read from `unit.log`

| field | value |
|---|---|
| tests | 60 |
| suites | 9 |
| pass | 60 |
| fail | 0 |
| cancelled / skipped / todo | 0 / 0 / 0 |
| duration_ms | 384.433808 |

The three formerly failing titles are present as `✔` in the log tail:
`forwards the requested set to the loop, and required-4 when none was asked for`,
`records both the requested and the reported set in the raw outcome`,
`names the requested set in the accepted summary instead of saying "required"`.
The cases that exist to prove the gate *closes* also passed — the recorded-pin
assertion, the pending refusal, and the drift refusal — so the reviewed-bytes seam
satisfied the gate rather than bypassing it.

## 5. Envelope and resources, as read back

| field | value |
|---|---|
| `acc_cgroup_memory_max` | `805306368` |
| `acc_cgroup_swap_max` | `0` |
| `acc_cgroup_pids_max` | `32` |
| `acc_cgroup_cpu_max` | `50000 100000` |
| `acc_unit_type` | `exec` |
| `acc_unit_runtime_max` | `2min` (numeric via `busctl` `<unavailable>`; resolved `120000000`) |
| `acc_capture_ok` | `yes` |
| gate | `1407092` KiB available ≥ `1228800` required → `pass` (one sample) |
| `acc_memory_peak` | `67952640` (journal `64.8M`, swap `0B`) |
| `acc_memory_current_final` | `31129600` |
| `acc_pids_peak` | `16` of `32` |
| memory events | all zero |
| `acc_workload_wall_ms` | `804`; service runtime `895 ms`, CPU `357 ms` |
| `acc_syntax_status` | `pass`; both subjects `rc 0` |

After the run: `LoadState=not-found`, `ActiveState=inactive`, `SubState=dead`, and
`systemctl list-units 'admission-*'` returned no rows.

## 6. Hash comparison with the 60 / 57 / 3 run

Both manifests hold 25 lines at 3720 bytes, `.err` files empty, `cmp` equal — the
selected inputs did not change during this run.

Against the previous run's manifest, **exactly one selected file differs**:

| file | before | after |
|---|---|---|
| `tests/main.test.mjs` | `0fdc7a9c…867b07` | `10fd71fd…3e44079` |

That is the corrected fixture and nothing else. This is a statement about which selected
bytes differ; it is **not** a causal claim that the fixture is the only thing that could
have moved the outcome. The hash set is a selected witness over 25 identified files, not
a dependency closure, and an unlisted input, timing or environment factor is not
excluded by it.

## 7. Boundaries — what this does not measure

- Both targets are **import-only tests with a fake `io` and a fake `runLoop`**. No test
  writes an artifact to disk; the `raw-outcome.json` assertion reads a string handed to a
  fake writer, not a file. Nothing here shows that a real run would write one.
- No Loader, no fiber, no fixture host, no plugin runtime, no browser is booted. This is
  not Loader acceptance evidence, and no real host is authorised by this record.
- The `bash -n` step runs **inside the unit cgroup but outside `bwrap`**: it parses the
  real slice's two scripts with no filesystem sandbox around it. Only the node workload
  runs sandboxed. "The whole unit is sandboxed" would be false.
- The shared lock serialises against other holders of that same lock. It is not a global
  scheduler, and this record makes no claim that exactly one process ran on the machine.
- A green count here does not certify the launcher against a real Loader, and does not
  retroactively make 60 / 57 / 3 wrong. Both numbers stand.

## 8. Disposition

One attempt, authorised in advance and spent. Nothing was retried, repaired or re-run;
no source, runner or pin was edited before or during the launch. Five run directories
now exist for this slice and all are retained.
