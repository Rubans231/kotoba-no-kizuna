export interface UserProfile {
  id: string;
  username: string;
  accountLevel: number;
  experiencePoints: number;
  unlockedAbilities: string[];
  createdAt: string;
}

export interface CompanionInstance {
  instanceId: string;
  characterId: string;
  affectionLevel: number;
  affectionXp: number;
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
