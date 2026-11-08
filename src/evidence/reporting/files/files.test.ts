import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { caseResult, config, passingVerdict, runOf } from "../__fixtures__/reportFixtures.js";
import { buildReportDocument } from "../document/buildReportDocument.js";
import { buildPagesDirectory } from "../pages/buildPagesDirectory.js";
import { pagesUrl, readmeBadgeLine } from "../pages/pagesUrl.js";
import { buildSnapshotEvent, publishSnapshot } from "../snapshot/snapshot.js";
import { readReportDocument, writeReport } from "./writeReport.js";

const document = buildReportDocument({
  config,
  run: runOf([caseResult("one", [true])]),
  verdict: passingVerdict,
  coverage: [],
  pendingCaseKeys: [],
});

describe("report files, pages and snapshot", () => {
  it("writes, reads back, and publishes pages", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "reporting-"));
    const pagesConfig = { ...config, root, reportPath: "out/relatorio.html", pagesDirectory: "public" };
    await expect(buildPagesDirectory(pagesConfig)).rejects.toThrow("Nenhum relatório");
    const paths = await writeReport(document, path.join(root, "out/relatorio.html"));
    expect(paths.jsonPath).toBe(path.join(root, "out/relatorio.json"));
    expect(await readReportDocument(paths.jsonPath)).toEqual(JSON.parse(JSON.stringify(document)));
    const directory = await buildPagesDirectory(pagesConfig);
    expect((await fs.readdir(directory)).sort()).toEqual(["badge.svg", "index.html", "report.json"]);
    await fs.writeFile(paths.jsonPath, '{"schemaVersion":99}');
    await expect(readReportDocument(paths.jsonPath)).rejects.toThrow("formato incompatível");
  });

  it("derives the pages url from remotes", () => {
    for (const remote of [
      "https://github.com/Owner/repo.git",
      "git@github.com:Owner/repo.git",
      "ssh://git@github.com/Owner/repo",
    ]) {
      expect(pagesUrl({}, remote)).toBe("https://owner.github.io/repo/");
    }
    expect(pagesUrl({ pagesUrl: "https://x.dev/a" }, undefined)).toBe("https://x.dev/a/");
    expect(() => pagesUrl({}, "https://gitlab.com/a/b")).toThrow("paginas_url");
    expect(readmeBadgeLine("https://x.dev/")).toBe("[![agent-evals](https://x.dev/badge.svg)](https://x.dev/)");
  });

  it("posts the snapshot and reports non-2xx in Portuguese", async () => {
    const event = buildSnapshotEvent(document);
    const calls: { url: string; init?: RequestInit }[] = [];
    const ok = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return new Response("", { status: 200 });
    }) as unknown as typeof fetch;
    await publishSnapshot("https://x.dev/in", event, ok);
    expect(calls[0]?.init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0]?.init?.body)).project).toBe("demo");
    const refused = (async () => new Response("", { status: 500 })) as unknown as typeof fetch;
    await expect(publishSnapshot("https://x.dev/in", event, refused)).rejects.toThrow("HTTP 500");
  });
});
