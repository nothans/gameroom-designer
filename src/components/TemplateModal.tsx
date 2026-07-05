import React, { useState, useEffect } from 'react';
import { FurnitureTemplate } from '../types';
import { X } from 'lucide-react';

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (template: FurnitureTemplate) => void;
  initialData?: FurnitureTemplate | null;
  category: 'arcade' | 'furniture' | 'decor' | 'storage' | 'structural';
}

/** Clamp a typed dimension to a positive whole number of inches. */
function clampInches(raw: string, fallback = 24) {
  const n = Number(raw);
  if (!isFinite(n) || n <= 0) return fallback;
  return Math.max(1, Math.round(n));
}

export function TemplateModal({ isOpen, onClose, onSave, initialData, category }: TemplateModalProps) {
  const [name, setName] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [color, setColor] = useState('#f59e0b');

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setWidth(initialData.widthInches.toString());
      setHeight(initialData.heightInches.toString());
      setColor(initialData.color);
    } else {
      setName('');
      setWidth('');
      setHeight('');
      setColor('#f59e0b');
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newTemplate: FurnitureTemplate = {
      id: initialData?.id || `custom-${crypto.randomUUID()}`,
      name: name.trim() || 'Custom Item',
      widthInches: clampInches(width),
      heightInches: clampInches(height),
      color,
      category,
      isCustom: true,
      ...(category === 'structural' ? { isResizable: true, pattern: 'hashed' } : {})
    };

    onSave(newTemplate);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-panel rounded-xl border border-line shadow-[0_24px_60px_-15px_rgba(20,22,40,0.35)] w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-line bg-paneledge">
          <h2 className="font-display text-lg font-bold text-ink tracking-tight">
            {initialData ? 'Edit Item' : 'New Item'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-muted hover:text-ink hover:bg-line rounded-md transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-ink-soft uppercase tracking-wider mb-1.5">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 bg-panel border border-line rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-arcade/20 focus:border-arcade transition-colors"
              placeholder="e.g. Vintage Arcade"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink-soft uppercase tracking-wider mb-1.5">
                Width (inches)
              </label>
              <input
                type="number"
                value={width}
                onChange={e => setWidth(e.target.value)}
                min="1"
                className="w-full px-3 py-2 bg-panel border border-line rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-arcade/20 focus:border-arcade transition-colors"
                placeholder="24"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-soft uppercase tracking-wider mb-1.5">
                Length (inches)
              </label>
              <input
                type="number"
                value={height}
                onChange={e => setHeight(e.target.value)}
                min="1"
                className="w-full px-3 py-2 bg-panel border border-line rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-arcade/20 focus:border-arcade transition-colors"
                placeholder="24"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-soft uppercase tracking-wider mb-1.5">
              Color
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="w-10 h-10 rounded cursor-pointer border-0 p-0 bg-transparent"
              />
              <span className="font-mono text-sm text-muted">{color}</span>
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-ink-soft bg-panel border border-line hover:bg-paneledge rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-arcade hover:bg-arcade-strong rounded-lg transition-colors"
            >
              Save Item
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
