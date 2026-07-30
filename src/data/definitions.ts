export type ItemKind = 'ore' | 'biomass' | 'essence' | 'metal' | 'ration' | 'armour';
export type RoomKind = 'storage' | 'bedroom' | 'kitchen' | 'smelter' | 'workshop' | 'prison';
export type UnitKind = 'guard' | 'archer' | 'hexbinder' | 'inquisitor';
export type ToolKind =
  | 'pan'
  | 'dig'
  | 'chamber'
  | `room-${RoomKind}`
  | 'banner-attack'
  | 'banner-defend'
  | 'trap';

export interface RoomDefinition {
  label: string;
  minW: number;
  minH: number;
  maxW: number;
  maxH: number;
  color: number;
  symbol: string;
}

export const ROOM_DEFINITIONS: Record<RoomKind, RoomDefinition> = {
  storage: { label: 'Lager', minW: 2, minH: 1, maxW: 6, maxH: 6, color: 0x6f6755, symbol: '▦' },
  bedroom: { label: 'Schlafkammer', minW: 2, minH: 2, maxW: 4, maxH: 4, color: 0x435772, symbol: '⌂' },
  kitchen: { label: 'Pilzküche', minW: 2, minH: 3, maxW: 4, maxH: 4, color: 0x536d4d, symbol: '♨' },
  smelter: { label: 'Schmelze', minW: 2, minH: 3, maxW: 4, maxH: 4, color: 0x775044, symbol: '♨' },
  workshop: { label: 'Werkstatt', minW: 2, minH: 3, maxW: 4, maxH: 4, color: 0x6b5b47, symbol: '⚒' },
  prison: { label: 'Gefängnis', minW: 2, minH: 3, maxW: 4, maxH: 4, color: 0x554a62, symbol: '▥' },
};

export const ITEM_LABELS: Record<ItemKind, string> = {
  ore: 'Roherz',
  biomass: 'Biomasse',
  essence: 'Essenz',
  metal: 'Metall',
  ration: 'Rationen',
  armour: 'Rüstungsgüter',
};

export const UNIT_DEFINITIONS: Record<UnitKind, {
  label: string;
  hp: number;
  damage: number;
  range: number;
  attackSeconds: number;
  ration: number;
  armour: number;
  essence: number;
}> = {
  guard: { label: 'Covenant Guard', hp: 100, damage: 12, range: 1.1, attackSeconds: 1, ration: 1, armour: 1, essence: 0 },
  archer: { label: 'Gloom Archer', hp: 60, damage: 9, range: 5, attackSeconds: 1.2, ration: 1, armour: 1, essence: 0 },
  hexbinder: { label: 'Hexbinder', hp: 55, damage: 4, range: 4, attackSeconds: 1.5, ration: 1, armour: 0, essence: 3 },
  inquisitor: { label: 'Gewendeter Inquisitor', hp: 110, damage: 14, range: 4, attackSeconds: 1.1, ration: 2, armour: 0, essence: 0 },
};

export const RECIPES = {
  smelter: { input: 'ore' as ItemKind, inputAmount: 2, output: 'metal' as ItemKind, outputAmount: 1, seconds: 6 },
  kitchen: { input: 'biomass' as ItemKind, inputAmount: 2, output: 'ration' as ItemKind, outputAmount: 2, seconds: 5 },
  workshop: { input: 'metal' as ItemKind, inputAmount: 1, output: 'armour' as ItemKind, outputAmount: 2, seconds: 7 },
};
