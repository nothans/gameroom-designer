import { useState, useEffect, useCallback, useMemo } from 'react';
import { RoomItem, FurnitureTemplate } from './types';
import { templates as defaultTemplates } from './data';
import { PX_PER_INCH, MIN_ROOM_FT, MAX_ROOM_FT } from './constants';
import { buildLayoutFile, DEFAULT_SETTINGS, NormalizedLayout } from './layoutIO';
import { examples } from './examples';
import { RoomCanvas } from './components/RoomCanvas';
import { Palette } from './components/Palette';
import { PropertiesPanel } from './components/PropertiesPanel';
import { TemplateModal } from './components/TemplateModal';
import { SettingsModal } from './components/SettingsModal';
import { AboutModal } from './components/AboutModal';
import { Undo, Redo, Copy, ClipboardPaste, Download, Ruler, AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal, Settings } from 'lucide-react';
import { toPng } from 'html-to-image';

interface Box { x: number; y: number; w: number; h: number; }

/** Rotation-aware axis-aligned bounding box for an item, in room pixels. */
function aabbBox(item: RoomItem, template: FurnitureTemplate | undefined): Box {
  const wU = (item.overrideWidth || template?.widthInches || 24) * PX_PER_INCH;
  const hU = (item.overrideHeight || template?.heightInches || 24) * PX_PER_INCH;
  const rot = (((item.rotation || 0) % 360) + 360) % 360;
  const rotated = rot === 90 || rot === 270;
  const ew = rotated ? hU : wU;
  const eh = rotated ? wU : hU;
  return { x: item.x + (wU - ew) / 2, y: item.y + (hU - eh) / 2, w: ew, h: eh };
}

const boxesOverlap = (a: Box, b: Box, gap: number) =>
  !(a.x + a.w + gap <= b.x || b.x + b.w + gap <= a.x || a.y + a.h + gap <= b.y || b.y + b.h + gap <= a.y);

/**
 * First open spot for a w×h item that doesn't collide with any obstacle, scanned top-left to
 * bottom-right on a coarse grid. Falls back to a varied cascade when the room is full or too small,
 * so items never spawn in an exact pile.
 */
function firstFreeSpot(w: number, h: number, obstacles: Box[], roomW: number, roomH: number, n: number): { x: number; y: number } {
  const margin = 12, gap = 10, step = 24;
  const maxX = roomW - w - margin;
  const maxY = roomH - h - margin;
  if (maxX >= margin && maxY >= margin) {
    for (let y = margin; y <= maxY; y += step) {
      for (let x = margin; x <= maxX; x += step) {
        if (!obstacles.some((o) => boxesOverlap({ x, y, w, h }, o, gap))) return { x, y };
      }
    }
  }
  const spanX = Math.max(48, maxX - margin);
  const spanY = Math.max(48, maxY - margin);
  return {
    x: Math.max(margin, margin + (n * 24) % spanX),
    y: Math.max(margin, margin + (n * 24) % spanY),
  };
}

/** Persist without letting a quota/private-mode throw take down the app. */
const safeSetItem = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    console.warn(`Gameroom Designer: could not save "${key}"`, err);
  }
};

