import React, { useState, useEffect } from 'react';
import type { StudyItem } from '../types';
import type { KotobaItem } from '../types/database';
import { supabase } from '../lib/supabase';
import { RotateCw, Volume2, PenTool, RefreshCw, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { FuriganaText } from './FuriganaText';
import { speakJapanese } from '../lib/audio';
import { normalizeStudyItemType } from '../lib/studyItems';

interface Props {
  items: StudyItem[];
  isDark: boolean;
  isOverlayOpen: boolean;
  onMarkAsMastered: (item: StudyItem) => Promise<boolean>;
}

export const FlashcardsPage: React.FC<Props> = ({ items, isDark, isOverlayOpen, onMarkAsMastered }) => {
  const [selectedType, setSelectedType] = useState<'ALL' | 'kanji' | 'kotoba'>('ALL');
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'new' | 'learning' | 'mastered'>('ALL');
  const [search, setSearch] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [strokeSvg, setStrokeSvg] = useState<string | null>(null);
  const [loadingStroke, setLoadingStroke] = useState(false);
  const [relatedKotoba, setRelatedKotoba] = useState<KotobaItem[]>([]);
  const [loadingRelatedKotoba, setLoadingRelatedKotoba] = useState(false);
  const [isMarkingMastered, setIsMarkingMastered] = useState(false);
  const [masterySaveError, setMasterySaveError] = useState('');

  const styles = {
    filterBar: isDark ? 'bg-[#161b22]/90 border-slate-800' : 'bg-white border-slate-200 shadow-sm',
    dropdown: isDark ? 'bg-[#0d1117] border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800',
    cardBgFront: isDark ? 'bg-[#161b22] border-slate-800/90 shadow-2xl' : 'bg-white border-slate-200 shadow-xl',
    cardBgBack: isDark ? 'bg-[#161b22] border-rose-500/30 shadow-2xl' : 'bg-white border-rose-300 shadow-xl',
    sidePanelBg: isDark ? 'bg-[#161b22] border-slate-800/90 shadow-2xl' : 'bg-white border-slate-200 shadow-xl',
    gridBg: isDark ? 'bg-[#0d1117]/80 border-slate-700' : 'bg-slate-50 border-slate-300',
    gridLines: isDark ? 'border-slate-800/80' : 'border-slate-300',
    textMain: isDark ? 'text-white' : 'text-slate-900',
    textSub: isDark ? 'text-slate-300' : 'text-slate-700',
    textMuted: isDark ? 'text-slate-400' : 'text-slate-500',
    badgeType: isDark ? 'bg-slate-800/80 text-slate-300' : 'bg-slate-100 text-slate-700',
  };

  const filteredItems = items.filter((item) => {
    const itemType = normalizeStudyItemType(item.type);
    const matchFlashcardType = itemType === 'kanji' || itemType === 'kotoba';
    const matchType = selectedType === 'ALL' || itemType === normalizeStudyItemType(selectedType);
    const matchLevel = selectedLevel === 'ALL' || item.jlptLevel === selectedLevel;
    const matchStatus =
      selectedStatus === 'ALL'
        ? true
        : selectedStatus === 'mastered'
        ? item.isMastered
        : selectedStatus === 'learning'
        ? !item.isMastered && Boolean(item.masteryStreak)
        : !item.isMastered && !item.masteryStreak;
    const query = search.trim().toLocaleLowerCase();
    const matchSearch = !query || [item.japanese, item.reading, item.onyomi, item.kunyomi, item.meaning]
      .some((value) => value?.toLocaleLowerCase().includes(query));
    return matchFlashcardType && matchType && matchLevel && matchStatus && matchSearch;
  });

  const currentItem = filteredItems[currentIndex];
  const currentItemType = normalizeStudyItemType(currentItem?.type);
  const isKanji = currentItemType === 'kanji';
  const isKotoba = currentItemType === 'kotoba';
  const featuredKotoba = relatedKotoba[0];

  useEffect(() => {
    let isMounted = true;

    const fetchRelatedKotoba = async () => {
      if (!currentItem || normalizeStudyItemType(currentItem.type) !== 'kanji') {
        setRelatedKotoba([]);
        setLoadingRelatedKotoba(false);
        return;
      }

      setRelatedKotoba([]);
      setLoadingRelatedKotoba(true);
      const { data, error } = await supabase
        .from('kotoba')
        .select('*')
        .like('word', `%${currentItem.japanese}%`)
        .limit(5);

      if (!isMounted) return;
      setRelatedKotoba(error ? [] : data ?? []);
      setLoadingRelatedKotoba(false);
    };

    void fetchRelatedKotoba();
    return () => {
      isMounted = false;
    };
  }, [currentItem?.id, currentItem?.japanese, currentItem?.type]);

  useEffect(() => {
    if (!currentItem || normalizeStudyItemType(currentItem.type) !== 'kanji') {
      setStrokeSvg(null);
      return;
    }

    const fetchStrokeOrder = async () => {
      setLoadingStroke(true);
      try {
        const charCode = currentItem.japanese.charCodeAt(0).toString(16).padStart(5, '0');
        const url = `https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/${charCode}.svg`;
        
        const response = await fetch(url);
        if (response.ok) {
          let svgText = await response.text();
          svgText = svgText.replace(/#000000/g, isDark ? '#f43f5e' : '#e11d48');
          svgText = svgText.replace(/#808080/g, isDark ? '#64748b' : '#94a3b8');
          svgText = svgText.replace('<svg ', '<svg class="w-full h-full" ');
          setStrokeSvg(svgText);
        } else {
          setStrokeSvg(null);
        }
      } catch (err) {
        console.error('Gagal mengambil stroke order:', err);
        setStrokeSvg(null);
      } finally {
        setLoadingStroke(false);
      }
    };

    fetchStrokeOrder();
  }, [currentItem, isDark]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (e.code === 'ArrowRight' && filteredItems.length > 0) {
        e.preventDefault();
        setIsFlipped(false);
        setCurrentIndex((index) => (index + 1) % filteredItems.length);
      } else if (e.code === 'ArrowLeft' && filteredItems.length > 0) {
        e.preventDefault();
        setIsFlipped(false);
        setCurrentIndex((index) => (index - 1 + filteredItems.length) % filteredItems.length);
      } else if (e.code === 'KeyA' && isKotoba) {
        e.preventDefault();
        speakJapanese(`${currentItem.japanese}。${currentItem.reading ?? ''}。${currentItem.exampleJp ?? ''}`);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentItem, filteredItems.length]);

  useEffect(() => {
    setIsFlipped(false);
    setStrokeSvg(null);
    setMasterySaveError('');
  }, [currentIndex, selectedType, selectedLevel, selectedStatus]);

  const handleNavigate = (direction: -1 | 1) => {
    setIsFlipped(false);
    if (filteredItems.length > 0) {
      setCurrentIndex((prev) => (prev + direction + filteredItems.length) % filteredItems.length);
    }
  };

  const handleSpeak = speakJapanese;

  const handleMarkCurrentAsMastered = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!currentItem || currentItem.isMastered || isMarkingMastered) return;

    setIsMarkingMastered(true);
    setMasterySaveError('');
    try {
      const saved = await onMarkAsMastered(currentItem);
      if (!saved) setMasterySaveError('Could not save mastery. Please try again.');
    } catch {
      setMasterySaveError('Could not save mastery. Please try again.');
    } finally {
      setIsMarkingMastered(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-28 sm:px-6 md:pb-0">
      {/* Top Filter Bar */}
      <div className={`border rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 transition-colors duration-300 ${styles.filterBar}`}>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="inline-flex rounded-xl border border-slate-700 p-1" role="group" aria-label="Flashcard type">
            {[
              { value: 'ALL', label: 'All' },
              { value: 'kanji', label: 'Kanji' },
              { value: 'kotoba', label: 'Kotoba' },
            ].map((type) => (
              <button key={type.value} type="button" aria-pressed={selectedType === type.value} onClick={() => { setSelectedType(type.value as typeof selectedType); setCurrentIndex(0); }} className={`rounded-lg px-3 py-2 text-xs font-bold ${selectedType === type.value ? 'bg-rose-500 text-white' : styles.textMuted}`}>
                {type.label}
              </button>
            ))}
          </div>

          <select
            value={selectedLevel}
            onChange={(e) => { setSelectedLevel(e.target.value); setCurrentIndex(0); }}
            className={`border text-xs font-semibold px-4 py-2.5 rounded-xl focus:outline-none focus:border-rose-500 cursor-pointer flex-1 sm:flex-none ${styles.dropdown}`}
          >
            <option value="ALL">All JLPT Levels</option>
            <option value="N5">N5</option>
            <option value="N4">N4</option>
            <option value="N3">N3</option>
            <option value="N2">N2</option>
            <option value="N1">N1</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => { setSelectedStatus(e.target.value as typeof selectedStatus); setCurrentIndex(0); }}
            className={`border text-xs font-semibold px-4 py-2.5 rounded-xl focus:outline-none focus:border-rose-500 cursor-pointer flex-1 sm:flex-none ${styles.dropdown}`}
          >
            <option value="ALL">All Statuses</option>
            <option value="new">New</option>
            <option value="learning">Learning</option>
            <option value="mastered">Mastered</option>
          </select>

          <label className={`flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border px-3 py-2 ${styles.dropdown}`}>
            <Search size={15} className={styles.textMuted} />
            <input
              type="search"
              value={search}
              onChange={(event) => { setSearch(event.target.value); setCurrentIndex(0); }}
              placeholder="Search flashcards..."
              className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-slate-500"
              aria-label="Search flashcards"
            />
          </label>
        </div>

        <div className={`text-xs font-bold pr-2 ${styles.textMuted}`}>
          Card <span className={styles.textMain}>{filteredItems.length > 0 ? currentIndex + 1 : 0}</span> of <span className={styles.textMain}>{filteredItems.length}</span>
        </div>
      </div>

      {/* Main Flashcards Grid Container */}
      {currentItem ? (
        <div className="flex flex-col items-center gap-6 w-full">
          <div className="grid w-full grid-cols-1 items-center gap-2 sm:gap-4 md:grid-cols-[auto_minmax(0,1fr)_auto]">
            <button
              type="button"
              onClick={() => handleNavigate(-1)}
              aria-label="Previous flashcard"
              title="Previous"
              className={`hidden h-10 w-10 shrink-0 self-center items-center justify-center rounded-xl border sm:h-12 sm:w-12 md:flex ${styles.dropdown}`}
            >
              <ChevronLeft size={20} />
            </button>

            <div className={`mx-auto grid w-full min-w-0 gap-6 transition-all duration-300 ${isKanji || isKotoba ? 'max-w-7xl grid-cols-1 md:grid-cols-12' : 'max-w-3xl grid-cols-1'}`}>
            
            {/* Primary 3D Flashcard Box */}
            <div className={`w-full h-[min(24rem,calc(100dvh-14rem))] min-h-64 sm:h-96 md:h-[400px] perspective-1000 select-none ${isKanji || isKotoba ? 'md:col-span-7' : ''}`}>
              <div
                className={`relative w-full h-full duration-500 transform-style-3d cursor-pointer ${isFlipped ? 'rotate-y-180' : ''}`}
                onClick={() => setIsFlipped(!isFlipped)}
              >
                {/* FRONT SIDE */}
                <div className={`absolute inset-0 w-full h-full border rounded-3xl p-8 flex flex-col justify-between backface-hidden transition-colors ${styles.cardBgFront}`}>
                  <div className="flex justify-between items-center">
                    <span className={`px-3.5 py-1.5 text-xs font-extrabold rounded-xl uppercase tracking-wider ${styles.badgeType}`}>
                      {currentItem.type}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSpeak(currentItem.japanese);
                        }}
                        className={`p-2 rounded-xl transition ${isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-200' : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'}`}
                        title="Dengarkan Audio"
                      >
                        <Volume2 size={20} />
                      </button>
                      <span className="px-3 py-1 bg-rose-500/10 text-rose-500 text-xs font-black rounded-xl border border-rose-500/20">
                        {currentItem.jlptLevel}
                      </span>
                      <span className={`mastery-indicator ${currentItem.isMastered ? 'mastered' : currentItem.masteryStreak ? 'learning' : 'new'}`} title={currentItem.isMastered ? 'Mastered' : currentItem.masteryStreak ? `Learning ${currentItem.masteryStreak}/3` : 'New item'} />
                    </div>
                  </div>

                  <div className="text-center my-auto space-y-3">
                    <h2 className={`text-5xl sm:text-7xl md:text-8xl font-black mb-2 tracking-tight ${styles.textMain}`}>
                      {isKotoba
                        ? <FuriganaText text={currentItem.japanese} reading={currentItem.reading} />
                        : currentItem.japanese}
                    </h2>
                    {isKanji ? (
                      <div className={`mx-auto flex flex-col items-center gap-1 text-sm ${styles.textSub}`}>
                        <p><span className={`mr-2 text-xs font-bold ${styles.textMuted}`}>Kun:</span>{currentItem.kunyomi || '—'}</p>
                        <p><span className={`mr-2 text-xs font-bold ${styles.textMuted}`}>On:</span>{currentItem.onyomi || '—'}</p>
                      </div>
                    ) : null}
                  </div>

                  <div className="text-center">
                    <button
                      type="button"
                      className="quiz-button primary mx-auto mb-3 w-auto"
                      disabled={currentItem.isMastered || isMarkingMastered}
                      onClick={(event) => void handleMarkCurrentAsMastered(event)}
                    >
                      {currentItem.isMastered ? 'Mastered' : isMarkingMastered ? 'Saving...' : 'Mark as Mastered'}
                    </button>
                    {masterySaveError && <p className="mb-2 text-xs text-rose-500" role="alert">{masterySaveError}</p>}
                    <span className={`text-xs font-semibold flex items-center justify-center gap-1.5 ${styles.textMuted}`}>
                      <RotateCw size={13} /> Click or press{' '}
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-mono ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                        Space
                      </span>{' '}
                      to flip
                    </span>
                  </div>
                </div>

                {/* BACK SIDE */}
                <div className={`absolute inset-0 w-full h-full border rounded-3xl p-8 flex flex-col justify-between backface-hidden rotate-y-180 transition-colors ${styles.cardBgBack}`}>
                  <div className="flex justify-between items-center">
                    <span className="px-3.5 py-1.5 bg-rose-500/10 text-rose-500 text-xs font-extrabold rounded-xl uppercase tracking-wider border border-rose-500/20">
                      {currentItem.type} • Arti & Detail
                    </span>
                    <span className="px-3 py-1 bg-rose-500/10 text-rose-500 text-xs font-black rounded-xl border border-rose-500/20">
                      {currentItem.jlptLevel}
                    </span>
                  </div>

                  <div className="my-auto max-h-[250px] w-full space-y-3 overflow-y-auto text-center">
                    <p className={`text-xs font-semibold uppercase tracking-wide ${styles.textMuted}`}>Readings</p>
                    <p className="text-xl font-bold text-rose-500"><FuriganaText text={currentItem.reading} /></p>
                    <h3 className={`mx-auto max-w-full break-words overflow-hidden text-ellipsis line-clamp-3 text-xl sm:text-2xl md:text-3xl font-extrabold ${styles.textMain}`}>{currentItem.meaning}</h3>

                    {currentItem.structure && (
                      <p className="text-xs bg-amber-500/10 text-amber-500 px-3.5 py-1.5 rounded-xl inline-block font-mono border border-amber-500/20">
                        {currentItem.structure}
                      </p>
                    )}

                    {isKanji && featuredKotoba && (
                      <div className={`rounded-2xl border p-3.5 text-sm ${isDark ? 'bg-[#0d1117] border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                        <p className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                          {featuredKotoba.word} ({featuredKotoba.reading || '—'} - {featuredKotoba.meaning})
                        </p>
                      </div>
                    )}

                    {currentItem.exampleJp && (
                      <div className={`text-xs p-3.5 rounded-2xl border mt-2 ${isDark ? 'bg-[#0d1117] border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                          <p className={`italic ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>&quot;<FuriganaText text={currentItem.exampleJp} word={isKotoba ? currentItem.japanese : undefined} reading={isKotoba ? currentItem.reading : undefined} />&quot;</p>
                        {currentItem.exampleMeaning && <p className={`not-italic mt-0.5 ${styles.textMuted}`}>{currentItem.exampleMeaning}</p>}
                      </div>
                    )}

                  </div>

                  <div className="text-center">
                    <span className={`text-xs font-semibold flex items-center justify-center gap-1.5 ${styles.textMuted}`}>
                      <RotateCw size={13} /> Click or press{' '}
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-mono ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                        Space
                      </span>{' '}
                      to flip back
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Side Panel for Kanji Stroke Order */}
            {isKanji && (
              <div className={`md:col-span-5 h-96 md:h-[400px] border rounded-3xl p-6 flex flex-col justify-between items-center text-center transition-all duration-300 ${styles.sidePanelBg}`}>
                <div className="flex justify-between items-center w-full">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-rose-500 flex items-center gap-1.5">
                    <PenTool size={14} /> Stroke Order
                  </span>
                  <span className={`text-[11px] font-semibold ${styles.textMuted}`}>
                    KanjiVG Guide
                  </span>
                </div>

                <div className="my-auto flex flex-col items-center gap-3 w-full">
                  <div className={`relative w-48 h-48 md:w-52 md:h-52 border-2 border-dashed rounded-2xl flex items-center justify-center overflow-hidden shadow-inner p-2 ${styles.gridBg}`}>
                    <div className={`absolute inset-x-0 border-b border-dashed top-1/2 ${styles.gridLines}`} />
                    <div className={`absolute inset-y-0 border-r border-dashed left-1/2 ${styles.gridLines}`} />
                    
                    {loadingStroke ? (
                      <RefreshCw className="animate-spin text-rose-500" size={28} />
                    ) : strokeSvg ? (
                      <div 
                        className="relative z-10 w-full h-full flex items-center justify-center pointer-events-none"
                        dangerouslySetInnerHTML={{ __html: strokeSvg }}
                      />
                    ) : (
                      <span className="text-8xl font-black text-rose-500 tracking-widest relative z-10">
                        {currentItem.japanese}
                      </span>
                    )}
                  </div>
                  <p className={`text-xs font-semibold ${styles.textMuted}`}>
                    Urutan & Arah Goresan
                  </p>
                </div>

                <div className={`text-[11px] ${styles.textMuted}`}>
                  Petunjuk visual penulisan Kanji
                </div>
              </div>
            )}

            {isKotoba && (
              <aside className={`md:col-span-5 h-96 md:h-[400px] border rounded-3xl p-6 flex flex-col justify-between ${styles.sidePanelBg}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-extrabold uppercase tracking-wider text-rose-500">Example Sentences</span>
                    <p className={`mt-1 text-xs ${styles.textMuted}`}>Kotoba listening practice</p>
                  </div>
                  <button type="button" onClick={() => handleSpeak(`${currentItem.japanese}。${currentItem.reading}。${currentItem.exampleJp ?? ''}`)} className={`rounded-lg border p-2 ${styles.dropdown}`} aria-label="Play Kotoba audio" title="Play audio">
                    <Volume2 size={18} />
                  </button>
                </div>
                {currentItem.exampleJp ? (
                  <div className={`rounded-xl border p-4 ${styles.gridBg}`}>
                      <p className={`italic ${isDark ? 'text-slate-200' : 'text-slate-800'}`}><FuriganaText text={currentItem.exampleJp} word={currentItem.japanese} reading={currentItem.reading} /></p>
                    {currentItem.exampleMeaning && <p className={`mt-2 text-sm ${styles.textMuted}`}>{currentItem.exampleMeaning}</p>}
                  </div>
                ) : <p className={`text-sm ${styles.textMuted}`}>No example sentence available.</p>}
                <button type="button" onClick={() => handleSpeak(currentItem.exampleJp || currentItem.japanese)} className="quiz-button primary">
                  <Volume2 size={16} /> Play Example
                </button>
              </aside>
            )}

          </div>
          <button
            type="button"
            onClick={() => handleNavigate(1)}
            aria-label="Next flashcard"
            title="Next"
            className={`hidden h-10 w-10 shrink-0 self-center items-center justify-center rounded-xl border sm:h-12 sm:w-12 md:flex ${styles.dropdown}`}
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {isKanji && (
          <section className={`w-full max-w-7xl rounded-2xl border p-4 sm:p-5 ${styles.sidePanelBg}`}>
            <div className="border-b border-slate-800 px-5 py-4">
              <h3 className={`text-sm font-bold ${styles.textMain}`}>Related Vocabulary</h3>
            </div>
            <div className="grid grid-cols-1 gap-3 pt-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {loadingRelatedKotoba ? (
                <p className={`col-span-full py-5 text-center text-sm ${styles.textMuted}`}>Loading related vocabulary...</p>
              ) : relatedKotoba.length ? relatedKotoba.slice(0, 5).map((word) => (
                <button
                  key={word.id}
                  type="button"
                  onClick={() => handleSpeak(`${word.word}、${word.reading ?? ''}`)}
                  className={`min-h-32 rounded-xl border p-4 text-left transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-500 ${isDark ? 'border-slate-800 bg-[#0d1117] hover:border-rose-500/50' : 'border-slate-200 bg-slate-50 hover:border-rose-300'}`}
                  aria-label={`Listen to ${word.word}, ${word.reading ?? ''}`}
                >
                  <span className={`block text-lg font-bold ${styles.textMain}`}>{word.word}</span>
                  <span className="mt-1 block text-sm font-medium text-rose-500">{word.reading || '—'}</span>
                  <span className={`mt-2 block text-sm leading-relaxed ${styles.textMuted}`}>{word.meaning}</span>
                </button>
              )) : (
                <p className={`col-span-full py-5 text-center text-sm ${styles.textMuted}`}>No related vocabulary found.</p>
              )}
            </div>
          </section>
        )}

        {!isOverlayOpen && (
          <div
            className={`mobile-flashcard-controls fixed bottom-4 left-4 right-4 z-30 flex gap-3 rounded-2xl border p-3 shadow-lg backdrop-blur-md md:hidden ${isDark ? 'border-slate-800/80 bg-slate-900/90 text-slate-100' : 'border-slate-200/80 bg-white/90 text-slate-900'}`}
            style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
          >
          <button
            type="button"
            onClick={() => handleNavigate(-1)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-500 py-3 font-medium text-white"
          >
            <ChevronLeft size={18} /> Previous
          </button>
          <button
            type="button"
            onClick={() => handleNavigate(1)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-500 py-3 font-medium text-white"
          >
            Next <ChevronRight size={18} />
          </button>
          </div>
        )}

        </div>
      ) : (
        <div className={`text-center p-16 border rounded-3xl ${styles.filterBar} ${styles.textMuted}`}>
          <p className="text-sm font-semibold">Tidak ada kartu yang cocok dengan opsi filter di atas.</p>
        </div>
      )}
    </div>
  );
};