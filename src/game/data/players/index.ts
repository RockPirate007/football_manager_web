/**
 * Агрегатор базы реальных футболистов.
 * Составы реальных звёзд заданы по клубам; остальную глубину
 * составов досоздаёт генератор с национальными именами (core/bio.ts).
 */

import { APL_SQUADS } from "./apl";
import { LALIGA_SQUADS } from "./laliga";
import { SERIEA_SQUADS } from "./seriea";
import { BUNDESLIGA_SQUADS } from "./bundesliga";
import { LIGUE1_SQUADS } from "./ligue1";
import type { RealPlayerData } from "./base";

export type { RealPlayerData } from "./base";
export { rp } from "./base";

/** Карта лиги: клуб → реальные игроки */
export const LEAGUE_SQUADS: Record<string, Record<string, RealPlayerData[]>> = {
  eng: APL_SQUADS,
  esp: LALIGA_SQUADS,
  ita: SERIEA_SQUADS,
  ger: BUNDESLIGA_SQUADS,
  fra: LIGUE1_SQUADS,
};

/** Реальные игроки конкретного клуба */
export function realPlayersForClub(clubName: string): RealPlayerData[] {
  for (const squads of Object.values(LEAGUE_SQUADS)) {
    const found = squads[clubName];
    if (found) return found;
  }
  return [];
}

/** Общее число реальных игроков в базе */
export function realPlayersCount(): number {
  return Object.values(LEAGUE_SQUADS).reduce(
    (sum, squads) => sum + Object.values(squads).reduce((s, arr) => s + arr.length, 0),
    0,
  );
}
