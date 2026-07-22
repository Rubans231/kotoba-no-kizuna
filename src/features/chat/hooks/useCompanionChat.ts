import { useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useBoundStore } from '../../../store/useBoundStore';
import { COMPANIONS } from '../../../data/companions';
import { buildSystemPrompt } from '../../../core/types/companion';
import type { CompanionReply } from '../../../core/types/companion';
import { appendConversationLog, upsertSrsRecord, upsertCompanion, upsertCommission, upsertVocabDictionaryEntry, saveProfile } from '../../../lib/db';
import { ABILITY_DEFINITIONS } from '../../../data/abilities';
import { checkForNewUnlocks } from '../../../lib/abilityUnlocks';

export function useCompanionChat(instanceId: string) {
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const companions = useBoundStore((s) => s.companions);
  const conversations = useBoundStore((s) => s.conversations);
  const srsRecords = useBoundStore((s) => s.srsRecords);
  const appendMessage = useBoundStore((s) => s.appendMessage);
  const updateAffection = useBoundStore((s) => s.updateAffection);
  const updateRelationshipStats = useBoundStore((s) => s.updateRelationshipStats);
  const upsertRecordInStore = useBoundStore((s) => s.upsertRecord);
  const incrementCommission = useBoundStore((s) => s.incrementCommission);
  const upsertVocabEntryInStore = useBoundStore((s) => s.upsertVocabEntry);
  const profile = useBoundStore((s) => s.profile);
  const unlockAbility = useBoundStore((s) => s.unlockAbility);
  const setHasUnseenAbilityUnlock = useBoundStore((s) => s.setHasUnseenAbilityUnlock);

  const sendMessage = useCallback(
    async (userText: string) => {
      const instance = companions[instanceId];
      if (!instance) {
        setError('No active companion instance.');
        return;
      }
      const persona = COMPANIONS[instance.characterId];
      if (!persona) {
        setError(`Unknown persona for character ${instance.characterId}`);
        return;
      }

      setIsSending(true);
      setError(null);

      const history = conversations[instanceId] || [];
      const playerMsg = {
        messageId: crypto.randomUUID(),
        instanceId,
        sender: 'player' as const,
        rawText: userText,
        timestamp: new Date().toISOString(),
      };
      appendMessage(instanceId, playerMsg);
      void appendConversationLog(playerMsg);

      const knownVocab = Object.values(srsRecords)
        .filter((r) => r.repetitions > 0)
        .map((r) => r.itemId.split(':')[1])
        .filter(Boolean);

      const enabledEffects = (profile?.enabledAbilities ?? [])
        .map((id) => ABILITY_DEFINITIONS.find((d) => d.abilityId === id)?.effect)
        .filter((e): e is NonNullable<typeof e> => Boolean(e));

      const systemPrompt = buildSystemPrompt(persona, {
        relationshipStats: instance.relationshipStats,
        knownVocab,
        targetLevel: 'N5',
        enabledEffects,
      });

      const historyForApi = history.map((m) => ({
        role: m.sender === 'player' ? 'user' : 'assistant',
        content: m.rawText,
      }));

      try {
        const raw = await invoke<string>('send_chat_message', {
          systemPrompt,
          history: historyForApi,
          userMessage: userText,
        });

        const cleaned = raw
          .trim()
          .replace(/^```json/i, '')
          .replace(/^```/, '')
          .replace(/```$/, '')
          .trim();
        const parsed: CompanionReply = JSON.parse(cleaned);

        const companionMsg = {
          messageId: crypto.randomUUID(),
          instanceId,
          sender: 'companion' as const,
          rawText: parsed.speech,
          japaneseTokens: JSON.stringify(parsed.vocab_introduced),
          timestamp: new Date().toISOString(),
        };
        appendMessage(instanceId, companionMsg);
        void appendConversationLog(companionMsg);

        // Register newly introduced vocab into the SRS deck.
        for (const v of parsed.vocab_introduced) {
          const itemId = `vocab:${v.word}`;
          if (!srsRecords[itemId]) {
            const record = {
              itemId,
              itemType: 'vocab' as const,
              easeFactor: 2.5,
              intervalDays: 0,
              repetitions: 0,
              nextReviewTime: new Date().toISOString(),
              lastReviewTime: null,
            };
            upsertRecordInStore(record);
            void upsertSrsRecord(record);
          }

          // Always upsert the dictionary entry (not just on first sight) -
          // a higher-rarity companion re-teaching a word already in the
          // deck can fill in nuance/mnemonic that a 3-star companion left
          // blank the first time. upsertVocabEntry never clobbers existing
          // non-empty detail with blanker data.
          const vocabEntry = {
            word: v.word,
            reading: v.reading,
            meaning: v.meaning,
            nuance: v.nuance,
            mnemonic: v.mnemonic,
            relatedWords: v.related_words,
            taughtByCharacterId: instance.characterId,
            firstTaughtAt: new Date().toISOString(),
          };
          upsertVocabEntryInStore(vocabEntry);
          void upsertVocabDictionaryEntry(vocabEntry);
        }

        updateAffection(instanceId, parsed.relationship_delta.affection);
        updateRelationshipStats(instanceId, {
          affection: parsed.relationship_delta.affection,
          trust: parsed.relationship_delta.trust,
          respect: parsed.relationship_delta.respect,
          comfort: parsed.relationship_delta.comfort,
          friendship: parsed.relationship_delta.friendship,
          studyCompatibility: parsed.relationship_delta.study_compatibility,
          sharedMemories: parsed.relationship_delta.shared_memories,
        });
        const updatedInstance = useBoundStore.getState().companions[instanceId];
        if (updatedInstance) void upsertCompanion(updatedInstance);

        // Check whether reaching a new bond level with this (or any)
        // companion just unlocked a global ability passive.
        const currentProfile = useBoundStore.getState().profile;
        if (currentProfile) {
          const newlyUnlocked = checkForNewUnlocks(
            useBoundStore.getState().companions,
            currentProfile.unlockedAbilities,
          );
          if (newlyUnlocked.length > 0) {
            for (const abilityId of newlyUnlocked) {
              unlockAbility(abilityId);
            }
            setHasUnseenAbilityUnlock(true);
            const profileAfterUnlock = useBoundStore.getState().profile;
            if (profileAfterUnlock) void saveProfile(profileAfterUnlock);
          }
        }

        const talkProgress = incrementCommission('daily_talk', 1);
        if (talkProgress) void upsertCommission(talkProgress);

        if (parsed.vocab_introduced.length > 0) {
          const learnProgress = incrementCommission(
            'daily_learn_words',
            parsed.vocab_introduced.length,
          );
          if (learnProgress) void upsertCommission(learnProgress);
        }

        return parsed;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        return undefined;
      } finally {
        setIsSending(false);
      }
    },
    [instanceId, companions, conversations, srsRecords, appendMessage, updateAffection, updateRelationshipStats, upsertRecordInStore, incrementCommission, upsertVocabEntryInStore, profile, unlockAbility, setHasUnseenAbilityUnlock],
  );

  return { sendMessage, isSending, error };
}
