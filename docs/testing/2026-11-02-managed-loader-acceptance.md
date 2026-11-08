# Managed Loader acceptance — second real-host attempt (2026-11-02)

Status: **FAILED — the confined payload ran, and `prepare.mjs` was refused before it
wrote a single file. Nothing here is a pass.**
Verdict on the real Loader: **unchanged, still unobserved.**

This is the second of two separate attempts, and the two records must be read
side by side, not merged:

| record | outcome | what actually ran |
| --- | --- | --- |
| `2026-11-01-managed-loader-acceptance.md` | REFUSED at the launcher's memory gate, exit `3` | nothing: no `bwrap`, no Node, no write |
| **this file** | got past the gate; **failed inside the payload**, launcher exit `5` | `bwrap` + the confined payload: `prepare.mjs` (refused), both arms (refused), `validate-records.mjs` (rc 1) |

The 2026-11-01 refusal stands as written. This attempt **supersedes nothing** — it is
a later, different outcome, and it is still not a pass. Neither arm ever produced a
record, so **no claim about the managed teardown on the real host is supported by this
attempt, in either direction.** The real-Loader claim remains *unobserved*.

## 1. Scope and authorization

| field | value |
| --- | --- |
| subject | `experiments/dsh-live-lab/managed-cleanup/` behind `run-isolated.sh` |
| execution form | one transient systemd unit (`systemd-run --wait --pipe --collect`) → one `bwrap` → `payload.sh` |
| attempts | exactly **one** (this one). No retry afterwards |
| unit | `managed-cleanup-1793551133.service` (transient, `--collect`ed) |
| runtime root | `<repo>/experiments/dsh-live-lab/managed-cleanup/work/run-20261101T163853Z` (verified absent before launch) |
| launcher exit | **5** — payload failure, not a refusal and not a pass |
| wall clock | started `2026-11-02T00:39:24.310982+08:00`, main process exited `00:39:24.907948+08:00` (≈0.6 s) |
| evidence dir | `reports/2026-11-02-managed-loader-acceptance/` |

## 2. The attempt, in raw form

Invocation as issued (`27-invocation.txt`):

```sh
systemd-run --quiet --wait --pipe --collect \
  --unit managed-cleanup-1793551133 \
  --property=Type=exec --property=MemoryMax=1536M --property=MemorySwapMax=0 \
  --property=TasksMax=32 --property=RuntimeMaxSec=120 \
  --setenv=DSH_MANAGED_CLEANUP_ROOT=<slice>/work/run-20261101T163853Z \
  --setenv=DSH_MANAGED_CLEANUP_ALLOW_ROOT=<slice> \
  --setenv=NODE_BIN=/www/server/nodejs/v24.21.0/bin/node \
  -- /usr/bin/bash <slice>/run-isolated.sh
```

The launcher's own line, verbatim from `28-launch-output.txt` line 1 — note that the
gate was **passed** this time:

```json
{"type":"managed-cleanup/launcher","status":"launching","preflight":{"unit":"managed-cleanup-1793551133.service","unitType":"exec","runtimeMaxSeconds":120.000,"memAvailableMiB":1777,"memGateMiB":1700,"memoryMaxBytes":1610612736,"memorySwapMax":0,"pidsMax":32},"runtimeRoot":".../work/run-20261101T163853Z","node":"/www/server/nodejs/v24.21.0/bin/node","nodeOptions":"--max-old-space-size=1024","nodeHeapMiB":1024,"bwrap":"/usr/bin/bwrap","sentinel":".../logs/launched.once","log":".../logs/payload.log","writableMounts":1}
```

The plan succeeded — the inputs were accepted by the real kit:

```json
{"type":"managed-cleanup/prepare","step":"plan","ok":true,"template":"host-tool-managed","target":".../work/run-20261101T163853Z/generated/managed-cleanup-generated","kitSpecifier":"file:/root/dsh-ecosystem-spec/projects/dsh-plugin-kit",...,"issues":[]}
```

