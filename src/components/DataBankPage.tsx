import { useMemo, useState, type FC } from 'react';
import type { StudyItem } from '../types';
import { FuriganaText } from './FuriganaText';
import { useBackDismiss } from '../lib/useBackDismiss';

interface DataBankPageProps {
  items: StudyItem[];
  isDark: boolean;
}

export const DataBankPage: FC<DataBankPageProps> = ({ items, isDark }) => {
  const [selectedType, setSelectedType] = useState<'ALL' | StudyItem['type']>('ALL');
  const [selectedLevel, setSelectedLevel] = useState<'ALL' | StudyItem['jlptLevel']>('ALL');
  const [selectedItem, setSelectedItem] = useState<StudyItem | null>(null);
  useBackDismiss(selectedItem !== null, () => setSelectedItem(null));
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);

  const grouped = {
    kanji: items.filter((item) => item.type === 'kanji'),
    kotoba: items.filter((item) => item.type === 'kotoba'),
    bunpou: items.filter((item) => item.type === 'bunpou'),
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesType = selectedType === 'ALL' || item.type === selectedType;
      const matchesLevel = selectedLevel === 'ALL' || item.jlptLevel === selectedLevel;
      return matchesType && matchesLevel;
    });
  }, [items, selectedType, selectedLevel]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / rowsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const firstIndex = (safePage - 1) * rowsPerPage;
  const paginatedItems = filteredItems.slice(firstIndex, firstIndex + rowsPerPage);

  const totalMastered = items.filter((item) => item.isMastered).length;
  const totalLevel = items.length;

  const getUsageText = (item: StudyItem) => {
    if (item.type === 'kanji') {
      return 'Use this kanji in compounds or everyday words. Study the stroke order and add it to a sentence so the meaning sticks naturally.';
    }

    if (item.type === 'kotoba') {
      return 'Use this vocabulary in real conversations and example sentences. Repeat it aloud and connect it to a specific context or activity.';
    }

    return 'Use this grammar pattern in sentence form. Focus on the structure and then try making your own sentence using the same pattern.';
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h2>Data Bank</h2>
          <p>Semua item study yang sudah kamu kumpulkan dalam satu tempat.</p>
        </div>
        <span className="page-header-badge">{totalMastered}/{totalLevel} learned</span>
      </div>

      <div className="summary-grid">
        <div className="stat-card">
          <div>
            <p className="stat-label">Kanji</p>
            <h3>{grouped.kanji.length}</h3>
            <p className="meta-positive">{grouped.kanji.filter((item) => item.isMastered).length} mastered</p>
          </div>
          <div className="stat-icon rose">漢</div>
        </div>

        <div className="stat-card">
          <div>
            <p className="stat-label">Kotoba</p>
            <h3>{grouped.kotoba.length}</h3>
            <p className="meta-positive">{grouped.kotoba.filter((item) => item.isMastered).length} mastered</p>
          </div>
          <div className="stat-icon blue">語</div>
        </div>

        <div className="stat-card">
          <div>
            <p className="stat-label">Bunpou</p>
            <h3>{grouped.bunpou.length}</h3>
            <p className="meta-positive">{grouped.bunpou.filter((item) => item.isMastered).length} mastered</p>
          </div>
          <div className="stat-icon purple">文</div>
        </div>

        <div className="stat-card">
          <div>
            <p className="stat-label">Progress</p>
            <h3>{items.length > 0 ? Math.round((totalMastered / totalLevel) * 100) : 0}%</h3>
            <p className="stat-subtle">Learning momentum</p>
          </div>
          <div className="stat-icon amber">✓</div>
        </div>
      </div>

      <div className="panel">
        <div className="filter-panel">
          <select
            className="filter-select"
            value={selectedType}
            onChange={(event) => { setSelectedType(event.target.value as 'ALL' | StudyItem['type']); setCurrentPage(1); }}
          >
            <option value="ALL">All Types</option>
            <option value="kanji">Kanji</option>
            <option value="kotoba">Kotoba</option>
            <option value="bunpou">Bunpou</option>
          </select>

          <select
            className="filter-select"
            value={selectedLevel}
            onChange={(event) => { setSelectedLevel(event.target.value as 'ALL' | StudyItem['jlptLevel']); setCurrentPage(1); }}
          >
            <option value="ALL">All JLPT</option>
            <option value="N5">N5</option>
            <option value="N4">N4</option>
            <option value="N3">N3</option>
            <option value="N2">N2</option>
            <option value="N1">N1</option>
          </select>

          <label className="ml-auto flex items-center gap-2 text-sm text-[var(--text-muted)]">
            Rows per page
            <select className="filter-select" value={rowsPerPage} onChange={(event) => { setRowsPerPage(Number(event.target.value)); setCurrentPage(1); }}>
              {[10, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
        </div>

        <div className="library-grid">
          {paginatedItems.map((item) => (
            <article key={item.id} className="library-item" onClick={() => setSelectedItem(item)}>
              <div className="library-top">
                <span className={`type-badge ${item.type}`}>{item.type}</span>
                <span className={`status-pill ${item.isMastered ? 'mastered' : 'learning'}`}>
                  {item.isMastered ? 'Mastered' : 'Learning'}
                </span>
              </div>

              <h3><FuriganaText text={item.japanese} reading={item.type === 'kotoba' ? item.reading : undefined} /></h3>
              <p>{item.meaning}</p>

              <div className="meta-row">
                <span><FuriganaText text={item.reading} /></span>
                <span>{item.jlptLevel}</span>
              </div>

              {item.exampleJp && (
                <div className="example-note">“<FuriganaText text={item.exampleJp} word={item.type === 'kotoba' ? item.japanese : undefined} reading={item.type === 'kotoba' ? item.reading : undefined} />”</div>
              )}
            </article>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--text-muted)]">
          <p>Showing {filteredItems.length ? firstIndex + 1 : 0} to {Math.min(firstIndex + rowsPerPage, filteredItems.length)} of {filteredItems.length} items</p>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="filter-select min-w-0" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={safePage === 1}>Previous</button>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
              <button key={page} type="button" className={`min-h-10 min-w-10 rounded-lg border px-3 font-bold ${safePage === page ? 'border-rose-500 bg-rose-500/10 text-rose-500' : isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-600 hover:bg-slate-100'}`} onClick={() => setCurrentPage(page)} aria-current={safePage === page ? 'page' : undefined}>
                {page}
              </button>
            ))}
            <button type="button" className="filter-select min-w-0" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={safePage === totalPages}>Next</button>
          </div>
        </div>
      </div>

      {selectedItem && (
        <div className="detail-overlay" onClick={() => setSelectedItem(null)}>
          <div className="detail-modal" onClick={(event) => event.stopPropagation()}>
            <div className="detail-header">
              <span className={`type-badge ${selectedItem.type}`}>{selectedItem.type}</span>
              <button type="button" className="detail-close" onClick={() => setSelectedItem(null)}>
                ✕
              </button>
            </div>

            <div className="detail-body">
              <h3><FuriganaText text={selectedItem.japanese} reading={selectedItem.type === 'kotoba' ? selectedItem.reading : undefined} /></h3>
              <p className="detail-reading"><FuriganaText text={selectedItem.reading} /></p>
              <p className="detail-meaning">{selectedItem.meaning}</p>

              <div className="detail-meta">
                <span>{selectedItem.jlptLevel}</span>
                <span>{selectedItem.isMastered ? 'Mastered' : 'In progress'}</span>
              </div>

              {selectedItem.structure && (
                <div className="detail-box">
                  <label>Pattern / Structure</label>
                  <p>{selectedItem.structure}</p>
                </div>
              )}

              {selectedItem.exampleJp && (
                <div className="detail-box">
                  <label>Example</label>
                  <p><FuriganaText text={selectedItem.exampleJp} word={selectedItem.type === 'kotoba' ? selectedItem.japanese : undefined} reading={selectedItem.type === 'kotoba' ? selectedItem.reading : undefined} /></p>
                  {selectedItem.exampleMeaning && <small>{selectedItem.exampleMeaning}</small>}
                </div>
              )}

              <div className="detail-box usage-box">
                <label>How to use it</label>
                <p>{getUsageText(selectedItem)}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
