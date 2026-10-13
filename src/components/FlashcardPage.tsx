import React, { useState, useEffect } from 'react';
import type { StudyItem } from '../types';
import { RotateCw, Volume2, Check, X, Minus, PenTool, RefreshCw } from 'lucide-react';

interface Props {
  items: StudyItem[];
  onToggleMastery: (id: string, isMastered: boolean) => void;
  isDark: boolean;
}

export const FlashcardsPage: React.FC<Props> = ({ items, onToggleMastery, isDark }) => {
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [strokeSvg, setStrokeSvg] = useState<string | null>(null);
  const [loadingStroke, setLoadingStroke] = useState(false);

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
    btnHard: isDark 
      ? 'bg-rose-950/30 hover:bg-rose-900/40 text-rose-400 border-rose-900/50' 
      : 'bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-200 shadow-sm',
    btnGood: isDark 
      ? 'bg-amber-950/30 hover:bg-amber-900/40 text-amber-400 border-amber-900/50' 
      : 'bg-amber-50 hover:bg-amber-100 text-amber-600 border-amber-200 shadow-sm',
    btnEasy: isDark 
      ? 'bg-emerald-950/30 hover:bg-emerald-900/40 text-emerald-400 border-emerald-900/50' 
      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border-emerald-200 shadow-sm',
  };

  const filteredItems = items.filter((item) => {
    const matchType = selectedType === 'ALL' || item.type === selectedType;
    const matchLevel = selectedLevel === 'ALL' || item.jlptLevel === selectedLevel;
    const matchStatus =
      selectedStatus === 'ALL'
        ? true
        : selectedStatus === 'MASTERED'
        ? item.isMastered
        : !item.isMastered;
    return matchType && matchLevel && matchStatus;
  });

  const currentItem = filteredItems[currentIndex];
  const isKanji = currentItem?.type === 'kanji';

  useEffect(() => {
    if (!currentItem || currentItem.type !== 'kanji') {
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
      if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'SELECT') {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    setIsFlipped(false);
    setStrokeSvg(null);
  }, [currentIndex, selectedType, selectedLevel, selectedStatus]);

  const handleNextCard = () => {
    setIsFlipped(false);
    if (filteredItems.length > 0) {
      setCurrentIndex((prev) => (prev + 1) % filteredItems.length);
    }
  };

  const handleRating = (rating: 'hard' | 'good' | 'easy') => {
    if (!currentItem) return;

    if (rating === 'easy') {
      onToggleMastery(currentItem.id, true);
    } else if (rating === 'hard') {
      onToggleMastery(currentItem.id, false);
    }

    handleNextCard();
  };

  const handleSpeak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ja-JP';
      utterance.rate = 0.85;
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Filter Bar */}
      <div className={`border rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 transition-colors duration-300 ${styles.filterBar}`}>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <select
            value={selectedType}
            onChange={(e) => { setSelectedType(e.target.value); setCurrentIndex(0); }}
            className={`border text-xs font-semibold px-4 py-2.5 rounded-xl focus:outline-none focus:border-rose-500 cursor-pointer flex-1 sm:flex-none ${styles.dropdown}`}
          >
            <option value="ALL">All Types (Kanji, Kotoba, Bunpou)</option>
            <option value="kanji">Kanji</option>
            <option value="kotoba">Kotoba</option>
            <option value="bunpou">Bunpou</option>
          </select>

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
            onChange={(e) => { setSelectedStatus(e.target.value); setCurrentIndex(0); }}
            className={`border text-xs font-semibold px-4 py-2.5 rounded-xl focus:outline-none focus:border-rose-500 cursor-pointer flex-1 sm:flex-none ${styles.dropdown}`}
          >
            <option value="ALL">All Statuses</option>
            <option value="LEARNING">Belum Hafal</option>
            <option value="MASTERED">Sudah Hafal</option>
          </select>
        </div>

        <div className={`text-xs font-bold pr-2 ${styles.textMuted}`}>
          Card <span className={styles.textMain}>{filteredItems.length > 0 ? currentIndex + 1 : 0}</span> of <span className={styles.textMain}>{filteredItems.length}</span>
        </div>
      </div>

      {/* Main Flashcards Grid Container */}
      {currentItem ? (
        <div className="flex flex-col items-center gap-6 w-full">
          
          <div className={`w-full grid gap-6 transition-all duration-300 ${isKanji ? 'grid-cols-1 md:grid-cols-12' : 'grid-cols-1 max-w-2xl'}`}>
            
            {/* Primary 3D Flashcard Box */}
            <div className={`w-full h-96 md:h-[400px] perspective-1000 select-none ${isKanji ? 'md:col-span-7' : ''}`}>
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
                    </div>
                  </div>

                  <div className="text-center my-auto space-y-3">
                    <h2 className={`text-7xl md:text-8xl font-black mb-2 tracking-tight ${styles.textMain}`}>
                      {currentItem.japanese}
                    </h2>
                    <p className={`text-lg font-bold ${styles.textSub}`}>
                      {currentItem.reading}
                    </p>
                  </div>

                  <div className="text-center">
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

                  <div className="text-center my-auto space-y-3">
                    <p className="text-xl font-bold text-rose-500">{currentItem.reading}</p>
                    <h3 className={`text-4xl font-extrabold ${styles.textMain}`}>{currentItem.meaning}</h3>

                    {currentItem.structure && (
                      <p className="text-xs bg-amber-500/10 text-amber-500 px-3.5 py-1.5 rounded-xl inline-block font-mono border border-amber-500/20">
                        {currentItem.structure}
                      </p>
                    )}

                    {currentItem.exampleJp && (
                      <div className={`text-xs p-3.5 rounded-2xl border mt-2 ${isDark ? 'bg-[#0d1117] border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                        <p className={`italic ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>"{currentItem.exampleJp}"</p>
                        <p className={`not-italic mt-0.5 ${styles.textMuted}`}>{currentItem.exampleId}</p>
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

          </div>

          {/* SRS Rating Action Buttons */}
          <div className="grid grid-cols-3 gap-4 w-full max-w-2xl">
            <button
              onClick={() => handleRating('hard')}
              className={`flex items-center justify-center gap-2 py-4 px-4 border rounded-2xl font-extrabold text-xs md:text-sm transition active:scale-95 ${styles.btnHard}`}
            >
              <X size={17} /> Hard (Repeat)
            </button>

            <button
              onClick={() => handleRating('good')}
              className={`flex items-center justify-center gap-2 py-4 px-4 border rounded-2xl font-extrabold text-xs md:text-sm transition active:scale-95 ${styles.btnGood}`}
            >
              <Minus size={17} /> Good
            </button>

            <button
              onClick={() => handleRating('easy')}
              className={`flex items-center justify-center gap-2 py-4 px-4 border rounded-2xl font-extrabold text-xs md:text-sm transition active:scale-95 ${styles.btnEasy}`}
            >
              <Check size={17} /> Easy (Mastered)
            </button>
          </div>

        </div>
      ) : (
        <div className={`text-center p-16 border rounded-3xl ${styles.filterBar} ${styles.textMuted}`}>
          <p className="text-sm font-semibold">Tidak ada kartu yang cocok dengan opsi filter di atas.</p>
        </div>
      )}
    </div>
  );
};