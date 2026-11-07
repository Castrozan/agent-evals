import type { ProjectConfig } from "../../domain/project.js";

const GITHUB_REMOTE =
  /^(?:https?:\/\/(?:[^@/]+@)?github\.com\/|ssh:\/\/git@github\.com\/|git@github\.com:)([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i;

export function pagesUrl(config: Pick<ProjectConfig, "pagesUrl">, originRemoteUrl: string | undefined): string {
  if (config.pagesUrl) return config.pagesUrl.endsWith("/") ? config.pagesUrl : `${config.pagesUrl}/`;
  const match = originRemoteUrl ? GITHUB_REMOTE.exec(originRemoteUrl.trim()) : null;
  if (!match?.[1] || !match[2]) {
    throw new Error(
      "Não foi possível derivar a URL do GitHub Pages a partir do remoto origin; defina `paginas_url` no evals/config.yaml.",
    );
  }
  const host = `${match[1].toLowerCase()}.github.io`;
  return match[2].toLowerCase() === host ? `https://${host}/` : `https://${host}/${match[2]}/`;
}

export function readmeBadgeLine(url: string): string {
  return `[![agent-evals](${url}badge.svg)](${url})`;
}
