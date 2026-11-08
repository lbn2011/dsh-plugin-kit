# Managed cleanup — fixture regression gate (2026-11-01)

Status: **executed once, verdict `pass`, payload exit 0, 45/45 tests, 0 failures.**
This record covers the **first fixture regression gate only** — the three
unexecuted test suites in `experiments/dsh-live-lab/managed-cleanup/tests/`,
run as unit tests with no host.

It is **not** evidence about the real Loader. No arm ran, nothing was launched,
built, installed or written to production. Section 7 lists what is still
`NOTRUN` and why that is deliberate rather than an omission.

## 1. Scope and authorization

| field | value |
| --- | --- |
| subject | `tests/{validate-records,read-only-boundary,counted-disposer}.test.mjs` |
| execution form | one `node --test` invocation, transient systemd unit, `bwrap` confinement |
| attempts | exactly **one** — no retry, no preflight re-run, no fallback |
| started | 2026-11-01T23:42:41+08:00 (Asia/Shanghai) |
| ended | 2026-11-01T23:42:42+08:00 |
| unit | `managed-cleanup-fixturegate-20261101T234241-183529.service` |
| evidence dir | `reports/2026-11-01-managed-fixture-gate/` |

Authoritative systemd line for the payload unit, quoted from the journal:

```
23:42:41 systemd[1]: Starting managed-cleanup-fixturegate-20261101T234241-183529.service - [systemd-run] /usr/bin/bwrap --ro-bind / / --proc /proc --dev /dev --unshare-pid --unshare-net --unshare-ipc --unshare-uts --tmpfs /tmp -- /usr/bin/env -i PATH=/usr/bin:/bin HOME=/tmp /www/server/nodejs/v24.21.0/bin/node --max-old-space-size=384 --test --test-concurrency=1 .../validate-records.test.mjs .../read-only-boundary.test.mjs .../counted-disposer.test.mjs
23:42:42 systemd[1]: managed-cleanup-fixturegate-20261101T234241-183529.service: Deactivated successfully.
```

"Deactivated successfully" is systemd's own statement that `Result=success` and
`ExecMainStatus=0`; it is independent of the exit code my wrapper reported.

## 2. Suite inventory — exactly three files, verified before the run

`ls experiments/dsh-live-lab/managed-cleanup/tests` returns exactly:

- `validate-records.test.mjs`
- `read-only-boundary.test.mjs`
- `counted-disposer.test.mjs`

No fourth file, no `*.test.mjs` glob and no directory discovery: the three paths
were passed to `node --test` as literal arguments, so an extra or missing suite
would have shown up as a missing-file error rather than being silently absorbed.

`counted-disposer.test.mjs` was present and complete at run time (7477 bytes,
23:39), and it **ran**. Nothing was missing, so there is no `NOTRUN: absent
suite` entry — and nothing was invented or deduplicated on the author's behalf.

## 3. Import weight — read before executing

Every import chain is Node builtins plus in-repo relative modules; no package
resolution, no kit boot, no network:

| suite | imports |
| --- | --- |
| `counted-disposer.test.mjs` | `node:assert/strict`, `node:test`, `../fixtures/counted-disposer.mjs` |
| `read-only-boundary.test.mjs` | `node:test`, `node:assert/strict`, `node:fs/promises`, `node:os`, `node:path`, `../lib/host.mjs` |
| `validate-records.test.mjs` | `node:assert/strict`, `node:child_process`, `node:test`, `../lib/record.mjs`, `../validate-records.mjs` |

`lib/host.mjs` pulls `node:crypto`, `node:fs/promises`, `node:os`, `node:path`,
`node:url` and `./layout.mjs`; its only heavy step, the `app-boot` import, sits
behind `loadAppBoot()` and is never called by these suites. The subject fixture
`fixtures/counted-disposer.mjs` has **no imports at all**. This is why the gate
fits in 768 MiB with a 384 MiB old-space cap — and why a pass here says nothing
about module resolution in a provisioned runtime root (see §7).

## 4. The envelope — verified live, not assumed

Limits were read from inside the running unit's own cgroup during the payload,
not from the invocation flags:

