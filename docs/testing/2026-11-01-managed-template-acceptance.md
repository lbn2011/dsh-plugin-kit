# Managed template `kitSpecifier` acceptance record

Date: 2026-11-01 (Asia/Shanghai).

## Current verdict: NOT RUN (acceptance checks); unit suite PASSED separately

Execution evidence for this slice now lives in
`2026-11-01-kit-managed-template-unit.md`: the full unit suite ran twice under the
authorized sandbox on 2026-11-01 (units `kitunit27729235.service`, then
`kitunit17678148.service`) and finished at **107 tests / 107 pass / 0 fail**, exit
code 0. Several checks listed below are covered there by passing unit tests; the
CLI-level checks were not performed as separate acceptance invocations.

No acceptance check below has been executed *as an acceptance check*. Before that
run, no test suite, CLI invocation, renderer call or byte comparison had been
executed after these edits. Byte identity between this reference copy and the
renderer is now asserted by a **passing** test — see the unit record, not this
page.

Update this record with observed results after execution. Keep failures and
deviations; do not replace them with a green summary.

## Scope of the change under test

The user's final decision supersedes the earlier brief: the kit dependency of the
opt-in `host-tool-managed` template is **not** a `0.0.0` peer or dev dependency.
It is an operator-supplied input, required and preserved literally.

## Implementation under test

- `src/protocol.js`: `MANAGED_PEER_DEPENDENCIES` removed; `KIT_SPECIFIER_PREFIX`
  (`'file:'`) added. `GENERATED_DEPENDENCIES`, `HOST_PEERS`, `KIT_PACKAGE` and
  `KIT_VERSION` unchanged.
- `src/manifest.js`: `checkKitSpecifier` (structural validation) and the private
  `requireKitSpecifier` guard; `managedToolPackageJson`, `managedToolTestJs` and
  `managedToolReadme` take a required `kitSpecifier` and write
  `dependencies['dsh-plugin-kit']`. `managedToolIndexJs` and every `hostTool*`
  builder are untouched.
- `src/scaffold.js`: `planScaffold` validates `kitSpecifier` into `issues` under
  field `kitSpecifier` (required for the managed template, refused for the
  default one), `requirePlanKitSpecifier` revalidates inside the managed
  renderer, and `describeScaffoldPlan` prints the specifier only when present.
- `src/cli.js`: `--kit-specifier <file:…>` value flag, usage text and
  `runScaffold` passthrough.
- `src/index.js`, `src/index.d.ts`: re-exports, declarations, `ScaffoldOptions`
  and `ScaffoldPlan` fields.
- `templates/host-tool-managed/`: `package.json`, `generated-readme.md`,
  `test/plugin.test.js` and the directory `README.md` updated; `index.js`
  unchanged.
- `README.md` and this record.

Unchanged by deliberate decision: `src/cleanup.js`,
`src/managed-registration.js`, `templates/host-tool/**`, and the bytes and
behaviour of the default `host-tool` template (no dependency is added to it).

## Required checks

1. `list-templates` still shows both implemented templates; `DEFAULT_TEMPLATE` is
   still `host-tool`.
2. `scaffold <t> --template host-tool-managed` without `--kit-specifier` exits
   `1` with an issue whose field is `kitSpecifier`, and writes nothing.
3. With `--kit-specifier file:<operator path>` it writes the seven files and
   records that exact string in `dependencies['dsh-plugin-kit']`.
4. The literal is preserved verbatim: relative, absolute and unusual-but-valid
   paths are neither normalized nor rewritten, and no other `file:` path appears
   in the generated output.
5. A non-`file:` specifier, an empty path (`file:`), a whitespace-only path, a
   control character or a non-string is refused at the plan boundary.
6. Bypassing the planner cannot emit a package.json without the dependency: a
   hand-built plan missing or carrying an invalid `kitSpecifier` makes
   `renderScaffold` throw, and `managedToolPackageJson` throws a `TypeError`.
7. Host peers are unchanged by the managed variant: the same three pins in
   `peerDependencies` **and** `devDependencies`, and no kit entry in either.
8. Default invariance: the `host-tool` render emits no `dependencies` and no kit
   mention, and passing a `kitSpecifier` to it is refused rather than ignored.
9. `templates/host-tool-managed/` equals `renderScaffold(plan)` for the same
   inputs, file by file.
10. `src/index.js` and `src/index.d.ts` agree, and no removed constant survives.

## Test files and execution entry

- `tests/managed-template.test.js` (rewritten; the obsolete `0.0.0` peer
  assertions were replaced by the assertions above, plus the planner,
  renderer-bypass and builder-bypass refusals)
- `tests/cli.test.js` (managed flag required / refused / recorded verbatim;
  default template refuses the flag)
- `tests/scaffold.test.js` (plan carries the specifier; default plan does not)
- `tests/exports.test.js` (export list and `.d.ts` parity)
- `tests/template.test.js` (unchanged; still covers the default template)

Entry, when execution is authorized:

```sh
node --test "tests/*.test.js"
```

## Planned execution limits

No execution plan has been accepted for this slice. Nothing is scheduled: this
record was written under an instruction that forbids shells, `node`, and test
runs, and the environment therefore produced no measurements.

## Evidence ledger

| Attempt | Result | Tests / assertions | Exit | Resource measurements | Evidence |
|---|---|---|---|---|---|
| None | NOT RUN | Not observed | Not observed | Not observed | Source, reference-copy and test authoring only |

## Interpretation limits

- Nothing above is a test result. The "Required checks" list states intent.
- No byte-identity claim is made for the reference copy; the comparison exists
  only as an unexecuted test.
- The generated project's own suite (`node --test` inside a generated directory)
  was not run either, and could not resolve the host packages or the kit here.
- No claim is made about how any package manager resolves the recorded `file:`
  specifier; the generator records the operator's string and resolves nothing.
- Earlier suites recorded elsewhere in this directory are historical evidence for
  other slices and say nothing about these bytes.
