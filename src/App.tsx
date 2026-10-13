import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import type { StudyItem } from './types';
import './App.css';
import { FlashcardsPage } from './components/FlashcardPage';
import { QuizPage } from './components/QuizPage';
import { DataBankPage } from './components/DataBankPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { KanjiPage } from './pages/admin/KanjiPage';
import { KotobaPage } from './pages/admin/KotobaPage';
import { BunpouPage } from './pages/admin/BunpouPage';
import { QuestionPage } from './pages/admin/QuestionPage';
import { StudyDataPage } from './pages/StudyDataPage';
import { supabase } from './lib/supabase';
import {
  Layers,
  BrainCircuit,
  Play,
  Trophy,
  Lightbulb,
  RotateCcw,
  Menu,
  X,
  Sun,
  Moon,
  ChevronDown,
  LogOut,
} from 'lucide-react';

type ThemeMode = 'black' | 'light';

const fetchStudyData = async (): Promise<StudyItem[]> => {
  const [kanjiRes, kotobaRes, bunpouRes] = await Promise.all([
    supabase.from('kanji').select('*'),
    supabase.from('kotoba').select('*'),
    supabase.from('bunpou').select('*'),
  ]);

  const kanjiRows = (kanjiRes.data ?? []) as Record<string, any>[];
  const kotobaRows = (kotobaRes.data ?? []) as Record<string, any>[];
  const bunpouRows = (bunpouRes.data ?? []) as Record<string, any>[];

  const allRows = [
    ...kanjiRows.map((item) => ({
      id: String(item.id),
      type: 'kanji' as const,
      japanese: String(item.kanji ?? ''),
      reading: [item.onyomi, item.kunyomi].filter(Boolean).join(' / ') || '—',
      onyomi: String(item.onyomi ?? ''),
      kunyomi: String(item.kunyomi ?? ''),
      meaning: String(item.meaning ?? ''),
      jlptLevel: (item.jlpt_level ?? 'N5') as StudyItem['jlptLevel'],
      isMastered: false,
      createdAt: item.created_at ?? new Date().toISOString(),
    })),
    ...kotobaRows.map((item) => ({
      id: String(item.id),
      type: 'kotoba' as const,
      japanese: String(item.word ?? ''),
      reading: String(item.reading ?? '—'),
      meaning: String(item.meaning ?? ''),
      jlptLevel: (item.jlpt_level ?? 'N5') as StudyItem['jlptLevel'],
      exampleJp: item.example_sentence ?? undefined,
      exampleMeaning: item.example_meaning ?? undefined,
      relatedWords: Array.isArray(item.related_words) ? item.related_words.filter(Boolean) : [],
      isMastered: false,
      createdAt: item.created_at ?? new Date().toISOString(),
    })),
    ...bunpouRows.map((item) => ({
      id: String(item.id),
      type: 'bunpou' as const,
      japanese: String(item.title ?? ''),
      reading: String(item.structure ?? '—'),
      meaning: String(item.meaning ?? ''),
      jlptLevel: (item.jlpt_level ?? 'N5') as StudyItem['jlptLevel'],
      structure: String(item.structure ?? ''),
      exampleJp: String(item.example_sentence ?? ''),
      isMastered: false,
      createdAt: item.created_at ?? new Date().toISOString(),
    })),
  ];

  return allRows;
};