| control | required | observed (live cgroup) |
| --- | --- | --- |
| `Type` | `exec` | `Type=exec` |
| `MemoryMax` | `768M` | `memory.max=805306368` (768 MiB), `systemctl` `MemoryMax=805306368` |
| `MemorySwapMax` | `0` | `memory.swap.max=0` |
| `TasksMax` | `32` | `pids.max=32`; `pids.current` peaked at **21** |
| `CPUQuota` | `50%` | `cpu.max=50000 100000`, `CPUQuotaPerSecUSec=500ms` |
| `RuntimeMaxSec` | `120` | `RuntimeMaxUSec=2min` |
| writable host paths | none but `/tmp` | `--ro-bind / /` + `--tmpfs /tmp` (`tmp_fstype=tmpfs`) |
| namespaces | pid/net/ipc/uts private | `--unshare-pid --unshare-net --unshare-ipc --unshare-uts` |
| environment | cleared, explicit | `env -i PATH=/usr/bin:/bin HOME=/tmp` |

Peak memory, from the kernel's own `memory.peak` on the unit's cgroup:
**55,431,168 bytes = 52.9 MiB** (12 samples; 768 MiB cap therefore had ≈93 %
headroom). Node heap was capped at 384 MiB via `--max-old-space-size=384`.

An envelope **rehearsal** unit (`managed-cleanup-envelope-20261101T234221-183271`)
ran first with a non-Node body (`/bin/sh`, no test payload) purely to confirm the
five cgroup controllers actually bind under this `bwrap` wrapper; it reported the
same `memory.max`/`memory.swap.max`/`pids.max`/`cpu.max` values and exited 0. It
is not a second attempt at the payload.

### Honest caveat on namespace evidence

`--unshare-net` was passed and systemd accepted the unit, but the rehearsal's
`ls /sys/class/net` still saw host interfaces (`ens18`, `docker0`, …), because
`--ro-bind / /` binds the **host** sysfs. So network isolation here is attested
by the `bwrap` invocation line and the successful namespace creation, **not** by
sysfs contents. No test needed the network; nothing was verified by contacting an
address.

### Honest caveat on post-run `systemctl show`

A transient unit is unloaded as soon as it deactivates, so `systemctl show` on it
runs *after* the fact returns only defaults (`Type=`, `RuntimeMaxUSec=infinity`)
and is worthless as evidence. That is why §4's numbers were sampled from the live
cgroup tree during the payload. The post-run query is kept in
`exit.txt` **with this caveat** rather than quoted as proof.

## 5. Exact executed command

```sh
systemd-run --wait --pipe --quiet \
  --unit=managed-cleanup-fixturegate-20261101T234241-183529 \
  --property=Type=exec \
  --property=MemoryMax=768M \
  --property=MemorySwapMax=0 \
  --property=TasksMax=32 \
  --property=CPUQuota=50% \
  --property=RuntimeMaxSec=120 \
  --working-directory=/root/dsh-ecosystem-spec/experiments/dsh-live-lab/managed-cleanup \
  -- /usr/bin/bwrap --ro-bind / / --proc /proc --dev /dev \
       --unshare-pid --unshare-net --unshare-ipc --unshare-uts --tmpfs /tmp \
  -- /usr/bin/env -i PATH=/usr/bin:/bin HOME=/tmp \
     /www/server/nodejs/v24.21.0/bin/node --max-old-space-size=384 \
     --test --test-concurrency=1 \
     "$LAB/tests/validate-records.test.mjs" \
     "$LAB/tests/read-only-boundary.test.mjs" \
     "$LAB/tests/counted-disposer.test.mjs"
```

Preflight gate, evaluated immediately before the launch: `MemAvailable` must be
`>= 1200 MiB`. Observed **1,307,724 kB = 1277 MiB → PASS**. (An earlier read 40 s
prior showed 1318 MiB; the gate was re-read at launch time, as required.)

## 6. Result

| field | value |
| --- | --- |
| payload exit | **0** (`PAYLOAD_EXIT=0`, systemd `Deactivated successfully`) |
| tests | **45**, pass **45**, fail **0**, cancelled 0, skipped 0, todo 0 |
| duration | 589 ms wall (unit lifetime 1 s) |
| stderr | **0 bytes** (`payload.stderr` empty) |
| peak RSS | 52.9 MiB / 768 MiB cap |
| TAP matches for `not ok` / `✖` | 2 — both are *test names* ("… is structurally valid and still not ok", "… with no exit code at all is not ok"), each marked `✔`. No failing assertion. |

Per-suite breakdown, counted from the TAP lines in argument order:

| suite | passing tests |
| --- | --- |
| `counted-disposer.test.mjs` | 9 |
| `read-only-boundary.test.mjs` | 11 |
| `validate-records.test.mjs` | 25 |

