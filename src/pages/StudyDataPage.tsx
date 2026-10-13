import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { JLPTLevel } from '../types/database';

type StudyPageKind = 'kanji' | 'kotoba' | 'bunpou';

type StudyPageProps = {
  kind: StudyPageKind;
  title: string;
};

export function StudyDataPage({ kind, title }: StudyPageProps) {
  const navigate = useNavigate();
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<'ALL' | JLPTLevel>('ALL');

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      setLoading(true);
      const { data, error: fetchError } = await supabase.from(kind).select('*').order('id', { ascending: false });

      if (!isMounted) return;

      if (fetchError) {
        setError(fetchError.message);
        setItems([]);
        setLoading(false);
        return;
      }

      setItems((data ?? []) as Record<string, unknown>[]);
      setError('');
      setLoading(false);
    };

    void fetchData();

    return () => {
      isMounted = false;
    };
  }, [kind]);

  const filteredItems = useMemo(() => {
    if (selectedLevel === 'ALL') return items;
    return items.filter((item) => String((item as Record<string, unknown>).jlpt_level ?? '') === selectedLevel);
  }, [items, selectedLevel]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-indigo-300">Study</p>
            <h1 className="mt-2 text-3xl font-bold text-white">{title}</h1>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => navigate('/')} className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 font-medium text-slate-200 hover:border-slate-500 hover:bg-slate-700">Dashboard</button>
            <button type="button" onClick={handleSignOut} className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 font-medium text-slate-200 hover:border-slate-500 hover:bg-slate-700">Logout</button>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <label className="mb-2 block text-sm text-slate-300">Filter by JLPT</label>
          <select
            value={selectedLevel}
            onChange={(event) => setSelectedLevel(event.target.value as 'ALL' | JLPTLevel)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-indigo-400 md:max-w-xs"
          >
            <option value="ALL">All levels</option>
            <option value="N5">N5</option>
            <option value="N4">N4</option>
            <option value="N3">N3</option>
            <option value="N2">N2</option>
            <option value="N1">N1</option>
          </select>
        </div>

        {error && <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div>}

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 animate-pulse">
                <div className="mb-3 h-5 w-28 rounded bg-slate-800" />
                <div className="h-6 w-3/4 rounded bg-slate-800" />
                <div className="mt-3 h-4 w-1/2 rounded bg-slate-800" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredItems.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-400">No items found for this filter.</div>
            ) : (
              filteredItems.map((item, index) => {
                const data = item as Record<string, unknown>;
                const primary = String(data.kanji ?? data.word ?? data.title ?? '');
                const reading = String(data.onyomi ?? data.kunyomi ?? data.reading ?? data.structure ?? '-');
                const meaning = String(data.meaning ?? '');
                const level = String(data.jlpt_level ?? 'N5');
                const secondary = data.part_of_speech ? String(data.part_of_speech) : data.example_sentence ? String(data.example_sentence) : 'Study item';

                return (
                  <div key={`${kind}-${String(data.id ?? index)}`} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-indigo-300">{level}</p>
                        <h2 className="mt-2 text-3xl font-bold text-white">{primary}</h2>
                        <p className="mt-1 text-slate-300">{reading}</p>
                      </div>
                      <span className="rounded-full border border-indigo-500/40 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-200">{title}</span>
                    </div>
                    <p className="mt-4 text-lg text-slate-200">{meaning}</p>
                    <p className="mt-3 text-sm text-slate-400">{secondary}</p>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
