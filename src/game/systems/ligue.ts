/**
 * Динамика лиг (Фаза 3): престиж чемпионатов и ТВ-деньги.
 *  — у каждой лиги есть престиж 0–100, который живёт своей жизнью:
 *    успехи клубов в еврокубках, чемпионство, сила повышающихся
 *    и слабость вылетающих команд двигают шкалу вверх и вниз;
 *  — от престижа зависит пакет ТВ-прав лиги, а внутри лиги деньги
 *    распределяются по месту в таблице (как в реальном футболе);
 *  — престиж также мягко влияет на мерчандайзинг и спонсорский рынок.
 */

import { LEAGUES, LEAGUE_BY_ID, TOP_LEAGUES, divisionPair, isSecondDivision, leagueBaseId } from "../data/leagues";
import { leagueTeams, sortedLeagueTable } from "../core/state";
import { addNews } from "./news";
import { sendMail } from "./mail";
import { LEAGUE_PRESTIGE_BASE } from "../core/types";
import type { GameState } from "../core/types";

/** Стартовый престиж вторых дивизионов — доля от родительского топ-дивизиона */
const SECOND_DIVISION_SHARE = 0.42;

/** Начальная карта престижа для нового мира */
export function initLeaguePrestige(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of LEAGUES) {
    if (isSecondDivision(l.id)) {
      const parent = LEAGUE_BY_ID[leagueBaseId(l.id)];
      out[l.id] = Math.round((LEAGUE_PRESTIGE_BASE[parent?.id ?? "eng"] ?? 80) * SECOND_DIVISION_SHARE * 10) / 10;
    } else {
      out[l.id] = LEAGUE_PRESTIGE_BASE[l.id] ?? 80;
    }
  }
  return out;
}

/** Престиж лиги (с защитным дефолтом для старых миров) */
export function prestigeOf(g: GameState, leagueId: string): number {
  return g.leaguePrestige?.[leagueId] ?? (isSecondDivision(leagueId) ? 38 : 85);
}

/** Множитель ТВ-пакета от престижа: 0.74 у нулевого престижа … 1.0 у сотни */
export function prestigeTvFactor(prestige: number): number {
  return 0.74 + 0.26 * (prestige / 100);
}

/**
 * ТВ-доход клуба за тур: база дивизиона × престиж лиги × доля по месту.
 * Лидер топ-лиги получает ~1.15 базы, аутсайдер ~0.85 — таблица напрямую
 * влияет на кошелёк.
 */
export function tvIncomeFor(g: GameState, leagueId: string, place: number, nTeams: number): number {
  const base = isSecondDivision(leagueId) ? 260_000 : 420_000;
  const pF = prestigeTvFactor(prestigeOf(g, leagueId));
  const plF = nTeams > 1 ? 1.15 - 0.3 * ((place - 1) / (nTeams - 1)) : 1;
  return Math.round(base * pF * plF);
}

/** Короткое название лиги (для писем и новостей) */
function leagueShort(leagueId: string): string {
  return LEAGUE_BY_ID[leagueId]?.short ?? leagueId;
}

/**
 * Пересчёт престижа всех лиг по итогам сезона. Вызывается в endOfSeason
 * ПОСЛЕ доигрывания кубков (нужны чемпионы ЛЧ/ЛЕ), но ДО повышения/понижения
 * и сброса таблиц — чемпион и тройка повышающихся читаются из таблиц.
 */
