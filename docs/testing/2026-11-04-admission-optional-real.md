# Admission optional real-Loader acceptance — all-8 opt-in

**Status: RUN ONCE — ACCEPTED, 8 cases / 37 (case, assertion) pairs.** Run
`20261104T151523Z-admission-loader-real-406112-8304`, unit
`admission-loader-real-20261104T151523Z-406112`, `CASE_SET=all-8`. The four-required
history (`2026-11-04-admission-loader-real-recheck-2.md`, 4 cases / 22 pairs) and the
two failed attempts (exit 14, exit 15) are preserved unchanged and are not corrected,
superseded or reinterpreted here.

## 1. Why this entry exists

The real-Loader slice measured the **four required** cases. The canonical catalog has
**eight**. The optional four were implemented and unit-measured at 188/188/0
(`2026-11-04-admission-optional-unit-recheck-3.md`) but had never been asked of a real
host. This entry adds one closed opt-in, `--case-set all-8`, so a real run can request
the whole catalog while an invocation that names nothing still measures `required-4`.

## 2. Invocation, verbatim

```
CASE_SET=all-8 bash experiments/acceptance/admission-loader-real/run.sh
```

Recorded in the run: `status.txt` `case_set=all-8`; `argv.txt` `case_set=all-8`;
unit log `acc_case_set=all-8`, `acc_case_set_forwarded=all-8`, and the workload argv

```
node .../main.mjs --out .../runs/20261104T151523Z-.../out --case-set all-8
```

so the value travelled as an explicit argument into the one `node` invocation, not
through the environment (`env -i` clears it there).

## 3. Gates before the workload

| gate | measured |
|---|---|
| argv / case set | `all-8` accepted; closed pair, validated before lock |
| source review | `source-review.json` 778 B, `pending` false, digests match the pin |
| pin | `pinned_commit=ce7073d51254c26cd63b22a60835b8f948deb447`; checkout clean (0 porcelain lines) |
| pending refusal | not taken — the review was recorded |
| drift | not taken — hashes matched before and after |
| loop refused / not accepted / teardown | none — `accepted: true`, `refusal: null` |

## 4. Envelope, resources, outcome

`systemd_run_rc=0`, `acceptance_exit=0`, `acc_node_rc=0`, `hash_status=identical`
(21 hashed files before and after, `cmp` equal). Caps read back: `805306368` / swap `0`
/ pids `32` / `50000 100000` / `Type=exec` / `RuntimeMaxSec=2min` (numeric via `busctl`
`<unavailable>`, resolved `120000000`); `acc_capture_ok=yes`; heap cap 384 MiB; bwrap
read-only root with a single writable bind to the run's `out`. Gate
`1663128 ≥ 1228800` KiB `pass` (one sample). Peak `200499200` (journal `191.2M`, swap
`0B`), current final `86315008`, pids peak `15/32`, workload wall `5420 ms`, CPU
`2.085 s`. The systemd journal shows no unit failure, but the **workload emitted a
warning**: `unit.log:32` reads `dsh: warning: 20 entries did not activate`, followed by
twenty `pending (waiting for service: …)` lines — `fs`, `workingDirectory`,
`headlessStartup`, `sandboxPolicy`, `shell`, and their dependants. Those entries are
outside this fixture's deliberately narrow plugin set and were never meant to run in it;
the count is a property of that set, not a defect signature. After the unit: `not-found`
/ `inactive` / `dead`, zero active `admission-*` rows.

Artifacts in `out/`: `source-review.json` 778 B, `observation.json` 36572 B,
`derived-document.json` 7173 B, `diagnostics.json` 4601 B, `raw-outcome.json` 2665 B.
`raw-outcome.json` reports `caseSet: {requested: "all-8", reported: "all-8"}`,
`accepted: true`, `artifactWriteFailures: []`.

## 5. The eight cases

