# Managed Loader acceptance — real-host attempt (2026-11-01)

Status: **NOTRUN — refused at the launcher's memory gate. Nothing was launched.**
Verdict on the real Loader: **unchanged, still unobserved.**

One authorized attempt was made against the real host. `run-isolated.sh` refused
it in bash, before any Node process, any `bwrap` and any filesystem write, because
`MemAvailable` was **1197 MiB** against a gate of **1700 MiB**. Per the standing
rule ("a memory refusal means NOTRUN, stop") there was **no retry, no second
attempt, and no gate was lowered**. `MEM_GATE_MIB=1700` is unchanged and no
runtime source was touched.

This record is deliberately separate from
`2026-11-01-managed-fixture-regression.md`. That record is a 45/45 **fixture unit**
pass with no host; it says nothing about this attempt, and this attempt says
nothing about it. The two must not be merged into one "managed cleanup works"
claim.

## 1. Scope and authorization

| field | value |
| --- | --- |
| subject | `experiments/dsh-live-lab/managed-cleanup/` — `prepare.mjs`, both arms, `validate-records.mjs`, behind `run-isolated.sh` |
| execution form | one transient systemd unit (`systemd-run --wait --pipe --collect`), containing one `bwrap`, containing the confined payload |
| attempts | exactly **one**. No retry, no re-run after the machine freed memory (see §6) |
| started / ended | 2026-11-01T23:47:16+08:00 / 2026-11-01T23:47:16+08:00 (Asia/Shanghai) |
| unit | `managed-cleanup-1793548036.service` (transient, `--collect`ed) |
| runtime root nominated | `<repo>/experiments/dsh-live-lab/managed-cleanup/work/run-20261101T234716` (unique; verified absent before launch; never reused or overwritten) |
| launcher exit | **3** (`refused`) |
| evidence dir | `reports/2026-11-01-managed-loader-acceptance/` |

## 2. The one attempt, in raw form

Invocation (full text, including the `/usr/bin/bash` form, in
`reports/2026-11-01-managed-loader-acceptance/08-invocation.txt`):

```sh
systemd-run --quiet --wait --pipe --collect \
  --unit managed-cleanup-1793548036 \
  --property=Type=exec --property=MemoryMax=1536M --property=MemorySwapMax=0 \
  --property=TasksMax=32 --property=RuntimeMaxSec=120 \
  --setenv=DSH_MANAGED_CLEANUP_ROOT=<slice>/work/run-20261101T234716 \
  --setenv=DSH_MANAGED_CLEANUP_ALLOW_ROOT=<slice> \
  --setenv=NODE_BIN=/www/server/nodejs/v24.21.0/bin/node \
  -- /usr/bin/bash <slice>/run-isolated.sh
```

`run-isolated.sh` and `payload.sh` are mode `0600`, so the launcher was started as
an argument to `/usr/bin/bash` rather than executed directly; nothing about the
launcher changed.

Launcher output, quoted verbatim from
`reports/2026-11-01-managed-loader-acceptance/04-launch-output.txt`:

```json
{"type":"managed-cleanup/launcher","status":"refused","code":"MEM_AVAILABLE_BELOW_GATE","message":"MemAvailable 1197 MiB < 1700 MiB gate; nothing was launched","preflight":{"memAvailableMiB":1197,"memGateMiB":1700}}
```

```
managed-cleanup: REFUSED (MEM_AVAILABLE_BELOW_GATE): MemAvailable 1197 MiB < 1700 MiB gate; nothing was launched
```

