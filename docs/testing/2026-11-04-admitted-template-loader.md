# Admitted-template real Loader run — 2026-11-04

STATUS: RAN ONCE — PASS (validator accepted; 35/35 assertions, 3/3 predecessor steps rc 0)

ONE real Loader attempt through `run-isolated.sh` under the verified systemd envelope.
prepare provisioned the plugin copy, arm booted the real Loader inside bwrap, validate
decided the record. No retry, no fix, no second launch, no realhost fallback.

- Raw run dir: `projects/dsh-plugin-kit/docs/testing/runs/20261103T161837Z-admitted-template-loader/`
  (unit.log, argv.txt, journal.txt, systemd-run.rc, hashes-before.txt, hashes-after.txt)
- Skeleton written BEFORE launch.
- Run id: `20261103t161901z-367317`
- Prior recheck: `projects/dsh-plugin-kit/docs/testing/2026-11-04-admitted-launcher-recheck.md`

## Command / unit

```
systemd-run --wait --pipe --collect --unit=admitted-template-20261103T161837Z \
  --property=Type=exec --property=MemoryMax=768M --property=MemorySwapMax=0 \
  --property=TasksMax=32 --property=RuntimeMaxSec=120 --property=CPUQuota=50% \
  --property=WorkingDirectory=/root/dsh-ecosystem-spec/experiments/dsh-live-lab/admitted-template \
  --setenv=NODE_BIN=/www/server/nodejs/v24.21.0/bin/node \
  -- /bin/bash .../admitted-template/run-isolated.sh
```

systemd-run rc 0; unit `code=exited, status=0/SUCCESS`; `Deactivated successfully`.
No competing admitted unit was active before or after (checked with `systemctl list-units`).

## Envelope readback (launcher, before workload)

```
gate: MemAvailable=1615576kB (1577 MiB) >= 1200 MiB
envelope: memory.max=805306368 swap.max=0 pids.max=32 cpu.max=50000 100000
          type=exec runtime.raw=2min runtime.usec=120000000
```

Launcher's own single gate read, no polling, no external probe. Heap probe inside the
sandbox: `heapSizeLimit=603979776` (576 MiB total) vs 384 MiB old-space budget, rc 0.

## Runtime root vs host backing (kept distinct)

- Sandbox root (record `root`, all module URLs): `/root/dsh-ecosystem-spec/experiments/dsh-live-lab/admitted-template/work/run-20261103t161901z-367317`
- Host backing: `/root/dsh-ecosystem-spec/experiments/dsh-live-lab/admitted-template/run-backings/20261103t161901z-367317`
  (contains `run-20261103t161901z-367317/records/run.json` + `records/arm-tool.json`, logs, home)

Module URLs in the record are sandbox `file://.../work/run-...` paths and were checked
inside the second read-only namespace; they were not reinterpreted on the host. After
the run the sandbox `work/` directory is empty (0 entries) and the backing holds the
only copy.

## Record review

`records/run.json`: `type=admitted-template/run`, `status=passed`, `root` = sandbox root,
`steps` = probe/prepare/arm each `rc 0` (`zero:true`), `externallyOwnedSteps=["validate"]`,
`assertions` = 35 ids, `expectedAssertions` = same 35 in source order, `missing`,
`unexpected`, `duplicates`, `problems` all empty. Assertion ids match
`REQUIRED_ASSERTION_IDS` in `arm.mjs` order 1:1, coverage id
`assertion-coverage-complete` last.

Not-claimed surface is explicit in the arm record: synthetic quarantine is installed by
the arm (`coordinator.reserve(claim).quarantine()`), no generated private close handle is
stored or called, no call counts are claimed, and no teardown-failure/stale-close proof is
asserted. `generated-unchanged-after-run` digests are identical before/after
(alpha `f614b616…`, beta `ceddd2ad…`).

Payload transcript: `step=heap-probe rc=0`, `step=prepare rc=0`, `step=arm rc=0`,
`step=validate rc=0`, `payload-ok: validator accepted this run`.

## Counts / peak

- Validator stdout: `assertions:35 failed:[] skipped:[] missing:[] unexpected:[] duplicates:[] problems:[]`
- service runtime 4.527 s; CPU time 1.925 s; memory peak 186.2M (swap 0B) from systemd-run
  summary and journal (`Consumed 1.925s CPU time, 186.2M memory peak`).
- No OOM, no timeout, no refusal.

## Hashes (before == after, byte-identical)

```
eb023db0405f713bdee4303c99ae0ac46677fbb0890fed8c98b3e93dada142ac  run-isolated.sh
0529d0dcb022986e27aea057360b2e69a46cc74fd52cb50b84f1b75f3921d03d  payload.sh
a84770e73c0c5dab0e0dd105e342406cc224974f95e539e76b99aa0947c76c46  prepare.mjs
664f389a6d778c3712cc07b69ed7cc7d467d6a9e15ef5108ecd110b6e0ecc178  arm.mjs
14f2c2273f7a71d564a800fbd50987906b28893ef9b92e7642c979657114d26d  validate-records.mjs
7290e27bfb7cafa6a05a3c001af4c83fb578614a9c1fab010e74de390f1b60d4  lib/layout.mjs
b0e9f5053e1ec205b7ee8986bbd69373597e7f65da46068659cbcb7f04a901ba  lib/mount-plan.mjs
01adb5eb6d0b83a7437d2fe6d6024d1b15d7242d5ac3a1f1181ffbc09970f40b  fixtures/tool.patch.yml
7647c9aac6cfe89f1d097e01fc81d7e40c0d674b032db8c63286f5f7599e6b75  ../admission/lib/duration.awk
```

## Deviations

None. Notes: (1) the record `ok` field is the validator's stdout `ok`, not persisted in
`run.json`; (2) `21 entries did not activate` in the boot transcript is the expected
pending-plugin list of the fresh tool home, not a failure; (3) `--collect` removes the
unit after exit, so peak is taken from the systemd-run summary/journal rather than a
cgroup file; (4) the launcher created `work/` as bind destination and `run-backings/`
parent, as designed — no runtime child was precreated.
