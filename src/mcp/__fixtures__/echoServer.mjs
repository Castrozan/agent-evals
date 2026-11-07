import { createInterface } from "node:readline";

const tools = [
  {
    name: "echo",
    description: "Repete o texto",
    inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
  },
  { name: "ping", inputSchema: { type: "object", properties: {} } },
];

function send(message) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
}

createInterface({ input: process.stdin }).on("line", (line) => {
  const { id, method, params } = JSON.parse(line);
  if (id === undefined) return;
  if (method === "initialize") {
    send({
      id,
      result: {
        protocolVersion: params.protocolVersion,
        capabilities: { tools: {} },
        serverInfo: { name: "echo", version: "1" },
      },
    });
  } else if (method === "tools/list") {
    send({ id, result: { tools } });
  } else if (method === "tools/call" && params.name === "echo") {
    send({ id, result: { content: [{ type: "text", text: params.arguments.text }] } });
  } else if (method === "tools/call" && params.name === "hang") {
    return;
  } else {
    send({ id, error: { code: -32601, message: `desconhecido: ${method}` } });
  }
});
