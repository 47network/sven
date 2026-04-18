/* Batch 68 — Agent Localization & i18n */

export type TextDirection = 'ltr' | 'rtl';
export type TranslationStatus = 'draft' | 'review' | 'approved' | 'published' | 'rejected';
export type LocaleContentType = 'skill_description' | 'marketplace_listing' | 'ui_element' | 'email_template' | 'notification' | 'documentation';
export type DetectionSource = 'header' | 'cookie' | 'url' | 'geo' | 'preference' | 'default';
export type LocalizationAction = 'locale_create' | 'translation_add' | 'translation_review' | 'content_localize' | 'locale_detect' | 'translation_export' | 'coverage_report';

export interface LocaleConfig {
  id: string;
  localeCode: string;
  language: string;
  region?: string;
  direction: TextDirection;
  fallbackLocale?: string;
  enabled: boolean;
}

export interface TranslationKey {
  id: string;
  namespace: string;
  keyPath: string;
  description?: string;
  context?: string;
  maxLength?: number;
  placeholders: string[];
}

export interface TranslationValue {
  id: string;
  keyId: string;
  localeCode: string;
  value: string;
  status: TranslationStatus;
  translatedBy?: string;
  qualityScore?: number;
}

export interface LocaleContent {
  id: string;
  contentType: LocaleContentType;
  contentId: string;
  localeCode: string;
  title?: string;
  body?: string;
  status: TranslationStatus;
}

export interface LocaleDetectionLog {
  id: string;
  agentId?: string;
  detectedLocale: string;
  source: DetectionSource;
  confidence: number;
  finalLocale: string;
}

export const TEXT_DIRECTIONS: TextDirection[] = ['ltr', 'rtl'];
export const TRANSLATION_STATUSES: TranslationStatus[] = ['draft', 'review', 'approved', 'published', 'rejected'];
export const LOCALE_CONTENT_TYPES: LocaleContentType[] = ['skill_description', 'marketplace_listing', 'ui_element', 'email_template', 'notification', 'documentation'];
export const DETECTION_SOURCES: DetectionSource[] = ['header', 'cookie', 'url', 'geo', 'preference', 'default'];

export function isTranslationApproved(value: TranslationValue): boolean {
  return value.status === 'approved' || value.status === 'published';
}

export function getTranslationCoverage(total: number, translated: number): number {
  if (total === 0) return 100;
  return Math.round((translated / total) * 100);
}

export function isRtlLocale(locale: LocaleConfig): boolean {
  return locale.direction === 'rtl';
}

export function formatLocaleCode(language: string, region?: string): string {
  return region ? `${language}-${region}` : language;
}