systemd's own view, from `06-post-attempt-unit-state.txt` (journal, `-o
short-precise`):

```
23:47:16.934287 systemd[1]: Starting managed-cleanup-1793548036.service - [systemd-run] /usr/bin/bash .../run-isolated.sh...
23:47:16.963063 systemd[1]: Started managed-cleanup-1793548036.service - [systemd-run] /usr/bin/bash .../run-isolated.sh.
23:47:16.982874 systemd[1]: managed-cleanup-1793548036.service: Main process exited, code=exited, status=3/NOTIMPLEMENTED
23:47:16.982994 systemd[1]: managed-cleanup-1793548036.service: Failed with result 'exit-code'.
```

That is a **natural exit**, not a supervisor timeout: `RuntimeMaxSec=120` did not
fire, nothing was signalled, and the exit status reached systemd intact because the
unit is `Type=exec`.

**Read `Result` carefully.** A post-collect `systemctl show` for
`managed-cleanup-1793548036` returns `LoadState=not-found` together with
`Result=success`, `ExecMainStatus=0`, `Type=` (empty), `RuntimeMaxUSec=infinity`,
`MemoryMax=infinity`, `MemorySwapMax=infinity`, `TasksMax=4652`. Those are the
**defaults of a unit that no longer exists** (the `--collect` the documentation
requires cleaned it up), *not* this run's properties, and `Result=success` there
must not be read as the attempt succeeding. The journal lines above are the
authoritative record; the refusal is the outcome.

## 3. What never executed

The refusal is the first check in `run-isolated.sh` (§1 memory gate), so everything
after it is untouched:

| stage | state | evidence |
| --- | --- | --- |
| cgroup/unit readback (§2, §3) | **never ran** — the memory gate precedes it | `04-launch-output.txt` has no `preflight` fields for `memoryMaxBytes`/`swapMax`/`pidsMax`/`unitType` |
| `bwrap` | **never started** — no `bwrap` process existed before, during or after | `00-pre-attempt-snapshot.txt` (`NONE_BWRAP`), post-run `ps` |
| `prepare.mjs` | **never ran** | no `prepare.json` anywhere; `work/` was never created |
| `arm-generated.mjs`, `arm-fault.mjs` | **never ran** | no `records/generated.json`, no `records/fault.json` |
| `validate-records.mjs` | **never ran** | no `records/run.json` |
| one-shot sentinel `logs/launched.once` | **not created** — the refusal is *before* §5, so the authorized launch was **not consumed** | `07-post-attempt-artifacts.txt` (`SENTINEL_ABSENT`); `logs/` does not exist |
| `work/run-20261101T234716` | **not created** — the launcher refused before §4 | `07-post-attempt-artifacts.txt` (`No such file or directory`) |
| protected anchors (`/root/.dsh`, `/data/tests/dsh-home-dev`, `/data/dsh-home-dev`) | untouched metadata; the two `/data` paths **do not exist on this host** | `07-post-attempt-artifacts.txt` |

No competing worker was present: the pre-attempt `ps` shows no
`managed-cleanup`/`prepare.mjs`/arm/validator process and no `bwrap`, and there were
no background jobs held by the worker.

## 4. Effective caps: issued vs measured

| property | issued to the transient unit | **measured** |
| --- | --- | --- |
| `Type=exec` | yes | **not measured** — readback never ran; the post-collect `show` returns an empty `Type`, which is a not-found default |
| `MemoryMax=1536M` | yes | **not measured** |
| `MemorySwapMax=0` | yes | **not measured** |
| `TasksMax=32` | yes | **not measured** |
| `RuntimeMaxSec=120` | yes | **not measured** |
| `MemAvailable` gate | 1700 MiB | **measured: 1197 MiB → refusal** |
| memory peak | — | **not applicable**: no workload ran, so there is no peak to report |

The only *inference* available, and it is labelled as one: the `memory` and `pids`
controllers are enabled in the `system.slice` subtree
(`/sys/fs/cgroup/system.slice/cgroup.controllers` =
`cpuset cpu io memory hugetlb pids rdma misc`), so the issued properties are
enforceable in principle. That is **not** a readback and is not offered as one
(`10-environment.txt`).

## 5. Evidence inventory

```
reports/2026-11-01-managed-loader-acceptance/
  00-pre-attempt-snapshot.txt   meminfo, free, absent work/logs, no competing workers, file modes
  01-unit-name.txt              managed-cleanup-1793548036
  02-runtime-root.txt           <slice>/work/run-20261101T234716 (verified absent before launch)
  03-launch-params.txt          resolved node, slice dir, timestamps
  04-launch-output.txt          the refusal JSON line + the stderr line  ← the outcome
  05-launcher-exit-code.txt     3
  06-post-attempt-unit-state.txt journal for the unit, post-collect show, failed-unit list
  07-post-attempt-artifacts.txt work/logs absence, sentinel absence, no run record, anchors, meminfo
  08-invocation.txt             the exact command as issued
  09-mem-timeline.txt           MemAvailable before / at refusal / after
  10-environment.txt            systemd, cgroup v2, controllers, bwrap, node; deviation disclosure
  11-source-hashes.txt          sha256 of every file in the slice that matters
