/**
 * Карьера менеджера: репутация, доверие совета, задачи, история, увольнение.
 */

import { BANKRUPT_LIMIT } from "../data/leagues";
import { userTeam, userPlace, leagueTeams, userLeagueId } from "../core/state";
import { chance, clamp, randint } from "../core/rng";
import type { GameState, Objective, ObjectiveCheck } from "../core/types";

/** Инициализация карьерных полей (новые игры и миграция сейвов) */
export function initCareerFields(g: GameState, clubPower = 70): void {
  if (g.reputation === undefined) {
    g.reputation = Math.max(25, Math.min(70, clubPower - 20 + randint(-5, 10)));
  }
  if (g.boardTrust === undefined) g.boardTrust = 65;
  if (!g.objectives) g.objectives = [];
  if (!g.history) g.history = [];
  if (!g.academy) g.academy = [];
  if (!g.scoutReports) g.scoutReports = [];
  if (g.scoutedThisRound === undefined) g.scoutedThisRound = false;
  if (g.warnings === undefined) g.warnings = 0;
  if (g.objectives.length === 0) {
    g.objectives = generateObjectives(g);
  }
}

/** Запись в историю карьеры */
export function logHistory(g: GameState, text: string): void {
  g.history.push({ season: g.season, round: g.round, text });
  if (g.history.length > 80) {
    g.history = g.history.slice(-80);
  }
}

export function reputationLabel(rep: number): string {
  if (rep >= 80) return "Звезда";
  if (rep >= 65) return "Известный";
  if (rep >= 45) return "Средний";
  if (rep >= 25) return "Новичок";
  return "Под вопросом";
}

export function trustLabel(trust: number): string {
  if (trust >= 75) return "Полное доверие";
  if (trust >= 55) return "Стабильно";
  if (trust >= 35) return "Сомнения";
  if (trust >= 20) return "Критично";
  return "Увольнение близко";
}

/** Задачи совета на сезон по силе клуба */
export function generateObjectives(g: GameState): Objective[] {
  const team = userTeam(g);
  const power = team.power;
  const nTeams = leagueTeams(g, userLeagueId(g)).length;
  const objs: Objective[] = [];

  if (power >= 80) {
    objs.push({ id: "top3", text: "Войти в топ-3", target: 3, type: "place", critical: true });
    objs.push({ id: "pts40", text: "Набрать не менее 40 очков", target: 40, type: "points", critical: false });
  } else if (power >= 72) {
    objs.push({ id: "top5", text: "Войти в топ-5", target: 5, type: "place", critical: true });
    objs.push({ id: "wins8", text: "Одержать 8+ побед", target: 8, type: "wins", critical: false });
  } else if (power >= 65) {
    objs.push({ id: "mid", text: `Не ниже ${Math.max(6, Math.floor(nTeams / 2))} места`, target: Math.max(6, Math.floor(nTeams / 2)), type: "place", critical: true });
    objs.push({ id: "wins6", text: "Одержать 6+ побед", target: 6, type: "wins", critical: false });
  } else {
    objs.push({ id: "survive", text: `Избежать зоны (ниже ${nTeams - 2})`, target: nTeams - 2, type: "place_max", critical: true });
    objs.push({ id: "wins4", text: "Одержать 4+ победы", target: 4, type: "wins", critical: false });
  }

  objs.push({ id: "budget", text: "Не уйти в глубокий минус", target: Math.floor(BANKRUPT_LIMIT / 2), type: "budget_min", critical: false });
  return objs;
}

/** Оценка выполнения задач */
export function evaluateObjectives(g: GameState): ObjectiveCheck[] {
  const team = userTeam(g);
  const place = userPlace(g);
  return g.objectives.map((obj) => {
    let ok = false;
    switch (obj.type) {
      case "place":
      case "place_max":
        ok = place <= obj.target;
        break;
      case "points":
        ok = team.pts >= obj.target;
        break;
      case "wins":
        ok = team.w >= obj.target;
        break;
      case "budget_min":
        ok = team.budget >= obj.target;
        break;
    }
    return { obj, ok };
  });
}

