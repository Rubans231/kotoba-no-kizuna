import { useBoundStore } from '../../../store/useBoundStore';
import { ABILITY_DEFINITIONS } from '../../../data/abilities';
import { COMPANIONS } from '../../../data/companions';
import { overallBondLevel } from '../../../lib/relationship';
import { saveProfile } from '../../../lib/db';

export function AbilitiesPanel() {
  const profile = useBoundStore((s) => s.profile);
  const companions = useBoundStore((s) => s.companions);
  const toggleAbility = useBoundStore((s) => s.toggleAbility);

  if (!profile) return null;

  const ownedByCharacterId: Record<string, (typeof companions)[string]> = {};
  for (const instance of Object.values(companions)) {
    ownedByCharacterId[instance.characterId] = instance;
  }

  const handleToggle = (abilityId: string) => {
    toggleAbility(abilityId);
    const updated = useBoundStore.getState().profile;
    if (updated) void saveProfile(updated);
  };

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: 24 }}>
      <h2 style={{ marginTop: 0, fontSize: 18 }}>Abilities</h2>
      <div style={{ color: '#888', fontSize: 13, marginBottom: 20 }}>
        Each companion has one signature ability. Reach the bond level shown while you own her to
        unlock it permanently - once unlocked, it applies to every companion's teaching, and you
        can toggle it on or off any time.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {ABILITY_DEFINITIONS.map((def) => {
          const persona = COMPANIONS[def.characterId];
          const owned = ownedByCharacterId[def.characterId];
          const bondLevel = owned ? overallBondLevel(owned.relationshipStats) : 0;
          const isUnlocked = profile.unlockedAbilities.includes(def.abilityId);
          const isEnabled = profile.enabledAbilities.includes(def.abilityId);

          return (
            <div
              key={def.abilityId}
              style={{
                background: '#1a1a1a',
                border: `1px solid ${isUnlocked ? '#3a7' : '#333'}`,
                borderRadius: 10,
                padding: 14,
                opacity: isUnlocked ? 1 : 0.75,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <strong>{def.name}</strong>
                  <span style={{ marginLeft: 8, color: '#888', fontSize: 12 }}>
                    {persona?.displayName ?? def.characterId}
                  </span>
                </div>
                {isUnlocked ? (
                  <button
                    onClick={() => handleToggle(def.abilityId)}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 12,
                      border: 'none',
                      fontSize: 12,
                      background: isEnabled ? '#4caf50' : '#333',
                      color: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    {isEnabled ? 'On' : 'Off'}
                  </button>
                ) : (
                  <span style={{ fontSize: 11, color: '#666' }}>
                    {owned ? `Bond Lv.${bondLevel}/${def.requiredBondLevel}` : 'Not owned'}
                  </span>
                )}
              </div>
              <div style={{ color: '#aaa', fontSize: 13, marginTop: 6 }}>{def.description}</div>
              {!isUnlocked && owned && (
                <div style={{ marginTop: 8, background: '#2a2a2a', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.min(100, (bondLevel / def.requiredBondLevel) * 100)}%`,
                      height: '100%',
                      background: '#3a7',
                      transition: 'width 0.3s',
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
