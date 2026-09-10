/**
 * Турниры: национальные кубки лиг + Лига чемпионов УЕФА.
 * Ключ кубка = id лиги (национальный кубок) или "ucl".
 */

import { autoLineup } from "../core/team";
import { choice, shuffle } from "../core/rng";
import { LEAGUE_BY_ID, LEAGUES, TOP_LEAGUES, UCL_KEY, UCL_NAME, UEL_KEY, UEL_NAME, leagueBaseId } from "../data/leagues";
import { simulate, type SimulateOptions } from "../engine/simulate";
import { sendMail } from "./mail";
import { logHistory } from "./career";
import { boardCupReaction } from "./board";
import type { CupState, GameState, MatchResult } from "../core/types";

export const CUP_ROUND_NAMES: Record<number, string> = {
  64: "1/32 финала",
  32: "1/16 финала",
  16: "1/8 финала",
  8: "1/4 финала",
  4: "Полуфинал",
  2: "Финал",
};

export function cupStageName(stageSize: number): string {
  return CUP_ROUND_NAMES[stageSize] ?? `Раунд (${stageSize})`;
}

/** Ключ национального кубка команды */
export function nationalCupKey(g: GameState): string {
  return g.teams[g.user].league;
}

/** Каденция турниров: ЛЧ — туры 2/6/10/14, Лига Европы — 3/7/11/15, нац. кубки — 4/8/12/16 */
export function cupDueRound(key: string, round: number): boolean {
  if (round <= 0) return false;
  if (key === UCL_KEY) return round % 4 === 2;
  if (key === UEL_KEY) return round % 4 === 3;
  return round % 4 === 0;
}

/** Все активные (не завершённые) кубки */
export function activeCups(g: GameState): Array<[string, CupState]> {
  return Object.entries(g.cups).filter(([, cup]) => !cup.finished);
}

/** Создать сетку: 16/32/64 слота (недостающие места — bye) */
export function initCup(g: GameState, key: string, name: string, participants: string[]): void {
  const real = shuffle(participants.filter((p) => !!p));
  let size = 16;
  while (size < real.length) size *= 2; // кубок страны: оба дивизиона → сетка 64
  const slots: Array<string | null> = [...real];
  while (slots.length < size) slots.push(null);
  shuffle(slots);

  const fixtures: Array<[string | null, string | null]> = [];
  for (let i = 0; i < size; i += 2) {
    fixtures.push([slots[i], slots[i + 1]]);
  }
  g.cups[key] = { name, fixtures, results: [], champion: null, stageSize: size, finished: false };
}

/** Жеребьёвка национальных кубков: кубок страны объединяет оба дивизиона */
export function initNationalCups(g: GameState): void {
  const byBase: Record<string, string[]> = {};
  for (const league of LEAGUES) {
    const base = leagueBaseId(league.id);
    (byBase[base] ??= []).push(...league.clubs.map((c) => c.name));
  }
  for (const [base, clubs] of Object.entries(byBase)) {
    initCup(g, base, LEAGUE_BY_ID[base].cupName, clubs);
  }
}

/**
 * Участники Лиги чемпионов: топ-3 каждого топ-дивизиона + лучшая 4-я команда.
 * isNewWorld=true — первый сезон: отбор по силе клуба.
 */
export function initUcl(g: GameState, isNewWorld: boolean): void {
  const participants: string[] = [];
  const fourths: Array<{ name: string; score: number }> = [];

  for (const league of TOP_LEAGUES) {
    const leagueId = league.id;
    const teams = Object.values(g.teams).filter((t) => t.league === leagueId);
    const ranked = isNewWorld
      ? [...teams].sort((a, b) => b.power - a.power)
      : [...teams].sort(
          (a, b) =>
            b.pts - a.pts || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf,
        );
    for (const t of ranked.slice(0, 3)) participants.push(t.name);
    const fourth = ranked[3];
    if (fourth) {
      fourths.push({
        name: fourth.name,
        score: isNewWorld ? fourth.power : fourth.pts * 10 + (fourth.gf - fourth.ga),
      });
    }
  }

  // Лучшая из 4-х мест добирает состав сетки до 16
  fourths.sort((a, b) => b.score - a.score);
  if (participants.length < 16 && fourths.length > 0) {
    participants.push(fourths[0].name);
  }

  initCup(g, UCL_KEY, UCL_NAME, participants);
  sendMail(
    g,
    "Лига чемпионов: жеребьёвка",
    "Лучшие клубы пяти лиг скрестили оружие в главном турнире Европы.\n" +
      "Победитель получает 6 млн € и мировую славу.",
    "еврокубки",
  );
}

