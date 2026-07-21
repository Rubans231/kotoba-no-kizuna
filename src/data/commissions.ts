export interface CommissionDefinition {
  commissionId: string;
  title: string;
  description: string;
  target: number;
  rewardGems: number;
}

export const COMMISSION_DEFINITIONS: CommissionDefinition[] = [
  {
    commissionId: 'daily_talk',
    title: 'Say hello',
    description: 'Send at least 1 message to a companion today.',
    target: 1,
    rewardGems: 20,
  },
  {
    commissionId: 'daily_learn_words',
    title: 'Learn something new',
    description: 'Have a companion teach you 3 new words today.',
    target: 3,
    rewardGems: 40,
  },
  {
    commissionId: 'daily_review',
    title: 'Keep it fresh',
    description: 'Complete 10 SRS reviews today.',
    target: 10,
    rewardGems: 30,
  },
];

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}
