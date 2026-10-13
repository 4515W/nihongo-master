import { useState, useEffect } from 'react';
import type { StudyItem } from './types';
import './App.css';
import { FlashcardsPage } from './components/FlashcardPage';
import { QuizPage } from './components/QuizPage';
import { DataBankPage } from './components/DataBankPage';
import { ImportExportPage } from './components/ImportExportPage';
import {
  LayoutDashboard,
  Layers,
  BrainCircuit,
  Database,
  FileUp,
  Flame,
  Play,
  Trophy,
  Lightbulb,
  RotateCcw,
  Menu,
  X,
} from 'lucide-react';

type ThemeMode = 'black' | 'light';

const INITIAL_DATA: StudyItem[] = [
  { id: '1', type: 'kanji', japanese: '日', reading: 'ひ / ニチ', meaning: 'Matahari / Hari', jlptLevel: 'N5', exampleJp: '日曜日', exampleId: 'Hari Minggu', isMastered: true, createdAt: new Date().toISOString() },
  { id: '2', type: 'kanji', japanese: '本', reading: 'ほん', meaning: 'Buku / Asal', jlptLevel: 'N5', exampleJp: '日本語', exampleId: 'Bahasa Jepang', isMastered: false, createdAt: new Date().toISOString() },
  { id: '3', type: 'kanji', japanese: '学', reading: 'まな・ぶ / ガク', meaning: 'Belajar', jlptLevel: 'N5', exampleJp: '学生', exampleId: 'Siswa', isMastered: false, createdAt: new Date().toISOString() },
  { id: '10', type: 'kotoba', japanese: '食べる', reading: 'たべる', meaning: 'Makan', jlptLevel: 'N5', exampleJp: 'りんごを食べる。', exampleId: 'Makan apel.', isMastered: true, createdAt: new Date().toISOString() },
  { id: '11', type: 'kotoba', japanese: '飲む', reading: 'のむ', meaning: 'Minum', jlptLevel: 'N5', exampleJp: '水を飲む。', exampleId: 'Minum air.', isMastered: false, createdAt: new Date().toISOString() },
  { id: '12', type: 'kotoba', japanese: '本屋', reading: 'ほんや', meaning: 'Toko Buku', jlptLevel: 'N5', exampleJp: '本屋に行く。', exampleId: 'Pergi ke toko buku.', isMastered: false, createdAt: new Date().toISOString() },
  { id: '20', type: 'bunpou', japanese: '〜てはいけない', reading: 'Te wa ikenai', meaning: 'Tidak boleh...', jlptLevel: 'N5', structure: 'Kata Kerja Bentuk-Te + はいけない', exampleJp: 'ここで写真を撮ってはいけない。', exampleId: 'Tidak boleh mengambil foto di sini.', isMastered: true, createdAt: new Date().toISOString() },
  { id: '21', type: 'bunpou', japanese: '〜なければならない', reading: 'Nakereba narana-i', meaning: 'Harus...', jlptLevel: 'N5', structure: 'Kata Kerja Bentuk-Nai + ければならない', exampleJp: '宿題をしなければならない。', exampleId: 'Harus mengerjakan PR.', isMastered: false, createdAt: new Date().toISOString() },
];

export default function App() {
  const [items, setItems] = useState<StudyItem[]>(() => {
    const saved = localStorage.getItem('nihongo_master_items');
    return saved ? JSON.parse(saved) : INITIAL_DATA;
  });

  const [activeTab, setActiveTab] = useState<'dashboard' | 'flashcards' | 'quiz' | 'databank' | 'import'>('dashboard');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const savedTheme = localStorage.getItem('nihongo_master_theme');
    return savedTheme === 'light' ? 'light' : 'black';
  });

  useEffect(() => {
    localStorage.setItem('nihongo_master_items', JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem('nihongo_master_theme', themeMode);
  }, [themeMode]);

  const kanjiItems = items.filter((i) => i.type === 'kanji');
  const kotobaItems = items.filter((i) => i.type === 'kotoba');
  const bunpouItems = items.filter((i) => i.type === 'bunpou');

  const kanjiMastered = kanjiItems.filter((i) => i.isMastered).length;
  const kotobaMastered = kotobaItems.filter((i) => i.isMastered).length;
  const bunpouMastered = bunpouItems.filter((i) => i.isMastered).length;

  const totalMastered = items.filter((i) => i.isMastered).length;
  const totalAccuracy = items.length > 0 ? Math.round((totalMastered / items.length) * 100) : 0;

  const handleResetSampleData = () => {
    if (confirm('Reset data ke sample awal? Data buatanmu akan tertimpa.')) {
      setItems(INITIAL_DATA);
    }
  };

  const handleToggleMastery = (id: string, isMastered: boolean) => {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === id ? { ...item, isMastered } : item,
      ),
    );
  };

  const handleImportData = (incomingItems: StudyItem[]) => {
    if (!incomingItems.length) {
      alert('Tidak ada data yang valid untuk diimpor.');
      return;
    }

    setItems(incomingItems);
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
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'flashcards', label: 'Flashcards', icon: Layers },
              { id: 'quiz', label: 'Quiz', icon: BrainCircuit },
              { id: 'databank', label: 'Data Bank', icon: Database },
              { id: 'import', label: 'Import / Export', icon: FileUp },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    setIsMenuOpen(false);
                  }}
                  className={`tab-button ${isActive ? 'active' : ''}`}
                >
                  <Icon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="toolbar-actions">
            <div className="theme-switcher" aria-label="Choose theme mode">
              <button
                type="button"
                className={themeMode === 'black' ? 'is-active' : ''}
                onClick={() => setThemeMode('black')}
              >
                Black Theme
              </button>
              <button
                type="button"
                className={themeMode === 'light' ? 'is-active' : ''}
                onClick={() => setThemeMode('light')}
              >
                Light Theme
              </button>
            </div>

            <div className="streak-pill">
              <Flame size={15} className="fill-current" />
              3 Day Streak
            </div>
          </div>
        </div>
      </nav>

      <main className="main-content">
        {activeTab === 'dashboard' && (
          <>
            <div className="hero-panel">
              <div className="hero-content">
                <span className="hero-badge">OKAERI! お帰りなさい</span>
                <h2>Ready to master Japanese today?</h2>
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
                  <p className="sample-text">Pre-loaded N5 &amp; N4 Kanji, Vocabulary, and Grammar items are ready for you!</p>
                  <button onClick={handleResetSampleData} className="reset-button">
                    <RotateCcw size={13} /> Reload Built-in Sample Items
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

        {activeTab === 'import' && (
          <ImportExportPage
            items={items}
            onImportData={handleImportData}
            isDark={themeMode === 'black'}
          />
        )}

        {activeTab !== 'dashboard' && activeTab !== 'flashcards' && activeTab !== 'quiz' && activeTab !== 'databank' && activeTab !== 'import' && (
          <div className="placeholder-card">
            <p className="placeholder-title">Halaman {activeTab} siap dikembangkan!</p>
            <p className="placeholder-text">
              Pilih tab <b>Dashboard</b> untuk melihat tampilan utama.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
