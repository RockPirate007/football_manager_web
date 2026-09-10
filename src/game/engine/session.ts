/**
 * Живой матч: событийная сессия, разыгрываемая по ходу трансляции.
 *
 * В отличие от simulate() (весь матч заранее), сессия хранит ПЛАН событий
 * (минута + тип) и разыгрывает их при достижении курсора минуты. Это даёт
 * настоящую интерактивность: замены, смена настроя и установка в перерыве
 * влияют на оставшиеся моменты, а красные карточки ослабляют состав на поле.
 *
 * Сессия мутирует клонированные команды (голы, карточки, усталость),
 * как и обычная симуляция — финализация эквивалентна simulate().
 */

import type {
  Difficulty,
  Feedback,
  LineupPlayer,
  MatchEvent,
  MatchResult,
  Mentality,
  Player,
  Team,
  TeamMatchStats,
} from "../core/types";
import { isAvailable } from "../core/player";
import { getEleven } from "../core/team";
import { chance, clamp, randint } from "../core/rng";
import {
  calculatePossession,
  chanceCount,
  chooseDefenderFrom,
  getGoalkeeperFrom,
} from "./chances";
import {
  createChance,
  emptyStats,
  type EngineEvent,
  type EngineStats,
} from "./events";
import { profileFromPlayers, type TeamMatchProfile } from "./profile";
import {
  applyMatchFatigue,
  bestPlayer,
  calculateRatings,
} from "./ratings";
import { applyLeagueResult, toSerializableEvent } from "./simulate";

// ───────────────────────── План событий ─────────────────────────

type PlannedKind = "chance" | "yellow" | "red" | "injury";

export interface PlannedEvent {
  minute: number;
  side: "home" | "away" | null;
  kind: PlannedKind;
  done: boolean;
}

export interface SessionSub {
  side: "home" | "away";
  outId: number;
  inId: number;
  minute: number;
}

export interface MatchSession {
  home: Team;
  away: Team;
  countLeague: boolean;
  userTeam?: string;
  difficulty?: Difficulty;

  /** Кто сейчас на поле (id) */
  homeIds: number[];
  awayIds: number[];
  /** Стартовый состав (для расстановки на поле) */
  homeStart: LineupPlayer[];
  awayStart: LineupPlayer[];

  /** План событий, отсортирован по минуте */
  plan: PlannedEvent[];
  usedMinutes: Set<number>;
  /** Курсор трансляции (минута) */
  cursor: number;
  endMinute: number;

  statsHome: EngineStats;
  statsAway: EngineStats;
  possessionHome: number;

  /** Разыгранные события (с ссылками на игроков) */
  events: EngineEvent[];

  subs: SessionSub[];
  subsLeft: { home: number; away: number };
  mentality: { home: Mentality; away: Mentality };

  profileHome: TeamMatchProfile;
  profileAway: TeamMatchProfile;

  /** Установка в перерыве сделана */
  talkDone: boolean;
  talkMessage: string | null;
  finished: boolean;
}

const MAX_SUBS = 5;

/** Множители настроя: [своя атака, атака соперника против вас] */
const MENTALITY_MODS: Record<Mentality, [number, number]> = {
  attack: [1.15, 1.07],
  normal: [1, 1],
  defense: [0.86, 0.9],
};

/** Раскладка жёлтых карточек за матч */
function yellowRoll(): number {
  const weights = [33, 42, 20, 5];
  const roll = Math.random() * 100;
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i];
    if (roll < acc) return [0, 1, 2, 3][i];
  }
  return 0;
}

function uniqueMinute(session: { usedMinutes: Set<number> }): number {
  for (let i = 0; i < 100; i++) {
    const m = randint(2, 89);
    if (!session.usedMinutes.has(m)) {
      session.usedMinutes.add(m);
      return m;
    }
  }
  return randint(2, 89);
}

