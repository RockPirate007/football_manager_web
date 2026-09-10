/**
 * Главный вход матчевого движка: симуляция полного матча.
 * Принимает команды, мутирует игроков (голы, усталость, оценки),
 * возвращает сериализуемый результат для трансляции и статистики.
 * Поддерживает модификаторы сложности (в матчах с участием игрока).
 */

import { getEleven } from "../core/team";
import type { Difficulty, LineupPlayer, MatchEvent, MatchResult, Team } from "../core/types";
import {
  chanceCount,
  calculatePossession,
  minuteForEvent,
} from "./chances";
import {
  createChance,
  createDisciplineEvents,
  createInjuryEvent,
  emptyStats,
  type EngineEvent,
  type EngineStats,
} from "./events";
import { applyMatchFatigue, bestPlayer, calculateRatings } from "./ratings";
import { teamMatchProfile } from "./profile";

/** Множители качества моментов по сложности: [атака игрока, атака ИИ, вратарь игрока, вратарь ИИ] */
const DIFFICULTY_MODS: Record<Difficulty, [number, number, number, number]> = {
  easy: [1.28, 0.8, 1.08, 0.94],
  normal: [1, 1, 1, 1],
  hard: [0.92, 1.13, 0.95, 1.06],
  legend: [0.8, 1.26, 0.9, 1.12],
};

export interface SimulateOptions {
  /** Название клуба игрока — для применения сложности */
  userTeam?: string;
  /** Сложность карьеры (по умолчанию normal) */
  difficulty?: Difficulty;
}

/** Собрать заявку для 2D-трансляции */
function toLineup(team: Team): LineupPlayer[] {
  return getEleven(team).map((p) => ({
    id: p.id,
    name: p.name,
    number: p.number,
    pos: p.pos,
    detail: p.detail,
  }));
}

/**
 * Симуляция матча. count_league=false — для кубка (без очков в таблице).
 * Возвращает голы хозяев и гостей и полный результат матча.
 */
