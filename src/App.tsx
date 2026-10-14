import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import type { StudyItem } from './types';
import './App.css';
import { FlashcardsPage } from './components/FlashcardPage';
import { QuizPage } from './components/QuizPage';
import { DataBankPage } from './components/DataBankPage';
import { BunpouStudyPage } from './components/BunpouStudyPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { KanjiPage } from './pages/admin/KanjiPage';
import { KotobaPage } from './pages/admin/KotobaPage';
import { BunpouPage } from './pages/admin/BunpouPage';
import { QuestionPage } from './pages/admin/QuestionPage';
import { StudyDataPage } from './pages/StudyDataPage';
import { supabase } from './lib/supabase';
import { useBackDismiss } from './lib/useBackDismiss';
import type { UserItemProgress } from './types/database';
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
  Eye,
  EyeOff,
} from 'lucide-react';
import type { ItemType } from './types';
import type { QuizProgressResult } from './lib/progress';

type ThemeMode = 'black' | 'light';
type AppTab = 'dashboard' | 'flashcards' | 'bunpou' | 'quiz' | 'databank';
const navigationTabs: { id: AppTab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'flashcards', label: 'Flashcards' },
  { id: 'bunpou', label: 'Bunpou' },
  { id: 'quiz', label: 'Quiz' },
  { id: 'databank', label: 'Data Bank' },
];
const jlptLevels = ['N5', 'N4', 'N3', 'N2', 'N1'] as const;
const masteryCategories = [
  { type: 'kanji', label: 'Kanji', color: 'rose' },
  { type: 'kotoba', label: 'Kotoba', color: 'blue' },
  { type: 'bunpou', label: 'Bunpou', color: 'purple' },
] as const;

interface DashboardStats {
  masteredCount: number | null;
  masteredItemIdsByType: Record<ItemType, string[]> | null;
  quizAttempts: number;
  quizCorrect: number;
  completedItems: number;
}

const emptyDashboardStats: DashboardStats = { masteredCount: null, masteredItemIdsByType: null, quizAttempts: 0, quizCorrect: 0, completedItems: 0 };
const AUTH_CHECK_TIMEOUT_MS = 4000;

const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number): Promise<T | null> => new Promise((resolve) => {
  let settled = false;
  const timeoutId = window.setTimeout(() => {
    settled = true;
    resolve(null);
  }, timeoutMs);

  promise.then((value) => {
    if (settled) return;
    settled = true;
    window.clearTimeout(timeoutId);
    resolve(value);
  }, () => {
    if (settled) return;
    settled = true;
    window.clearTimeout(timeoutId);
    resolve(null);
  });
});

interface AppProfile {
  id: string;
  role?: 'admin' | 'user';
  full_name?: string | null;
}

const emptyAppProfile: AppProfile = { id: '' };

const fetchAppProfile = async (userId: string): Promise<AppProfile> => {
  // 1. Cek apakah userId valid dan bukan string "undefined"/"null"
  if (!userId || userId === 'undefined' || userId === 'null') {
    return emptyAppProfile;
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, role, full_name') // Atau ganti .select('*') jika kolom spesifik belum pasti
      .eq('id', userId)
      .maybeSingle<AppProfile>();

    if (error) {
      console.error('❌ Error fetching profile:', error.message, error.details);
      return emptyAppProfile;
    }

    return data ?? emptyAppProfile;
  } catch (err) {
    console.error('❌ Unexpected error in fetchAppProfile:', err);
    return emptyAppProfile;
  }
};

const fetchMasteredProgress = async (userId: string) => {
  if (!userId) return [];

  try {
    const { data, error } = await supabase
      .from('user_item_progress')
      .select('item_type, item_id')
      .eq('user_id', userId)
      .eq('is_mastered', true);

    return error ? [] : data ?? [];
  } catch {
    return [];
  }
};

