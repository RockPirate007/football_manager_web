/**
 * Сериализация состояния игры + миграции старых сейвов.
 * Мир v13: Фаза 3 — престиж лиг и ТВ-деньги по месту, спонсорские контракты
 * с рынком предложений, билетная политика, жёсткий совет с ультиматумами
 * с дедлайном, FFP-санкции (штраф + запрет покупок).
 * Сейвы v7+ мигрируются автоматически (недостающее — дефолтами).
 */

import { TACTIC_MIGRATION, TACTICS } from "../data/tactics";
import { FORMATIONS } from "../data/formations";
import { ROLES } from "../data/roles";
import { findClub } from "../data/leagues";
import { defaultDetail, isPosDetail, DETAIL_INFO } from "../core/pos";
import { setCounter, resetNames, getCounter } from "../core/ids";
import { defaultBio } from "../core/bio";
import { applyRolesToTeam } from "../core/team";
import { genInitialStaff } from "../systems/staff";
import { defaultFacilities } from "../systems/facilities";
import { initLeaguePrestige } from "../systems/ligue";
import { defaultSponsorDeal, refreshSponsorOffers } from "../systems/economy";
import type { Difficulty, GameState, Player, PlayerInstruction, PosDetail, SetPieces, SponsorDeal, SponsorOffer, Team, TrainFocus } from "../core/types";
import type { PlayerDB, TeamDB } from "./types-db";

export const SAVE_VERSION = 13;

// ─────────────────────────── Игрок ───────────────────────────

export function playerToDB(p: Player): PlayerDB {
  return { ...p };
}

/** Валидировать амплуа: согласованность с группой или дефолт */
function validDetail(v: unknown, pos: Player["pos"]): PosDetail {
  if (isPosDetail(v) && DETAIL_INFO[v].group === pos) return v;
  return defaultDetail(pos);
}

/** Дополнить старые сейвы недостающими полями игрока */
export function migratePlayerData(d: Partial<PlayerDB>): PlayerDB {
  const ability = Math.round(d.ability ?? 60);
  const age = Math.round(d.age ?? 25);
  const pos = d.pos ?? "ПЗ";
  const defaults: PlayerDB = {
    id: d.id ?? 0,
    name: d.name ?? "Игрок",
    pos,
    age,
    ability,
    number: d.number ?? 0,
    bio: d.bio ?? defaultBio(),
    stamina: 100,
    fitness: (d.stamina as number) ?? 100,
    morale: 70,
    form: 0,
    goals: 0,
    assists: 0,
    appearances: 0,
    ratingTotal: 0.0,
    yellowCards: 0,
    redSuspension: 0,
    injuryDays: 0,
    potential: Math.min(95, ability + (age <= 23 ? 8 : 4)),
    pace: ability,
    shooting: ability,
    passing: ability,
    defending: ability,
    goalkeeping: ability,
    role: null,
    contractYears: 1 + Math.floor(Math.random() * 3),
    onLoan: false,
    loanOrigin: null,
    salaryHome: d.salary ?? 20_000,
    value: d.value ?? 0,
    salary: d.salary ?? 20_000,
  };
  const merged: PlayerDB = { ...defaults, ...d, detail: validDetail(d.detail, pos) } as PlayerDB;
  // Вратарю с «плоскими» атрибутами поднять вратарский навык
  if (pos === "ВРТ" && merged.goalkeeping === ability) {
    merged.goalkeeping = Math.min(95, ability + 5);
  }
  return merged;
}

