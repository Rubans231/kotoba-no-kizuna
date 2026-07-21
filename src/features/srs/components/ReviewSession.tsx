import { useMemo } from 'react';
import { useBoundStore } from '../../../store/useBoundStore';
import { upsertSrsRecord } from '../../../lib/db';

const GRADE_OPTIONS: { label: string; grade: number }[] = [
  { label: 'Again', grade: 1 },
  { label: 'Hard', grade: 3 },
  { label: 'Good', grade: 4 },
  { label: 'Easy', grade: 5 },
];

export function ReviewSession() {
  const srsRecords = useBoundStore((s) => s.srsRecords);
  const processReview = useBoundStore((s) => s.processReview);

  const dueItems = useMemo(() => {
    const now = Date.now();
    return Object.values(srsRecords)
      .filter((r) => new Date(r.nextReviewTime).getTime() <= now)
      .sort((a, b) => new Date(a.nextReviewTime).getTime() - new Date(b.nextReviewTime).getTime());
  }, [srsRecords]);

  const current = dueItems[0];

  const handleGrade = (grade: number) => {
    if (!current) return;
    processReview(current.itemId, grade);
    const updated = useBoundStore.getState().srsRecords[current.itemId];
    if (updated) void upsertSrsRecord(updated);
  };

  if (!current) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
        No reviews due right now. Go chat with a companion to learn new words.
      </div>
    );
  }

  const word = current.itemId.split(':')[1];

  return (
    <div style={{ maxWidth: 480, margin: '40px auto', textAlign: 'center' }}>
      <div style={{ color: '#888', marginBottom: 8 }}>{dueItems.length} due</div>
      <div style={{ fontSize: 40, marginBottom: 24 }}>{word}</div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        {GRADE_OPTIONS.map((opt) => (
          <button
            key={opt.label}
            onClick={() => handleGrade(opt.grade)}
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              border: '1px solid #444',
              background: '#2a2a2a',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
