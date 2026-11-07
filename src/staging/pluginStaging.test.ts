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

describe("plugin staging", () => {
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
});
