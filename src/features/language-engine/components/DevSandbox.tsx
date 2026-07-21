import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

// Force explicit type imports for structural token bounds
export interface NativeToken {
  surface: string;
  feature: string;
  reading?: string;
  base_form?: string;
}

export function DevSandbox() {
  const [text, setText] = useState('');
  const [tokens, setTokens] = useState<NativeToken[]>([]);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const res = await invoke<NativeToken[]>('tokenize_japanese_text', { text });
      setTokens(res);
    } catch (err) {
      console.error("Rust NLP Panicked:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px', backgroundColor: '#1a1a1a', color: '#e0e0e0', minHeight: '100vh', fontFamily: 'monospace' }}>
      <h2 style={{ borderBottom: '1px solid #333', paddingBottom: '8px' }}>Kotoba no Kizuna - NLP Engine Sandbox</h2>
      
      <div style={{ margin: '20px 0' }}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="解析する日本語を入力してください..."
          style={{ width: '70%', padding: '10px', backgroundColor: '#2a2a2a', border: '1px solid #444', color: '#fff', borderRadius: '4px' }}
        />
        <button
          onClick={handleAnalyze}
          disabled={loading}
          style={{ marginLeft: '12px', padding: '10px 20px', backgroundColor: '#007acc', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}
        >
          {loading ? 'Analyzing via Rust...' : 'Analyze Text'}
        </button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
        <thead>
          <tr style={{ backgroundColor: '#2d2d2d', textAlign: 'left' }}>
            <th style={{ padding: '10px', border: '1px solid #444' }}>Surface</th>
            <th style={{ padding: '10px', border: '1px solid #444' }}>POS Feature</th>
            <th style={{ padding: '10px', border: '1px solid #444' }}>Reading</th>
            <th style={{ padding: '10px', border: '1px solid #444' }}>Base Form</th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((t, idx) => (
            <tr key={idx} style={{ borderBottom: '1px solid #333' }}>
              <td style={{ padding: '10px', color: '#a9ffaf' }}>{t.surface}</td>
              <td style={{ padding: '10px', color: '#888' }}>{t.feature}</td>
              <td style={{ padding: '10px', color: '#ffb374' }}>{t.reading || '*'}</td>
              <td style={{ padding: '10px', color: '#61afef' }}>{t.base_form || '*'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
