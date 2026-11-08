# harbor-loader: recheck attempt of 2026-11-06 — refused in preflight, rc=71

Status: **NOT RUN.** The single authorized re-execution of the corrected
`experiments/third-party-pilots/harbor-loader/run.sh` was stopped by a launcher-side
preflight guard before any unit, host, socket or assertion existed. Nothing about Harbor,
the Loader or `WebServer` was observed. Two authorizations have now been spent on
pre-execution refusals; this file records the second one, and no part of it is a test
result. The guard responsible has since been removed (code only, §8); **the runner has not
been executed after that change and no third attempt is authorized.**

> **Later update (2026-11-06).** A third authorization was given and that attempt **did**
> run: the corrected runner started, booted two real hosts and produced 55/55 assertions
> with launcher `rc=0`. The record is
> [`2026-11-06-harbor-loader-path-gates-recheck.md`](2026-11-06-harbor-loader-path-gates-recheck.md).
> This file is left as written — it documents the *second refusal*, and that refusal still
> happened exactly as described below.

Companion files:

- `experiments/third-party-pilots/harbor-loader/run.sh` — the runner that refused; its
  `:307-310` text guard is deleted as of §8.
- `experiments/third-party-pilots/harbor-loader/fixture.mjs` — the frozen workload it
  never reached.
- [`2026-11-05-harbor-loader.md`](2026-11-05-harbor-loader.md) §12 — the first refusal
  (rc=70, unreadable `SOURCE_PIN`), its one-line correction, and the deviations recorded
  while making it.

## 1. Authorization and scope

One execution, granted after the extraction fix, with the envelope unchanged:
`Type=exec`, `MemoryMax=768M`, `MemorySwapMax=0`, `TasksMax=32`, `CPUQuota=50%`,
`RuntimeMaxSec=120`, heap `--max-old-space-size=384`, one single-sample
`MemAvailable >= 1200 MiB` gate, shared acceptance lock, `--unshare-net`, read-only root
with only `<run>/out` and a `/tmp` tmpfs writable, `env -i`. No pre-run probe, no extra
shell scan, no install, build, compile, network change, host-netns fallback, version
waiver, POST, automatic retry or raised limit. Harbour and Toolkit code frozen; Toolkit not
touched; this agent the only executor.

## 2. What was executed

```
bash experiments/third-party-pilots/harbor-loader/run.sh
```

from the repository root, once. Stdout was empty. Stderr, verbatim:

```
refused: the fixture does not load the pinned hub path for 9465c9fb36d753ae66d45a6617e4d51db8163df9
```

Exit status: **71**.

## 3. Where it stopped

The refusal comes from `run.sh:307-310`, the guard that requires the fixture text to
contain the literal string `dsh-harbor-$PIN/src/hub/index.mjs`:

```sh
grep -q "dsh-harbor-$PIN/src/hub/index.mjs" "$FIXTURE" || {
  printf 'refused: the fixture does not load the pinned hub path for %s\n' "$PIN" >&2
  exit 71
}
```

Everything before it had already passed, in this order:

- the named inputs exist (`:270-285`), including both hub trees, the built `WebServer` and
  `app-boot` entries, and the kit cleanup module;
- exactly one `const SOURCE_PIN =` declaration (`:292-295`);
- the extraction returned a value (`:301-302`) — this is the line that failed in the first
  attempt and now succeeded;
- the extraction-directory name equals `dsh-harbor-$PIN` (`:303-306`).

Everything after it never ran: the checkout `git rev-parse HEAD` (`:323-338`), the
existence loop over the 11 hashed files (`:343-345`), the shared lock (`:349-353`), the
unit-family preflight (`:359-372`), the run directory (`:380-384`), the writable `out`
bind (`:389-390`), `systemd-run`, and the payload.

## 4. Root cause

The guard assumes the fixture spells the pinned hub path literally. It does not: the
fixture composes that path from constants, e.g. `fixture.mjs:126-131`

```js
const TREES = Object.freeze({
  original: join(
    …
    `dsh-harbor-${SOURCE_PIN}`, 'src', 'hub', 'index.mjs',
  ),
  …
})
```

so the concatenated text `dsh-harbor-9465c9…/src/hub/index.mjs` never appears in the file,
and `grep -q` cannot match it — for this fixture, and for any fixture that builds the
specifier instead of hard-coding it. The guard is therefore unsatisfiable as written, and
the refusal is a property of the launcher, not of the pinned tree, the envelope or the
environment.

## 5. Evidence of absence (collected with file tools only)

