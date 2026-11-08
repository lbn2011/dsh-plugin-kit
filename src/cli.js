#!/usr/bin/env node
/**
 * dsh-plugin-kit CLI.
 *
 * Commands (the only implemented ones):
 *   scaffold <target> [options]        render the host-tool template into a new dir
 *   list-templates                     print the template catalog
 *   check [path] --validator <module>  forward a declaration to a caller-supplied validator
 *   help                               usage
 *
 * Design rules:
 * - no server, no watcher, no network access of its own, no child processes;
 * - never overwrites, merges or deletes;
 * - implements no protocol rules: `check` only reports what a validator the
 *   caller names says, and refuses to answer without one;
 * - exit codes: 0 success, 1 refused/invalid, 2 usage error.
 */

import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import process from 'node:process';

import { describeDeclaration, validateWith } from './protocol.js';
import {
  DEFAULT_TEMPLATE,
  DEFERRED_TEMPLATES,
  TEMPLATES,
  describeScaffoldPlan,
  writeScaffold,
} from './scaffold.js';

const USAGE = `dsh-plugin-kit — author-side scaffolding for DSH plugins

Usage:
  dsh-plugin-kit scaffold <target> [options]
  dsh-plugin-kit list-templates
  dsh-plugin-kit check [declaration.json] --validator <module>
  dsh-plugin-kit help

scaffold options:
  --template <id>        template id (default: ${DEFAULT_TEMPLATE}); implemented: ${Object.keys(TEMPLATES).join(', ')}
  --plugin-id <id>       Cordis plugin name (default: target directory basename)
  --package-name <name>  npm package name, may be scoped (default: target directory basename)
  --tool-name <name>     registered tool name (default: <plugin-id>_hello)
  --version <semver>     plugin version literal (default: 0.1.0)
  --kit-specifier <s>    REQUIRED for host-tool-managed and host-tool-admitted:
                         the local kit as file:<operator path>, recorded
                         verbatim in dependencies. Nothing is defaulted,
                         discovered or installed; a relative path resolves
                         against the generated package directory.
  --dry-run              plan and validate only; write nothing
  --json                 machine-readable output

check options:
  --validator <module>   REQUIRED. File path or module specifier exporting the
                         protocol owner's validateDeclaration. This tool has no
                         built-in protocol rules and will not guess.
  --json                 machine-readable output

Notes:
  - The target directory must not exist; this tool never overwrites anything.
  - It does not install packages, start a host, or run a build.
  - A scaffold write is not transactional; a partial write is reported.
  - \`host-tool-managed\` and \`host-tool-admitted\` are opt-in and both require an
    explicit kit specifier: their generated plugins import this kit at runtime
    (\`managed-registration\` and \`admission-provider\` respectively), so the
    scaffold refuses to run without
    \`--kit-specifier file:<operator path>\`. That string is written verbatim into
    \`dependencies\`; nothing here fetches, links or resolves it. The admitted
    template never creates the admission coordinator or mounts its provider:
    the generated module is PENDING until an operator provides one.
`;

const FLAGS_WITH_VALUE = new Set(['--template', '--plugin-id', '--package-name', '--tool-name', '--version', '--kit-specifier', '--validator']);
const BOOLEAN_FLAGS = new Set(['--dry-run', '--json']);

class UsageError extends Error {}

/** @returns {{ command: string, positionals: string[], options: Record<string, unknown> }} */
function parseArgv(argv) {
  const [command = 'help', ...rest] = argv;
  const positionals = [];
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }
    const [flag, inlineValue] = token.includes('=') ? token.split(/=(.*)/s) : [token, undefined];
    if (BOOLEAN_FLAGS.has(flag)) {
      options[normalizeFlag(flag)] = true;
      continue;
    }
    if (!FLAGS_WITH_VALUE.has(flag)) throw new UsageError(`unknown option: ${flag}`);
    const value = inlineValue ?? rest[(index += 1)];
    if (value === undefined || value.startsWith('--')) throw new UsageError(`${flag} requires a value`);
    options[normalizeFlag(flag)] = value;
  }
  return { command, positionals, options };
}

/** `--dry-run` → `dryRun`, `--json` → `json`, `--plugin-id` → `pluginId`. */
function normalizeFlag(flag) {
  return flag.slice(2).replace(/-([a-z])/g, (_, character) => character.toUpperCase());
}

function printIssues(issues) {
  for (const issue of issues) process.stderr.write(`error: ${issue.field}: ${issue.message}\n`);
}

async function runScaffold(positionals, options) {
  const [target] = positionals;
  const result = await writeScaffold({
    target,
    template: options.template ?? DEFAULT_TEMPLATE,
    pluginId: options.pluginId,
    packageName: options.packageName,
    toolName: options.toolName,
    pluginVersion: options.version,
    kitSpecifier: options.kitSpecifier,
  }, { dryRun: options.dryRun === true });
  if (result.ok) result.mode = result.dryRun ? 'dry-run' : 'write';

  if (!result.ok) {
    if (options.json) {
      // Carry the partial-write facts so a machine caller can act on them.
      process.stdout.write(`${JSON.stringify({
        ok: false,
        target: result.target,
        issues: result.issues,
        written: result.written ?? [],
        skipped: result.skipped ?? [],
        failed: result.failed ?? null,
        targetCreated: result.targetCreated ?? false,
        transactional: false,
      }, null, 2)}\n`);
    } else {
      printIssues(result.issues);
      if ((result.written ?? []).length > 0) {
        process.stderr.write(`partial write: already written:\n${result.written.map((file) => `  ${file}`).join('\n')}\n`);
      }
      if (result.failed) process.stderr.write(`partial write: failed at ${result.failed}\n`);
      if ((result.skipped ?? []).length > 0) {
        process.stderr.write(`partial write: skipped:\n${result.skipped.map((file) => `  ${file}`).join('\n')}\n`);
      }
    }
    return 1;
  }

  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  }
  process.stdout.write(`${describeScaffoldPlan(result.plan)}\n`);
  const verb = result.dryRun ? 'would write' : 'wrote';
  process.stdout.write(`files:\n${result.written.map((file) => `  ${verb} ${file}`).join('\n')}\n`);
  if (!result.dryRun) {
    process.stdout.write(`\nNext: cd ${result.target} && node --test\n`);
  }
  return 0;
}

