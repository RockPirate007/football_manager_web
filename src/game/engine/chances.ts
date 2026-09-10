/**
 * Расчёт моментов: владение, количество шансов, тактический матч-ап,
 * подбор исполнителей событий.
 */

import {
  ASSIST_POS_BONUS,
  DEFENDER_POS_BONUS,
  SCORER_POS_BONUS,
} from "../data/roles";
import { isAvailable } from "../core/player";
import { getEleven } from "../core/team";
import { clamp, randint, uniform, weightedChoice } from "../core/rng";
import type { Player, Team } from "../core/types";
import type { TeamMatchProfile } from "./profile";

/** Владение мячом: [дом, гости] в процентах */
export function calculatePossession(
  home: TeamMatchProfile,
  away: TeamMatchProfile,
): [number, number] {
  const control = (p: TeamMatchProfile) =>
    p.midfield * 0.42 + p.passing * 0.34 + p.pressing * 5.0 + p.width * 2.0 + p.morale * 0.05;
  const homeControl = control(home);
  const awayControl = control(away);
  const total = Math.max(1.0, homeControl + awayControl);
  let homePossession = 50 + ((homeControl - awayControl) / total) * 42;
  homePossession += uniform(-2.5, 2.5);
  homePossession = Math.round(clamp(homePossession, 28, 72));
  return [homePossession, 100 - homePossession];
}

/** Количество моментов команды в матче */
export function chanceCount(
  attacker: TeamMatchProfile,
  defender: TeamMatchProfile,
  isHome: boolean,
): number {
  const attackStrength =
    attacker.attack * 0.29 +
    attacker.midfield * 0.18 +
    attacker.passing * 0.16 +
    attacker.pace * 0.10 +
    attacker.effective * 0.08 +
    attacker.tempo * 8.0 +
    attacker.counter * 5.0 +
    attacker.width * 4.0;
  const defensiveStrength =
    defender.defense * 0.27 +
    defender.defending * 0.20 +
    defender.keeper * 0.18 +
    defender.effective * 0.12 +
    defender.pressing * 5.0;
  const difference = attackStrength - defensiveStrength;
  const homeBonus = isHome ? 1.2 : 0.0;
  const chances = 8.0 + difference * 0.13 + homeBonus + attacker.risk * 1.5;
  return Math.round(clamp(Math.round(chances + uniform(-1.5, 1.5)), 3, 19));
}

/** Тактический матч-ап: бонус/штраф из противостояния стилей */
export function tacticalMatchup(
  attacker: TeamMatchProfile,
  defender: TeamMatchProfile,
): number {
  let bonus = 1.0;
  if (attacker.counter > 1.18 && defender.risk > 1.10) bonus += 0.12;
  if (attacker.pressing > 1.15 && defender.tempo < 0.92) bonus += 0.05;
  if (defender.defense > 1.08 && attacker.risk > 1.15) bonus -= 0.06;
  if (defender.risk < 0.85 && attacker.tempo < 0.95) bonus -= 0.03;
  return clamp(bonus, 0.82, 1.22);
}

/** Вратарь среди явного пула (или лучший по вратарским) */
export function getGoalkeeperFrom(pool: Player[]): Player | null {
  const keepers = pool.filter((p) => p.pos === "ВРТ");
  if (keepers.length > 0) return keepers[0];
  const fallback = [...pool].sort((a, b) => b.goalkeeping - a.goalkeeping);
  return fallback[0] ?? null;
}

/** Вратарь команды (или лучший по вратарским из доступных) */
export function getGoalkeeper(team: Team): Player | null {
  return getGoalkeeperFrom(getEleven(team).filter((p) => isAvailable(p)));
}

/** Подбор бомбардира момента из пула */
export function chooseScorerFrom(pool: Player[]): Player | null {
  if (pool.length === 0) return null;
  const weights = pool.map((p) => {
    const posBonus = SCORER_POS_BONUS[p.pos] ?? 0.5;
    return (
      (p.shooting * 0.60 + p.pace * 0.12 + p.form * 1.5 + p.morale * 0.05) * posBonus
    );
  });
  return weightedChoice(pool, weights);
}

/** Подбор бомбардира момента */
export function chooseScorer(team: Team): Player | null {
  return chooseScorerFrom(getEleven(team));
}

/** Подбор ассистента (не сам бомбардир) из пула */
export function chooseAssistantFrom(pool: Player[], scorer: Player): Player | null {
  const rest = pool.filter((p) => p.id !== scorer.id);
  if (rest.length === 0) return null;
  const weights = rest.map((p) => {
    const posBonus = ASSIST_POS_BONUS[p.pos] ?? 0.5;
    return (
      (p.passing * 0.62 + p.pace * 0.12 + p.form * 1.2 + p.morale * 0.04) * posBonus
    );
  });
  return weightedChoice(rest, weights);
}

/** Подбор ассистента (не сам бомбардир) */
export function chooseAssistant(team: Team, scorer: Player): Player | null {
  return chooseAssistantFrom(getEleven(team), scorer);
}

/** Подбор защитника для событий обороны/дисциплины из пула */
export function chooseDefenderFrom(pool: Player[]): Player | null {
  if (pool.length === 0) return null;
  const weights = pool.map((p) => {
    const posBonus = DEFENDER_POS_BONUS[p.pos] ?? 0.5;
    return (
      (p.defending * 0.62 + p.pace * 0.13 + p.stamina * 0.10 + p.morale * 0.04) * posBonus
    );
  });
  return weightedChoice(pool, weights);
}

/** Подбор защитника для событий обороны/дисциплины */
export function chooseDefender(team: Team): Player | null {
  return chooseDefenderFrom(getEleven(team));
}

/** Уникальная минута для события */
export function minuteForEvent(usedMinutes: Set<number>): number {
  for (let i = 0; i < 100; i++) {
    const minute = randint(2, 89);
    if (!usedMinutes.has(minute)) {
      usedMinutes.add(minute);
      return minute;
    }
  }
  return randint(2, 89);
}