const fetchStudyData = async (): Promise<StudyItem[]> => {
  const [kanjiRes, kotobaRes, bunpouRes] = await Promise.all([
    supabase.from('kanji').select('*'),
    supabase.from('kotoba').select('*'),
    supabase.from('bunpou').select('*'),
  ]);

  const kanjiRows = (kanjiRes.error ? [] : kanjiRes.data ?? []) as Record<string, any>[];
  const kotobaRows = (kotobaRes.error ? [] : kotobaRes.data ?? []) as Record<string, any>[];
  const bunpouRows = (bunpouRes.error ? [] : bunpouRes.data ?? []) as Record<string, any>[];
  console.log(`Fetched counts -> Bunpou: ${bunpouRows.length}, Kanji: ${kanjiRows.length}, Kotoba: ${kotobaRows.length}`);
  const { data: { user } } = await supabase.auth.getUser();
  let progressRows: UserItemProgress[] = [];
  if (user?.id) {
    const { data, error } = await supabase
      .from('user_item_progress')
      .select('user_id, item_type, item_id, streak_count, is_mastered, created_at, updated_at')
      .eq('user_id', user.id);
    if (!error) {
      progressRows = data ?? [];
    }
  }

  const allRows: StudyItem[] = [
    ...kanjiRows.map((item) => ({
      id: String(item.id),
      type: 'kanji' as const,
      japanese: String(item.kanji ?? ''),
      reading: [item.onyomi, item.kunyomi].filter(Boolean).join(' / ') || '—',
      onyomi: String(item.onyomi ?? ''),
      kunyomi: String(item.kunyomi ?? ''),
      meaning: String(item.meaning ?? ''),
      jlptLevel: (item.jlpt_level ?? 'N5') as StudyItem['jlptLevel'],
      exampleJp: item.example_sentence ?? undefined,
      exampleMeaning: item.example_meaning ?? undefined,
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
      title: String(item.title ?? ''),
      japanese: String(item.title ?? ''),
      reading: String(item.structure ?? '—'),
      meaning: String(item.meaning ?? ''),
      jlptLevel: (item.jlpt_level ?? 'N5') as StudyItem['jlptLevel'],
      structure: String(item.structure ?? ''),
      nuance: item.nuance ? String(item.nuance) : undefined,
      nuanceUsage: item.nuance_usage ? String(item.nuance_usage) : undefined,
      conjugationRules: item.conjugation_rules ?? undefined,
      exampleJp: item.example_sentence ?? undefined,
      exampleMeaning: item.example_meaning ?? undefined,
      isMastered: false,
      createdAt: item.created_at ?? new Date().toISOString(),
    })),
  ];

  return allRows.map((item) => {
    const progress = progressRows.find((row) => row.item_type === item.type && String(row.item_id) === String(item.id));
    return {
      ...item,
      isMastered: progress?.is_mastered ?? false,
      masteryStreak: progress?.streak_count ?? 0,
      masteryStatus: progress?.is_mastered ? 'mastered' : progress?.streak_count ? 'learning' : 'new',
    };
  });
};

