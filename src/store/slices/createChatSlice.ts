import type { StateCreator } from 'zustand';
import type { ConversationLog } from '../../core/types/database';

export interface ChatSlice {
  conversations: Record<string, ConversationLog[]>; // keyed by companion instanceId
  appendMessage: (instanceId: string, message: ConversationLog) => void;
  setConversation: (instanceId: string, messages: ConversationLog[]) => void;
}

export const createChatSlice: StateCreator<ChatSlice> = (set) => ({
  conversations: {},
  appendMessage: (instanceId, message) =>
    set((state) => ({
      conversations: {
        ...state.conversations,
        [instanceId]: [...(state.conversations[instanceId] || []), message],
      },
    })),
  setConversation: (instanceId, messages) =>
    set((state) => ({
      conversations: { ...state.conversations, [instanceId]: messages },
    })),
});