export default function App() {
  const [historyState, setHistoryState] = useState<{history: RoomItem[][], index: number}>(() => {
    try {
      const stored = localStorage.getItem('roomPlanner_historyState');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && Array.isArray(parsed.history) && typeof parsed.index === 'number') {
          return parsed;
        }
      }

      // Fallback for previous separate states
      const storedHistory = localStorage.getItem('roomPlanner_history');
      const storedIndex = localStorage.getItem('roomPlanner_historyIndex');
      if (storedHistory && storedIndex) {
        return {
          history: JSON.parse(storedHistory),
          index: JSON.parse(storedIndex)
        };
      }
    } catch (e) {}
    return { history: [[]], index: 0 };
  });
  const items = historyState.history[historyState.index] || [];

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [copiedItems, setCopiedItems] = useState<RoomItem[]>([]);
  const [isRulerActive, setIsRulerActive] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [settings, setSettings] = useState(() => {
    try {
      const stored = localStorage.getItem('roomPlanner_settings');
      if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    } catch (e) {}
    return { ...DEFAULT_SETTINGS };
  });

  const [roomWidthFt, setRoomWidthFt] = useState(() => {
    try {
      const stored = localStorage.getItem('roomPlanner_roomWidthFt');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return 16;
  });
  const [roomLengthFt, setRoomLengthFt] = useState(() => {
    try {
      const stored = localStorage.getItem('roomPlanner_roomLengthFt');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return 20;
  });

  const [customTemplates, setCustomTemplates] = useState<FurnitureTemplate[]>(() => {
    try {
      const stored = localStorage.getItem('roomPlanner_customTemplates');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return [];
  });
  const [modalState, setModalState] = useState<{ isOpen: boolean; initialData?: FurnitureTemplate | null; category: FurnitureTemplate['category'] }>({
    isOpen: false,
    category: 'furniture'
  });

  // Persistence side-effects
  useEffect(() => {
    safeSetItem('roomPlanner_historyState', JSON.stringify(historyState));
  }, [historyState]);
  useEffect(() => {
    safeSetItem('roomPlanner_roomWidthFt', JSON.stringify(roomWidthFt));
  }, [roomWidthFt]);
  useEffect(() => {
    safeSetItem('roomPlanner_roomLengthFt', JSON.stringify(roomLengthFt));
  }, [roomLengthFt]);
  useEffect(() => {
    safeSetItem('roomPlanner_customTemplates', JSON.stringify(customTemplates));
  }, [customTemplates]);
  useEffect(() => {
    safeSetItem('roomPlanner_settings', JSON.stringify(settings));
  }, [settings]);

  const allTemplates = useMemo(() => [...defaultTemplates, ...customTemplates], [customTemplates]);

  const roomWpx = roomWidthFt * 12 * PX_PER_INCH;
  const roomHpx = roomLengthFt * 12 * PX_PER_INCH;
  // Solid items block placement; clearance zones don't (you place machines inside them).
  const obstacleBoxes = useMemo(
    () => items
      .map(it => ({ it, t: allTemplates.find(x => x.id === it.templateId) }))
      .filter(({ t }) => t && t.pattern !== 'zone' && t.pattern !== 'zone-circle')
      .map(({ it, t }) => aabbBox(it, t)),
    [items, allTemplates]
  );

  const pushState = useCallback((newItems: RoomItem[]) => {
    setHistoryState((prev) => {
      const validIndex = Math.min(prev.index, prev.history.length - 1);
      let newHistory = prev.history.slice(0, validIndex + 1);
      newHistory.push(newItems);

      if (newHistory.length > 50) {
        newHistory = newHistory.slice(newHistory.length - 50);
      }

      return {
        history: newHistory,
        index: newHistory.length - 1
      };
    });
  }, []);

  const handleAddItem = useCallback((templateId: string) => {
    const t = allTemplates.find(x => x.id === templateId);
    const wPx = (t?.widthInches || 24) * PX_PER_INCH;
    const hPx = (t?.heightInches || 24) * PX_PER_INCH;
    const { x, y } = firstFreeSpot(wPx, hPx, obstacleBoxes, roomWpx, roomHpx, items.length);
    const newItem: RoomItem = {
      instanceId: crypto.randomUUID(),
      templateId,
      x,
      y,
      rotation: 0,
    };
    pushState([...items, newItem]);
    setSelectedIds([newItem.instanceId]);
  }, [items, pushState, allTemplates, obstacleBoxes, roomWpx, roomHpx]);

  // Drop from the palette: place the item centered on the drop point, clamped inside the room.
  const handleAddItemAt = useCallback((templateId: string, cx: number, cy: number) => {
    const t = allTemplates.find(x => x.id === templateId);
    if (!t) return;
    const wPx = (t.widthInches || 24) * PX_PER_INCH;
    const hPx = (t.heightInches || 24) * PX_PER_INCH;
    const x = Math.max(0, Math.min(roomWpx - wPx, cx - wPx / 2));
    const y = Math.max(0, Math.min(roomHpx - hPx, cy - hPx / 2));
    const newItem: RoomItem = { instanceId: crypto.randomUUID(), templateId, x, y, rotation: 0 };
    pushState([...items, newItem]);
    setSelectedIds([newItem.instanceId]);
  }, [items, pushState, allTemplates, roomWpx, roomHpx]);

  const handleUpdateItem = useCallback((id: string, updates: Partial<RoomItem>) => {
    pushState(items.map(item => item.instanceId === id ? { ...item, ...updates } : item));
  }, [items, pushState]);

  const handleUpdateItems = useCallback((updatesList: {id: string, updates: Partial<RoomItem>}[]) => {
    pushState(items.map(item => {
      const u = updatesList.find(x => x.id === item.instanceId);
      return u ? { ...item, ...u.updates } : item;
    }));
  }, [items, pushState]);

  const handleDuplicateItem = useCallback((id: string) => {
    const orig = items.find(i => i.instanceId === id);
    if (!orig) return;
    const t = allTemplates.find(x => x.id === orig.templateId);
    const box = aabbBox(orig, t);
    const { x, y } = firstFreeSpot(box.w, box.h, obstacleBoxes, roomWpx, roomHpx, items.length);
    const dup: RoomItem = { ...orig, instanceId: crypto.randomUUID(), x, y };
    pushState([...items, dup]);
    setSelectedIds([dup.instanceId]);
  }, [items, pushState, allTemplates, obstacleBoxes, roomWpx, roomHpx]);

  const handleDeleteItem = useCallback((id: string) => {
    pushState(items.filter(item => item.instanceId !== id));
    setSelectedIds(prev => prev.filter(i => i !== id));
  }, [items, pushState]);

  const handleDeleteItems = useCallback((ids: string[]) => {
    pushState(items.filter(item => !ids.includes(item.instanceId)));
    setSelectedIds(prev => prev.filter(i => !ids.includes(i)));
  }, [items, pushState]);

  const handleAlign = useCallback((alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    if (selectedIds.length < 2) return;

    const selectedItems = items.filter(i => selectedIds.includes(i.instanceId));
    if (selectedItems.length < 2) return;

    // Bounds use each item's effective (rotation-aware) box so aligning rotated items lines up visually.
    const bounds = selectedItems.map(item => {
      const template = allTemplates.find(t => t.id === item.templateId);
      const wU = (item.overrideWidth || template?.widthInches || 24) * PX_PER_INCH;
      const hU = (item.overrideHeight || template?.heightInches || 24) * PX_PER_INCH;
      const rot = (((item.rotation || 0) % 360) + 360) % 360;
      const rotated = rot === 90 || rot === 270;
      const ew = rotated ? hU : wU;
      const eh = rotated ? wU : hU;
      return {
        id: item.instanceId,
        wU, hU, ew, eh,
        left: item.x + (wU - ew) / 2,
        top: item.y + (hU - eh) / 2,
      };
    });

    const minX = Math.min(...bounds.map(b => b.left));
    const maxX = Math.max(...bounds.map(b => b.left + b.ew));
    const minY = Math.min(...bounds.map(b => b.top));
    const maxY = Math.max(...bounds.map(b => b.top + b.eh));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const updates = bounds.map(b => {
      let newLeft = b.left;
      let newTop = b.top;

      switch (alignment) {
        case 'left': newLeft = minX; break;
        case 'center': newLeft = centerX - b.ew / 2; break;
        case 'right': newLeft = maxX - b.ew; break;
        case 'top': newTop = minY; break;
        case 'middle': newTop = centerY - b.eh / 2; break;
        case 'bottom': newTop = maxY - b.eh; break;
      }

      // Convert the aligned AABB position back to the item's stored (unrotated) top-left.
      return {
        id: b.id,
        updates: {
          x: newLeft - (b.wU - b.ew) / 2,
          y: newTop - (b.hU - b.eh) / 2,
        }
      };
    });

    handleUpdateItems(updates);
  }, [items, selectedIds, allTemplates, handleUpdateItems]);

  // Even out the edge-to-edge gaps between 3+ selected items along an axis, keeping the outermost two fixed.
  const handleDistribute = useCallback((axis: 'h' | 'v') => {
    if (selectedIds.length < 3) return;
    const sel = items.filter(i => selectedIds.includes(i.instanceId));
    if (sel.length < 3) return;
    const bounds = sel.map(item => {
      const t = allTemplates.find(x => x.id === item.templateId);
      const b = aabbBox(item, t);
      const wU = (item.overrideWidth || t?.widthInches || 24) * PX_PER_INCH;
      const hU = (item.overrideHeight || t?.heightInches || 24) * PX_PER_INCH;
      return { id: item.instanceId, wU, hU, left: b.x, top: b.y, ew: b.w, eh: b.h };
    });
    const horiz = axis === 'h';
    const size = (b: typeof bounds[number]) => (horiz ? b.ew : b.eh);
    const start = (b: typeof bounds[number]) => (horiz ? b.left : b.top);
    const sorted = [...bounds].sort((a, b) => start(a) - start(b));
    const minStart = start(sorted[0]);
    const maxEnd = start(sorted[sorted.length - 1]) + size(sorted[sorted.length - 1]);
    const totalSize = sorted.reduce((s, b) => s + size(b), 0);
    const gap = (maxEnd - minStart - totalSize) / (sorted.length - 1);
    let cursor = minStart;
    const updates = sorted.map(b => {
      const p = cursor;
      cursor += size(b) + gap;
      return horiz
        ? { id: b.id, updates: { x: p - (b.wU - b.ew) / 2 } }
        : { id: b.id, updates: { y: p - (b.hU - b.eh) / 2 } };
    });
    handleUpdateItems(updates);
  }, [items, selectedIds, allTemplates, handleUpdateItems]);

  const handleRotateSelected = useCallback((delta: number) => {
    if (selectedIds.length === 0) return;
    handleUpdateItems(selectedIds.map(id => {
      const it = items.find(i => i.instanceId === id);
      return { id, updates: { rotation: ((it?.rotation || 0) + delta) % 360 } };
    }));
  }, [items, selectedIds, handleUpdateItems]);

  const undo = useCallback(() => {
    setHistoryState(prev => {
      if (prev.index > 0) {
        setSelectedIds([]);
        return { ...prev, index: prev.index - 1 };
      }
      return prev;
    });
  }, []);

  const redo = useCallback(() => {
    setHistoryState(prev => {
      if (prev.index < prev.history.length - 1) {
        setSelectedIds([]);
        return { ...prev, index: prev.index + 1 };
      }
      return prev;
    });
  }, []);

  const copy = useCallback(() => {
    if (selectedIds.length > 0) {
      const itemsToCopy = items.filter(i => selectedIds.includes(i.instanceId));
      setCopiedItems(itemsToCopy);
    }
  }, [selectedIds, items]);

  const paste = useCallback(() => {
    if (copiedItems.length > 0) {
      const newItems = copiedItems.map(copiedItem => ({
        ...copiedItem,
        instanceId: crypto.randomUUID(),
        x: copiedItem.x + 20,
        y: copiedItem.y + 20,
      }));
      pushState([...items, ...newItems]);
      setSelectedIds(newItems.map(i => i.instanceId));
      setCopiedItems(newItems); // Update so next paste offsets further
    }
  }, [copiedItems, items, pushState]);

  const handleSaveTemplate = (template: FurnitureTemplate) => {
    setCustomTemplates(prev => {
      const existingIndex = prev.findIndex(t => t.id === template.id);
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = template;
        return next;
      }
      return [...prev, template];
    });
    setModalState({ ...modalState, isOpen: false });
  };

  const handleOpenAddModal = (category: FurnitureTemplate['category']) => {
    setModalState({ isOpen: true, initialData: null, category });
  };

  const handleOpenEditModal = (templateId: string) => {
    const template = customTemplates.find(t => t.id === templateId);
    if (template) {
      setModalState({ isOpen: true, initialData: template, category: template.category });
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input (like the modal)
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const mod = isMac ? e.metaKey : e.ctrlKey;

      if (mod && e.key.toLowerCase() === 'c') {
        // Only hijack copy when there are items selected and no live text selection.
        const sel = window.getSelection();
        const hasTextSelection = sel ? !sel.isCollapsed : false;
        if (selectedIds.length > 0 && !hasTextSelection) {
          e.preventDefault();
          copy();
        }
      } else if (mod && e.key.toLowerCase() === 'v') {
        if (copiedItems.length > 0) {
          e.preventDefault();
          paste();
        }
      } else if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (mod && e.key.toLowerCase() === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if ((e.key === 'Backspace' || e.key === 'Delete') && selectedIds.length > 0) {
        e.preventDefault();
        handleDeleteItems(selectedIds);
      } else if (!mod && (e.key === 'r' || e.key === 'R' || e.key === ']' || e.key === '[') && selectedIds.length > 0) {
        e.preventDefault();
        const delta = e.key === '[' ? -90 : 90;
        handleUpdateItems(selectedIds.map(id => {
          const it = items.find(i => i.instanceId === id);
          return { id, updates: { rotation: ((it?.rotation || 0) + delta) % 360 } };
        }));
      } else if (e.key === 'Escape') {
        setIsRulerActive(false);
        setSelectedIds([]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [copy, paste, undo, redo, handleDeleteItems, handleUpdateItems, items, selectedIds, copiedItems]);

  const handleToggleRoomOrientation = () => {
    setRoomWidthFt(roomLengthFt);
    setRoomLengthFt(roomWidthFt);
  };

  const handleUpdateRoomSize = (width: number, length: number) => {
    const clamp = (v: number) => Math.min(MAX_ROOM_FT, Math.max(MIN_ROOM_FT, v));
    setRoomWidthFt(clamp(width));
    setRoomLengthFt(clamp(length));
  };

  const handleExportState = useCallback(() => {
    const data = buildLayoutFile({ items, templates: customTemplates, roomWidthFt, roomLengthFt, settings });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `room-layout-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [items, customTemplates, roomWidthFt, roomLengthFt, settings]);

  // Shared loader for both file imports and bundled examples.
  const handleLoadLayout = useCallback((layout: NormalizedLayout) => {
    setCustomTemplates(layout.templates);
    setRoomWidthFt(layout.roomWidthFt);
    setRoomLengthFt(layout.roomLengthFt);
    if (layout.settings) setSettings((prev: typeof DEFAULT_SETTINGS) => ({ ...prev, ...layout.settings }));
    setSelectedIds([]);
    pushState(layout.items);
  }, [pushState]);

  const handleClearData = useCallback(() => {
    const keys = [
      'roomPlanner_historyState', 'roomPlanner_history', 'roomPlanner_historyIndex',
      'roomPlanner_roomWidthFt', 'roomPlanner_roomLengthFt', 'roomPlanner_customTemplates', 'roomPlanner_settings',
    ];
    keys.forEach((k) => { try { localStorage.removeItem(k); } catch (e) {} });
    setHistoryState({ history: [[]], index: 0 });
    setSelectedIds([]);
    setCopiedItems([]);
    setCustomTemplates([]);
    setRoomWidthFt(16);
    setRoomLengthFt(20);
    setSettings({ ...DEFAULT_SETTINGS });
  }, []);

  const handleExport = useCallback(() => {
    const el = document.getElementById('room-canvas-container');
    if (!el) return;
    toPng(el, { cacheBust: true, backgroundColor: '#fcfcfb' })
      .then((dataUrl) => {
        const link = document.createElement('a');
        link.download = 'room-layout.png';
        link.href = dataUrl;
        link.click();
      })
      .catch((err) => {
        console.error('Failed to export image', err);
        alert("Sorry, the layout couldn't be exported as an image. Very large rooms can exceed the browser's image-size limits, so try a smaller room.");
      });
  }, []);

  const selectedItems = items.filter(item => selectedIds.includes(item.instanceId));
  const selectedItem = selectedItems.length === 1 ? selectedItems[0] : null;

  const toolBtn = "p-2 text-ink-soft hover:bg-paneledge disabled:opacity-30 disabled:hover:bg-transparent rounded-md transition-colors";
  const divider = <div className="w-px bg-line my-1 mx-1" />;

  return (
    <div className="flex h-screen bg-ground text-ink overflow-hidden">
      <Palette
        templates={allTemplates}
        onAddItem={handleAddItem}
        onAddTemplate={handleOpenAddModal}
        onEditTemplate={handleOpenEditModal}
        onOpenAbout={() => setIsAboutOpen(true)}
      />

      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Canvas Toolbar */}
        <div className="absolute top-4 left-4 z-30 flex gap-1 bg-panel p-1.5 rounded-lg shadow-[0_4px_20px_-8px_rgba(30,32,50,0.25)] border border-line">
          <button onClick={undo} disabled={historyState.index === 0} className={toolBtn} title="Undo (Cmd/Ctrl + Z)">
            <Undo className="w-4 h-4" />
          </button>
          <button onClick={redo} disabled={historyState.index === historyState.history.length - 1} className={toolBtn} title="Redo (Cmd/Ctrl + Shift + Z)">
            <Redo className="w-4 h-4" />
          </button>
          {divider}
          <button onClick={copy} disabled={selectedIds.length === 0} className={toolBtn} title="Copy (Cmd/Ctrl + C)">
            <Copy className="w-4 h-4" />
          </button>
          <button onClick={paste} disabled={copiedItems.length === 0} className={toolBtn} title="Paste (Cmd/Ctrl + V)">
            <ClipboardPaste className="w-4 h-4" />
          </button>
          {divider}
          <button
            onClick={() => setIsRulerActive(!isRulerActive)}
            className={`p-2 rounded-md transition-colors ${
              isRulerActive
                ? 'text-arcade-strong bg-arcade-tint hover:bg-arcade-tint'
                : 'text-ink-soft hover:bg-paneledge'
            }`}
            title="Ruler Tool"
          >
            <Ruler className="w-4 h-4" />
          </button>
          {divider}
          <button onClick={handleExport} className={toolBtn} title="Export as PNG">
            <Download className="w-4 h-4" />
          </button>
          <button onClick={() => setIsSettingsOpen(true)} className={toolBtn} title="Settings">
            <Settings className="w-4 h-4" />
          </button>

          {selectedIds.length > 1 && (
            <>
              {divider}
              <button onClick={() => handleAlign('left')} className={toolBtn} title="Align Left">
                <AlignStartVertical className="w-4 h-4" />
              </button>
              <button onClick={() => handleAlign('center')} className={toolBtn} title="Align Center">
                <AlignCenterVertical className="w-4 h-4" />
              </button>
              <button onClick={() => handleAlign('right')} className={toolBtn} title="Align Right">
                <AlignEndVertical className="w-4 h-4" />
              </button>
              {divider}
              <button onClick={() => handleAlign('top')} className={toolBtn} title="Align Top">
                <AlignStartHorizontal className="w-4 h-4" />
              </button>
              <button onClick={() => handleAlign('middle')} className={toolBtn} title="Align Middle">
                <AlignCenterHorizontal className="w-4 h-4" />
              </button>
              <button onClick={() => handleAlign('bottom')} className={toolBtn} title="Align Bottom">
                <AlignEndHorizontal className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        <RoomCanvas
          items={items}
          templates={allTemplates}
          selectedIds={selectedIds}
          onSelectItems={setSelectedIds}
          onUpdateItem={handleUpdateItem}
          onUpdateItems={handleUpdateItems}
          onDuplicateItem={handleDuplicateItem}
          onDeleteItem={handleDeleteItem}
          onAddItemAt={handleAddItemAt}
          roomWidthFt={roomWidthFt}
          roomLengthFt={roomLengthFt}
          isRulerActive={isRulerActive}
          settings={settings}
        />
      </div>

      <PropertiesPanel
        templates={allTemplates}
        selectedItem={selectedItem}
        selectedCount={selectedItems.length}
        onUpdateItem={handleUpdateItem}
        onDeleteItem={handleDeleteItem}
        onDeleteSelected={() => handleDeleteItems(selectedIds)}
        onAlign={handleAlign}
        onDistribute={handleDistribute}
        onRotateSelected={handleRotateSelected}
        roomWidthFt={roomWidthFt}
        roomLengthFt={roomLengthFt}
        onUpdateRoomSize={handleUpdateRoomSize}
        onToggleRoomOrientation={handleToggleRoomOrientation}
        settings={settings}
      />

      <TemplateModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
        onSave={handleSaveTemplate}
        initialData={modalState.initialData}
        category={modalState.category}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={(updates) => setSettings(prev => ({ ...prev, ...updates }))}
        onLoadLayout={handleLoadLayout}
        onExportState={handleExportState}
        onClearData={handleClearData}
        examples={examples}
      />

      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
    </div>
  );
}
