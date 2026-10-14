import { parseConjugationRules } from './grammar';
import { supabase } from './supabase';

export type MasterDataTable = 'kanji' | 'kotoba' | 'bunpou';
type ImportRow = Record<string, unknown>;

const importColumns: Record<MasterDataTable, string[]> = {
  kanji: ['kanji', 'onyomi', 'kunyomi', 'meaning', 'jlpt_level', 'stroke_count', 'example_sentence', 'example_meaning'],
  kotoba: ['word', 'reading', 'meaning', 'jlpt_level', 'part_of_speech', 'example_sentence', 'example_meaning', 'related_words'],
  bunpou: ['title', 'structure', 'meaning', 'jlpt_level', 'example_sentence', 'nuance', 'conjugation_rules'],
};

const naturalKeyByTable: Record<MasterDataTable, string> = {
  kanji: 'kanji',
  kotoba: 'word',
  bunpou: 'title',
};

const defaultsByTable: Record<MasterDataTable, ImportRow> = {
  kanji: { jlpt_level: 'N5', stroke_count: 1 },
  kotoba: { jlpt_level: 'N5' },
  bunpou: { jlpt_level: 'N5', conjugation_rules: {} },
};

const isEmpty = (value: unknown) => value == null
  || (typeof value === 'string' && value.trim() === '')
  || (Array.isArray(value) && value.length === 0);

export function normalizeMasterImportRow(table: MasterDataTable, row: ImportRow): ImportRow {
  const normalized: ImportRow = {};
  if (!isEmpty(row.id)) normalized.id = String(row.id).trim();

  for (const column of importColumns[table]) {
    const value = row[column];
    if (isEmpty(value)) continue;

    if (column === 'stroke_count') {
      const strokeCount = Number(value);
      if (Number.isFinite(strokeCount)) normalized[column] = strokeCount;
    } else if (column === 'conjugation_rules') {
      normalized[column] = typeof value === 'string' ? parseConjugationRules(value) : value;
    } else if (column === 'related_words' && typeof value === 'string') {
      normalized[column] = value.split(',').map((word) => word.trim()).filter(Boolean);
    } else {
      normalized[column] = typeof value === 'string' ? value.trim() : value;
    }
  }

  return normalized;
}

export async function upsertMasterData(table: MasterDataTable, inputRows: ImportRow[]): Promise<number> {
  const rows = inputRows
    .map((row) => normalizeMasterImportRow(table, row))
    .filter((row) => Object.keys(row).length > 0);
  if (!rows.length) return 0;

  const { data, error: fetchError } = await (supabase.from(table) as any).select('*');
  if (fetchError) throw fetchError;

  const existingRows = (data ?? []) as ImportRow[];
  const naturalKey = naturalKeyByTable[table];
  const existingById = new Map(existingRows.map((row) => [String(row.id), row]));
  const existingByNaturalKey = new Map(existingRows
    .filter((row) => !isEmpty(row[naturalKey]))
    .map((row) => [String(row[naturalKey]).trim(), row]));

  const mergedRows = rows.map((row) => {
    const importedId = isEmpty(row.id) ? '' : String(row.id).trim();
    const importedKey = isEmpty(row[naturalKey]) ? '' : String(row[naturalKey]).trim();
    const existing = (importedId ? existingById.get(importedId) : undefined)
      ?? (importedKey ? existingByNaturalKey.get(importedKey) : undefined);

    if (!existing && !importedKey) {
      throw new Error(`Import row is missing the ${naturalKey} identifier.`);
    }

    return existing
      ? { ...existing, ...row, id: existing.id }
      : { ...defaultsByTable[table], ...row };
  });

  const { error: upsertError } = await (supabase.from(table) as any).upsert(mergedRows, {
    onConflict: 'id',
    ignoreDuplicates: false,
  });
  if (upsertError) throw upsertError;

  return mergedRows.length;
}
