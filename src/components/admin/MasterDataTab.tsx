import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useBackDismiss } from '../../lib/useBackDismiss';
import type { BunpouItem, KanjiItem, KotobaItem, Question } from '../../types/database';

export type AdminTable = 'kanji' | 'kotoba' | 'bunpou' | 'questions';
export type AdminEntityRow = KanjiItem | KotobaItem | BunpouItem | Question;
export type AdminFormValues = Record<string, string | number | string[]>;

export interface EntityField {
  label: string;
  name: string;
  type?: string;
  options?: string[];
  value: string | number;
  onChange: (value: string) => void;
}

interface EntityManagementProps {
  title: string;
  rows: AdminEntityRow[];
  kind: AdminTable;
  fields: EntityField[];
  onCreate: (event: FormEvent) => Promise<void>;
  onUpdate: (id: string) => Promise<void>;
  onEdit: (row: AdminEntityRow) => void;
  onReset: () => void;
  onDelete: (id: string) => Promise<void>;
  onFilterChange?: (filter: string) => void | Promise<void>;
}

const columns: Record<AdminTable, Array<{ key: string; label: string }>> = {
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
    { key: 'title', label: 'Grammar' }, { key: 'reading', label: 'Reading' },
    { key: 'structure', label: 'Structure' }, { key: 'meaning', label: 'Meaning' },
    { key: 'jlpt_level', label: 'JLPT' }, { key: 'example_sentence', label: 'Example Sentence' },
    { key: 'example_meaning', label: 'Example Meaning' }, { key: 'nuance', label: 'Nuance' },
    { key: 'nuance_usage', label: 'Nuance & Usage' }, { key: 'conjugation_rules', label: 'Conjugation Rules' },
  ],
  questions: [
    { key: 'question_text', label: 'Question' }, { key: 'exam_type', label: 'Exam' },
    { key: 'section', label: 'Section' }, { key: 'correct_answer', label: 'Answer' },
  ],
};

const searchColumns: Record<AdminTable, string[]> = {
  kanji: ['kanji', 'onyomi', 'kunyomi', 'meaning', 'example_sentence', 'example_meaning'],
  kotoba: ['word', 'reading', 'meaning', 'example_sentence', 'example_meaning'],
  bunpou: ['title', 'reading', 'structure', 'meaning', 'example_sentence', 'example_meaning', 'nuance_usage'],
  questions: ['question_text', 'exam_type', 'section', 'explanation', 'options'],
};
const jlptLevels = ['N5', 'N4', 'N3', 'N2', 'N1'];
type ModalMode = 'add' | 'edit' | 'view' | null;

