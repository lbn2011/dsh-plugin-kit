---
name: scaffold
description: Generate a minimal host-only DSH tool plugin (one registered tool, plain ESM JavaScript) with the dsh-plugin-kit CLI, then verify what was written without claiming host evidence. Use when the user wants a new DSH host plugin scaffolded in this repository.
---

# scaffold

Generate a host-only DSH tool plugin with this repository's `dsh-plugin-kit`
CLI. Three templates are implemented; two are deferred. Nothing here installs,
publishes, links or loads anything.

Design context: [plugin migration tech plan](../../docs/requirements-and-design/2026-11-06-plugin-migration-tech-plan.md).

## Before running any step

- Get an explicit instruction for the step; a previous authorization is not a
  new one. Do not install, publish, or retry automatically on failure.
- If the step runs under a sandbox, verify the hard caps first and record them:
  768 MiB memory, swap 0, `TasksMax=32`, CPU quota 50%, `Type=exec`, 120 s wall
  clock, `node --max-old-space-size=384`, and the single-use 1200 MiB
  `MemAvailable` gate. Run steps serially.
- The examples below are documentation, not permission to bypass those gates.

## What you may run

The CLI imports only Node builtins and local modules, so no dependency install
is required to *scaffold*. Running the generated project's test is a different
step with its own requirements (see below).

## Preflight

1. The target directory must **not exist**. The generator never merges,
   overwrites or deletes, so there is no "update" mode.
2. Confirm the identifiers (defaults derive from the directory name — read them
   aloud before writing):
   - `--plugin-id`: `^[a-z0-9][a-z0-9._-]*$` (official ids are kebab-case).
   - `--package-name`: npm name, optionally `@scope/name`.
   - `--tool-name`: `^[A-Za-z_][A-Za-z0-9_-]{0,63}$`; the host also reserves
     `run_code`, which the kit refuses. Default `<plugin-id>_hello`.
   - `--version`: explicit SemVer literal, default `0.1.0` (no ranges).
3. Pick the template deliberately, and use the **same** template and
   `--kit-specifier` in the dry run and the real write, or the plan you approved
   is not the plan that gets written.

## Templates

| template | `inject` | `apply` | needs `--kit-specifier` |
| --- | --- | --- | --- |
| `host-tool` (default) | `['tools']` | plain `function`, returns nothing | no — passing one is an error |
| `host-tool-managed` | `['tools']` | `const` arrow, returns `() => handle.close()` | **yes** |
| `host-tool-admitted` | `['tools', 'pluginAdmission']` | `async` arrow, returns `() => handle.close()` | **yes** |

- `host-tool-managed` mounts its tool through `dsh-plugin-kit/managed-registration`;
  the returned cleanup closes the kit handle, while the host still owns the same
  disposer as a native effect.
- `host-tool-admitted` registers inside `ctx.pluginAdmission.admit(...)` and
  defers the host disposer with `defer`. It **creates no coordinator and mounts
  no provider**: with nothing providing `pluginAdmission` in its visibility
  scope the loader leaves it PENDING and `apply` never runs.
- `--kit-specifier` accepts only a local `file:` string, written verbatim into
  `dependencies["dsh-plugin-kit"]`. The CLI never resolves, stats or installs
  it, and a registry range is refused. A relative path is not relative to your
  shell: a package manager resolves it against the **generated package
  directory**.

## Steps

From the kit root (`projects/dsh-plugin-kit`):

```sh
# 1. Inspect the plan without touching the filesystem.
node src/cli.js scaffold ../my-plugin --dry-run \
  --template host-tool-managed \
  --kit-specifier file:../dsh-plugin-kit

# 2. Write the seven files with the same template and specifier.
node src/cli.js scaffold ../my-plugin \
  --template host-tool-managed \
  --plugin-id my-plugin \
  --package-name my-plugin \
  --tool-name my_hello \
  --kit-specifier file:../dsh-plugin-kit

# 3. Validate the emitted declaration with the protocol owner's validator.
node src/cli.js check ../my-plugin/declaration.json \
  --validator <path-to-dsh-compat-spec>/src/index.js
```

`node src/cli.js list-templates` prints implemented ids and the deferred ones;
`help` lists every flag. Exit codes: `0` success, `1` refused or invalid,
`2` usage error (unknown flag, wrong positional count, `check` without
`--validator`, unloadable validator). A write is **not transactional**: on
failure the CLI reports `written`, `failed` and `skipped`, leaves the partial
directory in place and exits `1`. Report that state; do not clean it up
silently.

## What gets written

Seven files, in this order: `package.json`, `cordis.patch.yml`, `index.js`,
`declaration.json`, `jsconfig.json`, `README.md`, `test/plugin.test.js`.

`package.json` carries `private: true`, `type: "module"`,
`engines: { node: ">=24.9.0", dsh: "0.2.2-alpha.2" }`, one exact pin per host
package in both `peerDependencies` and `devDependencies`, and
`dsh.bundle.patch: "./cordis.patch.yml"`. The generator emits **no** `license`
field, no `dsh.manifestVersion` and no compatibility field. `engines.dsh` is a
declared literal naming the reviewed host build, not a compatibility verdict.
Official compatibility checks may refuse incompatible declarations, including
peer ranges; never bypass those checks automatically.

The patch's single row is `id: '<package-name>:<plugin-id>'` and
`name: '<package-name>'`. `declaration.json` uses `scope: "plugin"` for the
first two templates and `scope: "global"` for `host-tool-admitted` — the same
tuple its `admit` call reserves. Scope is a static label, not an agent-runtime
scope claim.

## Verify before reporting

```sh
cd ../my-plugin && node --test
```

`host-tool` needs the three peers at those pins resolvable from that directory.
`host-tool-managed` and `host-tool-admitted` also import
`dsh-plugin-kit/<subpath>`, so their kit `file:` dependency must be installed
too; if either requirement is missing, the import fails and the test did not
run. Treat that as failed or incomplete verification, never as "passed", and
never as "nothing happened".

Importing a module executes its top-level code, so this is not evidence of a
purely static check, and it cannot be claimed to make no network or filesystem
access.

## Do not

- Do not hand-edit generated metadata to add fields the kit did not emit.
- Do not re-run `scaffold` to "refresh" a project.
- Do not claim a template exists because `--template` accepted it; only
  `list-templates` reporting `implemented` counts.
- Do not claim the plugin works in DSH: nothing here was loaded by a host.
