import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { RotateCcw, RotateCw, ZoomIn, ZoomOut, Maximize, Copy, Trash2 } from 'lucide-react';
import { RoomItem, FurnitureTemplate } from '../types';
import { PX_PER_INCH } from '../constants';
import { DRAG_MIME } from './Palette';

interface RoomCanvasProps {
  items: RoomItem[];
  templates: FurnitureTemplate[];
  selectedIds: string[];
  onSelectItems: (ids: string[]) => void;
  onUpdateItem: (id: string, updates: Partial<RoomItem>) => void;
  onUpdateItems: (updates: {id: string, updates: Partial<RoomItem>}[]) => void;
  onDuplicateItem?: (id: string) => void;
  onDeleteItem?: (id: string) => void;
  onAddItemAt?: (templateId: string, x: number, y: number) => void;
  roomWidthFt: number;
  roomLengthFt: number;
  isRulerActive: boolean;
  settings?: {
    snapToGrid: boolean;
    snapSizeInches: number;
    unitSystem: string;
    showDimensions?: boolean;
    showGrid?: boolean;
  };
}

const ZOOM_MIN = 0.15;
const ZOOM_MAX = 4;
const MINIMAP_MAX = 168;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const hexToRgba = (hex: string, a: number) => {
  const m = hex.replace('#', '');
  const n = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return hex;
  return `rgba(${r},${g},${b},${a})`;
};

