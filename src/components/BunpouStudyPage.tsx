import { useState } from 'react';
import { BookOpenText, ChevronDown, Volume2, X } from 'lucide-react';
import type { StudyItem } from '../types';
import { FuriganaText } from './FuriganaText';
import { speakJapanese } from '../lib/audio';
import { useBackDismiss } from '../lib/useBackDismiss';
import { normalizeStudyItemType } from '../lib/studyItems';

interface BunpouStudyPageProps {
  items: StudyItem[];
  onTestThisPoint: (item: StudyItem) => void;
}

const levels = ['N5', 'N4', 'N3', 'N2', 'N1'] as const;

function renderConjugationRules(rules: unknown, structure?: string) {
  const fallback = structure?.trim() || 'Tidak ada aturan konjugasi khusus.';
  if (rules == null) return fallback;

  if (typeof rules === 'string') {
    const text = rules.trim();
    if (!text) return fallback;

    try {
      const parsed: unknown = JSON.parse(text);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        const ruleObject = parsed as Record<string, unknown>;
        const description = ruleObject.rule ?? ruleObject.description ?? ruleObject.conju;
        if (description != null && String(description).trim()) return String(description);
        return JSON.stringify(parsed);
      }
      return text;
    } catch {
      return text;
    }
  }

  if (typeof rules === 'object' && !Array.isArray(rules)) {
    const ruleObject = rules as Record<string, unknown>;
    const description = ruleObject.rule ?? ruleObject.description ?? ruleObject.conju;
    if (description != null && String(description).trim()) return String(description);
    return JSON.stringify(rules);
  }

  return String(rules);
}

