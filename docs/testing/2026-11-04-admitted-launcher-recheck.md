# Admitted-template launcher recheck — 2026-11-04

STATUS: RAN ONCE — PASS (56 tests, 56 pass, 0 fail)

Bounded regression recheck of the five admitted-template tests after the code-only
correction of `tests/arm-contract.test.mjs` (COVERAGE_ID identifier in the frozen
id list) and `tests/validator.test.mjs` (missing `EXTERNALLY_OWNED_STEPS` import).
NOT a real Loader run: the five targets are source/unit tests only. Single attempt,
no retry, no auto-fix. Skeleton written before launch; prior failed report preserved
at `projects/dsh-plugin-kit/docs/testing/2026-11-04-admitted-launcher-regression.md`.

- Raw run dir: `projects/dsh-plugin-kit/docs/testing/runs/20261103T161544Z-admitted-launcher-recheck/`
  (payload.sh, argv.txt, gate.txt, hashes-before.txt, hashes-after.txt, unit.log,
  systemd-run.rc, journal.txt)
- Unit: `admitted-launcher-recheck-20261103T161544Z.service`

## Command

```
systemd-run --unit=admitted-launcher-recheck-20261103T161544Z \
  --service-type=exec --wait --pipe --collect \
  --property=WorkingDirectory=/root/dsh-ecosystem-spec \
  --property=CPUQuota=50% --property=MemoryMax=768M \
  --property=MemorySwapMax=0 --property=TasksMax=32 \
  --property=RuntimeMaxSec=120 \
  /bin/bash .../20261103T161544Z-admitted-launcher-recheck/payload.sh \
  admitted-launcher-recheck-20261103T161544Z 384 \
  'mem=805306368,swap=0,pids=32,cpu=50000 100000,type=exec,runtime_usec=120000000,heap_mb=384'
```

Exact argv: `argv.txt`. systemd-run rc: 0 (`systemd-run.rc`); journal shows
`Deactivated successfully`.

## Envelope readback (inside the unit, before any workload)

| Item | Observed | Expected |
| --- | --- | --- |
| memory.max | 805306368 | 805306368 |
| memory.swap.max | 0 | 0 |
| pids.max | 32 | 32 |
| cpu.max | `50000 100000` | `50000 100000` |
| Type | exec | exec |
| RuntimeMaxUSec | 2min → 120000000 µs | 120000000 µs |
| CPUQuotaPerSecUSec | 500ms | 500ms |
| memory.max (unit) | 805306368 | 805306368 |
| TasksMax (unit) | 32 | 32 |

`acc_capture_ok=yes`. busctl returned `<unavailable>` for RuntimeMaxUSec (same as the
prior run); the numeric deadline was resolved from `systemctl show` (`2min`).

Gate: one recorded sample in `gate.txt`, `MemAvailable_kB=2117264` (≈2068 MiB) ≥
1228800 kB (1200 MiB) → pass, no polling. An incidental `/proc/meminfo` read while
staging showed 2130840 kB; both are above threshold and neither influenced the
launch decision beyond the recorded sample.

## Workload

Inside the verified envelope, under bwrap `--ro-bind / / --dev /dev --proc /proc
--tmpfs /tmp --unshare-pid --unshare-net --unshare-ipc --unshare-uts
--die-with-parent`, `env -i` with `NODE_OPTIONS=--max-old-space-size=384`:

1. `bash -n run-isolated.sh` → rc 0
2. `bash -n payload.sh` → rc 0
3. `node --test --test-concurrency=1` on the five literal paths → rc 0

Wall 996 ms; Node duration 738.038631 ms; service CPU time 499 ms.

## Counts

tests 56, pass 56, fail 0, skipped 0, cancelled 0, todo 0.
`acc_node_rc=0`.

## Peak / cgroup

- memory.peak = 45,830,144 B (43.7 MiB); systemd-reported "Memory peak: 43.7M (swap: 0B)"
- memory.current at end = 14,872,576 B
- pids.peak = 16
- memory.events.local: low 0 high 0 max 0 oom 0 oom_kill 0 oom_group_kill 0

## Hashes (before == after, byte-identical)

```
762b980e38ebbe7699acf11795701871a2f59eefaf71f986be4b38386eb44160  tests/validator.test.mjs
31a66b4b677df2e5e50facb0091815c837a3fc7a918d801f1ed91e57133ba5de  tests/layout.test.mjs
b3cc7bbf73595a701ed696626c1b857575ec73fbfcde636b6294f0b9bac613ea  tests/arm-contract.test.mjs
46d159c7ba888bb27888f0a48eaa7f6947c11b8ad2edb9aba249ac0f7af87f65  tests/review-regressions.test.mjs
f9c7ef2f98731f1889d5fef96d82f88cb6b59d7d7c61a339ea115623df4623ad  tests/mount-plan.test.mjs
664f389a6d778c3712cc07b69ed7cc7d467d6a9e15ef5108ecd110b6e0ecc178  arm.mjs
14f2c2273f7a71d564a800fbd50987906b28893ef9b92e7642c979657114d26d  validate-records.mjs
eb023db0405f713bdee4303c99ae0ac46677fbb0890fed8c98b3e93dada142ac  run-isolated.sh
0529d0dcb022986e27aea057360b2e69a46cc74fd52cb50b84f1b75f3921d03d  payload.sh
7290e27bfb7cafa6a05a3c001af4c83fb578614a9c1fab010e74de390f1b60d4  lib/layout.mjs
b0e9f5053e1ec205b7ee8986bbd69373597e7f65da46068659cbcb7f04a901ba  lib/mount-plan.mjs
01adb5eb6d0b83a7437d2fe6d6024d1b15d7242d5ac3a1f1181ffbc09970f40b  fixtures/tool.patch.yml
e45831e89e9eebcb3a94fd32b6a4a1353d9195d7883c23d23d9db85ba58d2ddb  runs/...-recheck/payload.sh
```

Source hashes unchanged across the run; the slice and both historical scripts were
only read (`--ro-bind / /`).

## Deviations

None affecting limits, envelope, or workload. Notes: (1) `--collect` leaves
`LoadState=not-found` after exit (expected); (2) busctl property read unavailable,
numeric deadline resolved via systemctl as in the prior run; (3) cgroup path observed
as `/system.slice/admitted-launcher-recheck-20261103T161544Z.service`.
