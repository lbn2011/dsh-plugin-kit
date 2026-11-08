---
name: verify
description: Verify a generated DSH host plugin before reporting it as working — run the emitted test, check the declaration, and state honestly what was not checked. Use after scaffolding or editing a plugin in this repository.
---

# verify

Check what a plugin actually claims, and separate "checked" from "not checked".
Only the kit's real CLI (`scaffold --dry-run`, `check`, `list-templates`) and
`node --test` inside the project are used.

Design context: [plugin migration tech plan](../../docs/requirements-and-design/2026-11-06-plugin-migration-tech-plan.md).

## Before running any step

- Get an explicit instruction; a spent authorization is not a new one. No
  automatic retry, install or repair.
- Under a sandbox, verify and record the hard caps first: 768 MiB memory, swap 0,
  `TasksMax=32`, CPU quota 50%, `Type=exec`, 120 s,
  `node --max-old-space-size=384`, single-use 1200 MiB `MemAvailable` gate. Run
  serially.
- The commands below are documentation, not permission to bypass those gates.

## 0. What is being verified

These checks describe an **unmodified generated baseline**. If the user has
legitimately edited metadata (a real `license`, repository fields, a script) or
replaced a placeholder, do not call that a defect: read what the generator would
emit (`scaffold --dry-run` into a scratch target), then record every difference
as a deviation. Review intentional changes against their requirements as well;
intent alone does not establish correctness.

## 1. Structure

```sh
cd <generated-project>
ls package.json cordis.patch.yml index.js declaration.json jsconfig.json README.md test/plugin.test.js
```

All seven must exist. Confirm for the generated baseline:

- `"type": "module"` and `"private": true`;
- `engines.node` is `>=24.9.0`; `engines.dsh` is the exact literal
  `0.2.2-alpha.2`. That field is **declarative, not enforced** by the kit, and
  it is not a compatibility range — a host can still refuse the plugin on its
  peer ranges, so never cite `engines` as acceptance evidence;
- every host package in `peerDependencies` appears in `devDependencies` at the
  *same exact pin* (`cordis@4.0.6-alpha.1`, `schemastery@3.18.6-alpha.1`,
  `dsh-tools@0.2.2-alpha.2`); a shared `^`/`~` range is a defect;
- the generator emits no `license` field and no `dsh.manifestVersion`; a user's
  own `license` is legitimate and belongs in the deviation list;
- `dsh.bundle.patch` points at `./cordis.patch.yml`, which exists and holds one
  `- insert:` row with `id: '<package-name>:<plugin-id>'` and
  `name: '<package-name>'`;
- `host-tool-managed` and `host-tool-admitted` also carry
  `dependencies: { "dsh-plugin-kit": "file:<operator path>" }` — verbatim, the
  same string given to `--kit-specifier`. `host-tool` carries no kit dependency.

## 2. Load contract without a booting host

```sh
node --input-type=module -e "const m = await import('./index.js'); console.log(m.name, m.inject, typeof m.apply, typeof m.Config)"
```

Expect the plugin id, a `function` `apply`, and a `function` `Config`
(Schemastery returns a callable schema). `inject` differs by template:

- `host-tool`, `host-tool-managed`: `[ 'tools' ]`;
- `host-tool-admitted`: `[ 'tools', 'pluginAdmission' ]`.

Importing executes the module's top-level code: this is not a purely static
check, and it cannot be claimed to make no network or filesystem access. If it
fails with `ERR_MODULE_NOT_FOUND`, a dependency is missing — the three peers,
plus the kit `file:` dependency for the two opt-in templates. Report that as a
failed or incomplete verification of the requirement, not as a pass and not as
"the run did not happen".

## 3. Emitted test

```sh
node --test
```

The generated `test/plugin.test.js` asserts the module contract, pins,
package/patch pairing and declaration. A failing assertion is a finding; a
resolution error is a failed attempt; checks that were not reached remain
unverified rather than becoming proven defects.

## 4. Declaration

```sh
node <kit>/src/cli.js check declaration.json --validator <compat-spec>/src/index.js
```

`--validator` is **required**: the kit implements no protocol rules, so `check`
exits `2` without one. With a validator, exit `0` means that validator accepted
the declaration, exit `1` prints its issue codes and paths. The CLI labels every
verdict as *not* host acceptance, loading or execution evidence.

Confirm `resources[i].scope` is `plugin` (first two templates) or `global`
(`host-tool-admitted`) — the same literal its `admit` tuple uses — and that
`capabilities.required` is `['cordis.effect', 'ctx.tools']`. A real tool or
service claim may be listed; a `route` claim has no `kind` and must not be
invented.

## 5. Template-specific states

- `host-tool-admitted` with no provider in scope is **PENDING**: `apply` never
  runs, nothing is registered, no coordinator is invented. That is a state, not
  a pass and not a defect.
- A second activation of the same claim must not register; that is the shared
  coordinator refusing, not a bug in the module.
- `host-tool-managed` closes its own handle while the host also owns the same
  disposer as a native effect; whichever runs first wins, and `close()` has no
  timeout. Do not claim ordering.

## 6. Report

State exactly: which checks ran and their exit codes; which validator produced
the declaration verdict, by path; the template; every deviation between the
baseline and the files on disk; that the plugin was **not** installed into a
live profile and no host loaded it; every skipped check, by name; and that the
reviewed host build is `0.2.2-alpha.2` (commit
`ce7073d51254c26cd63b22a60835b8f948deb447`).

Never upgrade "the emitted test passed" into "the plugin works in DSH".