Then the exact failure this record exists for, verbatim from
`28-launch-output.txt` line 5 (identical in `logs/payload.log`):

```json
{"type":"managed-cleanup/prepare","step":"refused","ok":false,"refusals":["SCAFFOLD_WRITE_REFUSED"],"issues":[{"field":"target","message":"cannot create /root/dsh-ecosystem-spec/experiments/dsh-live-lab/managed-cleanup/work/run-20261101T163853Z/generated/managed-cleanup-generated: ENOENT (ENOENT: no such file or directory, mkdir '/root/dsh-ecosystem-spec/experiments/dsh-live-lab/managed-cleanup/work/run-20261101T163853Z/generated/managed-cleanup-generated')"}],"written":[],"failed":null,"targetCreated":false}
```

Everything downstream followed from that one line (`28-launch-output.txt`
lines 6–14):

```json
{"type":"managed-cleanup/payload","step":"prepare","rc":1}
{"type":"managed-cleanup/generated","status":"refused","refusals":["PREPARE_HANDOFF_MISSING"]}
{"type":"managed-cleanup/payload","step":"arm-generated","rc":2}
{"type":"managed-cleanup/fault","status":"refused","refusals":["PREPARE_HANDOFF_MISSING"]}
{"type":"managed-cleanup/payload","step":"arm-fault","rc":2}
{"type":"managed-cleanup/payload","step":"validate-records","rc":1}
{"type":"managed-cleanup/launcher","status":"finished","payloadRc":1,"runRecord":".../work/run-20261101T163853Z/records/run.json","runRecordPassed":"no","recordProblem":"PAYLOAD_RC_NONZERO","recordLines":0}
```

systemd's own view (`31-post-attempt.txt`):

```
Nov 02 00:39:24.310982 ... systemd[1]: Starting managed-cleanup-1793551133.service - [systemd-run] /usr/bin/bash .../run-isolated.sh...
Nov 02 00:39:24.343915 ... systemd[1]: Started managed-cleanup-1793551133.service - [systemd-run] /usr/bin/bash .../run-isolated.sh.
Nov 02 00:39:24.907948 ... systemd[1]: managed-cleanup-1793551133.service: Main process exited, code=exited, status=5/NOTINSTALLED
Nov 02 00:39:24.908101 ... systemd[1]: managed-cleanup-1793551133.service: Failed with result 'exit-code'.
```

`status=5/NOTINSTALLED` is systemd's name for exit code `5`; it means nothing about
installation here — `5` is the launcher's own "payload did not pass" code
(`run-isolated.sh`, the final `exit 5`). The `RuntimeMaxSec=120` bound did not fire
and nothing was signalled: this was a natural exit in under a second.

**Read the post-collect `systemctl show` carefully, again.** It reports
`LoadState=not-found`, `Type=` (empty), `Result=success`, `ExecMainStatus=0`,
`RuntimeMaxUSec=infinity`, `MemoryMax=infinity`. Those are the **defaults of a unit
that no longer exists** after `--collect`, not this run's properties, and
`Result=success` there must not be read as the attempt succeeding. The journal lines
above are the authoritative record.

## 3. What the failure is, and what it is not

**It is a missing parent directory, nothing else.** `writeScaffold` creates the target
with a non-recursive `mkdir` on purpose
(`projects/dsh-plugin-kit/src/scaffold.js:296-301`, `:358-373`): an existing target is
refused rather than reused, and a missing parent is *reported* rather than papered
over. A fresh runtime root contains `home/` (made by `run-isolated.sh` §4) and
`records/` (made by `prepare.mjs`), and `<root>/generated/` — the target's parent — is
created by nobody. The kit behaved exactly as designed; `prepare.mjs` assumed a parent
it never made.

Four things it is **not**, because each would change the fix:

- **not a sandbox/mount denial.** `prepare.mjs` had already created
  `<root>/records/` in the same runtime root moments earlier (the refusal line
  reports `refusals: []` from `readRuntime`, and `records/run.json` exists after the
  run). The root was writable; an `EROFS`/`EACCES` would have said so.
