# Admitted-template launcher regression — 2026-11-04

**STATUS: RAN ONCE — 56 tests, 54 pass, 2 fail. Run completed; failures are test-contract defects, not an envelope refusal.**

## Scope

One bounded invocation of the five source/unit test files of
`experiments/dsh-live-lab/admitted-template/tests/` under the verified systemd
`exec` envelope, preceded by `bash -n` on `run-isolated.sh` and `payload.sh`.
No real Loader, no host launch, no install, no build, no GUI change.

## Command (exact)

```bash
systemd-run \
  --unit=admitted-launcher-regression-20261103T160121Z \
  --service-type=exec --wait --pipe --collect \
  --property=WorkingDirectory=/root/dsh-ecosystem-spec \
  --property=CPUQuota=50% --property=MemoryMax=768M \
  --property=MemorySwapMax=0 --property=TasksMax=32 \
  --property=RuntimeMaxSec=120 \
  /bin/bash \
  /root/dsh-ecosystem-spec/projects/dsh-plugin-kit/docs/testing/runs/20261103T160121Z-admitted-launcher-regression/payload.sh \
  admitted-launcher-regression-20261103T160121Z 384 \
  'mem=805306368,swap=0,pids=32,cpu=50000 100000,type=exec,runtime_usec=120000000,heap_mb=384'
```

In-unit workload: `bwrap --ro-bind / / --dev /dev --proc /proc --tmpfs /tmp
--unshare-pid --unshare-net --unshare-ipc --unshare-uts --die-with-parent
--chdir <slice> env -i PATH=… HOME=/tmp TMPDIR=/tmp
NODE_OPTIONS=--max-old-space-size=384 node --test --test-concurrency=1 <exact5>`.

Raw run dir: [`runs/20261103T160121Z-admitted-launcher-regression/`](runs/20261103T160121Z-admitted-launcher-regression/)

## Envelope readback (before workload)

| Limit | Observed |
| --- | --- |
| cgroup memory.max | 805306368 |
| cgroup memory.swap.max | 0 |
| cgroup pids.max | 32 |
| cgroup cpu.max | `50000 100000` |
| unit Type | `exec` |
| RuntimeMaxUSec | `2min` → `120000000` µs |
| Node heap | `--max-old-space-size=384` |
| MemAvailable gate | 1,438,812 kB (1,405 MiB) ≥ 1,200 MiB, sampled once |

`acc_capture_ok=yes`, `acc_workload_started=yes`.

## Results

- `bash -n run-isolated.sh` → rc 0
- `bash -n payload.sh` → rc 0
- `node --test --test-concurrency=1` → rc 1, wall 859 ms, test duration 769.4 ms
- Counts: **tests 56, pass 54, fail 2**, skipped 0, cancelled 0, todo 0
- Peak: `memory.peak=35,110,912` B (33.4 MiB), `pids.peak=16`,
  `memory.events.local` all zero (no OOM/high/max)

### Failing tests

1. `tests/arm-contract.test.mjs:58` — *arm exports the assertion id list, frozen,
   unique, in production order*: expected last id `assertion-coverage-complete`,
   got `host-teardown-settled`. Cause: the test extracts ids with
   `/'([^']+)'/g` only from quoted literals; `arm.mjs:192` ends the frozen array
   with the bare identifier `COVERAGE_ID` (= `assertion-coverage-complete`,
   `arm.mjs:147`), which the regex skips.
2. `tests/validator.test.mjs:208` — *the validated step set is exactly the three
   predecessors*: `ReferenceError: EXTERNALLY_OWNED_STEPS is not defined`
   (`validator.test.mjs:212`). The symbol is exported by
   `validate-records.mjs:94` but absent from the test's import block
   (`validator.test.mjs:18-23`).

## Hashes

Before/after SHA-256 over the five tests, both shell scripts, `arm.mjs`,
`validate-records.mjs`, `lib/layout.mjs`, `lib/mount-plan.mjs`,
`fixtures/tool.patch.yml` and the three managed-cleanup helpers: **identical**.
Nothing was written into the slice.

## Deviations / notes

- Historical 127 failure (`20261103T153921Z-evidence-diagnostics/unit.log`,
  relative payload path under `systemd-run --wait --pipe`) preserved untouched;
  this run used absolute payload path plus `WorkingDirectory`.
- `busctl` property read returned `<unavailable>`; the numeric deadline was
  resolved from `systemctl show RuntimeMaxUSec=2min` → `120000000`.
- `systemctl show CPUQuotaPerSecUSec` prints humanized `500ms`; the kernel
  `cpu.max` was the authoritative check.
- Unit `--collect`: `LoadState=not-found` afterwards; no retry, no fix applied.
