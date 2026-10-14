import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import { parseConjugationRules } from '../../lib/grammar';
import { normalizeMasterImportRow, upsertMasterData, type MasterDataTable } from '../../lib/masterDataImport';
import { useBackDismiss } from '../../lib/useBackDismiss';
import type {
  BunpouItem,
  Database,
  KanjiItem,
  KotobaItem,
  Question,
  QuestionExamType,
  QuestionSection,
} from '../../types/database';

const sidebarTabs = ['Overview', 'Kanji', 'Kotoba', 'Bunpou', 'Questions', 'Excel Import'] as const;
type AdminTab = (typeof sidebarTabs)[number];
type TableName = 'kanji' | 'kotoba' | 'bunpou' | 'questions';

type EntityRow = KanjiItem | KotobaItem | BunpouItem | Question;
type EntityField = { label: string; name: string; type?: string; options?: string[]; value: string | number; onChange: (value: string) => void };
type EntityFormConfig = { key: string; label: string; fields: EntityField[] };
type ModalMode = 'add' | 'edit' | 'view' | null;

const fileTypeOptions: TableName[] = ['kanji', 'kotoba', 'bunpou', 'questions'];

const tableDisplayLabels: Record<TableName, string> = {
  kanji: 'Kanji',
  kotoba: 'Kotoba',
  bunpou: 'Bunpou',
  questions: 'Questions',
};

const defaultKanjiForm = {
  kanji: '',
  onyomi: '',
  kunyomi: '',
  meaning: '',
  jlpt_level: 'N5',
  stroke_count: 1,
  example_sentence: '',
  example_meaning: '',
};

const defaultKotobaForm = {
  word: '',
  reading: '',
  meaning: '',
  jlpt_level: 'N5',
  part_of_speech: '',
  example_sentence: '',
  example_meaning: '',
};

const defaultBunpouForm = {
  title: '',
  structure: '',
  meaning: '',
  jlpt_level: 'N5',
  example_sentence: '',
  nuance: '',
  conjugation_rules: '{}',
};

const defaultQuestionForm = {
  exam_type: 'JLPT_N5' as QuestionExamType,
  section: 'goi' as QuestionSection,
  question_text: '',
  options: ['', '', '', ''],
  correct_answer: 0,
  explanation: '',
};

