import { useBoundStore } from '../../../store/useBoundStore';
import { COMMISSION_DEFINITIONS } from '../../../data/commissions';
import { upsertCommission, saveProfile } from '../../../lib/db';

export function CommissionsPanel() {
  const commissions = useBoundStore((s) => s.commissions);
  const claimCommission = useBoundStore((s) => s.claimCommission);
  const addGems = useBoundStore((s) => s.addGems);
  const profile = useBoundStore((s) => s.profile);

  const handleClaim = (commissionId: string, rewardGems: number) => {
    const before = useBoundStore.getState().commissions[commissionId];
    if (!before || !before.completed || before.claimed) return;

    claimCommission(commissionId);
    addGems(rewardGems);

    const updated = useBoundStore.getState().commissions[commissionId];
    if (updated) void upsertCommission(updated);
    const updatedProfile = useBoundStore.getState().profile;
    if (updatedProfile) void saveProfile(updatedProfile);
  };

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Today's Commissions</h2>
        <div style={{ color: '#ffd166' }}>{profile?.gems ?? 0} gems</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {COMMISSION_DEFINITIONS.map((def) => {
          const state = commissions[def.commissionId];
          const progress = state?.progress ?? 0;
          const completed = state?.completed ?? false;
          const claimed = state?.claimed ?? false;
          const pct = Math.min(100, Math.round((progress / def.target) * 100));

          return (
            <div
              key={def.commissionId}
              style={{
                background: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: 10,
                padding: 14,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{def.title}</strong>
                <span style={{ color: '#ffd166' }}>+{def.rewardGems}</span>
              </div>
              <div style={{ color: '#999', fontSize: 13, margin: '4px 0 10px' }}>{def.description}</div>
              <div style={{ background: '#2a2a2a', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${pct}%`,
                    height: '100%',
                    background: completed ? '#4caf50' : '#007acc',
                    transition: 'width 0.3s',
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <span style={{ fontSize: 12, color: '#888' }}>
                  {progress} / {def.target}
                </span>
                <button
                  onClick={() => handleClaim(def.commissionId, def.rewardGems)}
                  disabled={!completed || claimed}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 6,
                    border: 'none',
                    background: claimed ? '#333' : completed ? '#4caf50' : '#2a2a2a',
                    color: claimed ? '#777' : '#fff',
                    cursor: completed && !claimed ? 'pointer' : 'default',
                  }}
                >
                  {claimed ? 'Claimed' : 'Claim'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
