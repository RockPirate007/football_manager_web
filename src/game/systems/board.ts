/**
 * Совет директоров: жёсткое управление клубом сверху (Фаза 3).
 *  — сезонные цели (generateObjectives в career.ts);
 *  — промежуточные обзоры на 25/50/75% сезона с похвалой, критикой
 *    и ультиматумами с дедлайном: не успел — увольнение;
 *  — реакция на кубковые вылеты от слабых соперников;
 *  — трёхуровневый FFP: замечание → угроза → санкции (штраф + запрет
 *    трансферов).
 */

import { userTeam, userPlace, leagueTeams, userLeagueId } from "../core/state";
import { teamPayroll } from "../core/team";
import { chance } from "../core/rng";
import { sendMail } from "./mail";
import { logHistory } from "./career";
import { addNews } from "./news";
import type { GameState } from "../core/types";

/** Ожидаемое место по силе состава: топ-клубы обязаны бороться за титул */
export function expectedPlace(g: GameState): number {
  const power = userTeam(g).power;
  const n = leagueTeams(g, userLeagueId(g)).length;
  if (power >= 85) return 2;
  if (power >= 80) return 4;
  if (power >= 74) return Math.max(5, Math.round(n * 0.28));
  if (power >= 68) return Math.max(7, Math.round(n * 0.45));
  return Math.max(9, Math.round(n * 0.6));
}

/** Промежуточный обзор совета. Вызывается в completeRound. */
export function maybeBoardReview(g: GameState): void {
  const len = g.schedule?.length || 34;
  const r = g.round;
  if (r < 4) return;
  const marks = [Math.round(len * 0.25), Math.round(len * 0.5), Math.round(len * 0.75)];
  if (!marks.includes(r)) return;

  const team = userTeam(g);
  const place = userPlace(g);
  const expect = expectedPlace(g);
  const phase = r === marks[0] ? "четверть сезона" : r === marks[1] ? "экватор сезона" : "треть сезона прошла с конца";
  const behind = place - expect;

  if (behind <= -2) {
    // Играем заметно лучше ожиданий
    g.boardTrust = Math.min(100, g.boardTrust + 5);
    g.reputation = Math.min(100, g.reputation + 2);
    sendMail(
      g,
      `Совет директоров: обзор (${phase})`,
      `Вы идёте на ${place}-м месте при ожиданиях топ-${expect}. Совет в восторге от игры команды!\n` +
        `Бюджет клуба стабилен. Продолжайте в том же духе — премии обсуждаются.`,
      "совет",
    );
    addNews(g, "club", "🏛", "Совет хвалит результаты", `Место ${place} при ожиданиях топ-${expect}: доверие совета растёт.`);
  } else if (behind <= 0) {
    // В рамках ожиданий
    sendMail(
      g,
      `Совет директоров: обзор (${phase})`,
      `Команда на ${place}-м месте, ожидания — топ-${expect}. Совет считает результат приемлемым.\n` +
        `Финансовая дисциплина под контролем. Ждём продолжения.`,
      "совет",
    );
  } else if (behind <= 4) {
    // Отставание — предупреждение
    g.boardTrust = Math.max(0, g.boardTrust - 4);
    sendMail(
      g,
      `Совет директоров: обзор (${phase})`,
      `Мы на ${place}-м месте, хотя планировали топ-${expect}. Совет выражает озабоченность.\n` +
        `Требуется улучшение результатов в ближайших турах. Ваше положение обсуждается.`,
      "совет",
    );
    addNews(g, "club", "🏛", "Совет выражает озабоченность", `Отставание от ожиданий: ${behind} мест. Доверие падает.`);
  } else {
    // Провал — ультиматум с дедлайном (не перевыпускаем, если уже висит)
    g.boardTrust = Math.max(0, g.boardTrust - 9);
    g.warnings += 1;
    const roundsLeft = Math.max(4, len - r);
    if (!g.boardUltimatum) {
      g.boardUltimatum = {
        text: `Выйти на топ-${expect} (сейчас ${place}-е)`,
        roundsLeft,
      };
    }
    logHistory(g, `Ультиматум совета (${phase}): место ${place} при ожидании топ-${expect}`);
    sendMail(
      g,
      `СРОЧНО: ультиматум совета директоров`,
      `Команда на ${place}-м месте при ожиданиях топ-${expect}. Это недопустимо!\n` +
        `У вас ${roundsLeft} туров, чтобы выйти на ожидаемый уровень. Если к дедлайну положение не исправится — контракт будет расторгнут.`,
      "совет",
    );
    addNews(g, "club", "⚠", "Ультиматум совета!", `Кризис: место ${place} при ожиданиях топ-${expect}. На исправление — ${roundsLeft} туров.`);
  }
}

