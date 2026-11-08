# Managed-cleanup parent regression — four test files, one bounded attempt (2026-11-02)

Status: **PASSED inside the envelope — 51/51 tests, node exit `0`.** Scope is exactly
the four named test files; this file says nothing about the real Loader, the payload,
or the managed teardown, all of which remain *unobserved* here.

## 1. What this attempt claims, and what it does not

| claim | supported? | basis |
| --- | --- | --- |
| `ensureGeneratedDir` in `lib/layout.mjs` creates the missing `generated/` parent and never the target | **yes** | `prepare-generated-parent.test.mjs`, 6/6 pass |
| `prepare.mjs` ensures the parent **before** the kit's non-dry-run `writeScaffold` | **yes** | static read of `prepare.mjs` inside that same file, passes |
| the read-only boundary probe classifies only `EROFS`/`EACCES`/`EPERM` as refusals | **yes** | `read-only-boundary.test.mjs`, 13/13 pass |
| the counted disposer is transparent to `createCleanupScope()` | **yes** | `counted-disposer.test.mjs`, 9/9 pass |
| arm/run success predicates hold | **yes** | `validate-records.test.mjs`, 23/23 pass |
| the real Loader boots, or the managed teardown works on a real host | **no — untested here** | no Loader, no payload, no DSH home involved in any of the four files |

The four files touch only `mkdtemp` directories under `TMPDIR` and read `prepare.mjs`
as text; none of them imports the provisioned runtime, so this run says nothing about
`managed-fault.plugin.mjs` resolution, `app-boot`, or the kits's own scaffold suite.

## 2. Authorization envelope (as issued, not as later tuned)

One transient unit, `Type=exec`, **exactly one attempt**, no retry, no fix-and-rerun:

| property | issued value | observed at runtime |
| --- | --- | --- |
| `MemoryMax` | `768M` | `memory.max=805306368` |
| `MemorySwapMax` | `0` | `memory.swap.max=0` |
| `TasksMax` | `32` | `pids.max=32` |
| `CPUQuota` | `50%` | `cpu.max=50000 100000` |
| `RuntimeMaxSec` | `120` | not hit; wall clock ≈ 1 s |
| confinement | `bwrap` ro-root, private PID/net/ipc/uts, tmpfs `/tmp` | `NoNewPrivs:1` inside |
| env | `env -i` | `HOME=/tmp NODE_OPTIONS=--max-old-space-size=384 PATH=/usr/bin:/bin PWD=… SHLVL=1 TMPDIR=/tmp` |
| node | heap `384`, `--test --test-concurrency=1`, four literal paths | `node_exit=0` |

The single memory gate was read **once**, at the start of the unit, and never re-sampled:

```
EVIDENCE gate MemAvailable_kB=1865652 MiB=1821 threshold_MiB=1200 samples=1
EVIDENCE gate=PASS
```

Preflight sampling before the attempt (1734.8 MiB, then 1821 MiB at the gate) is
recorded in `00-preflight.txt` as information, **not** as a second gate check — there
was no polling loop and no sleep-to-retry anywhere in the unit.

## 3. Result

```
ℹ tests 51
ℹ pass 51
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ duration_ms 664.276261
EVIDENCE node_exit=0 duration_ms=795
```

Per file: `counted-disposer` 9, `prepare-generated-parent` 6, `read-only-boundary` 13,
`validate-records` 23. The read-only file's 13 are 10 top-level cases plus the three
`REFUSAL_CODES` (`EROFS`, `EACCES`, `EPERM`) cases generated in a loop, which is why a
plain `grep -c "^test("` undercounts it.

**Discrepancy against the handover, recorded not reconciled:** the task statement says
"original 45 tests passed". The four files as they stand contain **51** runnable tests
and all 51 passed. Either the handover counted a subset, or the files grew after that
count. This attempt did not investigate which; the number measured here is 51.

## 4. Resource and integrity measurements

| measurement | value | reading |
| --- | --- | --- |
| peak `memory.peak` | 50 749 440 B ≈ 48.4 MiB | 6.3 % of the 768 MiB ceiling |
| peak `memory.swap.peak` | `0` | the swap ceiling was never needed |
| peak `pids.peak` | 23 / 32 | 9 slots of headroom; no `pids.max` event |
| `memory.events` | `low 0 high 0 max 0 oom 0 oom_kill 0 oom_group_kill 0` | no ceiling touched, no OOM |
| `cpu.stat` | `usage_usec 440174`, `nr_throttled 8 / nr_periods 9` | the quota was **actually enforced**, not merely declared |
| effective caps, outer | `CapEff=CapPrm=CapBnd=000001ffffffffff`, `NoNewPrivs 0`, `Seccomp 0` | full root caps at the unit level |
| effective caps, inner | `CapEff=000001ffffffffff`, `NoNewPrivs 1`, `Seccomp 0` | bwrap set `NoNewPrivs`; caps deliberately retained (a root bwrap does not drop them) |
| source hashes | identical before/after, `sources_unchanged=true` | 10 files: the four tests, `lib/{layout,host,record}.mjs`, `validate-records.mjs`, `fixtures/counted-disposer.mjs`, `prepare.mjs` |
| post-attempt | unit `inactive` and `--collect`ed, 0 `bwrap` alive, 0 `mkdtemp` leftovers | nothing left running or on disk outside `/tmp` |

**Known gap in this evidence, stated rather than patched:** the inner capability line
asked `capsh` for a decoded mask and got `capsh: command not found` — the sandbox `PATH`
is `/usr/bin:/bin` and `capsh` lives in `/usr/sbin`. The hex mask was still captured.
Fixing that would have meant a second attempt, which the authorization forbids, so the
decoded inner mask is absent and only the hex is claimed.

## 5. Process deviation carried forward from the previous worker

The handover states that the previous worker performed shell/`bash -n` work despite the
task being code-only. That is recorded here **as a process deviation of that earlier
attempt, not as part of this bounded proof**: nothing in this run re-validates it, and
no claim is made that the earlier check was compliant. This attempt's own compliance
rests only on the artifacts in `reports/2026-11-02-managed-parent-regression/`.

For completeness on this run's own shell usage: the envelope script was syntax-checked
(`bash -n`) **inside the same bounded unit**, before the tests, as
`EVIDENCE launcher_syntax=ok`; an identical static parse was done on the host before
launch. Neither touched `runtime/` or the test files — `sources_unchanged=true` covers
that claim with hashes rather than assertion.

## 6. Raw evidence

`reports/2026-11-02-managed-parent-regression/`:

| file | contents |
| --- | --- |
| `00-preflight.txt` | systemd/bwrap/node versions, cgroup controllers, pre-attempt memory picture |
| `10-gate.txt` | the single gate lines, extracted verbatim |
| `20-invocation.txt` | the exact `systemd-run` command, wrapper and its exit code |
| `21-envelope-script.sh` | the whole envelope script that ran as the unit's payload |
| `22-envelope-log.txt` | the complete, unedited unit output (log of record) |
| `23-test-summary.txt` | node's `ℹ` summary block, verbatim |
| `24-sources-sha256.txt` | before/after hashes of all ten files |
| `25-cgroup-envelope.txt` | limits, peaks, `memory.events`, `cpu.stat` |
| `26-caps-and-environ.txt` | outer/inner capability lines and the confined environment |
| `27-post-attempt.txt` | unit state, stray-process and leftover checks |

No runtime tree, test file or source module was edited by this attempt; the two writes
were this document and the evidence directory beside it.