export function playerFromDB(d: Partial<PlayerDB>): Player {
  const m = migratePlayerData(d);
  const num = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return {
    id: Math.round(num(m.id, 0)),
    name: String(m.name ?? "Игрок"),
    pos: m.pos,
    detail: validDetail(m.detail, m.pos),
    age: Math.round(num(m.age, 25)),
    ability: Math.round(num(m.ability, 60)),
    number: Math.round(num(m.number, 0)),
    bio: m.bio ?? defaultBio(),
    stamina: Math.round(num(m.stamina, 100)),
    fitness: Math.round(num(m.fitness, 100)),
    morale: Math.round(num(m.morale, 70)),
    form: Math.round(num(m.form, 0)),
    goals: Math.round(num(m.goals, 0)),
    assists: Math.round(num(m.assists, 0)),
    appearances: Math.round(num(m.appearances, 0)),
    ratingTotal: num(m.ratingTotal, 0),
    yellowCards: Math.round(num(m.yellowCards, 0)),
    redSuspension: Math.round(num(m.redSuspension, 0)),
    injuryDays: Math.round(num(m.injuryDays, 0)),
    potential: Math.round(num(m.potential, m.ability)),
    pace: Math.round(num(m.pace, m.ability)),
    shooting: Math.round(num(m.shooting, m.ability)),
    passing: Math.round(num(m.passing, m.ability)),
    defending: Math.round(num(m.defending, m.ability)),
    goalkeeping: Math.round(num(m.goalkeeping, m.ability)),
    value: Math.round(num(m.value, 0)),
    salary: Math.round(num(m.salary, 20_000)),
    role: typeof m.role === "string" && m.role in (ROLES[m.pos] ?? {}) ? m.role : null,
    contractYears: Math.round(num(m.contractYears, 2)),
    onLoan: Boolean(m.onLoan),
    loanOrigin: m.loanOrigin ?? null,
    salaryHome: Math.round(num(m.salaryHome, m.salary)),
    // Фаза 2: индивидуальные установки, планы, юниорский контракт
    instruction: isInstruction(m.instruction) ? m.instruction : null,
    trainFocus: isTrainFocus(m.trainFocus) ? m.trainFocus : null,
    junior: Boolean(m.junior),
  };
}

const INSTRUCTION_KEYS = ["stay_back", "join_attack", "press_hard", "conserve"] as const;
const TRAIN_FOCUS_KEYS = ["pace", "shooting", "passing", "defending"] as const;

function isInstruction(v: unknown): v is PlayerInstruction {
  return typeof v === "string" && (INSTRUCTION_KEYS as readonly string[]).includes(v);
}

function isTrainFocus(v: unknown): v is TrainFocus {
  return typeof v === "string" && (TRAIN_FOCUS_KEYS as readonly string[]).includes(v);
}

// ─────────────────────────── Команда ───────────────────────────

export function teamToDB(t: Team): TeamDB {
  return { ...t, players: t.players.map(playerToDB) };
}

export function teamFromDB(d: TeamDB): Team {
  const players = d.players.map(playerFromDB);
  // Миграция v8 → v9: стадионы, вместимость, спонсоры; v9 → v10: персонал
  const club = findClub(d.name);
  const t: Team = {
    ...d,
    league: d.league ?? "eng",
    stadium: d.stadium ?? club?.stadium ?? "Домашняя арена",
    capacity: d.capacity ?? club?.capacity ?? 30_000,
    sponsor: d.sponsor ?? "",
    staff: d.staff ?? [],
    setPieces: validSetPieces(d.setPieces),
    players,
    formation: d.formation in FORMATIONS ? d.formation : "4-4-2",
    tactic: d.tactic in TACTICS ? d.tactic : "Баланс",
  };
  // Старый сейв без штата — генерируем персонал
  if (t.staff.length === 0) genInitialStaff(t);
  return t;
}

/** Валидировать исполнителей стандартов (v12): только null или числа */
function validSetPieces(v: unknown): SetPieces {
  const sp = v as Partial<SetPieces> | undefined;
  const id = (x: unknown): number | null =>
    typeof x === "number" && Number.isFinite(x) ? Math.round(x) : null;
  return { freeKick: id(sp?.freeKick), corner: id(sp?.corner) };
}

// ─────────────────────────── Игра ───────────────────────────