- **not a memory refusal.** `MemAvailable` was above the gate and the launcher
  launched; no cgroup OOM event appears anywhere in the journal.
- **not a specifier or template problem.** The plan echoed
  `kitSpecifier: file:/root/dsh-ecosystem-spec/projects/dsh-plugin-kit` and
  `issues: []`.
- **not an evidence-loss event.** Nothing was written and then lost: `written: []`,
  `targetCreated: false`, and the target directory does not exist. There is no partial
  artifact to inspect, which is why the fix can be argued from the refusal alone.

## 4. Effective caps: issued vs observed

| property | issued | **observed** | how |
| --- | --- | --- | --- |
| `Type=exec` | yes | **yes** — the workload's own exit status reached systemd (`status=5`) | journal |
| `MemoryMax=1536M` | yes | **observed**: `memory.max=1610612736` | `24-cgroup-timeseries.txt` |
| `MemorySwapMax=0` | yes | **observed**: `memory.swap.max=0`, `memory.swap.current=0` | `24-cgroup-timeseries.txt` |
| `TasksMax=32` | yes | **observed**: `pids.max=32` (peak `pids.current=5`) | `24-cgroup-timeseries.txt` |
| CPU quota | not issued | `cpu.max=max 100000` (unlimited) | `24-cgroup-timeseries.txt` |
| `RuntimeMaxSec=120` | yes | **not measured** — the run ended in ≈0.6 s and the bound never fired | journal |
| `MemAvailable` gate | 1700 MiB | **measured, passed**: orchestrator's last sample 1731 MiB (`22-capacity-wait.txt`), launcher's own pre-flight re-read 1777 MiB (`28-launch-output.txt` line 1) | two different instants; both above the gate, and the discrepancy is not rounded away here |
| `NODE_OPTIONS=--max-old-space-size=1024` | yes (a literal in the launcher) | **not observed** — the confined `node` process exited before the host-side sampler captured it; the sampled pids (`systemd-run`, `bwrap`) legitimately carry no `NODE_OPTIONS` because the flag is passed via `--setenv` to the child | `25-confined-environ.txt` |
| memory peak | — | **no workload peak exists.** The last cgroup `memory.peak` reading was `30347264` bytes (≈28.9 MiB) for a unit whose only work was `bwrap` + one refused Node process. That is a real reading of a real unit and it is **not** a workload peak; it must not be quoted as one, and it says nothing about the 1024 MiB heap setting | `24-cgroup-timeseries.txt` |

Two honesty notes on the cgroup series: it has `NA` rows at both ends (before the unit
existed and after it was collected), and only two populated samples (`memory.current`
2867200 → 27901952 bytes). The ceiling was **enforced, not profiled** — this run did
not measure what the artifact would use if it had booted.

The heap line added to the launcher is **kept**. It fixed a real, previously
identified blocker (`01-fix-review.txt`: bwrap's `--clearenv` carried no
`NODE_OPTIONS`, so V8 would size its heap from `MemTotal` ≈ 3.83 GiB, above
`MemoryMax=1536M`); it is a narrow, literal, self-echoed launcher value, and nothing in
this attempt contradicts it. It is simply unobserved, as the table says.

## 5. What never executed

| stage | state | evidence |
| --- | --- | --- |
| memory gate → `bwrap` → confined payload | **ran** | `28-launch-output.txt` lines 1–3; `25-confined-environ.txt` shows two `bwrap` pids inside `managed-cleanup-1793551133.service` |
| `prepare.mjs` | **ran, refused at the scaffold step** | `written: []`, no `prepare.json` anywhere under the root |
| `arm-generated.mjs` | **ran, refused `PREPARE_HANDOFF_MISSING`**, rc 2 | no `records/generated.json` |
| `arm-fault.mjs` | **ran, refused `PREPARE_HANDOFF_MISSING`**, rc 2 | no `records/fault.json` |
| any Loader boot / plugin apply / tool call | **never happened** | the arms refuse before mounting anything |
| `validate-records.mjs` | **ran, rc 1** | `records/run.json`, 2384 bytes, `status: "failed"`, `recordLines: 0` |
| one-shot sentinel `logs/launched.once` | **created — the authorized launch WAS consumed** | `31-post-attempt.txt`; see §8 |

