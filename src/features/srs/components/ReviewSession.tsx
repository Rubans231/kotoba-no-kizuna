import { useEffect, useMemo, useState } from 'react';
import { useBoundStore } from '../../../store/useBoundStore';
import { upsertSrsRecord, upsertCommission } from '../../../lib/db';

const GRADE_OPTIONS: { label: string; grade: number; hint: string }[] = [
  { label: 'Again', grade: 1, hint: "Didn't recall it" },
  { label: 'Hard', grade: 3, hint: 'Recalled with real effort' },
  { label: 'Good', grade: 4, hint: 'Recalled comfortably' },
  { label: 'Easy', grade: 5, hint: 'Instant, no hesitation' },
];

export function ReviewSession() {
  const srsRecords = useBoundStore((s) => s.srsRecords);
  const vocabDictionary = useBoundStore((s) => s.vocabDictionary);
  const processReview = useBoundStore((s) => s.processReview);
  const incrementCommission = useBoundStore((s) => s.incrementCommission);

  const [revealed, setRevealed] = useState(false);

  const dueItems = useMemo(() => {
    const now = Date.now();
    return Object.values(srsRecords)
      .filter((r) => new Date(r.nextReviewTime).getTime() <= now)
      .sort((a, b) => new Date(a.nextReviewTime).getTime() - new Date(b.nextReviewTime).getTime());
  }, [srsRecords]);

  const current = dueItems[0];
  const word = current?.itemId.split(':')[1];
  const entry = word ? vocabDictionary[word] : undefined;

  // Reset the flip state whenever the card actually changes, so grading one
  // card doesn't leave the next one pre-revealed.
  useEffect(() => {
    setRevealed(false);
  }, [current?.itemId]);

  const handleGrade = (grade: number) => {
    if (!current) return;
    processReview(current.itemId, grade);
    const updated = useBoundStore.getState().srsRecords[current.itemId];
    if (updated) void upsertSrsRecord(updated);

    const reviewProgress = incrementCommission('daily_review', 1);
    if (reviewProgress) void upsertCommission(reviewProgress);
  };

  if (!current) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
        No reviews due right now. Go chat with a companion to learn new words.
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: '40px auto', textAlign: 'center', padding: '0 16px' }}>
      <div style={{ color: '#888', marginBottom: 8 }}>{dueItems.length} due</div>

      <div
        style={{
          background: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: 14,
          padding: '32px 24px',
          minHeight: 160,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 10,
        }}
      >
        <div style={{ fontSize: 40 }}>{word}</div>

        {revealed && entry && (
          <div style={{ textAlign: 'left', marginTop: 12 }}>
            <div style={{ color: '#8ab4f8', fontSize: 15 }}>
              {entry.reading} — {entry.meaning}
            </div>
            {entry.nuance && (
              <div style={{ color: '#bbb', fontSize: 13, marginTop: 8 }}>{entry.nuance}</div>
            )}
            {entry.mnemonic && (
              <div style={{ color: '#ffd166', fontSize: 13, marginTop: 6 }}>
                💡 {entry.mnemonic}
              </div>
            )}
            {entry.relatedWords.length > 0 && (
              <div style={{ color: '#888', fontSize: 12, marginTop: 6 }}>
                Related: {entry.relatedWords.join(', ')}
              </div>
            )}
          </div>
        )}

        {revealed && !entry && (
          <div style={{ color: '#666', fontSize: 13, fontStyle: 'italic', marginTop: 12 }}>
            No teaching detail saved for this word yet.
          </div>
        )}
      </div>

      {!revealed ? (
        <button
          onClick={() => setRevealed(true)}
          style={{
            marginTop: 20,
            padding: '10px 24px',
            borderRadius: 8,
            border: 'none',
            background: '#007acc',
            color: '#fff',
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          Show Answer
        </button>
      ) : (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            {GRADE_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                onClick={() => handleGrade(opt.grade)}
                title={opt.hint}
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
          <div style={{ color: '#666', fontSize: 11, marginTop: 8 }}>
            How well did you recall it before revealing?
          </div>
        </div>
      )}
    </div>
  );
}
