import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LINUX_CODEX_PACKAGES: Record<string, { triple: string; packageName: string }> = {
  x64: { triple: "x86_64-unknown-linux-musl", packageName: "@openai/codex-linux-x64" },
  arm64: { triple: "aarch64-unknown-linux-musl", packageName: "@openai/codex-linux-arm64" },
};

export class SandboxUnavailableError extends Error {}

export interface CodexSandboxRequest {
  writableRoot: string;
  workingDirectory: string;
  codexHome: string;
  readableRoots: string[];
  usesPathCodex: boolean;
}

export interface SandboxedCodex {
  binary: string;
  dispose(): Promise<void>;
}

interface CodexCommand {
  executable: string;
  pathDirectories: string[];
}

function bundledCodexCommand(): CodexCommand {
  const platformPackage = LINUX_CODEX_PACKAGES[process.arch];
  if (process.platform !== "linux" || platformPackage === undefined) {
    throw new SandboxUnavailableError(`sem sandbox de sessão para ${process.platform}/${process.arch}`);
  }
  const sdkRequire = createRequire(fileURLToPath(import.meta.resolve("@openai/codex-sdk")));
  const codexRequire = createRequire(sdkRequire.resolve("@openai/codex/package.json"));
  const vendorRoot = path.join(
    path.dirname(codexRequire.resolve(`${platformPackage.packageName}/package.json`)),
    "vendor",
  );
  const packageRoot = path.join(vendorRoot, platformPackage.triple);
  const pathDirectory = path.join(packageRoot, "codex-path");
  return {
    executable: path.join(packageRoot, "bin", "codex"),
    pathDirectories: existsSync(pathDirectory) ? [pathDirectory] : [],
  };
}

function bubblewrapExecutable(): string {
  try {
    return execFileSync("sh", ["-c", "command -v bwrap"], { encoding: "utf8" }).trim();
  } catch {
    throw new SandboxUnavailableError("bwrap não encontrado: sessões que gravam git exigem bubblewrap");
  }
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function bubblewrapArguments(request: CodexSandboxRequest, privateTemporary: string): string[] {
  const credentials = path.join(process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex"), "auth.json");
  const writable = [request.writableRoot, request.codexHome, ...(existsSync(credentials) ? [credentials] : [])];
  return [
    "--die-with-parent",
    "--ro-bind",
    "/",
    "/",
    "--dev",
    "/dev",
    "--proc",
    "/proc",
    "--bind",
    privateTemporary,
    os.tmpdir(),
    ...request.readableRoots.flatMap((directory) => ["--ro-bind", directory, directory]),
    ...writable.flatMap((directory) => ["--bind", directory, directory]),
    "--chdir",
    request.workingDirectory,
  ];
}

export async function sandboxCodex(request: CodexSandboxRequest): Promise<SandboxedCodex> {
  const bubblewrap = bubblewrapExecutable();
  const command: CodexCommand = request.usesPathCodex
    ? { executable: "codex", pathDirectories: [] }
    : bundledCodexCommand();
  const wrapperDirectory = await mkdtemp(path.join(os.tmpdir(), "agent-evals-codex-sandbox-"));
  const privateTemporary = path.join(wrapperDirectory, "tmp");
  const binary = path.join(wrapperDirectory, "codex");
  const pathPrefix = command.pathDirectories.map((directory) => `${shellQuote(directory)}:`).join("");
  const invocation = [bubblewrap, ...bubblewrapArguments(request, privateTemporary), "--", command.executable]
    .map(shellQuote)
    .join(" ");
  await writeFile(
    binary,
    `#!/bin/sh\nmkdir -p ${shellQuote(privateTemporary)}\nPATH=${pathPrefix}"$PATH" exec ${invocation} "$@"\n`,
  );
  await chmod(binary, 0o755);
  return { binary, dispose: () => rm(wrapperDirectory, { recursive: true, force: true }) };
}
