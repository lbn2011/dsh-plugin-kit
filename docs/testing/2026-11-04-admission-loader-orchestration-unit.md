# admission-loader-fixture ORCHESTRATION unit slice (2026-11-04)

**Status: RUN ONCE. 2 test files, 0 tests executed, 2 failed, node exit 1. NOT
green, and NOT a test result either — both targets failed to load.**

Neither target file produced a single assertion: `node --test` reported `tests 2`,
`pass 0`, `fail 2`, because both files died compiling their shared import
`../prepare.mjs`, which has a duplicate declaration. The failure is preserved here
in full, not summarised away.

## 1. What this run establishes, and what it does not

**Establishes:** that the bounded envelope works for this slice — the unit launched
once, the caps and the single memory gate were read back and matched, the 20-file
hash pair is identical, and the unit is gone afterwards.

**Establishes nothing about the code under test.** Zero tests ran. This run cannot
say whether the preparer's filesystem contract or the orchestration loop's decisions
are correct, because neither file reached its first test.

**Not real Loader acceptance at any point.** Both targets are contract tests over
injected dependencies and mocks: `prepare.test.mjs` exercises the fixture preparer
against directories it creates itself under `os.tmpdir()`; `run-loop.test.mjs`
drives the acceptance loop with every stage mocked, no Loader booted, no directory
created, no document judged by the real validator. Nothing here may be quoted as
realLoader evidence, and the collect-against-a-real-Loader gap stays open.

## 2. Run identity (read back)

| field | value |
|---|---|
| run id | `20261103T201109Z-admission-loader-orchestration-unit-376656-12899` |
| unit | `admission-loader-orchestration-unit-20261103T201109Z-376656` |
| run directory | `experiments/acceptance/admission-loader-orchestration-unit/runs/20261103T201109Z-admission-loader-orchestration-unit-376656-12899/` |
| repo HEAD | `effb9581687f995841d872304e03627473039957` |
| launcher | `.../admission-loader-orchestration-unit/run.sh` |
| payload | `.../admission-loader-orchestration-unit/payload.sh` |
| node | `/www/server/nodejs/v24.21.0/bin/node` (v24.21.0, from the error banner) |
| competing workers | none observed before launch; no background job was pending |

## 3. Invocation

```
bash experiments/acceptance/admission-loader-orchestration-unit/run.sh
```

Executed once, exactly as prepared. No retry after the failure, no `bash -n`, no
extra `node`, no build, no install, no escalation.

## 4. The two literal targets

```
/root/dsh-ecosystem-spec/experiments/admission-loader-fixture/tests/prepare.test.mjs
/root/dsh-ecosystem-spec/experiments/admission-loader-fixture/tests/run-loop.test.mjs
```

Both existed and were hashed before the launch.

## 5. Envelope and sandbox (read back, matched)

| item | read back |
|---|---|
| cgroup path | `/system.slice/admission-loader-orchestration-unit-20261103T201109Z-376656.service` |
| `memory.max` | `805306368` (= 768M) |
| `memory.swap.max` | `0` |
| `pids.max` | `32` |
| `cpu.max` | `50000 100000` (= 50%) |
| unit `Type` | `exec` |
| `RuntimeMaxUSec` | `120000000` µs, resolved from `2min` |
| `acc_capture_ok` | `yes` |
| memory gate | `1745844` KiB available ≥ `1228800` KiB required ⇒ `acc_gate=pass`, sampled once |
| sandbox | `bwrap --ro-bind / / --dev /dev --proc /proc --tmpfs /tmp --unshare-pid --unshare-net --unshare-ipc --unshare-uts --die-with-parent`, `env -i`, heap cap 384 MiB |

The gate and the envelope are the only parts of this run that behaved as designed.

## 6. Outcome (the failure, preserved)

`node --test` summary, verbatim:

```
ℹ tests 2
ℹ suites 0
ℹ pass 0
ℹ fail 2
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 199.85112
```

