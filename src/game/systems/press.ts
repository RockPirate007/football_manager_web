/**
 * Пресс-конференции: журналисты задают вопросы после туров,
 * ответы менеджера влияют на мораль, доверие совета и репутацию.
 */

import { choice } from "../core/rng";
import { userTeam } from "../core/state";
import { transferWindowAt } from "./market";
import { PRESS_BANK } from "../data/press";
import type { GameState, PressAnswer, PressConference, PressContext, PressQuestion } from "../core/types";

const JOURNALIST_NAMES = [
  ["Альберто Раду", "Sport Weekend"],
  ["Марта Клайн", "Gol Diário"],
  ["Томас Вернер", "Kickline"],
  ["Софи Мартен", "Le Tribune"],
  ["Педро Инфанте", "Cadena Gol"],
  ["Гарри Осборн", "Daily Pitch"],
  ["Лена Хоффман", "Weltball"],
];

function pickQuestions(context: PressContext, count: number): PressQuestion[] {
  const bank = [...PRESS_BANK[context]];
  const out: PressQuestion[] = [];
  while (out.length < count && bank.length > 0) {
    const idx = Math.floor(Math.random() * bank.length);
    out.push(bank.splice(idx, 1)[0]);
  }
  return out;
}

/** Построить пресс-конференцию по сюжету */
export function buildPressConference(g: GameState, context: PressContext): PressConference {
  const count = context === "crisis" ? 2 : 2 + (Math.random() < 0.5 ? 1 : 0);
  return {
    context,
    questions: pickQuestions(context, count),
    current: 0,
    results: [],
  };
}

/**
 * Решить, нужна ли пресс-конференция после тура.
 * Возвращает PressConference или null (состояние g не меняет).
 */
export function maybePressConference(
  g: GameState,
  res: "W" | "D" | "L" | null,
): PressConference | null {
  const team = userTeam(g);
  const played = team.w + team.d + team.l;
  if (played === 0) return null;

  let context: PressContext | null = null;

  // Кризис: 3+ поражения подряд — всегда
  if (g.lossStreak >= 3) {
    context = "crisis";
  } else if (res === "L" || res === "W" || res === "D") {
    const my = res === "L";
    const diff = lastGoalDiff(g);
    // Крупные победы/поражения (3+) — всегда
    if (Math.abs(diff) >= 3) {
      context = res === "W" ? "post_win" : res === "L" ? "post_loss" : "post_draw";
    } else if (res === "D" && Math.random() < 0.25) {
      context = "post_draw";
    } else if (my && Math.random() < 0.45) {
      context = "post_loss";
    } else if (res === "W" && Math.random() < 0.4) {
      context = "post_win";
    }
  }

  // Титульная гонка: топ-3 и случай
  if (!context && Math.random() < 0.18) {
    const place = userPlaceSafe(g);
    if (place > 0 && place <= 3) context = "title_race";
  }

  // Трансферное окно: во время открытого окна
  if (!context && transferWindowAt(g.round, g.schedule.length) !== "closed" && Math.random() < 0.35) {
    context = "transfer";
  }

  if (!context) return null;

  const pc = buildPressConference(g, context);
  // Журналисты с реальными именами подставляются в часть вопросов
  for (const q of pc.questions) {
    if (Math.random() < 0.35) {
      const [name, outlet] = choice(JOURNALIST_NAMES);
      q.journalist = name;
      q.outlet = outlet;
    }
  }
  return pc;
}

/** Разница мячей последнего матча пользователя (0 — нет данных) */
function lastGoalDiff(g: GameState): number {
  const rounds = Object.keys(g.results)
    .map(Number)
    .sort((a, b) => b - a);
  if (rounds.length === 0) return 0;
  const last = g.results[rounds[0]];
  for (const [h, a, gh, ga] of last) {
    if (h === g.user) return gh - ga;
    if (a === g.user) return ga - gh;
  }
  return 0;
}

function userPlaceSafe(g: GameState): number {
  try {
    // Ленивый импорт невозможен — place вычисляется в state.ts;
    // здесь упрощённо: позиция по очкам в лиге.
    const team = userTeam(g);
    const rivals = Object.values(g.teams).filter((t) => t.league === team.league);
    const better = rivals.filter((t) => t.pts > team.pts || (t.pts === team.pts && t.gf - t.ga > team.gf - team.ga)).length;
    return better + 1;
  } catch {
    return 0;
  }
}

/** Применить эффект ответа к игре */
function applyEffect(g: GameState, answer: PressAnswer): void {
  const team = userTeam(g);
  const e = answer.effect;
  if (e.morale) {
    for (const p of team.players) {
      p.morale = Math.max(20, Math.min(100, p.morale + e.morale));
    }
  }
  if (e.board) {
    g.boardTrust = Math.max(0, Math.min(100, g.boardTrust + e.board));
  }
  if (e.rep) {
    g.reputation = Math.max(0, Math.min(100, g.reputation + e.rep));
  }
}

/**
 * Ответить на текущий вопрос пресс-конференции.
 * Возвращает текст реакции прессы (или null, если конференция завершена).
 */
export function answerPress(g: GameState, answerIndex: number): string | null {
  const pc = g.pendingPress;
  if (!pc || pc.current >= pc.questions.length) return null;
  const q = pc.questions[pc.current];
  const answer = q.answers[answerIndex];
  if (!answer) return null;

  applyEffect(g, answer);
  pc.results.push(answer.result);
  pc.current += 1;

  // Конференция завершена — убираем из состояния
  if (pc.current >= pc.questions.length) {
    g.pendingPress = null;
  }
  return answer.result;
}
