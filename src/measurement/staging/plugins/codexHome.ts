import { existsSync } from "node:fs";
import { mkdir, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const MARKETPLACE_NAME = "agent-evals-local";

export async function prepareCodexHome(codexHome: string, pluginDirectories: string[]): Promise<void> {
  await mkdir(codexHome, { recursive: true });
  const userHome = process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex");
  const credentials = path.join(userHome, "auth.json");
  if (existsSync(credentials)) await symlink(credentials, path.join(codexHome, "auth.json"));
  const marketplaceRoot = path.join(codexHome, "marketplace");
  await mkdir(path.join(marketplaceRoot, ".agents", "plugins"), { recursive: true });
  const entries = pluginDirectories.map((directory) => ({
    name: path.basename(directory),
    source: { source: "local", path: directory },
    policy: { installation: "INSTALLED_BY_DEFAULT", authentication: "ON_USE" },
  }));
  const manifest = { name: MARKETPLACE_NAME, plugins: entries };
  await writeFile(
    path.join(marketplaceRoot, ".agents", "plugins", "marketplace.json"),
    JSON.stringify(manifest, null, 2),
  );
  const lines = [
    `[marketplaces.${MARKETPLACE_NAME}]`,
    'source_type = "local"',
    `source = ${JSON.stringify(marketplaceRoot)}`,
    ...entries.flatMap((entry) => ["", `[plugins."${entry.name}@${MARKETPLACE_NAME}"]`, "enabled = true"]),
  ];
  await writeFile(path.join(codexHome, "config.toml"), `${lines.join("\n")}\n`);
}
