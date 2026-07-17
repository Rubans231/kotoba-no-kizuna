import { invoke } from '@tauri-apps/api/core';
import { useState, useCallback } from 'react';

export interface NativeToken {
  surface: string;
  feature: string;
  reading: string | null;
  base_form: string | null;
}

export const useNlpTokenizer = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const parseText = useCallback(async (text: string): Promise<NativeToken[]> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await invoke<NativeToken[]>('tokenize_japanese_text', { text });
      return result;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(errMsg);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { parseText, isLoading, error };
};
