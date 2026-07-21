import type { RelationshipStats } from '../../../lib/relationship';

const LABELS: { key: keyof RelationshipStats; label: string; color: string }[] = [
  { key: 'trust', label: 'Trust', color: '#6fcf97' },
  { key: 'respect', label: 'Respect', color: '#56ccf2' },
  { key: 'comfort', label: 'Comfort', color: '#f2c94c' },
  { key: 'friendship', label: 'Friendship', color: '#bb6bd9' },
  { key: 'affection', label: 'Affection', color: '#eb5757' },
  { key: 'studyCompatibility', label: 'Study Fit', color: '#f2994a' },
  { key: 'sharedMemories', label: 'Memories', color: '#9b9b9b' },
];

export function RelationshipBars({ stats }: { stats: RelationshipStats }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 16px' }}>
      {LABELS.map(({ key, label, color }) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 72, fontSize: 11, color: '#999' }}>{label}</div>
          <div style={{ flex: 1, background: '#2a2a2a', borderRadius: 4, height: 6, overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.min(100, stats[key])}%`,
                height: '100%',
                background: color,
                transition: 'width 0.3s',
              }}
            />
          </div>
          <div style={{ width: 24, fontSize: 11, color: '#999', textAlign: 'right' }}>{stats[key]}</div>
        </div>
      ))}
    </div>
  );
}
