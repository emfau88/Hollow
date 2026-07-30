import { describe, expect, it } from 'vitest';
import {
  bedroomCapacity,
  prisonCapacity,
  productionStations,
  roomCost,
} from '../src/core/GameRules';
import { BALANCE } from '../src/config/balance';

describe('Metallbilanz und Raumskalierung', () => {
  it('berechnet die Mindestkosten nach Raumtyp', () => {
    expect(roomCost('storage', 6)).toBe(0);
    expect(roomCost('bedroom', 4)).toBe(2);
    expect(roomCost('kitchen', 6)).toBe(4);
    expect(roomCost('smelter', 6)).toBe(5);
    expect(roomCost('workshop', 6)).toBe(5);
    expect(roomCost('prison', 6)).toBe(6);
  });

  it('macht größere Räume tatsächlich teurer', () => {
    expect(roomCost('bedroom', 12)).toBe(6);
    expect(roomCost('kitchen', 12)).toBe(6);
    expect(roomCost('smelter', 12)).toBe(7);
    expect(roomCost('prison', 12)).toBe(8);
  });

  it('finanziert den Pflichtpfad ohne Sackgasse, aber nicht die ganze Basis gratis', () => {
    const afterKitchenSmelterAndBedroom = BALANCE.startingMetal
      - roomCost('kitchen', 6)
      - roomCost('smelter', 6)
      - roomCost('bedroom', 4);
    expect(afterKitchenSmelterAndBedroom).toBe(1);
    expect(afterKitchenSmelterAndBedroom + 4).toBe(roomCost('workshop', 6));
  });

  it('skaliert Produktionsplätze, Betten und Zellen mit der Fläche', () => {
    expect(productionStations(6)).toBe(1);
    expect(productionStations(12)).toBe(2);
    expect(productionStations(16)).toBe(2);
    expect(bedroomCapacity(4)).toBe(1);
    expect(bedroomCapacity(8)).toBe(2);
    expect(prisonCapacity(8)).toBe(2);
  });
});