`work/run-20261101T163853Z/` contains exactly `home/`, `records/run.json`; no
`generated/`, no `plugins/`, no `prepare.json`.

## 6. Evidence inventory (raw, unedited)

All paths relative to `reports/2026-11-02-managed-loader-acceptance/`:

```
00-pre-attempt-snapshot.txt   meminfo, absent work/logs, no competing workers, file modes
01-fix-review.txt             the heap/NODE_OPTIONS fix and its hash proof (pre-attempt)
20-unit-name.txt              managed-cleanup-1793551133
21-runtime-root.txt           <slice>/work/run-20261101T163853Z
22-capacity-wait.txt          the 5 s capacity samples; gate reached at 1731 MiB after 30 s
23-pre-launch.txt             pre-launch state + sha256 of every source, before launch
24-cgroup-timeseries.txt      the unit's cgroup counters (the caps readback)
25-confined-environ.txt       host-side /proc/<pid>/environ samples of confined pids
26-sandbox-mountinfo.txt      mount table of the sampled pid — see §7, it is the HOST's
27-invocation.txt             the exact command as issued
28-launch-output.txt          launcher + payload lines, verbatim  ← the outcome
29-launcher-exit-code.txt     5
30-orchestrator.sh            the script that made the single launch
31-post-attempt.txt           exit code, journal, post-collect defaults, artifacts, hashes
```

Also raw, outside that directory:

- `<slice>/logs/payload.log` — the confined payload's own log (5270 bytes), the same
  lines as `28-launch-output.txt` lines 2–12.
- `<slice>/work/run-20261101T163853Z/records/run.json` — the validator's run record,
  `status: "failed"`, every arm assertion `ok: false`.
- `<slice>/logs/launched.once` — the consumed sentinel (0 bytes).

## 7. Deviations disclosed

1. **Unauthorized polling to auto-launch (process deviation, reported by the Lead).**
   Before this attempt the supervising worker polled the host roughly every 5 seconds
   in order to launch as soon as capacity allowed, rather than waiting for an explicit
   go-ahead at the moment of launch. That is *not* what `30-orchestrator.sh` does — the
   script itself performs a bounded, sample-logged capacity wait and then **one**
   launch, and `22-capacity-wait.txt` is that wait, not a launch loop — so this
   deviation is about how the attempt was supervised, not about the content of any
   artifact here. It is recorded rather than edited out because it changes what the
   Lead should trust: the launch decision was made by a polling loop, not by a person
   at the moment. Any further attempt needs an explicit, human-timed authorization.
2. **The mount-table sample is the host's, not the sandbox's.**
   `26-sandbox-mountinfo.txt` is headed with pid `241768`, whose cgroup is
   `/system.slice/dsh-web.service` and whose command is `systemd-run` — the sampler
   matched the host-side `systemd-run` process, so this file shows the host mount table
   (`/` and `/data` both `rw` ext4). It is **not** evidence about the confined
   namespace and must not be read as "/data was writable inside the sandbox". The
   `bwrap` pids (`241840`, `241841`) were in the unit's cgroup, but no confined `node`
   pid was ever captured. The read-only-boundary claim therefore remains **unobserved**
   for this attempt, exactly as it says.
3. **The heap setting was not observed by the kernel view.** See §4: the confined
   `node` exited too fast to sample, so `--max-old-space-size=1024` is
   launcher-self-reported in this attempt, not independently observed.
4. **No other deviation:** no retry, no gate lowered, no `--force`, no install, no
   build, no test run, no production or `/root/.dsh` write, no port 3080 usage, and no
   source edit during the attempt (§8 shows before/after hashes identical).

## 8. Source hashes, and when they were taken

`23-pre-launch.txt` and `31-post-attempt.txt` carry the same list, taken minutes apart
either side of the launch. **Every hash is identical before and after**, which is the
point: nothing in the slice changed *during* the attempt, so the failure above is a
property of the code as reviewed, not of a mid-run edit.

