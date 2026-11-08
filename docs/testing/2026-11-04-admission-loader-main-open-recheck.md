# admission-loader-main-unit — two-target recheck (RUN ONCE, 52/52, node exit 0)

**Status: RUN ONCE, 52 tests / 52 pass / 0 fail / 0 skipped / 0 todo, node exit 0,
`systemd-run` rc 0.** One GO, one invocation, no retry, no edit of any file during or
after the launch. The previous record's `48/52` stands as measured and is not revised.

The real host launcher was not run. Nothing here is realLoader evidence.

## 1. What this attempt was for

The previous launch measured `48/52`, with four failures in `main-open.test.mjs` traced
to two fixture defects: bytes "altered" by a `replace()` that matched nothing, and a
`fakeIo` whose `readFile` throws by design while `main()` reads reviewed sources through
exactly that seam. The Lead authorised code-only corrections to that one test file and
then this single recheck. `main.mjs` and both runners were not edited for it.

## 2. Envelope, as read back

| Constraint | Value |
| --- | --- |
| unit type | `Type=exec` |
| memory / swap | `memory.max=805306368`, `swap.max=0` |
| tasks | `pids.max=32` |
| cpu | `cpu.max=50000 100000` |
| runtime | `RuntimeMaxUSec` resolved `120000000` µs (`busctl` numeric returned `<unavailable>`) |
| node heap | `--max-old-space-size=384` |
| memory gate | one sample `1910240` KiB ≥ `1228800` → `acc_gate=pass` |
| sandbox | `bwrap --ro-bind / / --dev /dev --proc /proc --tmpfs /tmp --unshare-pid/net/ipc/uts --die-with-parent`, `env -i` |
| serial queue | shared `experiments/acceptance/runs/.acceptance.lock` |
| attempts | one launch, no retry |

`acc_capture_ok=yes`. The `bash -n` step ran in the unit cgroup but **outside** `bwrap`;
only the node workload ran sandboxed.

## 3. Run identity

| Field | Value |
| --- | --- |
| run id | `20261103T211111Z-admission-loader-main-unit-379061-22419` |
| unit | `admission-loader-main-unit-20261103T211111Z-379061` |
| run directory | `experiments/acceptance/admission-loader-main-unit/runs/20261103T211111Z-admission-loader-main-unit-379061-22419/` |
| service runtime / CPU | `884 ms` / `355 ms` |
| workload wall | `733 ms` |
| HEAD (read after the run) | `effb9581687f995841d872304e03627473039957`, 7 porcelain entries |
| unit state after | `LoadState=not-found`, `ActiveState=inactive`, `SubState=dead`; `admission-loader-*` list empty; no matching process |

## 4. Raw outcomes

| Field | Value |
| --- | --- |
| `systemd_run.rc` / `acc_node_rc` | `0` / `0` |
| tests / suites | `52` / `8` |
| pass / fail / cancelled / skipped / todo | `52` / `0` / `0` / `0` / `0` |
| duration | `384.87901 ms` |
| `✖` markers in `unit.log` | `0` |
| `acc_syntax_rc` (real `run.sh`, `payload.sh`) | `0`, `0` → `acc_syntax_status=pass` |
| `acc_workload_argv` | both target paths, one `node --test --test-concurrency=1` |
| `memory.peak` | `65585152` (journal `62.5M`, swap `0B`) |
| `memory.current` at exit | `32366592` |
| `pids.peak` | `16` |
| `memory.events.local` | `low 0 high 0 max 0 oom 0 oom_kill 0 oom_group_kill 0` |
| journal | `Deactivated successfully` |
| `hash_status` | `identical` (23 before, 23 after, `3397 B` each, `.err` `0 B`, no `hashes-diff.txt`) |

