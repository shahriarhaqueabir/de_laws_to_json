"use client";

import { useState, useCallback } from "react";
import { translateText } from "../lib/translate";

export function useTranslation() {
  const [translating, setTranslating] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [cache] = useState(() => new Map<string, string>());

  const translate = useCallback(
    async (text: string) => {
      if (cache.has(text)) return cache.get(text)!;

      setTranslating(true);
      setProgress(0);
      try {
        const result = await translateText(text, {
          onProgress: (p) => {
            if (p.progress) setProgress(p.progress);
          },
        });
        cache.set(text, result);
        return result;
      } catch (err) {
        console.error("Translation error:", err);
        throw err;
      } finally {
        setTranslating(false);
        setProgress(0);
      }
    },
    [cache],
  );

  return { translate, translating, progress };
}
