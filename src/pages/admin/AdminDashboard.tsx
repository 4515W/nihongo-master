import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { parseConjugationRules } from '../../lib/grammar';
import { ExcelImportTab } from '../../components/admin/ExcelImportTab';
import { MasterDataTab, type AdminEntityRow, type AdminFormValues } from '../../components/admin/MasterDataTab';
import { QuestionsTab } from '../../components/admin/QuestionsTab';
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
const jlptLevels = ['N5', 'N4', 'N3', 'N2', 'N1'] as const;

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
  reading: '',
  structure: '',
  meaning: '',
  jlpt_level: 'N5',
  example_sentence: '',
  example_meaning: '',
  nuance_usage: '',
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

function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>('Overview');

  const [kanjiRows, setKanjiRows] = useState<KanjiItem[]>([]);
  const [kotobaRows, setKotobaRows] = useState<KotobaItem[]>([]);
  const [bunpouRows, setBunpouRows] = useState<BunpouItem[]>([]);
  const [questionRows, setQuestionRows] = useState<Question[]>([]);
  const [dashboardCounts, setDashboardCounts] = useState({ kanji: 0, kotoba: 0, bunpou: 0, questions: 0 });

  const [kanjiForm, setKanjiForm] = useState(defaultKanjiForm);
  const [kotobaForm, setKotobaForm] = useState(defaultKotobaForm);
  const [bunpouForm, setBunpouForm] = useState(defaultBunpouForm);
  const [questionForm, setQuestionForm] = useState(defaultQuestionForm);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchAllData = async () => {
    try {
      const [kanjiResult, kotobaResult, bunpouResult, questionResult, kanjiCountResult, kotobaCountResult, bunpouCountResult, questionCountResult] = await Promise.all([
        supabase.from('kanji').select('*').range(0, 4999).order('id', { ascending: false }),
        supabase.from('kotoba').select('*').range(0, 4999).order('id', { ascending: false }),
        supabase.from('bunpou').select('*').range(0, 4999).order('id', { ascending: false }),
        supabase.from('questions').select('*').range(0, 4999).order('created_at', { ascending: false }),
        supabase.from('kanji').select('*', { count: 'exact', head: true }),
        supabase.from('kotoba').select('*', { count: 'exact', head: true }),
        supabase.from('bunpou').select('*', { count: 'exact', head: true }),
        supabase.from('questions').select('*', { count: 'exact', head: true }),
      ]);

      if (kanjiResult.error) throw kanjiResult.error;
      if (kotobaResult.error) throw kotobaResult.error;
      if (bunpouResult.error) throw bunpouResult.error;
      if (questionResult.error) throw questionResult.error;
      if (kanjiCountResult.error) throw kanjiCountResult.error;
      if (kotobaCountResult.error) throw kotobaCountResult.error;
      if (bunpouCountResult.error) throw bunpouCountResult.error;
      if (questionCountResult.error) throw questionCountResult.error;

      setKanjiRows((kanjiResult.data ?? []) as KanjiItem[]);
      setKotobaRows((kotobaResult.data ?? []) as KotobaItem[]);
      setBunpouRows((bunpouResult.data ?? []) as BunpouItem[]);
      setQuestionRows((questionResult.data ?? []) as Question[]);
      setDashboardCounts({
        kanji: kanjiCountResult.count ?? 0,
        kotoba: kotobaCountResult.count ?? 0,
        bunpou: bunpouCountResult.count ?? 0,
        questions: questionCountResult.count ?? 0,
      });
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

  const fetchKanjiRows = async (jlptFilter: string) => {
    let query = supabase.from('kanji').select('*');
    const selectedLevel = jlptLevels.find((level) => level === jlptFilter);
    if (selectedLevel) query = query.eq('jlpt_level', selectedLevel);
    const { data, error } = await query.range(0, 4999).order('id', { ascending: false });
    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setKanjiRows((data ?? []) as KanjiItem[]);
    setErrorMessage('');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  const handleEntityUpdate = async (kind: TableName, id: string) => {
    const payload = kind === 'kanji'
      ? { ...kanjiForm, stroke_count: Number(kanjiForm.stroke_count) }
      : kind === 'kotoba'
      ? kotobaForm
      : kind === 'bunpou'
      ? { ...bunpouForm, nuance: bunpouForm.nuance_usage, conjugation_rules: parseConjugationRules(bunpouForm.conjugation_rules) }
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

  const handleEntityEdit = (kind: TableName, row: AdminEntityRow) => {
    if (kind === 'kanji') {
      const item = row as KanjiItem;
      setKanjiForm({ kanji: item.kanji, onyomi: item.onyomi ?? '', kunyomi: item.kunyomi ?? '', meaning: item.meaning, jlpt_level: item.jlpt_level, stroke_count: item.stroke_count ?? 1, example_sentence: item.example_sentence ?? '', example_meaning: item.example_meaning ?? '' });
    } else if (kind === 'kotoba') {
      const item = row as KotobaItem;
      setKotobaForm({ word: item.word, reading: item.reading ?? '', meaning: item.meaning, jlpt_level: item.jlpt_level, part_of_speech: item.part_of_speech ?? '', example_sentence: item.example_sentence ?? '', example_meaning: item.example_meaning ?? '' });
    } else if (kind === 'bunpou') {
      const item = row as BunpouItem;
      setBunpouForm({ title: item.title, reading: item.reading, structure: item.structure, meaning: item.meaning, jlpt_level: item.jlpt_level, example_sentence: item.example_sentence ?? '', example_meaning: item.example_meaning ?? '', nuance_usage: item.nuance_usage ?? item.nuance ?? '', conjugation_rules: JSON.stringify(item.conjugation_rules ?? {}, null, 2) });
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

  const handleKanjiCreate = async (event: FormEvent) => {
    event.preventDefault();
    const payload = {
      id: crypto.randomUUID(),
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
      id: crypto.randomUUID(),
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
      id: crypto.randomUUID(),
      title: bunpouForm.title,
      reading: bunpouForm.reading,
      structure: bunpouForm.structure,
      meaning: bunpouForm.meaning,
      jlpt_level: bunpouForm.jlpt_level,
      example_sentence: bunpouForm.example_sentence,
      example_meaning: bunpouForm.example_meaning,
      nuance: bunpouForm.nuance_usage,
      nuance_usage: bunpouForm.nuance_usage,
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
      id: crypto.randomUUID(),
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

  const renderMasterDataTab = (
    kind: 'kanji' | 'kotoba' | 'bunpou',
    rows: AdminEntityRow[],
    formValues: AdminFormValues,
    onFieldChange: (field: string, value: string) => void,
    onCreate: (event: FormEvent) => Promise<void>,
    onDelete: (id: string) => Promise<void>,
  ) => (
    <MasterDataTab
      kind={kind}
      rows={rows}
      formValues={formValues}
      onFieldChange={onFieldChange}
      onCreate={onCreate}
      onUpdate={(id) => handleEntityUpdate(kind, id)}
      onEdit={(row) => handleEntityEdit(kind, row)}
      onReset={() => handleEntityReset(kind)}
      onDelete={onDelete}
      onFilterChange={kind === 'kanji' ? fetchKanjiRows : undefined}
    />
  );

  const handleQuestionFieldChange = (field: string, value: string) => {
    if (field.startsWith('option_')) {
      const optionIndex = Number(field.slice('option_'.length));
      setQuestionForm((current) => ({
        ...current,
        options: current.options.map((option, index) => index === optionIndex ? value : option),
      }));
    } else if (field === 'exam_type') {
      setQuestionForm((current) => ({ ...current, exam_type: value as QuestionExamType }));
    } else if (field === 'section') {
      setQuestionForm((current) => ({ ...current, section: value as QuestionSection }));
    } else if (field === 'correct_answer') {
      setQuestionForm((current) => ({ ...current, correct_answer: Number(value) }));
    } else if (field === 'question_text' || field === 'explanation') {
      setQuestionForm((current) => ({ ...current, [field]: value }));
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'Overview':
        return (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Kanji" value={String(dashboardCounts.kanji)} accent="indigo" />
            <SummaryCard label="Kotoba" value={String(dashboardCounts.kotoba)} accent="blue" />
            <SummaryCard label="Bunpou" value={String(dashboardCounts.bunpou)} accent="purple" />
            <SummaryCard label="Questions" value={String(dashboardCounts.questions)} accent="emerald" />
          </div>
        );
      case 'Kanji':
        return renderMasterDataTab('kanji', kanjiRows, kanjiForm, (field, value) => setKanjiForm((current) => ({ ...current, [field]: field === 'stroke_count' ? Number(value) : value })), handleKanjiCreate, handleKanjiDelete);
      case 'Kotoba':
        return renderMasterDataTab('kotoba', kotobaRows, kotobaForm, (field, value) => setKotobaForm((current) => ({ ...current, [field]: value })), handleKotobaCreate, handleKotobaDelete);
      case 'Bunpou':
        return renderMasterDataTab('bunpou', bunpouRows, bunpouForm, (field, value) => setBunpouForm((current) => ({ ...current, [field]: value })), handleBunpouCreate, handleBunpouDelete);
      case 'Questions':
        return (
          <QuestionsTab
            rows={questionRows}
            formValues={{
              ...questionForm,
              option_0: questionForm.options[0],
              option_1: questionForm.options[1],
              option_2: questionForm.options[2],
              option_3: questionForm.options[3],
            }}
            onFieldChange={handleQuestionFieldChange}
            onCreate={handleQuestionCreate}
            onUpdate={(id) => handleEntityUpdate('questions', id)}
            onEdit={(row) => handleEntityEdit('questions', row)}
            onReset={() => handleEntityReset('questions')}
            onDelete={handleQuestionDelete}
          />
        );
      case 'Excel Import':
        return <ExcelImportTab onRefresh={() => void fetchAllData()} />;
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

          {errorMessage && <div role="alert" className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{errorMessage}</div>}
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

export { AdminDashboard };
