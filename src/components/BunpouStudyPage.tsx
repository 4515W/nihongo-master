import { useState } from 'react';
import { BookOpenText, Volume2, X } from 'lucide-react';
import type { StudyItem } from '../types';
import { FuriganaText } from './FuriganaText';
import { speakJapanese } from '../lib/audio';
import { useBackDismiss } from '../lib/useBackDismiss';

interface BunpouStudyPageProps {
  items: StudyItem[];
  onTestThisPoint: (item: StudyItem) => void;
}

const levels = ['N5', 'N4', 'N3', 'N2', 'N1'] as const;
const connectionTypes = [
  { key: 'verbs', label: 'Verbs' },
  { key: 'nouns', label: 'Nouns' },
  { key: 'adjectives', label: 'Adjectives' },
] as const;

export function BunpouStudyPage({ items, onTestThisPoint }: BunpouStudyPageProps) {
  const [selectedItem, setSelectedItem] = useState<StudyItem | null>(null);
  useBackDismiss(selectedItem !== null, () => setSelectedItem(null));
  const grammarItems = items.filter((item) => item.type === 'bunpou');
  const masteredCount = grammarItems.filter((item) => item.isMastered).length;

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

      {levels.map((level) => {
        const levelItems = grammarItems.filter((item) => item.jlptLevel === level);
        const levelMastered = levelItems.filter((item) => item.isMastered).length;
        return (
          <section key={level} className="space-y-3">
            <header className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-[var(--heading)]">{level}</h2>
              <div className="h-px flex-1 bg-[var(--line)]" />
              <span className="text-xs text-[var(--text-muted)]">{levelMastered}/{levelItems.length} mastered</span>
            </header>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {levelItems.length ? levelItems.map((item) => (
                <button key={item.id} type="button" onClick={() => setSelectedItem(item)} className="group flex min-h-32 flex-col items-start justify-between rounded-xl border border-[var(--line)] bg-[var(--panel-bg)] p-4 text-left transition hover:border-rose-400/60 hover:shadow-lg">
                  <span className="flex w-full items-center justify-between gap-3">
                    <span className="text-base font-bold text-[var(--heading)]">{item.japanese}</span>
                    <MasteryBadge isMastered={item.isMastered} />
                  </span>
                  <span className="line-clamp-2 text-sm text-[var(--text-soft)]">{item.meaning}</span>
                  <span className="text-xs font-semibold text-[var(--text-muted)]">{item.structure}</span>
                </button>
              )) : (
                <p className="py-3 text-sm text-[var(--text-muted)]">No grammar points at this level yet.</p>
              )}
            </div>
          </section>
        );
      })}

      {selectedItem && (
        <div className="detail-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedItem(null); }}>
          <article className="detail-modal max-h-[90vh] overflow-y-auto">
            <header className="detail-header">
              <span className="type-badge bunpou">{selectedItem.jlptLevel}</span>
              <button type="button" className="detail-close" aria-label="Close grammar details" onClick={() => setSelectedItem(null)}><X size={18} /></button>
            </header>
            <div className="detail-body">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-[var(--heading)]">{selectedItem.japanese}</h2>
                  <p className="bunpou-detail-subtext mt-1 text-sm">{selectedItem.structure}</p>
                </div>
                <button type="button" className="theme-switcher-button" aria-label="Play grammar pronunciation" title="Play pronunciation" onClick={() => speakJapanese(`${selectedItem.japanese}。${selectedItem.structure ?? ''}`)}><Volume2 size={18} /></button>
              </div>

              <div className="detail-box bunpou-detail-box">
                <label className="bunpou-detail-label">Meaning</label>
                <p className="bunpou-detail-main">{selectedItem.meaning}</p>
              </div>

              <div className="detail-box bunpou-detail-box">
                <label className="bunpou-detail-label">Conjugation Structure</label>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bunpou-table-heading"><tr><th className="py-2 pr-4">Form</th><th className="py-2">Connection</th></tr></thead>
                    <tbody>
                      {connectionTypes.map(({ key, label }) => (
                        <tr key={key} className="bunpou-table-row border-t">
                          <th className="bunpou-table-content py-2 pr-4 font-semibold">{label}</th>
                          <td className="bunpou-table-content py-2">{selectedItem.conjugationRules?.[key] || 'Not specified'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="detail-box bunpou-detail-box">
                <label className="bunpou-detail-label">Nuance & Usage</label>
                <p className="bunpou-detail-main">{selectedItem.nuance || selectedItem.meaning}</p>
              </div>

              <div className="detail-box bunpou-detail-box">
                <label className="bunpou-detail-label">Example Sentence</label>
                <div className="flex items-start justify-between gap-3">
                  <p className="bunpou-detail-main"><FuriganaText text={selectedItem.exampleJp || selectedItem.japanese} /></p>
                  <button type="button" className="theme-switcher-button" aria-label="Play example sentence" title="Play example sentence" onClick={() => speakJapanese(selectedItem.exampleJp || selectedItem.japanese)}><Volume2 size={16} /></button>
                </div>
                {selectedItem.exampleMeaning && <small className="bunpou-detail-subtext">{selectedItem.exampleMeaning}</small>}
              </div>

              <button type="button" className="quiz-start-button w-full" onClick={() => onTestThisPoint(selectedItem)}>
                <BookOpenText size={17} /> Test This Point
              </button>
            </div>
          </article>
        </div>
      )}
    </section>
  );
}

function MasteryBadge({ isMastered }: { isMastered: boolean }) {
  return <span className={`status-pill ${isMastered ? 'mastered' : 'learning'}`}>{isMastered ? 'Mastered' : 'Learning'}</span>;
}