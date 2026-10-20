import { useState } from 'react';
import * as XLSX from 'xlsx';
import { useBunproSync } from '../../hooks/useBunproSync';
import { normalizeImportedRow, type ExcelImportTable } from '../../lib/excelNormalizers';
import { importChunkSize, upsertMasterData } from '../../lib/masterDataImport';
import { supabase } from '../../lib/supabase';

interface ExcelImportTabProps {
  onRefresh: () => void;
}

const tables: ExcelImportTable[] = ['kanji', 'kotoba', 'bunpou', 'questions'];
const displayLabels: Record<ExcelImportTable, string> = {
  kanji: 'Kanji',
  kotoba: 'Kotoba',
  bunpou: 'Bunpou',
  questions: 'Questions',
};
const templateHeaders: Record<ExcelImportTable, string[]> = {
  kanji: ['kanji', 'onyomi', 'kunyomi', 'meaning', 'jlpt_level', 'stroke_count', 'example_sentence', 'example_meaning'],
  kotoba: ['word', 'reading', 'meaning', 'jlpt_level', 'part_of_speech', 'example_sentence', 'example_meaning'],
  bunpou: ['title', 'reading', 'structure', 'meaning', 'jlpt_level', 'example_sentence', 'example_meaning', 'nuance', 'nuance_usage', 'conjugation_rules'],
  questions: ['exam_type', 'section', 'question_text', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_answer', 'explanation'],
};

export function ExcelImportTab({ onRefresh }: ExcelImportTabProps) {
  const [excelTable, setExcelTable] = useState<ExcelImportTable>('kanji');
  const [excelRows, setExcelRows] = useState<Record<string, unknown>[]>([]);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [bunproSlug, setBunproSlug] = useState('');
  const [selectedJlptLevel, setSelectedJlptLevel] = useState<'n5' | 'n4' | 'n3' | 'n2' | 'n1'>('n5');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [uploadProgress, setUploadProgress] = useState('');
  const previewColumns = excelTable === 'questions' ? Object.keys(excelRows[0] ?? {}) : templateHeaders[excelTable];
  const handleBunproSync = useBunproSync({
    setIsSyncing,
    setErrorMessage,
    setMessage,
    setUploadProgress,
    onSyncComplete: onRefresh,
  });

  const handleParseFile = async (file: File) => {
    if (!file.name.match(/\.(csv|xlsx|xls)$/i)) {
      setErrorMessage('Please select a CSV or Excel file.');
      return;
    }
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
      if (!sheet) throw new Error('The selected file does not contain a worksheet.');
      const parsedRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      setExcelRows(parsedRows.map((row) => normalizeImportedRow(excelTable, row)));
      setSelectedFileName(file.name);
      setMessage('File parsed successfully. Review the data and upload when ready.');
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to read the selected file.');
    }
  };

  const handleSyncKanjiApi = async () => {
    setIsSyncing(true);
    setErrorMessage('');
    setMessage('');
    setUploadProgress('Fetching kanji list...');
    const levelNum = selectedJlptLevel.replace(/[^0-9]/g, '');
    try {
      const listResponse = await fetch(`https://kanjiapi.dev/v1/kanji/jlpt-${levelNum}`);
      if (!listResponse.ok) throw new Error(`KanjiAPI request failed (${listResponse.status}).`);
      const kanjiList: string[] = await listResponse.json();
      const payloadList: Record<string, unknown>[] = [];
      for (let start = 0; start < kanjiList.length; start += importChunkSize) {
        const kanjiBatch = kanjiList.slice(start, start + importChunkSize);
        setUploadProgress(`Fetching kanji details ${start + 1} to ${start + kanjiBatch.length} of ${kanjiList.length}...`);
        const entries = await Promise.all(kanjiBatch.map(async (kanji) => {
          const response = await fetch(`https://kanjiapi.dev/v1/kanji/${encodeURIComponent(kanji)}`);
          if (!response.ok) throw new Error(`Failed to fetch details for ${kanji} (${response.status}).`);
          const details = await response.json() as {
            kanji: string;
            kun_readings?: string[];
            meanings?: string[];
            on_readings?: string[];
            stroke_count?: number;
          };
          let exampleSentence = '';
          let exampleMeaning = '';
          try {
            const wordsResponse = await fetch(`https://kanjiapi.dev/v1/words/${encodeURIComponent(kanji)}`);
            if (wordsResponse.ok) {
              const words = await wordsResponse.json() as Array<{
                variants?: Array<{ written?: string; pronounced?: string }>;
                meanings?: Array<{ glosses?: string[] }>;
              }>;
              const firstWord = words[0];
              const firstVariant = firstWord?.variants?.[0];
              if (firstVariant?.written && firstVariant.pronounced) {
                exampleSentence = `${firstVariant.written} (${firstVariant.pronounced})`;
              }
              exampleMeaning = firstWord?.meanings?.[0]?.glosses?.join(', ') ?? '';
            }
          } catch {
            // Examples are optional when the words endpoint is unavailable.
          }
          return {
            kanji: details.kanji,
            onyomi: (details.on_readings ?? []).join(', '),
            kunyomi: (details.kun_readings ?? []).join(', '),
            stroke_count: details.stroke_count ?? 1,
            jlpt_level: `N${levelNum}`,
            meaning: (details.meanings ?? []).join(', '),
            example_sentence: exampleSentence,
            example_meaning: exampleMeaning,
          };
        }));
        payloadList.push(...entries);
      }
      const syncedCount = await upsertMasterData('kanji', payloadList, (batch, total) => {
        setUploadProgress(`Syncing batch ${batch} of ${total}...`);
      });
      setUploadProgress('Sync complete.');
      setMessage(`${syncedCount} kanji synced from KanjiAPI.dev.`);
      onRefresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to sync kanji from KanjiAPI.dev.');
      setUploadProgress('');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportKanjiToExcel = async () => {
    setErrorMessage('');
    setMessage('');
    setUploadProgress('Fetching kanji list for export...');
    const levelNum = selectedJlptLevel.replace(/[^0-9]/g, '');
    try {
      const listResponse = await fetch(`https://kanjiapi.dev/v1/kanji/jlpt-${levelNum}`);
      if (!listResponse.ok) throw new Error(`KanjiAPI request failed (${listResponse.status}).`);
      const kanjiList: string[] = await listResponse.json();
      const rows: Record<string, unknown>[] = [];
      for (let start = 0; start < kanjiList.length; start += importChunkSize) {
        const kanjiBatch = kanjiList.slice(start, start + importChunkSize);
        setUploadProgress(`Fetching export data ${start + 1} to ${start + kanjiBatch.length} of ${kanjiList.length}...`);
        const entries = await Promise.all(kanjiBatch.map(async (kanji) => {
          const response = await fetch(`https://kanjiapi.dev/v1/kanji/${encodeURIComponent(kanji)}`);
          if (!response.ok) throw new Error(`Failed to fetch details for ${kanji} (${response.status}).`);
          const details = await response.json() as {
            kanji: string;
            kun_readings?: string[];
            meanings?: string[];
            on_readings?: string[];
            stroke_count?: number;
          };
          let exampleSentence = '';
          let exampleMeaning = '';
          try {
            const wordsResponse = await fetch(`https://kanjiapi.dev/v1/words/${encodeURIComponent(kanji)}`);
            if (wordsResponse.ok) {
              const words = await wordsResponse.json() as Array<{
                variants?: Array<{ written?: string; pronounced?: string }>;
                meanings?: Array<{ glosses?: string[] }>;
              }>;
              const firstWord = words[0];
              const variant = firstWord?.variants?.[0];
              if (variant?.written && variant.pronounced) exampleSentence = `${variant.written} (${variant.pronounced})`;
              exampleMeaning = firstWord?.meanings?.[0]?.glosses?.join(', ') ?? '';
            }
          } catch {
            // Examples are optional when the words endpoint is unavailable.
          }
          return {
            kanji: details.kanji,
            onyomi: (details.on_readings ?? []).join(', '),
            kunyomi: (details.kun_readings ?? []).join(', '),
            stroke_count: details.stroke_count ?? 1,
            jlpt_level: `N${levelNum}`,
            meaning: (details.meanings ?? []).join(', '),
            example_sentence: exampleSentence,
            example_meaning: exampleMeaning,
          };
        }));
        rows.push(...entries);
      }
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Kanji');
      XLSX.writeFile(workbook, `Kanji_N${levelNum}_KanjiAPI.xlsx`);
      setUploadProgress('');
      setMessage(`${rows.length} kanji exported to Excel.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to export kanji from KanjiAPI.dev.');
      setUploadProgress('');
    }
  };

  const handleExcelUpload = async () => {
    if (!excelRows.length) {
      setErrorMessage('No parsed data to upload.');
      return;
    }
    try {
      setIsSubmitting(true);
      setUploadProgress('');
      if (excelTable === 'questions') {
        const totalBatches = Math.ceil(excelRows.length / importChunkSize);
        for (let start = 0; start < excelRows.length; start += importChunkSize) {
          const batchNumber = Math.floor(start / importChunkSize) + 1;
          setUploadProgress(`Uploading batch ${batchNumber} of ${totalBatches}...`);
          const { error } = await supabase.from('questions').upsert(excelRows.slice(start, start + importChunkSize) as never[], {
            onConflict: 'id',
            ignoreDuplicates: false,
          });
          if (error) {
            console.error(`Error uploading batch starting at index ${start}:`, error);
            console.error('Supabase error details:', { details: error.details, message: error.message, hint: error.hint });
            throw error;
          }
        }
        setUploadProgress('Upload complete.');
        setMessage(`${excelRows.length} rows uploaded to ${displayLabels[excelTable]}.`);
      } else {
        const importedCount = await upsertMasterData(excelTable, excelRows, (batch, total) => {
          setUploadProgress(`Uploading batch ${batch} of ${total}...`);
        });
        setUploadProgress('Upload complete.');
        setMessage(`${importedCount} rows imported or updated in ${displayLabels[excelTable]}.`);
      }
      onRefresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Upload failed.');
      setUploadProgress('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadTemplate = () => {
    const worksheet = XLSX.utils.aoa_to_sheet([templateHeaders[excelTable]]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    XLSX.writeFile(workbook, `${excelTable}_template.xlsx`);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h3 className="mb-4 text-lg font-semibold text-white">Sync Data from KanjiAPI.dev</h3>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-slate-300">JLPT level
            <select value={selectedJlptLevel} onChange={(event) => setSelectedJlptLevel(event.target.value as typeof selectedJlptLevel)}
              disabled={isSyncing} className="mt-1 block rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-indigo-400 disabled:opacity-50">
              {(['5', '4', '3', '2', '1'] as const).map((level) => <option key={level} value={level}>{level.toUpperCase()}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => void handleSyncKanjiApi()} disabled={isSyncing} className="rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50">{isSyncing ? 'Fetching & Syncing...' : 'Fetch & Sync'}</button>
          <button type="button" onClick={() => void handleExportKanjiToExcel()} className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-100 hover:border-slate-500">Export to Excel</button>
        </div>
      </section>
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h3 className="mb-4 text-lg font-semibold text-white">Sync Data from Bunpro</h3>
        <div className="flex flex-wrap items-end gap-3">
          <p className="text-sm text-slate-300">Fetch grammar points using your Bunpro API token and sync them to Bunpou.</p>
          <label className="text-sm text-slate-300">
            Bunpro ID / slug
            <input
              type="text"
              value={bunproSlug}
              onChange={(event) => setBunproSlug(event.target.value)}
              placeholder="Enter ID, list (1,2,3), or range (1-50)"
              className="mt-1 block rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-indigo-400"
            />
          </label>
          <button type="button" onClick={() => void handleBunproSync(bunproSlug.trim())} disabled={isSyncing || !bunproSlug.trim()} className="rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50">{isSyncing ? 'Fetching & Syncing...' : 'Fetch & Sync Bunpou'}</button>
        </div>
      </section>
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <label className="mb-2 block text-sm text-slate-300">Target table</label>
          <select value={excelTable} onChange={(event) => setExcelTable(event.target.value as ExcelImportTable)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-indigo-400">
            {tables.map((table) => <option key={table} value={table}>{displayLabels[table]}</option>)}
          </select>
          <button type="button" onClick={handleDownloadTemplate} className="mt-4 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-100 hover:border-slate-500">Download Template</button>
        </div>
        <div className={`rounded-2xl border-2 border-dashed p-6 transition ${isDraggingFile ? 'border-indigo-400 bg-indigo-500/5' : 'border-slate-700 bg-slate-900'}`}
          onDragOver={(event) => { event.preventDefault(); setIsDraggingFile(true); }}
          onDragLeave={() => setIsDraggingFile(false)}
          onDrop={(event) => { event.preventDefault(); setIsDraggingFile(false); const file = event.dataTransfer.files?.[0]; if (file) void handleParseFile(file); }}>
          <input type="file" accept=".csv,.xlsx,.xls" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleParseFile(file); }} className="hidden" id="excel-upload-input" />
          <label htmlFor="excel-upload-input" className="flex cursor-pointer flex-col items-center justify-center gap-3 text-center text-slate-300">
            <div className="rounded-full bg-slate-800 px-4 py-2 text-xs uppercase tracking-[0.2em] text-indigo-300">Upload</div>
            <div><p className="text-lg font-medium text-white">Drop a CSV or Excel file here</p><p className="mt-1 text-sm text-slate-400">or click to browse</p></div>
            {selectedFileName && <span className="text-sm text-emerald-300">Selected: {selectedFileName}</span>}
          </label>
        </div>
      </div>
      {message && <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{message}</div>}
      {errorMessage && <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{errorMessage}</div>}
      {uploadProgress && <div className="rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-3 py-2 text-sm text-indigo-200" role="status">{uploadProgress}</div>}
      {excelRows.length > 0 && <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-semibold text-white">Parsed Preview</h3>
          <button type="button" onClick={() => void handleExcelUpload()} disabled={isSubmitting} className="rounded-xl bg-emerald-500 px-4 py-2.5 font-medium text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-400/60">{isSubmitting ? 'Uploading...' : 'Confirm & Upload to Supabase'}</button>
        </div>
        <div className="overflow-auto"><table className="min-w-full text-left text-sm text-slate-200">
          <thead className="bg-slate-800 text-slate-300"><tr>{previewColumns.map((key) => <th key={key} className="whitespace-nowrap px-3 py-2">{key}</th>)}</tr></thead>
          <tbody>{excelRows.slice(0, 10).map((row, index) => <tr key={`${index}-${Object.values(row).join('-')}`} className="border-t border-slate-800">
            {previewColumns.map((key) => { const value = row[key]; return <td key={`${index}-${key}`} className="px-3 py-2 align-top">{typeof value === 'string' || typeof value === 'number' ? String(value) : JSON.stringify(value)}</td>; })}
          </tr>)}</tbody>
        </table></div>
      </div>}
    </div>
  );
}
