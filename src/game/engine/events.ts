/**
 * Генерация событий матча: удары, голы, карточки, травмы.
 * События хранят ссылки на игроков для расчёта рейтингов,
 * затем конвертируются в сериализуемый вид для трансляции.
 */

import { choice, chance, clamp, uniform } from "../core/rng";
import {
  chooseAssistant,
  chooseAssistantFrom,
  chooseDefender,
  chooseDefenderFrom,
  chooseScorer,
  chooseScorerFrom,
  getGoalkeeper,
  getGoalkeeperFrom,
} from "./chances";
import { getEleven } from "../core/team";
import type { MatchEventType, Player, Team } from "../core/types";
import { teamMatchProfile, type TeamMatchProfile } from "./profile";

/** Внутреннее событие матча (с ссылками на игроков) */
export interface EngineEvent {
  minute: number;
  team: Team;
  type: MatchEventType;
  text: string;
  scorer?: Player;
  assistant?: Player;
  player?: Player;
  keeper?: Player;
  xg?: number;
}

/** Внутренняя статистика команды за матч */
export interface EngineStats {
  goals: number;
  shots: number;
  shotsOnTarget: number;
  xg: number;
  possession: number;
  saves: number;
}

export function emptyStats(possession: number): EngineStats {
  return { goals: 0, shots: 0, shotsOnTarget: 0, xg: 0.0, possession, saves: 0 };
}

const MISS_TEXTS = [
  (s: Player, d: Player) => `${s.name} пробил мимо ворот`,
  (s: Player, _d: Player) => `${s.name} не попал в створ`,
  (s: Player, d: Player) => `${d.name} накрыл удар ${s.name}`,
  (s: Player, _d: Player) => `${s.name} упустил хороший момент`,
];

/** Множители сложности момента: atk — качество атаки, keep — сила вратаря */
export interface ChanceMod {
  atk?: number;
  keep?: number;
}

/**
 * Исполнитель стандарта атакующей команды (штрафные/угловые), если он на поле.
 * Возвращает игрока и тип стандарта.
 */
function setPieceTaker(
  team: Team,
  pool: Player[],
): { taker: Player; kind: "freeKick" | "corner" } | null {
  const sp = team.setPieces;
  if (!sp) return null;
  const byId = (id: number | null | undefined) =>
    id != null ? pool.find((p) => p.id === id) ?? null : null;
  const fk = byId(sp.freeKick);
  if (fk) return { taker: fk, kind: "freeKick" };
  const corner = byId(sp.corner);
  if (corner) return { taker: corner, kind: "corner" };
  return null;
}

/**
 * Явный контекст живого матча: пулы игроков на поле и актуальные профили.
 * Если задан — используется вместо расчёта по lineupIds команды
 * (нужно, чтобы замены и красные карточки влияли на игру).
 */
export interface ChanceCtx {
  atkPool: Player[];
  defPool: Player[];
  atkProfile: TeamMatchProfile;
  defProfile: TeamMatchProfile;
}

/**
 * Разыгрыш одного момента. Возвращает true, если был гол.
 * Мутирует статистику, события и игроков (голы/ассисты).
 */
