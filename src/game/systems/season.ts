/**
 * Конец сезона: награждение по лигам, отчёт совету, кубки,
 * межсезонье, отбор в Лигу чемпионов, новый сезон.
 */

import { seasonProgress, makePlayer, assignRole, signContract, desiredSalary, reprice } from "../core/player";
import { pickNation } from "../data/names";
import { LEAGUES, LEAGUE_BY_ID, UCL_KEY, UEL_KEY, divisionPair, leagueBaseId } from "../data/leagues";
import { userTeam, userPlace, sortedLeagueTable, userLeagueId, userLeagueName } from "../core/state";
import { fixLineup } from "../core/team";
import { randint, choice, gauss, chance } from "../core/rng";
import { POSITIONS } from "../core/types";
import { initNationalCups, initUcl, initUel, playCupRound } from "./cup";
import { settleSeasonObjectives, generateObjectives, logHistory } from "./career";
import { developAcademy, runYouthIntake, generateAcademy } from "./academy";
import { returnLoansEndSeason, processExpiredContracts } from "./transfers";
import { seasonSponsorSettle } from "./economy";
import { recomputePrestige } from "./ligue";
import { sendMail } from "./mail";
import { buildMultiLeagueSchedule } from "./schedule";
import { aiMarketOffseason } from "./market";
import type { GameState, SeasonReport } from "../core/types";

/** Снимок сезона для архива */
export function seasonArchiveEntry(g: GameState) {
  const team = userTeam(g);
  return {
    season: g.season,
    club: team.name,
    league: userLeagueName(g),
    place: userPlace(g),
    pts: team.pts,
    w: team.w,
    d: team.d,
    l: team.l,
    gf: team.gf,
    ga: team.ga,
    budget: team.budget,
    reputation: g.reputation,
    cup: g.cups[leagueBaseId(team.league)]?.champion ?? null,
    manager: g.manager,
  };
}

/**
 * Полный переход между сезонами.
 * Возвращает отчёт для церемонии в UI.
 */
