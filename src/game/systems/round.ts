/**
 * Игровой тур: восстановление, все матчи тура, финансы, пресса, рынок.
 * Разделён на подготовку (prepareRound) и завершение (completeRound),
 * чтобы матч пользователя можно было сыграть «вживую» — с заменами
 * и установками по ходу (см. engine/session.ts).
 */

import { dailyRecovery } from "../core/player";
import { autoLineup } from "../core/team";
import { simulate } from "../engine/simulate";
import { createMatchSession, finalizeSession, type MatchSession } from "../engine/session";
import { applyFinances, pressLines } from "./finances";
import { refreshMarket, aiMarketDay } from "./market";
import { processDressingRoom } from "./dressing";
import { updateReputationAfterRound } from "./career";
import { maybeAutoCupProgress } from "./cup";
import { processInternationalWindow, maybeTournamentReport, notifyCallupsAhead } from "./international";
import { maybePressConference } from "./press";
import { applyStaffEffects, refreshStaffMarket } from "./staff";
import { processFacilities, maybeConstructionDelay, recoveryBonus, medicalBonus } from "./facilities";
import { processScoutMissions } from "./scouting";
import { applyIndividualTraining } from "./training";
import { maybeBoardReview, checkFinancialFairPlay, processBoardDeadline } from "./board";
import { processSponsorOffers } from "./economy";
import { generateRoundNews } from "./news";
import type { GameState, MatchResult, RoundSummary } from "../core/types";

export interface PreparedRound {
  /** Индекс тура, который готовится */
  roundIndex: number;
  /** Живая сессия матча пользователя (null — матча нет) */
  session: MatchSession | null;
  /** Результаты матчей без участия игрока */
  partialResults: Array<[string, string, number, number]>;
}

/**
 * Подготовить тур: восстановление, симуляция чужих матчей,
 * создать живую сессию для матча пользователя.
 */
export function prepareRound(g: GameState): PreparedRound {
  const r = g.round;
  const matches = g.schedule[r];
  const user = g.user;

  // Восстановление между турами
  for (const team of Object.values(g.teams)) {
    for (const p of team.players) {
      dailyRecovery(p, 3);
      if (p.redSuspension > 0) p.redSuspension = Math.max(0, p.redSuspension - 1);
    }
  }
  for (const p of g.freeAgents) {
    dailyRecovery(p, 3);
    if (p.redSuspension > 0) p.redSuspension = Math.max(0, p.redSuspension - 1);
  }

  // Бонусы инфраструктуры клуба менеджера: база и медцентр
  {
    const recB = recoveryBonus(g.facilities);
    const medB = medicalBonus(g.facilities);
    if (recB > 0 || medB > 0) {
      for (const p of g.teams[g.user].players) {
        if (p.injuryDays > 0) p.injuryDays = Math.max(0, p.injuryDays - medB);
        p.fitness = Math.min(100, p.fitness + recB);
        p.stamina = Math.min(100, p.stamina + recB);
      }
    }
  }

  const partialResults: Array<[string, string, number, number]> = [];
  let session: MatchSession | null = null;
  const simOpts = { userTeam: user, difficulty: g.difficulty };

  // Ежитурное влияние персонала: физио/физио-подготовка/ассистент
  applyStaffEffects(g);

  for (const [hName, aName] of matches) {
    const home = g.teams[hName];
    const away = g.teams[aName];
    if (hName === user || aName === user) {
      autoLineup(away); // соперник готовит состав; состав игрока не трогаем
      session = createMatchSession(home, away, true, simOpts);
    } else {
      autoLineup(home);
      autoLineup(away);
      const { gh, ga } = simulate(home, away, true);
      partialResults.push([hName, aName, gh, ga]);
    }
  }

  return { roundIndex: r, session, partialResults };
}

/**
 * Завершить тур: применить результат матча пользователя (или готовый
 * результат из сессии), финансы, пресса, рынок, раздевалка, репутация.
 */
export function completeRound(
  g: GameState,
  prep: PreparedRound,
  outcome: { gh: number; ga: number; result: MatchResult } | null,
): RoundSummary {
  const r = prep.roundIndex;
  const user = g.user;
  const results: Array<[string, string, number, number]> = [...prep.partialResults];

  let userRes: "W" | "D" | "L" | null = null;
  if (outcome) {
    results.push([outcome.result.home, outcome.result.away, outcome.gh, outcome.ga]);
    const homeGame = outcome.result.home === user;
    const my = homeGame ? outcome.gh : outcome.ga;
    const en = homeGame ? outcome.ga : outcome.gh;
    userRes = my > en ? "W" : my === en ? "D" : "L";
  } else if (prep.session) {
    // Быстрая симуляция (не смотрим): финализируем сессию сразу
    const done = finalizeSession(prep.session);
    results.push([done.result.home, done.result.away, done.gh, done.ga]);
    const homeGame = done.result.home === user;
    const my = homeGame ? done.gh : done.ga;
    const en = homeGame ? done.ga : done.gh;
    userRes = my > en ? "W" : my === en ? "D" : "L";
    prep.session = null;
  }

  g.results[r] = results;

  // Серия поражений для кризисных пресс-конференций
  if (userRes === "L") g.lossStreak += 1;
  else if (userRes) g.lossStreak = 0;

  // Международные окна: вызовы в сборные, письма, усталость
  processInternationalWindow(g);
  maybeTournamentReport(g);

  // Раздевалка: недовольные звёзды, напоминания о контрактах
  processDressingRoom(g);

  // Инфраструктура: продвижение строек, редкие задержки
  processFacilities(g);
  maybeConstructionDelay(g);

  // Скауты в регионах: продвижение миссий, отчёты по завершении
  processScoutMissions(g);

  // Индивидуальные планы тренировок (автоматически, не расходует командную)
  applyIndividualTraining(g);

  // Совет директоров: обзоры сезона, FFP, дедлайн ультиматума
  maybeBoardReview(g);
  checkFinancialFairPlay(g);
  processBoardDeadline(g);

  // Коммерция: старение спонсорских предложений
  processSponsorOffers(g);

  // Отсчёт FFP-запрета на покупки
  if (g.ffpBanRounds > 0) g.ffpBanRounds -= 1;

  const homeGame = results.some(([h]) => h === user);
  const finance = applyFinances(g, homeGame, userRes);
  const { pressLine, leaderLine } = pressLines(g, userRes);
  refreshMarket(g);
  aiMarketDay(g);
  refreshStaffMarket(g);
  if (userRes) {
    updateReputationAfterRound(g, userRes);
  }

  // Пресс-конференция: если менеджер не дожал предыдущую — не назначаем новую
  if (!g.pendingPress) {
    g.pendingPress = maybePressConference(g, userRes);
  }

  g.trained = false;
  g.scoutedThisRound = false;
  g.round += 1;

  // Заранее предупреждаем о вызовах в сборные на следующей неделе
  notifyCallupsAhead(g);

  // Лента новостей по итогам тура
  generateRoundNews(g, r, results, outcome?.result ?? null, userRes);

  // Кубок может двигаться сам, если пользователь не участвует
  maybeAutoCupProgress(g);

  return {
    round: r,
    userMatch: outcome?.result ?? null,
    results,
    income: finance.income,
    spend: finance.spend,
    budget: finance.budget,
    pressLine,
    leaderLine,
    boardWarning: false,
    finance,
  };
}

/**
 * Сыграть тур целиком (без просмотра). watch=true устарел:
 * для живого просмотра используйте systems/live.ts.
 */
export function playRound(g: GameState): RoundSummary {
  const prep = prepareRound(g);
  return completeRound(g, prep, null);
}