What this actually establishes, narrowly: the counted disposer returns the native
disposer's value **by identity** (including the very promise object), passes an
asynchronous rejection and a synchronous throw through unchanged, and records
invocation before the call and return only after it; the read-only probe treats
only `EROFS`/`EACCES`/`EPERM` as refusals and deletes only the path it created;
the record validator refuses green-washed, misattributed and unparsable records
and fails a run on any single arm failure.

## 7. Truthful ledger — refused, not run, not proven

**Refused / not done (by instruction, not by failure):**

- No real-host launch. `run-isolated.sh`, `payload.sh`, `prepare.mjs` were **not
  executed**; no `work/` runtime root was populated; no scaffold, no boot, no
  plugin apply, no Loader interaction, no tool call.
- No build, no install, no `--force`, no production writes. No production source
  file was edited. The only files written are this document and
  `reports/2026-11-01-managed-fixture-gate/`.
- No delegation; no subagent was started.
- No second attempt of any kind, and no edit-then-retry: the run passed, so
  nothing was touched afterwards either.
- Verification of `prepare.mjs` carrying `counted-disposer.mjs` was read-only
  (`prepare.mjs:188` copies it); that copy path was **not executed**.

**NOTRUN, and must not be read as passed:**

- `arm-generated.mjs`, `arm-fault.mjs` — require a booted real Loader.
- `prepare.mjs`, `run-isolated.sh`, `payload.sh` — the confined scaffold + launch
  path; unexecuted.
- `validate-records.mjs` **CLI** mode over real arm records — only its pure
  evaluators were unit-tested; no `work/records/*.json` exists.
- Anything about kit `cleanup.js` `AggregateError` behaviour in a live scope: the
  suites pin the *wrapper's* transparency and the *validator's* strictness, not
  the vendored adapter's runtime behaviour.

**Known stale, left alone:** `experiments/dsh-live-lab/managed-cleanup/README.md`
still says "STATUS: NOT RUN", which was true when written and is now true only for
the real-host arms. Correcting it is outside this gate's mandate and was not done;
whoever owns that file should re-word it to "fixture suites run (§ this record),
arms not run".

## 8. Evidence index

`reports/2026-11-01-managed-fixture-gate/`

| file | contents |
| --- | --- |
| `gate.txt` | `MemAvailable` value and gate verdict |
| `source-hashes.txt` | SHA-256 of all sources under test (below) |
| `payload.stdout` | full TAP output, 45 `✔` + summary block |
| `payload.stderr` | empty (0 bytes) |
| `exit.txt` | `PAYLOAD_EXIT=0`, peak bytes, post-run `systemctl show` (with the §4 caveat) |
| `cgroup-limits.txt` | live `memory.max`/`memory.swap.max`/`pids.max`/`cpu.max`/`pids.current` |
| `unit-properties.txt` | 4 live `systemctl show` samples of `Type`/`MemoryMax`/`TasksMax`/`CPUQuota`/`RuntimeMax` |
| `memory-peak.txt` | 12 `memory.peak` samples |

Source hashes at the moment of the run:

```
61175f7cfc5863f16a266d48a1606e03caa8b661d54c52dbfcd1c04d4a4acfc7  tests/validate-records.test.mjs
f0447bc4afc285dd788137bcf394b78b11b5ee560ff20567e3edcd414f9b6b5d  tests/read-only-boundary.test.mjs
3d797493fc732613c11762704c3e867913908b998c929d1ff1913935b0df1c57  tests/counted-disposer.test.mjs
490a92bc921d490d0d0b8fcd95e08435151dfd56748f131b93f11c97c308fa92  fixtures/counted-disposer.mjs
ed5c23f94d95240383a1510b476fda911fb1c47b1431c598ff4bf0605e696f43  lib/host.mjs
31e41c67c97eb05f4d73600e5d025358311acea027fa7db04712b207f4ab4960  lib/record.mjs
0f4c9f7859fdaf5f88b42c90820a48b4f43283f4b9c5954b903fb6a126abe35b  lib/layout.mjs
9fd2c55a841de060e8327760fbb006c862f0af99a12d4851fb32408b239eb84f  validate-records.mjs
b9c7fbcdae5df845be6d3483730eb15ec587b4229162426f9c33b2da01660a4f  prepare.mjs
```

These hashes pin *which bytes passed*. If a suite changes, this gate's `pass` no
longer transfers and a new run is owed.