function toLineupPlayers(team: Team, ids: number[]): LineupPlayer[] {
  const byId = new Map(team.players.map((p) => [p.id, p]));
  return ids
    .map((id) => byId.get(id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined)
    .map((p) => ({ id: p.id, name: p.name, number: p.number, pos: p.pos, detail: p.detail }));
}

// ───────────────────────── Создание сессии ─────────────────────────

export function createMatchSession(
  home: Team,
  away: Team,
  countLeague: boolean,
  opts: { userTeam?: string; difficulty?: Difficulty } = {},
): MatchSession {
  const homeEleven = getEleven(home);
  const awayEleven = getEleven(away);

  const session: MatchSession = {
    home,
    away,
    countLeague,
    userTeam: opts.userTeam,
    difficulty: opts.difficulty,
    homeIds: homeEleven.map((p) => p.id),
    awayIds: awayEleven.map((p) => p.id),
    homeStart: toLineupPlayers(home, homeEleven.map((p) => p.id)),
    awayStart: toLineupPlayers(away, awayEleven.map((p) => p.id)),
    plan: [],
    usedMinutes: new Set<number>(),
    cursor: 0,
    endMinute: 90,
    statsHome: emptyStats(50),
    statsAway: emptyStats(50),
    possessionHome: 50,
    events: [],
    subs: [],
    subsLeft: { home: MAX_SUBS, away: MAX_SUBS },
    mentality: { home: "normal", away: "normal" },
    profileHome: profileFromPlayers(home, homeEleven),
    profileAway: profileFromPlayers(away, awayEleven),
    talkDone: false,
    talkMessage: null,
    finished: false,
  };

  const [homePossession, awayPossession] = calculatePossession(
    session.profileHome,
    session.profileAway,
  );
  session.possessionHome = homePossession;
  session.statsHome = emptyStats(homePossession);
  session.statsAway = emptyStats(awayPossession);

  const homeChances = chanceCount(session.profileHome, session.profileAway, true);
  const awayChances = chanceCount(session.profileAway, session.profileHome, false);

  // Моменты: минуты заранее, разыгрыш — по ходу
  const sample = (lo: number, hi: number, n: number): number[] => {
    const out: number[] = [];
    const pool: number[] = [];
    for (let m = lo; m <= hi; m++) pool.push(m);
    for (let i = 0; i < n && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      out.push(pool.splice(idx, 1)[0]);
    }
    return out.sort((a, b) => a - b);
  };
  for (const m of sample(2, 89, Math.min(homeChances, 20))) {
    session.plan.push({ minute: m, side: "home", kind: "chance", done: false });
  }
  for (const m of sample(2, 89, Math.min(awayChances, 20))) {
    session.plan.push({ minute: m, side: "away", kind: "chance", done: false });
  }
  // Дисциплина и травмы
  for (const side of ["home", "away"] as const) {
    for (let i = 0; i < yellowRoll(); i++) {
      session.plan.push({ minute: uniqueMinute(session), side, kind: "yellow", done: false });
    }
    if (chance(0.035)) {
      session.plan.push({ minute: uniqueMinute(session), side, kind: "red", done: false });
    }
    if (chance(0.105)) {
      session.plan.push({ minute: uniqueMinute(session), side, kind: "injury", done: false });
    }
  }
  session.plan.sort((a, b) => a.minute - b.minute);
  const lastMinute = session.plan.length > 0 ? session.plan[session.plan.length - 1].minute : 89;
  session.endMinute = Math.max(90, lastMinute + 1);

  return session;
}

// ───────────────────────── Внутренние хелперы ─────────────────────────

function pitchPlayers(session: MatchSession, side: "home" | "away") {
  const team = side === "home" ? session.home : session.away;
  const ids = side === "home" ? session.homeIds : session.awayIds;
  const byId = new Map(team.players.map((p) => [p.id, p]));
  return ids.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => p !== undefined);
}

function refreshProfiles(session: MatchSession): void {
  session.profileHome = profileFromPlayers(session.home, pitchPlayers(session, "home"));
  session.profileAway = profileFromPlayers(session.away, pitchPlayers(session, "away"));
}