```
68e24b616250d39eb7c8ad63496bdf2091b7b304b3b8d38f8781b2bab2f9f9c9  run-isolated.sh   (contains the 1024 MiB heap fix)
13d6449f6c0177d228a71135228508c1a601969ae482cb8a0fdbe3ca084da187  payload.sh
b9c7fbcdae5df845be6d3483730eb15ec587b4229162426f9c33b2da01660a4f  prepare.mjs       ← the file at fault, as it ran
9f5eab73ccf5bac65e98917a9be1241be5afca5155da6ebe95870d944b9aca39  arm-generated.mjs
6dde1460506be2b96b481e48b4ba9773b5383fba43fa49819b2afd0d43f44f1f  arm-fault.mjs
9fd2c55a841de060e8327760fbb006c862f0af99a12d4851fb32408b239eb84f  validate-records.mjs
ed5c23f94d95240383a1510b476fda911fb1c47b1431c598ff4bf0605e696f43  lib/host.mjs
0f4c9f7859fdaf5f88b42c90820a48b4f43283f4b9c5954b903fb6a126abe35b  lib/layout.mjs    ← also changed by the fix (after the attempt)
31e41c67c97eb05f4d73600e5d025358311acea027fa7db04712b207f4ab4960  lib/record.mjs
490a92bc921d490d0d0b8fcd95e08435151dfd56748f131b93f11c97c308fa92  fixtures/counted-disposer.mjs
0ede131eea059b2edfcb1a47022728731190e16ad7df715773895abf47c09130  fixtures/managed-fault.plugin.mjs
cd1f6b712f548d2ca98af9c78e29c5a24dc72c575787e0661177adddc572d658  fixtures/trace.mjs
```

Fixed inputs at attempt time (unchanged since): `projects/dsh-plugin-kit/src/index.js`
= `8d0fe29466ace71ed37066b8bc2a92282d3fb957dc75c17292e45250ee1acdca`.

## 9. The fix — one owner, one directory, no new behaviour

The failure has exactly one correct place to be repaired: the caller that owns the
runtime layout. Fixing it inside the kit would mean taking away the generator's
deliberate refusal of a missing parent and of an existing target, and would make a
user's `scaffold` command silently create trees it was never asked for.

| file | change |
| --- | --- |
| `experiments/dsh-live-lab/managed-cleanup/lib/layout.mjs` | **new** `ensureGeneratedDir(runtime)`: one non-recursive `mkdir` of `<root>/generated`; `EEXIST` tolerated **only** when the entry is a real directory (a file or a symlink is a named refusal — `GENERATED_DIR_NOT_A_DIRECTORY:{file,symlink}`); refuses `GENERATED_DIR_UNRESOLVED`, `GENERATED_DIR_OUTSIDE_RUNTIME:<path>`, `GENERATED_DIR_UNCREATABLE:<code>`, `GENERATED_DIR_UNREADABLE:<code>` |
| `experiments/dsh-live-lab/managed-cleanup/prepare.mjs` | calls it once, immediately **before** the non-dry-run `writeScaffold`, emits a `generated-parent` line as evidence, and `refuse`s on any refusal; header documents who owns the parent and why the kit must not |
| `experiments/dsh-live-lab/managed-cleanup/tests/prepare-generated-parent.test.mjs` | **new** regression, **UNEXECUTED** (see below) |

What the fix deliberately does **not** do:

- it does **not** create the target (`<root>/generated/managed-cleanup-generated`) —
  the kit keeps its exclusive, non-recursive `mkdir`, and therefore keeps refusing an
  existing target instead of reusing it;
- it does **not** reuse `recursive: true`, so it can never invent a directory tree
  above the one directory it owns;
- it deletes, renames, truncates and overwrites nothing — a `generated` occupied by a
  file or a symlink is a loud refusal, not a repair;
