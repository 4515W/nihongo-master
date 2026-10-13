import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import type { KotobaItem } from '../../types/database';

const emptyForm = {
  word: '',
  reading: '',
  meaning: '',
  jlpt_level: 'N5',
  part_of_speech: '',
};

export function KotobaPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<KotobaItem[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchRows = async () => {
    setLoading(true);
    const { data, error: fetchError } = await supabase.from('kotoba').select('*').order('id', { ascending: false });
    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    setRows((data ?? []) as KotobaItem[]);
    setError('');
    setLoading(false);
  };

  useEffect(() => {
    void fetchRows();
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const payload = {
      word: form.word,
      reading: form.reading,
      meaning: form.meaning,
      jlpt_level: form.jlpt_level,
      part_of_speech: form.part_of_speech,
    };

    const { error: insertError } = await (supabase.from('kotoba') as any).insert([payload]);
    if (insertError) {
      setError(insertError.message);
      return;
    }

    setForm(emptyForm);
    setMessage('Vocabulary added successfully.');
    setError('');
    void fetchRows();
  };

  const handleDelete = async (id: string) => {
    const { error: deleteError } = await supabase.from('kotoba').delete().eq('id', id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setMessage('Vocabulary deleted.');
    void fetchRows();
  };

  const handleExcelImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rowsFromExcel = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

      const normalized = rowsFromExcel.map((row) => ({
        word: String(row.word ?? ''),
        reading: String(row.reading ?? ''),
        meaning: String(row.meaning ?? ''),
        jlpt_level: String(row.jlpt_level ?? 'N5'),
        part_of_speech: String(row.part_of_speech ?? ''),
      }));

      const { error: importError } = await (supabase.from('kotoba') as any).insert(normalized as any[]);
      if (importError) {
        setError(importError.message);
        return;
      }

      setMessage(`${normalized.length} vocabulary entries imported successfully.`);
      setError('');
      event.target.value = '';
      void fetchRows();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Unable to import file.');
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-indigo-300">Admin</p>
            <h1 className="mt-2 text-3xl font-bold text-white">Kotoba Manager</h1>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => navigate('/admin/dashboard')} className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 font-medium text-slate-200 hover:border-slate-500 hover:bg-slate-700">Dashboard</button>
            <button type="button" onClick={handleSignOut} className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 font-medium text-slate-200 hover:border-slate-500 hover:bg-slate-700">Logout</button>
          </div>
        </div>

        <div className="mb-6 grid gap-6 lg:grid-cols-[420px_1fr]">
          <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="mb-4 text-xl font-semibold text-white">Add Vocabulary</h2>
            <div className="grid gap-4">
              <input value={form.word} onChange={(event) => setForm((current) => ({ ...current, word: event.target.value }))} placeholder="Word" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-indigo-400" />
              <input value={form.reading} onChange={(event) => setForm((current) => ({ ...current, reading: event.target.value }))} placeholder="Reading" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-indigo-400" />
              <input value={form.meaning} onChange={(event) => setForm((current) => ({ ...current, meaning: event.target.value }))} placeholder="Meaning" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-indigo-400" />
              <div className="grid gap-4 sm:grid-cols-2">
                <select value={form.jlpt_level} onChange={(event) => setForm((current) => ({ ...current, jlpt_level: event.target.value }))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-indigo-400">
                  <option value="N5">N5</option>
                  <option value="N4">N4</option>
                  <option value="N3">N3</option>
                  <option value="N2">N2</option>
                  <option value="N1">N1</option>
                </select>
                <input value={form.part_of_speech} onChange={(event) => setForm((current) => ({ ...current, part_of_speech: event.target.value }))} placeholder="Part of Speech" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-indigo-400" />
              </div>
            </div>
            <button type="submit" className="mt-5 w-full rounded-xl bg-indigo-500 px-4 py-2.5 font-medium text-white hover:bg-indigo-400">Save Word</button>
          </form>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-white">Import from Excel</h2>
              <label className="cursor-pointer rounded-xl bg-emerald-500 px-4 py-2 font-medium text-white hover:bg-emerald-400">
                Upload file
                <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleExcelImport} />
              </label>
            </div>
            <p className="text-sm text-slate-400">Use columns: word, reading, meaning, jlpt_level, part_of_speech</p>
          </div>
        </div>

        {message && <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{message}</div>}
        {error && <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div>}

        {loading ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-400">Loading vocab...</div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm text-slate-200">
                <thead className="bg-slate-800 text-slate-300">
                  <tr>
                    <th className="px-4 py-3">Word</th>
                    <th className="px-4 py-3">Reading</th>
                    <th className="px-4 py-3">Meaning</th>
                    <th className="px-4 py-3">JLPT</th>
                    <th className="px-4 py-3">Part of Speech</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">No vocabulary found.</td>
                    </tr>
                  ) : (
                    rows.map((item) => (
                      <tr key={item.id} className="border-t border-slate-800">
                        <td className="px-4 py-3 font-semibold text-white">{item.word}</td>
                        <td className="px-4 py-3">{item.reading || '-'}</td>
                        <td className="px-4 py-3">{item.meaning}</td>
                        <td className="px-4 py-3">{item.jlpt_level}</td>
                        <td className="px-4 py-3">{item.part_of_speech || '-'}</td>
                        <td className="px-4 py-3 text-right">
                          <button type="button" onClick={() => void handleDelete(item.id)} className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-500/20">Delete</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