/** Множители сложности из сложности карьеры (как в simulate) */
function difficultyMods(session: MatchSession): {
  homeAtk: number; awayAtk: number; homeKeep: number; awayKeep: number;
} {
  const isUserMatch =
    session.userTeam !== undefined &&
    (session.userTeam === session.home.name || session.userTeam === session.away.name);
  if (!isUserMatch || !session.userTeam) {
    return { homeAtk: 1, awayAtk: 1, homeKeep: 1, awayKeep: 1 };
  }
  const mods: Record<Difficulty, [number, number, number, number]> = {
    easy: [1.28, 0.8, 1.08, 0.94],
    normal: [1, 1, 1, 1],
    hard: [0.92, 1.13, 0.95, 1.06],
    legend: [0.8, 1.26, 0.9, 1.12],
  };
  const [uAtk, aiAtk, uKeep, aiKeep] = mods[session.difficulty ?? "normal"];
  if (session.userTeam === session.home.name) {
    return { homeAtk: uAtk, awayAtk: aiAtk, homeKeep: aiKeep, awayKeep: uKeep };
  }
  return { homeAtk: aiAtk, awayAtk: uAtk, homeKeep: uKeep, awayKeep: aiKeep };
}

// ───────────────────────── Разыгрыш событий ─────────────────────────

function resolvePlanned(session: MatchSession, pe: PlannedEvent): void {
  pe.done = true;
  const side = pe.side;
  if (side === null) return;
  const attacking = side === "home" ? session.home : session.away;
  const defending = side === "home" ? session.away : session.home;

  if (pe.kind === "chance") {
    const oppSide: "home" | "away" = side === "home" ? "away" : "home";
    const mods = difficultyMods(session);
    const own = MENTALITY_MODS[session.mentality[side]];
    const opp = MENTALITY_MODS[session.mentality[oppSide]];
    const atkPool = pitchPlayers(session, side);
    const defPool = pitchPlayers(session, oppSide);
    const atkProfile = side === "home" ? session.profileHome : session.profileAway;
    const defProfile = side === "home" ? session.profileAway : session.profileHome;
    createChance(
      attacking,
      defending,
      pe.minute,
      side === "home" ? session.statsHome : session.statsAway,
      session.events,
      { atk: mods[side === "home" ? "homeAtk" : "awayAtk"] * own[0] * opp[1], keep: mods[side === "home" ? "awayKeep" : "homeKeep"] },
      { atkPool, defPool, atkProfile, defProfile },
    );
    return;
  }

  const pool = pitchPlayers(session, side);

  if (pe.kind === "yellow") {
    const player = chooseDefenderFrom(pool);
    if (!player) return;
    player.yellowCards += 1;
    session.events.push({
      minute: pe.minute,
      team: attacking,
      type: "yellow",
      text: `Жёлтая карточка: ${player.name}`,
      player,
    });
    if (player.yellowCards >= 5) {
      player.redSuspension = Math.max(player.redSuspension, 1);
      player.yellowCards = 0;
      session.events.push({
        minute: pe.minute,
        team: attacking,
        type: "suspension",
        text: `${player.name} пропустит следующий матч: перебор карточек`,
        player,
      });
    }
    return;
  }

  if (pe.kind === "red") {
    const player = chooseDefenderFrom(pool);
    if (!player) return;
    player.redSuspension = Math.max(player.redSuspension, 2);
    session.events.push({
      minute: pe.minute,
      team: attacking,
      type: "red",
      text: `КРАСНАЯ КАРТОЧКА! ${player.name} удалён`,
      player,
    });
    // Удаляем с поля — команда играет в меньшинстве
    if (side === "home") {
      session.homeIds = session.homeIds.filter((id) => id !== player.id);
    } else {
      session.awayIds = session.awayIds.filter((id) => id !== player.id);
    }
    refreshProfiles(session);
    return;
  }

  if (pe.kind === "injury") {
    const candidates = pool.filter((p) => p.injuryDays <= 0);
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
    session.events.push({
      minute: pe.minute,
      team: attacking,
      type: "injury",
      text: `ТРАВМА: ${player.name}, вне игры примерно ${injuryDays} дн.`,
      player,
    });
  }
}

/** Прокрутить сессию до указанной минуты (разыгрывая события по пути) */
export function sessionStepTo(session: MatchSession, targetMinute: number): void {
  if (session.finished) return;
  for (const pe of session.plan) {
    if (pe.done) continue;
    if (pe.minute > targetMinute) break;
    resolvePlanned(session, pe);
  }
  session.cursor = Math.max(session.cursor, clamp(targetMinute, 0, session.endMinute));
  if (session.cursor >= session.endMinute) session.finished = true;
}

