# Toolkit on a real Loader — restricted single run (STATUS: RAN ONCE, REFUSED)

**Date:** 2026-11-05
**Slice:** `experiments/third-party-pilots/toolkit-loader/`
**Status:** §1–§9 below are the **pre-run contract** and are preserved exactly as they
were written before any execution (they said NOT RUN, and that was true when they
were written). A single authorised run happened afterwards and is recorded in **§10**:
`tkl_overall_rc=70`, refused by the fixture with `RESOLUTION_TOOLS_ENTRY_ELSEWHERE`.
Read §10 for every actual number; nothing in §1–§9 has been retro-fitted with
results.

Sections 1–9 were written from the files. §10 was written from the run's raw
evidence, read with the file tools only.

**Later rounds (links only — this record is not rewritten):**
[`2026-11-05-toolkit-loader-recheck.md`](./2026-11-05-toolkit-loader-recheck.md) —
a second authorised run after §11's canonical correction. It got past the resolution
contract (634 entries, installation scope) and booted a real Loader, but the plugin
row was disabled by the host's compatibility gate (declared peer range
`>=0.0.1-rc.1 <0.2.0` excludes `dsh 0.2.2-alpha.2`, no exact-version exemption), so
zero tools registered and the fixture failed at `step=mount`: `tkl_overall_rc=72`,
fixture exit `71`. `scenario=modified` never ran.

## 1. What this would run

Exactly one command, inside one confined unit:

```
node --max-old-space-size=384 \
  experiments/third-party-pilots/toolkit-loader/fixture.mjs \
  --out <RUN_DIR>/out
```

That is the fixture's own CLI: `parseArgs` (`fixture.mjs:208-223`) accepts only
`--out <existing directory>` and refuses anything else (`ARG_UNKNOWN`,
`ARG_MISSING_VALUE`, `ARG_MISSING_OUT`). `run.sh` creates `RUN_DIR/out` exclusively
before launching, because the fixture refuses a missing `--out`.

**Not `--test`.** This is a program run, not TAP output and not a unit-test run.
`fixture.test.mjs` is **not** executed here; those pure-gate tests belong to
`experiments/third-party-pilots/loader-fixture-unit/`.

## 2. What the fixture does with that run

Read from `fixture.mjs` and summarised in its own README: it boots the real
app-boot Loader from the pinned build checkout
(`experiments/dsh-live-lab/build-checkout`), creates one throwaway profile under
`os.tmpdir()`, links the scenario tree into `<profile>/node_modules/@deepseek-ai/dsh-toolkit`,
computes the runtime resolution, asserts the resolution contract, inserts one loader
row (`include:toolkit-loader-fixture`), then walks mount → disable → re-enable →
dispose **per scenario**. Two scenarios, `original` (the extracted upstream tree)
and `modified` (the rollback-prep copy), run **serially**, never in parallel: they
claim the same ten tool names.

## 3. Envelope

| Item | Value |
| --- | --- |
| memory | `MemoryMax=768M`, `MemorySwapMax=0` |
| tasks | `TasksMax=32` |
| cpu | `CPUQuota=50%` |
| runtime | `RuntimeMaxSec=120` |
| type | `Type=exec` |
| capacity gate | one `MemAvailable >= 1228800 KiB` sample by the launcher (no polling) |

The memory/swap/tasks/cpu/runtime values are proven **inside** the unit by reading
the cgroup (`memory.max=805306368`, `memory.swap.max=0`, `pids.max=32`,
`cpu.max=50000 100000`) and the unit properties (`Type`, `RuntimeMaxUSec` raw `2min`
→ normalised `120000000`, `MemoryMax`, `MemorySwapMax`, `TasksMax`). Any mismatch or
unreadable value is a refusal (`70`); the envelope is never inferred from argv.

### 3a. Checkout pin gate (launcher, before anything else is created)

The fixture resolves `@deepseek-ai/dsh-tools` against whatever tree sits at
`experiments/dsh-live-lab/build-checkout`, so that tree's commit is part of the
subject rather than a detail. Before the run directory's work proceeds, the launcher
runs