- it does **not** touch the kit (`projects/dsh-plugin-kit/**` is unchanged: no
  `scaffold.js`, no `index.js` edit) and does not duplicate scaffold behaviour;
- it leaves `MEM_GATE_MIB=1700`, `MEM_MAX_BYTES=1610612736`, `PIDS_MAX=32`,
  `RUNTIME_MAX_SEC=120` and the launcher's 1024 MiB heap value exactly as they were.

The regression test asserts the created-parent/absent-target split, the idempotent
second call, the file and symlink refusals, the unresolved/outside-root refusals, and
— as a **static** check on the file's text, no import and no execution — that
`ensureGeneratedDir` is called before `writeScaffold(…, { dryRun: false })` and that
`prepare.mjs` never takes over the target's `mkdir`. It was **not run**: the
authorization for this slice covers one confined run, not a test execution, and running
`node --test` would be new evidence of a different kind. It is therefore a prepared
check, not a passing one.

Hashes after the fix (taken 2026-11-02T00:45+08:00, **post-attempt**, by `sha256sum`;
nothing was executed to produce them):

```
0ea34611496b6d7796478600a834296d351269c7a60ce04458944375709080f9  prepare.mjs                  (was b9c7fbcd…)
92545b22c40b087e17492e7adaabe4d871065aa4496f05259187eedfac7a53f7  lib/layout.mjs               (was 0f4c9f78…)
cbc5414b49a75fc4fe45ee6c16d24277aa97bb4a3308ab313e112685087c6879  tests/prepare-generated-parent.test.mjs   (new)
6ad6a01c8119075020068fc8d0d586c6fcae615872735c88a7d7b21557c28f9d  README.md                    (was 3162d7ec…; status update appended, §10)
```

`run-isolated.sh`, `payload.sh`, both arms, `validate-records.mjs`, `lib/host.mjs`,
`lib/record.mjs` and the three fixtures are **byte-identical** to the attempt-time
hashes in §8.

## 10. Wording updated, prior refusal preserved

`experiments/dsh-live-lab/managed-cleanup/README.md` received **one appended paragraph**
(its "Status update 2026-11-02" block) saying that a second attempt ran, got past the
gate, and failed in `prepare`. The 2026-11-01 memory-refusal status paragraph above it
is untouched — the older refusal is not rewritten, softened or contradicted; the two
outcomes now sit next to each other. No other statement in that file was changed, and
no sentence anywhere claims a pass.

## 11. Sentinel and the shape of any future attempt

The one-shot sentinel **was consumed** by this attempt: `logs/launched.once` exists
(0 bytes) and `logs/payload.log` holds the run. That is the mechanism working as
designed — a single authorized launch per sentinel — and it means **retrying is now
blocked by design**, not by accident: `run-isolated.sh` refuses exit `4`
`ALREADY_LAUNCHED` while that file exists, and a run reusing this runtime root would
additionally refuse `STALE_RUN_RECORD` because `records/run.json` is already there.

Neither sentinel nor log was removed, moved or touched by this record-keeping. A
future attempt needs, explicitly and before it runs:

1. a **per-run sentinel design** (a sentinel path that identifies the run it authorizes,
   so "one authorization, one launch" survives the existence of earlier runs), argued
   as a change to the launcher, not bypassed by deleting a file;
2. a **fresh runtime root**, since the nominated root now holds a failed run's record;
3. a human-timed go/no-go at the moment of launch (§7.1);
4. a review of this fix's retry isolation by the Lead — which is exactly what has *not*
   happened yet.

Deleting `launched.once` is **not** authorization and was not done.

## 12. What would close the gap

The same thing as before, and this attempt narrowed it by one step rather than
crossing it: **one** authorized launch that gets past `prepare`, produces
`work/records/{generated,fault,run}.json` with `run.json: status "passed"`, plus
`logs/payload.log`, with the launcher exiting `0`. Until then the real-Loader claim is
**NOT RUN**, and this record is evidence of a *failed attempt* — not a pass, not a
partial pass, and not anything about the Loader, the kit's teardown, or the sandbox's
read-only boundary.
