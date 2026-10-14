import type { ItemType } from '../types';

export function normalizeStudyItemType(type: unknown): ItemType | null {
  const normalizedType = String(type ?? '').trim().toLowerCase();

  if (normalizedType === 'kanji') return 'kanji';
  if (['kotoba', 'vocab', 'vocabulary'].includes(normalizedType)) return 'kotoba';
  if (['bunpou', 'bunpo', 'grammar'].includes(normalizedType)) return 'bunpou';

  return null;
}