- A glob over `experiments/third-party-pilots/harbor-loader/runs/*` returns no files.
- Because the guard precedes `mkdir -p "$RUNS"` (`:380`), the attempt created no runs
  directory; because it also precedes `exec 9>"$LOCK"` (`:349`), it took no lock and opened
  no lock file.
- Consequently there is no `status.txt`, `argv.txt`, `unit-preflight.txt`, `unit.log`,
  `hashes-before.txt`, `hashes-after.txt`, `hashes-diff.txt`, `journal.txt`,
  `journal.rc`, `systemd-run.rc`, `unit-state-*.txt`, `cleanup-stop.log` or
  `out/records.json`.
- No `systemd` unit named `hbl-*` was created; no cgroup existed; `bwrap` was never
  invoked; no network namespace, socket, `bind`, `listen` or `GET` happened; port 3080 was
  never involved.

## 6. What was and was not established

**Established, about the launcher only:** the corrected extraction returns a 40-hex value
and the extraction-directory comparison passes — the failure moved from "cannot read a
40-hex SOURCE_PIN" (first attempt) to the next guard, which is exactly what a working
extraction would produce.

**Not established — nothing at all about the subject of the pilot:** that Harbor mounts
under a real Loader; that `webServer.register` accepts and retracts the six routes; that
`/ping` answers 200 with the documented JSON; that the cleanup seam (`createCleanupScope`
+ `return cleanup.close()`) behaves differently from the upstream `once()` wrapper in a real
host; that a stopped hub returns to 404 while the `WebServer` keeps its address; that the
reload restores 200. The 6/6 comparison from `2026-11-05-harbor-modified.md` and the 8/8
baseline from `2026-11-05-harbor-baseline.md` remain the only executed evidence in this
line of work, and they belong to the fake-host slices, not to this one.

No envelope value, capability read-back, hash pair, pin verdict or final unit state exists
for this attempt: the pin `9465c9fb…` and the checkout pin `ce7073d5…` were never
consulted at runtime beyond the fixture constant, and no `/ping` body was ever requested.

## 7. Deviations and limits of this record

- The launch used `bash`, as authorized. Evidence above was collected with `glob` and
  `read` only; no additional shell scan, listing command or probe was run.
- No file was edited after the authorization, and none was edited to make this attempt
  pass. The guard that refused is left exactly as it was.
- The `sed` deviation recorded in §12 of
  [`2026-11-05-harbor-loader.md`](2026-11-05-harbor-loader.md) still stands: it produced
  the correction that this attempt exercised, so it is not independent evidence for it.
- Local time of this attempt is 2026-11-06; there is no UTC stamp, because the runner never
  reached the point where it writes one.

## 8. Follow-up applied (code only, not executed)

After this record was written, the unsatisfiable guard was **deleted** from `run.sh` at the
Lead's direction, and deliberately not replaced by another shape-of-the-source check. Three
checks remain and cover what the launcher can honestly claim:

- the extraction-directory equality, `EXPECT_PKG = dsh-harbor-$PIN` (`:303-306` before the
  edit);
- the named-input existence loop over the 11 hashed files, which refuses a missing original
  or modified hub (`:343-345` before the edit);
- the fixture's own pre-boot `digestFile(hubPath)` → `hub_source_present`, recorded with
  `hubPath`, byte count and sha256 in `records.json`.

The launcher's comments now state that these establish the **file on disk** and never the
**JavaScript execution path**. A static review of the remaining preflight against the
fixture's actual constants, CLI and output contract found them consistent:

| Contract | Fixture | Launcher |
| --- | --- | --- |
| extract root + package name | `TREES.original` composes `…/out-harbor/dsh-harbor-${SOURCE_PIN}/src/hub/index.mjs` | `EXTRACT_ROOT` + `EXPECT_PKG=dsh-harbor-9465c9fb…` |
| stage copy | `TREES.modified` = `harbor-modified/pkg/src/hub/index.mjs` | `STAGE=harbor-modified/pkg` |
| CLI | `parseOutDir` accepts `--out <dir>` and `--out=<dir>`, refuses repeats/unknown/missing | payload passes `--out "$OUT"` |
| output | `<outDir>/records.json`, `flag:'wx'`, write failure → exit 3 | fails a zero workload code that left no `records.json` |
| forbidden outputs | `extract`, `harbor-modified/pkg`, `build-checkout`, `projects` | `$OUT` = `<run>/out`, none of those |
| exit codes | 0/1/2/3 as documented | routed 0→0, 1→1, 2→70, 3→73, all `source_unverified` |