export function createChance(
  attackingTeam: Team,
  defendingTeam: Team,
  minute: number,
  stats: EngineStats,
  events: EngineEvent[],
  mod: ChanceMod = {},
  ctx?: ChanceCtx,
): boolean {
  const atkMul = mod.atk ?? 1;
  const keepMul = mod.keep ?? 1;
  const attackerProfile = ctx ? ctx.atkProfile : teamMatchProfile(attackingTeam);
  const defenderProfile = ctx ? ctx.defProfile : teamMatchProfile(defendingTeam);
  let xgBaseMul = 1.0;

  const scorer = ctx ? chooseScorerFrom(ctx.atkPool) : chooseScorer(attackingTeam);
  const defender = ctx ? chooseDefenderFrom(ctx.defPool) : chooseDefender(defendingTeam);
  const keeper = ctx ? getGoalkeeperFrom(ctx.defPool) : getGoalkeeper(defendingTeam);
  if (scorer === null || defender === null || keeper === null) {
    return false;
  }

  stats.shots += 1;
  let shotQuality = uniform(0.07, 0.34) * atkMul;
  if (scorer.pos === "НАП") shotQuality += 0.035;
  else if (scorer.pos === "ПЗ") shotQuality += 0.010;
  else if (scorer.pos === "ЗАЩ") shotQuality -= 0.025;

  const paceEdge = scorer.pace - defender.pace;
  const skillEdge = scorer.shooting - defender.defending;
  shotQuality += paceEdge * 0.0022;
  shotQuality += skillEdge * 0.0020;
  shotQuality += (attackerProfile.passing - defenderProfile.defending) * 0.0009;
  shotQuality += scorer.form * 0.0025;
  shotQuality += (scorer.morale - 50) * 0.00055;

  const matchup = tacticalMatchupOf(attackerProfile, defenderProfile);

  // Стандарты (Фаза 2): часть моментов рождается с навеса назначенного исполнителя.
  // Навес сильного пасом исполнителя повышает качество момента и отдаёт ассист ему.
  const sp = setPieceTaker(attackingTeam, ctx ? ctx.atkPool : getEleven(attackingTeam));
  const isSetPiece = sp !== null && chance(0.12);
  if (isSetPiece && sp) {
    const delivery = sp.taker.passing * 0.5 + sp.taker.shooting * 0.5;
    // Качество навеса: мастер по стандартам добавляет до +12% xg, слабый — может и испортить
    const deliveryMod = 1 + (delivery - 65) * 0.004;
    xgBaseMul = Math.max(0.92, deliveryMod);
  }
  const xg = clamp(shotQuality * matchup * xgBaseMul, 0.03, 0.65);
  stats.xg += xg;

  const targetQuality =
    scorer.shooting * 0.58 +
    scorer.pace * 0.13 +
    scorer.form * 1.2 +
    scorer.morale * 0.07 +
    uniform(-11, 11);

  const keeperPower =
    keeper.goalkeeping * 0.70 * keepMul + keeper.form * 0.8 + keeper.morale * 0.08 + uniform(-10, 10);

  const conversionChance = clamp(
    xg *
      (0.72 + (targetQuality - keeperPower) / 120) *
      attackerProfile.tempo *
      (0.96 + attackerProfile.shooting / 500),
    0.015,
    0.72,
  );
  const isGoal = Math.random() < conversionChance;

  if (isGoal) {
    scorer.goals += 1;
    stats.goals += 1;
    stats.shotsOnTarget += 1;
    let assistant: Player | null = null;
    let goalText = `ГОЛ! ${scorer.name}`;
    if (isSetPiece && sp) {
      // Со стандарта ассистентом становится назначенный исполнитель (если не сам забил)
      if (sp.taker.id !== scorer.id) {
        assistant = sp.taker;
        assistant.assists += 1;
        goalText = `ГОЛ СО СТАНДАРТА! ${scorer.name} замыкает навес ${sp.taker.name} (${sp.kind === "freeKick" ? "штрафной" : "угловой"})`;
      }
    } else if (chance(0.72)) {
      assistant = ctx ? chooseAssistantFrom(ctx.atkPool, scorer) : chooseAssistant(attackingTeam, scorer);
      if (assistant !== null) {
        assistant.assists += 1;
        goalText += ` (ассист: ${assistant.name})`;
      }
    }
    events.push({
      minute,
      team: attackingTeam,
      type: "goal",
      text: goalText,
      scorer,
      assistant: assistant ?? undefined,
      xg,
    });
    return true;
  }

  if (chance(0.46)) {
    stats.shotsOnTarget += 1;
    stats.saves += 1;
    events.push({
      minute,
      team: attackingTeam,
      type: "save",
      text: `${scorer.name} бьёт — сейв ${keeper.name}`,
      scorer,
      keeper,
      xg,
    });
  } else {
    const textFn = choice(MISS_TEXTS);
    events.push({
      minute,
      team: attackingTeam,
      type: "miss",
      text: textFn(scorer, defender),
      scorer,
      player: defender,
      xg,
    });
  }
  return false;
}

