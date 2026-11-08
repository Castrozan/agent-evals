export interface LabelledVerdict {
  expected: boolean;
  actual: boolean;
}

export interface AgreementMetrics {
  items: number;
  accuracy: number;
  balancedAccuracy: number;
  recall: number;
  specificity: number;
  kappa: number;
}

export function agreementMetrics(verdicts: readonly LabelledVerdict[]): AgreementMetrics {
  const items = verdicts.length;
  if (items === 0) return { items, accuracy: 0, balancedAccuracy: 0, recall: 0, specificity: 0, kappa: 0 };
  const truePositive = verdicts.filter((verdict) => verdict.expected && verdict.actual).length;
  const trueNegative = verdicts.filter((verdict) => !verdict.expected && !verdict.actual).length;
  const expectedPositive = verdicts.filter((verdict) => verdict.expected).length;
  const actualPositive = verdicts.filter((verdict) => verdict.actual).length;
  const expectedNegative = items - expectedPositive;
  const accuracy = (truePositive + trueNegative) / items;
  const recall = expectedPositive === 0 ? 1 : truePositive / expectedPositive;
  const specificity = expectedNegative === 0 ? 1 : trueNegative / expectedNegative;
  const chanceAgreement =
    (expectedPositive / items) * (actualPositive / items) +
    (expectedNegative / items) * ((items - actualPositive) / items);
  const kappa = chanceAgreement === 1 ? (accuracy === 1 ? 1 : 0) : (accuracy - chanceAgreement) / (1 - chanceAgreement);
  return { items, accuracy, balancedAccuracy: (recall + specificity) / 2, recall, specificity, kappa };
}
