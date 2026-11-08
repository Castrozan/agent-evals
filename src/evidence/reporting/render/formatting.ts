import type { CaseLevel } from "../../../domain/cases.js";
import type { VerdictStatus } from "../document/reportDocument.js";

export const LEVEL_LABELS: Record<CaseLevel, string> = {
  unit: "unidade",
  integration: "integração",
  "end-to-end": "ponta-a-ponta",
};

export const STATUS_LABELS: Record<VerdictStatus, string> = {
  approved: "aprovado",
  failed: "reprovado",
  invalid: "inválido",
};

export const STATUS_COLORS: Record<VerdictStatus, string> = {
  approved: "#2da44e",
  failed: "#cf222e",
  invalid: "#8c959f",
};

export function formatPercent(value: number | null): string {
  if (value === null) return "—";
  return `${(value * 100).toFixed(1).replace(".", ",")}%`;
}

export function formatSignedPoints(change: number): string {
  const points = (change * 100).toFixed(1).replace(".", ",");
  return `${change > 0 ? "+" : ""}${points} p.p.`;
}

export function formatUsd(value: number): string {
  return `US$ ${value.toFixed(2).replace(".", ",")}`;
}

export function formatDuration(seconds: number): string {
  const rounded = Math.round(seconds);
  if (rounded < 60) return `${rounded} s`;
  const minutes = Math.floor(rounded / 60);
  if (minutes < 60) return `${minutes} min ${rounded % 60} s`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export function formatDate(isoTimestamp: string): string {
  return isoTimestamp.slice(0, 10);
}
