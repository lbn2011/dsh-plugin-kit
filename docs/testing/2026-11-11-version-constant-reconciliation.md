# The kit's own version constant lagged its manifest (2026-11-11)

## What was wrong

On 2026-11-10 the repository versions were raised to `0.1.0-draft.1` and MIT was declared across
all four repositories (`projects/dsh-compat-platform/docs/testing/2026-11-10-release-readiness.md`).
That slice ran the platform's and the spec's suites. **It never ran this repository's suite**, so
two real defects went unnoticed for a day:

| Where | Asserted | Reality |
| --- | --- | --- |
| `src/protocol.js` `KIT_VERSION` | `'0.0.0'` | manifest `version` is `0.1.0-draft.1` |
| `tests/exports.test.js:84` | `kit.KIT_VERSION === '0.0.0'` | same |
| `tests/exports.test.js:100` | `pkg.license === undefined` ("a private package declares no license") | `license` is `MIT` |
| `tests/protocol.test.js:36` | `pkg.version === KIT_VERSION` (`0.0.0`) | manifest is `0.1.0-draft.1` |
| `tests/protocol.test.js:39` | `pkg.license === undefined` | `MIT` |

Measured before the fix: `node --test --test-concurrency=1 "tests/*.test.js"` → **189 tests,
187 pass, 2 fail**.

Two of the four were caught by the suite itself; the other two were found by reading the same
assertions while fixing the first pair. The suite is what surfaced the problem, which is the point
of having it — the process defect was not running it after a cross-repository change.

## What was changed

- `src/protocol.js` and `src/index.d.ts`: `KIT_VERSION` `'0.0.0'` → `'0.1.0-draft.1'`. This
  constant is the kit's own version, stamped into every generated file as provenance
  (`generatedBy = 'dsh-plugin-kit@<version>'`), so it must equal the manifest.
- `tests/exports.test.js`, `tests/protocol.test.js`: the four assertions now state the decided
  value (`0.1.0-draft.1`, `license === 'MIT'`), with the reason in each message. They were
  **changed because the decision changed**, not because the code regressed.
- The three checked-in reference copies were **regenerated from the renderer** with the same
  options their tests use, because their prose contains the stamped kit version:

  | Directory | Files touched | How the README is stored |
  | --- | --- | --- |
  | `templates/host-tool` | `index.js`, `test/plugin.test.js`, `generated-readme.md` | rendering's README goes to `generated-readme.md`; `README.md` is the directory's explanation |
  | `templates/host-tool-managed` | same three | same convention |
  | `templates/host-tool-admitted` | `index.js`, `test/plugin.test.js`, `README.md` | the generated README **is** `README.md`; there is no explanation file and no `generated-readme.md` |

  The admitted directory has no `generated-readme.md`, so the first regeneration attempt created
  one and the file-set assertion rejected it — the test caught the mistake, and the fix was to
  write the rendering's README into `README.md` in place.

## Verification

`node --test --test-concurrency=1 "tests/*.test.js"` on the final bytes:

```
ℹ tests 189
ℹ pass 189
ℹ fail 0
```

This is one local run of the package suite on this machine. It is **not** a bounded envelope run
and it is not a host-compatibility statement: the kit generates text, it does not load into a host.

The other three repositories were run for comparison on the same day: spec `105/105`; platform
`analyzer 448/448`, `config-check 59/59`, `host 16/16`, `runtime 32/32`, `repair 42/42`.
`dsh-agent-test-driver` `278/278`. Counts are per suite and not additive.

## What this does not establish

Nothing about a host, a profile or a plugin. No generated plugin was loaded. `certification`
remains false wherever it is printed. No behaviour of the generator changed except the version
string it stamps.
