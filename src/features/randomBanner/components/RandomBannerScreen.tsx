import { useState } from 'react';
import { useBoundStore } from '../../../store/useBoundStore';
import { COMPANIONS } from '../../../data/companions';
import { defaultRelationshipStats } from '../../../lib/relationship';
import {
  RANDOM_BANNER_CONFIG,
  pullRoulette,
  wagerReroll,
  countRandomCompanions,
  isRandomRosterFull,
} from '../../../lib/randomBanner';
import type { RandomBannerRarity } from '../../../lib/randomBanner';
import { generateProceduralCharacter } from '../../../lib/characterGenerator';
import {
  upsertCompanion,
  deleteCompanion,
  saveProceduralCharacter,
  deleteProceduralCharacter,
  saveProfile,
} from '../../../lib/db';

const RARITY_COLOR: Record<number, string> = { 3: '#8ab4f8', 4: '#d19cff', 5: '#ffd166' };

export function RandomBannerScreen() {
  const profile = useBoundStore((s) => s.profile);
  const companions = useBoundStore((s) => s.companions);
  const proceduralCharacters = useBoundStore((s) => s.proceduralCharacters);
  const spendShards = useBoundStore((s) => s.spendShards);
  const addShards = useBoundStore((s) => s.addShards);
  const setCompanions = useBoundStore((s) => s.setCompanions);
  const addProceduralCharacter = useBoundStore((s) => s.addProceduralCharacter);
  const removeProceduralCharacter = useBoundStore((s) => s.removeProceduralCharacter);
  const removeCompanion = useBoundStore((s) => s.removeCompanion);

  const [isPulling, setIsPulling] = useState(false);
  const [wagerInProgress, setWagerInProgress] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<
    { hit: false } | { hit: true; displayName: string; rarity: number } | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  const randomInstances = Object.values(companions).filter((c) => proceduralCharacters[c.characterId]);
  const rosterCount = countRandomCompanions(companions, proceduralCharacters);
  const rosterFull = isRandomRosterFull(companions, proceduralCharacters);

  const existingSpecialties = () => [
    ...Object.values(COMPANIONS).map((p) => p.specialty),
    ...Object.values(proceduralCharacters).map((p) => p.specialty),
  ];

  const addNewRandomCompanion = async (rarity: RandomBannerRarity) => {
    const persona = await generateProceduralCharacter(rarity, 'random_banner', existingSpecialties());
    addProceduralCharacter(persona);
    await saveProceduralCharacter(persona);

    const instance = {
      instanceId: `inst_${persona.characterId}`,
      characterId: persona.characterId,
      affectionLevel: 1,
      affectionXp: 0,
      relationshipStats: defaultRelationshipStats(),
      currentOutfitId: 'default',
      isFavorite: false,
      unlockedVoiceLines: [],
      updatedAt: new Date().toISOString(),
    };
    const updated = { ...useBoundStore.getState().companions, [instance.instanceId]: instance };
    setCompanions(Object.values(updated));
    await upsertCompanion(instance);
    return persona;
  };

  const handlePull = async () => {
    setError(null);
    if (!profile) return;
    if (rosterFull) {
      setError(`Your random roster is full (${RANDOM_BANNER_CONFIG.rosterCap}/${RANDOM_BANNER_CONFIG.rosterCap}). Discard or wager one below to make room.`);
      return;
    }
    const spent = spendShards(RANDOM_BANNER_CONFIG.shardCostPerPull);
    if (!spent) {
      setError(`Not enough shards - need ${RANDOM_BANNER_CONFIG.shardCostPerPull}, have ${profile.shards}.`);
      return;
    }

    setIsPulling(true);
    try {
      const outcome = pullRoulette();
      if (!outcome.hit) {
        setLastResult({ hit: false });
      } else {
        const persona = await addNewRandomCompanion(outcome.rarity);
        setLastResult({ hit: true, displayName: persona.displayName, rarity: outcome.rarity });
      }
      const updatedProfile = useBoundStore.getState().profile;
      if (updatedProfile) await saveProfile(updatedProfile);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      addShards(RANDOM_BANNER_CONFIG.shardCostPerPull); // refund on failure (e.g. local model unreachable)
      const updatedProfile = useBoundStore.getState().profile;
      if (updatedProfile) await saveProfile(updatedProfile);
    } finally {
      setIsPulling(false);
    }
  };

  const handleDiscard = async (instanceId: string, characterId: string) => {
    removeCompanion(instanceId);
    removeProceduralCharacter(characterId);
    await deleteCompanion(instanceId);
    await deleteProceduralCharacter(characterId);
  };

  const handleWager = async (instanceId: string, characterId: string) => {
    setError(null);
    setWagerInProgress(instanceId);
    try {
      const outcome = wagerReroll();
      // Either way, the wagered character is gone - that's the stake.
      removeCompanion(instanceId);
      removeProceduralCharacter(characterId);
      await deleteCompanion(instanceId);
      await deleteProceduralCharacter(characterId);

      if (!outcome.hit) {
        setLastResult({ hit: false });
      } else {
        const persona = await addNewRandomCompanion(outcome.rarity);
        setLastResult({ hit: true, displayName: persona.displayName, rarity: outcome.rarity });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWagerInProgress(null);
    }
  };

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Random Banner</h2>
        <div style={{ color: '#8ab4f8' }}>{profile?.shards ?? 0} shards</div>
      </div>
      <div style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>
        One in six chance to hit. If you do, 68% three-star / 25% four-star / 7% five-star. Every
        hit invents a brand-new character no one else will have.
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: rosterFull ? '#ff6b6b' : '#888' }}>
          Roster: {rosterCount}/{RANDOM_BANNER_CONFIG.rosterCap}
        </span>
        <button
          onClick={handlePull}
          disabled={isPulling || rosterFull}
          style={{
            padding: '10px 20px',
            borderRadius: 8,
            border: 'none',
            background: isPulling || rosterFull ? '#333' : '#007acc',
            color: '#fff',
            cursor: isPulling || rosterFull ? 'default' : 'pointer',
          }}
        >
          {isPulling ? 'Spinning...' : `Pull the trigger (${RANDOM_BANNER_CONFIG.shardCostPerPull})`}
        </button>
      </div>

      {error && <div style={{ color: '#ff6b6b', marginBottom: 16, fontSize: 13 }}>{error}</div>}

      {lastResult && (
        <div
          style={{
            marginBottom: 20,
            padding: 14,
            borderRadius: 10,
            background: '#1a1a1a',
            border: `1px solid ${lastResult.hit ? (RARITY_COLOR[lastResult.rarity] ?? '#444') : '#444'}`,
            textAlign: 'center',
          }}
        >
          {lastResult.hit ? (
            <>
              <div style={{ color: RARITY_COLOR[lastResult.rarity], fontSize: 13 }}>
                {'★'.repeat(lastResult.rarity)} - You shot
              </div>
              <div style={{ fontWeight: 'bold', marginTop: 4 }}>{lastResult.displayName}</div>
            </>
          ) : (
            <div style={{ color: '#888' }}>Click. Nothing this time.</div>
          )}
        </div>
      )}

      {randomInstances.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, color: '#aaa', marginBottom: 8 }}>Your random roster</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {randomInstances.map((instance) => {
              const persona = proceduralCharacters[instance.characterId];
              if (!persona) return null;
              return (
                <div
                  key={instance.instanceId}
                  style={{
                    background: '#1a1a1a',
                    border: `1px solid ${RARITY_COLOR[persona.rarity] ?? '#333'}`,
                    borderRadius: 10,
                    padding: 12,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ color: RARITY_COLOR[persona.rarity], fontSize: 11 }}>
                      {'★'.repeat(persona.rarity)}
                    </div>
                    <strong>{persona.displayName}</strong>
                    <span style={{ marginLeft: 6, color: '#888', fontSize: 12 }}>{persona.specialty}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => handleWager(instance.instanceId, instance.characterId)}
                      disabled={wagerInProgress !== null}
                      title="Bet her on one more spin - win and she's replaced by someone new, lose and she's gone"
                      style={{
                        padding: '5px 10px',
                        borderRadius: 6,
                        border: '1px solid #ffd166',
                        background: 'transparent',
                        color: '#ffd166',
                        fontSize: 12,
                        cursor: wagerInProgress ? 'default' : 'pointer',
                      }}
                    >
                      {wagerInProgress === instance.instanceId ? 'Spinning...' : 'Wager'}
                    </button>
                    <button
                      onClick={() => handleDiscard(instance.instanceId, instance.characterId)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 6,
                        border: '1px solid #444',
                        background: 'transparent',
                        color: '#888',
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      Discard
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