```
/usr/bin/git -C <checkout> rev-parse HEAD
```

and requires the answer to be exactly `ce7073d51254c26cd63b22a60835b8f948deb447`
(`/usr/bin/git` is on the tool whitelist, so a missing binary refuses before this
point). A non-zero `rev_parse` rc, an empty answer or any other commit is a refusal
(`70`). The actual values are written with one checked write to
`checkout-pin.txt` — checkout path, expected pin, actual HEAD, `rev_parse_rc` — and
the same four values are repeated in `verdict.txt` alongside
`checkout_pin_proves` / `checkout_pin_not_proved`. A failed write of that file is a
recording failure (`73`), never a silent pass.

What this gate does **not** prove: the working tree's bytes. A dirty checkout, or one
whose `lib/` was rebuilt or ignored, reports the same HEAD. The gate pins the commit
this tree *claims*; the nine named hashes in §6 and the fixture's own resolution
contract are what cover the specific files actually read, and nothing here covers the
rest of the tree.

Unit-family pre-scan (also fail-closed) covers `tkl-*/lfx-*/cpy-*/tkb-*/rbk-*/hbl-*/harbor-*/exc-*/acq-*/p0-*/acc-*/admission-*`:
`hbl-*` is the prefix agreed with the Harbor author, and `harbor-*` covers the rest of
that family so a sibling's unit cannot be missed by an exact-name assumption.

## 4. Isolation

`bwrap --ro-bind / /` with exactly one persistent writable bind: `RUN_DIR/out` (the
fixture's `--out`). `/tmp` is a tmpfs (the fixture's throwaway profiles land there)
and `/dev` a devtmpfs — writable, non-persistent. Namespaces: `--unshare-pid/-ipc/-uts/-net`,
plus `PrivateNetwork=yes` on the unit. Environment: `env -i PATH=/usr/bin:/bin
HOME=/tmp TMPDIR=/tmp` — no `NODE_OPTIONS`, no `NODE_PATH`, so neither the heap limit
nor module resolution can be redirected from the environment. The run directory
itself (logs, hashes, argv, verdict) is written outside bwrap and is **not** writable
from inside it.

## 5. What the runner refuses to do

No install, no build, no chmod, no source patch, no synthesised resolution, no
resolver shim, no `NODE_PATH`, no repair of the pinned checkout, no second scenario,
no retry. Every pilot-unit family is scanned before anything is created, and any live
or transitioning unit refuses the run (fail closed). The shared acceptance lock is
mutual exclusion only, not a global guarantee.

If the checkout cannot supply the official `@deepseek-ai/dsh-tools` installation
entry, the fixture refuses with `RESOLUTION_TOOLS_ENTRY_MISSING` and the run ends as
a `70`. That refusal is the honest result; it is not something this slice works
around.

## 6. Fixed input hashes — a named set, not a closure

Nine files are hashed before and after, every line verified (64 lowercase hex, path
present, line count equal to the input count, no silent skips):

1. `toolkit-loader/run.sh`
2. `toolkit-loader/payload.sh`
3. `toolkit-loader/fixture.mjs`
4. `<extracted original tree>/lib/index.js`
5. `toolkit-rollback-modified/pkg/lib/index.js`
6. `toolkit-rollback-modified/pkg/src/index.ts`
7. `<checkout>/packages/core/tools/package.json`
8. `<checkout>/packages/core/tools/lib/index.js`
9. `<checkout>/apps/cli/package.json` (the resolution anchor)

This is a boundary, **not** a closure proof: neither scenario tree is walked,
`node_modules` is never traversed, and neither the Node runtime nor any transitive
dependency is covered. A hash match means these nine files did not change; it does
not mean the things they point at are unchanged.

## 7. Exit codes and precedence

Launcher: `0` pass, `70` refusal / unprovable envelope / unconfirmable terminal
state, `72` workload failure, `73` our recording failure, `75` lock held, `76`
directory exists, `77` hash step failed, `78` inputs changed.

