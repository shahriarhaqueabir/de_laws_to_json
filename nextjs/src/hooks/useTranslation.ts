'use client';

import { useState, useCallback } from 'react';
import { translateText, LANG_CODES } from '../lib/translate';

export function useTranslation() {
  const [translating, setTranslating] = useState(false);
  const [cache] = useState(() => new Map<string, string>());

  const translate = useCallback(async (
    text: string,
    from: keyof typeof LANG_CODES = 'de',
    to: keyof typeof LANG_CODES = 'en',
  ) => {
    const key = `${from}:${to}:${text.slice(0, 100)}`;
    if (cache.has(key)) return cache.get(key)!;

    setTranslating(true);
    try {
      const result = await translateText(text, LANG_CODES[from], LANG_CODES[to]);
      cache.set(key, result);
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
