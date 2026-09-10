/**
 * Лента новостей: живой медиапоток вокруг клуба, лиги, Европы и мира.
 * Новости генерируются системами игры (результаты, трансферы, стройки,
 * совет, раздевалка, кубки) и читаются в NewsScreen.
 */

import { userTeam, sortedLeagueTable, userLeagueId, userLeagueName, leagueTeams } from "../core/state";
import { TOP_LEAGUES } from "../data/leagues";
import type { FixtureResult, GameState, MatchResult, NewsCat, NewsItem } from "../core/types";

/** Добавить новость в ленту */
export function addNews(
  g: GameState,
  cat: NewsCat,
  icon: string,
  title: string,
  text: string,
): void {
  g.news.push({
    season: g.season,
    round: g.round,
    cat,
    icon,
    title,
    text,
  });
  if (g.news.length > 90) {
    g.news = g.news.slice(-90);
  }
}

/** Новости последнего тура (для виджетов) */
export function latestNews(g: GameState, n = 4): NewsItem[] {
  return g.news.slice(-n).reverse();
}

// ─────────────────── Генерация новостей тура ───────────────────

const RES_HEADLINE: Record<"W" | "D" | "L", string> = {
  W: "Победа!",
  D: "Ничья",
  L: "Поражение",
};

const RES_EMOJI: Record<"W" | "D" | "L", string> = {
  W: "🟢",
  D: "🟡",
  L: "🔴",
};

/**
 * Сгенерировать новости по итогам тура. Вызывается в completeRound
 * после инкремента тура.
 */
export function generateRoundNews(
  g: GameState,
  playedRound: number,
  results: FixtureResult[],
  userMatch: MatchResult | null,
  userRes: "W" | "D" | "L" | null,
): void {
  const team = userTeam(g);
  const leagueId = userLeagueId(g);
  const leagueName = userLeagueName(g);

  // ── Клуб: заголовок матча ──
  if (userMatch && userRes) {
    const strong = userMatch.homeStats.goals * 3 + userMatch.awayStats.goals * 2;
    addNews(
      g,
      "club",
      RES_EMOJI[userRes],
      `${RES_HEADLINE[userRes]}: ${userMatch.home} ${userMatch.homeStats.goals}:${userMatch.awayStats.goals} ${userMatch.away}`,
      strong > 0
        ? `${userMatch.bestHome?.name ?? "—"} и ${userMatch.bestAway?.name ?? "—"} — лучшие в матче. Владение ${userMatch.homeStats.possession}% — ${userMatch.homeStats.possession >= 50 ? "у хозяев" : "у гостей"}.`
        : "Полная статистика доступна в разделе матча.",
    );
  }

  // ── Лига: лидер после тура ──
  const table = sortedLeagueTable(g, leagueId);
  if (table[0]) {
    const gap = table[0].pts - (table[1]?.pts ?? 0);
    addNews(
      g,
      "league",
      "👑",
      `«${table[0].name}» возглавляет ${leagueName}`,
      `После тура ${playedRound + 1}: ${table[0].pts} очк.${gap > 0 ? `, отрыв от преследователя — ${gap} очк.` : ", впереди — по дополнительным показателям"}.`,
    );
  }

  // ── Лига: результат тура (самая крупная победа) ──
  const leagueNames = new Set(leagueTeams(g, leagueId).map((t) => t.name));
  let big: { line: string; diff: number } | null = null;
  for (const [h, a, gh, ga] of results) {
    if (!leagueNames.has(h)) continue;
    const diff = Math.abs(gh - ga);
    if (diff >= 2 && (!big || diff > big.diff)) {
      big = { line: `${h} ${gh}:${ga} ${a}`, diff };
    }
  }
  if (big) {
    addNews(g, "league", "💥", "Гол тура и разгром", `Крупнейший счёт тура: ${big.line}.`);
  }

  // ── Лига: бомбардирская гонка (раз в 4 тура) ──
  if (playedRound % 4 === 3) {
    const scorers = leagueTeams(g, leagueId)
      .flatMap((t) => t.players)
      .sort((a, b) => b.goals - a.goals)
      .slice(0, 2);
    if (scorers[0] && scorers[0].goals > 0) {
      addNews(
        g,
        "league",
        "🎯",
        `Гонка бомбардиров: ${scorers[0].goals} голов`,
        scorers[1]
          ? `${scorers[0].name} («${scorers[0].bio.nation}») опережает ${scorers[1].name} (${scorers[1].goals}).`
          : `${scorers[0].name} — единоличный лидер.`,
      );
    }
  }

  // ── Мир: топ-матч других лиг (раз в 2 тура) ──
  if (playedRound % 2 === 1) {
    const elites = new Set(
      TOP_LEAGUES.flatMap((l) => l.clubs.filter((c) => c.power >= 84).map((c) => c.name)),
    );
    for (const [h, a, gh, ga] of results) {
      if (elites.has(h) && elites.has(a)) {
        addNews(
          g,
          "world",
          "🌍",
          `Топ-матч вечера: ${h} — ${a}`,
          `${gh}:${ga} в противостоянии гигантов. ${gh > ga ? `${h} берёт три очка.` : ga > gh ? `${a} празднует успех.` : "Ничья — интрига сохраняется."}`,
        );
        break;
      }
    }
  }

  // ── Место пользователя: тревожный заголовок при провале ──
  const place = table.findIndex((t) => t.name === team.name) + 1;
  const n = table.length;
  if (place >= n - 2 && playedRound >= 6 && (playedRound % 3 === 0)) {
    addNews(
      g,
      "club",
      "📉",
      "Клуб в зоне вылета",
      `Пресса бьёт тревогу: ${team.name} на ${place}-м месте. Болельщики требуют перемен.`,
    );
  }
}
