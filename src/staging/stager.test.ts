import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { StagedSession } from "../domain/ports.js";
import { sessionStager } from "./stager.js";
import {
  buildCase,
  buildConfig,
  buildRequest,
  createSourceRepository,
  emptyEnvironment,
  git,
} from "./__fixtures__/stagingFixtures.js";

const sessions: StagedSession[] = [];
async function stage(...args: Parameters<typeof sessionStager.stage>) {
  const session = await sessionStager.stage(...args);
  sessions.push(session);
  return session;
}
afterEach(async () => {
  while (sessions.length > 0) await sessions.pop()?.dispose();
});

const SOURCE = {
  "skills/demo/SKILL.md": "---\nname: demo-skill\ndescription: d\n---\ncorpo\n",
  "skills/demo/helper.sh": "echo oi\n",
  "skills/sibling/SKILL.md": "---\nname: sibling\ndescription: s\n---\n",
  "CLAUDE.md": "regras\n",
  "AGENTS.md": "agentes\n",
  "config/app.yaml": "# comentario\nname: app # inline\nnested:\n  a: 1\n",
  "config/app.json": '{"a":1,"nested":{"b":2}}',
  "docs/keep.txt": "k",
  "docs/drop.tmp": "d",
};

describe("session stager", () => {
  it("gives unit cases an empty session directory", async () => {
    const source = createSourceRepository(SOURCE);
    const session = await stage(buildRequest(source, { evalCase: buildCase({ level: "unit" }) }));
    expect(readdirSync(session.sessionDirectory)).toEqual([]);
    expect(session.pluginDirectories).toEqual([]);
    expect(session.root.startsWith(source)).toBe(false);
  });

  it.each([
    ["claude", ".claude/skills"],
    ["codex", ".agents/skills"],
    ["opencode", ".opencode/skills"],
  ] as const)("installs skills for %s in %s with whole directory and entry files", async (client, skillRoot) => {
    const source = createSourceRepository(SOURCE);
    const evalCase = buildCase({ extraInstructions: ["skills/sibling/SKILL.md"] });
    const session = await stage(buildRequest(source, { client, evalCase }));
    const skills = path.join(session.sessionDirectory, skillRoot);
    expect(readdirSync(skills).sort()).toEqual(["demo-skill", "sibling"]);
    expect(existsSync(path.join(skills, "demo-skill", "helper.sh"))).toBe(true);
    expect(readFileSync(path.join(session.root, "CLAUDE.md"), "utf8")).toBe("regras\n");
  });

  it("installs every glob match of the extras", async () => {
    const source = createSourceRepository(SOURCE);
    const evalCase = buildCase({ extraInstructions: ["skills/*/SKILL.md"] });
    const session = await stage(buildRequest(source, { evalCase }));
    expect(readdirSync(path.join(session.sessionDirectory, ".claude/skills")).sort()).toEqual([
      "demo-skill",
      "sibling",
    ]);
  });

  it("does not copy entry files over a declared tree and opens the session in session_in", async () => {
    const source = createSourceRepository(SOURCE);
    const environment = emptyEnvironment({ layers: [{ from: "docs" }], sessionIn: "work" });
    const session = await stage(buildRequest(source, { evalCase: buildCase({ environment }) }));
    expect(existsSync(path.join(session.root, "CLAUDE.md"))).toBe(false);
    expect(existsSync(path.join(session.root, "keep.txt"))).toBe(true);
    expect(session.sessionDirectory).toBe(path.join(session.root, "work"));
    expect(existsSync(path.join(session.sessionDirectory, ".claude/skills/demo-skill/SKILL.md"))).toBe(true);
  });

  it("applies layers with later winning and layer git", async () => {
    const source = createSourceRepository(SOURCE);
    const environment = emptyEnvironment({
      layers: [{ from: "docs" }, { from: "config", at: "docs", git: { directory: "." } }],
      files: [{ path: "docs/new.txt", content: "novo" }],
    });
    const session = await stage(buildRequest(source, { evalCase: buildCase({ environment }) }));
    expect(existsSync(path.join(session.root, "keep.txt"))).toBe(true);
    expect(existsSync(path.join(session.root, "docs/app.yaml"))).toBe(true);
    expect(git(path.join(session.root, "docs"), "rev-list", "--count", "HEAD")).toBe("1");
  });

  it("rejects a later layer without a destination", async () => {
    const source = createSourceRepository(SOURCE);
    const environment = emptyEnvironment({ layers: [{ from: "docs" }, { from: "config" }] });
    await expect(stage(buildRequest(source, { evalCase: buildCase({ environment }) }))).rejects.toThrow(
      /precisa declarar/,
    );
  });

  it("archives the evaluated repository at a revision without .git and removes excluded globs", async () => {
    const source = createSourceRepository(SOURCE);
    const environment = emptyEnvironment({
      layers: [{ repository: { revision: "HEAD", exclude: ["**/*.tmp", "config"] } }],
    });
    const session = await stage(buildRequest(source, { evalCase: buildCase({ environment }) }));
    expect(existsSync(path.join(session.root, ".git"))).toBe(false);
    expect(existsSync(path.join(session.root, "docs/keep.txt"))).toBe(true);
    expect(existsSync(path.join(session.root, "docs/drop.tmp"))).toBe(false);
    expect(existsSync(path.join(session.root, "config"))).toBe(false);
  });

  it("fetches one commit from a remote and rewires origin to a bare repository inside .git", async () => {
    const remote = createSourceRepository({ "a.txt": "um" });
    const first = git(remote, "rev-parse", "HEAD");
    git(remote, "commit", "--quiet", "--allow-empty", "-m", "segundo");
    const source = createSourceRepository(SOURCE);
    const environment = emptyEnvironment({ layers: [{ repository: { remote, revision: first, exclude: [] } }] });
    const session = await stage(buildRequest(source, { evalCase: buildCase({ environment }) }));
    expect(git(session.root, "rev-parse", "HEAD")).toBe(first);
    expect(git(session.root, "rev-list", "--count", "HEAD")).toBe("1");
    const origin = git(session.root, "remote", "get-url", "origin");
    expect(origin.startsWith(path.join(session.root, ".git"))).toBe(true);
    git(session.root, "commit", "--quiet", "--allow-empty", "-m", "local");
    git(session.root, "push", "--quiet", "origin", "HEAD:main");
    expect(git(remote, "rev-list", "--count", "HEAD")).toBe("2");
  });

  it("writes files, adjusts yaml preserving comments and json, removes keys", async () => {
    const source = createSourceRepository(SOURCE);
    const environment = emptyEnvironment({
      layers: [{ from: "config" }],
      files: [{ path: "extra/x.txt", content: "x" }],
      adjustments: { "app.yaml": { name: "novo", nested: { b: 2 } }, "app.json": { nested: { c: 3 }, d: 4 } },
      removals: { "app.json": ["a"] },
    });
    const session = await stage(buildRequest(source, { evalCase: buildCase({ environment }) }));
    const yaml = readFileSync(path.join(session.root, "app.yaml"), "utf8");
    expect(yaml).toContain("# comentario");
    expect(yaml).toContain("name: novo # inline");
    expect(yaml).toMatch(/a: 1\n\s+b: 2/);
    expect(JSON.parse(readFileSync(path.join(session.root, "app.json"), "utf8"))).toEqual({
      nested: { b: 2, c: 3 },
      d: 4,
    });
    expect(readFileSync(path.join(session.root, "extra/x.txt"), "utf8")).toBe("x");
  });

  it("errors when adjusting a file no layer brought", async () => {
    const source = createSourceRepository(SOURCE);
    const environment = emptyEnvironment({ adjustments: { "ausente.yaml": { a: 1 } } });
    await expect(stage(buildRequest(source, { evalCase: buildCase({ environment }) }))).rejects.toThrow(
      /não pode ser ajustado/,
    );
  });

  it("rejects paths that escape the staged root", async () => {
    const source = createSourceRepository(SOURCE);
    const environment = emptyEnvironment({ files: [{ path: "../fora.txt", content: "x" }] });
    await expect(stage(buildRequest(source, { evalCase: buildCase({ environment }) }))).rejects.toThrow(/escapa/);
    const layerEnvironment = emptyEnvironment({ layers: [{ from: "docs", at: "../fora" }] });
    await expect(
      stage(buildRequest(source, { evalCase: buildCase({ environment: layerEnvironment }) })),
    ).rejects.toThrow(/escapa/);
  });

  it("initializes git at the root or in listed directories and ignores outside ones", async () => {
    const source = createSourceRepository(SOURCE);
    const rootSession = await stage(
      buildRequest(source, { evalCase: buildCase({ environment: emptyEnvironment({ git: true }) }) }),
    );
    expect(git(rootSession.root, "rev-list", "--count", "HEAD")).toBe("1");
    const listed = emptyEnvironment({ git: [{ directory: "sub" }, { directory: "../fora" }] });
    const listSession = await stage(buildRequest(source, { evalCase: buildCase({ environment: listed }) }));
    expect(existsSync(path.join(listSession.root, "sub/.git"))).toBe(true);
    expect(existsSync(path.join(path.dirname(listSession.root), "fora"))).toBe(false);
  });

  it("substitutes {sessao} in config and variant environment, variant overriding", async () => {
    const source = createSourceRepository(SOURCE);
    const config = buildConfig({ subject: { canonicalClient: "claude", environment: { A: "{sessao}/a", B: "b" } } });
    const session = await stage(buildRequest(source, { config, variantEnvironment: { B: "{sessao}/v" } }));
    expect(session.environment).toEqual({ A: `${session.sessionDirectory}/a`, B: `${session.sessionDirectory}/v` });
  });

  it("ignores variant plugins and environment for unit cases", async () => {
    const source = createSourceRepository(SOURCE);
    const session = await stage(
      buildRequest(source, {
        evalCase: buildCase({ level: "unit" }),
        variantPlugins: [{ name: "v", copy: [], files: [] }],
        variantEnvironment: { V: "1" },
      }),
    );
    expect(session.pluginDirectories).toEqual([]);
    expect(session.environment).toEqual({});
  });

  it("assembles plugins outside the session dir and rewrites the root variable for claude", async () => {
    const source = createSourceRepository({ ...SOURCE, "hooks-src/run.sh": "echo ${PLUGIN_ROOT}\n" });
    const environment = emptyEnvironment({
      plugins: [
        {
          name: "hook-plugin",
          copy: ["hooks-src"],
          files: [{ path: "hooks/hooks.json", content: '{"command":"${PLUGIN_ROOT}/hooks-src/run.sh"}' }],
        },
      ],
    });
    const session = await stage(
      buildRequest(source, {
        evalCase: buildCase({ environment }),
        variantPlugins: [{ name: "companion", copy: [], files: [{ path: "a.txt", content: "a" }] }],
      }),
    );
    const [pluginDirectory, companion] = session.pluginDirectories as [string, string];
    expect(pluginDirectory.startsWith(session.root)).toBe(false);
    expect(readFileSync(path.join(pluginDirectory, "hooks/hooks.json"), "utf8")).toContain("${CLAUDE_PLUGIN_ROOT}");
    expect(readFileSync(path.join(pluginDirectory, "hooks-src/run.sh"), "utf8")).toContain("${CLAUDE_PLUGIN_ROOT}");
    const manifest = JSON.parse(readFileSync(path.join(pluginDirectory, ".claude-plugin/plugin.json"), "utf8"));
    expect(manifest).toMatchObject({ name: "hook-plugin", hooks: "./hooks/hooks.json" });
    expect(existsSync(path.join(companion, "plugin.json"))).toBe(true);
  });

  it("errors on a variant plugin colliding with a case plugin", async () => {
    const source = createSourceRepository(SOURCE);
    const environment = emptyEnvironment({ plugins: [{ name: "same", copy: [], files: [] }] });
    await expect(
      stage(
        buildRequest(source, {
          evalCase: buildCase({ environment }),
          variantPlugins: [{ name: "same", copy: [], files: [] }],
        }),
      ),
    ).rejects.toThrow(/colide/);
  });

  it("keeps the PLUGIN_ROOT variable for codex and uses a private CODEX_HOME with credentials linked", async () => {
    const source = createSourceRepository({ ...SOURCE, "p/x.json": '{"r":"${PLUGIN_ROOT}"}' });
    const environment = emptyEnvironment({ plugins: [{ name: "cp", copy: ["p"], files: [] }] });
    const session = await stage(buildRequest(source, { client: "codex", evalCase: buildCase({ environment }) }));
    const [pluginDirectory] = session.pluginDirectories as [string];
    expect(readFileSync(path.join(pluginDirectory, "p/x.json"), "utf8")).toContain("${PLUGIN_ROOT}");
    const home = session.environment.CODEX_HOME as string;
    expect(readFileSync(path.join(home, "config.toml"), "utf8")).toContain('[plugins."cp@agent-evals-local"]');
    expect(existsSync(path.join(pluginDirectory, ".codex-plugin/plugin.json"))).toBe(true);
  });

  it("rejects opencode with plugins or subject environment", async () => {
    const source = createSourceRepository(SOURCE);
    const environment = emptyEnvironment({ plugins: [{ name: "p", copy: [], files: [] }] });
    await expect(
      stage(buildRequest(source, { client: "opencode", evalCase: buildCase({ environment }) })),
    ).rejects.toThrow(/plugins/);
    const config = buildConfig({ subject: { canonicalClient: "claude", environment: { A: "1" } } });
    await expect(stage(buildRequest(source, { client: "opencode", config }))).rejects.toThrow(/ambiente do sujeito/);
  });

  it("removes every staged directory on dispose", async () => {
    const source = createSourceRepository(SOURCE);
    const environment = emptyEnvironment({ plugins: [{ name: "p", copy: [], files: [] }] });
    const session = await sessionStager.stage(buildRequest(source, { evalCase: buildCase({ environment }) }));
    const pluginDirectory = session.pluginDirectories[0] as string;
    await session.dispose();
    expect(existsSync(session.root)).toBe(false);
    expect(existsSync(pluginDirectory)).toBe(false);
  });
});