// ─────────────────────── Действия менеджера ───────────────────────

export function userSideOf(session: MatchSession): "home" | "away" | null {
  if (!session.userTeam) return null;
  if (session.userTeam === session.home.name) return "home";
  if (session.userTeam === session.away.name) return "away";
  return null;
}

/** Замена по ходу матча (только команда пользователя) */
export function sessionSubstitute(
  session: MatchSession,
  outId: number,
  inId: number,
): Feedback {
  const side = userSideOf(session);
  if (side === null) return { ok: false, kind: "error", message: "Это не ваш матч." };
  if (session.finished) return { ok: false, kind: "error", message: "Матч завершён." };
  if (session.subsLeft[side] <= 0) {
    return { ok: false, kind: "error", message: "Замены исчерпаны (макс. 5)." };
  }
  const team = side === "home" ? session.home : session.away;
  const byId = new Map(team.players.map((p) => [p.id, p]));
  const outP = byId.get(outId);
  const inP = byId.get(inId);
  if (!outP || !inP) return { ok: false, kind: "error", message: "Игрок не найден." };
  const ids = side === "home" ? session.homeIds : session.awayIds;
  if (!ids.includes(outId)) return { ok: false, kind: "error", message: `${outP.name} не на поле.` };
  if (ids.includes(inId)) return { ok: false, kind: "error", message: `${inP.name} уже на поле.` };
  if (!isAvailable(inP)) return { ok: false, kind: "error", message: `${inP.name} недоступен.` };
  if (inP.pos !== outP.pos) {
    return { ok: false, kind: "error", message: "Замена только на ту же линию (ВРТ/ЗАЩ/ПЗ/НАП)." };
  }

  if (side === "home") {
    session.homeIds = session.homeIds.map((id) => (id === outId ? inId : id));
  } else {
    session.awayIds = session.awayIds.map((id) => (id === outId ? inId : id));
  }
  session.subs.push({ side, outId, inId, minute: Math.max(1, Math.ceil(session.cursor)) });
  session.subsLeft[side] -= 1;
  refreshProfiles(session);
  return {
    ok: true,
    kind: "success",
    message: `Замена: ${outP.name} → ${inP.name} (${Math.ceil(session.cursor)}')`,
  };
}

/** Смена настроя команды */
export function sessionSetMentality(session: MatchSession, m: Mentality): Feedback {
  const side = userSideOf(session);
  if (side === null) return { ok: false, kind: "error", message: "Это не ваш матч." };
  session.mentality[side] = m;
  return { ok: true, kind: "info", message: "Настрой изменён." };
}

/**
 * Установка в перерыве: спокойная речь, мотивация или разнос.
 * Влияет на мораль игроков на поле (и, через профили, на второй тайм).
 */
export function sessionTeamTalk(
  session: MatchSession,
  kind: "calm" | "motivate" | "hairdryer",
): Feedback {
  const side = userSideOf(session);
  if (side === null) return { ok: false, kind: "error", message: "Это не ваш матч." };
  if (session.talkDone) return { ok: false, kind: "warning", message: "Установка уже дана." };
  if (session.cursor < 40) return { ok: false, kind: "warning", message: "Слишком рано — установка даётся ближе к перерыву." };
  session.talkDone = true;

  const team = side === "home" ? session.home : session.away;
  const ids = side === "home" ? session.homeIds : session.awayIds;
  const byId = new Map(team.players.map((p) => [p.id, p]));
  const onPitch = ids.map((id) => byId.get(id)).filter((p): p is Player => p !== undefined);

  const myGoals = side === "home" ? session.statsHome.goals : session.statsAway.goals;
  const oppGoals = side === "home" ? session.statsAway.goals : session.statsHome.goals;
  const losing = myGoals <= oppGoals;

  let message = "";
  let ok = true;
  if (kind === "calm") {
    for (const p of onPitch) p.morale = Math.min(100, p.morale + randint(0, 2));
    message = "Спокойная установка: игроки собраны и сфокусированы.";
  } else if (kind === "motivate") {
    if (chance(0.75)) {
      for (const p of onPitch) p.morale = Math.min(100, p.morale + randint(2, 5));
      message = "Мотивация сработала — команда горит!";
    } else {
      for (const p of onPitch) p.morale = Math.max(0, p.morale - 1);
      ok = false;
      message = "Речь не дошла до игроков.";
    }
  } else {
    if (chance(losing ? 0.62 : 0.3)) {
      for (const p of onPitch) p.morale = Math.min(100, p.morale + randint(3, 7));
      message = "Разнос! Игроки рвутся доказать, что они лучше.";
    } else {
      for (const p of onPitch) p.morale = Math.max(0, p.morale - randint(2, 4));
      ok = false;
      message = "Разнос вышел боком — раздевалка обижена.";
    }
  }
  session.talkMessage = message;
  refreshProfiles(session);
  return { ok, kind: ok ? "success" : "warning", message };
}

