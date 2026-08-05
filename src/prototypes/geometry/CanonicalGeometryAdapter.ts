import type { CanonicalGameState } from '../../core/AutomationBridge';
import { proofCellKey } from './GeometryProofModel';
import {
  createSandboxState,
  type SandboxDiscoverySite,
  type SandboxState,
} from './GeometrySandboxModel';
import {
  CAMPAIGN_EVALUATION_SLICE,
  DWARF_CHAMBER,
  FUNGUS_CHAMBER,
  HEART_TILE,
  INTEGRATION_SLICE,
  IRON_CHAMBER,
  SHRINE_CHAMBER,
  architectureForMapCell,
  type SpatialProjection,
} from '../spatial/IntegrationModel';

export interface CanonicalGeometryConfig {
  projection: SpatialProjection;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  heart: { x: number; z: number };
  start: { x: number; z: number };
  sites: SandboxDiscoverySite[];
}

function projectPoint(x: number, y: number, projection: SpatialProjection): { x: number; z: number } {
  return { x: x - projection.minX, z: y - projection.minY };
}

function projectSite(
  id: string,
  label: string,
  kind: SandboxDiscoverySite['kind'],
  rect: { x: number; y: number; w: number; h: number },
  projection: SpatialProjection,
): SandboxDiscoverySite {
  const origin = projectPoint(rect.x, rect.y, projection);
  return {
    id,
    label,
    kind,
    x: origin.x,
    z: origin.z,
    w: rect.w,
    h: rect.h,
    entry: { x: origin.x + Math.floor(rect.w / 2), z: origin.z + rect.h },
  };
}

function createConfig(projection: SpatialProjection): CanonicalGeometryConfig {
  const heart = projectPoint(HEART_TILE.x, HEART_TILE.y, projection);
  return {
    projection,
    bounds: {
      minX: 0,
      maxX: projection.maxX - projection.minX,
      minZ: 0,
      maxZ: projection.maxY - projection.minY,
    },
    heart,
    start: { x: heart.x, z: heart.z + 2 },
    sites: [
      projectSite('fungus', 'Pilzgrotte', 'fungus', FUNGUS_CHAMBER, projection),
      projectSite('iron', 'Eisenader', 'iron', IRON_CHAMBER, projection),
      projectSite('dwarf', 'Zwergenposten', 'hostile', DWARF_CHAMBER, projection),
      projectSite('shrine', 'Inquisitorenschrein', 'shrine', SHRINE_CHAMBER, projection),
    ].filter((site) => (
      site.x + site.w > 0
      && site.z + site.h > 0
      && site.x <= projection.maxX - projection.minX
      && site.z <= projection.maxY - projection.minY
    )),
  };
}

export const CANONICAL_CAMPAIGN_GEOMETRY = createConfig(CAMPAIGN_EVALUATION_SLICE);
export const CANONICAL_LIVE_GEOMETRY = createConfig(INTEGRATION_SLICE);

/**
 * Thin, read-only projection into the geometry renderer's presentation shape.
 * No gameplay rule is evaluated here: GameScene remains the only simulation.
 */
export function canonicalStateToGeometryState(
  canonical: CanonicalGameState,
  config: CanonicalGeometryConfig,
): SandboxState {
  const geometry = createSandboxState();
  geometry.openCells.clear();
  geometry.claimedCells.clear();
  geometry.plannedDig.clear();
  geometry.rooms = [];
  geometry.deposits = [];
  geometry.enemies = [];

  for (const tile of canonical.knownTiles) {
    if (tile.geology !== 'excavated') continue;
    if (tile.x < config.projection.minX || tile.x > config.projection.maxX) continue;
    if (tile.y < config.projection.minY || tile.y > config.projection.maxY) continue;
    const point = projectPoint(tile.x, tile.y, config.projection);
    const key = proofCellKey(point.x, point.z);
    const architecture = architectureForMapCell(tile.x, tile.y, canonical);
    geometry.openCells.set(key, {
      x: point.x,
      z: point.z,
      zone: architecture === 'natural' ? 'target' : architecture === 'built' ? 'start' : 'corridor',
    });
    if (tile.control === 'owned' || tile.control === 'claiming') geometry.claimedCells.add(key);
    if (tile.construction === 'planned' || tile.construction === 'building') {
      geometry.plannedDig.set(key, point);
    }
  }

  geometry.rooms = canonical.rooms
    .filter((room) => (
      room.x + room.w > config.projection.minX
      && room.y + room.h > config.projection.minY
      && room.x <= config.projection.maxX
      && room.y <= config.projection.maxY
    ))
    .map((room) => ({
      id: room.id,
      kind: room.kind,
      x: room.x - config.projection.minX,
      z: room.y - config.projection.minY,
      w: room.w,
      h: room.h,
      buildProgress: room.complete ? room.w * room.h : 0,
    }));

  geometry.deposits = canonical.items
    .filter((item) => item.kind === 'ore' || item.kind === 'biomass')
    .filter((item) => (
      item.x >= config.projection.minX && item.x <= config.projection.maxX
      && item.y >= config.projection.minY && item.y <= config.projection.maxY
    ))
    .map((item) => ({
      id: item.id,
      kind: item.kind === 'ore' ? 'iron' : 'fungus',
      x: Math.floor(item.x - config.projection.minX),
      z: Math.floor(item.y - config.projection.minY),
      remaining: Math.max(1, item.amount),
    }));

  geometry.discoveredSites = new Set(
    canonical.targets.filter((target) => target.discovered).map((target) => target.id),
  );
  geometry.clearedSites = new Set(
    canonical.targets.filter((target) => target.claimed).map((target) => target.id),
  );
  geometry.stock = { ...canonical.stock };
  geometry.workerCount = canonical.workers.length;
  const activeWorkers = canonical.workers.filter((worker) => worker.state !== 'idle').length;
  geometry.workerJobs = {
    dig: canonical.workers.filter((worker) => worker.state === 'dig' || worker.state === 'move').length,
    claim: canonical.workers.filter((worker) => worker.state === 'claim').length,
    build: canonical.workers.filter((worker) => worker.state === 'work').length,
    mine: canonical.workers.filter((worker) => worker.state === 'mine' || worker.state === 'harvest').length,
    idle: canonical.workers.length - activeWorkers,
  };
  geometry.creature = {
    ...geometry.creature,
    x: config.start.x,
    z: config.start.z,
  };
  return geometry;
}

export function canonicalPointToGeometry(
  point: { x: number; y: number },
  config: CanonicalGeometryConfig,
): { x: number; z: number } {
  return projectPoint(point.x, point.y, config.projection);
}
