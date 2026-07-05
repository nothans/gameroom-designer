export interface FurnitureTemplate {
  id: string;
  name: string;
  widthInches: number;
  heightInches: number;
  color: string;
  category: 'arcade' | 'furniture' | 'decor' | 'storage' | 'structural';
  isCustom?: boolean;
  isResizable?: boolean;
  pattern?: string;
}

export interface RoomItem {
  instanceId: string;
  templateId: string;
  x: number;
  y: number;
  rotation: number;
  overrideWidth?: number;
  overrideHeight?: number;
  /** Optional per-instance label shown on the block (e.g. a specific game title). */
  label?: string;
}
