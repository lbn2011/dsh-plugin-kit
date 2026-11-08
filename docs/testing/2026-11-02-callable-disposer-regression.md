# Callable-first disposer regression — execution record

Date: 2026-11-02, Asia/Shanghai (workload unit started 01:20:41, finished 01:20:46).
Workload: `projects/dsh-plugin-kit`, full unit suite (`tests/*.test.js`), one launch.

## Current verdict: PASS — 110 tests, 110 pass, 0 fail, 0 skipped, exit code 0

The run executed the state left by change **c940** in
`src/managed-registration.js`, `src/managed-registration.d.ts` and
`tests/managed-registration.test.js`: a returned **function** is treated as the
disposer by exact identity (callable-first, `.then` never read), while a
**non-callable** thenable is still refused as an asynchronous acquisition. Those
three files had not been tested before this run.

Nothing under `src/` or `tests/` was edited by this run. No assertion was
removed, no refusal was relaxed, no build/install/delete was performed, and no
host, GUI (`:3080`) or `.dsh/` state was touched. This document is the only file
this run created; every earlier evidence file under `docs/testing/` is preserved
byte for byte (e.g. `2026-11-01-kit-managed-template-unit.md` hashes
`2a56263345f789e7ee664f6dff147c3228fab26eb1d84fa947e2039f182bf04f` both before
and after — see the ledger below).

## Execution envelope

`systemd-run` (`--service-type=exec --wait --pipe --collect`) + `bwrap` +
`env -i`, at the prescribed caps:

```sh
systemd-run --service-type=exec --wait --pipe --collect --unit=kitcallrun012041 \
  -p MemoryMax=768M -p MemorySwapMax=0 -p TasksMax=32 -p CPUQuota=50% -p RuntimeMaxSec=120 \
  -p WorkingDirectory=/root/dsh-ecosystem-spec/projects/dsh-plugin-kit \
  /usr/bin/bwrap --ro-bind / / --dev /dev --proc /proc --unshare-pid --unshare-net \
    --unshare-ipc --unshare-uts --tmpfs /tmp --die-with-parent \
  /usr/bin/env -i PATH=/usr/local/bin:/usr/bin:/bin HOME=/tmp \
  /www/server/nodejs/v24.21.0/bin/node --max-old-space-size=384 --test --test-concurrency=1 \
  tests/cleanup.test.js tests/cli.test.js tests/exports.test.js tests/managed-registration.test.js \
  tests/managed-template.test.js tests/protocol.test.js tests/scaffold.test.js tests/template.test.js
```

The eight files are listed explicitly instead of via a glob, because `node --test`
with no arguments would also discover `templates/host-tool-managed/test/plugin.test.js`,
which imports host packages that do not resolve here. The list equals
`package.json`'s `node --test "tests/*.test.js"`. Node v24.21.0, bubblewrap 0.12.0,
systemd 257 (257.13-1~deb13u1). `bwrap` mounts the repository read-only, so the
suite can only write into the unit's private `/tmp` tmpfs (`mkdtemp`); the
identical pre/post hashes below confirm the working tree was not mutated.

Memory gate, exactly one check, no polling or retry: the value sampled before the
launch was

```
MemAvailable:  1696988 kB   (1657 MiB)   >= 1200 MiB floor  -> launch permitted
```

## Run — unit `kitcallrun012041.service`

- `systemd-run` exit status: **0** (`code=exited, status=0/SUCCESS`)
- node test runner: `tests 110`, `pass 110`, `fail 0`, `cancelled 0`,
  `skipped 0`, `todo 0`, `duration_ms 4633.424628`
- Log lines: **110** `✔`, **0** `✖` — the `✔` count equals the runner's 110.
- Service runtime 4.746 s, CPU time consumed 2.380 s, memory peak **71.4M**
  (swap 0B), against caps of 768 MiB / 32 tasks / 50 % CPU / 120 s.
- Failures: **none**. There is no failure text to quote.

### Directly relevant passes for the c940 change

```
✔ a callable disposer that is also thenable is accepted, and its then is neither read nor called (0.394096ms)
✔ the native disposer is deferred by exact identity: no wrapper, no rename (0.314316ms)
✔ a non-callable thenable is still refused, and the callable disposers acquired before it roll back (0.430704ms)
```

