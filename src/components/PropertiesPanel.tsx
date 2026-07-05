import { useState, useEffect } from 'react';
import {
  RotateCcw, RotateCw, Trash2, Maximize, ArrowRightLeft,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
  AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter,
} from 'lucide-react';
import { RoomItem, FurnitureTemplate } from '../types';

type Alignment = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

interface PropertiesPanelProps {
  templates: FurnitureTemplate[];
  selectedItem: RoomItem | null;
  selectedCount: number;
  onUpdateItem: (id: string, updates: Partial<RoomItem>) => void;
  onDeleteItem: (id: string) => void;
  onDeleteSelected: () => void;
  onAlign: (alignment: Alignment) => void;
  onDistribute: (axis: 'h' | 'v') => void;
  onRotateSelected: (delta: number) => void;
  roomWidthFt: number;
  roomLengthFt: number;
  onUpdateRoomSize: (width: number, length: number) => void;
  onToggleRoomOrientation: () => void;
  settings?: {
    snapToGrid: boolean;
    snapSizeInches: number;
    unitSystem: string;
  };
}

const FT_PER_M = 0.3048;

function MultiSelect({
  count,
  onAlign,
  onDistribute,
  onRotateSelected,
  onDeleteSelected,
}: {
  count: number;
  onAlign: (a: Alignment) => void;
  onDistribute: (axis: 'h' | 'v') => void;
  onRotateSelected: (delta: number) => void;
  onDeleteSelected: () => void;
}) {
  const iconBtn = 'flex-1 flex items-center justify-center h-9 rounded-md border border-line bg-panel text-ink-soft hover:bg-paneledge hover:text-ink transition-colors disabled:opacity-40 disabled:hover:bg-panel';
  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-4 h-4 rounded bg-blue-500/20 border border-blue-500 shrink-0" />
          <h3 className="text-base font-semibold text-ink">{count} items selected</h3>
        </div>
        <p className="text-xs text-muted pl-7">Align, distribute, rotate, or remove them together.</p>
      </div>

      <div>
        <h4 className="font-display text-[11px] font-bold text-muted uppercase tracking-wider mb-2">Align</h4>
        <div className="flex gap-1.5 mb-1.5">
          <button className={iconBtn} title="Align left" onClick={() => onAlign('left')}><AlignStartVertical className="w-4 h-4" /></button>
          <button className={iconBtn} title="Align horizontal centers" onClick={() => onAlign('center')}><AlignCenterVertical className="w-4 h-4" /></button>
          <button className={iconBtn} title="Align right" onClick={() => onAlign('right')}><AlignEndVertical className="w-4 h-4" /></button>
        </div>
        <div className="flex gap-1.5">
          <button className={iconBtn} title="Align top" onClick={() => onAlign('top')}><AlignStartHorizontal className="w-4 h-4" /></button>
          <button className={iconBtn} title="Align vertical centers" onClick={() => onAlign('middle')}><AlignCenterHorizontal className="w-4 h-4" /></button>
          <button className={iconBtn} title="Align bottom" onClick={() => onAlign('bottom')}><AlignEndHorizontal className="w-4 h-4" /></button>
        </div>
      </div>

      <div>
        <h4 className="font-display text-[11px] font-bold text-muted uppercase tracking-wider mb-2">Distribute</h4>
        <div className="flex gap-1.5">
          <button className={iconBtn} title="Distribute horizontally (even gaps)" disabled={count < 3} onClick={() => onDistribute('h')}>
            <AlignHorizontalDistributeCenter className="w-4 h-4" />
          </button>
          <button className={iconBtn} title="Distribute vertically (even gaps)" disabled={count < 3} onClick={() => onDistribute('v')}>
            <AlignVerticalDistributeCenter className="w-4 h-4" />
          </button>
        </div>
        {count < 3 && <p className="text-[11px] text-muted mt-1.5">Select 3 or more to distribute.</p>}
      </div>

      <div>
        <h4 className="font-display text-[11px] font-bold text-muted uppercase tracking-wider mb-2">Rotate all</h4>
        <div className="flex gap-3">
          <button className="flex-1 flex flex-col items-center justify-center gap-1.5 py-3 bg-panel hover:bg-paneledge text-ink-soft rounded-lg border border-line transition-colors" onClick={() => onRotateSelected(-90)}>
            <RotateCcw className="w-4 h-4 text-muted" /><span className="text-xs font-medium">-90°</span>
          </button>
          <button className="flex-1 flex flex-col items-center justify-center gap-1.5 py-3 bg-panel hover:bg-paneledge text-ink-soft rounded-lg border border-line transition-colors" onClick={() => onRotateSelected(90)}>
            <RotateCw className="w-4 h-4 text-muted" /><span className="text-xs font-medium">+90°</span>
          </button>
        </div>
      </div>

      <div className="pt-6 border-t border-line">
        <button
          onClick={onDeleteSelected}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-panel hover:bg-red-50 border border-red-200 hover:border-red-300 text-red-600 text-sm font-medium rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Remove {count} items
        </button>
      </div>
    </div>
  );
}