export function EntityManagementTab({
  title, rows, kind, fields, onCreate, onUpdate, onEdit, onReset, onDelete, onFilterChange,
}: EntityManagementProps) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterValue, setFilterValue] = useState('ALL');
  const [sortValue, setSortValue] = useState('created_newest');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedRow, setSelectedRow] = useState<AdminEntityRow | null>(null);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  useBackDismiss(modalMode !== null, () => setModalMode(null));

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim().toLocaleLowerCase()), 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const filteredRows = useMemo(() => {
    const query = debouncedSearch;
    const matchingRows = rows.filter((row) => {
      const values = row as unknown as Record<string, unknown>;
      const matchesSearch = !query || searchColumns[kind].some((column) =>
        String(values[column] ?? '').toLocaleLowerCase().includes(query),
      );
      const matchesFilter = filterValue === 'ALL' || String(
        kind === 'questions' ? values.section ?? '' : values.jlpt_level ?? '',
      ) === filterValue;
      return matchesSearch && matchesFilter;
    });
    const primaryColumn = searchColumns[kind][0];
    return matchingRows.sort((left, right) => {
      const a = left as unknown as Record<string, unknown>;
      const b = right as unknown as Record<string, unknown>;
      if (sortValue === 'alpha_asc' || sortValue === 'alpha_desc') {
        const order = String(a[primaryColumn] ?? '').localeCompare(String(b[primaryColumn] ?? ''), undefined, { sensitivity: 'base' });
        return sortValue === 'alpha_asc' ? order : -order;
      }
      if (sortValue === 'jlpt') {
        const rank = (value: Record<string, unknown>) => {
          const level = String(value.jlpt_level ?? value.exam_type ?? '').slice(-2);
          const index = jlptLevels.indexOf(level);
          return index < 0 ? jlptLevels.length : index;
        };
        return rank(a) - rank(b);
      }
      const aDate = Date.parse(String(a.created_at ?? '')) || 0;
      const bDate = Date.parse(String(b.created_at ?? '')) || 0;
      return sortValue === 'created_oldest' ? aDate - bDate : bDate - aDate;
    });
  }, [rows, kind, debouncedSearch, filterValue, sortValue]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const firstIndex = (safePage - 1) * pageSize;
  const pageRows = filteredRows.slice(firstIndex, firstIndex + pageSize);
  const tableColumns = columns[kind];
  const filterOptions = kind === 'questions' ? ['goi', 'bunpou', 'dokkai', 'choukai'] : jlptLevels;
  const formatCell = (value: unknown) => Array.isArray(value) ? value.join(', ') : String(value ?? '—');

  const openAdd = () => {
    onReset();
    setSelectedRow(null);
    setFormError('');
    setModalMode('add');
  };
  const openEdit = (row: AdminEntityRow) => {
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
  const handleDelete = async (row: AdminEntityRow) => {
    const id = String((row as unknown as Record<string, unknown>).id);
    if (!window.confirm(`Delete this ${title.toLocaleLowerCase()} item? This cannot be undone.`)) return;
    setFormError('');
    try {
      await onDelete(id);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to delete this item.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3">
        <label className="min-w-[220px] flex-1">
          <span className="sr-only">Search {title}</span>
          <input value={search} onChange={(event) => { setSearch(event.target.value); setCurrentPage(1); }}
            placeholder={`Search ${title.toLocaleLowerCase()}...`}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-indigo-400" />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-400">
          <span>{kind === 'questions' ? 'Section' : 'JLPT'}</span>
          <select value={filterValue} onChange={(event) => {
            const value = event.target.value;
            setFilterValue(value);
            setCurrentPage(1);
            if (kind === 'kanji') void onFilterChange?.(value);
          }} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white">
            <option value="ALL">All</option>
            {filterOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-400"><span>Sort</span>
          <select value={sortValue} onChange={(event) => { setSortValue(event.target.value); setCurrentPage(1); }}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white">
            <option value="created_newest">Created: Newest</option><option value="created_oldest">Created: Oldest</option>
            <option value="alpha_asc">Alphabetical: A-Z</option><option value="alpha_desc">Alphabetical: Z-A</option>
            <option value="jlpt">JLPT Level</option>
          </select>
        </label>
        <button type="button" onClick={openAdd} className="rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400">+ Add New</button>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        <div className="overflow-x-auto"><table className="min-w-full text-left text-sm text-slate-200">
          <thead className="bg-slate-800 text-slate-300"><tr>
            {tableColumns.map((column) => <th key={column.key} className="whitespace-nowrap px-4 py-3 text-xs uppercase tracking-wide">{column.label}</th>)}
            <th className="px-4 py-3 text-right text-xs uppercase tracking-wide">Actions</th>
          </tr></thead>
          <tbody>{pageRows.length === 0 ? (
            <tr><td className="px-4 py-10 text-center text-slate-400" colSpan={tableColumns.length + 1}>No records found.</td></tr>
          ) : pageRows.map((row) => {
            const values = row as unknown as Record<string, unknown>;
            return <tr key={String(values.id)} className="border-t border-slate-800">
              {tableColumns.map((column) => <td key={column.key} className="max-w-64 whitespace-normal px-4 py-3 align-top">{formatCell(values[column.key])}</td>)}
              <td className="whitespace-nowrap px-4 py-3 text-right"><div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setSelectedRow(row); setModalMode('view'); }} className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800">View</button>
                <button type="button" onClick={() => openEdit(row)} className="rounded-md border border-indigo-500/50 px-2.5 py-1.5 text-xs text-indigo-200 hover:bg-indigo-500/10">Edit</button>
                <button type="button" onClick={() => void handleDelete(row)} className="rounded-md border border-rose-500/40 px-2.5 py-1.5 text-xs text-rose-200 hover:bg-rose-500/10">Delete</button>
              </div></td>
            </tr>;
          })}</tbody>
        </table></div>
      </div>
      {formError && <div role="alert" className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{formError}</div>}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
        <p>Showing {filteredRows.length ? firstIndex + 1 : 0} to {Math.min(firstIndex + pageSize, filteredRows.length)} of {filteredRows.length} items</p>
        <div className="flex flex-wrap items-center gap-2"><label className="flex items-center gap-2">Rows
          <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setCurrentPage(1); }} className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-white">
            {[10, 20].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
          <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={safePage === 1} className="rounded-md border border-slate-700 px-3 py-1.5 text-slate-200 disabled:opacity-40">Previous</button>
          {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => <button key={page} type="button" onClick={() => setCurrentPage(page)} aria-current={safePage === page ? 'page' : undefined} className={`h-8 min-w-8 rounded-md border px-2 ${safePage === page ? 'border-indigo-400 bg-indigo-500 text-white' : 'border-slate-700 text-slate-200 hover:bg-slate-800'}`}>{page}</button>)}
          <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={safePage === totalPages} className="rounded-md border border-slate-700 px-3 py-1.5 text-slate-200 disabled:opacity-40">Next</button>
        </div>
      </div>
      {modalMode && <div className="admin-modal-overlay fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalMode(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="entity-modal-title" className="my-auto max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
          <div className="mb-5 flex items-center justify-between">
            <h3 id="entity-modal-title" className="text-lg font-semibold text-white">{modalMode === 'view' ? `View ${title}` : `${modalMode === 'edit' ? 'Edit' : 'Add'} ${title}`}</h3>
            <button type="button" aria-label="Close dialog" onClick={() => setModalMode(null)} className="rounded-md px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-white">✕</button>
          </div>
          {modalMode === 'view' && selectedRow ? <dl className="grid gap-3 sm:grid-cols-2">
            {Object.entries(selectedRow).map(([key, value]) => <div key={key} className="border-b border-slate-800 pb-2">
              <dt className="text-xs uppercase tracking-wide text-slate-500">{key.replace(/_/g, ' ')}</dt>
              <dd className="mt-1 break-words text-sm text-slate-100">{formatCell(value)}</dd>
            </div>)}
          </dl> : <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">{fields.map((field) => <label key={field.name} className="block text-sm text-slate-300">
              <span className="mb-1.5 block">{field.label}</span>
              {field.options ? <select value={String(field.value)} onChange={(event) => field.onChange(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white">
                {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
              </select> : field.type === 'textarea' ? <textarea rows={4} value={String(field.value)} onChange={(event) => field.onChange(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 font-mono text-sm text-white outline-none focus:border-indigo-400" />
                : <input type={field.type ?? 'text'} value={String(field.value)} onChange={(event) => field.onChange(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-indigo-400" />}
            </label>)}</div>
            <div className="flex justify-end gap-3"><button type="button" onClick={() => setModalMode(null)} className="rounded-lg border border-slate-700 px-4 py-2.5 text-slate-200 hover:bg-slate-800">Cancel</button>
              <button type="submit" disabled={isSaving} className="rounded-lg bg-indigo-500 px-4 py-2.5 font-semibold text-white hover:bg-indigo-400 disabled:opacity-50">{isSaving ? 'Saving...' : 'Save'}</button>
            </div>
          </form>}
        </section>
      </div>}
    </div>
  );
}

interface MasterDataTabProps {
  kind: 'kanji' | 'kotoba' | 'bunpou';
  rows: AdminEntityRow[];
  formValues: AdminFormValues;
  onFieldChange: (field: string, value: string) => void;
  onCreate: (event: FormEvent) => Promise<void>;
  onUpdate: (id: string) => Promise<void>;
  onEdit: (row: AdminEntityRow) => void;
  onReset: () => void;
  onDelete: (id: string) => Promise<void>;
  onFilterChange?: (filter: string) => void | Promise<void>;
}

export function MasterDataTab(props: MasterDataTabProps) {
  const {
    kind, rows, formValues, onFieldChange, onCreate, onUpdate, onEdit, onReset, onDelete, onFilterChange,
  } = props;
  const shared = (label: string, name: string) => {
    const value = formValues[name];
    return {
      label,
      name,
      value: typeof value === 'number' ? value : String(value ?? ''),
      onChange: (nextValue: string) => onFieldChange(name, nextValue),
    };
  };
  const fields: EntityField[] = kind === 'kanji' ? [
    shared('Kanji', 'kanji'), shared('Onyomi', 'onyomi'), shared('Kunyomi', 'kunyomi'), shared('Meaning', 'meaning'),
    { ...shared('JLPT Level', 'jlpt_level'), options: jlptLevels },
    { ...shared('Stroke Count', 'stroke_count'), type: 'number' },
    shared('Example Sentence', 'example_sentence'), shared('Example Meaning', 'example_meaning'),
  ] : kind === 'kotoba' ? [
    shared('Word', 'word'), shared('Reading', 'reading'), shared('Meaning', 'meaning'),
    { ...shared('JLPT Level', 'jlpt_level'), options: jlptLevels },
    shared('Part of Speech', 'part_of_speech'), shared('Example Sentence', 'example_sentence'),
    shared('Example Meaning', 'example_meaning'),
  ] : [
    shared('Title', 'title'), shared('Reading', 'reading'), shared('Structure', 'structure'), shared('Meaning', 'meaning'),
    { ...shared('JLPT Level', 'jlpt_level'), options: jlptLevels },
    shared('Example Sentence', 'example_sentence'), shared('Example Meaning', 'example_meaning'),
    { ...shared('Nuance & Usage Notes', 'nuance_usage'), type: 'textarea' },
    { ...shared('Conjugation Rules (JSON)', 'conjugation_rules'), type: 'textarea' },
  ];
  return (
    <EntityManagementTab
      title={kind === 'bunpou' ? 'Bunpou' : kind === 'kotoba' ? 'Kotoba' : 'Kanji'}
      rows={rows}
      kind={kind}
      fields={fields}
      onCreate={onCreate}
      onUpdate={onUpdate}
      onEdit={onEdit}
      onReset={onReset}
      onDelete={onDelete}
      onFilterChange={onFilterChange}
    />
  );
}