/** Сдвиг репутации и доверия после тура */
export function updateReputationAfterRound(g: GameState, res: "W" | "D" | "L"): void {
  let deltaRep = 0;
  let deltaTrust = 0;
  if (res === "W") {
    deltaRep = randint(1, 2);
    deltaTrust = randint(1, 3);
  } else if (res === "D") {
    deltaRep = [0, 0, 1][Math.floor(Math.random() * 3)];
    deltaTrust = [-1, 0, 0, 1][Math.floor(Math.random() * 4)];
  } else {
    deltaRep = -randint(0, 2);
    deltaTrust = -randint(1, 3);
  }

  const place = userPlace(g);
  const nTeams = leagueTeams(g, userLeagueId(g)).length;
  if (g.round >= 6 && place >= nTeams - 2) {
    deltaTrust -= 2;
  }

  g.reputation = Math.round(clamp(g.reputation + deltaRep, 0, 100));
  g.boardTrust = Math.round(clamp(g.boardTrust + deltaTrust, 0, 100));
}

export interface BoardCheck {
  fired: boolean;
  warning: boolean;
  message: string;
}

/** Проверка увольнения советом директоров */
export function checkBoardFiring(g: GameState): BoardCheck {
  const trust = g.boardTrust;
  if (trust > 18) {
    if (trust <= 30 && chance(0.15)) {
      g.warnings += 1;
      return {
        fired: false,
        warning: true,
        message: "Совет директоров: доверие падает. Исправьте результаты!",
      };
    }
    return { fired: false, warning: false, message: "" };
  }

  logHistory(g, "Уволен советом директоров");
  return {
    fired: true,
    warning: false,
    message: `Доверие: ${trust}/100. Контракт расторгнут.`,
  };
}

/** Проверка банкротства и увольнения */
export function checkBankrupt(g: GameState): BoardCheck {
  // В песочнице (бесконечные деньги) банкротство и увольнение за долги отключены
  if (g.moneyCheat) {
    return { fired: false, warning: false, message: "" };
  }
  const team = userTeam(g);
  if (team.budget < BANKRUPT_LIMIT) {
    logHistory(g, "Уволен из-за банкротства");
    return {
      fired: true,
      warning: false,
      message: "УВОЛЕНЫ! Долги превысили лимит!",
    };
  }
  return checkBoardFiring(g);
}

/** Итоги задач сезона: изменение репутации и доверия */
export function settleSeasonObjectives(g: GameState): string {
  const results = evaluateObjectives(g);
  let criticalFail = 0;
  let successN = 0;

  for (const { obj, ok } of results) {
    if (ok) {
      successN += 1;
      logHistory(g, `Цель выполнена: ${obj.text}`);
    } else {
      logHistory(g, `Цель провалена: ${obj.text}`);
      if (obj.critical) criticalFail += 1;
    }
  }

  let message: string;
  if (results.length > 0 && successN === results.length) {
    g.reputation = Math.round(clamp(g.reputation + 8, 0, 100));
    g.boardTrust = Math.round(clamp(g.boardTrust + 12, 0, 100));
    message = "Совет в восторге — все задачи закрыты!";
  } else if (criticalFail === 0) {
    g.reputation = Math.round(clamp(g.reputation + 3, 0, 100));
    g.boardTrust = Math.round(clamp(g.boardTrust + 4, 0, 100));
    message = "Совет принял отчёт без восторгов.";
  } else {
    g.reputation = Math.round(clamp(g.reputation - 6 * criticalFail, 0, 100));
    g.boardTrust = Math.round(clamp(g.boardTrust - 15 * criticalFail, 0, 100));
    g.warnings += criticalFail;
    message = "Совет недоволен критическими провалами.";
  }

  const team = userTeam(g);
  const place = userPlace(g);
  logHistory(g, `Сезон ${g.season}: место ${place}, ${team.pts} очк., W${team.w}-D${team.d}-L${team.l}`);
  return message;
}