```

## 6. Why there is no second attempt

`MemAvailable` is a host-wide capacity snapshot taken immediately before the
workload, and this host has `MemTotal` 4013932 kB (~3.83 GiB) while also running
other services. The value oscillated around the gate across the attempt window
(`09-mem-timeline.txt`):

| time | MemAvailable |
| --- | --- |
| 23:47:09 (pre-snapshot) | 1217 MiB |
| **23:47:16 (value the launcher refused on)** | **1197 MiB** |
| 23:47:25 (after the refusal) | 1707 MiB |

The gate had been crossed again roughly nine seconds after the refusal. **That
observation is recorded, and it is not acted on.** Re-running when the number
happens to be above the line would be a second launch, and the authorization was
for one; a pass obtained by re-rolling a fluctuating capacity check until it lands
on the right side is exactly the "twenty attempts until something passes by luck"
that the one-shot sentinel exists to prevent. Whether a fresh attempt is authorized
is a decision for the Lead, made explicitly, not a consequence of this refusal.

Two things should be known before any such decision:

1. On this host the gate is tight by construction, not by accident: 1700 MiB of
   `MemAvailable` on a 3.83 GiB machine that also hosts other workloads means the
   attempt needs a genuinely quiet window (or the decision to change the gate,
   which is a design change and would have to be argued on the merits, not made by
   the execution worker).
2. Because the refusal happened in §1, this attempt produced **no** evidence about
   the caps readback, the sandbox, either arm, or the validator. A refusal is not a
   partial pass and is not scored as one.

## 7. What the two arms would and would not prove — still unobserved

Nothing in this section was run. It is kept here so the claim structure is on the
record next to the refusal, and so the four tempting conflations stay separated.

**Arm 1 — `arm-generated.mjs`, the production generated template.** Subject: the
package the **real kit** scaffolds via its own documented `writeScaffold` entry with
`template: 'host-tool-managed'` and an explicit `file:` `kitSpecifier`. It is the
artifact a user receives, mounted as a real Loader row through
`include:<row id>`, driven by `loader.update('include:<row>', { disabled })`,
answering through `tools.execute()` on the native root executor. Its teardown claim
is *scope survival across disable/re-enable* (a new fiber, a new registration, a
different definition object) plus generated files byte-identical. Its tool-absence
after disable is **the native host disposer effect** — `tools.register()` returns a
fiber effect, so the tool leaves the registry whether or not any kit callback ran.
**Arm 1 therefore does not prove the kit's managed callback ran**, and its artifact
has no failing cleanup path by design.

**Arm 2 — `arm-fault.mjs`, the explicitly synthetic fixture.** Subject: a separate
fixture built on the real `registerManagedResource`, carrying its own **counted
callback** as the `register` disposer. *Here and only here* is the counted kit
callback proof: the callback ran exactly once, invoked the exact disposer object
`ctx.tools.register()` returned, ran **after** the throwing unsubscribe (a scope
that stopped at the first failure could never reach it), and the fixture's own
counter agrees with the shared trace module. The **throwing unsubscribe is
synthetic** — it exists in this fixture and in no production generated template —
and the close's rejection being the kit's `ERR_CLEANUP_SCOPE_FAILED` aggregate with
the thrown error as its first member is a statement about the kit's error
plumbing, not about `host-tool-managed`.

Consequences, unchanged by this attempt:

- "the unload resolved" is **not** evidence (the host logs per-disposer failures
  and resolves anyway);
- "the tool is gone" is **not** evidence of a kit callback (native effect);
- arm 1 says **nothing** about failure; arm 2 says **nothing** about the generated
  artifact; neither shows the vendored adapter was fixed, that teardown gained a
  deadline, or that a rejection is retried.

## 8. Deviations disclosed

- **One `node --version` ran on the bare host** while collecting environment facts
  for `10-environment.txt`. It was outside the `bwrap` envelope, contrary to the
  "no Node outside the envelope" rule. It printed `v24.21.0`, imported nothing from
  the slice, booted nothing, wrote no file and touched no profile. No slice code
  (`prepare.mjs`, either arm, `validate-records.mjs`) ever ran on the host. It is
  listed rather than edited out; the file it corrupted was rewritten with the
  disclosure in it.
- The launcher was invoked as `/usr/bin/bash run-isolated.sh` because both scripts
  are mode `0600`. No content changed.
- Nothing else deviated: no installs, no builds, no `--force`, no whole-tree copy,
  no production or `/root/.dsh` writes, no port 3080 usage, no source edits to the
  slice. The only file changed in the slice is `README.md`'s status wording (§9).

## 9. Source hashes at attempt time

From `11-source-hashes.txt` (sha256):

```
210f862186bdd6e458b208988ce9d2ea19ce3e3b6d107455e3dabad7b6881728  run-isolated.sh
13d6449f6c0177d228a71135228508c1a601969ae482cb8a0fdbe3ca084da187  payload.sh
b9c7fbcdae5df845be6d3483730eb15ec587b4229162426f9c33b2da01660a4f  prepare.mjs
9f5eab73ccf5bac65e98917a9be1241be5afca5155da6ebe95870d944b9aca39  arm-generated.mjs
6dde1460506be2b96b481e48b4ba9773b5383fba43fa49819b2afd0d43f44f1f  arm-fault.mjs
9fd2c55a841de060e8327760fbb006c862f0af99a12d4851fb32408b239eb84f  validate-records.mjs
ed5c23f94d95240383a1510b476fda911fb1c47b1431c598ff4bf0605e696f43  lib/host.mjs
0f4c9f7859fdaf5f88b42c90820a48b4f43283f4b9c5954b903fb6a126abe35b  lib/layout.mjs
31e41c67c97eb05f4d73600e5d025358311acea027fa7db04712b207f4ab4960  lib/record.mjs
0ede131eea059b2edfcb1a47022728731190e16ad7df715773895abf47c09130  fixtures/managed-fault.plugin.mjs
8d0fe29466ace71ed37066b8bc2a92282d3fb957dc75c17292e45250ee1acdca  projects/dsh-plugin-kit/src/index.js
```

## 10. What would close the gap

Exactly the same thing as before: **one** authorized launch that gets past §1, on a
machine with at least 1700 MiB `MemAvailable` at the moment of launch, producing
`work/records/{generated,fault,run}.json` plus `logs/payload.log`, with the launcher
exiting 0. Until then the honest status of the real-Loader claim is **NOT RUN**, and
this record is evidence of a refusal — not of a pass, not of a partial result, and
not of anything about the Loader.

## 11. Wording fix applied to the slice README (docs only)

The slice `README.md` claimed "Nothing in this directory has ever been executed"
and that its run record could not live under `projects/dsh-plugin-kit/docs/testing`.
After this attempt both sentences were stale, so exactly three passages were
rewritten — status paragraph, test-record-obligation paragraph, and the "nothing
here is real-host evidence yet" bullet. No other slice file changed:

| file | sha256 before wording fix | sha256 after | change |
| --- | --- | --- | --- |
| `managed-cleanup/README.md` | `c64c26c5af21c7363505aa81e55e3cb0522bb5cd87f7f6158b892e0b2a30b1b4` | `3162d7ec1042b4d2daab32334226a59bfe4bb2d65179800b5dfc8116ef69b05f` | status/record-ownership wording only |

`sha256sum -c` over `11-source-hashes.txt` re-verifies every runtime source as
unchanged (`12-final-verification.txt`): the launcher, payload, prepare, both arms,
validator and `lib/` all report `OK`, and the single `FAILED` line is the README
edited on purpose. `MEM_GATE_MIB=1700`, `MEM_MAX_BYTES=1610612736`, `PIDS_MAX=32`
and `RUNTIME_MAX_SEC=120` are unchanged, the sentinel is still absent, and
`work/`/`logs/` still do not exist.