So both halves of the contract are now empirically covered: a Cordis-style
disposer that is callable *and* thenable is accepted and its `then` is never read
or invoked, the host's own function is deferred with exact identity (no wrapper,
no renamed proxy), and a non-callable thenable is still refused with rollback of
the disposers acquired before it.

### Per-file results

Counts are the `test(` declarations in each file; the runner reported the same
total of 110.

| File | tests | pass | fail | skip |
|---|---|---|---|---|
| `tests/cleanup.test.js` | 21 | 21 | 0 | 0 |
| `tests/cli.test.js` | 16 | 16 | 0 | 0 |
| `tests/exports.test.js` | 5 | 5 | 0 | 0 |
| `tests/managed-registration.test.js` | 15 | 15 | 0 | 0 |
| `tests/managed-template.test.js` | 16 | 16 | 0 | 0 |
| `tests/protocol.test.js` | 15 | 15 | 0 | 0 |
| `tests/scaffold.test.js` | 17 | 17 | 0 | 0 |
| `tests/template.test.js` | 5 | 5 | 0 | 0 |
| **total** | **110** | **110** | **0** | **0** |

`tests/managed-registration.test.js` grew from 12 to 15 declarations, which is the
whole of the 107 -> 110 difference; the other seven files have the same
declaration counts and the same bytes as the 2026-11-01 record.

## Source state — before and after

`sha256` of the exact bytes, taken **twice inside the same envelope**
(`kitcallpre012037`, `kitcallpost012052`, `sha256sum` only, read-only root bind);
the pre-run values were cross-checked against a host-side read and agreed.

| File | before | after |
|---|---|---|
| `src/managed-registration.js` | `e0fd6a2bbbad4b3b81a9b0a864c8b5b221d2d2ac0c96ccc32febaa27caa18065` | identical |
| `src/managed-registration.d.ts` | `79d2b0769d5331e8c71edb64a15bd786973486e3d63cb7e2868ebfcdb0f0c140` | identical |
| `tests/managed-registration.test.js` | `c5c74b987844fce664f046d7b08f95a42572dd74610970574510ea4e02e23e0a` | identical |
| `src/cleanup.js` | `5fab080e82c7f30523d28bdc8b3904be25ab5bf14a9580c2562f8fe7909f5d10` | identical |
| `src/index.js` | `8d0fe29466ace71ed37066b8bc2a92282d3fb957dc75c17292e45250ee1acdca` | identical |
| `src/index.d.ts` | `660a91a46278c5c63f3bce0b94ecedab070c9789dc1774592ab0eb103c85d103` | identical |
| `package.json` | `25a25a116f0129c7ab3fb3b35828841913f99e54e3f24729d9170867af694a70` | identical |
| `tests/cleanup.test.js` | `47f52a5455eadb5cec5f5fcbfa87f6f74cc917e83a89b20be79830400cde2e44` | identical |
| `tests/cli.test.js` | `b4931d7c05281508736df9460a44b28f5b9ea05c1a8581ddd22d53453cb1fb68` | identical |
| `tests/exports.test.js` | `0ab3596aa20cf2eccf92047cd07f5f472dfb8a7a9a0f2b396367c72cd30f6e89` | identical |
| `tests/managed-template.test.js` | `ef8e921b214b1fbcab0b980a78e3c5f1d4b592a64dfa4954208b772d22d58d71` | identical |
| `tests/protocol.test.js` | `307e06cfa1edac34d0eb15a83264c9e8341de0dd0604fb08dce877e62415bca9` | identical |
| `tests/scaffold.test.js` | `3d049e7ddbe7ee97af1c55939bf03d3078767b8defc91bb8581d1859681d4bfd` | identical |
| `tests/template.test.js` | `0107347ae4f0578f4e84a9dad798a58dd81f60f7b2208591c14ad61d92b4649c` | identical |
| `docs/testing/2026-11-01-kit-managed-template-unit.md` | `2a56263345f789e7ee664f6dff147c3228fab26eb1d84fa947e2039f182bf04f` | identical |

`diff` of the two hash files is empty on every digest line
(`SOURCE_HASHES_IDENTICAL=yes`); the only differing lines are the units' own
`Running as unit` / runtime / peak-memory banners. `git status --short` is
unchanged from before the run (still `M vendor/meta-protocols/*` plus the same
untracked directories); nothing was committed.

