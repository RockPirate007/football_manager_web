/**
 * Создание нового игрового мира: 5 реальных лиг, составы,
 * календари, национальные кубки и Лига чемпионов.
 * Единственная точка входа для новой карьеры (store и тесты).
 */

import { LEAGUES, ALL_CLUBS, findClub, findLeagueByClub, clubBudget, divisionPair } from "../data/leagues";
import { createTeam, genSquad, applyRolesToTeam, assignSponsor } from "../core/team";
import { randint } from "../core/rng";
import { buildMultiLeagueSchedule } from "./schedule";
import { initAgents } from "./market";
import { initCareerFields, logHistory } from "./career";
import { generateAcademy } from "./academy";
import { initNationalCups, initUcl, initUel } from "./cup";
import { defaultFacilities } from "./facilities";
import { initLeaguePrestige } from "./ligue";
import { defaultSponsorDeal, refreshSponsorOffers } from "./economy";
import { sendMail } from "./mail";
import { genInitialStaff, refreshStaffMarket } from "./staff";
import type { Difficulty, GameState } from "../core/types";

/** Построить мир и вернуть готовое состояние игры */
export function createWorld(
  manager: string,
  clubName: string,
  difficulty: Difficulty = "normal",
  moneyCheat = false,
): GameState {
  const clubDef = findClub(clubName) ?? ALL_CLUBS[0];
  const teams: GameState["teams"] = {};

  for (const league of LEAGUES) {
    for (const club of league.clubs) {
      const t = createTeam(club.name, club.power, league.id);
      t.budget = clubBudget(club.power);
      assignSponsor(t);
      genSquad(t);
      applyRolesToTeam(t);
      genInitialStaff(t);
      teams[club.name] = t;
    }
  }

  const g: GameState = {
    season: 1,
    manager: manager || "Наставник",
    user: clubDef.name,
    round: 0,
    trained: false,
    schedule: buildMultiLeagueSchedule(LEAGUES.map((l) => l.clubs.map((c) => c.name))),
    results: {},
    teams,
    freeAgents: initAgents(),
    staffMarket: [],
    lossStreak: 0,
    pendingPress: null,
    lastFin: null,
    reputation: Math.max(25, Math.min(70, clubDef.power - 20 + randint(-5, 10))),
    boardTrust: 65,
    objectives: [],
    history: [],
    academy: [],
    scoutReports: [],
    scoutedThisRound: false,
    scoutMissions: [],
    youthIntake: null,
    warnings: 0,
    cups: {},
    mail: [],
    archive: [],
    difficulty,
    moneyCheat,
    lastFinDetail: null,
    facilities: defaultFacilities(clubDef.power),
    news: [],
    ffpWarnedSeason: 0,
    leaguePrestige: initLeaguePrestige(),
    sponsorDeal: null,
    sponsorOffers: [],
    ticketPrice: null,
    ffpBanRounds: 0,
    ffpSancSeason: 0,
    boardUltimatum: null,
  };

  // Спонсорский контракт клуба и рынок предложений (Фаза 3)
  const userLeagueId0 = findLeagueByClub(clubDef.name)?.id ?? "eng";
  g.sponsorDeal = defaultSponsorDeal(teams[g.user], g.leaguePrestige[userLeagueId0] ?? 85);
  teams[g.user].sponsor = g.sponsorDeal.name;
  refreshSponsorOffers(g);

  initCareerFields(g, clubDef.power);
  generateAcademy(g, 6);
  initNationalCups(g);
  initUcl(g, true);
  initUel(g, true);
  refreshStaffMarket(g);
  logHistory(g, `Начало карьеры в «${clubDef.name}» (${findLeagueByClub(clubDef.name)?.name ?? "лига"})`);
  sendMail(
    g,
    `Добро пожаловать в «${clubDef.name}»`,
    `Уважаемый ${g.manager}!\nСовет директоров рад вашему назначению.\n` +
      `Домашняя арена: ${clubDef.stadium} (${(clubDef.capacity / 1000).toFixed(1)} тыс. мест).\n` +
      `Впереди национальный чемпионат, кубок страны, Лига Европы и Лига чемпионов. Удачи!`,
    "совет",
  );
  return g;
}

/**
 * Миграция старых сейвов (до v10): мир был только из топ-дивизионов.
 * Создаёт клубы вторых дивизионов и перестраивает календарь.
 * Идемпотентно: на новых сейвах ничего не делает.
 */
export function ensureSecondDivisions(g: GameState): void {
  let added = 0;
  for (const baseId of ["eng", "esp", "ita", "ger", "fra"]) {
    const pair = divisionPair(baseId);
    if (!pair) continue;
    const [, second] = pair;
    const existing = Object.values(g.teams).filter((t) => t.league === second.id);
    if (existing.length > 0) continue;
    for (const club of second.clubs) {
      const t = createTeam(club.name, club.power, second.id);
      t.budget = clubBudget(club.power);
      assignSponsor(t);
      genSquad(t);
      applyRolesToTeam(t);
      genInitialStaff(t);
      g.teams[club.name] = t;
      added += 1;
    }
  }
  if (added > 0) {
    g.schedule = buildMultiLeagueSchedule(
      LEAGUES.map((l) => Object.values(g.teams).filter((t) => t.league === l.id).map((t) => t.name)),
    );
    sendMail(
      g,
      "Мир обновлён: вторые дивизионы",
      `База расширена: добавлено ${added} клубов вторых дивизионов (Чемпионшип, Сегунда, Серия Б, Вторая Бундеслига, Лига 2).\n` +
        `Календарь сезона перестроен, в конце сезона — повышения и понижения.`,
      "мир",
    );
  }
}
