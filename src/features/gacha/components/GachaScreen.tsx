import { useState } from 'react';
import { useBoundStore } from '../../../store/useBoundStore';
import { COMPANIONS } from '../../../data/companions';
import { STANDARD_BANNER } from '../../../data/gachaBanner';
import { pullMany, DUPLICATE_REFUND_RATE } from '../../../lib/gacha';
import type { PullResult } from '../../../lib/gacha';
import { upsertCompanion, saveProfile } from '../../../lib/db';
import { defaultRelationshipStats } from '../../../lib/relationship';

const RARITY_COLOR: Record<number, string> = {
  3: '#8ab4f8',
  4: '#d19cff',
  5: '#ffd166',
};

export function GachaScreen() {
  const profile = useBoundStore((s) => s.profile);
  const companions = useBoundStore((s) => s.companions);
  const spendGems = useBoundStore((s) => s.spendGems);
  const addGems = useBoundStore((s) => s.addGems);
  const setPityCounter = useBoundStore((s) => s.setPityCounter);
  const setCompanions = useBoundStore((s) => s.setCompanions);

  const [lastResults, setLastResults] = useState<PullResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ownedCharacterIds = new Set(Object.values(companions).map((c) => c.characterId));

  const runPulls = (count: number) => {
    setError(null);
    if (!profile) return;

    const cost = STANDARD_BANNER.costPerPull * count;
    const spent = spendGems(cost);
    if (!spent) {
      setError(`Not enough gems - need ${cost}, have ${profile.gems}.`);
      return;
    }

    const { results, finalPityCounter } = pullMany(
      STANDARD_BANNER,
      COMPANIONS,
      profile.pityCounter,
      ownedCharacterIds,
      count,
    );
    setPityCounter(finalPityCounter);
    setLastResults(results);

    let refund = 0;
    const newInstances = Object.values(useBoundStore.getState().companions);

    for (const result of results) {
      if (result.isDuplicate) {
        refund += Math.round(STANDARD_BANNER.costPerPull * DUPLICATE_REFUND_RATE);
      } else {
        const instance = {
          instanceId: `inst_${result.characterId}`,
          characterId: result.characterId,
          affectionLevel: 1,
          affectionXp: 0,
          relationshipStats: defaultRelationshipStats(),
          currentOutfitId: 'default',
          isFavorite: false,
          unlockedVoiceLines: [],
          updatedAt: new Date().toISOString(),
        };
        newInstances.push(instance);
        void upsertCompanion(instance);
      }
    }

    if (refund > 0) addGems(refund);
    setCompanions(newInstances);

    const updatedProfile = useBoundStore.getState().profile;
    if (updatedProfile) void saveProfile(updatedProfile);
  };

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: 24, textAlign: 'center' }}>
      <h2 style={{ marginTop: 0 }}>{STANDARD_BANNER.title}</h2>
      <div style={{ color: '#ffd166', marginBottom: 16 }}>{profile?.gems ?? 0} gems</div>
      <div style={{ color: '#888', fontSize: 13, marginBottom: 20 }}>
        {Math.round(STANDARD_BANNER.rates[5] * 100)}% five-star &middot;{' '}
        {Math.round(STANDARD_BANNER.rates[4] * 100)}% four-star &middot;{' '}
        {Math.round(STANDARD_BANNER.rates[3] * 100)}% three-star &middot; pity at{' '}
        {STANDARD_BANNER.hardPityAt} pulls
        {profile ? ` (${profile.pityCounter}/${STANDARD_BANNER.hardPityAt} since last 5-star)` : ''}
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 24 }}>
        <button
          onClick={() => runPulls(1)}
          style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#007acc', color: '#fff', cursor: 'pointer' }}
        >
          Summon x1 ({STANDARD_BANNER.costPerPull})
        </button>
        <button
          onClick={() => runPulls(10)}
          style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#007acc', color: '#fff', cursor: 'pointer' }}
        >
          Summon x10 ({STANDARD_BANNER.costPerPull * 10})
        </button>
      </div>

      {error && <div style={{ color: '#ff6b6b', marginBottom: 16 }}>{error}</div>}

      {lastResults && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
          {lastResults.map((r, i) => {
            const persona = COMPANIONS[r.characterId];
            return (
              <div
                key={`${r.characterId}-${i}`}
                style={{
                  width: 110,
                  padding: 12,
                  borderRadius: 10,
                  background: '#1a1a1a',
                  border: `1px solid ${RARITY_COLOR[r.rarity] ?? '#444'}`,
                }}
              >
                <div style={{ color: RARITY_COLOR[r.rarity] ?? '#fff', fontSize: 12, marginBottom: 4 }}>
                  {'★'.repeat(r.rarity)}
                </div>
                <div style={{ fontWeight: 'bold' }}>{persona.displayName}</div>
                <div style={{ fontSize: 11, color: '#888' }}>{persona.specialty}</div>
                {r.isDuplicate && (
                  <div style={{ fontSize: 11, color: '#ffd166', marginTop: 4 }}>
                    Dupe (+{Math.round(STANDARD_BANNER.costPerPull * DUPLICATE_REFUND_RATE)}g)
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
