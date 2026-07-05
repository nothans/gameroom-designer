import { RoomItem, FurnitureTemplate } from './types';
import { MIN_ROOM_FT, MAX_ROOM_FT } from './constants';

export const LAYOUT_VERSION = 1;

export interface AppSettings {
  snapToGrid: boolean;
  snapSizeInches: number;
  unitSystem: string;
  showDimensions: boolean;
  showGrid: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  snapToGrid: false,
  snapSizeInches: 12,
  unitSystem: 'imperial',
  showDimensions: true,
  showGrid: true,
};

export interface NormalizedLayout {
  items: RoomItem[];
  templates: FurnitureTemplate[];
  roomWidthFt: number;
  roomLengthFt: number;
  settings?: Partial<AppSettings>;
}

/** The on-disk export shape. */
export interface LayoutFile extends NormalizedLayout {
  app: 'gameroom-designer';
  version: number;
  name?: string;
  description?: string;
  exportedAt?: string;
}

const clampFt = (v: number, fallback: number) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(MAX_ROOM_FT, Math.max(MIN_ROOM_FT, n));
};

const uid = () => {
  try { return crypto.randomUUID(); } catch { return `id-${Math.round(performance.now())}-${Math.floor(Math.random() * 1e6)}`; }
};

/** Coerce one raw item into a valid RoomItem, or null if it can't be salvaged. */
function normalizeItem(raw: any): RoomItem | null {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.templateId !== 'string' || !raw.templateId) return null;
  const num = (v: any, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const item: RoomItem = {
    instanceId: typeof raw.instanceId === 'string' && raw.instanceId ? raw.instanceId : uid(),
    templateId: raw.templateId,
    x: num(raw.x, 0),
    y: num(raw.y, 0),
    rotation: num(raw.rotation, 0),
  };
  if (Number.isFinite(Number(raw.overrideWidth))) item.overrideWidth = Number(raw.overrideWidth);
  if (Number.isFinite(Number(raw.overrideHeight))) item.overrideHeight = Number(raw.overrideHeight);
  if (typeof raw.label === 'string' && raw.label.trim()) item.label = raw.label.trim().slice(0, 40);
  return item;
}

function normalizeTemplate(raw: any): FurnitureTemplate | null {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.id !== 'string' || typeof raw.name !== 'string') return null;
  if (!Number.isFinite(Number(raw.widthInches)) || !Number.isFinite(Number(raw.heightInches))) return null;
  const cats = ['arcade', 'furniture', 'decor', 'storage', 'structural'];
  return {
    id: raw.id,
    name: raw.name,
    widthInches: Number(raw.widthInches),
    heightInches: Number(raw.heightInches),
    color: typeof raw.color === 'string' ? raw.color : '#64748b',
    category: cats.includes(raw.category) ? raw.category : 'furniture',
    isCustom: true,
    isResizable: !!raw.isResizable,
    pattern: typeof raw.pattern === 'string' ? raw.pattern : undefined,
  };
}

/**
 * Validate and normalize an arbitrary parsed JSON object into a layout.
 * Throws Error with a human-readable message when the payload isn't a layout at all.
 */
export function normalizeLayout(raw: any): NormalizedLayout {
  if (!raw || typeof raw !== 'object') {
    throw new Error('This file is not a Gameroom Designer layout.');
  }
  if (!Array.isArray(raw.items)) {
    throw new Error('This file has no "items" list, so it may not be a room layout.');
  }
  const items = raw.items.map(normalizeItem).filter((x: RoomItem | null): x is RoomItem => x !== null);
  const templates = Array.isArray(raw.templates)
    ? raw.templates.map(normalizeTemplate).filter((x: FurnitureTemplate | null): x is FurnitureTemplate => x !== null)
    : [];

  const settings = raw.settings && typeof raw.settings === 'object'
    ? {
        ...(typeof raw.settings.snapToGrid === 'boolean' ? { snapToGrid: raw.settings.snapToGrid } : {}),
        ...(Number.isFinite(Number(raw.settings.snapSizeInches)) ? { snapSizeInches: Number(raw.settings.snapSizeInches) } : {}),
        ...(raw.settings.unitSystem === 'metric' || raw.settings.unitSystem === 'imperial' ? { unitSystem: raw.settings.unitSystem } : {}),
        ...(typeof raw.settings.showDimensions === 'boolean' ? { showDimensions: raw.settings.showDimensions } : {}),
        ...(typeof raw.settings.showGrid === 'boolean' ? { showGrid: raw.settings.showGrid } : {}),
      }
    : undefined;

  return {
    items,
    templates,
    roomWidthFt: clampFt(raw.roomWidthFt, 16),
    roomLengthFt: clampFt(raw.roomLengthFt, 20),
    settings,
  };
}

/** Build the export payload from current app state. */
export function buildLayoutFile(state: {
  items: RoomItem[];
  templates: FurnitureTemplate[];
  roomWidthFt: number;
  roomLengthFt: number;
  settings: AppSettings;
}): LayoutFile {
  return {
    app: 'gameroom-designer',
    version: LAYOUT_VERSION,
    exportedAt: new Date().toISOString(),
    roomWidthFt: state.roomWidthFt,
    roomLengthFt: state.roomLengthFt,
    settings: state.settings,
    templates: state.templates,
    items: state.items,
  };
}
