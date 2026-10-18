import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import type { Question, QuestionExamType, QuestionSection } from '../../types/database';

const emptyForm = {
  exam_type: 'JLPT_N5' as QuestionExamType,
  section: 'goi' as QuestionSection,
  question_text: '',
  option_a: '',
  option_b: '',
  option_c: '',
  option_d: '',
  correct_answer: 0,
  explanation: '',
};

export function QuestionPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Question[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchRows = async () => {
    setLoading(true);
    const { data, error: fetchError } = await supabase.from('questions').select('*').order('created_at', { ascending: false });
    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    setRows((data ?? []) as Question[]);
    setError('');
    setLoading(false);
  };

  useEffect(() => {
    void fetchRows();
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const payload = {
      id: crypto.randomUUID(),
      exam_type: form.exam_type,
      section: form.section,
      question_text: form.question_text,
      options: [form.option_a, form.option_b, form.option_c, form.option_d],
      correct_answer: Number(form.correct_answer),
      explanation: form.explanation,
    };

    const { error: insertError } = await (supabase.from('questions') as any).insert([payload]);
    if (insertError) {
      setError(insertError.message);
      return;
    }

    setForm(emptyForm);
    setMessage('Question added successfully.');
    setError('');
    void fetchRows();
  };

  const handleDelete = async (id: string) => {
    const { error: deleteError } = await supabase.from('questions').delete().eq('id', id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setMessage('Question deleted.');
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

      const normalized = rowsFromExcel.map((row: Record<string, unknown>) => ({
        id: crypto.randomUUID(),
        exam_type: String(row.exam_type ?? 'JLPT_N5'),
        section: String(row.section ?? 'goi'),
        question_text: String(row.question_text ?? ''),
        options: [
          String(row.option_a ?? ''),
          String(row.option_b ?? ''),
          String(row.option_c ?? ''),
          String(row.option_d ?? ''),
        ],
        correct_answer: Number(row.correct_answer ?? 0),
        explanation: String(row.explanation ?? ''),
      }));

      const { error: importError } = await (supabase.from('questions') as any).insert(normalized as any[]);
      if (importError) {
        setError(importError.message);
        return;
      }

      setMessage(`${normalized.length} questions imported successfully.`);
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
            <h1 className="mt-2 text-3xl font-bold text-white">Question Manager</h1>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => navigate('/admin/dashboard')} className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 font-medium text-slate-200 hover:border-slate-500 hover:bg-slate-700">Dashboard</button>
            <button type="button" onClick={handleSignOut} className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 font-medium text-slate-200 hover:border-slate-500 hover:bg-slate-700">Logout</button>
          </div>
        </div>

        <div className="mb-6 grid gap-6 lg:grid-cols-[420px_1fr]">
          <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="mb-4 text-xl font-semibold text-white">Add Question</h2>
            <div className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <select value={form.exam_type} onChange={(event) => setForm((current) => ({ ...current, exam_type: event.target.value as QuestionExamType }))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-indigo-400">
                  <option value="JLPT_N5">JLPT N5</option>
                  <option value="JLPT_N4">JLPT N4</option>
                  <option value="SSW_KAIGO">SSW Kaigo</option>
                  <option value="SSW_FOOD_SERVICE">SSW Food Service</option>
                </select>
                <select value={form.section} onChange={(event) => setForm((current) => ({ ...current, section: event.target.value as QuestionSection }))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-indigo-400">
                  <option value="goi">Goi</option>
                  <option value="bunpou">Bunpou</option>
                  <option value="dokkai">Dokkai</option>
                  <option value="choukai">Choukai</option>
                </select>
              </div>

              <textarea rows={3} value={form.question_text} onChange={(event) => setForm((current) => ({ ...current, question_text: event.target.value }))} placeholder="Question text" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-indigo-400" />
              <input value={form.option_a} onChange={(event) => setForm((current) => ({ ...current, option_a: event.target.value }))} placeholder="Option A" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-indigo-400" />
              <input value={form.option_b} onChange={(event) => setForm((current) => ({ ...current, option_b: event.target.value }))} placeholder="Option B" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-indigo-400" />
              <input value={form.option_c} onChange={(event) => setForm((current) => ({ ...current, option_c: event.target.value }))} placeholder="Option C" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-indigo-400" />
              <input value={form.option_d} onChange={(event) => setForm((current) => ({ ...current, option_d: event.target.value }))} placeholder="Option D" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-indigo-400" />
              <div className="grid gap-4 sm:grid-cols-2">
                <input type="number" min={0} max={3} value={form.correct_answer} onChange={(event) => setForm((current) => ({ ...current, correct_answer: Number(event.target.value) }))} placeholder="Correct answer index" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-indigo-400" />
                <input value={form.explanation} onChange={(event) => setForm((current) => ({ ...current, explanation: event.target.value }))} placeholder="Explanation" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-indigo-400" />
              </div>
            </div>
            <button type="submit" className="mt-5 w-full rounded-xl bg-indigo-500 px-4 py-2.5 font-medium text-white hover:bg-indigo-400">Save Question</button>
          </form>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-white">Import from Excel</h2>
              <label className="cursor-pointer rounded-xl bg-emerald-500 px-4 py-2 font-medium text-white hover:bg-emerald-400">
                Upload file
                <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleExcelImport} />
              </label>
            </div>
            <p className="text-sm text-slate-400">Use columns: exam_type, section, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation</p>
          </div>
        </div>

        {message && <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{message}</div>}
        {error && <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div>}

        {loading ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-400">Loading questions...</div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm text-slate-200">
                <thead className="bg-slate-800 text-slate-300">
                  <tr>
                    <th className="px-4 py-3">Exam</th>
                    <th className="px-4 py-3">Section</th>
                    <th className="px-4 py-3">Question</th>
                    <th className="px-4 py-3">Options</th>
                    <th className="px-4 py-3">Correct</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">No questions found.</td>
                    </tr>
                  ) : (
                    rows.map((item) => (
                      <tr key={item.id} className="border-t border-slate-800">
                        <td className="px-4 py-3">{item.exam_type}</td>
                        <td className="px-4 py-3">{item.section}</td>
                        <td className="px-4 py-3 max-w-md text-white">{item.question_text}</td>
                        <td className="px-4 py-3">{item.options.join(' | ')}</td>
                        <td className="px-4 py-3">{item.correct_answer}</td>
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
