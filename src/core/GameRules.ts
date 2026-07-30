import { RECIPES, UNIT_DEFINITIONS, type ItemKind, type RoomKind, type UnitKind } from '../data/definitions';

export type Stock = Record<ItemKind, number>;

export interface RecruitmentContext {
  stock: Stock;
  beds: number;
  bedsUsed: number;
  hasKitchen: boolean;
  hasWorkshop: boolean;
  shrineClaimed: boolean;
}

export function canStartRecipe(room: 'kitchen' | 'smelter' | 'workshop', stock: Stock): boolean {
  const recipe = RECIPES[room];
  return stock[recipe.input] >= recipe.inputAmount;
}

export function applyRecipe(room: 'kitchen' | 'smelter' | 'workshop', stock: Stock): Stock {
  const recipe = RECIPES[room];
  if (!canStartRecipe(room, stock)) return { ...stock };
  return {
    ...stock,
    [recipe.input]: stock[recipe.input] - recipe.inputAmount,
    [recipe.output]: stock[recipe.output] + recipe.outputAmount,
  };
}

export function canRecruitUnit(kind: Exclude<UnitKind, 'inquisitor'>, context: RecruitmentContext): boolean {
  const unit = UNIT_DEFINITIONS[kind];
  if (context.bedsUsed >= context.beds || !context.hasKitchen) return false;
  if (context.stock.ration < unit.ration || context.stock.armour < unit.armour || context.stock.essence < unit.essence) return false;
  if ((kind === 'guard' || kind === 'archer') && !context.hasWorkshop) return false;
  if (kind === 'hexbinder' && !context.shrineClaimed) return false;
  return true;
}

export function roomCost(kind: RoomKind, cells: number): number {
  if (kind === 'storage') return 0;
  if (kind === 'bedroom') return Math.ceil(cells / 2);
  const base = kind === 'prison' ? 4 : kind === 'kitchen' ? 2 : 3;
  return base + Math.ceil(cells / 3);
}

export function productionStations(cells: number): number {
  return Math.max(1, Math.min(2, Math.floor(cells / 6)));
}

export function bedroomCapacity(cells: number): number {
  return Math.floor(cells / 4);
}

export function prisonCapacity(cells: number): number {
  return Math.floor(cells / 4);
}

export function prisonerConsequences(
  choice: 'release' | 'recruit' | 'sacrifice',
  current: { trust: number; fear: number; stock: Stock; finalWaveSize: number },
): { trust: number; fear: number; stock: Stock; finalWaveSize: number } {
  if (choice === 'release') return { ...current, trust: current.trust + 15, finalWaveSize: current.finalWaveSize - 1 };
  if (choice === 'recruit') return {
    ...current,
    trust: current.trust + 5,
    stock: { ...current.stock, ration: current.stock.ration - 2 },
  };
  return {
    ...current,
    fear: current.fear + 20,
    finalWaveSize: current.finalWaveSize + 1,
    stock: { ...current.stock, essence: current.stock.essence + 6 },
  };
}

export function missionPhase(input: {
  phase: number;
  hasKitchen: boolean;
  biomassMined: number;
  rationsProduced: number;
  hasSmelter: boolean;
  metalProduced: number;
  beds: number;
  hasWorkshop: boolean;
  armourProduced: number;
  recruited: number;
  dwarfClaimed: boolean;
  dwarfOreMined: number;
}): number {
  if (input.phase === 1 && input.hasKitchen && input.biomassMined >= 4 && input.rationsProduced >= 2) return 2;
  if (input.phase === 2 && input.hasSmelter && input.metalProduced >= 2 && input.beds >= 2) return 3;
  if (input.phase === 3 && input.hasWorkshop && input.armourProduced >= 2 && input.recruited >= 1) return 4;
  if (input.phase === 4 && input.dwarfClaimed && input.dwarfOreMined >= 6) return 5;
  return input.phase;
}
