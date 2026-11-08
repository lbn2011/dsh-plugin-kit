# `host-tool` template reference copy

This directory is the **review copy** of the `host-tool` template. The
generator does not read it: `src/scaffold.js` renders from `src/manifest.js`, so
the two can only drift if a test stops comparing them. `tests/template.test.js`
renders a scaffold and compares every file here byte for byte.

The files were generated with:

```sh
node src/cli.js scaffold <target> --template host-tool \
  --plugin-id sample-plugin --package-name sample-plugin --tool-name sample_hello
```

so `sample-plugin` / `sample_hello` appear literally, including in
`package.json` (`name`) and `README.md`.

Two files are stored under names of their own:

| Here | Rendered path | Why |
|---|---|---|
| this `README.md` | — | Explains the copy instead of being compared to a rendering. |
| `generated-readme.md` | `README.md` | The README a generated project actually gets. |

Everything else keeps its rendered path: `package.json`, `cordis.patch.yml`,
`index.js`, `declaration.json`, `jsconfig.json`, `test/plugin.test.js`.

Nothing in this directory is installed, imported or booted by this repository's
tests: the shared host packages (`@deepseek-ai/cordis`,
`@deepseek-ai/dsh-tools`, `@deepseek-ai/schemastery`) are not present here, so
the emitted import would fail to resolve.