export interface SaveData {
  save_version: number;
  season: number;
  manager: string;
  user: string;
  round: number;
  trained: boolean;
  schedule: GameState["schedule"];
  results: GameState["results"];
  teams: Record<string, TeamDB>;
  free_agents: PlayerDB[];
  /** Рынок специалистов (v10) */
  staff_market: GameState["staffMarket"];
  /** Серия поражений (v10) */
  loss_streak: number;
  /** Активная пресс-конференция (v10) */
  pending_press: GameState["pendingPress"];
  idc: number;
  last_fin: [number, number] | null;
  last_fin_detail: GameState["lastFinDetail"];
  reputation: number;
  board_trust: number;
  objectives: GameState["objectives"];
  history: GameState["history"];
  academy: PlayerDB[];
  scout_reports: GameState["scoutReports"];
  scouted_this_round: boolean;
  /** Региональные миссии скаутов (v12) */
  scout_missions: GameState["scoutMissions"];
  /** Последний набор академии (v12) */
  youth_intake: GameState["youthIntake"];
  warnings: number;
  cups: GameState["cups"];
  mail: GameState["mail"];
  archive: GameState["archive"];
  difficulty: Difficulty;
  money_cheat: boolean;
  /** Инфраструктура клуба (v11) */
  facilities: GameState["facilities"];
  /** Лента новостей (v11) */
  news: GameState["news"];
  /** Сезон последнего FFP-предупреждения (v11) */
  ffp_warned_season: number;
  /** Престиж лиг (v13) */
  league_prestige: Record<string, number>;
  /** Действующий спонсорский контракт (v13) */
  sponsor_deal: SponsorDeal | null;
  /** Рынок спонсорских предложений (v13) */
  sponsor_offers: SponsorOffer[];
  /** Цена билета менеджера (v13) */
  ticket_price: number | null;
  /** Осталось туров FFP-запрета покупок (v13) */
  ffp_ban_rounds: number;
  /** Сезон последних FFP-санкций (v13) */
  ffp_sanc_season: number;
  /** Активный ультиматум совета (v13) */
  board_ultimatum: GameState["boardUltimatum"];
}

export function serializeGame(g: GameState): SaveData {
  return {
    save_version: SAVE_VERSION,
    season: g.season,
    manager: g.manager,
    user: g.user,
    round: g.round,
    trained: g.trained,
    schedule: g.schedule,
    results: g.results,
    teams: Object.fromEntries(Object.entries(g.teams).map(([k, t]) => [k, teamToDB(t)])),
    free_agents: g.freeAgents.map(playerToDB),
    staff_market: g.staffMarket,
    loss_streak: g.lossStreak,
    pending_press: g.pendingPress,
    idc: getCounter(),
    last_fin: g.lastFin,
    last_fin_detail: g.lastFinDetail,
    reputation: g.reputation,
    board_trust: g.boardTrust,
    objectives: g.objectives,
    history: g.history,
    academy: g.academy.map(playerToDB),
    scout_reports: g.scoutReports,
    scouted_this_round: g.scoutedThisRound,
    scout_missions: g.scoutMissions ?? [],
    youth_intake: g.youthIntake ?? null,
    warnings: g.warnings,
    cups: g.cups,
    mail: g.mail,
    archive: g.archive,
    difficulty: g.difficulty,
    money_cheat: g.moneyCheat,
    facilities: g.facilities,
    news: g.news,
    ffp_warned_season: g.ffpWarnedSeason,
    league_prestige: g.leaguePrestige ?? {},
    sponsor_deal: g.sponsorDeal ?? null,
    sponsor_offers: g.sponsorOffers ?? [],
    ticket_price: g.ticketPrice ?? null,
    ffp_ban_rounds: g.ffpBanRounds ?? 0,
    ffp_sanc_season: g.ffpSancSeason ?? 0,
    board_ultimatum: g.boardUltimatum ?? null,
  };
}

