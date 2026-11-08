# Kit unit suite after the managed-template slice — execution record

Date: 2026-11-01, Asia/Shanghai (run 2 finished ~23:29).
Workload: `projects/dsh-plugin-kit`, full unit suite (`tests/*.test.js`).

## Current verdict: PASS — 107 tests, 107 pass, 0 fail, 0 skipped, exit code 0

Two test launches of the workload were authorized and both happened: one
diagnostic (which failed) and one after repairs (which passed). The failures were
**test-file defects**, not product defects: no source file was edited, no
assertion was deleted, and no refusal was relaxed. Three test-side repairs were
made and are quoted in §Repairs.

This file is the execution record for the unit suite. The sibling
`2026-11-01-managed-template-acceptance.md` remains the plan of required
behavioural checks; it carries a pointer to this record and no results of its own.

## Code state executed

The repository has **no commits** (`git log` → `fatal: your current branch 'main'
does not have any commits yet`); every path is untracked, so the state is given
as `sha256` of the exact bytes run 2 executed.

| File | sha256 |
|---|---|
| `src/protocol.js` | `9b0fa42dd0e653a60f2bbaa95d715a9b15912637a4c6dde848932084016ee287` |
| `src/manifest.js` | `f78e5307c20f4eddf6f10fd8b357bf62bad9f8827406a0c5a0e759008c8b13c5` |
| `src/scaffold.js` | `5f86ad12326596c2c7c01bb34ae16705abb1fb8391d14e8540037b0abc0ab4a3` |
| `src/cli.js` | `6bc4b23edf02efbba816346e8a84c54f622fd6710d981730db1697f02292504a` |
| `src/index.js` | `8d0fe29466ace71ed37066b8bc2a92282d3fb957dc75c17292e45050ee1acdca` |
| `src/index.d.ts` | `660a91a46278c5c63f3bce0b94ecedab070c9789dc1774592ab0eb103c85d103` |
| `tests/cleanup.test.js` | `47f52a5455eadb5cec5f5fcbfa87f6f74cc917e83a89b20be79830400cde2e44` |
| `tests/cli.test.js` | `b4931d7c05281508736df9460a44b28f5b9ea05c1a8581ddd22d53453cb1fb68` |
| `tests/exports.test.js` | `0ab3596aa20cf2eccf92047cd07f5f472dfb8a7a9a0f2b396367c72cd30f6e89` |
| `tests/managed-registration.test.js` | `7ac81f2416ea52870bfe44ca836a72170bcee2624b63332fa24faacef890fc13` |
| `tests/managed-template.test.js` | `ef8e921b214b1fbcab0b980a78e3c5f1d4b592a64dfa4954208b772d22d58d71` |
| `tests/protocol.test.js` | `307e06cfa1edac34d0eb15a83264c9e8341de0dd0604fb08dce877e62415bca9` |
| `tests/scaffold.test.js` | `3d049e7ddbe7ee97af1c55939bf03d3078767b8defc91bb8581d1859681d4bfd` |
| `tests/template.test.js` | `0107347ae4f0578f4e84a9dad798a58dd81f60f7b2208591c14ad61d92b4649c` |
| `templates/host-tool-managed/package.json` | `5867402270db57f18b3b6b9bbfbf282a1d9b627a8ba79574e18f922817aa4a29` |
| `templates/host-tool-managed/generated-readme.md` | `62089ef8703fd02e722aad47f9c3f8a2d7156f0a61e15df3b414c1878a0392fe` |
| `templates/host-tool-managed/test/plugin.test.js` | `08ef3054b454c434cffa8ef02a94ed39e70c55410ce9190b1e4f2f6addab5db7` |

Run 1 executed an earlier state of `tests/scaffold.test.js` and
`tests/managed-template.test.js`. Those pre-repair hashes were not captured; the
exact edits are reproduced in §Repairs, which is the difference between the two
runs. Every other file was byte-identical across both runs.

## Execution envelope (both launches)

`systemd-run` + `bwrap` + `env -i`, exactly as prescribed:

```sh
systemd-run --service-type=exec --wait --pipe --collect --unit=<unit> \
  -p MemoryMax=768M -p MemorySwapMax=0 -p TasksMax=32 -p CPUQuota=50% -p RuntimeMaxSec=120 \
  -p WorkingDirectory=/root/dsh-ecosystem-spec/projects/dsh-plugin-kit \
  /usr/bin/bwrap --ro-bind / / --dev /dev --proc /proc --unshare-pid --unshare-net \
    --unshare-ipc --unshare-uts --tmpfs /tmp --die-with-parent \
  /usr/bin/env -i PATH=/usr/local/bin:/usr/bin:/bin HOME=/tmp \
  /www/server/nodejs/v24.21.0/bin/node --max-old-space-size=384 --test --test-concurrency=1 \
  tests/cleanup.test.js tests/cli.test.js tests/exports.test.js tests/managed-registration.test.js \
  tests/managed-template.test.js tests/protocol.test.js tests/scaffold.test.js tests/template.test.js
```

