import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { inheritedEnvironment } from "../inheritedEnvironment.js";
import { findFreePort, startOpencodeServer } from "./opencodeServer.js";

const environment = inheritedEnvironment({ environment: {}, removedEnvironment: [] });
const fakeCommand = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "__fixtures__", "fakeOpencode.mjs");

describe("opencode server", () => {
  it("finds a free port", async () => {
    expect(await findFreePort()).toBeGreaterThan(0);
  });

  it("starts on a free port and stops the process", async () => {
    expect(existsSync(fakeCommand)).toBe(true);
    const controller = new AbortController();
    const server = await startOpencodeServer({
      directory: process.cwd(),
      configuration: {},
      environment,
      signal: controller.signal,
      command: fakeCommand,
    });
    expect(server.baseUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    await server.close();
  });

  it("fails startup when the process exits early", async () => {
    await expect(
      startOpencodeServer({
        directory: process.cwd(),
        configuration: {},
        environment,
        signal: new AbortController().signal,
        command: "false",
      }),
    ).rejects.toThrow(/terminou durante a inicialização/);
  });
});