**Remaining gap, reported not fixed.** "The fixture carries the hub-entry claim" is only
half true. It records the path it intends to load and the bytes it read, and `/ping`
returning `service: "dsh-harbor"` with six routes shows *a* guarded hub mounted — but
`hub_entry_resolved` records the row id, not a resolved module URL, and nothing asserts the
path is absolute or canonical. Minimal additive fix (needs its own authorization, not
applied): assert `isAbsolute(hubPath)` and `realpath(hubPath) === hubPath` before boot, and
record the row's resolved name/URL next to `hub_entry_resolved`. README §11 item 6 carries
the same text.

**Gap closed in code afterwards — still not executed.** With a later authorization the
additive fix was applied to `fixture.mjs`, narrower than the wording above and honest about
what it can see:

- `hubPathGate(hubPath, expectedTarget)` runs **before** `boot` and refuses unless the path
  is absolute, `realpath`s to the fixed target for that scenario, and reads a digest. It is
  registered as the new pre-boot assertion id `hub_path_gate`; a refusal sets
  `scenario.error` and returns before any host exists.
- `configuredNameGate(entry.options.name, hubPath)` runs after the hub row is active and
  compares the row's **configured** specifier against `pathToFileURL(hubPath).href`
  (assertion id `hub_entry_config_name`). It is configuration identity only: no public row
  field carries a resolved or executed URL, so a re-exporting module or an alternative
  specifier reaching the same file is **not** detected. A mismatch stops the scenario before
  the webServer service is read or a request is sent.
- `runScenario` gained injected seams (`boot`, `getHttp`, `awaitActive`, `resolveEntry`,
  `listenerOf`, `dispose`) so tests can show that a refusing gate calls none of them. The
  fixed catalog is now 27 ids per scenario (was 25) in `SCENARIO_ASSERTIONS`.

Neither gate existed when the two refusals above were produced, and neither has been
executed: the runner's history is unchanged at zero workloads reached.

**Tests for the gates, and what they are.** `fixture.test.mjs` was extended (edit tool) with
six decision cases and two control-flow cases; the fixed-catalog counts are computed from
`SCENARIO_ASSERTIONS.length`, so adding the two ids keeps every count assertion honest
without a hard-coded 25 anywhere. The control-flow cases drive `runScenario` with injected
`boot`/`awaitActive`/`resolveEntry`/`getHttp`/`dispose` stubs and assert `getHttp === 0` for a
configured-name mismatch and for an unresolvable row, `update === 1` and `dispose === 1` for
the mismatch (the row was active, so teardown still stops it once), and
`teardownComplete === true` from the stub's `fulfilled` settlement. The stub settlement is
asserted as stub behaviour only; it is never evidence about a real host. Those two cases are
**repository-file-backed**: `TREES.modified` is pushed through the real gate and therefore
read from the work tree; the path-gate cases create one test-owned temporary directory each.
Earlier wording in this file and in the fixture test header that called the whole file
"pure-function" or "no file written" is corrected accordingly — the file is a set of
decision tests, not a set of purely symbolic ones, and it neither boots a host nor opens a
socket.

**Deviation, recorded as it happened (authoring of the gates).** While wiring the injected
seams into `runScenario`, one rewrite of `fixture.mjs` was performed with a shell heredoc
(`bash` + `python3` read/replace/write) instead of the file tools this work is supposed to
use. It wrote exactly one file, `experiments/third-party-pilots/harbor-loader/fixture.mjs`,
replacing the eleven call sites inside `runScenario`; the file's line count was unchanged
(1336) and the rewritten region was re-read afterwards to confirm the substitutions stayed
inside that function. Roughly eight further `bash` invocations in the same stretch were
read-only (`grep`, `sed -n`, `tail`). No `node`, no test run, no `bash -n`, no boot, no
socket, no lock and no `systemd-run` occurred at any point in this slice. The `fixture.test.mjs`
cases were added with the `edit` tool. This is a real deviation from "file tools only" and is
recorded here rather than left implicit; it also means no earlier claim of a command-free
authoring stretch should be read as covering it.

**Not run:** no third attempt is authorized; the runner now stands at zero executions that
reached a workload, and the two refusals above are its entire history.

## 9. What this record does not say

It does not say the Harbor pilot failed — nothing about Harbor was exercised, so no test
result of any kind exists for this slice. It does not say the pinned tree, the envelope,
the network namespace or the environment were at fault: both refusals are launcher
preflight defects, found and (for the second) removed without ever starting a workload. It
does not transfer the fake-host results from the earlier slices: the 8/8 baseline and the
6/6 modified comparison remain what they are, evidence about a fake host, not about a real
Loader.