const sampleTemplateHeaders: Record<TableName, string[]> = {
  kanji: ['kanji', 'onyomi', 'kunyomi', 'meaning', 'jlpt_level', 'stroke_count', 'example_sentence', 'example_meaning'],
  kotoba: ['word', 'reading', 'meaning', 'jlpt_level', 'part_of_speech', 'example_sentence', 'example_meaning'],
  bunpou: ['title', 'structure', 'meaning', 'jlpt_level', 'example_sentence', 'nuance', 'conjugation_rules'],
  questions: ['exam_type', 'section', 'question_text', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_answer', 'explanation'],
};

const tableColumns: Record<TableName, Array<{ key: string; label: string }>> = {
  kanji: [
    { key: 'kanji', label: 'Kanji' }, { key: 'onyomi', label: 'Onyomi' },
    { key: 'kunyomi', label: 'Kunyomi' }, { key: 'meaning', label: 'Meaning' },
    { key: 'jlpt_level', label: 'JLPT' }, { key: 'stroke_count', label: 'Strokes' },
    { key: 'example_sentence', label: 'Example Sentence' }, { key: 'example_meaning', label: 'Example Meaning' },
  ],
  kotoba: [
    { key: 'word', label: 'Word' }, { key: 'reading', label: 'Reading' },
    { key: 'meaning', label: 'Meaning' }, { key: 'jlpt_level', label: 'JLPT' },
    { key: 'example_sentence', label: 'Example Sentence' }, { key: 'example_meaning', label: 'Example Meaning' },
  ],
  bunpou: [
    { key: 'title', label: 'Grammar' }, { key: 'structure', label: 'Structure' },
    { key: 'meaning', label: 'Meaning' }, { key: 'jlpt_level', label: 'JLPT' },
    { key: 'example_sentence', label: 'Example Sentence' }, { key: 'nuance', label: 'Nuance' },
    { key: 'conjugation_rules', label: 'Conjugation Rules' },
  ],
  questions: [
    { key: 'question_text', label: 'Question' }, { key: 'exam_type', label: 'Exam' },
    { key: 'section', label: 'Section' }, { key: 'correct_answer', label: 'Answer' },
  ],
};

const searchColumns: Record<TableName, string[]> = {
  kanji: ['kanji', 'onyomi', 'kunyomi', 'meaning', 'example_sentence', 'example_meaning'],
  kotoba: ['word', 'reading', 'meaning', 'example_sentence', 'example_meaning'],
  bunpou: ['title', 'structure', 'meaning', 'example_sentence'],
  questions: ['question_text', 'exam_type', 'section', 'explanation', 'options'],
};

const jlptLevels = ['N5', 'N4', 'N3', 'N2', 'N1'];

interface EntityManagementProps {
  title: string;
  rows: EntityRow[];
  kind: TableName;
  formConfig: EntityFormConfig;
  onCreate: (event: FormEvent) => Promise<void>;
  onUpdate: (id: string) => Promise<void>;
  onEdit: (row: EntityRow) => void;
  onReset: () => void;
  onDelete: (id: string) => Promise<void>;
}

function EntityManagementTab({ title, rows, kind, formConfig, onCreate, onUpdate, onEdit, onReset, onDelete }: EntityManagementProps) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterValue, setFilterValue] = useState('ALL');
  const [sortValue, setSortValue] = useState('created_newest');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  useBackDismiss(modalMode !== null, () => setModalMode(null));
  const [selectedRow, setSelectedRow] = useState<EntityRow | null>(null);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const pageSizeOptions = [10, 20];

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim().toLocaleLowerCase()), 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const filteredRows = useMemo(() => {
    const query = debouncedSearch;
    const matchingRows = rows.filter((row: EntityRow) => {
      const values = row as unknown as Record<string, unknown>;
      const matchesSearch = !query || searchColumns[kind].some((column) =>
        String(values[column] ?? '').toLocaleLowerCase().includes(query),
      );
      const matchesFilter = filterValue === 'ALL' || (
        kind === 'questions'
          ? String(values.section ?? '') === filterValue
          : String(values.jlpt_level ?? '') === filterValue
      );
      return matchesSearch && matchesFilter;
    });

    const primaryColumn = searchColumns[kind][0];
    return matchingRows.sort((left, right) => {
      const leftValues = left as unknown as Record<string, unknown>;
      const rightValues = right as unknown as Record<string, unknown>;
      if (sortValue === 'alpha_asc' || sortValue === 'alpha_desc') {
        const order = String(leftValues[primaryColumn] ?? '').localeCompare(String(rightValues[primaryColumn] ?? ''), undefined, { sensitivity: 'base' });
        return sortValue === 'alpha_asc' ? order : -order;
      }
      if (sortValue === 'jlpt') {
        const rank = (rowValues: Record<string, unknown>) => {
          const level = String(rowValues.jlpt_level ?? rowValues.exam_type ?? '').slice(-2);
          const index = jlptLevels.indexOf(level);
          return index < 0 ? jlptLevels.length : index;
        };
        return rank(leftValues) - rank(rightValues);
      }
      const leftDate = Date.parse(String(leftValues.created_at ?? '')) || 0;
      const rightDate = Date.parse(String(rightValues.created_at ?? '')) || 0;
      return sortValue === 'created_oldest' ? leftDate - rightDate : rightDate - leftDate;
    });
  }, [rows, kind, debouncedSearch, filterValue, sortValue]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const firstIndex = (safePage - 1) * pageSize;
  const pageRows = filteredRows.slice(firstIndex, firstIndex + pageSize);
  const columns = tableColumns[kind];
  const filterOptions = kind === 'questions' ? ['goi', 'bunpou', 'dokkai', 'choukai'] : jlptLevels;

  const openAdd = () => {
    onReset();
    setSelectedRow(null);
    setFormError('');
    setModalMode('add');
  };

  const openEdit = (row: EntityRow) => {
    onEdit(row);
    setSelectedRow(row);
    setFormError('');
    setModalMode('edit');
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setFormError('');
    try {
      if (modalMode === 'edit' && selectedRow) {
        await onUpdate(String((selectedRow as unknown as Record<string, unknown>).id));
      } else {
        await onCreate(event);
      }
      setModalMode(null);
      setSelectedRow(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to save this item.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (row: EntityRow) => {
    const id = String((row as unknown as Record<string, unknown>).id);
    if (!window.confirm(`Delete this ${title.toLocaleLowerCase()} item? This cannot be undone.`)) return;
    setFormError('');
    try {
      await onDelete(id);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to delete this item.');
    }
  };

  const formatCell = (value: unknown) => Array.isArray(value) ? value.join(', ') : String(value ?? '—');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3">
        <label className="min-w-[220px] flex-1">
          <span className="sr-only">Search {title}</span>
          <input
            value={search}
            onChange={(event) => { setSearch(event.target.value); setCurrentPage(1); }}
            placeholder={`Search ${title.toLocaleLowerCase()}...`}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-indigo-400"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-400">
          <span>{kind === 'questions' ? 'Section' : 'JLPT'}</span>
          <select value={filterValue} onChange={(event) => { setFilterValue(event.target.value); setCurrentPage(1); }} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white">
            <option value="ALL">All</option>
            {filterOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-400">
          <span>Sort</span>
          <select value={sortValue} onChange={(event) => { setSortValue(event.target.value); setCurrentPage(1); }} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white">
            <option value="created_newest">Created: Newest</option>
            <option value="created_oldest">Created: Oldest</option>
            <option value="alpha_asc">Alphabetical: A-Z</option>
            <option value="alpha_desc">Alphabetical: Z-A</option>
            <option value="jlpt">JLPT Level</option>
          </select>
        </label>
        <button type="button" onClick={openAdd} className="rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400">+ Add New</button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-200">
            <thead className="bg-slate-800 text-slate-300">
              <tr>
                {columns.map((column) => <th key={column.key} className="whitespace-nowrap px-4 py-3 text-xs uppercase tracking-wide">{column.label}</th>)}
                <th className="px-4 py-3 text-right text-xs uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr><td className="px-4 py-10 text-center text-slate-400" colSpan={columns.length + 1}>No records found.</td></tr>
              ) : pageRows.map((row: EntityRow) => {
                const values = row as unknown as Record<string, unknown>;
                const id = String(values.id);
                return (
                  <tr key={id} className="border-t border-slate-800">
                    {columns.map((column) => <td key={column.key} className="max-w-64 whitespace-normal px-4 py-3 align-top">{formatCell(values[column.key])}</td>)}
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => { setSelectedRow(row); setModalMode('view'); }} className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800">View</button>
                        <button type="button" onClick={() => openEdit(row)} className="rounded-md border border-indigo-500/50 px-2.5 py-1.5 text-xs text-indigo-200 hover:bg-indigo-500/10">Edit</button>
                        <button type="button" onClick={() => void handleDelete(row)} className="rounded-md border border-rose-500/40 px-2.5 py-1.5 text-xs text-rose-200 hover:bg-rose-500/10">Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {formError && <div role="alert" className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{formError}</div>}

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
        <p>Showing {filteredRows.length ? firstIndex + 1 : 0} to {Math.min(firstIndex + pageSize, filteredRows.length)} of {filteredRows.length} items</p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2">Rows
            <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setCurrentPage(1); }} className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-white">
              {pageSizeOptions.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={safePage === 1} className="rounded-md border border-slate-700 px-3 py-1.5 text-slate-200 disabled:opacity-40">Previous</button>
          {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
            <button key={page} type="button" onClick={() => setCurrentPage(page)} aria-current={safePage === page ? 'page' : undefined} className={`h-8 min-w-8 rounded-md border px-2 ${safePage === page ? 'border-indigo-400 bg-indigo-500 text-white' : 'border-slate-700 text-slate-200 hover:bg-slate-800'}`}>{page}</button>
          ))}
          <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={safePage === totalPages} className="rounded-md border border-slate-700 px-3 py-1.5 text-slate-200 disabled:opacity-40">Next</button>
        </div>
      </div>

      {modalMode && (
        <div className="admin-modal-overlay fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalMode(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="entity-modal-title" className="my-auto max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 id="entity-modal-title" className="text-lg font-semibold text-white">{modalMode === 'view' ? `View ${title}` : `${modalMode === 'edit' ? 'Edit' : 'Add'} ${title}`}</h3>
              <button type="button" aria-label="Close dialog" onClick={() => setModalMode(null)} className="rounded-md px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-white">✕</button>
            </div>
            {modalMode === 'view' && selectedRow ? (
              <dl className="grid gap-3 sm:grid-cols-2">
                {Object.entries(selectedRow).map(([key, value]) => (
                  <div key={key} className="border-b border-slate-800 pb-2">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">{key.replace(/_/g, ' ')}</dt>
                    <dd className="mt-1 break-words text-sm text-slate-100">{formatCell(value)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {formConfig.fields.map((field) => (
                    <label key={field.name} className="block text-sm text-slate-300">
                      <span className="mb-1.5 block">{field.label}</span>
                      {field.options ? (
                        <select value={String(field.value)} onChange={(event) => field.onChange(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white">
                          {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                      ) : field.type === 'textarea' ? (
                        <textarea rows={4} value={String(field.value)} onChange={(event) => field.onChange(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 font-mono text-sm text-white outline-none focus:border-indigo-400" />
                      ) : (
                        <input type={field.type ?? 'text'} value={String(field.value)} onChange={(event) => field.onChange(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-indigo-400" />
                      )}
                    </label>
                  ))}
                </div>
                {formError && <p role="alert" className="text-sm text-rose-300">{formError}</p>}
                <div className="flex justify-end gap-2 border-t border-slate-800 pt-4">
                  <button type="button" onClick={() => setModalMode(null)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200">Cancel</button>
                  <button type="submit" disabled={isSaving} className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{isSaving ? 'Saving...' : modalMode === 'edit' ? 'Save Changes' : 'Create Item'}</button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>('Overview');

  const [kanjiRows, setKanjiRows] = useState<KanjiItem[]>([]);
  const [kotobaRows, setKotobaRows] = useState<KotobaItem[]>([]);
  const [bunpouRows, setBunpouRows] = useState<BunpouItem[]>([]);
  const [questionRows, setQuestionRows] = useState<Question[]>([]);

  const [kanjiForm, setKanjiForm] = useState(defaultKanjiForm);
  const [kotobaForm, setKotobaForm] = useState(defaultKotobaForm);
  const [bunpouForm, setBunpouForm] = useState(defaultBunpouForm);
  const [questionForm, setQuestionForm] = useState(defaultQuestionForm);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [excelTable, setExcelTable] = useState<TableName>('kanji');
  const [excelRows, setExcelRows] = useState<Record<string, unknown>[]>([]);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const previewColumns = excelTable === 'questions' ? Object.keys(excelRows[0] ?? {}) : sampleTemplateHeaders[excelTable];

  const fetchAllData = async () => {
    try {
      const [kanjiResult, kotobaResult, bunpouResult, questionResult] = await Promise.all([
        supabase.from('kanji').select('*').order('id', { ascending: false }),
        supabase.from('kotoba').select('*').order('id', { ascending: false }),
        supabase.from('bunpou').select('*').order('id', { ascending: false }),
        supabase.from('questions').select('*').order('created_at', { ascending: false }),
      ]);

      if (kanjiResult.error) throw kanjiResult.error;
      if (kotobaResult.error) throw kotobaResult.error;
      if (bunpouResult.error) throw bunpouResult.error;
      if (questionResult.error) throw questionResult.error;

      setKanjiRows((kanjiResult.data ?? []) as KanjiItem[]);
      setKotobaRows((kotobaResult.data ?? []) as KotobaItem[]);
      setBunpouRows((bunpouResult.data ?? []) as BunpouItem[]);
      setQuestionRows((questionResult.data ?? []) as Question[]);
      setErrorMessage('');
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : 'Unable to load data.';
      setErrorMessage(errMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchAllData();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  const renderOverview = () => (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <SummaryCard label="Kanji" value={String(kanjiRows.length)} accent="indigo" />
      <SummaryCard label="Kotoba" value={String(kotobaRows.length)} accent="blue" />
      <SummaryCard label="Bunpou" value={String(bunpouRows.length)} accent="purple" />
      <SummaryCard label="Questions" value={String(questionRows.length)} accent="emerald" />
    </div>
  );

  const handleEntityUpdate = async (kind: TableName, id: string) => {
    const payload = kind === 'kanji'
      ? { ...kanjiForm, stroke_count: Number(kanjiForm.stroke_count) }
      : kind === 'kotoba'
      ? kotobaForm
      : kind === 'bunpou'
      ? { ...bunpouForm, conjugation_rules: parseConjugationRules(bunpouForm.conjugation_rules) }
      : {
          exam_type: questionForm.exam_type,
          section: questionForm.section,
          question_text: questionForm.question_text,
          options: [...questionForm.options],
          correct_answer: Number(questionForm.correct_answer),
          explanation: questionForm.explanation,
        };
    const { error } = await (supabase.from(kind) as any).update(payload).eq('id', id);
    if (error) throw new Error(error.message);
    await fetchAllData();
  };

  const handleEntityEdit = (kind: TableName, row: EntityRow) => {
    if (kind === 'kanji') {
      const item = row as KanjiItem;
      setKanjiForm({ kanji: item.kanji, onyomi: item.onyomi ?? '', kunyomi: item.kunyomi ?? '', meaning: item.meaning, jlpt_level: item.jlpt_level, stroke_count: item.stroke_count ?? 1, example_sentence: item.example_sentence ?? '', example_meaning: item.example_meaning ?? '' });
    } else if (kind === 'kotoba') {
      const item = row as KotobaItem;
      setKotobaForm({ word: item.word, reading: item.reading ?? '', meaning: item.meaning, jlpt_level: item.jlpt_level, part_of_speech: item.part_of_speech ?? '', example_sentence: item.example_sentence ?? '', example_meaning: item.example_meaning ?? '' });
    } else if (kind === 'bunpou') {
      const item = row as BunpouItem;
      setBunpouForm({ title: item.title, structure: item.structure, meaning: item.meaning, jlpt_level: item.jlpt_level, example_sentence: item.example_sentence ?? '', nuance: item.nuance ?? '', conjugation_rules: JSON.stringify(item.conjugation_rules ?? {}, null, 2) });
    } else {
      const item = row as Question;
      setQuestionForm({ exam_type: item.exam_type, section: item.section, question_text: item.question_text, options: [item.options[0] ?? '', item.options[1] ?? '', item.options[2] ?? '', item.options[3] ?? ''], correct_answer: item.correct_answer, explanation: item.explanation ?? '' });
    }
  };

  const handleEntityReset = (kind: TableName) => {
    if (kind === 'kanji') setKanjiForm(defaultKanjiForm);
    else if (kind === 'kotoba') setKotobaForm(defaultKotobaForm);
    else if (kind === 'bunpou') setBunpouForm(defaultBunpouForm);
    else setQuestionForm(defaultQuestionForm);
  };

  const renderEntityTab = (
    title: string,
    rows: EntityRow[],
    kind: 'kanji' | 'kotoba' | 'bunpou' | 'questions',
    formConfig: EntityFormConfig,
    onCreate: (event: FormEvent) => Promise<void>,
    onDelete: (id: string) => Promise<void>,
  ) => (
    <EntityManagementTab
      title={title}
      rows={rows}
      kind={kind}
      formConfig={formConfig}
      onCreate={onCreate}
      onUpdate={(id) => handleEntityUpdate(kind, id)}
      onEdit={(row) => handleEntityEdit(kind, row)}
      onReset={() => handleEntityReset(kind)}
      onDelete={onDelete}
    />
  );

  const handleKanjiCreate = async (event: FormEvent) => {
    event.preventDefault();
    const payload = {
      kanji: kanjiForm.kanji,
      onyomi: kanjiForm.onyomi,
      kunyomi: kanjiForm.kunyomi,
      meaning: kanjiForm.meaning,
      jlpt_level: kanjiForm.jlpt_level,
      stroke_count: Number(kanjiForm.stroke_count),
      example_sentence: kanjiForm.example_sentence,
      example_meaning: kanjiForm.example_meaning,
    };

    const { error } = await (supabase.from('kanji') as any).insert([payload]);
    if (error) throw new Error(error.message);

    setKanjiForm(defaultKanjiForm);
    void fetchAllData();
  };

  const handleKanjiDelete = async (id: string) => {
    const { error } = await supabase.from('kanji').delete().eq('id', id);
    if (error) throw new Error(error.message);
    setKanjiRows((current) => current.filter((item) => item.id !== id));
  };

  const handleKotobaCreate = async (event: FormEvent) => {
    event.preventDefault();
    const payload = {
      word: kotobaForm.word,
      reading: kotobaForm.reading,
      meaning: kotobaForm.meaning,
      jlpt_level: kotobaForm.jlpt_level,
      part_of_speech: kotobaForm.part_of_speech,
      example_sentence: kotobaForm.example_sentence,
      example_meaning: kotobaForm.example_meaning,
    };

    const { error } = await (supabase.from('kotoba') as any).insert([payload]);
    if (error) throw new Error(error.message);

    setKotobaForm(defaultKotobaForm);
    void fetchAllData();
  };

  const handleKotobaDelete = async (id: string) => {
    const { error } = await supabase.from('kotoba').delete().eq('id', id);
    if (error) throw new Error(error.message);
    setKotobaRows((current) => current.filter((item) => item.id !== id));
  };

  const handleBunpouCreate = async (event: FormEvent) => {
    event.preventDefault();
    const payload = {
      title: bunpouForm.title,
      structure: bunpouForm.structure,
      meaning: bunpouForm.meaning,
      jlpt_level: bunpouForm.jlpt_level,
      example_sentence: bunpouForm.example_sentence,
      nuance: bunpouForm.nuance,
      conjugation_rules: parseConjugationRules(bunpouForm.conjugation_rules),
    };

    const { error } = await (supabase.from('bunpou') as any).insert([payload]);
    if (error) throw new Error(error.message);

    setBunpouForm(defaultBunpouForm);
    void fetchAllData();
  };

  const handleBunpouDelete = async (id: string) => {
    const { error } = await supabase.from('bunpou').delete().eq('id', id);
    if (error) throw new Error(error.message);
    setBunpouRows((current) => current.filter((item) => item.id !== id));
  };

  const handleQuestionCreate = async (event: FormEvent) => {
    event.preventDefault();
    const payload: Database['public']['Tables']['questions']['Insert'] = {
      exam_type: questionForm.exam_type,
      section: questionForm.section,
      question_text: questionForm.question_text,
      options: [...questionForm.options],
      correct_answer: Number(questionForm.correct_answer),
      explanation: questionForm.explanation,
    };

    const { error } = await (supabase.from('questions') as any).insert([payload]);
    if (error) throw new Error(error.message);

    setQuestionForm(defaultQuestionForm);
    void fetchAllData();
  };

  const handleQuestionDelete = async (id: string) => {
    const { error } = await supabase.from('questions').delete().eq('id', id);
    if (error) throw new Error(error.message);
    setQuestionRows((current) => current.filter((item) => item.id !== id));
  };

  const handleParseFile = async (file: File) => {
    if (!file.name.match(/\.(csv|xlsx|xls)$/i)) {
      setErrorMessage('Please select a CSV or Excel file.');
      return;
    }

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const parsedRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      const normalizedRows = parsedRows.map((row: Record<string, unknown>) => normalizeImportedRow(excelTable, row));
      setExcelRows(normalizedRows);
      setSelectedFileName(file.name);
      setMessage('File parsed successfully. Review the data and upload when ready.');
      setErrorMessage('');
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : 'Failed to read the selected file.';
      setErrorMessage(errMessage);
    }
  };

  const handleExcelUpload = async () => {
    if (!excelRows.length) {
      setErrorMessage('No parsed data to upload.');
      return;
    }

    try {
      setIsSubmitting(true);
      if (excelTable === 'questions') {
        const { error } = await supabase.from('questions').insert(excelRows as any[]);
        if (error) throw error;
        setMessage(`${excelRows.length} rows uploaded to ${tableDisplayLabels[excelTable]}.`);
      } else {
        const importedCount = await upsertMasterData(excelTable, excelRows);
        setMessage(`${importedCount} rows imported or updated in ${tableDisplayLabels[excelTable]}.`);
      }
      setExcelRows([]);
      setSelectedFileName('');
      void fetchAllData();
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : 'Upload failed.';
      setErrorMessage(errMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadTemplate = () => {
    const headers = sampleTemplateHeaders[excelTable];
    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    XLSX.writeFile(workbook, `${excelTable}_template.xlsx`);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'Overview':
        return renderOverview();
      case 'Kanji':
        return renderEntityTab(
          'Kanji',
          kanjiRows,
          'kanji',
          {
            key: 'kanji-form',
            label: 'Kanji',
            fields: [
              { label: 'Kanji', name: 'kanji', value: kanjiForm.kanji, onChange: (value) => setKanjiForm((current) => ({ ...current, kanji: value })) },
              { label: 'Onyomi', name: 'onyomi', value: kanjiForm.onyomi, onChange: (value) => setKanjiForm((current) => ({ ...current, onyomi: value })) },
              { label: 'Kunyomi', name: 'kunyomi', value: kanjiForm.kunyomi, onChange: (value) => setKanjiForm((current) => ({ ...current, kunyomi: value })) },
              { label: 'Meaning', name: 'meaning', value: kanjiForm.meaning, onChange: (value) => setKanjiForm((current) => ({ ...current, meaning: value })) },
              { label: 'JLPT Level', name: 'jlpt_level', options: jlptLevels, value: kanjiForm.jlpt_level, onChange: (value) => setKanjiForm((current) => ({ ...current, jlpt_level: value })) },
              { label: 'Stroke Count', name: 'stroke_count', type: 'number', value: kanjiForm.stroke_count, onChange: (value) => setKanjiForm((current) => ({ ...current, stroke_count: Number(value) })) },
              { label: 'Example Sentence', name: 'example_sentence', value: kanjiForm.example_sentence, onChange: (value) => setKanjiForm((current) => ({ ...current, example_sentence: value })) },
              { label: 'Example Meaning', name: 'example_meaning', value: kanjiForm.example_meaning, onChange: (value) => setKanjiForm((current) => ({ ...current, example_meaning: value })) },
            ],
          },
          handleKanjiCreate,
          handleKanjiDelete,
        );
      case 'Kotoba':
        return renderEntityTab(
          'Kotoba',
          kotobaRows,
          'kotoba',
          {
            key: 'kotoba-form',
            label: 'Kotoba',
            fields: [
              { label: 'Word', name: 'word', value: kotobaForm.word, onChange: (value) => setKotobaForm((current) => ({ ...current, word: value })) },
              { label: 'Reading', name: 'reading', value: kotobaForm.reading, onChange: (value) => setKotobaForm((current) => ({ ...current, reading: value })) },
              { label: 'Meaning', name: 'meaning', value: kotobaForm.meaning, onChange: (value) => setKotobaForm((current) => ({ ...current, meaning: value })) },
              { label: 'JLPT Level', name: 'jlpt_level', options: jlptLevels, value: kotobaForm.jlpt_level, onChange: (value) => setKotobaForm((current) => ({ ...current, jlpt_level: value })) },
              { label: 'Part of Speech', name: 'part_of_speech', value: kotobaForm.part_of_speech, onChange: (value) => setKotobaForm((current) => ({ ...current, part_of_speech: value })) },
              { label: 'Example Sentence', name: 'example_sentence', value: kotobaForm.example_sentence, onChange: (value) => setKotobaForm((current) => ({ ...current, example_sentence: value })) },
              { label: 'Example Meaning', name: 'example_meaning', value: kotobaForm.example_meaning, onChange: (value) => setKotobaForm((current) => ({ ...current, example_meaning: value })) },
            ],
          },
          handleKotobaCreate,
          handleKotobaDelete,
        );
      case 'Bunpou':
        return renderEntityTab(
          'Bunpou',
          bunpouRows,
          'bunpou',
          {
            key: 'bunpou-form',
            label: 'Bunpou',
            fields: [
              { label: 'Title', name: 'title', value: bunpouForm.title, onChange: (value) => setBunpouForm((current) => ({ ...current, title: value })) },
              { label: 'Structure', name: 'structure', value: bunpouForm.structure, onChange: (value) => setBunpouForm((current) => ({ ...current, structure: value })) },
              { label: 'Meaning', name: 'meaning', value: bunpouForm.meaning, onChange: (value) => setBunpouForm((current) => ({ ...current, meaning: value })) },
              { label: 'JLPT Level', name: 'jlpt_level', options: jlptLevels, value: bunpouForm.jlpt_level, onChange: (value) => setBunpouForm((current) => ({ ...current, jlpt_level: value })) },
              { label: 'Example Sentence', name: 'example_sentence', value: bunpouForm.example_sentence, onChange: (value) => setBunpouForm((current) => ({ ...current, example_sentence: value })) },
              { label: 'Nuance & Usage Notes', name: 'nuance', type: 'textarea', value: bunpouForm.nuance, onChange: (value) => setBunpouForm((current) => ({ ...current, nuance: value })) },
              { label: 'Conjugation Rules (JSON)', name: 'conjugation_rules', type: 'textarea', value: bunpouForm.conjugation_rules, onChange: (value) => setBunpouForm((current) => ({ ...current, conjugation_rules: value })) },
            ],
          },
          handleBunpouCreate,
          handleBunpouDelete,
        );
      case 'Questions':
        return renderEntityTab(
          'Questions',
          questionRows,
          'questions',
          {
            key: 'question-form',
            label: 'Question',
            fields: [
              { label: 'Exam Type', name: 'exam_type', options: ['JLPT_N5', 'JLPT_N4', 'SSW_KAIGO', 'SSW_FOOD_SERVICE'], value: questionForm.exam_type, onChange: (value) => setQuestionForm((current) => ({ ...current, exam_type: value as QuestionExamType })) },
              { label: 'Section', name: 'section', options: ['goi', 'bunpou', 'dokkai', 'choukai'], value: questionForm.section, onChange: (value) => setQuestionForm((current) => ({ ...current, section: value as QuestionSection })) },
              { label: 'Question Text', name: 'question_text', value: questionForm.question_text, onChange: (value) => setQuestionForm((current) => ({ ...current, question_text: value })) },
              { label: 'Option A', name: 'option_0', value: questionForm.options[0], onChange: (value) => setQuestionForm((current) => ({ ...current, options: [value, current.options[1], current.options[2], current.options[3]] })) },
              { label: 'Option B', name: 'option_1', value: questionForm.options[1], onChange: (value) => setQuestionForm((current) => ({ ...current, options: [current.options[0], value, current.options[2], current.options[3]] })) },
              { label: 'Option C', name: 'option_2', value: questionForm.options[2], onChange: (value) => setQuestionForm((current) => ({ ...current, options: [current.options[0], current.options[1], value, current.options[3]] })) },
              { label: 'Option D', name: 'option_3', value: questionForm.options[3], onChange: (value) => setQuestionForm((current) => ({ ...current, options: [current.options[0], current.options[1], current.options[2], value] })) },
              { label: 'Correct Answer Index', name: 'correct_answer', type: 'number', value: questionForm.correct_answer, onChange: (value) => setQuestionForm((current) => ({ ...current, correct_answer: Number(value) })) },
              { label: 'Explanation', name: 'explanation', value: questionForm.explanation, onChange: (value) => setQuestionForm((current) => ({ ...current, explanation: value })) },
            ],
          },
          handleQuestionCreate,
          handleQuestionDelete,
        );
      case 'Excel Import':
        return (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <label className="mb-2 block text-sm text-slate-300">Target table</label>
                <select
                  value={excelTable}
                  onChange={(event) => setExcelTable(event.target.value as TableName)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-indigo-400"
                >
                  {fileTypeOptions.map((table) => (
                    <option key={table} value={table}>
                      {tableDisplayLabels[table]}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="mt-4 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-100 hover:border-slate-500"
                >
                  Download Template
                </button>
              </div>

              <div
                className={`rounded-2xl border-2 border-dashed p-6 transition ${isDraggingFile ? 'border-indigo-400 bg-indigo-500/5' : 'border-slate-700 bg-slate-900'}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDraggingFile(true);
                }}
                onDragLeave={() => setIsDraggingFile(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDraggingFile(false);
                  const file = event.dataTransfer.files?.[0];
                  if (file) void handleParseFile(file);
                }}
              >
                <input
                  type="file"
                  accept='.csv,.xlsx,.xls'
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleParseFile(file);
                  }}
                  className="hidden"
                  id="excel-upload-input"
                />
                <label htmlFor="excel-upload-input" className="flex cursor-pointer flex-col items-center justify-center gap-3 text-center text-slate-300">
                  <div className="rounded-full bg-slate-800 px-4 py-2 text-xs uppercase tracking-[0.2em] text-indigo-300">Upload</div>
                  <div>
                    <p className="text-lg font-medium text-white">Drop a CSV or Excel file here</p>
                    <p className="mt-1 text-sm text-slate-400">or click to browse</p>
                  </div>
                  {selectedFileName && <span className="text-sm text-emerald-300">Selected: {selectedFileName}</span>}
                </label>
              </div>
            </div>

            {message && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{message}</div>
            )}

            {errorMessage && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{errorMessage}</div>
            )}

            {excelRows.length > 0 && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">Parsed Preview</h3>
                  <button
                    type="button"
                    onClick={handleExcelUpload}
                    disabled={isSubmitting}
                    className="rounded-xl bg-emerald-500 px-4 py-2.5 font-medium text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-400/60"
                  >
                    {isSubmitting ? 'Uploading...' : 'Confirm & Upload to Supabase'}
                  </button>
                </div>

                <div className="overflow-auto">
                  <table className="min-w-full text-left text-sm text-slate-200">
                    <thead className="bg-slate-800 text-slate-300">
                      <tr>
                        {previewColumns.map((key) => (
                          <th key={key} className="px-3 py-2 whitespace-nowrap">{key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {excelRows.slice(0, 10).map((row: Record<string, unknown>, index) => (
                        <tr key={`${index}-${Object.values(row).join('-')}`} className="border-t border-slate-800">
                          {previewColumns.map((key) => {
                            const value = row[key];
                            return <td key={`${index}-${key}`} className="px-3 py-2 align-top">
                              {typeof value === 'string' || typeof value === 'number' ? String(value) : JSON.stringify(value)}
                            </td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen flex-col md:flex-row">
        <aside className="flex w-full flex-col border-b border-slate-800 bg-slate-900/95 p-4 md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0 md:border-b-0 md:border-r">
          <div className="mb-8 flex items-center gap-3 px-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-lg font-bold text-indigo-300">日</div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Admin</p>
              <h1 className="text-lg font-semibold text-white">Nihongo Master</h1>
            </div>
          </div>

          <nav className="grid grid-cols-2 gap-2 md:flex md:flex-col md:space-y-2">
            {sidebarTabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${activeTab === tab ? 'bg-indigo-500 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
              >
                <span>{tab}</span>
              </button>
            ))}
          </nav>

          <div className="mt-auto pt-6">
            <button type="button" onClick={handleSignOut} className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm font-medium text-slate-200 hover:border-slate-500 hover:bg-slate-700">
              Logout
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 p-4 md:p-6 lg:p-8">
          <header className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Dashboard</p>
              <h2 className="mt-1 text-2xl font-bold text-white">{activeTab}</h2>
            </div>

          </header>

          {isLoading ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-400">Loading dashboard data...</div>
          ) : (
            <div className="space-y-6">{renderTabContent()}</div>
          )}
        </main>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent: 'indigo' | 'blue' | 'purple' | 'emerald' }) {
  const palette = {
    indigo: 'from-indigo-500/20 to-indigo-400/10 text-indigo-200 border-indigo-500/30',
    blue: 'from-blue-500/20 to-blue-400/10 text-blue-200 border-blue-500/30',
    purple: 'from-purple-500/20 to-purple-400/10 text-purple-200 border-purple-500/30',
    emerald: 'from-emerald-500/20 to-emerald-400/10 text-emerald-200 border-emerald-500/30',
  };

  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-5 ${palette[accent]}`}>
      <p className="text-sm text-slate-300">{label}</p>
      <h3 className="mt-3 text-3xl font-bold">{value}</h3>
    </div>
  );
}

function normalizeImportedRow(table: TableName, row: Record<string, unknown>) {
  if (table !== 'questions') return normalizeMasterImportRow(table as MasterDataTable, row);

  switch (table) {
    case 'questions': {
      const options = [
        row.option_a,
        row.option_b,
        row.option_c,
        row.option_d,
      ]
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
    default:
      return row;
  }
}

export { AdminDashboard };
