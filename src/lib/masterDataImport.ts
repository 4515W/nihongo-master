import { parseConjugationRules } from './grammar';
import { supabase } from './supabase';

export type MasterDataTable = 'kanji' | 'kotoba' | 'bunpou';
type ImportRow = Record<string, unknown>;

const importColumns: Record<MasterDataTable, string[]> = {
  kanji: ['kanji', 'onyomi', 'kunyomi', 'meaning', 'jlpt_level', 'stroke_count', 'example_sentence', 'example_meaning'],
  kotoba: ['word', 'reading', 'meaning', 'jlpt_level', 'part_of_speech', 'example_sentence', 'example_meaning', 'related_words'],
  bunpou: ['title', 'reading', 'structure', 'meaning', 'jlpt_level', 'example_sentence', 'example_meaning', 'nuance', 'nuance_usage', 'conjugation_rules'],
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
export const importChunkSize = 25;

const isEmpty = (value: unknown) => value == null
  || (typeof value === 'string' && value.trim() === '')
  || (Array.isArray(value) && value.length === 0);

const normalizeConjugationRules = (value: unknown): Record<string, string> => {
  if (isEmpty(value)) return {};

  if (typeof value === 'string') {
    const text = value.trim();
    try {
      const parsed: unknown = JSON.parse(text);
      if (typeof parsed === 'string') return { rule: parsed };
      return parseConjugationRules(parsed);
    } catch {
      return { rule: text };
    }
  }

  try {
    return parseConjugationRules(value);
  } catch {
    return { rule: String(value) };
  }
};

export function normalizeMasterImportRow(table: MasterDataTable, row: ImportRow): ImportRow {
  const normalized: ImportRow = {};
  if (!isEmpty(row.id)) normalized.id = String(row.id).trim();

  for (const column of importColumns[table]) {
    const value = table === 'bunpou' && column === 'title'
      ? (isEmpty(row.title) ? row.grammar_point : row.title)
      : table === 'bunpou' && column === 'nuance_usage'
        ? (isEmpty(row.nuance_usage) ? row.meaning : row.nuance_usage)
        : row[column];
    if (isEmpty(value)) continue;

    if (column === 'stroke_count') {
      const strokeCount = Number(value);
      if (Number.isFinite(strokeCount)) normalized[column] = strokeCount;
    } else if (column === 'conjugation_rules') {
      normalized[column] = normalizeConjugationRules(value);
    } else if (column === 'related_words' && typeof value === 'string') {
      normalized[column] = value.split(',').map((word) => word.trim()).filter(Boolean);
    } else {
      normalized[column] = typeof value === 'string' ? value.trim() : value;
    }
  }

  return normalized;
}

export async function upsertMasterData(
  table: MasterDataTable,
  inputRows: ImportRow[],
  onBatchProgress?: (completedBatch: number, totalBatches: number) => void,
): Promise<number> {
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

  const totalBatches = Math.ceil(mergedRows.length / importChunkSize);
  for (let start = 0; start < mergedRows.length; start += importChunkSize) {
    const batchNumber = Math.floor(start / importChunkSize) + 1;
    console.log(`Uploading batch ${batchNumber} of ${totalBatches}...`);
    const payload = mergedRows.slice(start, start + importChunkSize);
    
    const { error: upsertError } = await (supabase.from(table) as any).upsert(payload, {
      onConflict: 'kanji,jlpt_level',
      ignoreDuplicates: false,
    });
    if (upsertError) {
      console.error('Supabase import upsert failed:', {
        details: upsertError.details,
        message: upsertError.message,
        hint: upsertError.hint,
      });
      throw upsertError;
    }
    onBatchProgress?.(batchNumber, totalBatches);
  }

  return mergedRows.length;
}