/**
 * Ежитурный тик ультиматума: дедлайн подошёл — либо выполнено (доверие вверх),
 * либо контракт расторгнут (доверие в 0 → checkBoardFiring после тура уволит).
 */
export function processBoardDeadline(g: GameState): void {
  const u = g.boardUltimatum;
  if (!u) return;
  u.roundsLeft -= 1;
  if (u.roundsLeft > 0) return;

  const place = userPlace(g);
  const expect = expectedPlace(g);
  const behind = place - expect;
  // Провал засчитывается по тому же масштабу, что и выдача ультиматума (5+ мест ниже плана):
  // иначе ультиматум получается смертельным даже при частичном улучшении.
  if (behind > 4) {
    g.boardTrust = 0;
    g.warnings += 1;
    logHistory(g, `Ультиматум провален: место ${place} при ожидании топ-${expect} — контракт расторгнут`);
    addNews(g, "club", "🔴", "Совет расторгает контракт", `Ультиматум не выполнен: ${place}-е место при ожиданиях топ-${expect}. Менеджер отправлен в отставку.`);
    sendMail(
      g,
      "Контракт расторгнут",
      `Дедлайн ультиматума истёк. Команда осталась на ${place}-м месте при ожиданиях топ-${expect}.\nСовет директоров принял решение о смене главного тренера.`,
      "совет",
    );
  } else {
    g.boardTrust = Math.min(100, g.boardTrust + 7);
    logHistory(g, `Ультиматум выполнен: место ${place} при ожидании топ-${expect}`);
    sendMail(g, "Ультиматум выполнен", `Команда вышла на ожидаемый уровень (${place}-е место при плане топ-${expect}).\nСовет благодарит за оперативность и снимает угрозу увольнения.`, "совет");
    addNews(g, "club", "🟢", "Ультиматум выполнен", "Доверие совета восстановлено.");
  }
  g.boardUltimatum = null;
}

/**
 * Реакция совета на вылет из кубка от заведомо слабого соперника.
 * Вызывается из cup.ts, когда пользователя выбивает клуб с заметно
 * меньшей силой. Ранние стадии (много участников) бьют больнее.
 */
export function boardCupReaction(g: GameState, winnerName: string, stageSize: number): void {
  const opp = g.teams[winnerName];
  if (!opp) return;
  const mine = userTeam(g);
  if (mine.power - opp.power < 7) return; // вылет не «сенсационный»
  const penalty = stageSize >= 64 ? 4 : 2;
  g.boardTrust = Math.max(0, g.boardTrust - penalty);
  logHistory(g, `Кубковая сенсация: вылет от «${winnerName}» (сила ${opp.power} против ${mine.power})`);
  sendMail(
    g,
    "Совет разочарован вылетом",
    `Поражение от «${winnerName}» — недопустимый результат для «${mine.name}».\n` +
      `Совет ожидает, что чемпионат не пострадает. Доверие снижено на ${penalty} пункт(ов).`,
    "совет",
  );
  addNews(g, "club", "🚫", `Кубковая сенсация: вылет от «${winnerName}»`, `Совет директоров в ярости: доверие −${penalty}.`);
}