export function PropertiesPanel({
  templates,
  selectedItem,
  selectedCount,
  onUpdateItem,
  onDeleteItem,
  onDeleteSelected,
  onAlign,
  onDistribute,
  onRotateSelected,
  roomWidthFt,
  roomLengthFt,
  onUpdateRoomSize,
  onToggleRoomOrientation,
  settings = { snapToGrid: false, snapSizeInches: 12, unitSystem: 'imperial' }
}: PropertiesPanelProps) {
  const template = selectedItem ? templates.find(t => t.id === selectedItem.templateId) : null;
  const isMetric = settings.unitSystem === 'metric';

  // Per-block label. Kept local and committed on blur/Enter so typing doesn't push a history entry per keystroke.
  const [labelDraft, setLabelDraft] = useState('');
  useEffect(() => {
    setLabelDraft(selectedItem?.label ?? '');
  }, [selectedItem?.instanceId, selectedItem?.label]);

  const commitLabel = () => {
    if (!selectedItem) return;
    const trimmed = labelDraft.trim();
    if (trimmed !== (selectedItem.label ?? '')) {
      onUpdateItem(selectedItem.instanceId, { label: trimmed || undefined });
    }
  };

  const formatDimension = (inches: number) => {
    if (isMetric) {
      const cm = Math.round(inches * 2.54);
      return cm >= 100 ? `${(cm / 100).toFixed(2)}m` : `${cm}cm`;
    }
    return `${inches}"`;
  };

  // Room size is stored in feet; in metric we show one decimal of meters and
  // convert back with parseFloat so toggling units doesn't quantize/drift the value.
  const displayRoom = (ft: number) => (isMetric ? +(ft * FT_PER_M).toFixed(1) : ft);
  const parseRoom = (raw: string, current: number) => {
    const n = parseFloat(raw);
    if (isNaN(n)) return current;
    return isMetric ? n / FT_PER_M : n;
  };
  const unitLabel = isMetric ? 'm' : 'ft';

  return (
    <div className="w-72 bg-panel border-l border-line h-full flex flex-col shrink-0 z-20 relative">
      <div className="px-5 py-4 border-b border-line">
        <h2 className="font-display text-lg font-bold text-ink tracking-tight">Properties</h2>
      </div>

      <div className="p-5 flex-1 overflow-y-auto">
        {selectedCount > 1 ? (
          <MultiSelect
            count={selectedCount}
            onAlign={onAlign}
            onDistribute={onDistribute}
            onRotateSelected={onRotateSelected}
            onDeleteSelected={onDeleteSelected}
          />
        ) : selectedItem && template ? (
          <div className="space-y-8">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-4 h-4 rounded shadow-sm border border-black/10" style={{ backgroundColor: template.color }} />
                <h3 className="text-base font-semibold text-ink">{template.name}</h3>
              </div>
              <p className="text-xs text-muted uppercase tracking-wider pl-7">{template.category}</p>
            </div>

            <div>
              <h4 className="font-display text-[11px] font-bold text-muted uppercase tracking-wider mb-2">Label</h4>
              <input
                type="text"
                value={labelDraft}
                onChange={e => setLabelDraft(e.target.value)}
                onBlur={commitLabel}
                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                placeholder={template.name}
                maxLength={40}
                className="w-full text-sm bg-panel border border-line rounded-md px-2.5 py-1.5 text-ink outline-none focus:border-arcade focus:ring-2 focus:ring-arcade/20 transition-colors"
              />
              <p className="text-[11px] text-muted mt-1.5">Name this specific block (e.g. a game title). Shown on the canvas.</p>
            </div>

            <div>
              <h4 className="font-display text-[11px] font-bold text-muted uppercase tracking-wider mb-3">Dimensions</h4>
              <div className="grid grid-cols-2 divide-x divide-line border-y border-line">
                <div className="py-2.5 pr-3">
                  <span className="block text-[11px] font-semibold uppercase text-muted mb-0.5">Width</span>
                  <span className="font-mono text-sm text-ink">{formatDimension(selectedItem.overrideWidth ?? template.widthInches)}</span>
                </div>
                <div className="py-2.5 pl-3">
                  <span className="block text-[11px] font-semibold uppercase text-muted mb-0.5">Length</span>
                  <span className="font-mono text-sm text-ink">{formatDimension(selectedItem.overrideHeight ?? template.heightInches)}</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-display text-[11px] font-bold text-muted uppercase tracking-wider mb-3">Rotation</h4>
              <div className="flex gap-3">
                <button
                  onClick={() => onUpdateItem(selectedItem.instanceId, { rotation: (selectedItem.rotation - 90) % 360 })}
                  className="flex-1 flex flex-col items-center justify-center gap-1.5 py-3 px-3 bg-panel hover:bg-paneledge text-ink-soft rounded-lg border border-line transition-colors"
                >
                  <RotateCcw className="w-4 h-4 text-muted" />
                  <span className="text-xs font-medium">-90°</span>
                </button>
                <button
                  onClick={() => onUpdateItem(selectedItem.instanceId, { rotation: (selectedItem.rotation + 90) % 360 })}
                  className="flex-1 flex flex-col items-center justify-center gap-1.5 py-3 px-3 bg-panel hover:bg-paneledge text-ink-soft rounded-lg border border-line transition-colors"
                >
                  <RotateCw className="w-4 h-4 text-muted" />
                  <span className="text-xs font-medium">+90°</span>
                </button>
              </div>
            </div>

            <div className="pt-6 border-t border-line">
              <button
                onClick={() => onDeleteItem(selectedItem.instanceId)}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-panel hover:bg-red-50 border border-red-200 hover:border-red-300 text-red-600 text-sm font-medium rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Remove Item
              </button>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted space-y-4 px-4">
            <div className="w-12 h-12 bg-paneledge rounded-full flex items-center justify-center border border-line">
              <Maximize className="w-5 h-5 text-muted" />
            </div>
            <p className="text-sm">Select an item on the canvas to view and edit its properties.</p>
          </div>
        )}
      </div>

      {/* Room Settings */}
      <div className="p-5 border-t border-line bg-paneledge">
        <h4 className="font-display text-[11px] font-bold text-muted uppercase tracking-wider mb-3">Room Layout</h4>
        <div className="flex items-stretch gap-3 mb-4">
          <div className="flex-1 flex flex-col">
            <label className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-1">Width ({unitLabel})</label>
            <input
              type="number"
              min="1"
              max="200"
              step={isMetric ? '0.1' : '1'}
              value={displayRoom(roomWidthFt)}
              onChange={e => onUpdateRoomSize(parseRoom(e.target.value, roomWidthFt), roomLengthFt)}
              className="w-full text-sm font-mono text-ink font-semibold bg-panel border border-line rounded-md px-2 py-1.5 outline-none focus:border-arcade focus:ring-2 focus:ring-arcade/20 transition-colors"
            />
          </div>
          <div className="flex-1 flex flex-col">
            <label className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-1">Length ({unitLabel})</label>
            <input
              type="number"
              min="1"
              max="200"
              step={isMetric ? '0.1' : '1'}
              value={displayRoom(roomLengthFt)}
              onChange={e => onUpdateRoomSize(roomWidthFt, parseRoom(e.target.value, roomLengthFt))}
              className="w-full text-sm font-mono text-ink font-semibold bg-panel border border-line rounded-md px-2 py-1.5 outline-none focus:border-arcade focus:ring-2 focus:ring-arcade/20 transition-colors"
            />
          </div>
        </div>
        <button
          onClick={onToggleRoomOrientation}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-panel border border-line hover:bg-panel/60 text-ink-soft text-sm font-medium rounded-lg transition-colors"
        >
          <ArrowRightLeft className="w-4 h-4 text-muted" />
          Swap Orientation
        </button>
      </div>
    </div>
  );
}
