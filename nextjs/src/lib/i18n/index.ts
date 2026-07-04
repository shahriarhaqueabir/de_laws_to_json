// src/lib/i18n/index.ts
import type { AppLanguage } from "../types";
import { EN } from "./en";
import { DE } from "./de";
import { TR } from "./tr";
import { AR } from "./ar";
import { FR } from "./fr";
import { ES } from "./es";
import { PL } from "./pl";
import { UK } from "./uk";
import { RU } from "./ru";

export const LANGUAGE_MAP: Record<AppLanguage, Record<string, string>> = {
  de: DE,
  en: EN,
  tr: TR,
  ar: AR,
  fr: FR,
  es: ES,
  pl: PL,
  uk: UK,
  ru: RU,
};
