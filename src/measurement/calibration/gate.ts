export const MINIMUM_ACCURACY = 0.8;
export const MINIMUM_KAPPA = 0.6;

export interface CalibrationGateResult {
  passed: boolean;
  failures: string[];
}

export function checkCalibrationGate(metrics: { accuracy: number; kappa: number }): CalibrationGateResult {
  const failures: string[] = [];
  if (metrics.accuracy < MINIMUM_ACCURACY) {
    failures.push(`Acurácia de ${metrics.accuracy.toFixed(2)} abaixo do mínimo de ${MINIMUM_ACCURACY.toFixed(2)}.`);
  }
  if (metrics.kappa < MINIMUM_KAPPA) {
    failures.push(`Kappa de ${metrics.kappa.toFixed(2)} abaixo do mínimo de ${MINIMUM_KAPPA.toFixed(2)}.`);
  }
  return { passed: failures.length === 0, failures };
}

export function verdictFlips(passesPerItem: readonly (readonly boolean[])[]): number[] {
  return passesPerItem.flatMap((verdicts, index) => (new Set(verdicts).size > 1 ? [index] : []));
}
