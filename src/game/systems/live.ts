/**
 * Живой матч: связующее звено между store и движком сессий.
 *
 * Держит «отложенное» состояние клона игры вне React: пока матч
 * идёт в трансляции, основной game в store остаётся до-туровым.
 * При завершении применяется полный итог тура/кубка.
 */

import { createMatchSession, finalizeSession, sessionStepTo, sessionViewAt, sessionSubstitute, sessionSetMentality, sessionTeamTalk, type MatchSession } from "../engine/session";
import type { LiveMatchView } from "../engine/session";
export type { LiveMatchView };
import { completeRound, prepareRound, type PreparedRound } from "./round";
import { playCupRound, type CupRoundResult } from "./cup";
import type { Feedback, GameState, MatchResult, Mentality, RoundSummary } from "../core/types";

interface PendingRound {
  kind: "round";
  game: GameState;
  prep: PreparedRound;
}

interface PendingCup {
  kind: "cup";
  game: GameState;
  key: string;
  pair: [string, string];
  session: MatchSession;
}

let pending: PendingRound | PendingCup | null = null;

export function liveActive(): boolean {
  return pending !== null;
}

// ─────────────────────── Живой тур (чемпионат) ───────────────────────

/**
 * Начать живой тур. Возвращает сессию, если матч пользователя есть
 * (и его нужно показать в трансляции), иначе null — тур уже завершён
 * внутри и итог можно забрать через takeFinishedRound().
 */
export function beginLiveRound(g: GameState): MatchSession | null {
  const prep = prepareRound(g);
  if (!prep.session) {
    const summary = completeRound(g, prep, null);
    completedRound = { game: g, summary, match: null };
    return null;
  }
  pending = { kind: "round", game: g, prep };
  return prep.session;
}

export interface FinishedRound {
  game: GameState;
  summary: RoundSummary;
  match: MatchResult | null;
}

let completedRound: FinishedRound | null = null;

/** Забрать завершённый тур без трансляции (матча пользователя не было) */
export function takeFinishedRound(): FinishedRound | null {
  const out = completedRound;
  completedRound = null;
  return out;
}

/** Завершить живой тур: финализация матча + полный итог тура */
function finishRoundInternal(): FinishedRound | null {
  if (!pending || pending.kind !== "round") return null;
  const { game, prep } = pending;
  const session = prep.session;
  pending = null;
  if (!session) return null;
  const outcome = finalizeSession(session);
  const summary = completeRound(game, prep, outcome);
  return { game, summary, match: outcome.result };
}

// ─────────────────────── Живой кубок ───────────────────────

/**
 * Начать живой кубковый матч. Возвращает сессию, если пара пользователя
 * найдена, иначе null (нет матча — раунд можно играть старым способом).
 */
export function beginLiveCup(g: GameState, key: string): MatchSession | null {
  const cup = g.cups[key];
  if (!cup || cup.finished) return null;
  const found = cup.fixtures.find(([a, b]) => g.user === a || g.user === b);
  if (!found) return null;
  const a = found[0];
  const b = found[1];
  if (a === null || b === null) return null;
  const session = createLiveCupSession(g, a, b);
  pending = { kind: "cup", game: g, key, pair: [a, b], session };
  return session;
}

function createLiveCupSession(
  g: GameState,
  a: string,
  b: string,
): MatchSession {
  const home = g.teams[a];
  const away = g.teams[b];
  return createMatchSession(home, away, false, {
    userTeam: g.user,
    difficulty: g.difficulty,
  });
}

export interface FinishedCup {
  game: GameState;
  match: MatchResult;
  roundResult: CupRoundResult;
}

/** Завершить живой кубковый матч: пара разыграна, раунд доигран */
function finishCupInternal(): FinishedCup | null {
  if (!pending || pending.kind !== "cup") return null;
  const { game, key, pair, session } = pending;
  pending = null;
  const outcome = finalizeSession(session);
  const roundResult = playCupRound(game, key, true, {
    pair,
    outcome,
  });
  return { game, match: outcome.result, roundResult };
}

/** Единая точка завершения живого матча (тур или кубок) */
export function finishLive():
  | ({ type: "round" } & FinishedRound)
  | ({ type: "cup" } & FinishedCup)
  | null {
  if (!pending) return null;
  if (pending.kind === "round") {
    const done = finishRoundInternal();
    return done ? { type: "round", ...done } : null;
  }
  const done = finishCupInternal();
  return done ? { type: "cup", ...done } : null;
}

/** Текущая минута живого матча (для восстановления после перемотки UI) */
export function liveMinute(): number {
  const session = currentSession();
  return session ? session.cursor : 0;
}

// ─────────────────────── Действия в трансляции ───────────────────────

function currentSession(): MatchSession | null {
  if (!pending) return null;
  return pending.kind === "round" ? pending.prep.session : pending.session;
}

/** Вид трансляции на минуту (прокручивает события по пути) */
export function liveViewAt(minute: number): LiveMatchView | null {
  const session = currentSession();
  if (!session) return null;
  sessionStepTo(session, minute);
  return sessionViewAt(session, minute);
}

/** Замена по ходу трансляции */
export function liveSubstitute(outId: number, inId: number): Feedback {
  const session = currentSession();
  if (!session) return { ok: false, kind: "error", message: "Матч не идёт." };
  return sessionSubstitute(session, outId, inId);
}

/** Смена настроя */
export function liveMentality(m: Mentality): Feedback {
  const session = currentSession();
  if (!session) return { ok: false, kind: "error", message: "Матч не идёт." };
  return sessionSetMentality(session, m);
}

/** Установка в перерыве */
export function liveTalk(kind: "calm" | "motivate" | "hairdryer"): Feedback {
  const session = currentSession();
  if (!session) return { ok: false, kind: "error", message: "Матч не идёт." };
  return sessionTeamTalk(session, kind);
}

/** Список своих игроков на поле (для выбора уходящего) */
export function livePitchPlayers(): Array<{ id: number; name: string; pos: string; number: number }> {
  const session = currentSession();
  if (!session) return [];
  const side = session.userTeam === session.home.name ? "home" : "away";
  const team = side === "home" ? session.home : session.away;
  const ids = side === "home" ? session.homeIds : session.awayIds;
  const byId = new Map(team.players.map((p) => [p.id, p]));
  return ids.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => p !== undefined)
    .map((p) => ({ id: p.id, name: p.name, pos: p.pos, number: p.number }));
}

/** Список запасных (для выбора выходящего) */
export function liveBenchPlayers(): Array<{ id: number; name: string; pos: string; number: number }> {
  const session = currentSession();
  if (!session) return [];
  const side = session.userTeam === session.home.name ? "home" : "away";
  const team = side === "home" ? session.home : session.away;
  const ids = side === "home" ? session.homeIds : session.awayIds;
  const onPitch = new Set(ids);
  return team.players
    .filter((p) => !onPitch.has(p.id))
    .map((p) => ({ id: p.id, name: p.name, pos: p.pos, number: p.number }));
}