**Per-case titles ARE in the log — correction of an earlier claim.** An earlier draft of
this record said the spec reporter emitted "one `✔` per suite and titles only for failures",
and concluded the four previously failing cases could not be shown individually. That was
false, and the error was mine: I counted `grep -c '^✔'`, which matches only the unindented
describe lines, while per-case results are indented two spaces. The raw `unit.log` carries
every case. In `checkSourceReview: the pin is compared over real bytes` (`:37`):
`:38` accepts matching bytes, `:39` no-encoding read, **`:40` `✔ refuses bytes that do not
match the recorded digest`** — failure 1 of four, now passing — `:41`-`:46` unreadable,
non-bytes, raw-byte hashing, decode-for-anchors, `:45`-`:46` missing/reordered anchors,
`:47` null digest as pending, `:48` string seam, `:49` group line. In `main: the gate is
open, and the loop is reached exactly once` (`:55`): **`:56` `✔ calls the loop once with the
trusted flag raised…`**, `:57` drift before the loop, `:58` write fault ahead of a refusal,
**`:59` `✔ lets a later artifact write fault dominate a successful loop`**, **`:60`
`✔ refuses a pending pin (null digest) before the loop, even with a clean tree`**, `:61`
no-mutation, `:62` group line. `the recorded pin as it actually stands` is `:50`-`:54`.
All four failures of the 48/52 run appear individually as `✔` here.

What a title still cannot carry is a cause: that these four turned green *because* the
fixtures were corrected is attribution, not an observation.

**How far this evidence reaches.** `52/52` is accepted as unit evidence over the current
selected bytes. It is **not** an unchanged-runner comparison: as §5 records, one runner file
also differed across the two runs, so this attempt cannot be read as "the same harness,
different test file".

## 5. Hash comparison with the 48/52 run

Same 23-file selected set. `diff` of the two `hashes-before.txt` files:

    tests/main-open.test.mjs   722bd247…f3f25f0 → 8e7e1a4f…4777c895b   (expected)
    admission-loader-main-unit/payload.sh   0384e81b…b85fe5f → c67aa1a2…3a2d12e   (NOT expected)

The first line is the authorised fixture correction. **The second is a finding, and is
not explained away:** the Lead's instruction for this attempt was an unchanged runner,
and `payload.sh` is part of the runner. Its only edit between the two runs was the
`STATUS:` comment block at lines 4–7, which I rewrote after the 48/52 run to point at that
record. That attribution is from my edit log, **not** proven by the hash pair: no stored
copy of the earlier bytes exists, so I can show that the file differs and can describe the
edit I made, but I cannot demonstrate byte-identity for the remainder from the evidence in
this run directory. Executable lines were not knowingly touched; that is a claim about my
own edit, not a verified fact.

Everything else in the set — including `main.mjs`, `run.sh`, `payload.sh` of the real
slice, and `main.test.mjs` — is byte-identical between the two runs.

## 6. What this record will not claim

- **Not a capability.** It re-measures a caller's unit tests over injected doubles. No
  Loader was booted; no host, fiber, plugin runtime or browser was involved.
- **Not a revision of 48/52.** That record keeps its own measured numbers; this one
  reports a later attempt over a changed test file.
- **Not a proof the four fixes were the cause.** The corrected file is the only expected
  input change, and the count moved to `52/52`; that is correlation in one direction, and
  it cannot exclude an unlisted input or an environmental factor.
- **Not closure.** 23 selected hashes are a witness over identified inputs. sha256 shows
  bytes matched at two sampled moments; it is not provenance and says nothing about who
  produced them.
- **Not an unchanged-runner comparison.** As recorded in §5, `payload.sh` also differed
  from the prior run by a comment block, and no prior snapshot exists to prove that the
  difference was limited to that comment. The envelope, gate and node invocation read back
  here were the ones this payload produced; "same harness, different test file" is not a
  claim this pair supports. `52/52` is unit evidence over the **current selected bytes**,
  which is what the Lead accepted it as.
- **Not a certification.** Nothing here certifies the admission-evidence protocol.

## 7. Gate

The GO is spent: one launch, no retry, no in-run edit. A further attempt needs a new GO
and a new record.
