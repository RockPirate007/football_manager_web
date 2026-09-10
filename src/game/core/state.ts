/**
 * Хелперы над состоянием игры (GameState).
 * Мир теперь мультилиговый: таблицы и места считаются внутри лиги.
 */

import { LEAGUE_BY_ID } from "../data/leagues";
import type { GameState, Team } from "./types";

/** Команда пользователя */
export function userTeam(g: GameState): Team {
  return g.teams[g.user];
}

/** ID лиги пользователя */
export function userLeagueId(g: GameState): string {
  return g.teams[g.user].league;
}

/** Название лиги пользователя */
export function userLeagueName(g: GameState): string {
  const league = LEAGUE_BY_ID[userLeagueId(g)];
  return league?.name ?? "Лига";
}

/** Все команды лиги */
export function leagueTeams(g: GameState, leagueId: string): Team[] {
  return Object.values(g.teams).filter((t) => t.league === leagueId);
}

/** Отсортированная таблица лиги */
export function sortedLeagueTable(g: GameState, leagueId: string): Team[] {
  return leagueTeams(g, leagueId).sort(
    (a, b) => b.pts - a.pts || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf,
  );
}

/** Место пользователя в своей лиге (1-based) */
export function userPlace(g: GameState): number {
  const table = sortedLeagueTable(g, userLeagueId(g));
  return table.findIndex((t) => t.name === g.user) + 1;
}

/** Лидер лиги (для прессы) */
export function leagueLeader(g: GameState, leagueId: string): Team {
  const table = sortedLeagueTable(g, leagueId);
  return table[0];
}
