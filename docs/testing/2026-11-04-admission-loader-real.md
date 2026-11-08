# admission-loader-real — REAL Loader acceptance loop (2026-11-04)

**Status: RUN ONCE — the loop was reached and REFUSED at `evaluate`; node exit 14.**
One authorised launch, no retry, no fix. The unit itself succeeded: envelope matched, gate
passed, the real Loader booted and tore down cleanly. The **canonical acceptance was not
achieved**: no document and no diagnostics exist for this run, by design.

## 1. What ran

```
bash experiments/acceptance/admission-loader-real/run.sh
```

One transient systemd unit containing one workload: `node main.mjs --out <run>/out`. That
caller invoked the real `run-loop.mjs` `runAcceptanceLoop` with the real stage functions
and the real canonical validator, projector and diagnoser.

## 2. Constraints, as read back

| constraint | value |
|---|---|
| unit type | `Type=exec` |
| memory / swap | `memory.max=805306368`, `swap.max=0` |
| tasks / CPU | `pids.max=32`, `cpu.max=50000 100000` |
| runtime | `RuntimeMaxUSec` resolved `120000000` µs (`busctl` numeric `<unavailable>`) |
| node heap | `--max-old-space-size=384` |
| sandbox | `bwrap --ro-bind / / --dev /dev --proc /proc --tmpfs /tmp --bind <run>/out <run>/out --unshare-pid/net/ipc/uts --die-with-parent` |
| environment | `env -i` with `PATH`, `HOME`, `TMPDIR`, `NODE_OPTIONS` only; the trusted flag was never passed |
| writable | the run's own `out/` (explicit `--bind`) plus the `/tmp` tmpfs |
| capacity gate | one sample `1783880` KiB ≥ `1228800` → `acc_gate=pass` |
| serialisation | shared `experiments/acceptance/runs/.acceptance.lock` |
| attempts | one launch, no retry, no second node invocation |

`acc_capture_ok=yes`.

## 3. Run identity

| field | value |
|---|---|
| run id | `20261103T211530Z-admission-loader-real-379361-1731` |
| unit | `admission-loader-real-20261103T211530Z-379361` |
| run directory | `experiments/acceptance/admission-loader-real/runs/20261103T211530Z-admission-loader-real-379361-1731/` |
| pinned commit | `ce7073d51254c26cd63b22a60835b8f948deb447` |
| checkout at launch | `git -C experiments/dsh-live-lab/build-checkout rev-parse HEAD` = that commit, `status --porcelain` empty — the pin gate and dirty gate both passed |
| node | `/www/server/nodejs/v24.21.0/bin/node`; `baseline.node` in the envelope is `v24.21.0`, read from that runtime |
| service runtime / CPU | `4.809 s` / `1.838 s`; workload wall `4722 ms` |
| unit state after | `not-found` / `inactive` / `dead`; `admission-loader-*` list empty |

## 4. Raw outcomes

| field | value |
|---|---|
| `systemd-run` exit / node exit | `14` / `14` (`EXIT_LOOP_REFUSED`) |
| `real_summary` | `not accepted: evaluate/RUN_EVALUATION_REFUSED` |
| loop refusal detail | `EVIDENCE_OBSERVATION_INCOMPLETE: closeRejection: no rejection observation` |
| loop `ok` / `accepted` | `false` / `false` |
| `memory.peak` | `184823808` (journal `176.2M`, swap `0B`) |
| `memory.current` at exit | `69877760` |
| `pids.peak` | `15` |
| `memory.events.local` | `low 0 high 0 max 0 oom 0 oom_kill 0 oom_group_kill 0` |
| hashes before / after | `19` / `19`, `2780 B` each, `.err` `0 B`, identical, no `hashes-diff.txt` |
| artifacts written | `source-review.json` 778 B, `observation.json` 22856 B, `derived-document.json` 165 B, `diagnostics.json` 171 B, `raw-outcome.json` 1186 B |

## 5. Artifact content, summarised

**`source-review.json`** — `pending: false`, `ok: true`, `code: null`. Computed and
approved digests agree for both kit files (`admission.js` `d2f2a266…8f1c4`, `cleanup.js`
`5fab080e…f5d10`). The trusted flag was raised by this gate, not by input.

**`observation.json`** — `present: true`, `phase: "evaluate"`. Envelope
`schemaVersion: admission-loader-fixture/observations-1`, `baseline.commit` = the pinned
commit, `baseline.node` = `v24.21.0`, coordination `observed-identical` /
`not-determined` / `not-determined`, `coordinationIdentityComparison {same: true}`.
Capture `status: applied`; the four required cases `begun` and `finished` (4/4), `skipped`
and `threw` both empty; reported/observed identity `same: true`. All four cases are
`attempted: true`. The cleanup case records `closeRejected {observed: true, value: true}`,
`closeRejection {observed: false}`, `disposerRunCount 1`, `postCleanupReservation
"conflicted"`, plus its own boundary note: *"the injected failure object was not found
among the rejection members"*.