export function RoomCanvas({
  items,
  templates,
  selectedIds,
  onSelectItems,
  onUpdateItem,
  onUpdateItems,
  onDuplicateItem,
  onDeleteItem,
  onAddItemAt,
  roomWidthFt,
  roomLengthFt,
  isRulerActive,
  settings = { snapToGrid: false, snapSizeInches: 12, unitSystem: 'imperial', showDimensions: true, showGrid: true }
}: RoomCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLDivElement>(null);
  // Pointer position (screen) at drag start. framer's info.offset is reported in the element's
  // rotated local frame, so for rotated blocks we derive the true screen delta from info.point instead.
  const dragStartPoint = useRef<{ x: number; y: number } | null>(null);

  const [selectionBox, setSelectionBox] = useState<{ startX: number, startY: number, endX: number, endY: number } | null>(null);
  const [rulerPoints, setRulerPoints] = useState<{ startX: number, startY: number, endX: number, endY: number } | null>(null);
  const [resizePreview, setResizePreview] = useState<{ id: string, w: number, h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  // Visible region over the room, in base (unzoomed) pixels — drives the minimap viewport rectangle.
  const [view, setView] = useState({ x: 0, y: 0, w: 0, h: 0 });

  const showDimensions = settings.showDimensions !== false;
  const showGrid = settings.showGrid !== false;

  const baseW = roomWidthFt * 12 * PX_PER_INCH;
  const baseH = roomLengthFt * 12 * PX_PER_INCH;
  const scaledW = baseW * zoom;
  const scaledH = baseH * zoom;

  // Effective axis-aligned bounding box for an item (base px), accounting for 90°/270° rotation about its center.
  const itemAABB = (item: RoomItem, template: FurnitureTemplate) => {
    const wU = (item.overrideWidth || template.widthInches) * PX_PER_INCH;
    const hU = (item.overrideHeight || template.heightInches) * PX_PER_INCH;
    const rot = (((item.rotation || 0) % 360) + 360) % 360;
    const rotated = rot === 90 || rot === 270;
    const ew = rotated ? hU : wU;
    const eh = rotated ? wU : hU;
    return { left: item.x + (wU - ew) / 2, top: item.y + (hU - eh) / 2, ew, eh };
  };

  // Convert a client (screen) point to room base pixels.
  const toRoom = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const lz = rect.width / baseW || 1;
    return { x: (clientX - rect.left) / lz, y: (clientY - rect.top) / lz };
  };

  // --- Viewport / minimap sync -------------------------------------------------
  const updateView = useCallback(() => {
    const cont = containerRef.current, s = scrollRef.current;
    if (!cont || !s) return;
    const cr = cont.getBoundingClientRect();
    const sr = s.getBoundingClientRect();
    const lz = cr.width / baseW || 1;
    const vx = clamp((sr.left - cr.left) / lz, 0, baseW);
    const vy = clamp((sr.top - cr.top) / lz, 0, baseH);
    const vw = clamp(s.clientWidth / lz, 0, baseW - vx);
    const vh = clamp(s.clientHeight / lz, 0, baseH - vy);
    setView({ x: vx, y: vy, w: vw, h: vh });
  }, [baseW, baseH]);

  // Re-scroll so a given client point maps onto a fixed room point after a zoom change.
  const zoomToClientPoint = useCallback((next: number, clientX: number, clientY: number) => {
    const cont = containerRef.current, s = scrollRef.current;
    const z = clamp(next, ZOOM_MIN, ZOOM_MAX);
    if (!cont || !s) { setZoom(z); return; }
    const oldRect = cont.getBoundingClientRect();
    const lz = oldRect.width / baseW || 1;
    const baseX = (clientX - oldRect.left) / lz;
    const baseY = (clientY - oldRect.top) / lz;
    setZoom(z);
    requestAnimationFrame(() => {
      const c2 = containerRef.current, s2 = scrollRef.current;
      if (!c2 || !s2) return;
      const nr = c2.getBoundingClientRect();
      s2.scrollLeft += nr.left - (clientX - baseX * z);
      s2.scrollTop += nr.top - (clientY - baseY * z);
      updateView();
    });
  }, [baseW, updateView]);

  const zoomBy = useCallback((factor: number) => {
    const s = scrollRef.current;
    if (!s) { setZoom((z) => clamp(z * factor, ZOOM_MIN, ZOOM_MAX)); return; }
    const sr = s.getBoundingClientRect();
    zoomToClientPoint(zoom * factor, sr.left + s.clientWidth / 2, sr.top + s.clientHeight / 2);
  }, [zoom, zoomToClientPoint]);

  const centerOnBase = useCallback((bx: number, by: number) => {
    const cont = containerRef.current, s = scrollRef.current;
    if (!cont || !s) return;
    const cr = cont.getBoundingClientRect();
    const sr = s.getBoundingClientRect();
    const lz = cr.width / baseW || 1;
    s.scrollLeft += cr.left - (sr.left + s.clientWidth / 2 - bx * lz);
    s.scrollTop += cr.top - (sr.top + s.clientHeight / 2 - by * lz);
    updateView();
  }, [baseW, updateView]);

  const fitToScreen = useCallback(() => {
    const s = scrollRef.current;
    if (!s) return;
    const pad = 56;
    const z = clamp(Math.min((s.clientWidth - pad) / baseW, (s.clientHeight - pad) / baseH), ZOOM_MIN, ZOOM_MAX);
    setZoom(z);
    requestAnimationFrame(() => {
      centerOnBase(baseW / 2, baseH / 2);
    });
  }, [baseW, baseH, centerOnBase]);

  // Fit once on mount.
  useEffect(() => {
    const id = requestAnimationFrame(() => fitToScreen());
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ctrl/Cmd + wheel to zoom (non-passive so we can preventDefault).
  useEffect(() => {
    const s = scrollRef.current;
    if (!s) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.0015);
      zoomToClientPoint(zoom * factor, e.clientX, e.clientY);
    };
    s.addEventListener('wheel', onWheel, { passive: false });
    return () => s.removeEventListener('wheel', onWheel);
  }, [zoom, zoomToClientPoint]);

  // Keep the minimap viewport rect in sync with the container size.
  useEffect(() => {
    updateView();
    const ro = new ResizeObserver(() => updateView());
    if (scrollRef.current) ro.observe(scrollRef.current);
    return () => ro.disconnect();
  }, [updateView, zoom, roomWidthFt, roomLengthFt]);

  // --- Selection / ruler pointer handling (room base px) -----------------------
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const p = toRoom(e.clientX, e.clientY);
    if (isRulerActive) {
      setRulerPoints({ startX: p.x, startY: p.y, endX: p.x, endY: p.y });
      return;
    }
    if ((e.target as HTMLElement).closest('.room-item') || (e.target as HTMLElement).closest('.canvas-overlay')) {
      return;
    }
    setSelectionBox({ startX: p.x, startY: p.y, endX: p.x, endY: p.y });
    onSelectItems([]);
  };

  const formatDimension = (inches: number) => {
    if (settings.unitSystem === 'metric') {
      const cm = Math.round(inches * 2.54);
      return cm >= 100 ? `${(cm / 100).toFixed(2)}m` : `${cm}cm`;
    }
    return `${inches}"`;
  };

  const formatRoomDim = (ft: number) => {
    if (settings.unitSystem === 'metric') return `${(ft * 0.3048).toFixed(2)}m`;
    return `${ft}'`;
  };

  const formatRuler = (inches: number) => {
    if (settings.unitSystem === 'metric') {
      const cm = Math.round(inches * 2.54);
      return cm >= 100 ? `${(cm / 100).toFixed(2)}m` : `${cm}cm`;
    }
    const ft = Math.floor(inches / 12);
    const remInches = Math.round(inches % 12);
    return ft > 0 ? `${ft}' ${remInches}"` : `${remInches}"`;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isRulerActive && rulerPoints) {
      if (e.buttons === 1) {
        const p = toRoom(e.clientX, e.clientY);
        setRulerPoints((prev) => prev ? { ...prev, endX: clamp(p.x, 0, baseW), endY: clamp(p.y, 0, baseH) } : null);
      }
      return;
    }
    if (selectionBox) {
      const p = toRoom(e.clientX, e.clientY);
      setSelectionBox((prev) => prev ? { ...prev, endX: clamp(p.x, 0, baseW), endY: clamp(p.y, 0, baseH) } : null);
    }
  };

  const handlePointerUp = useCallback(() => {
    if (selectionBox) {
      const boxLeft = Math.min(selectionBox.startX, selectionBox.endX);
      const boxRight = Math.max(selectionBox.startX, selectionBox.endX);
      const boxTop = Math.min(selectionBox.startY, selectionBox.endY);
      const boxBottom = Math.max(selectionBox.startY, selectionBox.endY);

      if (boxRight - boxLeft > 4 || boxBottom - boxTop > 4) {
        const ids = items.filter((item) => {
          const template = templates.find((t) => t.id === item.templateId);
          if (!template) return false;
          const { left, top, ew, eh } = itemAABB(item, template);
          return !(left > boxRight || left + ew < boxLeft || top > boxBottom || top + eh < boxTop);
        }).map((i) => i.instanceId);
        onSelectItems(ids);
      }
      setSelectionBox(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionBox, items, templates, onSelectItems]);

  useEffect(() => {
    if (selectionBox) {
      window.addEventListener('pointerup', handlePointerUp);
      return () => window.removeEventListener('pointerup', handlePointerUp);
    }
  }, [selectionBox, handlePointerUp]);

  useEffect(() => {
    if (!isRulerActive) setRulerPoints(null);
  }, [isRulerActive]);

  // --- Grid --------------------------------------------------------------------
  const halfFootPx = 6 * PX_PER_INCH * zoom;
  const fullFootPx = 12 * PX_PER_INCH * zoom;
  const gridSvg = encodeURIComponent(`
    <svg width="${fullFootPx}" height="${fullFootPx}" xmlns="http://www.w3.org/2000/svg">
      <path d="M ${halfFootPx} 0 L ${halfFootPx} ${fullFootPx} M 0 ${halfFootPx} L ${fullFootPx} ${halfFootPx}" stroke="rgba(28,30,38,0.07)" stroke-width="1" stroke-dasharray="4,4" fill="none" />
      <path d="M 0 0 L 0 ${fullFootPx} M 0 0 L ${fullFootPx} 0" stroke="rgba(28,30,38,0.12)" stroke-width="1" fill="none" />
    </svg>
  `);
  const gridStyle = showGrid ? {
    backgroundImage: `url("data:image/svg+xml;utf8,${gridSvg}")`,
    backgroundSize: `${fullFootPx}px ${fullFootPx}px`,
  } : {};

  // --- Minimap geometry --------------------------------------------------------
  const miniScale = baseW >= baseH ? MINIMAP_MAX / baseW : MINIMAP_MAX / baseH;
  const miniW = baseW * miniScale;
  const miniH = baseH * miniScale;

  const handleMinimapPan = (clientX: number, clientY: number) => {
    const rect = minimapRef.current?.getBoundingClientRect();
    if (!rect) return;
    centerOnBase((clientX - rect.left) / miniScale, (clientY - rect.top) / miniScale);
  };

  // --- Floating rotate menu for a single selection -----------------------------
  const selectedItem = selectedIds.length === 1 ? items.find((i) => i.instanceId === selectedIds[0]) : null;
  const selectedTemplate = selectedItem ? templates.find((t) => t.id === selectedItem.templateId) : null;
  const menuAABB = selectedItem && selectedTemplate ? itemAABB(selectedItem, selectedTemplate) : null;
  const showMenu = !!menuAABB && !dragging && !resizePreview && !selectionBox && !isRulerActive;
  const menuAboveTop = menuAABB ? menuAABB.top * zoom : 0;
  const menuBelow = menuAboveTop < 52; // flip under the block if it's near the top edge

  // Resize handle for a single selected resizable item. Rendered as a sibling OUTSIDE the draggable
  // motion.div (framer uses native pointer listeners, so a handle inside the block can't stop a drag
  // from starting). Positioned at the block's visible bounding-box bottom-right corner.
  const selResizing = resizePreview?.id === selectedItem?.instanceId;
  const showResize = !!selectedItem && !!selectedTemplate?.isResizable && !isRulerActive && !dragging;
  let resizeHandle: { left: number; top: number } | null = null;
  if (showResize && selectedItem && selectedTemplate) {
    const sw = selResizing ? resizePreview!.w : (selectedItem.overrideWidth || selectedTemplate.widthInches) * PX_PER_INCH;
    const sh = selResizing ? resizePreview!.h : (selectedItem.overrideHeight || selectedTemplate.heightInches) * PX_PER_INCH;
    const rotS = (((selectedItem.rotation || 0) % 360) + 360) % 360;
    const rotatedS = rotS === 90 || rotS === 270;
    const ewS = rotatedS ? sh : sw;
    const ehS = rotatedS ? sw : sh;
    const aabbLeft = selectedItem.x + (sw - ewS) / 2;
    const aabbTop = selectedItem.y + (sh - ehS) / 2;
    resizeHandle = { left: (aabbLeft + ewS) * zoom, top: (aabbTop + ehS) * zoom };
  }

  return (
    <div className="flex-1 relative bg-ground overflow-hidden">
      <div
        ref={scrollRef}
        onScroll={updateView}
        onDragOver={(e) => {
          if (!onAddItemAt || !e.dataTransfer.types.includes(DRAG_MIME)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          if (!dropActive) setDropActive(true);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDropActive(false);
        }}
        onDrop={(e) => {
          setDropActive(false);
          const id = e.dataTransfer.getData(DRAG_MIME);
          if (!id || !onAddItemAt) return;
          e.preventDefault();
          const p = toRoom(e.clientX, e.clientY);
          onAddItemAt(id, p.x, p.y);
        }}
        className="absolute inset-0 overflow-auto"
      >
        <div className="min-w-full min-h-full flex items-center justify-center p-14">
          <div
            id="room-canvas-container"
            ref={containerRef}
            className={`relative bg-paper border rounded-sm shadow-[0_10px_40px_-12px_rgba(30,32,50,0.18)] touch-none shrink-0 transition-shadow ${dropActive ? 'border-arcade ring-2 ring-arcade/40' : 'border-line'}`}
            style={{ width: scaledW, height: scaledH, ...gridStyle }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
          >
            {/* Empty-room hint */}
            {items.length === 0 && !selectionBox && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center text-muted px-6">
                  <p className="text-sm font-medium">Your room is empty</p>
                  <p className="text-xs mt-1">Pick an item from the Library to start your layout.</p>
                </div>
              </div>
            )}

            {/* Selection Box */}
            {selectionBox && (
              <div
                className="absolute border border-blue-500 bg-blue-500/20 z-50 pointer-events-none"
                style={{
                  left: Math.min(selectionBox.startX, selectionBox.endX) * zoom,
                  top: Math.min(selectionBox.startY, selectionBox.endY) * zoom,
                  width: Math.abs(selectionBox.endX - selectionBox.startX) * zoom,
                  height: Math.abs(selectionBox.endY - selectionBox.startY) * zoom,
                }}
              />
            )}

            {/* Room Dimension Labels */}
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-muted font-mono text-sm tracking-widest">
              {formatRoomDim(roomWidthFt)}
            </div>
            <div className="absolute -left-8 top-1/2 -translate-y-1/2 -rotate-90 text-muted font-mono text-sm tracking-widest">
              {formatRoomDim(roomLengthFt)}
            </div>

            {/* Ruler */}
            {rulerPoints && (
              <svg className="absolute inset-0 pointer-events-none z-50 overflow-visible" width={scaledW} height={scaledH}>
                <line
                  x1={rulerPoints.startX * zoom} y1={rulerPoints.startY * zoom}
                  x2={rulerPoints.endX * zoom} y2={rulerPoints.endY * zoom}
                  stroke="#3b82f6" strokeWidth="2" strokeDasharray="4,4"
                />
                <circle cx={rulerPoints.startX * zoom} cy={rulerPoints.startY * zoom} r="4" fill="#3b82f6" />
                <circle cx={rulerPoints.endX * zoom} cy={rulerPoints.endY * zoom} r="4" fill="#3b82f6" />
                {(() => {
                  const dx = (rulerPoints.endX - rulerPoints.startX);
                  const dy = (rulerPoints.endY - rulerPoints.startY);
                  const distInches = Math.sqrt(dx * dx + dy * dy) / PX_PER_INCH;
                  const midX = (rulerPoints.startX + rulerPoints.endX) / 2 * zoom;
                  const midY = (rulerPoints.startY + rulerPoints.endY) / 2 * zoom;
                  let angle = Math.atan2(dy, dx) * 180 / Math.PI;
                  if (angle > 90 || angle < -90) angle += 180;
                  return (
                    <g transform={`translate(${midX}, ${midY}) rotate(${angle})`}>
                      <rect x="-35" y="-22" width="70" height="20" fill="white" rx="4" stroke="#3b82f6" strokeWidth="1" />
                      <text x="0" y="-8" textAnchor="middle" fill="#1d4ed8" fontSize="11" fontWeight="bold" fontFamily="monospace">
                        {formatRuler(distInches)}
                      </text>
                    </g>
                  );
                })()}
              </svg>
            )}

            {items.map((item) => {
              const template = templates.find((t) => t.id === item.templateId);
              if (!template) return null;

              const isSelected = selectedIds.includes(item.instanceId);
              const isResizing = resizePreview?.id === item.instanceId;
              const w = isResizing ? resizePreview!.w : (item.overrideWidth || template.widthInches) * PX_PER_INCH;
              const h = isResizing ? resizePreview!.h : (item.overrideHeight || template.heightInches) * PX_PER_INCH;

              const isZone = template.pattern === 'zone' || template.pattern === 'zone-circle';
              const isCircle = template.pattern === 'zone-circle';
              const isHashed = template.pattern === 'hashed';

              // Rotations are 90° steps, so a rotated block is just its footprint with width/height
              // swapped. Render it at those effective dims WITHOUT a CSS rotate — framer-motion drags a
              // rotated element in its rotated local frame, which makes it jump on drop. Position the
              // (unrotated) element at the footprint's bounding-box top-left instead.
              const rot = (((item.rotation || 0) % 360) + 360) % 360;
              const rotated = rot === 90 || rot === 270;
              const ew = rotated ? h : w;
              const eh = rotated ? w : h;
              const offX = (w - ew) / 2;
              const offY = (h - eh) / 2;
              const rW = ew * zoom;
              const rH = eh * zoom;
              const showName = rW >= 40 && rH >= 22;
              const showDims = showDimensions && rW >= 58 && rH >= 40;
              const smallFont = rW < 82;
              const tiny = !showName;

              return (
                <motion.div
                  key={item.instanceId}
                  className={`room-item group absolute flex flex-col items-center justify-center ${isCircle ? 'rounded-full' : 'rounded-sm'} select-none ${isZone ? '' : 'shadow-md'} ${
                    isSelected
                      ? 'ring-2 ring-blue-500 ring-offset-2 z-10'
                      : 'hover:ring-2 hover:ring-ink/15 z-0'
                  } ${isRulerActive ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
                  drag={!isRulerActive && !isResizing}
                  dragMomentum={false}
                  dragConstraints={containerRef}
                  onDragStart={(_e, info) => { setDragging(true); dragStartPoint.current = { x: info.point.x, y: info.point.y }; }}
                  animate={{ x: (item.x + offX) * zoom, y: (item.y + offY) * zoom }}
                  transition={{ x: { duration: 0 }, y: { duration: 0 } }}
                  initial={false}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    if (isRulerActive) {
                      const p = toRoom(e.clientX, e.clientY);
                      setRulerPoints({ startX: p.x, startY: p.y, endX: p.x, endY: p.y });
                      return;
                    }
                    if (e.shiftKey) {
                      onSelectItems(isSelected ? selectedIds.filter((id) => id !== item.instanceId) : [...selectedIds, item.instanceId]);
                    } else if (!isSelected) {
                      onSelectItems([item.instanceId]);
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onDragEnd={(e, info) => {
                    setDragging(false);
                    const snapPx = settings.snapToGrid ? settings.snapSizeInches * PX_PER_INCH : null;
                    // True screen delta from the pointer (rotation-independent), not framer's local-frame offset.
                    const sp = dragStartPoint.current;
                    const dx = (sp ? info.point.x - sp.x : info.offset.x) / zoom;
                    const dy = (sp ? info.point.y - sp.y : info.offset.y) / zoom;
                    dragStartPoint.current = null;

                    if (isSelected && selectedIds.length > 1) {
                      let draggedX = item.x + dx;
                      let draggedY = item.y + dy;
                      if (snapPx) {
                        draggedX = Math.round(draggedX / snapPx) * snapPx;
                        draggedY = Math.round(draggedY / snapPx) * snapPx;
                      }
                      const deltaX = draggedX - item.x;
                      const deltaY = draggedY - item.y;
                      const updates = selectedIds.map((id) => {
                        const sel = items.find((i) => i.instanceId === id);
                        return { id, updates: { x: (sel?.x || 0) + deltaX, y: (sel?.y || 0) + deltaY } };
                      });
                      onUpdateItems(updates);
                    } else {
                      let newX = item.x + dx;
                      let newY = item.y + dy;
                      if (snapPx) {
                        // Snap the block's VISIBLE bounding-box top-left to the grid (offX/offY account
                        // for a rotated footprint), not the invisible unrotated corner.
                        newX = Math.round((newX + offX) / snapPx) * snapPx - offX;
                        newY = Math.round((newY + offY) / snapPx) * snapPx - offY;
                      }
                      onUpdateItem(item.instanceId, { x: newX, y: newY });
                    }
                  }}
                  style={{
                    width: ew * zoom,
                    height: eh * zoom,
                    backgroundColor: isZone ? hexToRgba(template.color, 0.14) : (template.pattern ? 'transparent' : template.color),
                    backgroundImage: isHashed ? `repeating-linear-gradient(45deg, ${template.color}, ${template.color} 10px, rgba(0,0,0,0.1) 10px, rgba(0,0,0,0.1) 20px)` : 'none',
                    top: 0,
                    left: 0,
                    transformOrigin: 'center center',
                  }}
                >
                  {/* Dashed outline for a clearance zone (a marked floor area, not a solid object). */}
                  {isZone && (
                    <div
                      className={`absolute inset-0 border-2 border-dashed pointer-events-none ${isCircle ? 'rounded-full' : 'rounded-sm'}`}
                      style={{ borderColor: hexToRgba(template.color, 0.85) }}
                    />
                  )}

                  {/* Inline label: name over a "W × L" caption, sized to the block; hidden when the block is tiny. */}
                  {showName && (
                    <div className="relative z-10 flex flex-col items-center justify-center gap-0.5 pointer-events-none px-1.5 max-w-full">
                      <span className={`max-w-full font-semibold leading-tight tracking-tight text-center break-words rounded px-1.5 py-0.5 ${smallFont ? 'text-[8px]' : 'text-[10px]'} ${isZone ? 'text-sky-900 bg-white/70' : 'text-white bg-slate-900/70'}`}>
                        {item.label || template.name}
                      </span>
                      {showDims && (
                        <span className={`font-mono font-medium leading-tight whitespace-nowrap rounded-sm px-1 text-[9px] ${isZone ? 'text-sky-900/80 bg-white/50' : 'text-white/90 bg-black/25'}`}>
                          {formatDimension(item.overrideWidth || template.widthInches)} × {formatDimension(item.overrideHeight || template.heightInches)}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Tiny block: reveal the name as a floating chip on hover or when selected. */}
                  {tiny && (
                    <div
                      className={`absolute left-1/2 bottom-full mb-1 -translate-x-1/2 z-30 pointer-events-none ${isSelected ? 'block' : 'hidden group-hover:block'}`}
                    >
                      <span className="text-[10px] font-semibold text-white bg-slate-900/85 px-1.5 py-0.5 rounded whitespace-nowrap shadow-sm">
                        {item.label || template.name}
                      </span>
                    </div>
                  )}

                </motion.div>
              );
            })}

            {/* Floating rotate menu, anchored above (or below) the selected block. */}
            {showMenu && menuAABB && selectedItem && (
              <div
                className="canvas-overlay absolute z-40 flex items-center gap-0.5 bg-panel border border-line rounded-lg shadow-[0_6px_20px_-6px_rgba(20,22,40,0.35)] p-1"
                style={{
                  left: (menuAABB.left + menuAABB.ew / 2) * zoom,
                  top: menuBelow ? (menuAABB.top + menuAABB.eh) * zoom + 8 : menuAboveTop - 8,
                  transform: menuBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <button
                  className="p-1.5 rounded-md text-ink-soft hover:bg-paneledge transition-colors"
                  title="Rotate -90°"
                  onClick={() => onUpdateItem(selectedItem.instanceId, { rotation: (selectedItem.rotation - 90) % 360 })}
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  className="p-1.5 rounded-md text-ink-soft hover:bg-paneledge transition-colors"
                  title="Rotate +90°"
                  onClick={() => onUpdateItem(selectedItem.instanceId, { rotation: (selectedItem.rotation + 90) % 360 })}
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                {onDuplicateItem && (
                  <button
                    className="p-1.5 rounded-md text-ink-soft hover:bg-paneledge transition-colors"
                    title="Duplicate"
                    onClick={() => onDuplicateItem(selectedItem.instanceId)}
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                )}
                {onDeleteItem && (
                  <>
                    <div className="w-px self-stretch bg-line mx-0.5" />
                    <button
                      className="p-1.5 rounded-md text-red-500 hover:bg-red-50 transition-colors"
                      title="Remove (Delete)"
                      onClick={() => onDeleteItem(selectedItem.instanceId)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Resize handle (sibling of the blocks so framer never hijacks the drag). */}
            {resizeHandle && selectedItem && selectedTemplate && (
              <div
                className="canvas-overlay absolute w-4 h-4 -ml-2 -mt-2 bg-white border-2 border-blue-500 rounded-full cursor-se-resize z-40 hover:scale-110 transition-transform"
                style={{ left: resizeHandle.left, top: resizeHandle.top }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  const id = selectedItem.instanceId;
                  const startX = e.clientX;
                  const startY = e.clientY;
                  const startW = (selectedItem.overrideWidth || selectedTemplate.widthInches) * PX_PER_INCH;
                  const startH = (selectedItem.overrideHeight || selectedTemplate.heightInches) * PX_PER_INCH;
                  let lastW = startW;
                  let lastH = startH;
                  const onMove = (m: PointerEvent) => {
                    lastW = Math.max(20, startW + (m.clientX - startX) / zoom);
                    lastH = Math.max(20, startH + (m.clientY - startY) / zoom);
                    setResizePreview({ id, w: lastW, h: lastH });
                  };
                  const onUp = () => {
                    window.removeEventListener('pointermove', onMove);
                    window.removeEventListener('pointerup', onUp);
                    setResizePreview(null);
                    onUpdateItem(id, {
                      overrideWidth: Math.round(lastW / PX_PER_INCH),
                      overrideHeight: Math.round(lastH / PX_PER_INCH),
                    });
                  };
                  window.addEventListener('pointermove', onMove);
                  window.addEventListener('pointerup', onUp);
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Zoom controls (bottom-right of the canvas) */}
      <div className="canvas-overlay absolute bottom-4 right-4 z-30 flex items-center gap-1 bg-panel border border-line rounded-lg shadow-[0_4px_20px_-8px_rgba(30,32,50,0.25)] p-1">
        <button onClick={() => zoomBy(1 / 1.2)} className="p-2 rounded-md text-ink-soft hover:bg-paneledge transition-colors" title="Zoom out">
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={() => zoomToClientPoint(1, (scrollRef.current?.getBoundingClientRect().left ?? 0) + (scrollRef.current?.clientWidth ?? 0) / 2, (scrollRef.current?.getBoundingClientRect().top ?? 0) + (scrollRef.current?.clientHeight ?? 0) / 2)}
          className="min-w-[3rem] px-1 text-xs font-mono font-medium text-ink-soft hover:bg-paneledge rounded-md py-2 transition-colors"
          title="Reset to 100%"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button onClick={() => zoomBy(1.2)} className="p-2 rounded-md text-ink-soft hover:bg-paneledge transition-colors" title="Zoom in">
          <ZoomIn className="w-4 h-4" />
        </button>
        <div className="w-px self-stretch bg-line mx-0.5" />
        <button onClick={fitToScreen} className="p-2 rounded-md text-ink-soft hover:bg-paneledge transition-colors" title="Fit to screen">
          <Maximize className="w-4 h-4" />
        </button>
      </div>

      {/* Overview minimap (bottom-left) */}
      {items.length > 0 && (
        <div className="canvas-overlay absolute bottom-4 left-4 z-30 bg-[#171a24] border border-black/40 rounded-lg shadow-[0_6px_20px_-6px_rgba(0,0,0,0.5)] p-1.5">
          <div
            ref={minimapRef}
            className="relative cursor-pointer"
            style={{ width: miniW, height: miniH }}
            onPointerDown={(e) => { e.preventDefault(); handleMinimapPan(e.clientX, e.clientY); }}
            onPointerMove={(e) => { if (e.buttons === 1) handleMinimapPan(e.clientX, e.clientY); }}
          >
            {/* room floor */}
            <div className="absolute inset-0 rounded-sm bg-white/5 border border-white/10" />
            {items.map((item) => {
              const template = templates.find((t) => t.id === item.templateId);
              if (!template) return null;
              const { left, top, ew, eh } = itemAABB(item, template);
              const isZone = template.pattern === 'zone' || template.pattern === 'zone-circle';
              const isCircle = template.pattern === 'zone-circle';
              return (
                <div
                  key={item.instanceId}
                  className={`absolute ${isCircle ? 'rounded-full' : 'rounded-[1px]'} ${isZone ? 'border border-dashed' : ''}`}
                  style={{
                    left: left * miniScale,
                    top: top * miniScale,
                    width: Math.max(2, ew * miniScale),
                    height: Math.max(2, eh * miniScale),
                    backgroundColor: isZone ? 'transparent' : template.color,
                    borderColor: isZone ? hexToRgba(template.color, 0.9) : undefined,
                    opacity: selectedIds.includes(item.instanceId) ? 1 : 0.85,
                    outline: selectedIds.includes(item.instanceId) ? '1px solid #60a5fa' : 'none',
                  }}
                />
              );
            })}
            {/* viewport rectangle */}
            <div
              className="absolute border border-sky-400/90 bg-sky-400/10 pointer-events-none rounded-[1px]"
              style={{
                left: view.x * miniScale,
                top: view.y * miniScale,
                width: view.w * miniScale,
                height: view.h * miniScale,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
