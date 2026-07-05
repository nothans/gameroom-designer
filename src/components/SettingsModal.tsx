import React, { useRef, useState } from 'react';
import { X, Upload, Download, Trash2, LayoutTemplate, AlertTriangle } from 'lucide-react';
import { normalizeLayout, NormalizedLayout, AppSettings } from '../layoutIO';
import { ExampleLayout } from '../examples';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (updates: Partial<AppSettings>) => void;
  onLoadLayout: (layout: NormalizedLayout) => void;
  onExportState: () => void;
  onClearData: () => void;
  examples: ExampleLayout[];
}

function Toggle({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <label className={`text-sm ${disabled ? 'text-muted' : 'text-ink-soft'}`}>{label}</label>
      <button
        onClick={onChange}
        disabled={disabled}
        className={`w-11 h-6 rounded-full transition-colors relative disabled:opacity-40 ${checked ? 'bg-arcade' : 'bg-line'}`}
        aria-pressed={checked}
        aria-label={label}
      >
        <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${checked ? 'left-6' : 'left-1'}`} />
      </button>
    </div>
  );
}

export function SettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onLoadLayout,
  onExportState,
  onClearData,
  examples,
}: SettingsModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        const layout = normalizeLayout(data);
        if (layout.items.length === 0) {
          setImportError('That layout has no valid items to load.');
        } else {
          onLoadLayout(layout);
          onClose();
        }
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'Could not read that file as JSON.');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const secondaryBtn = 'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors border bg-panel border-line text-ink-soft hover:bg-paneledge';

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-panel rounded-xl border border-line shadow-[0_24px_60px_-15px_rgba(20,22,40,0.35)] w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-line bg-paneledge shrink-0">
          <h2 className="font-display text-lg font-bold text-ink tracking-tight">Settings</h2>
          <button onClick={onClose} className="p-1 text-muted hover:text-ink hover:bg-line rounded-md transition-colors" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Grid & Snapping */}
          <section className="space-y-4">
            <h3 className="font-display text-sm font-semibold text-ink tracking-tight">Grid &amp; Snapping</h3>
            <Toggle label="Snap to grid" checked={settings.snapToGrid} onChange={() => onUpdateSettings({ snapToGrid: !settings.snapToGrid })} />
            <div className="space-y-1.5">
              <label className="text-sm text-ink-soft">Snap size</label>
              <select
                value={settings.snapSizeInches}
                onChange={(e) => onUpdateSettings({ snapSizeInches: Number(e.target.value) })}
                disabled={!settings.snapToGrid}
                className="w-full h-9 rounded-md border border-line bg-panel px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-arcade/30 disabled:opacity-50"
              >
                <option value={1}>1 inch</option>
                <option value={3}>3 inches</option>
                <option value={6}>6 inches (1/2 foot)</option>
                <option value={12}>12 inches (1 foot)</option>
              </select>
            </div>
          </section>

          <div className="h-px bg-line" />

          {/* Display */}
          <section className="space-y-4">
            <h3 className="font-display text-sm font-semibold text-ink tracking-tight">Display</h3>
            <Toggle label="Show grid" checked={settings.showGrid !== false} onChange={() => onUpdateSettings({ showGrid: settings.showGrid === false })} />
            <Toggle label="Show dimensions on blocks" checked={settings.showDimensions !== false} onChange={() => onUpdateSettings({ showDimensions: settings.showDimensions === false })} />
            <div className="space-y-1.5">
              <label className="text-sm text-ink-soft">Measurement unit</label>
              <select
                value={settings.unitSystem}
                onChange={(e) => onUpdateSettings({ unitSystem: e.target.value })}
                className="w-full h-9 rounded-md border border-line bg-panel px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-arcade/30"
              >
                <option value="imperial">Imperial (feet &amp; inches)</option>
                <option value="metric">Metric (meters &amp; centimeters)</option>
              </select>
            </div>
          </section>

          <div className="h-px bg-line" />

          {/* Examples */}
          <section className="space-y-3">
            <h3 className="font-display text-sm font-semibold text-ink tracking-tight">Start from an example</h3>
            <div className="space-y-2">
              {examples.map((ex) => (
                <button
                  key={ex.id}
                  onClick={() => { onLoadLayout(ex.layout); onClose(); }}
                  className="w-full text-left flex items-start gap-3 p-3 rounded-lg border border-line bg-panel hover:bg-paneledge transition-colors"
                >
                  <LayoutTemplate className="w-4 h-4 text-arcade-strong mt-0.5 shrink-0" />
                  <span>
                    <span className="block text-sm font-medium text-ink">{ex.name}</span>
                    <span className="block text-xs text-muted mt-0.5">{ex.description}</span>
                  </span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted">Loading an example replaces the current layout (you can undo).</p>
          </section>

          <div className="h-px bg-line" />

          {/* Data management */}
          <section className="space-y-3">
            <h3 className="font-display text-sm font-semibold text-ink tracking-tight">Data</h3>
            <div className="flex gap-3">
              <button onClick={onExportState} className={secondaryBtn}>
                <Download className="w-4 h-4" />
                Export JSON
              </button>
              <button onClick={() => fileInputRef.current?.click()} className={secondaryBtn}>
                <Upload className="w-4 h-4" />
                Import JSON
              </button>
              <input type="file" ref={fileInputRef} onChange={handleImport} accept=".json,application/json" className="hidden" />
            </div>
            {importError && (
              <p className="text-xs text-red-600 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                {importError}
              </p>
            )}

            {!confirmingClear ? (
              <button
                onClick={() => setConfirmingClear(true)}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium border border-red-200 bg-panel text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Clear all saved data
              </button>
            ) : (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2.5">
                <p className="text-xs text-red-700">This erases your layout, custom items, room size, and settings from this browser. It can’t be undone.</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { onClearData(); setConfirmingClear(false); onClose(); }}
                    className="flex-1 py-2 px-3 rounded-md text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors"
                  >
                    Erase everything
                  </button>
                  <button
                    onClick={() => setConfirmingClear(false)}
                    className="flex-1 py-2 px-3 rounded-md text-sm font-medium border border-line bg-panel text-ink-soft hover:bg-paneledge transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