Workload mapping, from the fixture's documented codes, each recorded with a
`…_source_unverified` label because they are interpretations of **one** bwrap exit
status: `0` → pass, `70` → refusal, `71` → `72` (assertion failed after boot),
`73` → `73` (the fixture's own report write failed), anything else → `72`.

Precedence is decided once, after the unit and after the hashes:
`73 > 77/78 > 70 > workload`. The raw statuses live in `node-exit-code.txt` and
`systemd-run.rc` and are never replaced by that mapping.

Terminal state is judged strictly: `not-found` requires `MainPID=0`, `inactive` and
`failed` require `MainPID=0`, and any non-zero `show` rc is
`unverifiable_communication_error` — never read as "the unit is gone". `stop` is
issued only for this exact unit, only after a successful probe, only when
`LoadState ∈ {loaded,merged}` and `ActiveState ∈
{active,activating,reloading,deactivating}`. `reset-failed` is never issued.

## 8. What a run would and would not establish

**Would**, if green: that on one date, under one envelope, with one pinned checkout
and one Node version, the fixture's flow reached its own success path for both
scenarios — resolution contract satisfied, the exact row active with ten names, the
row stopped in one of the two source-supported shapes, re-enabled with new
definitions, host teardown settled.

**Would not**: constitute acceptance of the Toolkit plugin, of the modified tree, or
of the kit's admission/cleanup APIs; establish anything about tool execution,
permissions, guards or sandbox policy; show `src`↔`lib` compile consistency in the
modified tree (two directly edited files, never compiled); or generalise to any
other host, version, checkout or plugin. `unit_unload_guaranteed=no` is recorded
deliberately: Loader unload fulfilment is the Loader's settlement, not proof that the
plugin's cleanup ran.

This is **preparation, not acceptance**. A later reader must not cite this document
as a result: it has no result.

## 9. Not executed — pending items

1. Whether the pinned checkout yields a `@deepseek-ai/dsh-tools` installation entry
   at all. If not, the expected outcome is a `RESOLUTION_TOOLS_ENTRY_MISSING`
   refusal, and that refusal is a finding about the checkout, not about the Toolkit.
2. Whether a hand-created profile `node_modules` link is compatible with the
   profile's creation mode.
3. Whether `loadProfile`/`boot`/`profileContext` call shapes (copied from
   `managed-cleanup/lib/host.mjs:117-158`) still match the pinned `app-boot` exports.
4. Whether the real disable lands in `row_disposed` or `row_disabled_no_fiber` rather
   than an unknown state — if it does not, the fixture fails rather than passing on a
   looser reading.
5. Whether the fixture's two scenario trees are both consumable in one process
   lifetime sequentially (they are serialised in the fixture; unverified).
6. `GO-loader.txt` does not exist. It is an operational gate, never created by
   `run.sh`.

## 10. The run that happened (single use, refused)

One Lead GO authorised exactly one execution of
`bash experiments/third-party-pilots/toolkit-loader/run.sh loader`. It was run once
and **the workload refused**: `tkl_overall_rc=70`, `launcher_exit=70`.

| Item | Value |
| --- | --- |
| run dir | `experiments/third-party-pilots/toolkit-loader/runs/20261105T144447Z-tkl-loader-440458-22870/` |
| unit | `tkl-third-party-loader-20261105T144447Z-440458` |
| `sandbox_invocation_rc` | `70` |
| `systemd-run.rc` | `70` |
| `workload_verdict` | `fixture_refused` |
| `node_status` | `fixture_70_interpreted_as_refusal_source_unverified` |

### 10.1 The refusal

From `out/toolkit-loader-report.txt` (the fixture's own report) and `unit.log`:

```
error=RESOLUTION_TOOLS_ENTRY_ELSEWHERE
detail=entry packageDir <checkout>/packages/context/agent-instructions/node_modules/@deepseek-ai/dsh-tools
       is not the pinned <checkout>/packages/core/tools
```

So the expected blocker in §9.1 is **not** what happened. The pinned checkout *does*
produce a `@deepseek-ai/dsh-tools` installation entry — but the entry it produces
names `packages/context/agent-instructions/node_modules/@deepseek-ai/dsh-tools`, not
the pinned `packages/core/tools`, so the contract refused.

**Read §10.6 before quoting this as a finding about the checkout.** A read-only
diagnosis afterwards showed that the directory the entry names is a symlink whose
realpath *is* `packages/core/tools`: the same package, a different spelling. The
refusal therefore rests on a text difference. Nothing was changed afterwards — no
fixture edit, no gate edit, no retry. The refusal is what the run produced; §10.6 is
what it means.

### 10.2 How far the two scenarios actually got

**Both scenarios got as far as the resolution contract, and no further.** The report
file has five lines:

1. `fixture=… scenarios=original,modified` — the catalog lists both;
2. `scenario=original tree=… status=starting`;
3. `scenario=original home=/tmp/toolkit-loader-original-home-jIwGlz profile=/tmp/toolkit-loader-original-home-jIwGlz/profiles/headless`;
4. `scenario=original link=…/profiles/headless/node_modules/@deepseek-ai/dsh-toolkit target=<original tree> created=yes`;
5. `error=RESOLUTION_TOOLS_ENTRY_ELSEWHERE …`.

Concretely, therefore:

| Thing | Actually happened? |
| --- | --- |
| checkout `loadProfile` reached | **yes** — real `entry.loadProfile(...)` returned a profile; its home and `profiles/headless` exist under `/tmp` (`fixture.mjs:589`) |
| checkout `createRuntimeResolution` reached | **yes** — real call returned a resolution object, which the contract then judged (`fixture.mjs:599`) |
| checkout `boot` reached | **no** — `entry.boot` is at `fixture.mjs:635`, *after* the contract call at `:600`, which threw. An earlier version of this record said "boot reached"; that was wrong and is corrected here |
| profile `node_modules/@deepseek-ai/dsh-toolkit` link created | **yes** (`created=yes`), no `LINK_ELSEWHERE` |
| resolution contract | **failed** at the `dsh-tools` entry check (`fixture.mjs:363-366`) |
| row inserted (`include:toolkit-loader-fixture`) | **no** |
| mount step / tool visibility / `tools.get` | **never reached** |
| disable step, row state, `row_disposed` vs `row_disabled_no_fiber` | **never reached** |
| re-enable step, new definitions | **never reached** |
| host teardown settlement | **not recorded** — `disposeHost` (`fixture.mjs:749`) was never reached, so no teardown line exists in the report |
| `modified` scenario | **never started** (the fixture stops after the first failing scenario) |

No tool-visibility, Loader-row-state or teardown claim can be made from this run. It
is a refusal about resolution, nothing more.

### 10.3 Envelope, caps, hash, terminal state (all read back)

`cgroup_proof=yes`: `memory.max=805306368`, `memory.swap.max=0`, `pids.max=32`,
`cpu.max=50000 100000`. `unit_proof=yes`: `Type=exec`, `RuntimeMaxUSec` raw `2min` →
`120000000` µs, `MemoryMax=805306368`, `MemorySwapMax=0`, `TasksMax=32`.
MemAvailable gate `1262376 ≥ 1228800` KiB, one launcher sample
(`tkl_gate=pass`, `tkl_gate_samples=1`). `unit.log`: `Service runtime: 1.403s`,
`CPU time consumed: 447ms`, `Memory peak: 62.8M (swap: 0B)`,
`Main processes terminated with: code=exited, status=70/SOFTWARE`.

Hashes: 9 named inputs, `hashes-before.txt` = `hashes-after.txt` byte for byte
(`hash_status=identical`, `hash_rc=0`):

```
2b638250b7612ec3d6ee55fa4c54eb4d098ee841ed92f92f8d846746253277ca  toolkit-loader/run.sh
addbe8fd32be1c8b8c7d3c77383d0dade2a5f3011fde45fc6be216c599d39f88  toolkit-loader/payload.sh
1c23145fc7e153c3473614a69a8b69f71059bad197e057dfdff242ac34c23efa  toolkit-loader/fixture.mjs
8f1ea603ac00dfb1cbba715c5b7a4444d9b87c1aa7317a735f7de6e93f684ca5  <original tree>/lib/index.js
952a166d5b3bacc7873427b205d42b46ccd6a7ada846264573394da7467f1a67  toolkit-rollback-modified/pkg/lib/index.js
33627fa86d3cd1714b750fcfdd1f9c1a21e161ce2087c97e01bf2898667721c5  toolkit-rollback-modified/pkg/src/index.ts
da8ee05328d8d0865ab690f4b8cb066e8782f44ed9be679a51859d5e49de7005  <checkout>/packages/core/tools/package.json
1889cbf718d64518dd83245d4dba1e1f080b2c5326259c3ed5b1be7a7666a2bd  <checkout>/packages/core/tools/lib/index.js
24e6053ed5368db6c17e6524cd2b959e594388205d9ba2d0360cdb0ccd734c88  <checkout>/apps/cli/package.json
```

This remains a **named set, not a closure** (§6): the trees those files point at,
`node_modules`, the Node runtime and every transitive dependency are outside it. Note
in particular that the offending entry — `packages/context/agent-instructions/node_modules/@deepseek-ai/dsh-tools` — is **not** among the hashed paths, so these hashes say nothing about it.

Checkout pin (§3a): `checkout-pin.txt` records
`expected_pin=ce7073d51254c26cd63b22a60835b8f948deb447`,
`actual_head=ce7073d51254c26cd63b22a60835b8f948deb447`, `rev_parse_rc=0`. The pin gate
**passed**; `verdict.txt` repeats the same three values. As designed, this proves the
commit the tree reports, **not** the working-tree or ignored build bytes — and the
refusal above is precisely a statement about `node_modules` content, which the pin
gate does not cover.

Terminal state: first probe `LoadState=loaded`, `ActiveState=failed`,
`SubState=failed`, `MainPID=0`, `show_rc=0` → `terminal_state=failed_mainpid0`,
`terminal_confirmed=yes`; `cleanup_action=skipped_already_terminal` (nothing live to
stop), `stop_rc=not_attempted`, `reset_failed=not_attempted_by_design`; after-probe
identical, `after_terminal_confirmed=yes`; `unit_unload_guaranteed=no`.
`unit-scan.txt` is empty (no other pilot unit was live before this run).

Preconditions: all three checked entries `ok` (node binary, fixture module, `out/`).

### 10.4 Process notes and deviations

- Authorisation: `GO-loader.txt` was confirmed absent (no file matched `GO*` in the
  slice), created with the file tools as the strict single line `GO loader`, read
  back as one line, and after the run a consumption line was appended with the file
  tools while the original `GO loader` line was preserved.
- One command was issued: the run itself. No `bash -n`, no standalone `node`, no
  install, no build, no extra scan, no retry, no raised limit, no second scenario.
- Every number above was read with the file tools (`read`/`glob`). **No shell command
  was used to gather or confirm evidence**, so nothing here is corroborated by a
  second tool path.
- `source_attribution=not_distinguished_between_bwrap_setup_and_node_workload` and
  `node_start_not_independently_proven=yes`: the `70` is an interpretation of one
  bwrap exit status. The fixture's own report and `unit.log` both independently show
  the refusal text, which is why the refusal code is quoted rather than inferred —
  but a bwrap-side failure would still have produced a `70`, so the mapping alone
  proves nothing.
- Harbor received **no** run authorisation and was not touched in this run.
- The record deliberately does **not** claim: that the Toolkit fails on a real
  Loader, that the modified tree is wrong, or that any tool registration was
  observed. See §10.6 for what the refusal actually established.

### 10.5 What would have to change before a retry (not authorised, not done)

A design decision for the Lead, not a change to make inside a run: whether the
contract should compare package identity by **canonical path** (`realpath`) rather
than by the entry's own string. §10.6 supplies the evidence for that decision; it
does not take it.

### 10.6 Read-only diagnosis after the run (one authorised probe)

One lightweight, explicitly authorised probe was made of the two exact paths — no
recursion, no `node`, no install, no test, no retry:

```
ls -ld A B; readlink -f A; readlink -f B
A = <checkout>/packages/context/agent-instructions/node_modules/@deepseek-ai/dsh-tools
B = <checkout>/packages/core/tools
```

Result:

```
lrwxrwxrwx 1 root root   22 Oct 31 21:05 A -> ../../../../core/tools
drwxr-xr-x 7 root root 4096 Oct 31 21:06 B
realpath_A=/root/.../build-checkout/packages/core/tools
realpath_B=/root/.../build-checkout/packages/core/tools
```

**`A` is a symlink to `B`.** They are the same directory; only the spelling differs.

Now the fixture's own code, read afterwards:

- `fixture.mjs:363-366`:
  `const entryDir = resolve(String(entry.packageDir ?? ''))` … `if (entryDir !== toolsRealPath) throw new Refusal('RESOLUTION_TOOLS_ENTRY_ELSEWHERE', …)`.
  The left side is the entry's own **string** (normalised with `path.resolve`, which
  does not follow symlinks); the right side is `toolsRealPath`, produced by
  `await realpath(TOOLS_DIR)` at `fixture.mjs:584`. Text versus canonical path.
- Call order in `runScenario`: `loadProfile` `:589` → link `:592` →
  `createRuntimeResolution` `:599` → `assertResolutionContract` `:600` → (throw here)
  → root config `:611-624` → overlay `:625-631` → `entry.boot` `:635` → … →
  `disposeHost` `:749`.

What this means, stated narrowly:

1. The refusal code is accurate about what the fixture decided, and **not** evidence
   that the checkout resolves `@deepseek-ai/dsh-tools` to a different package. The
   entry is installation-scoped and its target is the pinned directory.
2. The run therefore did **not** establish a defect in the checkout, in the Toolkit,
   or in the resolver. What it established is narrower: the fixture's string
   comparison rejects a symlink-spelled entry.
3. `boot` was never reached (see §10.2, corrected). Everything downstream — row
   insertion, mount, tool visibility, disable/row-state, re-enable, teardown — is
   unmeasured by this run, exactly as before.
4. Whether the contract *should* accept canonical identity is a fixture-contract
   question requiring Lead review. **Superseded by §11** — at the time this was
   written the contract had not been changed; it has been changed since, by explicit
   Lead approval, and the change is recorded there (not here, so this diagnosis keeps
   its original meaning).

Provenance of this subsection: the path probe (one shell command, the only one
permitted for this purpose) plus file reads. The conclusion about identity rests on
`readlink -f` returning the same directory for both paths; it does not rest on my
reading of the symlink target string alone.

## 11. Design correction after the run (CODE ONLY — NOT RE-RUN)

Authorised as a minimal code change after §10.6, with these constraints: the entry
must still exist by exact `name` and `scope === 'installation'`; `packageDir` must be
a non-empty absolute path; identity is decided by `fs.realpath` against the fixed
pinned tools directory; no synthesis of entries, no resolver shim, no change to the
host's resolution, no `String(undefined)`-to-cwd fallback.

What changed, in three files, all under `experiments/third-party-pilots/toolkit-loader/`:

| File | Change |
| --- | --- |
| `fixture.mjs` | `assertResolutionContract` is now `async`; `packageDir` is validated (non-empty, absolute) then canonicalised with `fs.realpath` before comparison. Two new refusal codes: `RESOLUTION_TOOLS_ENTRY_INVALID_PATH`, `RESOLUTION_TOOLS_ENTRY_UNRESOLVABLE`. `RESOLUTION_TOOLS_ENTRY_ELSEWHERE` now means "canonically different". The single call site awaits it. |
| `fixture.test.mjs` | Contract tests are `async`; they build a throwaway temp tree (`mkdtemp` under `os.tmpdir()`, three directories, two symlinks) so real canonicalisation has real paths. New cases: symlink-to-the-pin **passes**, symlink-to-another-directory refuses, unresolvable refuses, missing/empty/relative paths refuse. |
| `README.md` | Refusal-code table updated; new section "On the entry comparison (design correction after the first run)" recording the false-negative diagnosis, the four-step contract, why it is `async`, and what was deliberately left alone. |

Deliberately **not** changed: the linked-root comparison stays a plain path-string
comparison (`resolve(linked.realPath) === treeRealPath`). No evidence yet says it
needs canonicalisation, and widening it was outside this correction.

What this does **not** establish:

- No re-run has happened. The corrected fixture has never executed; its contract
  gate has never been exercised against the real checkout, only against hand-built
  values and a temp tree — and those tests have not been run either.
- The first run's `70` remains the only Loader-adjacent evidence in this slice, and
  it establishes only that the *old* string comparison refused (see §10.6).
- Nothing here shows that the Toolkit mounts, that tools appear, that disable/re-enable
  or teardown behave, or that the modified tree is correct.
- `entry.boot` and `disposeHost` were never reached in the authorised run, and the
  corrected fixture has not reached them either.

Status of this slice after §11: **CODE CHANGED, NOT RE-RUN.** A retry needs a new
single-use authorisation for the same entry point; none has been requested here.

## 12. Exact-version exemption added after the second run (CODE ONLY — NEVER EXECUTED)

The second authorised run (recorded in
[`2026-11-05-toolkit-loader-recheck.md`](./2026-11-05-toolkit-loader-recheck.md))
booted a real Loader and produced, verbatim in its `unit.log`:

```
dsh: disabling profile plugin row "toolkit-loader-fixture": Plugin
@deepseek-ai/dsh-toolkit@0.0.1 is incompatible with dsh 0.2.2-alpha.2: requirements
{"@deepseek-ai/dsh-invariants":">=0.0.1-rc.1 <0.2.0",
 "@deepseek-ai/dsh-tools":">=0.0.1-rc.1 <0.2.0"}. … Exact-version exemption: not active.
```

`apply` therefore never ran and zero of the ten tools registered. The host's own
remedy is a **profile-local exact-version exemption**
(`packages/boot/app-boot/src/profile-compatibility.ts:113-141`:
`setProfileVersionExemption(profileDir, key, runtimeVersion, rewritable, allowCreate)`),
read by the compatibility preflight before the composed tree mounts. One such
exemption for the pinned pair has been added to the fixture.

What was added, all under `experiments/third-party-pilots/toolkit-loader/`:

| File | Change |
| --- | --- |
| `fixture.mjs` | Constants `EXEMPTION_KEY = '@deepseek-ai/dsh-toolkit@0.0.1'`, `EXEMPTION_RUNTIME = '0.2.2-alpha.2'`, `COMPATIBILITY_FILENAME = 'compatibility.json'`, `FORBIDDEN_HOMES = ['/root/.dsh']`. New `grantProfileExemption` called in `runScenario` after the profile link and after `createRuntimeResolution`/`assertResolutionContract` have passed, and **before** `boot`, plus its gates `assertExemptionSite`, `assertExemptionAbsent`, `readExemptionState`, `judgeExemptionGrant` and the `isWithin` segment helper. Ordering it after the contract means a resolver refusal leaves no grant behind. |
| `fixture.test.mjs` | New site/judgment cases: disposable home accepted; a home this run did not create refused; a sibling sharing a name prefix refused; a symlinked profile escaping the home refused; missing home/profile refused; `/root/.dsh` refused without touching it; pre-existing `compatibility.json` refused; readback accepting exactly one key + one runtime; readback refusing an extra key, a second runtime, a wrong key, rejected records, a non-empty `warnings` array, a missing or wrongly typed `warnings`/`rewritable`, a read-only file, and non-object answers. Plus mock-surface flow cases for `grantProfileExemption`: setter called exactly once with `(profileReal, key, runtime, true, true)`; a wrong runtime or manifest refuses with zero setter calls; a missing setter, runtime reader or compatibility reader refuses with zero calls; a pre-existing file or a foreign home refuses with zero calls; a throwing setter reports `_WRITE_FAILED` after exactly one attempt; a throwing reader, a bad shape, an extra key, an extra runtime or non-empty warnings all report `_READBACK_MISMATCH`. These use a mock app-boot surface and a real temp FS — they are not host-gate evidence. |
| `README.md` | Status line updated to "RAN TWICE: REFUSED, THEN FAILED AT MOUNT; EXEMPTION ADDED, NOT RUN"; new section "The one exact-version exemption"; eleven `EXEMPTION_*` codes added to the refusal table. |

The gates, in fail-closed order — each refusal happens **before** the setter is
called:

1. `EXEMPTION_API_MISSING` — the setter, `getDshRuntimeVersion` or
   `readProfileCompatibility` absent. All three are required up front: the reader
   is the only accepted read-back source, so its absence cannot be deferred to the
   end;
2. `EXEMPTION_IDENTITY_MISMATCH` — runtime from `getDshRuntimeVersion()` is not
   exactly `0.2.2-alpha.2`, or the manifest's `name@version` is not exactly
   `@deepseek-ai/dsh-toolkit@0.0.1`. The runtime is **compared**, never adopted
   from whatever the host reports;
3. `EXEMPTION_HOME_IS_PRODUCTION` — the raw home strings overlap `/root/.dsh`,
   checked before any filesystem access so the production tree is not even
   resolved;
4. `EXEMPTION_HOME_NOT_CREATED` / `_HOME_OUTSIDE_TEMP_ROOT` / `_PROFILE_LAYOUT` —
   the home must be the exact `mkdtemp` directory of this scenario, directly under
   the real `os.tmpdir()`, with the profile exactly at `profiles/headless`.
   Containment uses `path.relative`, never `String.startsWith`, so a sibling named
   `<home>-evil` is refused; symlink escape is caught by canonicalising the
   profile;
5. `EXEMPTION_FILE_ALREADY_PRESENT` — `compatibility.json` must not exist
   beforehand, so a stale grant cannot be mistaken for this run's;
6. `EXEMPTION_WRITE_FAILED` — the official setter threw;
7. `EXEMPTION_READBACK_FAILED` / `EXEMPTION_READBACK_MISMATCH` — the state cannot
   be read back through the official reader, or is not exactly `{ key: [runtime] }`
   with an empty `warnings` array and `rewritable === true`. There is no fallback
   that parses `compatibility.json` directly: doing so would accept a file shape the
   host itself never reported, so the reader's absence is a refusal and a missing or
   wrongly typed field never counts as a pass.

Runs ordered this way mean the exemption is written only after
`createRuntimeResolution` and `assertResolutionContract` have already passed, so a
resolver refusal at the canonical-comparison gate leaves the throwaway profile
without a grant.

Each scenario creates its own fresh home, so `original` and `modified` cannot
inherit each other's grant. `DSH_HOME` unset and `HOME=/tmp` are recorded only as
incidental evidence; the path proof is the canonical site check.

What this does **not** establish:

- **Nothing here has been executed.** The exemption path has never run, so there
  is no observation of the official setter writing, no readback from a real
  profile, and no evidence that the row then activates.
- It is an **experimental, profile-local permission for one exact version pair**,
  not a native compatibility certification. It does not edit `peerDependencies`,
  does not change the host, and does not make the plugin supported; a later run
  may still fail for any other reason.
- The mock-level site/judgment tests prove only that the gates refuse malformed or
  misplaced inputs. They are not evidence about the host's compatibility gate.
- A real grant with a deliberately wrong runtime was **not** attempted (the host
  would refuse it); the no-exemption refusal in the recheck record stands as the
  only compatibility-gate evidence.

Status of this slice after §12: **CODE ONLY — EXEMPTION ADDED, NOT RUN.** A retry
needs a new single-use authorisation; none has been requested.