Both "tests" are the two files themselves; neither contained a runnable test because
both failed to import. The identical error was raised twice:

```
file:///root/dsh-ecosystem-spec/experiments/admission-loader-fixture/prepare.mjs:334
  const entry = await lstatOr(join(kitDir, entryPath))
        ^

SyntaxError: Identifier 'entry' has already been declared
    at compileSourceTextModule (node:internal/modules/esm/utils:319:16)
    ...
Node.js v24.21.0
```

Read at source (`prepare.mjs:330-334`), the module declares `const entry` twice in
one block scope: once as `const entry = manifest?.exports?.[KIT_EXPORT]`, then again
as `const entry = await lstatOr(...)`. This is a **load-time syntax error**, so it
is a defect in `prepare.mjs`, not an assertion failure, and it is not evidence about
either test file's subject.

`run-loop.test.mjs` failed for the same reason: it imports `../run-loop.mjs`, which
imports `./prepare.mjs`.

Other measured values:

| field | value |
|---|---|
| `systemd-run` exit | `1` (`systemd-run.rc`, 2 B) |
| `acc_node_rc` | `1` |
| `acc_workload_wall_ms` | `544` |
| `acc_memory_peak` | `56897536` B (54.3 MiB) |
| `acc_memory_current_final` | `33419264` B |
| `acc_pids_peak` | `16` of 32 |
| `memory.events.local` | `low 0 high 0 max 0 oom 0 oom_kill 0 oom_group_kill 0` |
| journal | `Main process exited, code=exited, status=1/FAILURE`; `Failed with result 'exit-code'`; service runtime 630 ms, CPU 224 ms |
| unit state after | `LoadState=not-found`, `ActiveState=inactive`, `SubState=dead`; `admission-loader-*` unit list empty |

## 7. Hashes (20 files, identical before and after)

`hashes-before.txt` and `hashes-after.txt` are both 2966 B, 20 lines each, and
`status.txt` records `hash_status=identical`; both `.err` files are 0 B. No
`hashes-diff.txt` was written, because nothing drifted.

The 20 are: the two targets, the two runner scripts, and sixteen **selected**
inputs — `prepare.mjs`, `run-loop.mjs`, `collect.mjs`, `evaluate.mjs`;
`fixtures/{scenarios,trace,scenario.plugin,coordinator.plugin}.mjs`;
`fixtures/scenarios.patch.yml`; `managed-cleanup/lib/{layout,host}.mjs`;
`dsh-plugin-kit/src/{admission,cleanup}.js`; and the canonical validator, the
projector and the diagnoser. Key values from this run:

```
81a375f94306c3dd3ef85e4d2ca8d4c5d1f13bed85b5386db8f0278dc609a9a7  prepare.mjs
a14c5bc279587a1536e1517742c82c285c07731d5cd2e9f253e74b680eab28d3  run-loop.mjs
```

**This is a witness over identified inputs, not a closure.** Twenty files were
checked; node builtins are excluded, and a deeper module that changed without
appearing in the list would not be caught. "Identical" means *these 20 files did not
change during the run*, never that nothing changed, and it never proves the
dependency closure.

## 8. Deviations and limits

- **The run's subject was never exercised.** The recorded failure is a compile-time
  duplicate declaration in `prepare.mjs`; no assertion from either target ran.
- No whole-repository process sweep was performed, in line with the instruction to
  keep the working set narrow; the unit table was consulted only for this slice's
  own unit and pattern.
- The earlier `admission-loader-unit` slice, its scripts and its two run directories
  were not touched, and no run root was removed.
- The `*not run*` placeholders in the previous revision of this record were author
  intent, never evidence; they have been replaced by readback, and where nothing was
  measured the text says so rather than guessing.

## 9. Gate for another attempt

