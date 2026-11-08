import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { sandboxCodex } from "./codexSandbox.js";

function bubblewrapRuns(): boolean {
  try {
    execFileSync("bwrap", ["--ro-bind", "/", "/", "--dev", "/dev", "true"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const created: string[] = [];
const originalPath = process.env.PATH;

afterEach(async () => {
  process.env.PATH = originalPath;
  while (created.length > 0) await rm(created.pop()!, { recursive: true, force: true });
});

async function temporaryDirectory(prefix: string): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), prefix));
  created.push(directory);
  return directory;
}

describe("codex session sandbox", () => {
  it.skipIf(!bubblewrapRuns())("lets the session write only its own root and forbids sudo", async () => {
    const sessionRoot = await temporaryDirectory("agent-evals-test-session-");
    const codexHome = await temporaryDirectory("agent-evals-test-codex-home-");
    const outside = await temporaryDirectory("agent-evals-test-outside-");
    const fakeBin = await temporaryDirectory("agent-evals-test-bin-");
    await mkdir(path.join(sessionRoot, "repo"));
    await writeFile(
      path.join(fakeBin, "codex"),
      [
        "#!/bin/sh",
        'touch "$PWD/inside" && echo inside=ok',
        `touch ${outside}/escaped 2>/dev/null && echo outside=written || echo outside=denied`,
        "sudo -n true 2>/dev/null && echo sudo=allowed || echo sudo=denied",
        "",
      ].join("\n"),
    );
    await chmod(path.join(fakeBin, "codex"), 0o755);
    process.env.PATH = `${fakeBin}:${originalPath}`;

    const sandbox = await sandboxCodex({
      writableRoot: sessionRoot,
      workingDirectory: path.join(sessionRoot, "repo"),
      codexHome,
      readableRoots: [fakeBin],
      usesPathCodex: true,
    });
    const output = execFileSync(sandbox.binary, [], { encoding: "utf8" });
    await sandbox.dispose();

    expect(output).toContain("inside=ok");
    expect(output).toContain("outside=denied");
    expect(output).toContain("sudo=denied");
    expect(existsSync(path.join(sessionRoot, "repo", "inside"))).toBe(true);
    expect(existsSync(path.join(outside, "escaped"))).toBe(false);
  });

  it("writes a wrapper that mounts the host read-only before binding the session", async () => {
    const sessionRoot = await temporaryDirectory("agent-evals-test-session-");
    const sandbox = await sandboxCodex({
      writableRoot: sessionRoot,
      workingDirectory: sessionRoot,
      codexHome: sessionRoot,
      readableRoots: [],
      usesPathCodex: true,
    }).catch(() => undefined);
    if (sandbox === undefined) return;
    const wrapper = await readFile(sandbox.binary, "utf8");
    await sandbox.dispose();
    expect(wrapper.indexOf("'--ro-bind' '/' '/'")).toBeLessThan(wrapper.indexOf(`'--bind' '${sessionRoot}'`));
  });
});