export function recomputePrestige(g: GameState): void {
  if (!g.leaguePrestige) g.leaguePrestige = initLeaguePrestige();
  const before = { ...g.leaguePrestige };

  for (const base of TOP_LEAGUES) {
    // ── Чемпионство топ-дивизиона ──
    const table = sortedLeagueTable(g, base.id);
    const champ = table[0];
    if (champ) g.leaguePrestige[base.id] = (g.leaguePrestige[base.id] ?? 80) + 1.2;

    // ── Успех в еврокубках ──
    const uclChamp = g.cups["ucl"]?.champion ?? null;
    const uelChamp = g.cups["uel"]?.champion ?? null;
    if (uclChamp && leagueTeams(g, base.id).some((t) => t.name === uclChamp)) {
      g.leaguePrestige[base.id] = (g.leaguePrestige[base.id] ?? 80) + 4;
    }
    if (uelChamp && leagueTeams(g, base.id).some((t) => t.name === uelChamp)) {
      g.leaguePrestige[base.id] = (g.leaguePrestige[base.id] ?? 80) + 2;
    }

    // ── Обмен между дивизионами: сила вылетевших и повысившихся ──
    const second = divisionPair(base.id)?.[1];
    if (second) {
      const teamsTop = leagueTeams(g, base.id);
      if (teamsTop.length > 0) {
        const avgPower = teamsTop.reduce((s, t) => s + t.power, 0) / teamsTop.length;
        // Повысившиеся: в таблице второго дивизиона топ-3 уже сыграла сезон там
        const secondTable = sortedLeagueTable(g, second.id);
        const promoted = secondTable.slice(0, 3);
        if (promoted.length === 3) {
          const promotedAvg = promoted.reduce((s, t) => s + t.power, 0) / 3;
          if (promotedAvg >= avgPower + 3) {
            g.leaguePrestige[base.id] = (g.leaguePrestige[base.id] ?? 80) + 0.8; // сильные новички — лига богаче
            g.leaguePrestige[second.id] = (g.leaguePrestige[second.id] ?? 30) + 0.8;
          } else if (promotedAvg <= avgPower - 6) {
            g.leaguePrestige[base.id] = (g.leaguePrestige[base.id] ?? 80) - 0.5; // слабые выжившие
          }
        }
      }
      // Чемпион второго дивизиона немного тянет и свою лигу
      const secondChamp = sortedLeagueTable(g, second.id)[0];
      if (secondChamp) g.leaguePrestige[second.id] = (g.leaguePrestige[second.id] ?? 30) + 0.5;
    }

    // ── Живой дрейф ──
    g.leaguePrestige[base.id] += (Math.random() - 0.5) * 1.2;
    if (second) g.leaguePrestige[second.id] += (Math.random() - 0.5) * 0.8;
  }

  // Границы и округление до 0.1
  for (const id of Object.keys(g.leaguePrestige)) {
    g.leaguePrestige[id] = Math.round(Math.max(30, Math.min(100, g.leaguePrestige[id])) * 10) / 10;
  }

  // ── Освещение в медиа: крупнейшие изменения ──
  const deltas = Object.keys(g.leaguePrestige)
    .map((id) => ({ id, d: g.leaguePrestige[id] - (before[id] ?? 0) }))
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
  const top = deltas[0];
  if (top && Math.abs(top.d) >= 1.5) {
    const up = top.d > 0;
    const name = LEAGUE_BY_ID[top.id]?.name ?? top.id;
    addNews(
      g,
      "world",
      up ? "📈" : "📉",
      up ? `${name}: престиж растёт` : `${name}: престиж падает`,
      `Индекс ${leagueShort(top.id)} за сезон ${up ? "вырос" : "просел"} на ${Math.abs(top.d).toFixed(1)} пунктов — ` +
        (up ? "клубы лиги играют всё убедительнее." : "уровень матчей вызывает вопросы у спонсоров."),
    );
    if (leagueShort(top.id) === leagueShort(userLeagueSafeId(g))) {
      sendMail(
        g,
        `Динамика лиги: ${up ? "рост" : "падение"} престижа`,
        `Престиж ${LEAGUE_BY_ID[top.id]?.name ?? top.id} за сезон ${up ? "вырос" : "снизился"} на ${Math.abs(top.d).toFixed(1)}.\n` +
          `Это влияет на ТВ-доходы всех клубов лиги и на интерес спонсоров.`,
        "мир",
      );
    }
  }
}

/** ID лиги пользователя без падений на пустом мире */
function userLeagueSafeId(g: GameState): string {
  return g.teams[g.user]?.league ?? "eng";
}
