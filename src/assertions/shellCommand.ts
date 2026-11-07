import { spawn } from "node:child_process";

export interface ShellRequest {
  command: string;
  cwd: string;
  environment: Record<string, string>;
  stdin?: string;
  timeoutMs: number;
}

export interface ShellResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export function runShell(request: ShellRequest): Promise<ShellResult> {
  return new Promise((resolve) => {
    const child = spawn("sh", ["-c", request.command], {
      cwd: request.cwd,
      env: { ...process.env, ...request.environment },
      stdio: ["pipe", "pipe", "pipe"],
      detached: true,
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => (stdout += chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => (stderr += chunk));
    const timer = setTimeout(() => {
      timedOut = true;
      killProcessGroup(child.pid);
    }, request.timeoutMs);
    child.stdin.on("error", () => undefined);
    child.stdin.end(request.stdin ?? "");
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ exitCode: null, stdout, stderr: `${stderr}${error.message}`, timedOut });
    });
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve({ exitCode, stdout, stderr, timedOut });
    });
  });
}

function killProcessGroup(processId: number | undefined): void {
  if (processId === undefined) return;
  try {
    process.kill(-processId, "SIGKILL");
  } catch {
    return;
  }
}