// Локальный алиас, чтобы не тянуть имя из chances.ts в сигнатурах
function tacticalMatchupOf(a: TeamMatchProfile, d: TeamMatchProfile): number {
  let bonus = 1.0;
  if (a.counter > 1.18 && d.risk > 1.10) bonus += 0.12;
  if (a.pressing > 1.15 && d.tempo < 0.92) bonus += 0.05;
  if (d.defense > 1.08 && a.risk > 1.15) bonus -= 0.06;
  if (d.risk < 0.85 && a.tempo < 0.95) bonus -= 0.03;
  return clamp(bonus, 0.82, 1.22);
}

/** Дисциплина: жёлтые/красные карточки, дисквалификации */
export function createDisciplineEvents(
  teamA: Team,
  teamB: Team,
  events: EngineEvent[],
  usedMinutes: Set<number>,
  nextMinute: () => number,
): void {
  for (const team of [teamA, teamB]) {
    const yellowWeights = [33, 42, 20, 5];
    const yellowOptions = [0, 1, 2, 3];
    const roll = Math.random() * 100;
    let acc = 0;
    let yellowCount = 0;
    for (let i = 0; i < yellowWeights.length; i++) {
      acc += yellowWeights[i];
      if (roll < acc) {
        yellowCount = yellowOptions[i];
        break;
      }
    }
    for (let i = 0; i < yellowCount; i++) {
      const player = chooseDefender(team);
      if (player === null) continue;
      player.yellowCards += 1;
      events.push({
        minute: nextMinute(),
        team,
        type: "yellow",
        text: `Жёлтая карточка: ${player.name}`,
        player,
      });
      if (player.yellowCards >= 5) {
        player.redSuspension = Math.max(player.redSuspension, 1);
        player.yellowCards = 0;
        events.push({
          minute: nextMinute(),
          team,
          type: "suspension",
          text: `${player.name} пропустит следующий матч: перебор карточек`,
          player,
        });
      }
    }
    if (chance(0.035)) {
      const player = chooseDefender(team);
      if (player !== null) {
        player.redSuspension = Math.max(player.redSuspension, 2);
        events.push({
          minute: nextMinute(),
          team,
          type: "red",
          text: `КРАСНАЯ КАРТОЧКА! ${player.name} удалён`,
          player,
        });
      }
    }
  }
}

/** Травма в матче (шанс ~10.5%) */
export function createInjuryEvent(
  team: Team,
  events: EngineEvent[],
  nextMinute: () => number,
): void {
  if (!chance(0.105)) return;
  const candidates = getEleven(team).filter((p) => p.injuryDays <= 0 && p.redSuspension <= 0);
  if (candidates.length === 0) return;
  const player = candidates[Math.floor(Math.random() * candidates.length)];
  const weights = [30, 28, 20, 13, 7, 2];
  const daysOptions = [4, 7, 10, 14, 21, 35];
  const roll = Math.random() * 100;
  let acc = 0;
  let injuryDays = 4;
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i];
    if (roll < acc) {
      injuryDays = daysOptions[i];
      break;
    }
  }
  player.injuryDays = Math.max(player.injuryDays, injuryDays);
  player.fitness = Math.max(20, player.fitness - (10 + Math.floor(Math.random() * 19)));
  events.push({
    minute: nextMinute(),
    team,
    type: "injury",
    text: `ТРАВМА: ${player.name}, вне игры примерно ${injuryDays} дн.`,
    player,
  });
}