function AppShell() {
  const [items, setItems] = useState<StudyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'flashcards' | 'quiz' | 'databank'>('dashboard');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const savedTheme = localStorage.getItem('nihongo_master_theme');
    return savedTheme === 'light' ? 'light' : 'black';
  });
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const [currentUserDisplayName, setCurrentUserDisplayName] = useState('');
  const [isAdminUser, setIsAdminUser] = useState(false);
  const navigate = useNavigate();
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const displayName = currentUserDisplayName || currentUserEmail.split('@')[0] || 'Student';

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      setIsLoading(true);
      const data = await fetchStudyData();
      if (!mounted) return;
      setItems(data);
      setIsLoading(false);
    };

    void loadData();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('nihongo_master_theme', themeMode);
  }, [themeMode]);

  useEffect(() => {
    const closeProfileMenu = (event: MouseEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', closeProfileMenu);
    return () => document.removeEventListener('mousedown', closeProfileMenu);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const syncUserProfile = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!isMounted) return;

      if (!session?.user) {
        setCurrentUserEmail('');
        setCurrentUserDisplayName('');
        setIsAdminUser(false);
        return;
      }

      setCurrentUserEmail(session.user.email ?? '');

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', session.user.id)
        .maybeSingle<{ role: 'admin' | 'user'; full_name?: string | null }>();

      if (!isMounted) return;

      if (error) {
        setIsAdminUser(false);
        setCurrentUserDisplayName('');
        return;
      }

      setIsAdminUser(profile?.role === 'admin');
      setCurrentUserDisplayName(profile?.full_name?.trim() ?? '');
    };

    void syncUserProfile();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;

      if (!session?.user) {
        setCurrentUserEmail('');
        setCurrentUserDisplayName('');
        setIsAdminUser(false);
        return;
      }

      setCurrentUserEmail(session.user.email ?? '');

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', session.user.id)
        .maybeSingle<{ role: 'admin' | 'user'; full_name?: string | null }>();

      if (!isMounted) return;

      if (error) {
        setIsAdminUser(false);
        setCurrentUserDisplayName('');
        return;
      }

      setIsAdminUser(profile?.role === 'admin');
      setCurrentUserDisplayName(profile?.full_name?.trim() ?? '');
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const kanjiItems = items.filter((i) => i.type === 'kanji');
  const kotobaItems = items.filter((i) => i.type === 'kotoba');
  const bunpouItems = items.filter((i) => i.type === 'bunpou');

  const kanjiMastered = kanjiItems.filter((i) => i.isMastered).length;
  const kotobaMastered = kotobaItems.filter((i) => i.isMastered).length;
  const bunpouMastered = bunpouItems.filter((i) => i.isMastered).length;

  const totalMastered = items.filter((i) => i.isMastered).length;
  const totalAccuracy = items.length > 0 ? Math.round((totalMastered / items.length) * 100) : 0;

  const handleResetSampleData = async () => {
    const refreshed = await fetchStudyData();
    setItems(refreshed);
  };

  const handleToggleMastery = (id: string, isMastered: boolean) => {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === id ? { ...item, isMastered } : item,
      ),
    );
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUserEmail('');
    setCurrentUserDisplayName('');
    setIsAdminUser(false);
    setIsProfileMenuOpen(false);
    navigate('/login', { replace: true });
  };

  return (
    <div className={`app-shell ${themeMode === 'light' ? 'theme-light' : 'theme-black'}`}>
      <nav className="top-nav">
        <div className="brand-wrap">
          <div className="brand-mark">日</div>
          <div>
            <h1 className="brand-title">
              Nihongo Master <span className="version-badge">v1.0</span>
            </h1>
            <p className="brand-subtitle">日本語学習アプリ</p>
          </div>
        </div>

        <button
          type="button"
          className="mobile-menu-toggle"
          aria-label="Toggle navigation menu"
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((prev) => !prev)}
        >
          {isMenuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>

        <div className={`nav-panel ${isMenuOpen ? 'is-open' : ''}`}>
          <div className="tab-list">
            {[
              { id: 'dashboard', label: 'Dashboard' },
              { id: 'flashcards', label: 'Flashcards' },
              { id: 'quiz', label: 'Quiz' },
              { id: 'databank', label: 'Data Bank' },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    setIsMenuOpen(false);
                  }}
                  className={`tab-button ${isActive ? 'active' : ''}`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="toolbar-actions">
            <div className="theme-switcher" role="group" aria-label="Choose theme">
              <button
                type="button"
                className={themeMode === 'black' ? 'is-active' : ''}
                onClick={() => setThemeMode('black')}
                aria-label="Use dark theme"
                aria-pressed={themeMode === 'black'}
                title="Dark theme"
              >
                <Moon size={17} />
              </button>
              <button
                type="button"
                className={themeMode === 'light' ? 'is-active' : ''}
                onClick={() => setThemeMode('light')}
                aria-label="Use light theme"
                aria-pressed={themeMode === 'light'}
                title="Light theme"
              >
                <Sun size={17} />
              </button>
            </div>

            {currentUserEmail && (
              <div className="profile-menu" ref={profileMenuRef}>
                <button
                  type="button"
                  className="profile-trigger"
                  aria-expanded={isProfileMenuOpen}
                  aria-haspopup="menu"
                  onClick={() => setIsProfileMenuOpen((open) => !open)}
                  title={currentUserEmail}
                >
                  <span className="profile-avatar" aria-hidden="true">{displayName.charAt(0).toLocaleUpperCase()}</span>
                  <span className="profile-name">{displayName}</span>
                  <ChevronDown size={15} />
                </button>
                {isProfileMenuOpen && (
                  <div className="profile-dropdown" role="menu">
                    <span className="profile-email">{currentUserEmail}</span>
                    {isAdminUser && (
                      <button type="button" role="menuitem" onClick={() => { setIsProfileMenuOpen(false); navigate('/admin/dashboard'); }}>
                        Admin Dashboard
                      </button>
                    )}
                    <button type="button" role="menuitem" onClick={() => void handleLogout()}>
                      <LogOut size={15} /> Logout
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="main-content">
        {isLoading ? (
          <div className="panel loading-panel">
            <p>Loading study data from Supabase...</p>
          </div>
        ) : activeTab === 'dashboard' && (
          <>
            <div className="hero-panel">
              <div className="hero-content">
                <span className="hero-badge">お帰りなさい</span>
                <h2>Okaeri, {displayName}!</h2>
                <p>
                  Track your progress, review flashcards, and test your skills in Kanji, Kotoba, and Bunpou.
                </p>
                <div className="hero-actions">
                  <button onClick={() => setActiveTab('flashcards')} className="primary-action">
                    <Play size={14} className="fill-current" /> Start Flashcards
                  </button>
                  <button onClick={() => setActiveTab('quiz')} className="secondary-action">
                    <BrainCircuit size={14} /> Take Kuis Mode
                  </button>
                </div>
              </div>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <div>
                  <p className="stat-label">Total Kanji</p>
                  <h3>{kanjiItems.length}</h3>
                  <p className="meta-positive">{kanjiMastered} Mastered</p>
                </div>
                <div className="stat-icon rose">漢</div>
              </div>

              <div className="stat-card">
                <div>
                  <p className="stat-label">Total Kotoba</p>
                  <h3>{kotobaItems.length}</h3>
                  <p className="meta-positive">{kotobaMastered} Mastered</p>
                </div>
                <div className="stat-icon blue">語</div>
              </div>

              <div className="stat-card">
                <div>
                  <p className="stat-label">Total Bunpou</p>
                  <h3>{bunpouItems.length}</h3>
                  <p className="meta-positive">{bunpouMastered} Mastered</p>
                </div>
                <div className="stat-icon purple">文</div>
              </div>

              <div className="stat-card">
                <div>
                  <p className="stat-label">Accuracy Rate</p>
                  <h3>{totalAccuracy}%</h3>
                  <p className="stat-subtle">{totalMastered} Items Completed</p>
                </div>
                <div className="stat-icon amber">
                  <Trophy size={22} />
                </div>
              </div>
            </div>

            <div className="bottom-grid">
              <div className="panel panel-wide">
                <h3 className="section-title">
                  <Layers size={16} className="text-rose-500" /> Overall Mastery Breakdown
                </h3>

                <div className="progress-list">
                  {['N5', 'N4', 'N3'].map((level) => {
                    const levelItems = items.filter((i) => i.jlptLevel === level);
                    const levelMastered = levelItems.filter((i) => i.isMastered).length;
                    const percentage = levelItems.length > 0 ? Math.round((levelMastered / levelItems.length) * 100) : 0;

                    return (
                      <div key={level} className="progress-item">
                        <div className="progress-header">
                          <span>JLPT {level}</span>
                          <span>
                            {levelMastered} / {levelItems.length} Mastered ({percentage}%)
                          </span>
                        </div>
                        <div className="progress-track">
                          <div className="progress-bar" style={{ width: `${percentage}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="panel tip-panel">
                <div className="tip-block">
                  <h3 className="section-title warning">
                    <Lightbulb size={16} /> Study Tip of the Day
                  </h3>
                  <div className="tip-box">
                    "Say example sentences out loud using the built-in TTS audio button! Combining listening and visual memory speeds up kanji recall by up to 40%."
                  </div>
                </div>

                <div className="sample-box">
                  <p className="sample-label">NEED SAMPLE DATA?</p>
                  <p className="sample-text">Live data is loaded directly from Supabase for your study library.</p>
                  <button onClick={() => void handleResetSampleData()} className="reset-button">
                    <RotateCcw size={13} /> Refresh Data
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'flashcards' && (
          <FlashcardsPage
            items={items}
            onToggleMastery={handleToggleMastery}
            isDark={themeMode === 'black'}
          />
        )}

        {activeTab === 'quiz' && (
          <QuizPage items={items} isDark={themeMode === 'black'} />
        )}

        {activeTab === 'databank' && (
          <DataBankPage items={items} isDark={themeMode === 'black'} />
        )}

      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/kanji"
          element={
            <ProtectedRoute>
              <StudyDataPage kind="kanji" title="Kanji" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/kotoba"
          element={
            <ProtectedRoute>
              <StudyDataPage kind="kotoba" title="Kotoba" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bunpou"
          element={
            <ProtectedRoute>
              <StudyDataPage kind="bunpou" title="Bunpou" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/quiz"
          element={
            <ProtectedRoute>
              <QuizRoutePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute requireAdmin>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/kanji"
          element={
            <ProtectedRoute requireAdmin>
              <KanjiPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/kotoba"
          element={
            <ProtectedRoute requireAdmin>
              <KotobaPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/bunpou"
          element={
            <ProtectedRoute requireAdmin>
              <BunpouPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/questions"
          element={
            <ProtectedRoute requireAdmin>
              <QuestionPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function QuizRoutePage() {
  const [items, setItems] = useState<StudyItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const [kanjiRes, kotobaRes, bunpouRes] = await Promise.all([
        supabase.from('kanji').select('*'),
        supabase.from('kotoba').select('*'),
        supabase.from('bunpou').select('*'),
      ]);

      if (!mounted) return;

      const kanjiRows = (kanjiRes.data ?? []) as Record<string, any>[];
      const kotobaRows = (kotobaRes.data ?? []) as Record<string, any>[];
      const bunpouRows = (bunpouRes.data ?? []) as Record<string, any>[];

      const nextItems: StudyItem[] = [
        ...kanjiRows.map((item) => ({
          id: String(item.id),
          type: 'kanji' as const,
          japanese: String(item.kanji ?? ''),
          reading: [item.onyomi, item.kunyomi].filter(Boolean).join(' / ') || '—',
          onyomi: String(item.onyomi ?? ''),
          kunyomi: String(item.kunyomi ?? ''),
          meaning: String(item.meaning ?? ''),
          jlptLevel: (item.jlpt_level ?? 'N5') as StudyItem['jlptLevel'],
          isMastered: false,
          createdAt: item.created_at ?? new Date().toISOString(),
        })),
        ...kotobaRows.map((item) => ({
          id: String(item.id),
          type: 'kotoba' as const,
          japanese: String(item.word ?? ''),
          reading: String(item.reading ?? '—'),
          meaning: String(item.meaning ?? ''),
          jlptLevel: (item.jlpt_level ?? 'N5') as StudyItem['jlptLevel'],
          isMastered: false,
          createdAt: item.created_at ?? new Date().toISOString(),
        })),
        ...bunpouRows.map((item) => ({
          id: String(item.id),
          type: 'bunpou' as const,
          japanese: String(item.title ?? ''),
          reading: String(item.structure ?? '—'),
          meaning: String(item.meaning ?? ''),
          jlptLevel: (item.jlpt_level ?? 'N5') as StudyItem['jlptLevel'],
          structure: String(item.structure ?? ''),
          exampleJp: String(item.example_sentence ?? ''),
          isMastered: false,
          createdAt: item.created_at ?? new Date().toISOString(),
        })),
      ];

      setItems(nextItems);
      setLoading(false);
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">Loading quiz data...</div>;
  }

  return <QuizPage items={items} isDark />;
}
