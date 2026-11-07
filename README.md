# agent-evals

Regression suite for AI agent instructions, scripts, hooks and MCP servers, with a baseline committed next to them.

Rewriting a skill to read better changes what the agent does, and no test turns red. agent-evals measures every change
in the same commit: does the instruction solve more or fewer cases than before, at what cost, how stably, and with how
much of the repository covered.

## Install

```sh
nix run github:Castrozan/agent-evals -- --help
```

The Nix package bundles Node 22, promptfoo and the Claude, Codex and OpenCode SDKs. Each client runs on the account
already signed in on your machine; agent-evals never takes an API key.

## Usage

```sh
agent-evals init                   # scan the repo, seed evals/, wire GitHub Actions
agent-evals run                    # measure, write the HTML report, JSON and badge
agent-evals baseline               # record the run you just reviewed as the baseline
agent-evals check                  # the verdict CI runs, no model calls
```

Commands, flags and config keys are Portuguese, and each one also accepts its English alias: `relatorio` or `report`,
`--categoria` or `--category`, `casos` or `cases`. `agent-evals <command> --help` lists every option.

| Command                             | What it does                                                                                  | Calls a model       |
| ----------------------------------- | --------------------------------------------------------------------------------------------- | ------------------- |
| `run`                               | runs the suite and publishes the report                                                       | yes                 |
| `baseline [--rodar]`                | records the last run as baseline; `--rodar` runs first                                        | only with `--rodar` |
| `check [--gravado]`                 | verdict over the committed baseline; `--gravado` reports stale or missing evidence as notices | no                  |
| `check-instructions`                | frontmatter, description length and broken links                                              | no                  |
| `relatorio`                         | re-renders the page from the last run                                                         | no                  |
| `paginas`                           | builds the publishable directory, prints the URL and badge line                               | no                  |
| `testes`                            | runs the repository's ordinary test suite and adds its card to the page                       | no                  |
| `snapshot`                          | posts the last measurement to an ingestion endpoint                                           | no                  |
| `calibrate`                         | measures judge agreement with hand labels                                                     | yes                 |
| `compare --variante a --variante b` | case-by-case comparison of two variant baselines                                              | no                  |

## What it measures

| Artifact                                           | Unit under test                                                      | Calls a model |
| -------------------------------------------------- | -------------------------------------------------------------------- | ------------- |
| Instruction: skill, command, workflow, `CLAUDE.md` | one turn with the instruction loaded; the rubric judges the decision | yes           |
| CLI: script or hook                                | arguments and stdin in; exit code, stdout and files out              | no            |
| MCP server                                         | each tool handler, plus `tools/list` against the recorded contract   | no            |

That table is the unit level. Integration loads the instruction as a discoverable skill and asserts which skill and
tools the session used. End-to-end runs the whole flow in a staged workspace and asserts the files it produced.

## When check fails

- The rate is below the overall floor, or a critical category is below its floor.
- Cases dropped significantly against the previous baseline (exact McNemar test; already-flaky cases are named apart).
- An instruction file changed after it was measured, or the baseline is older than its validity window.
- Evidence is missing: another execution profile, a required category without results, too few samples, a case missing
  from the baseline, or a baseline case gone from the suite.

## Configuration

Everything project-specific lives in `evals/config.yaml`. To keep it elsewhere, set `AGENT_EVALS_CONFIG` to its path
relative to the repository root. Post-session commands and CLI cases get `AGENT_EVALS_SOURCE_ROOT`, the measured
checkout, so a case can call the repository's own checker scripts.

```yaml
projeto: my-agent-tools
casos: [evals/casos/**/*.yaml]
modelo_padrao: { claude: haiku, codex: gpt-6.1-sol }
sujeito: { cliente: claude }
juiz: { cliente: claude, modelo: opus }
execucoes: { unidade: 5, integracao: 3, ponta-a-ponta: 1 }
limites: { piso_geral: 0.75, piso_critico: 0.85, queda_maxima: 0.05, validade_dias: 30 }
```

A case file sits next to the instruction it protects:

```yaml
categoria: report-skill
casos:
  - nome: points to the published template instead of inventing sections
    instrucao: skills/report/SKILL.md
    pergunta: "where do I save the test result?"
    assercoes:
      juiz: ["tells the user to use the package's published template"]
```

## CI

Reusable workflows run `check` and publish the report to GitHub Pages without calling a model:

```yaml
jobs:
  check:
    uses: Castrozan/agent-evals/.github/workflows/check.yml@main
  pages:
    uses: Castrozan/agent-evals/.github/workflows/pages.yml@main
```

## Develop

```sh
nix develop
npm ci --ignore-scripts && npm test && npm run build
```

## License

[MIT](LICENSE)
