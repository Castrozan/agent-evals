import path from "node:path";

export interface ReportPaths {
  directory: string;
  htmlPath: string;
  jsonPath: string;
  badgePath: string;
}

export function reportPathsFor(reportPath: string): ReportPaths {
  const parsed = path.parse(reportPath);
  return {
    directory: parsed.dir,
    htmlPath: reportPath,
    jsonPath: path.join(parsed.dir, `${parsed.name}.json`),
    badgePath: path.join(parsed.dir, "badge.svg"),
  };
}
