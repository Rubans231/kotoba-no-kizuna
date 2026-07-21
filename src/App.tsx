import { useEffect, useState } from 'react';
import { DevSandbox } from './features/language-engine/components/DevSandbox';
import { ChatPanel } from './features/chat/components/ChatPanel';
import { ReviewSession } from './features/srs/components/ReviewSession';
import { CommissionsPanel } from './features/commissions/components/CommissionsPanel';
import { GachaScreen } from './features/gacha/components/GachaScreen';
import { useBoundStore } from './store/useBoundStore';
import { COMMISSION_DEFINITIONS, todayKey } from './data/commissions';
import { COMPANIONS } from './data/companions';
import { defaultRelationshipStats } from './lib/relationship';
import * as db from './lib/db';

type Tab = 'chat' | 'review' | 'commissions' | 'gacha' | 'sandbox';

const DEV_USER_ID = 'usr_dev_test_01';
const STARTER_CHARACTER_ID = 'rin_slang';

function App() {
  const [tab, setTab] = useState<Tab>('chat');
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const setProfile = useBoundStore((s) => s.setProfile);
  const setCompanions = useBoundStore((s) => s.setCompanions);
  const setSrsRecords = useBoundStore((s) => s.setSrsRecords);
  const setActiveCompanion = useBoundStore((s) => s.setActiveCompanion);
  const setConversation = useBoundStore((s) => s.setConversation);
  const setCommissions = useBoundStore((s) => s.setCommissions);
  const activeCompanionId = useBoundStore((s) => s.activeCompanionId);
  const companions = useBoundStore((s) => s.companions);
  const profile = useBoundStore((s) => s.profile);

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
            gems: 300,
            pityCounter: 0,
            createdAt: new Date().toISOString(),
          };
          await db.saveProfile(profile);
        }
        setProfile(profile);

        // Only one companion is free at the start - the rest are earned
        // through the gacha, matching the "meet a new companion" loop.
        let companions = await db.loadCompanions();
        if (companions.length === 0) {
          const starter = {
            instanceId: `inst_${STARTER_CHARACTER_ID}`,
            characterId: STARTER_CHARACTER_ID,
            affectionLevel: 1,
            affectionXp: 0,
            relationshipStats: defaultRelationshipStats(),
            currentOutfitId: 'default',
            isFavorite: false,
            unlockedVoiceLines: [],
            updatedAt: new Date().toISOString(),
          };
          await db.upsertCompanion(starter);
          companions = [starter];
        }
        setCompanions(companions);
        setActiveCompanion(companions[0]?.instanceId ?? null);

        for (const c of companions) {
          const log = await db.loadConversation(c.instanceId);
          setConversation(c.instanceId, log);
        }

        const srsRecords = await db.loadSrsRecords();
        setSrsRecords(srsRecords);

        // Seed today's commissions if this is the first launch today.
        const today = todayKey();
        let commissions = await db.loadCommissions(today);
        if (commissions.length === 0) {
          commissions = COMMISSION_DEFINITIONS.map((def) => ({
            commissionId: def.commissionId,
            date: today,
            target: def.target,
            progress: 0,
            completed: false,
            claimed: false,
            rewardGems: def.rewardGems,
          }));
          for (const c of commissions) await db.upsertCommission(c);
        }
        setCommissions(commissions);

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
      <nav
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 12,
          borderBottom: '1px solid #333',
        }}
      >
        <div style={{ display: 'flex', gap: 4 }}>
          {(['chat', 'review', 'commissions', 'gacha', 'sandbox'] as Tab[]).map((t) => (
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
        </div>
        <div style={{ color: '#ffd166', fontSize: 14 }}>{profile?.gems ?? 0} gems</div>
      </nav>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {tab === 'chat' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {Object.keys(companions).length > 1 && (
              <div style={{ display: 'flex', gap: 6, padding: '10px 16px', borderBottom: '1px solid #222' }}>
                {Object.values(companions).map((c) => (
                  <button
                    key={c.instanceId}
                    onClick={() => setActiveCompanion(c.instanceId)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 14,
                      border: 'none',
                      fontSize: 12,
                      background: activeCompanionId === c.instanceId ? '#007acc' : '#2a2a2a',
                      color: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    {COMPANIONS[c.characterId]?.displayName ?? c.characterId}
                  </button>
                ))}
              </div>
            )}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              {activeCompanionId && <ChatPanel instanceId={activeCompanionId} />}
            </div>
          </div>
        )}
        {tab === 'review' && <ReviewSession />}
        {tab === 'commissions' && <CommissionsPanel />}
        {tab === 'gacha' && <GachaScreen />}
        {tab === 'sandbox' && <DevSandbox />}
      </div>
    </div>
  );
}

export default App;
