import { useRef, useState, type ChangeEvent } from 'react';
import type { StudyItem } from '../types';

interface ImportExportPageProps {
  items: StudyItem[];
  onImportData: (items: StudyItem[]) => void;
  isDark: boolean;
}

export const ImportExportPage: React.FC<ImportExportPageProps> = ({ items, onImportData, isDark: _isDark }) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [statusMessage, setStatusMessage] = useState('Ready');

  const handleExport = () => {
    const payload = JSON.stringify(items, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'nihongo-master-data.json';
    link.click();
    URL.revokeObjectURL(url);
    setStatusMessage('Data exported successfully');
  };

  const handleImportChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '[]')) as StudyItem[];
        if (!Array.isArray(parsed) || parsed.length === 0) {
          throw new Error('No valid items found');
        }

        const normalized = parsed.map((item, index) => ({
          id: String(item.id ?? `${Date.now()}-${index}`),
          type: item.type === 'kanji' || item.type === 'kotoba' || item.type === 'bunpou' ? item.type : 'kanji',
          japanese: item.japanese ?? 'New Item',
          reading: item.reading ?? '',
          meaning: item.meaning ?? '',
          jlptLevel: item.jlptLevel ?? 'N5',
          structure: item.structure,
          exampleJp: item.exampleJp,
          exampleId: item.exampleId,
          isMastered: Boolean(item.isMastered),
          createdAt: item.createdAt ?? new Date().toISOString(),
        }));

        onImportData(normalized);
        setStatusMessage(`Imported ${normalized.length} items successfully`);
      } catch (error) {
        console.error(error);
        setStatusMessage('Import file is invalid. Please use a Nihongo Master JSON export.');
      }
    };

    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h2>Import / Export</h2>
          <p>Backup study data or load your previous list from a JSON file.</p>
        </div>
        <span className="page-header-badge">{statusMessage}</span>
      </div>

      <div className="action-grid">
        <div className="action-card">
          <h3>Export your data</h3>
          <p>Download all study items as JSON so you can backup, transfer, or restore your library later.</p>
          <div className="action-row">
            <button type="button" className="primary-action" onClick={handleExport}>
              Export JSON
            </button>
          </div>
          <div className="code-preview">{JSON.stringify(items.slice(0, 2), null, 2)}</div>
        </div>

        <div className="action-card">
          <h3>Import from file</h3>
          <p>Choose a Nihongo Master export file to replace the app data with your saved collection.</p>
          <div className="action-row">
            <button type="button" className="secondary-action" onClick={() => fileInputRef.current?.click()}>
              Import JSON
            </button>
          </div>
          <input
            ref={fileInputRef}
            className="hidden-file-input"
            type="file"
            accept="application/json"
            onChange={handleImportChange}
          />
          <div className="code-preview">Ready to load from: {items.length} total items</div>
        </div>
      </div>
    </div>
  );
};
