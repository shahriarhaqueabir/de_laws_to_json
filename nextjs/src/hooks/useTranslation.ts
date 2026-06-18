'use client';

import { useState, useCallback } from 'react';
import { translateText } from '../lib/translate';

export function useTranslation() {
  const [translating, setTranslating] = useState(false);
  const [cache] = useState(() => new Map<string, string>());

  const translate = useCallback(async (text: string) => {
    if (cache.has(text)) return cache.get(text)!;

    setTranslating(true);
    try {
      const result = await translateText(text);
      cache.set(text, result);
      return result;
    } catch (err) {
      console.error('Translation error:', err);
      throw err;
    } finally {
      setTranslating(false);
    }
  }, [cache]);

  return { translate, translating };
}