const fetchDashboardStats = async (): Promise<DashboardStats> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return emptyDashboardStats;

  const historyPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from('user_quiz_history')
        .select('*')
        .eq('user_id', user.id);

      return error ? null : { data: data ?? [] };
    } catch {
      return null;
    }
  })();

  const [masteredRows, historyResult] = await Promise.all([
    fetchMasteredProgress(user.id),
    historyPromise,
  ]);

  const history = historyResult?.data ?? [];
  const masteredItemIdsByType: Record<ItemType, string[]> = { kanji: [], kotoba: [], bunpou: [] };
  for (const progress of masteredRows) {
    masteredItemIdsByType[progress.item_type].push(progress.item_id);
  }

  return {
    masteredCount: Object.values(masteredItemIdsByType).reduce((count, itemIds) => count + itemIds.length, 0),
    masteredItemIdsByType,
    quizAttempts: history.reduce((total, entry) => total + (entry.total_questions ?? (entry.item_id ? 1 : 0)), 0),
    quizCorrect: history.reduce((total, entry) => total + (
      entry.score !== null && entry.score !== undefined
        ? Math.round((entry.score * (entry.total_questions ?? 0)) / 100)
        : entry.is_correct ? 1 : 0
    ), 0),
    completedItems: history.reduce((total, entry) => total + (entry.total_questions ?? (entry.item_id ? 1 : 0)), 0),
  };
};

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [items, setItems] = useState<StudyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>(emptyDashboardStats);
  const [expandedLevel, setExpandedLevel] = useState<string | null>('N5');

  const activeTab = ({
    '/': 'dashboard',
    '/flashcards': 'flashcards',
    '/bunpou-study': 'bunpou',
    '/quiz': 'quiz',
    '/data-bank': 'databank',
  } as Record<string, AppTab>)[location.pathname] ?? 'dashboard';
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const closeMobileMenu = () => {
    mobileMenuButtonRef.current?.focus();
    setIsMenuOpen(false);
  };
  useBackDismiss(isMenuOpen || isProfileMenuOpen, () => {
    if (isMenuOpen) mobileMenuButtonRef.current?.focus();
    setIsMenuOpen(false);
    setIsProfileMenuOpen(false);
  });
  const [showFurigana, setShowFurigana] = useState(() => localStorage.getItem('nihongo_master_furigana') !== 'false');
  const [targetedQuizItem, setTargetedQuizItem] = useState<StudyItem | null>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const savedTheme = localStorage.getItem('nihongo_master_theme');
    return savedTheme === 'light' ? 'light' : 'black';
  });
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const [currentUserDisplayName, setCurrentUserDisplayName] = useState('');
  const [isAdminUser, setIsAdminUser] = useState(false);
  const appShellRef = useRef<HTMLDivElement>(null);
  const locationState = location.state as { dailyReviewIds?: string[]; targetedQuizItemId?: string; targetedQuizItemType?: ItemType } | null;
  const dailyReviewIds = new Set(locationState?.dailyReviewIds ?? []);
  const dailyReviewItems = items.filter((item) => dailyReviewIds.has(`${item.type}:${item.id}`));
  const routeTarget = locationState?.targetedQuizItemId
    ? items.find((item) => item.id === locationState.targetedQuizItemId && item.type === locationState.targetedQuizItemType)
    : undefined;
  const quizTarget = targetedQuizItem ?? routeTarget ?? null;
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const displayName = currentUserDisplayName || currentUserEmail.split('@')[0] || 'Student';

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      setIsLoading(true);
      void withTimeout(
        supabase.auth.getSession().then(() => true),
        AUTH_CHECK_TIMEOUT_MS,
      ).then(() => {
        if (mounted) setIsLoading(false);
      });

      try {
        const [data, stats] = await Promise.all([fetchStudyData(), fetchDashboardStats()]);
        if (!mounted) return;
        setItems(data);
        setDashboardStats(stats);
      } catch (error) {
        if (!mounted) return;
        console.error('Unable to load initial study data:', error);
        setItems([]);
        setDashboardStats(emptyDashboardStats);
      } finally {
        if (mounted) setIsLoading(false);
      }
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
    localStorage.setItem('nihongo_master_furigana', String(showFurigana));
  }, [showFurigana]);

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
      const session = await withTimeout(
        supabase.auth.getSession().then(({ data }) => data.session),
        AUTH_CHECK_TIMEOUT_MS,
      );

      if (!isMounted) return;

      if (!session?.user) {
        setCurrentUserEmail('');
        setCurrentUserDisplayName('');
        setIsAdminUser(false);
        return;
      }

      setCurrentUserEmail(session.user.email ?? '');

      const profile = await fetchAppProfile(session.user.id);

      if (!isMounted) return;

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

      const profile = await fetchAppProfile(session.user.id);

      if (!isMounted) return;

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

  const masteredKanji = dashboardStats.masteredItemIdsByType?.kanji.length ?? kanjiItems.filter((item) => item.isMastered).length;
  const masteredKotoba = dashboardStats.masteredItemIdsByType?.kotoba.length ?? kotobaItems.filter((item) => item.isMastered).length;
  const masteredBunpou = dashboardStats.masteredItemIdsByType?.bunpou.length ?? bunpouItems.filter((item) => item.isMastered).length;

  const totalMastered = items.filter((i) => i.isMastered).length;
  const displayedTotalMastered = dashboardStats.masteredCount ?? totalMastered;
  const dashboardMasteredItems = dashboardStats.masteredItemIdsByType
    ? new Set(Object.entries(dashboardStats.masteredItemIdsByType).flatMap(([type, ids]) => ids.map((id) => `${type}:${id}`)))
    : null;
  const totalAccuracy = dashboardStats.quizAttempts > 0 ? Math.round((dashboardStats.quizCorrect / dashboardStats.quizAttempts) * 100) : 0;

  const handleResetSampleData = async () => {
    const [refreshed, stats] = await Promise.all([fetchStudyData(), fetchDashboardStats()]);
    setItems(refreshed);
    setDashboardStats(stats);
  };

  const navigateToTab = (tab: AppTab) => {
    const tabPath: Record<AppTab, string> = { dashboard: '/', flashcards: '/flashcards', bunpou: '/bunpou-study', quiz: '/quiz', databank: '/data-bank' };
    navigate(tabPath[tab], { replace: isMenuOpen });
  };

  const handleDailyReview = () => {
    const unmasteredItems = items.filter((item) => !item.isMastered);
    if (!unmasteredItems.length) {
      window.alert('Everything is mastered. Great work!');
      return;
    }
    const reviewItems = [...unmasteredItems].sort(() => Math.random() - 0.5).slice(0, 5);
    navigate('/quiz', { state: { dailyReviewIds: reviewItems.map((item) => `${item.type}:${item.id}`) } });
  };

  const handleMasteryUpdate = (type: ItemType, id: string, progress: QuizProgressResult) => {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === id && item.type === type
          ? { ...item, isMastered: progress.isMastered, masteryStreak: progress.streakCount, masteryStatus: progress.isMastered ? 'mastered' : progress.streakCount ? 'learning' : 'new' }
          : item,
      ),
    );
  };

  const handleMasteryStateChange = (type: ItemType, id: string, isMastered: boolean, streakCount: number) => {
    setItems((currentItems) => currentItems.map((item) => (
      item.id === id && item.type === type
        ? { ...item, isMastered, masteryStreak: streakCount, masteryStatus: isMastered ? 'mastered' : streakCount ? 'learning' : 'new' }
        : item
    )));
    setDashboardStats((currentStats) => {
      const currentIds = currentStats.masteredItemIdsByType ?? {
        kanji: items.filter((item) => item.type === 'kanji' && item.isMastered).map((item) => item.id),
        kotoba: items.filter((item) => item.type === 'kotoba' && item.isMastered).map((item) => item.id),
        bunpou: items.filter((item) => item.type === 'bunpou' && item.isMastered).map((item) => item.id),
      };
      const typeIds = isMastered
        ? currentIds[type].includes(String(id)) ? currentIds[type] : [...currentIds[type], String(id)]
        : currentIds[type].filter((existingId) => String(existingId) !== String(id));
      const masteredItemIdsByType = { ...currentIds, [type]: typeIds };
      const masteredCount = Object.values(masteredItemIdsByType).reduce((total, ids) => total + ids.length, 0);
      return { ...currentStats, masteredItemIdsByType, masteredCount };
    });
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
    <div ref={appShellRef} className={`app-shell ${themeMode === 'light' ? 'theme-light' : 'theme-black'} ${showFurigana ? '' : 'furigana-hidden'}`}>
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
          ref={mobileMenuButtonRef}
          type="button"
          className="mobile-menu-toggle flex md:hidden"
          aria-label="Toggle navigation menu"
          aria-expanded={isMenuOpen}
          onClick={() => {
            setIsProfileMenuOpen(false);
            setIsMenuOpen((prev) => !prev);
          }}
        >
          <Menu size={18} />
        </button>

        {appShellRef.current && createPortal(
          <div className={`mobile-drawer-layer${isMenuOpen ? ' is-open' : ''}`} aria-hidden={!isMenuOpen} inert={!isMenuOpen}>
            <button
              type="button"
              className="mobile-drawer-backdrop"
              aria-label="Close navigation menu"
              onClick={closeMobileMenu}
            />
            <aside className="mobile-drawer" role="dialog" aria-modal="true" aria-label="Navigation menu">
              <div className="mobile-drawer-main">
                <header className="mobile-drawer-header">
                  <div className="brand-wrap">
                    <div className="brand-mark">日</div>
                    <div>
                      <h2 className="brand-title">Nihongo Master</h2>
                      <p className="brand-subtitle">日本語学習アプリ</p>
                    </div>
                  </div>
                  <button type="button" className="mobile-drawer-close" aria-label="Close navigation menu" onClick={closeMobileMenu}>
                    <X size={20} />
                  </button>
                </header>

                <nav className="mobile-drawer-links" aria-label="Main navigation">
                  {navigationTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        navigateToTab(tab.id);
                        closeMobileMenu();
                      }}
                      className={`mobile-drawer-link ${activeTab === tab.id ? 'active' : ''}`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>

              <div className="mobile-drawer-utilities">
                <div className="mobile-drawer-utility-row">
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
                  <button
                    type="button"
                    className={`furigana-toggle ${showFurigana ? 'is-active' : ''}`}
                    onClick={() => setShowFurigana((visible) => !visible)}
                    aria-pressed={showFurigana}
                    aria-label={showFurigana ? 'Hide furigana' : 'Show furigana'}
                  >
                    {showFurigana ? <Eye size={17} /> : <EyeOff size={17} />}
                    <span>Furigana</span>
                  </button>
                </div>

                {currentUserEmail && (
                  <div className="mobile-drawer-profile">
                    <div className="mobile-drawer-profile-identity">
                      <span className="profile-avatar" aria-hidden="true">{displayName.charAt(0).toLocaleUpperCase()}</span>
                      <span className="mobile-drawer-profile-copy">
                        <strong>{displayName}</strong>
                        <span>{currentUserEmail}</span>
                      </span>
                    </div>
                    {isAdminUser && (
                      <button type="button" onClick={() => { closeMobileMenu(); navigate('/admin/dashboard', { replace: true }); }}>
                        Admin Dashboard
                      </button>
                    )}
                    <button type="button" onClick={() => void handleLogout()}>
                      <LogOut size={15} /> Logout
                    </button>
                  </div>
                )}
              </div>
            </aside>
          </div>,
          appShellRef.current,
        )}

        <div className="nav-panel desktop-nav hidden md:flex">
          <div className="tab-list">
            {navigationTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    navigateToTab(tab.id as AppTab);
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

            <button
              type="button"
              className={`furigana-toggle ${showFurigana ? 'is-active' : ''}`}
              onClick={() => setShowFurigana((visible) => !visible)}
              aria-pressed={showFurigana}
              aria-label={showFurigana ? 'Hide furigana' : 'Show furigana'}
              title={showFurigana ? 'Furigana on' : 'Furigana off'}
            >
              {showFurigana ? <Eye size={17} /> : <EyeOff size={17} />}
              <span>Furigana</span>
            </button>

            {currentUserEmail && (
              <div className="profile-menu" ref={profileMenuRef}>
                <button
                  type="button"
                  className="profile-trigger"
                  aria-expanded={isProfileMenuOpen}
                  aria-haspopup="menu"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsProfileMenuOpen((open) => !open);
                  }}
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
                      <button type="button" role="menuitem" onClick={() => { setIsProfileMenuOpen(false); navigate('/admin/dashboard', { replace: true }); }}>
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
                  <button onClick={() => navigateToTab('flashcards')} className="primary-action">
                    <Play size={14} className="fill-current" /> Start Flashcards
                  </button>
                  <button onClick={() => navigateToTab('quiz')} className="secondary-action">
                    <BrainCircuit size={14} /> Take Kuis Mode
                  </button>
                  <button onClick={handleDailyReview} className="secondary-action">
                    <RotateCcw size={14} /> Daily Review Quiz
                  </button>
                </div>
              </div>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <div>
                  <p className="stat-label">Total Kanji</p>
                  <h3>{kanjiItems.length}</h3>
                  <p className="meta-positive">{masteredKanji} Mastered</p>
                </div>
                <div className="stat-icon rose">漢</div>
              </div>

              <div className="stat-card">
                <div>
                  <p className="stat-label">Total Kotoba</p>
                  <h3>{kotobaItems.length}</h3>
                  <p className="meta-positive">{masteredKotoba} Mastered</p>
                </div>
                <div className="stat-icon blue">語</div>
              </div>

              <div className="stat-card">
                <div>
                  <p className="stat-label">Total Bunpou</p>
                  <h3>{bunpouItems.length}</h3>
                  <p className="meta-positive">{masteredBunpou} Mastered</p>
                </div>
                <div className="stat-icon purple">文</div>
              </div>

              <div className="stat-card">
                <div>
                  <p className="stat-label">Accuracy Rate</p>
                  <h3>{totalAccuracy}%</h3>
                  <p className="stat-subtle">{displayedTotalMastered} Items Mastered · {dashboardStats.completedItems} Completed</p>
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
                  {jlptLevels.map((level) => {
                    const levelItems = items.filter((i) => i.jlptLevel === level);
                    const levelMastered = levelItems.filter((item) => dashboardMasteredItems?.has(`${item.type}:${item.id}`) ?? item.isMastered).length;
                    const isExpanded = expandedLevel === level;

                    return (
                      <div key={level} className={`jlpt-accordion-item${isExpanded ? ' is-expanded' : ''}`}>
                        <button
                          type="button"
                          className="jlpt-accordion-header"
                          aria-expanded={isExpanded}
                          aria-controls={`jlpt-panel-${level}`}
                          onClick={() => setExpandedLevel(isExpanded ? null : level)}
                        >
                          <span className="jlpt-accordion-title">
                            <ChevronDown size={17} className="jlpt-accordion-chevron" aria-hidden="true" />
                            JLPT {level}
                          </span>
                          <span className="jlpt-accordion-summary">{levelMastered} / {levelItems.length} items mastered</span>
                        </button>
                        {isExpanded && (
                          <div className="jlpt-category-grid" id={`jlpt-panel-${level}`}>
                            {masteryCategories.map((category) => {
                              const categoryItems = levelItems.filter((item) => item.type === category.type);
                              const mastered = categoryItems.filter((item) => dashboardMasteredItems?.has(`${item.type}:${item.id}`) ?? item.isMastered).length;
                              const percentage = categoryItems.length ? Math.round((mastered / categoryItems.length) * 100) : 0;
                              return (
                                <div className={`jlpt-category-card ${category.color}`} key={category.type}>
                                  <span className={`jlpt-category-badge ${category.color}`}>{category.label}</span>
                                  <div className="jlpt-category-card-stats">
                                    <span className="jlpt-progress-count">{mastered} / {categoryItems.length}</span>
                                    <span className="jlpt-category-percentage">{percentage}%</span>
                                  </div>
                                  <div className="progress-track">
                                    <div className={`progress-bar ${category.color}`} style={{ width: `${percentage}%` }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
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
            isDark={themeMode === 'black'}
            isOverlayOpen={isMenuOpen || isProfileMenuOpen}
            onMasteryChange={handleMasteryStateChange}
          />
        )}

        {activeTab === 'bunpou' && (
          <BunpouStudyPage
            items={items}
            onTestThisPoint={(item) => {
              setTargetedQuizItem(item);
              navigate('/quiz', { state: { targetedQuizItemId: item.id, targetedQuizItemType: item.type } });
            }}
          />
        )}

        {activeTab === 'quiz' && (
          <QuizPage
            items={items}
            isDark={themeMode === 'black'}
            dailyReviewItems={dailyReviewItems}
            targetedItemId={quizTarget?.id ?? null}
            targetedItemType={quizTarget?.type ?? null}
            onMasteryUpdate={handleMasteryUpdate}
            onQuizAttempt={() => { void fetchDashboardStats().then(setDashboardStats); }}
            onBackToDashboard={() => { setTargetedQuizItem(null); navigate('/'); }}
            onSelectCategory={() => {
              setTargetedQuizItem(null);
              navigate(location.pathname, { replace: true, state: null });
            }}
          />
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
        <Route path="/flashcards" element={<ProtectedRoute><AppShell /></ProtectedRoute>} />
        <Route path="/bunpou-study" element={<ProtectedRoute><AppShell /></ProtectedRoute>} />
        <Route path="/data-bank" element={<ProtectedRoute><AppShell /></ProtectedRoute>} />
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
              <AppShell />
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
