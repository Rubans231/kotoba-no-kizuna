import type { RelationshipStats } from '../../lib/relationship';

export interface UserProfile {
  id: string;
  username: string;
  accountLevel: number;
  experiencePoints: number;
  unlockedAbilities: string[];
  gems: number;
  pityCounter: number;
  createdAt: string;
}

export interface DailyCommission {
  commissionId: string;
  date: string; // YYYY-MM-DD
  target: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
  rewardGems: number;
}

export interface CompanionInstance {
  instanceId: string;
  characterId: string;
  affectionLevel: number;
  affectionXp: number;
  relationshipStats: RelationshipStats;
  currentOutfitId: string;
  isFavorite: boolean;
  unlockedVoiceLines: string[];
  updatedAt: string;
}

export interface ConversationLog {
  messageId: string;
  instanceId: string;
  sender: 'player' | 'companion';
  rawText: string;
  japaneseTokens?: string; 
  timestamp: string;
}

export interface SrsRecord {
  itemId: string;
  itemType: 'vocab' | 'kanji' | 'grammar';
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  nextReviewTime: string;
  lastReviewTime: string | null;
}
