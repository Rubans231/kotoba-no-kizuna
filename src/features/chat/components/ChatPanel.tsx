import { useState } from 'react';
import { useBoundStore } from '../../../store/useBoundStore';
import { useCompanionChat } from '../hooks/useCompanionChat';
import { COMPANIONS } from '../../../data/companions';

interface ChatPanelProps {
  instanceId: string;
}

export function ChatPanel({ instanceId }: ChatPanelProps) {
  const [draft, setDraft] = useState('');
  const instance = useBoundStore((s) => s.companions[instanceId]);
  const messages = useBoundStore((s) => s.conversations[instanceId] || []);
  const { sendMessage, isSending, error } = useCompanionChat(instanceId);

  if (!instance) return <div style={{ padding: 24, color: '#888' }}>Loading companion...</div>;
  const persona = COMPANIONS[instance.characterId];

  const handleSend = async () => {
    if (!draft.trim() || isSending) return;
    const text = draft;
    setDraft('');
    await sendMessage(text);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxWidth: 640,
        margin: '0 auto',
      }}
    >
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #333' }}>
        <strong>{persona.displayName}</strong>
        <span style={{ marginLeft: 8, color: '#888', fontSize: 13 }}>
          {persona.specialty} · Lv.{instance.affectionLevel}
        </span>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {messages.length === 0 && (
          <div style={{ color: '#666', fontStyle: 'italic' }}>
            Say hello to {persona.displayName} to start your first lesson.
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.messageId}
            style={{
              alignSelf: m.sender === 'player' ? 'flex-end' : 'flex-start',
              background: m.sender === 'player' ? '#007acc' : '#2a2a2a',
              color: '#fff',
              padding: '8px 12px',
              borderRadius: 12,
              maxWidth: '75%',
            }}
          >
            {m.rawText}
          </div>
        ))}
        {isSending && (
          <div style={{ color: '#888', fontStyle: 'italic' }}>
            {persona.displayName} is typing...
          </div>
        )}
      </div>

      {error && <div style={{ color: '#ff6b6b', padding: '0 16px 8px' }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8, padding: 16, borderTop: '1px solid #333' }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={`Talk to ${persona.displayName}...`}
          style={{
            flex: 1,
            padding: 10,
            borderRadius: 8,
            border: '1px solid #444',
            background: '#1a1a1a',
            color: '#fff',
          }}
        />
        <button
          onClick={handleSend}
          disabled={isSending}
          style={{
            padding: '10px 18px',
            borderRadius: 8,
            background: '#007acc',
            color: '#fff',
            border: 'none',
            cursor: isSending ? 'default' : 'pointer',
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