## Same-configuration probe limits (not workload cgroup readback)

Read live from `systemctl show` on `kitcallcap012111.service`, a unit launched
with the **identical** property set whose payload is `/bin/sh -c 'sleep 3'` (no
repository code ran), plus a direct in-cgroup read from
`kitcallprobe2012103.service` inside the same `bwrap` sandbox:

| Check | Observed |
|---|---|
| `RuntimeMaxUSec` | `2min` |
| `MemoryMax` | `805306368` (768 MiB) |
| `MemorySwapMax` | `0` |
| `TasksMax` | `32` |
| `CPUQuotaPerSecUSec` | `500ms` (50 %) |

```
cgroup_path=/system.slice/kitcallprobe2012103.service
memory.max=805306368
memory.swap.max=0
pids.max=32
cpu.max=50000 100000
```

The workload command requested a 384 MiB V8 old-space limit; this is not a measurement of total V8 heap or RSS. Its systemd summary reports a 71.4M memory peak and zero swap, and the suite exited successfully. The auxiliary probes verify the same requested property set, not the workload's own cgroup values; this record does not establish task-limit pressure or workload `memory.events` counters.

## Log paths

| Unit | Purpose | Log |
|---|---|---|
| `kitcallpre012037` | pre-run source hashes | `/tmp/kitcallreg-273163/pre-hash.log` |
| `kitcallrun012041` | **the kit suite** | `/tmp/kitcallreg-273163/run.log` |
| `kitcallpost012052` | post-run source hashes | `/tmp/kitcallreg-273163/post-hash.log` |
| `kitcallprobe2012103` | in-cgroup cap read | `/tmp/kitcallreg-273163/probe.log` |
| `kitcallcap012111` | live `systemctl show` of caps | `/tmp/kitcallreg-273163/cap-show.log` |

Those files live in the machine's `/tmp` and will not survive a reboot; the
results reproduced above are the durable record. No long-running job was left
behind: every unit above was run with `--wait --collect`, and the one shell job
started for the live property read was awaited in the same call
(`COLLECTED_EXIT=0`).

## Deviation from the prescribed envelope

1. **Hashing went through the envelope, not the host shell.** The pre- and
   post-run `sha256sum` reads were themselves launched as `systemd-run` + `bwrap`
   units rather than plain host commands, so every check in this record ran under
   the same read-only, network-isolated sandbox. This is stricter than required;
   the pre-run digests were additionally cross-checked against a host read and
   agreed exactly.
2. **The cap read used auxiliary units.** `--collect` removes the workload unit,
   so its `systemctl show` output is not readable after exit. The properties were
   therefore verified on a property-identical unit (payload `sleep 3`) and the
   `cgroup` values on a property-identical read-only unit. The workload unit's own
   caps are inferred from `systemd-run` having accepted the same `-p` set on the
   same manager, which is the same method used in
   `2026-11-01-kit-managed-template-unit.md`.
3. **One aborted probe.** The first in-cgroup read (`kitcallprobe012057`) echoed
   empty values because the file path omitted the unit's own cgroup directory
   (`/sys/fs/cgroup/<path>/memory.max`); the shell string was corrected and the
   probe re-run once (`kitcallprobe2012103`). No workload run was affected and no
   workload test was re-run: the suite was launched exactly once.

## What these results do not establish

- Only the unit suite ran. No CLI beyond what `tests/cli.test.js` spawns, no
  package manager resolved the template's `file:` specifier, and the generated
  managed project's own suite
  (`templates/host-tool-managed/test/plugin.test.js`) was never run — it cannot
  resolve `@deepseek-ai/schemastery`, `@deepseek-ai/dsh-tools` or the kit in this
  environment and is deliberately excluded from the file list.
- The callable-first behaviour is asserted against **test doubles** that mimic a
  Cordis `ctx.effect` wrapper (a function carrying a `then`). It was **not**
  exercised against a real Cordis runtime, a real host, or the GUI, so "the real
  Cordis disposer works" is still an inference from the double, not an
  observation.
- Nothing was installed, built, fetched, committed or pushed. No `.dsh/` state,
  no `:3080` surface, no production path and no root-owned file was touched, and
  no delete was issued.
- The child lifecycle audit `a6fe771a` was not involved: this run performed no
  execution on its behalf and did not coordinate with it.