// ───────────────────────── Взгляд для UI ─────────────────────────

function redIdsUpTo(session: MatchSession, side: "home" | "away", minute: number): Set<number> {
  const teamName = side === "home" ? session.home.name : session.away.name;
  const out = new Set<number>();
  for (const e of session.events) {
    if (e.type === "red" && e.team.name === teamName && e.minute <= minute && e.player) {
      out.add(e.player.id);
    }
  }
  return out;
}

export interface LiveMatchView {
  home: string;
  away: string;
  minute: number;
  endMinute: number;
  finished: boolean;
  score: [number, number];
  homeStats: TeamMatchStats;
  awayStats: TeamMatchStats;
  events: MatchEvent[];
  homeLineup: LineupPlayer[];
  awayLineup: LineupPlayer[];
  /** Замены, показанные в ленте (минута, текст) */
  subLines: Array<{ minute: number; text: string }>;
  userSide: "home" | "away" | null;
  subsLeft: number;
  mentality: Mentality;
  talkDone: boolean;
  talkMessage: string | null;
  halfTime: boolean;
}

/** Статистика-снимок (сериализуемая) */
function statsView(stats: EngineStats, teamName: string): TeamMatchStats {
  return {
    team: teamName,
    goals: stats.goals,
    shots: stats.shots,
    shotsOnTarget: stats.shotsOnTarget,
    xg: Math.round(stats.xg * 100) / 100,
    possession: stats.possession,
    saves: stats.saves,
  };
}

/** Взгляд сессии на указанную минуту: события, счёт, составы с заменами */
export function sessionViewAt(session: MatchSession, minute: number): LiveMatchView {
  const m = clamp(minute, 0, session.endMinute);
  const side = userSideOf(session);

  const homeSubs = session.subs.filter((s) => s.side === "home" && s.minute <= m);
  const awaySubs = session.subs.filter((s) => s.side === "away" && s.minute <= m);

  const buildLineup = (starters: LineupPlayer[], team: Team, subs: SessionSub[]): LineupPlayer[] => {
    const view = [...starters];
    const byId = new Map(team.players.map((p) => [p.id, p]));
    for (const sub of subs) {
      const idx = view.findIndex((p) => p.id === sub.outId);
      const inP = byId.get(sub.inId);
      if (idx === -1 || !inP) continue;
      view[idx] = { id: inP.id, name: inP.name, number: inP.number, pos: inP.pos, detail: inP.detail, sub: true };
    }
    return view;
  };

  const homeLineup = buildLineup(session.homeStart, session.home, homeSubs);
  const awayLineup = buildLineup(session.awayStart, session.away, awaySubs);
  const homeReds = redIdsUpTo(session, "home", m);
  const awayReds = redIdsUpTo(session, "away", m);
  for (const p of homeLineup) if (homeReds.has(p.id)) p.off = true;
  for (const p of awayLineup) if (awayReds.has(p.id)) p.off = true;

  const events = session.events
    .filter((e) => e.minute <= m)
    .sort((a, b) => a.minute - b.minute)
    .map(toSerializableEvent);

  const subLines = session.subs
    .filter((s) => s.minute <= m)
    .sort((a, b) => a.minute - b.minute)
    .map((s) => {
      const team = s.side === "home" ? session.home : session.away;
      const byId = new Map(team.players.map((p) => [p.id, p]));
      const outP = byId.get(s.outId);
      const inP = byId.get(s.inId);
      return {
        minute: s.minute,
        text: `Замена «${team.name}»: ${inP?.name ?? "?"} вместо ${outP?.name ?? "?"}`,
      };
    });

  const talk = session.talkMessage && m >= 46 ? session.talkMessage : null;

  return {
    home: session.home.name,
    away: session.away.name,
    minute: m,
    endMinute: session.endMinute,
    finished: session.finished,
    score: [session.statsHome.goals, session.statsAway.goals],
    homeStats: statsView(session.statsHome, session.home.name),
    awayStats: statsView(session.statsAway, session.away.name),
    events,
    homeLineup,
    awayLineup,
    subLines,
    userSide: side,
    subsLeft: side ? session.subsLeft[side] : 0,
    mentality: side ? session.mentality[side] : "normal",
    talkDone: session.talkDone,
    talkMessage: talk,
    halfTime: !session.finished && m >= 45,
  };
}

