/**
 * Оценки игроков за матч и усталость после него.
 */

import { TACTICS } from "../data/tactics";
import { FORMATIONS } from "../data/formations";
import { addMatchRating, roleData } from "../core/player";
import { getEleven } from "../core/team";
import { clamp, randint } from "../core/rng";
import type { Player, PlayerRating, Team } from "../core/types";
import type { EngineEvent, EngineStats } from "./events";
import { teamMatchProfile } from "./profile";

/** Расчёт оценок игроков команды по событиям матча.
 *  players — явный список участников (для живого матча: основа + замены);
 *  по умолчанию — стартовый состав. */
export function calculateRatings(
  team: Team,
  _opponent: Team,
  teamStats: EngineStats,
  opponentStats: EngineStats,
  events: EngineEvent[],
  players?: Player[],
): PlayerRating[] {
  const eleven = players ?? getEleven(team);
  const goalsBy = new Map<number, number>();
  const assistsBy = new Map<number, number>();
  const yellowBy = new Map<number, number>();
  const redBy = new Map<number, number>();

  for (const event of events) {
    if (event.type === "goal") {
      if (event.scorer) goalsBy.set(event.scorer.id, (goalsBy.get(event.scorer.id) ?? 0) + 1);
      if (event.assistant)
        assistsBy.set(event.assistant.id, (assistsBy.get(event.assistant.id) ?? 0) + 1);
    } else if (event.type === "yellow") {
      if (event.player) yellowBy.set(event.player.id, (yellowBy.get(event.player.id) ?? 0) + 1);
    } else if (event.type === "red") {
      if (event.player) redBy.set(event.player.id, (redBy.get(event.player.id) ?? 0) + 1);
    }
  }

  const cleanSheet = opponentStats.goals === 0;
  const ratings: PlayerRating[] = [];

  for (const p of eleven) {
    let rating = 5.7 + Math.random() * 1.1;
    if (p.pos === "ВРТ") {
      rating += teamStats.saves * 0.10;
      if (cleanSheet) rating += 0.65;
      rating -= opponentStats.goals * 0.18;
    } else if (p.pos === "ЗАЩ") {
      if (cleanSheet) rating += 0.65;
      rating -= opponentStats.goals * 0.14;
    } else if (p.pos === "ПЗ") {
      rating += (teamStats.possession - 50) * 0.018;
      rating += (teamStats.xg - opponentStats.xg) * 0.11;
    } else {
      rating += (teamStats.xg - opponentStats.xg) * 0.08;
    }

    rating += (goalsBy.get(p.id) ?? 0) * 1.65;
    rating += (assistsBy.get(p.id) ?? 0) * 0.85;
    rating -= (yellowBy.get(p.id) ?? 0) * 0.35;
    rating -= (redBy.get(p.id) ?? 0) * 2.1;
    if (p.fitness < 55) rating -= 0.20;
    rating = Math.round(clamp(rating, 3.0, 10.0) * 10) / 10;
    addMatchRating(p, rating);
    ratings.push({ playerId: p.id, name: p.name, pos: p.pos, detail: p.detail, rating });
  }

  return ratings.sort((a, b) => b.rating - a.rating);
}

/** Усталость после матча: участники теряют силы, остальные восстанавливаются.
 *  appeared — явный список участников (основа + замены) для живого матча. */
export function applyMatchFatigue(team: Team, appeared?: Player[]): void {
  const profile = teamMatchProfile(team);
  const tactic = TACTICS[team.tactic] ?? TACTICS["Баланс"];
  const formation = FORMATIONS[team.formation] ?? FORMATIONS["4-4-2"];
  const fatigueMultiplier =
    tactic.fatigue * formation.fatigue * (0.95 + profile.tempo * 0.05);

  const starters = new Set((appeared ?? getEleven(team)).map((p) => p.id));
  for (const p of team.players) {
    if (!starters.has(p.id)) {
      if (p.injuryDays <= 0 && p.redSuspension <= 0) {
        p.stamina = Math.min(100, p.stamina + 8);
        p.fitness = Math.min(100, p.fitness + 4);
      }
      continue;
    }
    const roleFatigue = roleData(p).fatigue;
    const staminaLoss = randint(12, 23) * fatigueMultiplier * roleFatigue;
    const fitnessLoss = randint(5, 13) * fatigueMultiplier;
    p.stamina = Math.max(20, Math.round(p.stamina - staminaLoss));
    p.fitness = Math.max(30, Math.round(p.fitness - fitnessLoss));
  }
}

/** Лучший игрок списка оценок */
export function bestPlayer(ratings: PlayerRating[]): PlayerRating | null {
  return ratings.length > 0 ? ratings[0] : null;
}
