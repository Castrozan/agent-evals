import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { connectMcpServer } from "./stdioClient.js";

const fixture = path.join(path.dirname(fileURLToPath(import.meta.url)), "__fixtures__", "echoServer.mjs");
const server = { name: "echo", command: [process.execPath, fixture], environment: {} };

describe("connectMcpServer", () => {
  it("lists tools and calls a handler", async () => {
    const client = await connectMcpServer(server);
    try {
      const tools = await client.listTools();
      expect(tools.map((tool) => tool.name)).toEqual(["echo", "ping"]);
      expect(tools[0]?.inputSchema?.required).toEqual(["text"]);
      const result = await client.callTool("echo", { text: "olá" });
      expect(result).toMatchObject({ isError: false, text: "olá" });
    } finally {
      await client.close();
    }
  });

  it("surfaces JSON-RPC errors", async () => {
    const client = await connectMcpServer(server);
    try {
      await expect(client.callTool("missing", {})).rejects.toThrow(/desconhecido: tools\/call/);
    } finally {
      await client.close();
    }
  });

  it("times out when the server never answers", async () => {
    const client = await connectMcpServer(server, { timeoutMilliseconds: 300 });
    try {
      await expect(client.callTool("hang", {})).rejects.toThrow(/tempo esgotado/);
    } finally {
      await client.close();
    }
  });

  it("fails when the executable does not exist", async () => {
    await expect(connectMcpServer({ name: "x", command: ["/nonexistent-binary"], environment: {} })).rejects.toThrow(
      /não iniciou/,
    );
  });
});