The eight files are listed explicitly rather than through a shell glob, because
`node --test` with no arguments would also discover
`templates/host-tool-managed/test/plugin.test.js`, which imports host packages
that do not resolve here. The file set equals `package.json`'s
`node --test "tests/*.test.js"`. Node is v24.21.0. The repo is mounted read-only
by `bwrap`; the suite writes only under the unit's private `/tmp` tmpfs
(`mkdtemp`), so the working tree is not mutated.

Memory gate before each launch: `MemAvailable` was 1 634 640 kB (1596 MiB) before
run 1 and 1 723 096 kB (1683 MiB) before run 2, both above the 1200 MiB floor, so
neither launch was refused.

## Run 1 — diagnostic, unit `kitunit27729235.service`

- `systemd-run` exit status: **1** (`code=exited, status=1/FAILURE`)
- node test runner: `tests 91`, `pass 88`, `fail 3`, `skipped 0`, `todo 0`,
  `duration_ms 4898.49`
- Service runtime 5.000 s, CPU time consumed 2.526 s, memory peak **64.1M**
  (swap 0B)
- 91 rather than 107 tests ran because `tests/scaffold.test.js` did not parse at
  all: its 17 tests never executed and the file counted as one failure.

### Failures, verbatim

1.

```
✖ the managed index.js acquires its tool through the kit and returns the cleanup (3.289085ms)
  AssertionError [ERR_ASSERTION]: The input was expected to not match the regular expression /__test|fault|observer|Observer|_hooks|unregister/. Input:
  [generated index.js dump elided here]
      at TestContext.<anonymous> (file:///root/dsh-ecosystem-spec/projects/dsh-plugin-kit/tests/managed-template.test.js:109:10)
```

2.

```
✖ no generated managed file invents a kit path of its own (0.779286ms)
  AssertionError [ERR_ASSERTION]: test/plugin.test.js contains an unexpected specifier: "file: path"

  false !== true

      at TestContext.<anonymous> (file:///root/dsh-ecosystem-spec/projects/dsh-plugin-kit/tests/managed-template.test.js:271:14)
```

3.

```
file:///root/dsh-ecosystem-spec/projects/dsh-plugin-kit/tests/scaffold.test.js:111
});
^

SyntaxError: Unexpected token '}'
    at compileSourceTextModule (node:internal/modules/esm/utils:319:16)
    [remaining internal frames elided here]
Node.js v24.21.0
✖ tests/scaffold.test.js (35.88176ms)
  'test failed'
```

### Diagnosis

- (1) The banned-token regex contained the bare substring `fault`, and the
  reviewed template legitimately calls `Schema.string().default('Hello')`;
  "de**fault**" matched. The assertion could never pass against the shipped
  template. Over-broad test regex, not a product defect.
- (2) The specifier extractor `file:[A-Za-z0-9._@/ +-]*` admitted spaces, so the
  generated English prose in `test/plugin.test.js` — "must be a local file: path"
  — was parsed as the specifier `"file: path"`. Valid output, malformed extractor.
- (3) `tests/scaffold.test.js` had lost a `test(...)` header: a complete body of
  `defaultToolName` assertions was left top-level between the managed-plan test
  and `renderScaffold produces a deterministic file set…`, so the file's braces
  did not balance and the module never loaded. Corrupted test file.

## Repairs (test files only)

No file under `src/` or `templates/` was touched; no assertion was removed; no
refusal was changed. Full diff of the three edits:

`tests/scaffold.test.js` — restored the missing wrapper around the orphaned body
(the only added line; `defaultToolName`, the messages and every assertion are
untouched):

```diff
 });
 
-
+test('defaultToolName derives a host-accepted tool name from the plugin id', () => {
   // The host accepts /^[A-Za-z0-9_-]{1,64}$/; this template is narrower (no
```

`tests/managed-template.test.js:109` — anchored the substring that collided with
`default`:

```diff
-  assert.doesNotMatch(code, /__test|fault|observer|Observer|_hooks|unregister/);
+  // `\bfault\b`, not bare `fault`: the reviewed template calls
+  // `Schema.string().default(...)`, and the plain substring also matches inside
+  // "default", so the unanchored form rejected valid generated code.
+  assert.doesNotMatch(code, /__test|\bfault\b|observer|Observer|_hooks|unregister/);
```

`tests/managed-template.test.js:271` — the extractor no longer swallows spaces;
a `file:` followed by path characters is still captured whole and must equal the
operator's literal exactly:

```diff
-    for (const match of content.match(/file:[A-Za-z0-9._@/ +-]*/g) ?? []) {
+    // The token class excludes whitespace: generated prose such as
+    // "must be a local file: path" is English, not a specifier, and a class that
+    // accepted spaces parsed it as `file: path` and failed on valid output. A
+    // `file:` followed by any path character is still captured in full and must
+    // equal the operator's literal (or nothing but the bare prefix).
+    for (const match of content.match(/file:[A-Za-z0-9._@/+-]*/g) ?? []) {
```