export function endOfSeason(g: GameState): SeasonReport {
  const team = userTeam(g);
  const leagueId = userLeagueId(g);
  const leagueName = userLeagueName(g);
  const leagueTable = sortedLeagueTable(g, leagueId);
  const place = userPlace(g);
  const season = g.season;
  const nTeams = leagueTable.length;

  // Призовые по месту в лиге
  const prize = Math.max(0, nTeams + 2 - place) * 350_000 + (place === 1 ? 1_500_000 : 0);
  team.budget += prize;

  // Итоги спонсорского контракта: бонус за место, истечение, рынок предложений (Фаза 3)
  seasonSponsorSettle(g);

  // Бомбардир лиги пользователя
  const leagueClubs = new Set(leagueTable.map((t) => t.name));
  const leaguePlayers = Object.values(g.teams)
    .filter((t) => leagueClubs.has(t.name))
    .flatMap((t) => t.players);
  let topScorer: { name: string; goals: number } | null = null;
  for (const p of leaguePlayers) {
    if (!topScorer || p.goals > topScorer.goals) {
      topScorer = { name: p.name, goals: p.goals };
    }
  }
  if (topScorer && topScorer.goals === 0) topScorer = null;

  // Отчёт совету
  const boardMessage = settleSeasonObjectives(g);
  const objectiveChecks = settleChecksSnapshot(g);
  if (place === 1) {
    g.reputation = Math.min(100, g.reputation + 10);
    g.boardTrust = Math.min(100, g.boardTrust + 8);
    logHistory(g, `Чемпион ${leagueName} сезона ${season}!`);
    sendMail(g, "Чемпионство!", `«${team.name}» — чемпион лиги сезона ${season}!`, "совет");
  }

  // Чемпионы всех лиг + ЛЧ
  const champions: string[] = [];
  for (const id of Object.keys(LEAGUE_BY_ID)) {
    const table = sortedLeagueTable(g, id);
    if (table[0]) {
      champions.push(`${LEAGUE_BY_ID[id].name}: «${table[0].name}»`);
      if (table[0].name === g.user) continue; // уже поздравлены выше
    }
  }
  sendMail(
    g,
    `Итоги сезона ${season}`,
    champions.join("\n"),
    "система",
  );

  // Доиграть кубки
  for (const [key, cup] of Object.entries(g.cups)) {
    if (!cup.finished) {
      let guard = 0;
      while (!g.cups[key].finished && guard < 8) {
        playCupRound(g, key, false);
        guard += 1;
      }
    }
  }
  const userCupChampion = g.cups[leagueBaseId(leagueId)]?.champion ?? null;
  const uclChampion = g.cups[UCL_KEY]?.champion ?? null;
  const uelChampion = g.cups[UEL_KEY]?.champion ?? null;

  // Архив сезона
  g.archive.push(seasonArchiveEntry(g));
  if (g.archive.length > 30) g.archive = g.archive.slice(-30);

  // Межсезонье: аренды, академия, развитие игроков
  returnLoansEndSeason(g);
  developAcademy(g);
  for (const t of Object.values(g.teams)) {
    for (const p of t.players) seasonProgress(p);
  }
  for (const p of g.freeAgents) seasonProgress(p);

  // Завершение карьеры легенд и появление новых талантов
  retirePlayers(g);
  spawnWonderkids(g);

  // Истёкшие контракты
  processExpiredContracts(g);

  // Живой рынок в межсезонье: ИИ-клубы усиливаются
  aiMarketOffseason(g);

  // Пополнение составов клубов
  topUpSquads(g);

  // Динамика лиг: пересчёт престижа по итогам сезона (до переходов и сброса таблиц)
  recomputePrestige(g);

  // Повышения и понижения между дивизионами (до сброса таблиц и календаря)
  applyPromotionRelegation(g);

  // Сброс таблиц
  for (const t of Object.values(g.teams)) {
    t.w = 0;
    t.d = 0;
    t.l = 0;
    t.gf = 0;
    t.ga = 0;
    t.pts = 0;
    fixLineup(t);
  }

  // Новый сезон
  g.season += 1;
  g.round = 0;
  g.results = {};
  g.trained = false;
  g.scoutedThisRound = false;
  g.schedule = buildMultiLeagueSchedule(
    LEAGUES.map((l) => Object.values(g.teams).filter((t) => t.league === l.id).map((t) => t.name)),
  );

  // Подборка новых свободных агентов
  for (let i = 0; i < 5; i++) {
    const np = makePlayer(choice(POSITIONS), randint(58, 82), pickNation());
    assignRoleIfEmpty(np);
    g.freeAgents.push(np);
  }

  // Новые задачи совета, новые розыгрыши кубков
  g.objectives = generateObjectives(g);
  initNationalCups(g);
  initUcl(g, false); // отбор по итогу прошедшего сезона
  initUel(g, false); // Лига Европы: места 4–6, не попавшие в ЛЧ

  // Приглашение от другого клуба за успешный сезон
  const jobOffer = rollJobOffer(g, place, !!userCupChampion && userCupChampion === team.name, uclChampion === team.name);

  // Межсезонный набор академии: новое поколение с оценкой класса
  if (g.academy.length === 0) {
    generateAcademy(g, randint(5, 7));
  }
  runYouthIntake(g);

  sendMail(
    g,
    `Сезон ${g.season} стартовал`,
    "Новые задачи совета, жеребьёвки кубков и Лиги чемпионов, обновлённый календарь — удачи!",
    "система",
  );

  return {
    season,
    leagueName,
    champion: leagueTable[0].name,
    place,
    teamsCount: nTeams,
    prize,
    budget: team.budget,
    topScorer,
    objectiveChecks,
    boardMessage,
    cupChampion: userCupChampion,
    uclChampion,
    uelChampion,
    jobOffer,
    newSeason: g.season,
  };
}

// ───────────────── Многосезонный мир ─────────────────

/**
 * Переходы между дивизионами: по 3 клуба вверх/вниз в каждой стране.
 * Вызывается после снятия статистики сезона, но до сброса таблиц
 * и построения нового календаря.
 */
