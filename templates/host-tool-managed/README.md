# `host-tool-managed` template reference copy

This directory is the **review copy** of the opt-in `host-tool-managed`
template. The generator does not read it: `src/scaffold.js` renders from
`src/manifest.js`, so the two can only drift if a test stops comparing them.
`tests/managed-template.test.js` renders a scaffold and compares every file here
byte for byte.

The files were generated with:

```sh
node src/cli.js scaffold <target> --template host-tool-managed \
  --plugin-id sample-managed --package-name sample-managed --tool-name sample_managed_hello \
  --kit-specifier file:../dsh-plugin-kit
```

so `sample-managed` / `sample_managed_hello` appear literally, including in
`package.json` (`name`) and `README.md`, and the kit specifier appears exactly as
it was passed. `file:../dsh-plugin-kit` is a **portable operator example**, not a
default: the generator has no default value, and this same command without
`--kit-specifier` is refused.

Two files are stored under names of their own:

| Here | Rendered path | Why |
|---|---|---|
| this `README.md` | — | Explains the copy instead of being compared to a rendering. |
| `generated-readme.md` | `README.md` | The README a generated project actually gets. |

Everything else keeps its rendered path: `package.json`,
`cordis.patch.yml`, `index.js`, `declaration.json`, `jsconfig.json`,
`test/plugin.test.js`.

Differences from the `host-tool` reference copy are deliberate and limited:

- `index.js` imports `dsh-plugin-kit/managed-registration`, mounts the single
  tool through `registerManagedResource`, and returns `() => handle.close()`
  from `apply`;
- that `apply` is a **non-constructible arrow** (`export const apply = (ctx,
  config) => {…}`), not a `function` declaration. The reviewed loader calls a
  constructible callback with `new` and then reads only the instance's
  `symbols.init` hook, so a cleanup returned from a `function apply` is
  discarded; with an arrow (no `prototype`) the returned cleanup is what the
  loader collects as the disposer. `tests/managed-template.test.js` pins this,
  and the module exports nothing extra to make it observable;
- `package.json` keeps the same three host pins as peers **and** dev
  dependencies, and adds one `dependencies` entry,
  `"dsh-plugin-kit": "file:../dsh-plugin-kit"` — the operator's own literal,
  which is neither a peer, a dev dependency, nor a guessed version;
- the generated `README.md` and `test/plugin.test.js` describe and check that
  cleanup and that recorded dependency.

Nothing in this directory is installed, imported or booted by this repository's
tests: the shared host packages (`@deepseek-ai/cordis`,
`@deepseek-ai/dsh-tools`, `@deepseek-ai/schemastery`) are not present here, and
`dsh-plugin-kit` itself is a private unpublished package, so the emitted imports
would fail to resolve.