| case | expected | reported | pairs |
|---|---|---|---|
| `admission-admitted` | passed | passed | 7 |
| `admission-refused-conflict` | refused | **refused** | 5 |
| `admission-activation-throw` | passed | passed | 5 |
| `admission-cleanup-failure` | passed | passed | 5 |
| `admission-lease-state` | passed | passed | 4 |
| `admission-tuple-shape` | passed | passed | 7 |
| `admission-remount-same-coordinator` | passed | passed | 2 |
| `admission-visibility` | passed | passed | 2 |

**37 pairs total**, every assertion `allPassed: true`, `failures: []`. The one
`refused` case is the negative control and is the *expected* outcome: the contender was
rejected before any of its own code ran. It is not a failure of the run.

## 6. Document and diagnostics

Document published (`present: true`), schema `admission-evidence/0.1-draft.1`, baseline
`{commit: ce7073d5…, node: v24.21.0}`, coordination
`{coordinatorIdentity: "observed-identical", provisioning: "not-determined",
scopeVisibility: "not-determined"}`, 10 limitations, the same eight cases and 37 pairs.

Diagnostics published: `valid: true`, `certification: false`, `issues: []`, one finding
`ADMISSION_CASE_REFUSED` (the expected refusal, carrying its explanation). Coverage —
`required` four, `present` eight, **`unknown` empty**. The empty `unknown` is only
meaningful because eight cases are actually in the document; it is read from the
published document, not assumed.

## 7. Cleanup, as observed

Read from `observation.json` `lifecycle` — observations, not inference:

- participant: first mount `active`, first unload `disposed`, second mount `active`,
  final unload `disposed`, all settled, no `updateError`.
- owned leases: 7, every one `released: true`, each with its own probe result.
- probe leases: 6, every one `released: true`, `verifiedByProbe: true`.
- `retainedQuarantines: ["releaseQuarantined"]` — the quarantine was **retained and
  named**, not silently released. Retaining it is the observed fixture behaviour, and
  the record treats "named retention" as distinct from "released"; neither is a claim
  about the host's global quarantine state.
- coordinator unload `{settled: true, stateName: "disposed", updateError: null}`; fiber
  `fulfilled`; cleanup `drained` with all four required cases finished, none skipped,
  none threw; teardown `fulfilled`.
- remount identity: first and second captures both `applied` via `ctx.get`,
  `firstSameAsProvider` and `secondSameAsProvider` true, `sameAcrossBoundary` true,
  `comparisonTaken` true. Lease and tuple limitations were both empty.

## 8. Selected-hash caveat, stated before and after

The 21 hashed files are a **selected witness over identified inputs, not a closure**.
Two equal manifests prove those bytes matched at two sampled moments; they say nothing
about unlisted inputs, provenance, or why an outcome moved. HEAD identifies the tracked
tree only — these `experiments/` sources are untracked, so HEAD is not their version,
and the run's own digest for `main.mjs` identifies the bytes that ran rather than the
file now on disk.

## 9. What this record does not claim

**Not a warning-free run.** The workload printed `dsh: warning: 20 entries did not
activate` with twenty pending service waiters (`unit.log:32-41`). It is disclosed above
rather than summarised away, and it must not be reported later as "no warnings". The
warning describes the fixture's plugin set in this process; it says nothing about any
other host, installation or plugin set, and it is not evidence of a healthy or unhealthy
machine either way.

Not a certification (`certification: false`). Not global host health: a green all-8 run
says these eight cases reported their expected statuses in this one process, on this one
host, in this one Loader — not that other plugins, hosts or later runs behave the same.
Not that the optional four became required: they are reported because this run asked for
them. Not that the earlier exit 14 / exit 15 failures were really passes. Not that the
fixture's synthetic cleanup failure is a real kit teardown bug — the run proves it
observes a failing cleanup, not that one exists.

## 10. Disposition

One authorised attempt, spent. No retry, no second launch, no limit change, no code
edit before or during the launch. Five run directories now exist for this slice and all
are retained, including the two failed attempts.
