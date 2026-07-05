import { useState } from 'react';
import { FurnitureTemplate } from '../types';
import { Plus, Edit2, Sparkles, HelpCircle, Github, Search, X } from 'lucide-react';
import { BrandMark } from './BrandMark';

export const DRAG_MIME = 'application/x-gameroom-template';

interface PaletteProps {
  templates: FurnitureTemplate[];
  onAddItem: (templateId: string) => void;
  onAddTemplate: (category: 'arcade' | 'furniture' | 'decor' | 'storage' | 'structural') => void;
  onEditTemplate: (templateId: string) => void;
  onOpenAbout: () => void;
}

export function Palette({ templates, onAddItem, onAddTemplate, onEditTemplate, onOpenAbout }: PaletteProps) {
  const categories = ['arcade', 'furniture', 'storage', 'decor', 'structural'] as const;
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const searching = q.length > 0;
  const matches = (t: FurnitureTemplate) => !searching || t.name.toLowerCase().includes(q);
  const totalMatches = templates.filter(matches).length;

  return (
    <div className="w-72 bg-panel border-r border-line h-full flex flex-col shrink-0 z-20 relative">
      {/* Wordmark */}
      <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-line">
        <BrandMark className="w-7 h-7 shrink-0" />
        <span className="font-display text-[15px] font-bold text-ink tracking-tight leading-none">
          Gameroom Designer
        </span>
      </div>

      <div className="px-4 pt-4 pb-3 space-y-2.5">
        <div>
          <h2 className="font-display text-[11px] font-bold text-muted uppercase tracking-wider px-1">Library</h2>
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items…"
            className="w-full h-9 pl-8 pr-8 rounded-lg border border-line bg-ground text-sm text-ink placeholder:text-muted outline-none focus:border-arcade focus:ring-2 focus:ring-arcade/20 transition-colors"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded flex items-center justify-center text-muted hover:text-ink hover:bg-line transition-colors"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-1 pb-4 space-y-7">
        {searching && totalMatches === 0 && (
          <p className="text-sm text-muted text-center px-4 py-6">No items match “{query}”.</p>
        )}
        {categories.map(category => {
          const inCategory = templates.filter(t => t.category === category && matches(t));
          if (searching && inCategory.length === 0) return null;
          return (
          <div key={category}>
            <div className="flex items-center justify-between mb-2.5 px-1">
              <h3 className="font-display text-[11px] font-bold text-muted uppercase tracking-wider">
                {category}
              </h3>
              {!searching && (
                <button
                  onClick={() => onAddTemplate(category)}
                  className="text-xs font-medium text-arcade hover:text-arcade-strong flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  New
                </button>
              )}
            </div>
            <div className="space-y-1">
              {inCategory.map(template => (
                <div key={template.id} className="group relative">
                  <button
                    onClick={() => onAddItem(template.id)}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(DRAG_MIME, template.id);
                      e.dataTransfer.setData('text/plain', template.name);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    title="Click to add, or drag onto the room"
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-paneledge transition-colors text-left cursor-grab active:cursor-grabbing"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-5 h-5 rounded shadow-sm border border-black/10 shrink-0"
                        style={{ backgroundColor: template.color }}
                      />
                      <div>
                        <div className="text-sm font-medium text-ink-soft group-hover:text-ink transition-colors">
                          {template.name}
                        </div>
                        <div className="text-[11px] text-muted font-mono mt-0.5">
                          {template.widthInches}" × {template.heightInches}"
                        </div>
                      </div>
                    </div>
                    <div className="w-6 h-6 rounded-full bg-panel shadow-sm border border-line flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity group-hover:mr-6">
                      <Plus className="w-3.5 h-3.5 text-ink-soft" />
                    </div>
                  </button>
                  {template.isCustom && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditTemplate(template.id);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded flex items-center justify-center text-muted hover:text-ink hover:bg-line opacity-0 group-hover:opacity-100 transition-all"
                      title="Edit template"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-auto border-t border-line bg-paneledge px-4 py-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-muted">
            <Sparkles className="w-3.5 h-3.5 text-arcade" />
            Surprises are possible.
          </span>
          <button
            onClick={onOpenAbout}
            className="flex items-center gap-1 font-medium text-arcade hover:text-arcade-strong transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Help / About
          </button>
        </div>
        <div className="flex items-center justify-between text-xs text-muted">
          <a
            href="https://github.com/nothans"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 hover:text-ink transition-colors"
          >
            <Github className="w-3.5 h-3.5" />
            NotHans
          </a>
          <span className="font-mono">v{__APP_VERSION__}</span>
        </div>
      </div>
    </div>
  );
}
