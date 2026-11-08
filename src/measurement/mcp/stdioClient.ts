import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import type { McpServerDeclaration } from "../../domain/cases.js";

export const MCP_PROTOCOL_VERSION = "2025-06-18";
export const DEFAULT_MCP_TIMEOUT_MILLISECONDS = 15_000;

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: { required?: string[]; properties?: Record<string, unknown> };
}

export interface McpToolResult {
  isError: boolean;
  text: string;
  content: unknown[];
}

export interface McpClient {
  listTools(): Promise<McpTool[]>;
  callTool(name: string, argumentsValue: Record<string, unknown>): Promise<McpToolResult>;
  close(): Promise<void>;
}

export interface McpConnectionOptions {
  timeoutMilliseconds?: number;
  cwd?: string;
}

interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

interface JsonRpcMessage {
  id?: number;
  result?: unknown;
  error?: { message?: string };
}

class StdioMcpClient implements McpClient {
  private nextId = 1;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly exited: Promise<void>;
  private failure: Error | undefined;

  constructor(
    private readonly child: ChildProcessWithoutNullStreams,
    private readonly serverName: string,
    private readonly timeoutMilliseconds: number,
  ) {
    createInterface({ input: child.stdout }).on("line", (line) => this.receive(line));
    child.stderr.resume();
    child.stdin.on("error", () => undefined);
    this.exited = new Promise((resolve) => {
      child.on("error", (error) => {
        this.fail(new Error(`servidor MCP "${serverName}" não iniciou: ${error.message}`));
        resolve();
      });
      child.on("close", (code) => {
        this.fail(new Error(`servidor MCP "${serverName}" encerrou (código ${code})`));
        resolve();
      });
    });
  }

  private fail(error: Error): void {
    this.failure ??= error;
    for (const [id, request] of this.pending) {
      clearTimeout(request.timer);
      request.reject(this.failure);
      this.pending.delete(id);
    }
  }

  private receive(line: string): void {
    let message: JsonRpcMessage;
    try {
      message = JSON.parse(line) as JsonRpcMessage;
    } catch {
      return;
    }
    if (message.id === undefined) return;
    const request = this.pending.get(message.id);
    if (!request) return;
    this.pending.delete(message.id);
    clearTimeout(request.timer);
    if (message.error) {
      request.reject(new Error(`servidor MCP "${this.serverName}": ${message.error.message ?? "erro"}`));
    } else {
      request.resolve(message.result);
    }
  }

  private write(payload: Record<string, unknown>): void {
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", ...payload })}\n`);
  }

  request(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    if (this.failure) return Promise.reject(this.failure);
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new Error(
            `servidor MCP "${this.serverName}": tempo esgotado em ${method} após ${this.timeoutMilliseconds} ms`,
          ),
        );
      }, this.timeoutMilliseconds);
      this.pending.set(id, { resolve, reject, timer });
      this.write({ id, method, params });
    });
  }

  notify(method: string): void {
    this.write({ method });
  }

  async listTools(): Promise<McpTool[]> {
    const tools: McpTool[] = [];
    let cursor: string | undefined;
    do {
      const page = (await this.request("tools/list", cursor ? { cursor } : {})) as {
        tools?: McpTool[];
        nextCursor?: string;
      };
      tools.push(...(page.tools ?? []));
      cursor = page.nextCursor;
    } while (cursor);
    return tools;
  }

  async callTool(name: string, argumentsValue: Record<string, unknown>): Promise<McpToolResult> {
    const result = (await this.request("tools/call", { name, arguments: argumentsValue })) as {
      isError?: boolean;
      content?: { type?: string; text?: string }[];
    };
    const content = result.content ?? [];
    return {
      isError: result.isError === true,
      content,
      text: content
        .filter((item) => item.type === "text")
        .map((item) => item.text ?? "")
        .join("\n"),
    };
  }

  async close(): Promise<void> {
    this.child.stdin.end();
    const forced = setTimeout(() => this.child.kill("SIGKILL"), 2000);
    this.child.kill("SIGTERM");
    await this.exited;
    clearTimeout(forced);
  }
}

export async function connectMcpServer(
  server: McpServerDeclaration,
  options: McpConnectionOptions = {},
): Promise<McpClient> {
  const [executable, ...args] = server.command;
  if (executable === undefined) {
    throw new Error(`servidor MCP "${server.name}" sem comando`);
  }
  const child = spawn(executable, args, {
    cwd: options.cwd,
    env: { ...process.env, ...server.environment },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const client = new StdioMcpClient(
    child,
    server.name,
    options.timeoutMilliseconds ?? DEFAULT_MCP_TIMEOUT_MILLISECONDS,
  );
  try {
    await client.request("initialize", {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "agent-evals", version: "0.1.0" },
    });
    client.notify("notifications/initialized");
  } catch (error) {
    await client.close();
    throw error;
  }
  return client;
}