function applyPromotionRelegation(g: GameState): void {
  const moved: string[] = [];
  for (const baseId of ["eng", "esp", "ita", "ger", "fra"]) {
    const pair = divisionPair(baseId);
    if (!pair) continue;
    const [top, second] = pair;
    const topTable = sortedLeagueTable(g, top.id);
    const secondTable = sortedLeagueTable(g, second.id);
    if (topTable.length === 0 || secondTable.length === 0) continue;
    const down = topTable.slice(-3);
    const up = secondTable.slice(0, 3);
    for (const t of down) {
      t.league = second.id;
      moved.push(`⬇ «${t.name}» покидает ${top.name} и выбывает в ${second.name}`);
    }
    for (const t of up) {
      t.league = top.id;
      t.budget += 2_000_000; // премия за повышение
      moved.push(`⬆ «${t.name}» добилась повышения в ${top.name}`);
    }
  }
  if (moved.length > 0) {
    logHistory(g, `Смена дивизионов: ${moved.filter((m) => m.startsWith("⬆") && m.includes(g.user)).length > 0 ? "ваш клуб сменил дивизион" : "переходы по стране"}`);
    sendMail(g, "Межсезонье: смены дивизионов", moved.join("\n"), "мир");
    addSeasonNews(g, moved);
  }
}

/** Новости о переходах между дивизионами */
function addSeasonNews(g: GameState, moved: string[]): void {
  for (const line of moved.slice(0, 4)) {
    g.news.push({
      season: g.season - 1,
      round: 0,
      cat: "world",
      icon: line.startsWith("⬆") ? "⬆" : "⬇",
      title: line.startsWith("⬆") ? "Повышение в классе" : "Понижение в классе",
      text: line.replace("⬆ ", "").replace("⬇ ", ""),
    });
  }
  if (g.news.length > 90) g.news = g.news.slice(-90);
}

/** Завершение карьеры: ветераны уходят, знаменитые — с прощальным письмом */
function retirePlayers(g: GameState): void {
  const notable: string[] = [];
  const mine: string[] = [];

  for (const t of Object.values(g.teams)) {
    const leaving = t.players.filter(
      (p) => p.age >= 40 || (p.age >= 36 && chance((p.age - 35) * 0.28)),
    );
    if (leaving.length === 0) continue;
    const leavingIds = new Set(leaving.map((p) => p.id));
    t.players = t.players.filter((p) => !leavingIds.has(p.id));
    t.lineupIds = t.lineupIds.filter((id) => !leavingIds.has(id));
    for (const p of leaving) {
      if (p.ability >= 78) {
        notable.push(`${p.name} (${p.age}) — «${t.name}»`);
      }
      if (t.name === g.user) {
        mine.push(`${p.name} (${p.age}, ${p.detail ?? p.pos})`);
      }
    }
    fixLineup(t);
  }

  // Свободные агенты-ветераны тоже завершают карьеру
  g.freeAgents = g.freeAgents.filter((p) => p.age < 38);

  if (notable.length > 0) {
    sendMail(
      g,
      "Большой футбол прощается с легендами",
      `Завершили карьеру:\n\n${notable.map((s) => `• ${s}`).join("\n")}\n\nСпасибо за годы красоты на поле!`,
      "мир",
    );
    logHistory(g, `Карьеру завершили: ${notable.length} знаменитых игроков`);
  }
  if (mine.length > 0) {
    sendMail(
      g,
      "Ваши ветераны повесили бутсы на гвоздь",
      `Из «${g.user}» уходят:\n\n${mine.map((s) => `• ${s}`).join("\n")}\n\nОсвободившиеся места стоит закрыть на рынке.`,
      "команда",
    );
  }
}

