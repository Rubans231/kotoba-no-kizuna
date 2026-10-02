import { useEffect, useRef, useState } from 'react';
import { useBoundStore } from '../../../store/useBoundStore';

const LEVEL_COLOR: Record<string, string> = {
  info: '#8ab4f8',
  success: '#6fcf97',
  error: '#ff6b6b',
};

function relativeTime(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function ActivityLogToggle() {
  const [open, setOpen] = useState(false);
  const logs = useBoundStore((s) => s.logs);
  const clearLogs = useBoundStore((s) => s.clearLogs);
  const activeLoraTraining = useBoundStore((s) => s.activeLoraTraining);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [open, logs.length]);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          padding: '4px 10px',
          borderRadius: 6,
          border: '1px solid #333',
          background: activeLoraTraining ? '#1a2a3a' : 'transparent',
          color: '#8ab4f8',
          fontSize: 12,
          cursor: 'pointer',
        }}
      >
        {open ? 'Hide log' : 'Log'}
        {activeLoraTraining && !open && ' ●'}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '110%',
            right: 0,
            width: 420,
            maxHeight: 320,
            background: '#161616',
            border: '1px solid #333',
            borderRadius: 8,
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 12px',
              borderBottom: '1px solid #2a2a2a',
              fontSize: 12,
              color: '#888',
            }}
          >
            <span>Activity</span>
            <button
              onClick={clearLogs}
              style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 12 }}
            >
              Clear
            </button>
          </div>
          <div ref={scrollRef} style={{ overflowY: 'auto', padding: '8px 12px', flex: 1 }}>
            {logs.length === 0 ? (
              <div style={{ color: '#555', fontSize: 12, fontStyle: 'italic' }}>Nothing yet.</div>
            ) : (
              logs.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    display: 'flex',
                    gap: 8,
                    fontSize: 12,
                    padding: '3px 0',
                    color: LEVEL_COLOR[entry.level] ?? '#ccc',
                  }}
                >
                  <span style={{ color: '#555', flexShrink: 0, minWidth: 44 }}>{relativeTime(entry.timestamp)}</span>
                  <span>{entry.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
