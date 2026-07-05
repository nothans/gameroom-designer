import { ReactNode } from 'react';
import { X, Github, Sparkles } from 'lucide-react';
import { BrandMark } from './BrandMark';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const mod = isMac ? '⌘' : 'Ctrl';

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: [mod, 'Z'], label: 'Undo' },
  { keys: [mod, '⇧', 'Z'], label: 'Redo' },
  { keys: [mod, 'C'], label: 'Copy' },
  { keys: [mod, 'V'], label: 'Paste' },
  { keys: ['R'], label: 'Rotate 90°' },
  { keys: ['[', ']'], label: 'Rotate left / right' },
  { keys: ['Del'], label: 'Remove selected' },
  { keys: ['Esc'], label: 'Deselect' },
  { keys: [mod, 'Scroll'], label: 'Zoom in / out' },
  { keys: ['Shift', 'Click'], label: 'Add to selection' },
];

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded border border-line bg-ground text-[11px] font-mono font-medium text-ink-soft shadow-[0_1px_0_rgba(20,22,40,0.08)]">
      {children}
    </kbd>
  );
}

export function AboutModal({ isOpen, onClose }: AboutModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-panel rounded-xl w-full max-w-sm overflow-hidden border border-line shadow-[0_24px_60px_-15px_rgba(20,22,40,0.35)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-line bg-paneledge">
          <div className="flex items-center gap-2.5">
            <BrandMark className="w-7 h-7" />
            <h2 className="font-display text-lg font-bold text-ink tracking-tight">Gameroom Designer</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-muted hover:text-ink hover:bg-line rounded-md transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-sm text-ink-soft leading-relaxed">
          <p>
            Plan a room to scale, then drop in arcade cabinets, pinball, a pool table, furniture, and
            storage to see what actually fits. Everything runs in your browser and saves locally.
          </p>
          <div className="pt-1">
            <h3 className="font-display text-[11px] font-bold text-muted uppercase tracking-wider mb-2.5">Keyboard shortcuts</h3>
            <dl className="space-y-1.5">
              {SHORTCUTS.map((s) => (
                <div key={s.label} className="flex items-center justify-between gap-3">
                  <dt className="text-[13px] text-ink-soft">{s.label}</dt>
                  <dd className="flex items-center gap-1 shrink-0">
                    {s.keys.map((k, i) => (
                      <span key={i} className="flex items-center gap-1">
                        {i > 0 && <span className="text-[10px] text-muted">{k === ']' && s.keys[i - 1] === '[' ? '' : '+'}</span>}
                        <Kbd>{k}</Kbd>
                      </span>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <p className="flex items-center gap-2 text-muted">
            <Sparkles className="w-4 h-4 text-arcade shrink-0" />
            Surprises are possible.
          </p>
          <div className="pt-3 flex items-center justify-between border-t border-line">
            <a
              href="https://github.com/nothans"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 font-medium text-ink hover:text-arcade-strong transition-colors"
            >
              <Github className="w-4 h-4" />
              NotHans on GitHub
            </a>
            <span className="font-mono text-xs text-muted">v{__APP_VERSION__}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