This slice has one recorded run and no GO for a second. The defect at
`prepare.mjs:334` is in a frozen source owned elsewhere; repairing it is not this
slice's action, and no fix was attempted. A further run would need a fresh explicit
GO after that source is corrected and reviewed.

## 10. Diagnosis appended after the Lead authorised the minimal fix (NOT RUN)

Everything above stands as measured: **2 test files, 0 tests executed, 2 failed,
node exit 1**, with the verbatim `SyntaxError` at `prepare.mjs:334`. This section
adds a cause and a correction. The correction has **not been executed, compiled,
loaded or tested** — no `node`, no `--test`, no `--check`, no `bash -n`. Nothing
below is a run result.

### 10.1 Cause, read at source

`inspectKit(kitDir)` bound the same identifier twice in one function-block scope:

```js
const entry = manifest?.exports?.[KIT_EXPORT]        // :329  the manifest value
const entryPath = typeof entry === 'string' ? entry : entry?.default
…
const entry = await lstatOr(join(kitDir, entryPath)) // :334  the stat result
```

Two `const` declarations of `entry` in the same scope is a **load-time**
`SyntaxError: Identifier 'entry' has already been declared`. It is raised while
compiling the module, before any function runs, which is why both targets failed
identically: `run-loop.test.mjs` imports `../run-loop.mjs`, which imports
`./prepare.mjs`. No assertion in either file could be reached, so this run says
nothing about the preparer's filesystem contract or the loop's decisions — the
reading in §1 is unchanged and still exact.

### 10.2 Correction applied (minimal, same semantics)

Second binding renamed; the manifest value keeps its name:

```js
const entryInspection = await lstatOr(join(kitDir, entryPath))   // was: const entry =
if (entryInspection.error !== null) {                            // was: entry.error
  const code = isMissing(entryInspection.error) ? … : …          // was: entry.error
  return { ok: false, refusals: [`${code}:${entryPath}`], target: null }
}
if (!entryInspection.stats.isFile()) {                           // was: entry.stats
```

Four lines changed inside `:334-339` (`:337-338` untouched). Same `lstatOr` call,
same `isMissing` test, same `dependencyExportMissing` / `kitInspectionFailed`
codes, same refusal strings, same `target` (the realpath), same return shape. No
branch added or removed, no check relaxed, no error swallowed, no new dependency.

### 10.3 Other duplicate bindings — searched, none found

The same compile failure could sit behind this first one, so `prepare.mjs` was
scanned by reading it: 14 functions, 45 two-space declarations inside function
bodies, 14 module-level `const/let/var`, 16 imported bindings. No identifier is
declared twice within one function scope, no duplicate module-level binding, no
duplicate import, no duplicate function name, no duplicate parameter, and no
parameter shadowing a module-level function. This is a **static reading of one
file**, not a compile: a duplicate produced by a macro-like construct, or one in
`run-loop.mjs` beyond the import edge, would not be caught here.

### 10.4 What this does and does not license

- **Not established:** that `prepare.mjs` now loads. Without a compile this is a
  reading, and a reading is not a parse.
- **Not established:** that either test file passes, or that any single test runs.
  The 0-assertion column of §6 is still the only measured outcome for this slice.
- **Not established:** anything about real Loader behaviour. The `not real Loader
  acceptance` limit in §1 is untouched by a rename.
- **Unchanged:** the 20-file hash pair, the envelope readback, and the single run
  identity in §2 all describe the *pre-fix* tree; `prepare.mjs` no longer hashes to
  `81a375f94306c3dd3ef85e4d2ca8d4c5d1f13bed85b5386db8f0278dc609a9a7`.

### 10.5 Gate

Still one run, still no GO. A recheck needs a fresh explicit authorisation, and it
must be a real launch of the same two literal targets with a fresh run directory —
not an inference from this section. Until then the honest status of this slice is:
**one run, 2 files failed to load, 0 assertions, defect identified and corrected in
source, correction unverified.**
