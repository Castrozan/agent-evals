import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:net";

export interface OpencodeServer {
  baseUrl: string;
  password: string;
  close(): Promise<void>;
}

export interface OpencodeServerRequest {
  directory: string;
  configuration: Record<string, unknown>;
  environment: Record<string, string>;
  signal: AbortSignal;
  command?: string;
  startupTimeoutMs?: number;
}

const FORCE_KILL_DELAY_MS = 3000;

export function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

function signalGroup(processId: number | undefined, signal: NodeJS.Signals): void {
  if (!processId) return;
  try {
    process.kill(-processId, signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
}

export async function startOpencodeServer(request: OpencodeServerRequest): Promise<OpencodeServer> {
  const { directory, configuration, environment, signal, command = "opencode", startupTimeoutMs = 15000 } = request;
  signal.throwIfAborted();
  const port = await findFreePort();
  const password = randomUUID();
  const child = spawn(command, ["serve", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: directory,
    env: {
      ...environment,
      OPENCODE_PASSWORD: password,
      OPENCODE_CONFIG_CONTENT: JSON.stringify(configuration),
      OPENCODE_DISABLE_AUTOUPDATE: "true",
    },
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const closed = once(child, "close").catch(() => undefined);
  const close = async () => {
    const force = setTimeout(() => signalGroup(child.pid, "SIGKILL"), FORCE_KILL_DELAY_MS);
    signalGroup(child.pid, "SIGTERM");
    try {
      await closed;
    } finally {
      clearTimeout(force);
    }
  };
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await waitForListening(child, baseUrl, signal, startupTimeoutMs);
  } catch (error) {
    await close();
    throw error;
  }
  return { baseUrl, password, close };
}

function waitForListening(
  child: ReturnType<typeof spawn>,
  baseUrl: string,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let output = "";
    const finish = (error?: unknown) => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      child.removeListener("error", finish);
      child.removeListener("exit", onExit);
      child.stdout?.removeListener("data", receive);
      child.stderr?.removeListener("data", receive);
      child.stdout?.resume();
      child.stderr?.resume();
      if (error) reject(error);
      else resolve();
    };
    const onAbort = () => finish(signal.reason);
    const onExit = (code: number | null) =>
      finish(new Error(`O servidor do opencode terminou durante a inicialização (código ${code}).`));
    const receive = (chunk: Buffer) => {
      output = (output + chunk.toString()).slice(-8192);
      if (output.includes(`server listening on ${baseUrl}`)) finish();
    };
    const timer = setTimeout(
      () => finish(new Error(`O servidor do opencode não iniciou em ${Math.round(timeoutMs / 1000)}s.`)),
      timeoutMs,
    );
    signal.addEventListener("abort", onAbort, { once: true });
    child.once("error", finish);
    child.once("exit", onExit);
    child.stdout?.on("data", receive);
    child.stderr?.on("data", receive);
  });
}
