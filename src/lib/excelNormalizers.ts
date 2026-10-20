import { normalizeMasterImportRow, type MasterDataTable } from './masterDataImport';

export type ExcelImportTable = MasterDataTable | 'questions';

export function normalizeImportedRow(table: ExcelImportTable, row: Record<string, unknown>) {
  if (table !== 'questions') return normalizeMasterImportRow(table, row);

  const options = [row.option_a, row.option_b, row.option_c, row.option_d]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean);

  return {
    exam_type: String(row.exam_type ?? 'JLPT_N5'),
    section: String(row.section ?? 'goi'),
    question_text: String(row.question_text ?? ''),
    options,
    correct_answer: Number(row.correct_answer ?? 0),
    explanation: String(row.explanation ?? ''),
  };
}