/**
 * Участники Лиги Европы: места 4–6 всех лиг, не попавшие в ЛЧ
 * (топ-3 каждой лиги + лучшая четвёртая команда).
 */
export function initUel(g: GameState, isNewWorld: boolean): void {
  const uclSet = new Set<string>();
  for (const [a, b] of g.cups[UCL_KEY]?.fixtures ?? []) {
    if (a) uclSet.add(a);
    if (b) uclSet.add(b);
  }

  const candidates: Array<{ name: string; score: number }> = [];
  for (const league of TOP_LEAGUES) {
    const leagueId = league.id;
    const teams = Object.values(g.teams).filter((t) => t.league === leagueId);
    const ranked = isNewWorld
      ? [...teams].sort((a, b) => b.power - a.power)
      : [...teams].sort(
          (a, b) =>
            b.pts - a.pts || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf,
        );
    for (const t of ranked.slice(3, 6)) {
      if (uclSet.has(t.name)) continue;
      candidates.push({
        name: t.name,
        score: isNewWorld ? t.power : t.pts * 10 + (t.gf - t.ga),
      });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const participants = candidates.slice(0, 16).map((c) => c.name);

  initCup(g, UEL_KEY, UEL_NAME, participants);
  sendMail(
    g,
    "Лига Европы: жеребьёвка",
    "Клубы, не попавшие в Лигу чемпионов, сражаются за второй по значимости трофей Европы.\n" +
      "Победитель получает 2,5 млн € и путёвку в элиту на следующий сезон.",
    "еврокубки",
  );
}

/** Готовый исход пары (живой матч): счёт и полный результат */
export interface CupPreOutcome {
  gh: number;
  ga: number;
  result: MatchResult;
}

/** Играть пару. null = bye. preOutcome — готовый результат живого матча. */
export interface CupPairOutcome {
  winner: string | null;
  match: MatchResult | null;
  penalties: boolean;
}

export function resolveCupPair(
  g: GameState,
  key: string,
  a: string | null,
  b: string | null,
  watch: boolean,
  preOutcome?: CupPreOutcome,
): CupPairOutcome {
  if (a === null && b === null) return { winner: null, match: null, penalties: false };
  if (a === null) return { winner: b, match: null, penalties: false };
  if (b === null) return { winner: a, match: null, penalties: false };

  const home = g.teams[a];
  const away = g.teams[b];
  let gh: number;
  let ga: number;
  let result: MatchResult;
  if (preOutcome) {
    // Живой матч уже разыгран — составы и статистика применены сессией
    gh = preOutcome.gh;
    ga = preOutcome.ga;
    result = preOutcome.result;
  } else {
    autoLineup(home);
    autoLineup(away);
    const isUser = g.user === a || g.user === b;
    const opts: SimulateOptions = isUser ? { userTeam: g.user, difficulty: g.difficulty } : {};
    const done = simulate(home, away, false, opts);
    gh = done.gh;
    ga = done.ga;
    result = done.result;
  }

  // Призовые за матч (телемаркетинг турнира)
  const fee = key === UCL_KEY ? 400_000 : key === UEL_KEY ? 200_000 : 120_000;
  home.budget += fee;
  away.budget += fee;

  let winner: string | null;
  let pen = false;
  if (gh > ga) winner = a;
  else if (ga > gh) winner = b;
  else {
    winner = choice([a, b]);
    pen = true;
  }

  g.cups[key]?.results.push({
    a,
    b,
    gh,
    ga,
    winner,
    pen,
    stage: cupStageName(g.cups[key]?.stageSize ?? 16),
  });

  if (g.user === a || g.user === b) {
    const rival = a === g.user ? b : a;
    if (winner === g.user) {
      sendMail(
        g,
        `${g.cups[key].name}: победа над «${rival}»`,
        `Счёт ${gh}:${ga}${pen ? " (пен)" : ""}. Вы в следующем раунде.`,
        "кубок",
      );
    } else {
      sendMail(
        g,
        `${g.cups[key].name}: вылет`,
        `Поражение от «${winner}» ${gh}:${ga}${pen ? " (пен)" : ""}.`,
        "кубок",
      );
      // Совет реагирует на сенсационный вылет от слабого соперника (Фаза 3)
      boardCupReaction(g, winner!, g.cups[key]?.stageSize ?? 16);
    }
  }

  return { winner, match: result, penalties: pen };
}

export interface CupRoundResult {
  userMatch: MatchResult | null;
  lines: string[];
  champion: string | null;
  finished: boolean;
  prize: number;
}

/** Сыграть текущий раунд кубка, собрать следующий.
 *  preUser — готовый исход живого матча пользователя (пара + счёт). */
export function playCupRound(
  g: GameState,
  key: string,
  watch: boolean,
  preUser?: { pair: [string, string]; outcome: CupPreOutcome },
): CupRoundResult {
  const cup = g.cups[key];
  const empty: CupRoundResult = { userMatch: null, lines: [], champion: null, finished: true, prize: 0 };
  if (!cup || cup.finished || cup.fixtures.length === 0) return empty;

  const lines: string[] = [];
  let userMatch: MatchResult | null = null;
  const winners: Array<string | null> = [];

  for (const [a, b] of cup.fixtures) {
    if (a === null && b === null) continue;
    if (a === null) {
      winners.push(b);
      lines.push(`${b} проходит без игры (bye)`);
      continue;
    }
    if (b === null) {
      winners.push(a);
      lines.push(`${a} проходит без игры (bye)`);
      continue;
    }
    const isUser = g.user === a || g.user === b;
    const pre =
      preUser && preUser.pair[0] === a && preUser.pair[1] === b
        ? preUser.outcome
        : undefined;
    const outcome = resolveCupPair(g, key, a, b, watch, pre);
    if (outcome.winner) {
      winners.push(outcome.winner);
      const rec = cup.results[cup.results.length - 1];
      const penMark = rec?.pen ? " (пен)" : "";
      lines.push(`${rec?.a} ${rec?.gh}:${rec?.ga} ${rec?.b}${penMark} → ${outcome.winner}`);
      if (isUser && outcome.match) userMatch = outcome.match;
    }
  }

  // Финал или следующий этап
  if (winners.length <= 1) {
    const champ = winners[0] ?? null;
    cup.champion = champ;
    cup.finished = true;
    cup.fixtures = [];
    let prize = 0;
    if (champ) {
      prize = key === UCL_KEY ? 6_000_000 : key === UEL_KEY ? 2_500_000 : 1_200_000;
      g.teams[champ].budget += prize;
      const cupName = g.cups[key].name;
      sendMail(g, `${cupName}: чемпион — «${champ}»`, `«${champ}» выиграл ${cupName} сезона ${g.season}.`, "кубок");
      if (champ === g.user) {
        logHistory(g, `Победа в ${cupName} (сезон ${g.season})`);
        if (key === UCL_KEY) {
          g.reputation = Math.min(100, g.reputation + 15);
          g.boardTrust = Math.min(100, g.boardTrust + 12);
        } else if (key === UEL_KEY) {
          g.reputation = Math.min(100, g.reputation + 12);
          g.boardTrust = Math.min(100, g.boardTrust + 10);
        } else {
          g.reputation = Math.min(100, g.reputation + 10);
          g.boardTrust = Math.min(100, g.boardTrust + 8);
        }
      }
    }
    return { userMatch, lines, champion: champ, finished: true, prize };
  }

  if (winners.length % 2 === 1) winners.push(null);
  const newFixtures: Array<[string | null, string | null]> = [];
  for (let i = 0; i < winners.length; i += 2) {
    newFixtures.push([winners[i] ?? null, winners[i + 1] ?? null]);
  }
  cup.fixtures = newFixtures;
  cup.stageSize = winners.length;
  lines.push(`Следующий этап: ${cupStageName(cup.stageSize)}`);

  return { userMatch, lines, champion: null, finished: false, prize: 0 };
}

export interface AutoCupProgress {
  userPlays: string[];
  match: MatchResult | null;
}

/**
 * Автоматическое продвижение кубков по каденции:
 * если пользователь участвует — уведомление; иначе — автомат.
 */
export function maybeAutoCupProgress(g: GameState): AutoCupProgress {
  const out: AutoCupProgress = { userPlays: [], match: null };
  for (const [key, cup] of activeCups(g)) {
    if (!cupDueRound(key, g.round)) continue;
    const userIn = cup.fixtures.some(([a, b]) => g.user === a || g.user === b);
    if (userIn) {
      out.userPlays.push(key);
      sendMail(
        g,
        `${cup.name}: ваш матч (${cupStageName(cup.stageSize)})`,
        "Зайдите в раздел «Кубок» и сыграйте раунд — вы участвуете в текущей стадии.",
        "кубок",
      );
      continue;
    }
    const result = playCupRound(g, key, false);
    if (result.userMatch) out.match = result.userMatch;
  }
  return out;
}