function runListTemplates(options) {
  if (options.json) {
    process.stdout.write(`${JSON.stringify({ templates: TEMPLATES, deferred: DEFERRED_TEMPLATES }, null, 2)}\n`);
    return 0;
  }
  for (const template of Object.values(TEMPLATES)) {
    process.stdout.write(`${template.id}  ${template.status}  ${template.language}  v${template.version}\n`);
    process.stdout.write(`  ${template.description}\n`);
  }
  for (const [id, reason] of Object.entries(DEFERRED_TEMPLATES)) {
    process.stdout.write(`${id}  deferred  -\n  ${reason}\n`);
  }
  return 0;
}

/**
 * Load the validator the caller named. A path is resolved against the current
 * directory; anything else is left to Node's module resolution. The kit does
 * not bundle, vendor or default this module.
 */
async function loadValidator(specifier) {
  const isPath = specifier.startsWith('.') || specifier.startsWith('/') || /^[A-Za-z]:[\\/]/.test(specifier);
  const target = isPath ? pathToFileURL(resolve(specifier)).href : specifier;
  const namespace = await import(target);
  const candidate = namespace.validateDeclaration ?? namespace.default;
  if (typeof candidate !== 'function') {
    throw new Error(`${specifier} does not export a validateDeclaration function (looked for a named "validateDeclaration" export and a default function)`);
  }
  return candidate;
}

async function runCheck(positionals, options) {
  const path = resolve(positionals[0] ?? 'declaration.json');
  let raw;
  try {
    raw = await readFile(path, 'utf8');
  } catch (error) {
    process.stderr.write(`error: cannot read ${path}: ${error.message}\n`);
    return 1;
  }
  let value;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    process.stderr.write(`error: ${path} is not valid JSON: ${error.message}\n`);
    return 1;
  }
  if (typeof options.validator !== 'string' || options.validator === '') {
    process.stderr.write('error: check needs --validator <module> exporting validateDeclaration; this tool implements no protocol rules of its own.\n');
    return 2;
  }
  let validator;
  try {
    validator = await loadValidator(options.validator);
  } catch (error) {
    process.stderr.write(`error: cannot load validator ${options.validator}: ${error.message}\n`);
    return 2;
  }

  let result;
  try {
    result = validateWith(value, validator);
  } catch (error) {
    process.stderr.write(`error: ${error.message}\n`);
    return 2;
  }

  if (options.json) {
    process.stdout.write(`${JSON.stringify({ path, validator: options.validator, ...result }, null, 2)}\n`);
    return result.valid ? 0 : 1;
  }
  if (result.valid) {
    const info = describeDeclaration(value);
    process.stdout.write(`ok: ${path}\n`);
    process.stdout.write(`  plugin ${info.pluginId}@${info.pluginVersion} (schema ${info.schemaVersion})\n`);
    process.stdout.write(`  tools: ${info.tools.join(', ') || '(none)'}; services: ${info.services.join(', ') || '(none)'}\n`);
    process.stdout.write(`  required: ${info.requiredCapabilities.join(', ') || '(none)'}; optional: ${info.optionalCapabilities.join(', ') || '(none)'}\n`);
  } else {
    printIssues(result.issues.map((issue) => ({ field: issue.path || '$', message: `${issue.code}: ${issue.message}` })));
  }
  process.stdout.write(`note: verdict from ${options.validator}; not host acceptance, loading or execution evidence.\n`);
  return result.valid ? 0 : 1;
}

async function main(argv) {
  let parsed;
  try {
    parsed = parseArgv(argv);
  } catch (error) {
    if (error instanceof UsageError) {
      process.stderr.write(`error: ${error.message}\n\n${USAGE}`);
      return 2;
    }
    throw error;
  }
  const { command, positionals, options } = parsed;

  switch (command) {
    case 'scaffold':
      if (positionals.length === 0) {
        process.stderr.write(`error: scaffold requires a target directory\n\n${USAGE}`);
        return 2;
      }
      if (positionals.length > 1) {
        process.stderr.write(`error: scaffold accepts exactly one target directory, got ${positionals.length}\n`);
        return 2;
      }
      return runScaffold(positionals, options);
    case 'list-templates':
      return runListTemplates(options);
    case 'check':
      return runCheck(positionals, options);
    case 'help':
    case '--help':
    case '-h':
      process.stdout.write(USAGE);
      return 0;
    default:
      process.stderr.write(`error: unknown command: ${command}\n\n${USAGE}`);
      return 2;
  }
}

const exitCode = await main(process.argv.slice(2));
process.exitCode = exitCode;
