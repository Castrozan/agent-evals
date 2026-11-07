import type { McpCase } from "../../domain/cases.js";
import { caseKey } from "../../domain/cases.js";
import type { AssertionOutcome, SampleResult } from "../../domain/results.js";
import { connectMcpServer, type McpClient } from "../../mcp/stdioClient.js";
import { EMPTY_TOKEN_USAGE } from "./sampleRuntime.js";

async function checkContract(evalCase: McpCase, client: McpClient): Promise<AssertionOutcome[]> {
  const liveTools = await client.listTools();
  const outcomes: AssertionOutcome[] = [];
  for (const expected of evalCase.contract) {
    const live = liveTools.find((tool) => tool.name === expected.name);
    if (live === undefined) {
      outcomes.push({
        kind: "contract",
        passed: false,
        message: `Ferramenta "${expected.name}" ausente em tools/list.`,
      });
      continue;
    }
    const liveRequired = live.inputSchema?.required ?? [];
    const missing = expected.required.filter((parameter) => !liveRequired.includes(parameter));
    outcomes.push({
      kind: "contract",
      passed: missing.length === 0,
      message:
        missing.length === 0
          ? `Ferramenta "${expected.name}" cumpre o contrato.`
          : `Ferramenta "${expected.name}" sem parâmetro obrigatório: ${missing.join(", ")}.`,
    });
  }
  if (evalCase.strict) {
    const declared = new Set(evalCase.contract.map((tool) => tool.name));
    const extra = liveTools.filter((tool) => !declared.has(tool.name)).map((tool) => tool.name);
    outcomes.push({
      kind: "contract",
      passed: extra.length === 0,
      message:
        extra.length === 0
          ? "Nenhuma ferramenta fora do contrato."
          : `Ferramentas fora do contrato: ${extra.join(", ")}.`,
    });
  }
  return outcomes;
}

async function checkCalls(
  evalCase: McpCase,
  client: McpClient,
): Promise<{ outcomes: AssertionOutcome[]; output: string }> {
  const outcomes: AssertionOutcome[] = [];
  const outputs: string[] = [];
  for (const call of evalCase.calls) {
    try {
      const result = await client.callTool(call.tool, call.arguments);
      outputs.push(result.text);
      if (result.isError) {
        outcomes.push({
          kind: "call",
          passed: false,
          message: `Chamada a "${call.tool}" retornou erro: ${result.text}`,
        });
        continue;
      }
      const normalized = result.text.toLowerCase();
      for (const text of call.contains) {
        const found = normalized.includes(text.toLowerCase());
        outcomes.push({
          kind: "call",
          passed: found,
          message: `Chamada a "${call.tool}": ${found ? "contém" : "não contém"} "${text}".`,
        });
      }
      if (call.contains.length === 0) {
        outcomes.push({ kind: "call", passed: true, message: `Chamada a "${call.tool}" concluída.` });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      outcomes.push({ kind: "call", passed: false, message: `Chamada a "${call.tool}" falhou: ${message}` });
    }
  }
  return { outcomes, output: outputs.join("\n") };
}

export async function runMcpSample(
  evalCase: McpCase,
  root: string,
  defaultTimeoutSeconds: number,
): Promise<SampleResult> {
  const started = Date.now();
  const timeoutSeconds = evalCase.timeoutSeconds ?? defaultTimeoutSeconds;
  let assertions: AssertionOutcome[];
  let output = "";
  let client: McpClient | undefined;
  try {
    client = await connectMcpServer(evalCase.server, { cwd: root, timeoutMilliseconds: timeoutSeconds * 1000 });
    const calls = await checkCalls(evalCase, client);
    assertions = [...(await checkContract(evalCase, client)), ...calls.outcomes];
    output = calls.output;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assertions = [
      { kind: "connection", passed: false, message: `Falha no servidor MCP "${evalCase.server.name}": ${message}` },
    ];
  } finally {
    await client?.close();
  }
  return {
    caseKey: caseKey(evalCase),
    repetition: 1,
    passed: assertions.every((assertion) => assertion.passed),
    assertions,
    output,
    tokenUsage: EMPTY_TOKEN_USAGE,
    toolOutputCharacters: 0,
    durationMs: Date.now() - started,
  };
}
