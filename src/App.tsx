import { useEffect, useState } from 'react';
import { DevSandbox } from './features/language-engine/components/DevSandbox';
import { ChatPanel } from './features/chat/components/ChatPanel';
import { ReviewSession } from './features/srs/components/ReviewSession';
import { useBoundStore } from './store/useBoundStore';
import { COMPANIONS } from './data/companions';
import * as db from './lib/db';

type Tab = 'chat' | 'review' | 'sandbox';

const DEV_USER_ID = 'usr_dev_test_01';

function App() {
  const [tab, setTab] = useState<Tab>('chat');
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const setProfile = useBoundStore((s) => s.setProfile);
  const setCompanions = useBoundStore((s) => s.setCompanions);
  const setSrsRecords = useBoundStore((s) => s.setSrsRecords);
  const setActiveCompanion = useBoundStore((s) => s.setActiveCompanion);
  const setConversation = useBoundStore((s) => s.setConversation);
  const activeCompanionId = useBoundStore((s) => s.activeCompanionId);

  useEffect(() => {
    (async () => {
      try {
        let profile = await db.loadProfile(DEV_USER_ID);
        if (!profile) {
          profile = {
            id: DEV_USER_ID,
            username: 'Robin_Learner',
            accountLevel: 1,
            experiencePoints: 0,
            unlockedAbilities: [],
            createdAt: new Date().toISOString(),
          };
          await db.saveProfile(profile);
        }
        setProfile(profile);

        let companions = await db.loadCompanions();
        if (companions.length === 0) {
          companions = Object.keys(COMPANIONS).map((characterId) => ({
            instanceId: `inst_${characterId}`,
            characterId,
            affectionLevel: 1,
            affectionXp: 0,
            currentOutfitId: 'default',
            isFavorite: false,
            unlockedVoiceLines: [],
            updatedAt: new Date().toISOString(),
          }));
          for (const c of companions) await db.upsertCompanion(c);
        }
        setCompanions(companions);
        setActiveCompanion(companions[0]?.instanceId ?? null);

        for (const c of companions) {
          const log = await db.loadConversation(c.instanceId);
          setConversation(c.instanceId, log);
        }

        const srsRecords = await db.loadSrsRecords();
        setSrsRecords(srsRecords);

        setReady(true);
      } catch (err) {
        setInitError(err instanceof Error ? err.message : String(err));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (initError) {
    return (
      <div style={{ padding: 40, color: '#ff6b6b' }}>
        Failed to initialize the database: {initError}
      </div>
    );
  }

  if (!ready) {
    return <div style={{ padding: 40, color: '#888' }}>Loading Kotoba no Kizuna...</div>;
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#111',
        color: '#eee',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <nav style={{ display: 'flex', gap: 4, padding: 12, borderBottom: '1px solid #333' }}>
        {(['chat', 'review', 'sandbox'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 14px',
              borderRadius: 6,
              border: 'none',
              background: tab === t ? '#007acc' : '#2a2a2a',
              color: '#fff',
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {t}
          </button>
        ))}
      </nav>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {tab === 'chat' && activeCompanionId && <ChatPanel instanceId={activeCompanionId} />}
        {tab === 'review' && <ReviewSession />}
        {tab === 'sandbox' && <DevSandbox />}
      </div>
    </div>
  );
}

export default App;