export function BunpouStudyPage({ items, onTestThisPoint }: BunpouStudyPageProps) {
  const [selectedItem, setSelectedItem] = useState<StudyItem | null>(null);
  const [filterLevel, setFilterLevel] = useState<'ALL' | (typeof levels)[number]>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'LEARNING' | 'MASTERED'>('ALL');
  const [expandedLevels, setExpandedLevels] = useState<Set<(typeof levels)[number]>>(() => new Set(['N5']));
  useBackDismiss(selectedItem !== null, () => setSelectedItem(null));
  const grammarItems = items.filter((item) => normalizeStudyItemType(item.type) === 'bunpou');
  const masteredCount = grammarItems.filter((item) => item.isMastered).length;
  const toggleLevel = (level: (typeof levels)[number]) => {
    setExpandedLevels((current) => {
      const next = new Set(current);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  };

  return (
    <section className="mx-auto w-full max-w-7xl space-y-7 px-4 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-rose-500">文法</p>
          <h1 className="mt-1 text-3xl font-bold text-[var(--heading)]">Bunpou</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">Grammar points organized by JLPT level.</p>
        </div>
        <div className="min-w-48 text-sm text-[var(--text-muted)]">
          <div className="mb-2 flex justify-between gap-4">
            <span>Overall progress</span>
            <span>{masteredCount} / {grammarItems.length}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--panel-alt)]">
            <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-500" style={{ width: `${grammarItems.length ? (masteredCount / grammarItems.length) * 100 : 0}%` }} />
          </div>
        </div>
      </header>

      <div className="bunpou-filter-bar" aria-label="Filter grammar points">
        <label>
          <span>JLPT Level</span>
          <select
            value={filterLevel}
            onChange={(event) => {
              const value = event.target.value as typeof filterLevel;
              setFilterLevel(value);
              if (value !== 'ALL') setExpandedLevels(new Set([value]));
            }}
          >
            <option value="ALL">All Levels</option>
            {levels.map((level) => <option key={level} value={level}>{level}</option>)}
          </select>
        </label>
        <label>
          <span>Progress</span>
          <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value as typeof filterStatus)}>
            <option value="ALL">All Progress</option>
            <option value="LEARNING">Learning</option>
            <option value="MASTERED">Mastered</option>
          </select>
        </label>
      </div>

      {levels.filter((level) => filterLevel === 'ALL' || filterLevel === level).map((level) => {
        const allLevelItems = grammarItems.filter((item) => item.jlptLevel === level);
        const levelItems = allLevelItems.filter((item) => filterStatus === 'ALL'
          || (filterStatus === 'MASTERED' ? item.isMastered : !item.isMastered));
        const levelMastered = allLevelItems.filter((item) => item.isMastered).length;
        const isExpanded = expandedLevels.has(level);
        const panelId = `bunpou-level-${level.toLowerCase()}`;
        return (
          <section key={level} className="bunpou-level-section">
            <button
              type="button"
              className="bunpou-level-header"
              aria-expanded={isExpanded}
              aria-controls={panelId}
              onClick={() => toggleLevel(level)}
            >
              <ChevronDown size={18} className={`bunpou-level-chevron${isExpanded ? ' is-expanded' : ''}`} aria-hidden="true" />
              <span className="bunpou-level-title">{level}</span>
              <span className="bunpou-level-summary">{levelMastered}/{allLevelItems.length} mastered</span>
            </button>
            {isExpanded && (
              <div className="grid gap-3 pt-3 sm:grid-cols-2 xl:grid-cols-3" id={panelId}>
                {levelItems.length ? levelItems.map((item) => (
                  <button key={item.id} type="button" onClick={() => setSelectedItem(item)} className="group flex min-h-32 flex-col items-start justify-between rounded-xl border border-[var(--line)] bg-[var(--panel-bg)] p-4 text-left transition hover:border-rose-400/60 hover:shadow-lg">
                    <span className="flex w-full items-center justify-between gap-3">
                      <span className="text-base font-bold text-[var(--heading)]">{item.title || item.japanese}</span>
                      <MasteryBadge isMastered={item.isMastered} />
                    </span>
                    <span className="line-clamp-2 text-sm text-[var(--text-soft)]">{item.meaning}</span>
                    <span className="text-xs font-semibold text-[var(--text-muted)]">{item.structure}</span>
                  </button>
                )) : (
                  <p className="col-span-full py-3 text-sm text-[var(--text-muted)]">No grammar points match these filters.</p>
                )}
              </div>
            )}
          </section>
        );
      })}

      {selectedItem && (
        <div className="detail-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedItem(null); }}>
          <article className="detail-modal max-h-[90vh] overflow-y-auto">
            <header className="detail-header">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="type-badge bunpou">{selectedItem.jlptLevel}</span>
                {selectedItem.nuance?.trim() && (
                  <span className="type-badge bunpou max-w-56 truncate" title={selectedItem.nuance.trim()}>
                    {selectedItem.nuance.trim()}
                  </span>
                )}
              </div>
              <button type="button" className="detail-close flex items-center justify-center p-0 rounded-full w-8 h-8 focus:outline-none" aria-label="Close grammar details" onClick={() => setSelectedItem(null)}><X size={18} /></button>
            </header>
            <div className="detail-body">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-[var(--heading)]">{selectedItem.title || selectedItem.japanese}</h2>
                  <p className="bunpou-detail-subtext mt-1 text-sm">{selectedItem.structure}</p>
                </div>
                <button type="button" className="theme-switcher-button" aria-label="Play grammar pronunciation" title="Play pronunciation" onClick={() => speakJapanese(`${selectedItem.title || selectedItem.japanese}。${selectedItem.structure ?? ''}`)}><Volume2 size={18} /></button>
              </div>

              <div className="bunpou-overview-grid">
                <div className="detail-box bunpou-detail-box">
                  <label className="bunpou-detail-label">Meaning</label>
                  <p className="bunpou-meaning-text">{selectedItem.meaning}</p>
                </div>

                <div className="detail-box bunpou-detail-box">
                  <label className="bunpou-detail-label">Structure</label>
                  <p className="bunpou-structure-text">
                    {renderConjugationRules(selectedItem.conjugationRules, selectedItem.structure)}
                  </p>
                </div>
              </div>

              <div className="detail-box bunpou-detail-box bunpou-nuance-box">
                <label className="bunpou-detail-label">Nuance & Usage</label>
                <p className="bunpou-detail-main">
                  {selectedItem.nuanceUsage?.trim() || selectedItem.meaning?.trim() || 'Belum ada penjelasan penggunaan untuk tata bahasa ini.'}
                </p>
              </div>

              <div className="detail-box bunpou-detail-box">
                <label className="bunpou-detail-label">Example Sentence</label>
                <div className="flex items-start justify-between gap-3">
                  <p className="bunpou-example-sentence">{selectedItem.exampleJp?.trim() ? <FuriganaText text={selectedItem.exampleJp.trim()} /> : 'No example sentence available.'}</p>
                  {selectedItem.exampleJp?.trim() && <button type="button" className="theme-switcher-button" aria-label="Play example sentence" title="Play example sentence" onClick={() => speakJapanese(selectedItem.exampleJp?.trim() ?? '')}><Volume2 size={16} /></button>}
                </div>
                {selectedItem.exampleMeaning && <small className="bunpou-example-meaning">{selectedItem.exampleMeaning}</small>}
              </div>

            </div>
            <footer className="bunpou-modal-footer">
              <button type="button" className="quiz-start-button w-full" onClick={() => onTestThisPoint(selectedItem)}>
                <BookOpenText size={17} /> Test This Point
              </button>
            </footer>
          </article>
        </div>
      )}
    </section>
  );
}

function MasteryBadge({ isMastered }: { isMastered: boolean }) {
  return <span className={`status-pill ${isMastered ? 'mastered' : 'learning'}`}>{isMastered ? 'Mastered' : 'Learning'}</span>;
}