export function simulate(
  home: Team,
  away: Team,
  countLeague = true,
  opts: SimulateOptions = {},
): { gh: number; ga: number; result: MatchResult } {
  const homeEleven = getEleven(home);
  const awayEleven = getEleven(away);

  // Крайний случай: слишком мало игроков — упрощённая симуляция
  if (homeEleven.length < 7 || awayEleven.length < 7) {
    const gH = Math.floor(Math.random() * 3);
    const gA = Math.floor(Math.random() * 3);
    if (countLeague) {
      applyQuickLeagueResult(home, gH, gA);
      applyQuickLeagueResult(away, gA, gH);
    }
    return {
      gh: gH,
      ga: gA,
      result: buildEmptyResult(home, away, gH, gA),
    };
  }

  const homeProfile = teamMatchProfile(home);
  const awayProfile = teamMatchProfile(away);
  const [homePossession, awayPossession] = calculatePossession(homeProfile, awayProfile);

  const homeStats: EngineStats = emptyStats(homePossession);
  const awayStats: EngineStats = emptyStats(awayPossession);

  const events: EngineEvent[] = [];
  const usedMinutes = new Set<number>();

  const homeChances = chanceCount(homeProfile, awayProfile, true);
  const awayChances = chanceCount(awayProfile, homeProfile, false);

  // Множители сложности применяются только в матчах игрока
  const isUserMatch =
    opts.userTeam !== undefined && (opts.userTeam === home.name || opts.userTeam === away.name);
  let homeAtkMul = 1;
  let awayAtkMul = 1;
  let homeKeepMul = 1;
  let awayKeepMul = 1;
  if (isUserMatch && opts.userTeam) {
    const [uAtk, aiAtk, uKeep, aiKeep] = DIFFICULTY_MODS[opts.difficulty ?? "normal"];
    if (opts.userTeam === home.name) {
      homeAtkMul = uAtk;
      awayAtkMul = aiAtk;
      homeKeepMul = aiKeep;   // вратарь хозяина-игрока против атак ИИ
      awayKeepMul = uKeep;    // вратарь гостей против атак игрока
    } else {
      homeAtkMul = aiAtk;
      awayAtkMul = uAtk;
      homeKeepMul = uKeep;
      awayKeepMul = aiKeep;
    }
  }

  for (const [attacking, defending, stats, count, atkMul, keepMul] of [
    [home, away, homeStats, homeChances, homeAtkMul, awayKeepMul],
    [away, home, awayStats, awayChances, awayAtkMul, homeKeepMul],
  ] as const) {
    const sampleN = Math.min(count, 20);
    if (sampleN <= 0) continue;
    const minutes = sampleMinutes(2, 89, sampleN);
    for (const minute of minutes) {
      createChance(attacking, defending, minute, stats, events, { atk: atkMul, keep: keepMul });
    }
  }

  const nextMinute = () => minuteForEvent(usedMinutes);
  createDisciplineEvents(home, away, events, usedMinutes, nextMinute);
  createInjuryEvent(home, events, nextMinute);
  createInjuryEvent(away, events, nextMinute);
  events.sort((a, b) => a.minute - b.minute);

  const homeRatings = calculateRatings(home, away, homeStats, awayStats, events);
  const awayRatings = calculateRatings(away, home, awayStats, homeStats, events);

  applyMatchFatigue(home);
  applyMatchFatigue(away);

  if (countLeague) {
    applyLeagueResult(home, homeStats.goals, awayStats.goals);
    applyLeagueResult(away, awayStats.goals, homeStats.goals);
  }

  const result: MatchResult = {
    home: home.name,
    away: away.name,
    homeStats: {
      team: home.name,
      goals: homeStats.goals,
      shots: homeStats.shots,
      shotsOnTarget: homeStats.shotsOnTarget,
      xg: Math.round(homeStats.xg * 100) / 100,
      possession: homeStats.possession,
      saves: homeStats.saves,
    },
    awayStats: {
      team: away.name,
      goals: awayStats.goals,
      shots: awayStats.shots,
      shotsOnTarget: awayStats.shotsOnTarget,
      xg: Math.round(awayStats.xg * 100) / 100,
      possession: awayStats.possession,
      saves: awayStats.saves,
    },
    events: events.map(toSerializableEvent),
    homeRatings,
    awayRatings,
    bestHome: bestPlayer(homeRatings),
    bestAway: bestPlayer(awayRatings),
    homeLineup: toLineup(home),
    awayLineup: toLineup(away),
  };

  return { gh: homeStats.goals, ga: awayStats.goals, result };
}

/** Применить результат к таблице лиги */
export function applyLeagueResult(t: Team, gh: number, ga: number): void {
  if (gh > ga) {
    t.w += 1;
    t.pts += 3;
  } else if (gh === ga) {
    t.d += 1;
    t.pts += 1;
  } else {
    t.l += 1;
  }
  t.gf += gh;
  t.ga += ga;
}

/** Упрощённый результат для деградировавшего состава */
function applyQuickLeagueResult(t: Team, gh: number, ga: number): void {
  applyLeagueResult(t, gh, ga);
}

function buildEmptyResult(home: Team, away: Team, gh: number, ga: number): MatchResult {
  const mk = (team: string, goals: number) => ({
    team,
    goals,
    shots: 0,
    shotsOnTarget: 0,
    xg: 0,
    possession: 50,
    saves: 0,
  });
  return {
    home: home.name,
    away: away.name,
    homeStats: mk(home.name, gh),
    awayStats: mk(away.name, ga),
    events: [],
    homeRatings: [],
    awayRatings: [],
    bestHome: null,
    bestAway: null,
    homeLineup: [],
    awayLineup: [],
  };
}

/** Случайная уникальная выборка минут (аналог random.sample(range)) */
function sampleMinutes(lo: number, hi: number, n: number): number[] {
  const pool: number[] = [];
  for (let m = lo; m <= hi; m++) pool.push(m);
  const out: number[] = [];
  for (let i = 0; i < n && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out.sort((a, b) => a - b);
}

/** Конвертация внутреннего события в сериализуемое для UI */
export function toSerializableEvent(e: EngineEvent): MatchEvent {
  return {
    minute: e.minute,
    team: e.team.name,
    type: e.type,
    text: e.text,
    scorerId: e.scorer?.id,
    assistantId: e.assistant?.id,
    playerId: e.player?.id,
    xg: e.xg !== undefined ? Math.round(e.xg * 100) / 100 : undefined,
  };
}