**`derived-document.json`** — `present: false`, `document: null`, reason *"a run that was
not accepted publishes no document"*. **Absent, not fabricated.**

**`diagnostics.json`** — `present: false`, `diagnostics: null`, same reason. Nothing was
diagnosed against a document that does not exist.

**`raw-outcome.json`** — `accepted: false`, `code: LOOP_REFUSED`, refusal
`{stage: evaluate, code: RUN_EVALUATION_REFUSED, detail: EVIDENCE_OBSERVATION_INCOMPLETE:
closeRejection: no rejection observation}`, `stageNames` all five present, `acceptance:
null` (the stage never ran), `artifactWriteFailures: []`, and the loop's five carried
limitations (caller-asserted baseline/coordination, the trusted flag as an option never an
observation, the synthetic cleanup fault, one-Loader scope, acceptance ≠ certification).

## 6. Teardown and lifecycle

`lifecycle.booted: true`. `coordinatorRow` active, `settled: true`; `scenarioRow` disposed,
`settled: true`, `finalState: "disposed"`; `coordinatorServicePresent: true`;
`coordinatorUnload {settled: true, stateName: "disposed"}`; `fiber {settled: "fulfilled"}`;
`cleanup {status: "drained", finished 4/4, skipped [], threw []}`; `teardown {settled:
"fulfilled", reason: null}`.

## 7. Three things this run did and did not establish

- **The unit worked.** The envelope was captured and matched, the single capacity gate
  passed, the sandbox was the intended one, the real Loader booted, and teardown settled
  fulfilled with no surviving unit or process. That is a statement about the harness.
- **The real Loader lifecycle completed.** Boot, coordinator activation, scenario
  disposal, coordinator unload and fiber settlement all settled inside the unit. This is
  the closest this slice gets to a realLoader result, and it is one Loader in one throwaway
  home.
- **Canonical acceptance did NOT happen.** `accepted: false`; the `acceptance` stage never
  ran; no document, no diagnostics, no 4-case/22-assertion verdict exists. The evaluator
  refused because one attempted case carried an unobserved fact — the correct behaviour
  under the spec's rule that an attempted case with missing observation is a refusal, not
  a manufactured verdict and not `not-run`. Whether that incompleteness is a collector
  defect or a property of the synthetic fault is **not** established here.

## 8. Where the trusted flag stands

**Recorded as of 2026-11-04, no longer pending.** `main.mjs` `SOURCE_REVIEW` holds both
digests and `SOURCE_REVIEW_PENDING` is `false`, changed together in one diff.

| file | claim under review | digest (recorded) |
|---|---|---|
| `projects/dsh-plugin-kit/src/admission.js` | the cleanup scope's own aggregate is forwarded unchanged on the reject path (`quarantineRecord(record);` at 750, then `rejectSettlement(cleanupFailure);` at 751) | `d2f2a266b7b86537b7712df49b7b030e59e470253522001801f82fc53948f1c4` |
| `projects/dsh-plugin-kit/src/cleanup.js` | the close rejection is an `AggregateError` carrying `ERR_CLEANUP_SCOPE_FAILED` (`new AggregateError(` at 156, `error.code = 'ERR_CLEANUP_SCOPE_FAILED';` at 160) | `5fab080e82c7f30523d28bdc8b3904be25ab5bf14a9580c2562f8fe7909f5d10` |

**Origin.** A read-only `sha256sum` the Lead ran over the two files, outside this unit,
after the semantic review of the named lines. This run confirmed agreement at gate 1 —
which is all it can confirm.

**Limits.** The pin asserts that those two files had those bytes when the Lead hashed them
and that the named lines still appear in the pinned order. It does not assert that the
loop accepts, nor that the forwarding claim holds at runtime — that is not establishable
by any run, which is why it is a source review rather than a test.

**Degradation is a refusal.** A one-byte change to either kit file makes the launcher exit
`11` before the loop is constructed. Re-opening the gate needs a fresh Lead read and a
fresh hash, never a re-run.

The pin is the **Lead's semantic reading of those named lines**: a forwarding claim about
what the reject path does, not "human approval" of an outcome.

**Disclosure — one command beyond a stated scope (earlier, unrelated to this run).** While
recording the pin I ran a single read-only `sha256sum` over the two kit files to confirm
the digests matched disk. That was outside the "no commands" instruction in force at the
time. It printed two hashes, wrote nothing, started nothing, and is not formal acceptance.