/**
 * FFP: трёхуровневый контроль ведомости к доходам.
 *  — >115%: лёгкое замечание (30% за тур);
 *  — >125% при пустом бюджете: предупреждение и угроза санкций (раз в сезон);
 *  — >145% при отрицательном балансе: санкции — штраф и запрет на покупки
 *    игроков на 6 туров (раз в сезон).
 */
export function checkFinancialFairPlay(g: GameState): void {
  if (g.moneyCheat) return;
  const team = userTeam(g);
  const fin = g.lastFinDetail;
  if (!fin) return;

  const payroll = fin.payroll + (fin.staff ?? 0);
  const income = fin.tickets + fin.merch + fin.sponsors + fin.tv + fin.bonus;
  if (income <= 0) return;
  const ratio = payroll / income;

  // ── Красная зона: санкции (раз в сезон) ──
  if (ratio > 1.45 && team.budget < 0 && g.ffpSancSeason !== g.season) {
    g.ffpSancSeason = g.season;
    g.ffpBanRounds = 6;
    const fine = 1_500_000;
    team.budget -= fine;
    g.boardTrust = Math.max(0, g.boardTrust - 8);
    sendMail(
      g,
      "FFP: клуб под санкциями лиги",
      `Зарплатная ведомость (${(payroll / 1e6).toFixed(2)} млн €/тур) превышает доходы (${(income / 1e6).toFixed(2)} млн €/тур) на ${Math.round((ratio - 1) * 100)}%, баланс отрицательный.\n\n` +
        `Санкции:\n• штраф ${(fine / 1e6).toFixed(1)} млн €\n• запрет на покупку игроков на 6 туров\n\nПродайте игроков и разгрузите ведомость.`,
      "совет",
    );
    addNews(g, "club", "⚖", "FFP: санкции!", `Штраф ${(fine / 1e6).toFixed(1)} млн € и трансферный бан на 6 туров. Ведомость превышает доходы на ${Math.round((ratio - 1) * 100)}%.`);
    logHistory(g, `Санкции FFP: штраф ${(fine / 1e6).toFixed(1)} млн €, запрет покупок 6 туров`);
    return;
  }

  // ── Янтарная зона: предупреждения (раз в сезон) ──
  if (g.ffpWarnedSeason === g.season) return;
  if (ratio > 1.25 && team.budget < 2_000_000) {
    g.ffpWarnedSeason = g.season;
    g.boardTrust = Math.max(0, g.boardTrust - 3);
    sendMail(
      g,
      "Финансовый контроль: нарушение правил",
      `Зарплатная ведомость (${(payroll / 1e6).toFixed(2)} млн €/тур) серьёзно превышает доходы (${(income / 1e6).toFixed(2)} млн €/тур).\n\n` +
        `Совет требует: продать игроков с высокими зарплатами или снизить ведомость. При отрицательном балансе последуют санкции — вплоть до запрета трансферов.`,
      "совет",
    );
    addNews(g, "club", "⚖", "FFP: клуб на грани санкций", "Зарплаты превышают доходы на 25%+. Совет требует разгрузить ведомость.");
    logHistory(g, "Предупреждение FFP: ведомость превышает доходы");
  } else if (ratio > 1.15 && chance(0.3)) {
    g.ffpWarnedSeason = g.season;
    sendMail(
      g,
      "Финансовый контроль: замечание",
      `Зарплатная ведомость приближается к критической доле доходов.\n` +
        `Рекомендация совета: не наращивать ведомость в это окно.`,
      "совет",
    );
  }
}

/** Зона FFP для UI: ok | warn | danger */
export function ffpZone(g: GameState): "ok" | "warn" | "danger" {
  if (g.moneyCheat) return "ok";
  const fin = g.lastFinDetail;
  if (!fin) return "ok";
  const payroll = fin.payroll + (fin.staff ?? 0);
  const income = fin.tickets + fin.merch + fin.sponsors + fin.tv + fin.bonus;
  if (income <= 0) return "ok";
  const ratio = payroll / income;
  const team = userTeam(g);
  if (ratio > 1.45 && team.budget < 0) return "danger";
  if (ratio > 1.25 && team.budget < 2_000_000) return "warn";
  return "ok";
}
