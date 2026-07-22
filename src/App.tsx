import { useEffect, useState } from 'react';
import { DevSandbox } from './features/language-engine/components/DevSandbox';
import { ChatPanel } from './features/chat/components/ChatPanel';
import { ReviewSession } from './features/srs/components/ReviewSession';
import { CommissionsPanel } from './features/commissions/components/CommissionsPanel';
import { GachaScreen } from './features/gacha/components/GachaScreen';
import { AbilitiesPanel } from './features/abilities/components/AbilitiesPanel';
import { useBoundStore } from './store/useBoundStore';
import type { AppTab } from './store/slices/createUiSlice';
import { COMMISSION_DEFINITIONS, todayKey } from './data/commissions';
import { COMPANIONS } from './data/companions';
import { defaultRelationshipStats } from './lib/relationship';
import { checkForNewUnlocks } from './lib/abilityUnlocks';
import * as db from './lib/db';

const DEV_USER_ID = 'usr_dev_test_01';
const STARTER_CHARACTER_ID = 'rin_slang';

const TABS: AppTab[] = ['chat', 'review', 'commissions', 'gacha', 'abilities', 'sandbox'];

function App() {
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const setProfile = useBoundStore((s) => s.setProfile);
  const setCompanions = useBoundStore((s) => s.setCompanions);
  const setSrsRecords = useBoundStore((s) => s.setSrsRecords);
  const setActiveCompanion = useBoundStore((s) => s.setActiveCompanion);
  const setConversation = useBoundStore((s) => s.setConversation);
  const setCommissions = useBoundStore((s) => s.setCommissions);
  const setVocabDictionary = useBoundStore((s) => s.setVocabDictionary);
  const unlockAbility = useBoundStore((s) => s.unlockAbility);
  const hasUnseenAbilityUnlock = useBoundStore((s) => s.hasUnseenAbilityUnlock);
  const setHasUnseenAbilityUnlock = useBoundStore((s) => s.setHasUnseenAbilityUnlock);
  const activeCompanionId = useBoundStore((s) => s.activeCompanionId);
  const companions = useBoundStore((s) => s.companions);
  const profile = useBoundStore((s) => s.profile);
  const activeTab = useBoundStore((s) => s.activeTab);
  const setActiveTab = useBoundStore((s) => s.setActiveTab);

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
            enabledAbilities: [],
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

        const vocabDictionary = await db.loadVocabDictionary();
        setVocabDictionary(vocabDictionary);

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

        // Catch any abilities that already qualify from existing save data
        // (e.g. a bond level reached before this feature existed).
        const companionsMap = companions.reduce(
          (acc, c) => ({ ...acc, [c.instanceId]: c }),
          {} as Record<string, (typeof companions)[number]>,
        );
        const newlyUnlocked = checkForNewUnlocks(companionsMap, profile.unlockedAbilities);
        if (newlyUnlocked.length > 0) {
          for (const abilityId of newlyUnlocked) unlockAbility(abilityId);
          setHasUnseenAbilityUnlock(true);
          const profileAfterUnlock = useBoundStore.getState().profile;
          if (profileAfterUnlock) await db.saveProfile(profileAfterUnlock);
        }

        setReady(true);
      } catch (err) {
        setInitError(err instanceof Error ? err.message : String(err));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Defensive: if the active companion ever points at something that isn't
  // in the companions map (e.g. stale id, or the map re-seeded around it),
  // fall back to the first available companion instead of rendering a dead
  // end. Combined with the flex layout fix below, this is a belt-and-braces
  // guard, not the primary fix for the "blank screen after gacha" bug -
  // that turned out to be a CSS issue (see index.css).
  useEffect(() => {
    if (!ready) return;
    const ids = Object.keys(companions);
    if (ids.length === 0) return;
    if (!activeCompanionId || !companions[activeCompanionId]) {
      setActiveCompanion(ids[0]);
    }
  }, [ready, companions, activeCompanionId, setActiveCompanion]);

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
        height: '100%',
        background: '#111',
        color: '#eee',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <nav
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 12,
          borderBottom: '1px solid #333',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', gap: 4 }}>
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => {
                setActiveTab(t);
                if (t === 'abilities') setHasUnseenAbilityUnlock(false);
              }}
              style={{
                position: 'relative',
                padding: '8px 14px',
                borderRadius: 6,
                border: 'none',
                background: activeTab === t ? '#007acc' : '#2a2a2a',
                color: '#fff',
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {t}
              {t === 'abilities' && hasUnseenAbilityUnlock && (
                <span
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: '#ff6b6b',
                  }}
                />
              )}
            </button>
          ))}
        </div>
        <div style={{ color: '#ffd166', fontSize: 14 }}>{profile?.gems ?? 0} gems</div>
      </nav>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {activeTab === 'chat' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
            {Object.keys(companions).length > 1 && (
              <div
                style={{
                  display: 'flex',
                  gap: 6,
                  padding: '10px 16px',
                  borderBottom: '1px solid #222',
                  flexShrink: 0,
                }}
              >
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
            <div style={{ flex: 1, minHeight: 0 }}>
              {activeCompanionId && <ChatPanel instanceId={activeCompanionId} />}
            </div>
          </div>
        )}
        {activeTab === 'review' && <ReviewSession />}
        {activeTab === 'commissions' && <CommissionsPanel />}
        {activeTab === 'gacha' && <GachaScreen />}
        {activeTab === 'abilities' && <AbilitiesPanel />}
        {activeTab === 'sandbox' && <DevSandbox />}
      </div>
    </div>
  );
}

export default App;