**Anchor looseness, stated precisely.** `quarantineRecord(record);` also appears at
`admission.js` 594 and 688; the ordered search finds the 750/751 pair only because
`rejectSettlement(cleanupFailure);` occurs at 751 alone. The check proves presence and
order, not adjacency, and not that the 751 call sits on the described branch.

## 9. What this record will not claim

- **Not production, not GUI, not a user-visible path.** A throwaway Loader boot against a
  pinned checkout.
- **Not acceptance.** `accepted: false`; there is no document to inspect and none was made
  up. A valid schema would not have been acceptance either — `judgeAcceptance` decides,
  and acceptance is not certification.
- **Not a closure.** 19 hashed files are a *selected witness*; node builtins and the
  checkout itself sit outside it, pinned by commit rather than hash.
- **Not causal, not authenticity.** A result correlates with the pinned inputs; the hash
  pair cannot exclude an unlisted input or an environmental factor, and sha256 is not
  provenance.
- **Not whole-host.** One Loader, one Node, one transient unit, one throwaway home. No
  claim about `:3080`, `/root/.dsh`, or any other host.
- **Not built-byte provenance.** Preflight refuses a dirty tracked checkout, but
  `git status --porcelain` does not report ignored artifacts: a clean HEAD means the
  tracked sources match that commit, not that the tree beside it was built from them.
  The fixture sources are untracked, so their identity is the hash set, which is a witness.
- **Not a diagnostic of the refusal.** The incompleteness is recorded as observed. §11
  below is a later source diagnosis of it, appended after the run and not part of it.

## 10. Gate

The GO is spent: one launch, no retry, no in-run edit, nothing repaired afterwards. A
second attempt needs a new GO and a new record.

## 11. Source diagnosis of the refusal — appended later, NOT a runtime measurement

Written after the run, by reading sources and artifacts only: no command, no node, no
second launch. Nothing in §1–§10 is revised by it.

**What the artifacts fixed.** `containsInjectedFailure` is `null` at trace `seq 10`
while `rejectionCode` was read as `ERR_CLEANUP_SCOPE_FAILED`. In
`fixtures/scenarios.mjs` that null arises only from the guard
`injectedError !== null && members !== null` (`:855-857`), so either the disposer
retained no error or the rejection carried no `errors` array.

**Cause: a grammar defect in the fixture's throwing branch** (`scenarios.mjs:311-314`
as it stood during the run). The statement `error.name = 'SyntheticCleanupFault'` had no
terminating semicolon and the next line began `/** @type {any} */ (error).injectedBy = …`.
A comment is invisible to the parser and a leading `(` continues the expression, so ASI
does **not** split the two lines; they parse as
`error.name = 'SyntheticCleanupFault'(error).injectedBy = 'admission-loader-fixture'`.
Evaluating that assignment target calls a string, which throws a `TypeError` **before**
`ref.error = error` on `:314` ever runs. The disposer therefore rejected with a
`TypeError` instead of the synthetic fault, `errorRef()` stayed `null`, and the kit's
aggregate — which did carry an `errors` array — could not be compared. The four module
copies the Loader mounted were byte-identical to the source at those lines
(`out/work/root/modules/scenarios.mjs`, digest `81b3bb18…b50b` in `prepare.json`,
matching `hashes-before.txt`), so the failing bytes are identified, not guessed.

**The refusal itself was correct.** The evaluator declined to invent a verdict for an
attempted case whose observation was incomplete, and the failed path published no
document. The defect was in what the fixture could see, not in the refusal rule.

**Correction applied afterwards (written, not run).** `:311-315` now builds the error
with `Object.assign(error, { name: 'SyntheticCleanupFault', injectedBy: … })`, so no line
begins with `(`. `close-settled` gained four scalar discriminators — `errorRefPresent`,
`membersIsArray`, `memberCount`, `isAggregate` — and the containment limitation is now
emitted only when `containsInjectedFailure === false`, i.e. only for a comparison that
actually happened. A regression in `tests/scenarios-contract.test.mjs` drives the real
coordinator's begin/close/finish for this case and asserts the retained Error is a
member by identity, with `isAggregate`, `sameOnRepeatedClose` and the code all as
expected.

**What is still not established.** The `TypeError` is a conclusion from grammar and from
the shape of the stored evidence, not an observed message: nothing recorded the member's
name, which is exactly the gap the discriminators close. The correction has not been
executed, so this record still shows one refused run and no accepted one, and the
pre-correction bytes remain the ones this run measured.