export function deserializeGame(data: SaveData): GameState {
  resetNames();
  setCounter(data.idc ?? 1);

  const teams: Record<string, Team> = {};
  for (const [name, td] of Object.entries(data.teams)) {
    const t = teamFromDB(td);
    // Миграция старых названий тактик
    if (TACTIC_MIGRATION[t.tactic]) t.tactic = TACTIC_MIGRATION[t.tactic];
    if (!(t.tactic in TACTICS)) t.tactic = "Баланс";
    if (!(t.formation in FORMATIONS)) t.formation = "4-4-2";
    applyRolesToTeam(t);
    teams[name] = t;
  }

  const freeAgents = (data.free_agents ?? []).map(playerFromDB);
  const academy = (data.academy ?? []).map(playerFromDB);
  // Миграция v11 → v12: все юниоры академии считаются на юниорских контрактах
  for (const p of academy) p.junior = true;

  const g: GameState = {
    season: data.season,
    manager: data.manager,
    user: data.user,
    round: data.round,
    trained: data.trained ?? false,
    schedule: data.schedule,
    results: Object.fromEntries(
      Object.entries(data.results ?? {}).map(([k, v]) => [Number(k), v]),
    ),
    teams,
    freeAgents,
    staffMarket: data.staff_market ?? [],
    lossStreak: data.loss_streak ?? 0,
    pendingPress: data.pending_press ?? null,
    lastFin: data.last_fin ?? null,
    reputation: data.reputation ?? 50,
    boardTrust: data.board_trust ?? 65,
    objectives: data.objectives ?? [],
    history: data.history ?? [],
    academy,
    scoutReports: data.scout_reports ?? [],
    scoutedThisRound: data.scouted_this_round ?? false,
    scoutMissions: data.scout_missions ?? [],
    youthIntake: data.youth_intake ?? null,
    warnings: data.warnings ?? 0,
    cups: data.cups ?? {},
    mail: data.mail ?? [],
    archive: data.archive ?? [],
    difficulty: data.difficulty ?? "normal",
    moneyCheat: data.money_cheat ?? false,
    lastFinDetail: data.last_fin_detail
      ? { ...data.last_fin_detail, staff: data.last_fin_detail.staff ?? 0, facility: data.last_fin_detail.facility ?? 0 }
      : null,
    facilities: data.facilities ?? defaultFacilities(data.teams[data.user]?.power ?? 70),
    news: data.news ?? [],
    ffpWarnedSeason: data.ffp_warned_season ?? 0,
    // ── Фаза 3 (v13): престиж, спонсоры, билеты, FFP, ультиматум ──
    leaguePrestige:
      data.league_prestige && Object.keys(data.league_prestige).length > 0
        ? data.league_prestige
        : initLeaguePrestige(),
    sponsorDeal: validSponsorDeal(data.sponsor_deal),
    sponsorOffers: Array.isArray(data.sponsor_offers) ? data.sponsor_offers : [],
    ticketPrice: typeof data.ticket_price === "number" && Number.isFinite(data.ticket_price) ? data.ticket_price : null,
    ffpBanRounds: Math.max(0, Math.round(data.ffp_ban_rounds ?? 0)),
    ffpSancSeason: data.ffp_sanc_season ?? 0,
    boardUltimatum: data.board_ultimatum ?? null,
  };

  // Старый сейв без контракта спонсора — подписываем базовую сделку и наполняем рынок
  if (!g.sponsorDeal && g.teams[g.user]) {
    const team = g.teams[g.user];
    g.sponsorDeal = defaultSponsorDeal(team, g.leaguePrestige[team.league] ?? 85);
    team.sponsor = g.sponsorDeal.name;
    refreshSponsorOffers(g);
  }

  return g;
}

/** Валидация спонсорской сделки из сейва */
function validSponsorDeal(v: unknown): SponsorDeal | null {
  if (!v || typeof v !== "object") return null;
  const d = v as Partial<SponsorDeal>;
  if (typeof d.name !== "string" || typeof d.perRound !== "number") return null;
  return {
    name: d.name,
    perRound: Math.max(0, Math.round(d.perRound)),
    seasonsLeft: Math.max(0, Math.round(d.seasonsLeft ?? 2)),
    placeTarget: Math.max(1, Math.round(d.placeTarget ?? 5)),
    placeBonus: Math.max(0, Math.round(d.placeBonus ?? 0)),
  };
}
