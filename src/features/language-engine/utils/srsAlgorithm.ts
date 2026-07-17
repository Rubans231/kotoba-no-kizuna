export interface SrsInput {
  repetitions: number;
  easeFactor: number;
  intervalDays: number;
  grade: number; // 0 to 5
}

export interface SrsOutput {
  repetitions: number;
  easeFactor: number;
  intervalDays: number;
  nextReviewTime: string;
}

export const calculateSm2 = (input: SrsInput): SrsOutput => {
  let { repetitions, easeFactor, intervalDays, grade } = input;

  // If the user forgot the item (grade < 3), reset interval and repetitions
  if (grade < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    if (repetitions === 0) {
      intervalDays = 1;
    } else if (repetitions === 1) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(intervalDays * easeFactor);
    }
    repetitions++;
  }

  // Calculate new Ease Factor (SM-2 standard formula)
  // EF' = EF + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))
  easeFactor = easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));

  // Enforce a minimum ease factor of 1.3 so cards don't get stuck in an infinite loop
  if (easeFactor < 1.3) {
    easeFactor = 1.3;
  }

  // Calculate the exact timestamp for the next review
  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + intervalDays);

  return {
    repetitions,
    easeFactor: parseFloat(easeFactor.toFixed(2)),
    intervalDays,
    nextReviewTime: nextReview.toISOString(),
  };
};