// ───────────────────────── Финализация ─────────────────────────

/** Итоговый состав для MatchResult: слоты старта + замены + пометки удалений */
function finalLineup(
  starters: LineupPlayer[],
  team: Team,
  subs: SessionSub[],
  reds: Set<number>,
): LineupPlayer[] {
  const view = [...starters];
  const byId = new Map(team.players.map((p) => [p.id, p]));
  for (const sub of subs) {
    const idx = view.findIndex((p) => p.id === sub.outId);
    const inP = byId.get(sub.inId);
    if (idx === -1 || !inP) continue;
    view[idx] = { id: inP.id, name: inP.name, number: inP.number, pos: inP.pos, detail: inP.detail, sub: true };
  }
  for (const p of view) if (reds.has(p.id)) p.off = true;
  return view;
}

/**
 * Финализация сессии: доращивает события до конца, считает оценки,
 * применяет усталость и результат лиги. Эквивалент simulate().
 */
export function finalizeSession(session: MatchSession): { gh: number; ga: number; result: MatchResult } {
  sessionStepTo(session, session.endMinute);
  session.finished = true;

  const appearedHome = new Set<number>(session.homeStart.map((p) => p.id));
  const appearedAway = new Set<number>(session.awayStart.map((p) => p.id));
  for (const s of session.subs) {
    (s.side === "home" ? appearedHome : appearedAway).add(s.inId);
  }

  const homeAll = new Map(session.home.players.map((p) => [p.id, p]));
  const awayAll = new Map(session.away.players.map((p) => [p.id, p]));
  const homeAppeared = [...appearedHome].map((id) => homeAll.get(id)).filter((p): p is Player => p !== undefined);
  const awayAppeared = [...appearedAway].map((id) => awayAll.get(id)).filter((p): p is Player => p !== undefined);

  const homeRatings = calculateRatings(
    session.home,
    session.away,
    session.statsHome,
    session.statsAway,
    session.events,
    homeAppeared,
  );
  const awayRatings = calculateRatings(
    session.away,
    session.home,
    session.statsAway,
    session.statsHome,
    session.events,
    awayAppeared,
  );

  applyMatchFatigue(session.home, homeAppeared);
  applyMatchFatigue(session.away, awayAppeared);

  if (session.countLeague) {
    applyLeagueResult(session.home, session.statsHome.goals, session.statsAway.goals);
    applyLeagueResult(session.away, session.statsAway.goals, session.statsHome.goals);
  }

  const homeReds = redIdsUpTo(session, "home", 200);
  const awayReds = redIdsUpTo(session, "away", 200);

  const result: MatchResult = {
    home: session.home.name,
    away: session.away.name,
    homeStats: statsView(session.statsHome, session.home.name),
    awayStats: statsView(session.statsAway, session.away.name),
    events: [...session.events]
      .sort((a, b) => a.minute - b.minute)
      .map(toSerializableEvent),
    homeRatings,
    awayRatings,
    bestHome: bestPlayer(homeRatings),
    bestAway: bestPlayer(awayRatings),
    homeLineup: finalLineup(session.homeStart, session.home, session.subs.filter((s) => s.side === "home"), homeReds),
    awayLineup: finalLineup(session.awayStart, session.away, session.subs.filter((s) => s.side === "away"), awayReds),
  };

  return { gh: session.statsHome.goals, ga: session.statsAway.goals, result };
}