/** Вундеркинды: каждый сезон мир рождает 2 новых таланта */
function spawnWonderkids(g: GameState): void {
  const clubs = Object.values(g.teams).filter((t) => t.name !== g.user);
  if (clubs.length === 0) return;
  const bright: string[] = [];
  for (let i = 0; i < 2; i++) {
    const club = choice(clubs);
    const p = makePlayer(choice(POSITIONS), randint(62, 72), pickNation(club.league), club.name);
    p.age = randint(17, 19);
    p.potential = Math.max(p.potential, randint(84, 92));
    reprice(p);
    assignRoleIfEmpty(p);
    signContract(p, randint(3, 5), desiredSalary(p, 4));
    club.players.push(p);
    if (p.potential >= 88) {
      bright.push(`${p.name} (${p.age}, «${club.name}», потенциал ${p.potential})`);
    }
  }
  if (bright.length > 0) {
    sendMail(
      g,
      "В мире появился новый талант",
      `Скауты трубят о новых именах:\n\n${bright.map((s) => `• ${s}`).join("\n")}\n\nСледите за их прогрессом — возможно, стоит присмотреться.`,
      "мир",
    );
  }
}

/** Приглашение в другой клуб за успешный сезон */
function rollJobOffer(
  g: GameState,
  place: number,
  wonCup: boolean,
  wonUcl: boolean,
): SeasonReport["jobOffer"] {
  const success = place <= 3 || wonCup || wonUcl;
  if (!success) return null;
  if (g.reputation < 68) return null;
  if (!chance(0.4)) return null;

  const mine = userTeam(g);
  const candidates = Object.values(g.teams).filter(
    (t) => t.league !== mine.league && t.power > mine.power + 2,
  );
  if (candidates.length === 0) return null;
  const club = choice(candidates);
  return {
    club: club.name,
    leagueName: LEAGUE_BY_ID[club.league].name,
    power: club.power,
  };
}

function settleChecksSnapshot(g: GameState) {
  // Оценка задач выполняется ДО изменений (внутри settleSeasonObjectives
  // уже записана история), поэтому повторно вычисляем на момент отчёта.
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

function assignRoleIfEmpty(p: ReturnType<typeof makePlayer>): void {
  if (!p.role) {
    assignRole(p, { ВРТ: "Классический вратарь", ЗАЩ: "Центральный защитник", ПЗ: "Бокс-ту-бокс", НАП: "Таран" }[p.pos]);
  }
}

/** Минимальный план состава клуба */
const MIN_SQUAD_PLAN: Record<string, number> = { ВРТ: 2, ЗАЩ: 5, ПЗ: 5, НАП: 4 };
const MIN_SQUAD_SIZE = 16;

/**
 * Межсезонное пополнение: каждый клуб добирает состав из свободных
 * агентов (при нехватке — генерируются новые игроки его уровня).
 */
function topUpSquads(g: GameState): void {
  for (const t of Object.values(g.teams)) {
    // Минимумы по позициям
    for (const pos of ["ВРТ", "ЗАЩ", "ПЗ", "НАП"] as const) {
      let have = t.players.filter((p) => p.pos === pos).length;
      while (have < MIN_SQUAD_PLAN[pos]) {
        const idx = g.freeAgents.findIndex((p) => p.pos === pos && !p.onLoan);
        const p = idx >= 0 ? g.freeAgents.splice(idx, 1)[0] : makePlayer(pos, Math.round(gauss(t.power - 4, 5)), pickNation(t.league), t.name);
        assignRoleIfEmpty(p);
        signContract(p, randint(2, 4), desiredSalary(p, 3));
        t.players.push(p);
        have++;
      }
    }
    // Общий минимум
    while (t.players.length < MIN_SQUAD_SIZE) {
      const pos = choice(["ЗАЩ", "ПЗ", "НАП"] as const);
      const idx = g.freeAgents.findIndex((p) => p.pos === pos && !p.onLoan);
      const p = idx >= 0 ? g.freeAgents.splice(idx, 1)[0] : makePlayer(pos, Math.round(gauss(t.power - 4, 5)), pickNation(t.league), t.name);
      assignRoleIfEmpty(p);
      signContract(p, randint(2, 4), desiredSalary(p, 3));
      t.players.push(p);
    }
    fixLineup(t);
  }
}
