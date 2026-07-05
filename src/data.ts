import { FurnitureTemplate } from './types';

// Sizes are approximate real-world footprints in inches (width x depth, top-down).
// Pinball/arcade numbers include side rails/armor where relevant; treat them as planning
// estimates, not exact specs. Existing IDs are kept stable so saved layouts still resolve.
export const templates: FurnitureTemplate[] = [
  // --- Pinball (amber/orange family) ---
  // Standard body (Stern/Williams/Bally): ~27" wide with armor, ~55" deep.
  { id: 'pinball', name: 'Pinball (Stern)', widthInches: 27, heightInches: 55, color: '#f59e0b', category: 'arcade' },
  // JJP and modern widebodies run a couple inches wider.
  { id: 'pinball-jjp', name: 'Pinball (JJP Widebody)', widthInches: 29, heightInches: 55, color: '#d97706', category: 'arcade' },
  // Atari's late-70s widebodies (Superman, Space Riders, Middle Earth).
  { id: 'pinball-atari', name: 'Pinball (Atari Widebody)', widthInches: 28, heightInches: 54, color: '#b45309', category: 'arcade' },
  // Generic widebody.
  { id: 'pinball-wide', name: 'Pinball (Widebody)', widthInches: 30, heightInches: 55, color: '#ea580c', category: 'arcade' },

  // --- Arcade cabinets (purple family) ---
  { id: 'arcade-classic', name: 'Arcade (Upright)', widthInches: 26, heightInches: 33, color: '#8b5cf6', category: 'arcade' },
  { id: 'arcade-cocktail', name: 'Arcade (Cocktail)', widthInches: 24, heightInches: 38, color: '#a855f7', category: 'arcade' },
  { id: 'arcade-cabaret', name: 'Arcade (Cabaret)', widthInches: 20, heightInches: 26, color: '#7c3aed', category: 'arcade' },
  { id: 'arcade-racer', name: 'Arcade (Sit-Down Racer)', widthInches: 32, heightInches: 60, color: '#6d28d9', category: 'arcade' },

  // --- Game tables & other machines ---
  { id: 'darts', name: 'Dartboard Area', widthInches: 36, heightInches: 24, color: '#ef4444', category: 'arcade' },
  { id: 'pool-table', name: 'Pool Table (8ft)', widthInches: 54, heightInches: 100, color: '#10b981', category: 'arcade' },
  { id: 'air-hockey', name: 'Air Hockey (7ft)', widthInches: 84, heightInches: 48, color: '#06b6d4', category: 'arcade' },
  { id: 'foosball', name: 'Foosball Table', widthInches: 56, heightInches: 30, color: '#0891b2', category: 'arcade' },
  { id: 'ping-pong', name: 'Ping Pong Table', widthInches: 108, heightInches: 60, color: '#0e7490', category: 'arcade' },
  { id: 'shuffleboard', name: 'Shuffleboard (9ft)', widthInches: 108, heightInches: 20, color: '#14b8a6', category: 'arcade' },
  { id: 'poker', name: 'Poker Table (8-seat)', widthInches: 84, heightInches: 44, color: '#059669', category: 'arcade' },
  { id: 'claw', name: 'Claw / Crane Machine', widthInches: 30, heightInches: 36, color: '#ec4899', category: 'arcade' },

  // --- Furniture ---
  { id: 'stool', name: 'Bar Stool', widthInches: 15, heightInches: 15, color: '#64748b', category: 'furniture' },
  { id: 'pub-table', name: 'Pub Table', widthInches: 30, heightInches: 30, color: '#fcd34d', category: 'furniture' },
  { id: 'sofa', name: 'Sofa', widthInches: 84, heightInches: 36, color: '#0ea5e9', category: 'furniture' },
  { id: 'armchair', name: 'Armchair', widthInches: 36, heightInches: 36, color: '#38bdf8', category: 'furniture' },
  { id: 'gaming-chair', name: 'Gaming Chair', widthInches: 28, heightInches: 30, color: '#3b82f6', category: 'furniture' },
  { id: 'desk', name: 'Office Desk', widthInches: 60, heightInches: 30, color: '#94a3b8', category: 'furniture' },
  { id: 'home-bar', name: 'Home Bar', widthInches: 72, heightInches: 24, color: '#78716c', category: 'furniture' },
  { id: 'kegerator', name: 'Kegerator', widthInches: 24, heightInches: 24, color: '#57534e', category: 'furniture' },
  { id: 'jukebox', name: 'Jukebox', widthInches: 32, heightInches: 26, color: '#a16207', category: 'furniture' },

  // --- Storage ---
  { id: 'shelf-sm', name: 'Bookshelf (Small)', widthInches: 36, heightInches: 12, color: '#d97706', category: 'storage' },
  { id: 'shelf-lg', name: 'Bookshelf (Large)', widthInches: 48, heightInches: 18, color: '#b45309', category: 'storage' },
  { id: 'cabinet', name: 'Storage Cabinet', widthInches: 36, heightInches: 24, color: '#78350f', category: 'storage' },

  // --- Decor ---
  { id: 'rug-5x8', name: 'Rug (5x8)', widthInches: 60, heightInches: 96, color: '#cbd5e1', category: 'decor' },
  { id: 'rug-8x10', name: 'Rug (8x10)', widthInches: 96, heightInches: 120, color: '#94a3b8', category: 'decor' },
  { id: 'plant', name: 'Potted Plant', widthInches: 18, heightInches: 18, color: '#22c55e', category: 'decor' },

  // --- Structural (resizable) ---
  { id: 'structural-bump-out', name: 'Bump Out / Wall', widthInches: 24, heightInches: 24, color: '#d1d5db', category: 'structural', isResizable: true, pattern: 'hashed' },
  // A marked floor zone for the room people need around a machine — cue clearance at a pool table (~5 ft),
  // pull-back room in front of a cabinet, walking lanes. Resize it to wrap the clearance you want to keep clear.
  { id: 'standing-area', name: 'Clearance (Rect)', widthInches: 60, heightInches: 60, color: '#0ea5e9', category: 'structural', isResizable: true, pattern: 'zone' },
  // Round clearance — radial room around a dartboard throw line, a round poker table, a turning circle.
  // Resize both sides for a circle, or unevenly for an ellipse.
  { id: 'standing-area-circle', name: 'Clearance (Circle)', widthInches: 60, heightInches: 60, color: '#0ea5e9', category: 'structural', isResizable: true, pattern: 'zone-circle' },
];