## Run 2 — final, unit `kitunit17678148.service`

- `systemd-run` exit status: **0** (`code=exited, status=0/SUCCESS`)
- node test runner: `tests 107`, `pass 107`, `fail 0`, `cancelled 0`,
  `skipped 0`, `todo 0`, `duration_ms 4926.998702`
- Service runtime 5.003 s, CPU time consumed 2.514 s, memory peak **59.6M**
  (swap 0B)
- Failures: **none**. There is no failure text to quote.

### Per-file results

Counts are the `test(` declarations in each file; each one produced a `✔` line
(`107` such lines in the log, `0` `✖` lines), and the declared total matches the
runner's 107 exactly.

| File | tests | pass | fail | skip |
|---|---|---|---|---|
| `tests/cleanup.test.js` | 21 | 21 | 0 | 0 |
| `tests/cli.test.js` | 16 | 16 | 0 | 0 |
| `tests/exports.test.js` | 5 | 5 | 0 | 0 |
| `tests/managed-registration.test.js` | 12 | 12 | 0 | 0 |
| `tests/managed-template.test.js` | 16 | 16 | 0 | 0 |
| `tests/protocol.test.js` | 15 | 15 | 0 | 0 |
| `tests/scaffold.test.js` | 17 | 17 | 0 | 0 |
| `tests/template.test.js` | 5 | 5 | 0 | 0 |
| **total** | **107** | **107** | **0** | **0** |

Notable passes for this slice: the checked-in reference copy under
`templates/host-tool-managed/` is byte-equal to `renderScaffold(plan)` file by
file; the managed template refuses a plan without `kitSpecifier` and refuses a
non-`file:` / empty / whitespace / ranged / control-character specifier; the
operator literal is preserved verbatim; `renderScaffold` and
`managedToolPackageJson` refuse a hand-built plan that bypasses the planner; the
default `host-tool` output gains no dependency and refuses the flag;
`tests/cli.test.js` scaffolds the default template and runs the generated
project's own suite against stub host packages placed in a temp directory.

## Effective limits

Both test launches received the prescribed properties. Read live from
`systemctl show` while run 2 was executing:

| Check | Observed |
|---|---|
| `RuntimeMaxUSec` | `2min` |
| `MemoryMax` | `805306368` (768M) |
| `MemorySwapMax` | `0` |
| `TasksMax` | `32` |
| `CPUQuotaPerSecUSec` | `500ms` (50 %) |

The unit's own cgroup files could not be read during the launches: the harness's
`ControlGroup` lookup returned an empty value before the unit started, and the
path defaulted to the cgroup root, so `memory.max`/`memory.swap.max`/`pids.max`/
`cpu.max` were read as empty. To verify those in-cgroup values directly, one
additional read-only probe unit (`kitprobe14353698.service`) was launched with the
**identical** property set and a payload of `/bin/sh` inside the same `bwrap`
sandbox that only reads `/sys/fs/cgroup` (no repository code ran):

```
cgroup_path=/system.slice/kitprobe14353698.service
memory.max=805306368
memory.swap.max=0
pids.max=32
cpu.max=50000 100000
```

So the effective values were `memory.max` 768 MiB, swap 0, `pids.max` 32,
`cpu.max` 50000/100000 (50 % of one CPU), runtime cap 120 s. The probe exited 0
with memory peak 3.6M. Peak memory of the two workload runs is reported by
`systemd-run` itself: 64.1M (run 1) and 59.6M (run 2), both far under the 768 MiB
cap, so no OOM or swap pressure occurred.

## What these results do not establish

- Only the unit suite ran. No CLI is exercised beyond what `tests/cli.test.js`
  spawns, no package manager resolved the recorded `file:` specifier, and the
  generated managed project's own suite
  (`templates/host-tool-managed/test/plugin.test.js`) was **never** run — it
  cannot resolve `@deepseek-ai/schemastery`, `@deepseek-ai/dsh-tools` or the kit
  in this environment, and it is deliberately excluded from the file list above.
- No host, GUI, or DSH runtime was involved; nothing was installed, built,
  fetched, committed or pushed. `git status` still reports every path untracked.
- Byte identity is asserted by a passing test, so that claim is now empirical;
  the *generated project's* behaviour in a real host remains unverified.

## Evidence ledger

| Attempt | Unit | Result | Tests (pass/fail/skip) | Exit | Peak memory | Evidence |
|---|---|---|---|---|---|---|
| 1 (diagnostic) | `kitunit27729235.service` | 3 failures (2 assertion, 1 parse error) | 91 (88/3/0) | 1 | 64.1M | `/tmp/kitunit27729235/out.log` |
| 2 (after test repairs) | `kitunit17678148.service` | PASS | 107 (107/0/0) | 0 | 59.6M | `/tmp/kitunit17678148/out.log` |
| limits probe | `kitprobe14353698.service` | read-only cgroup read, PASS | n/a | 0 | 3.6M | stdout above |

Those `/tmp` logs live in the machine's tmpfs and will not survive a reboot; the
results reproduced above are the durable record.
