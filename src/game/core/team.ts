/**
 * Доменная модель команды: фабрика, составы, lineup-логика.
 * Состав собирается из реальных звёзд клуба + сгенерированной глубины.
 */

import { FORMATIONS } from "../data/formations";
import { ROLES, DEFAULT_ROLES } from "../data/roles";
import { LEAGUE_SQUADS, type RealPlayerData } from "../data/players";
import { findClub } from "../data/leagues";
import { pickNation } from "../data/names";
import { assignRole, createPlayer, eff, isAvailable, makePlayer, roleData } from "./player";
import { cycleDetail, detailOf, groupOf, posFit, slotDisplayOrder, slotOrder } from "./pos";
import { makeBio } from "./bio";
import { gauss } from "./rng";
import { POSITIONS, type Player, type PosDetail, type Position, type Team } from "./types";

/** План состава по позициям */
export const SQUAD_PLAN: Record<Position, number> = { ВРТ: 2, ЗАЩ: 7, ПЗ: 7, НАП: 5 };
export const SQUAD_SIZE = 21;

export function createTeam(name: string, power: number, league: string): Team {
  const clubData = findClub(name);
  return {
    name,
    league,
    power,
    budget: Math.round((5 + Math.max(0, power - 62) * 0.6) * 1_000_000),
    stadium: clubData?.stadium ?? "Домашняя арена",
    capacity: clubData?.capacity ?? 30_000,
    sponsor: "",
    players: [],
    staff: [],
    formation: "4-4-2",
    tactic: "Баланс",
    lineupIds: [],
    w: 0,
    d: 0,
    l: 0,
    gf: 0,
    ga: 0,
    pts: 0,
  };
}

/** Пул спонсорских брендов для клубных контрактов */
const SPONSOR_BRANDS = [
  "FlyJet", "TechnoCore", "VistaBank", "AeroPay", "NordLine", "SolarMax",
  "Quantum Foods", "UltraTel", "MetroDrive", "GrandHotel", "PrimeWear", "StarFuel",
  "Zenit Air", "Cristal Water", "Omega Watch", "Helios Energy",
];

/** Пул брендов для спонсорского рынка (используется и экономикой) */
export const SPONSOR_BRAND_POOL: string[] = SPONSOR_BRANDS;

/** Назначить клубу спонсора (вызывается при создании мира) */
export function assignSponsor(team: Team): void {
  const brand = SPONSOR_BRANDS[Math.floor(Math.random() * SPONSOR_BRANDS.length)];
  team.sponsor = brand;
}

/** Игрок из реальных данных звёзды */
export function playerFromReal(rp: RealPlayerData): Player {
  const bio = {
    real: true,
    nation: rp.nation,
    height: 180,
    foot: "Правая" as const,
    career: rp.career,
    honours: rp.honours ?? "",
    traits: rp.traits ?? "",
  };
  const p = createPlayer(rp.name, rp.pos, rp.age, rp.ability, {
    bio,
    number: rp.number ?? 0,
    potential: rp.potential,
    detail: rp.detail,
  });
  return p;
}

/** Назначить игровые номера: реальные — как в жизни, остальные — свободные */
export function normalizeNumbers(team: Team): void {
  const used = new Set<number>();
  const dupes = new Set<number>();
  for (const p of team.players) {
    if (p.number <= 0) continue;
    if (used.has(p.number)) dupes.add(p.number);
    used.add(p.number);
  }
  for (const p of team.players) {
    // Свободный уникальный номер не трогаем; 0 и дубликаты — перевыдать
    if (p.number > 0 && !dupes.has(p.number)) continue;
    let n = 2;
    while (used.has(n)) n++;
    p.number = n;
    used.add(n);
  }
}

/**
 * Сгенерировать состав клуба: реальные звёзды клуба + глубина
 * из сгенерированных игроков с национальными именами и биографиями.
 */
export function genSquad(team: Team): void {
  // 1. Реальные игроки клуба
  const realSquad = LEAGUE_SQUADS[team.league]?.[team.name] ?? [];
  for (const rp of realSquad) {
    const p = playerFromReal(rp);
    p.bio.career = p.bio.career || `«${team.name}» (с 2024)`;
    team.players.push(p);
  }

  // 2. Добор до плана состава (амплуа — правдоподобным миксом по группе).
  // Глубина заметно слабее звёзд: база = сила клуба − 5, потолок = сила − 4,
  // чтобы реальные игроки конкурировали за место в основе честно.
  for (const pos of POSITIONS) {
    let have = team.players.filter((p) => p.pos === pos).length;
    while (have < SQUAD_PLAN[pos]) {
      const shift = [-5, -2, 0, 0, 2, 4][Math.floor(Math.random() * 6)];
      const cap = Math.min(88, team.power - 4);
      const ab = Math.round(gauss(team.power - 5 + shift, 5));
      const clamped = Math.max(42, Math.min(cap, ab));
      const nation = pickNation(team.league);
      const filler = makePlayer(pos, clamped, nation, team.name, cycleDetail(pos, have));
      team.players.push(filler);
      have++;
    }
  }

  // 3. Номера распределяем всем (уникальные в рамках клуба)
  normalizeNumbers(team);
  autoLineup(team);
}

/** Сила игрока с учётом соответствия слоту схемы (0..1 × эффективность) */
export function effAtSlot(p: Player, slot: PosDetail): number {
  return eff(p) * posFit(detailOf(p), slot);
}

/** Небольшой приоритет реальных звёзд при близкой силе с глубиной состава */
function starBonus(p: Player): number {
  return p.bio?.real ? 1.5 : 0;
}

/**
 * Автоматический сбор состава: слоты схемы заполняются лучшими по
 * совместимости (амплуа + эффективность). При нехватке на группу —
 * аварийный дозабор любых доступных игроков.
 */
export function autoLineup(team: Team): Player[] {
  const formation = FORMATIONS[team.formation] ?? FORMATIONS["4-4-2"];
  const used = new Set<number>();
  const out: Player[] = [];

  const slots = [...formation.slots].sort(slotOrder);
  for (const slot of slots) {
    const group = groupOf(slot);
    let pool = team.players
      .filter((p) => p.pos === group && !used.has(p.id) && isAvailable(p));
    if (pool.length === 0) {
      // Аварийный дозабор: линия пуста — берём любого доступного
      pool = team.players.filter((p) => !used.has(p.id) && isAvailable(p));
    }
    pool.sort(
      (a, b) => effAtSlot(b, slot) + starBonus(b) - (effAtSlot(a, slot) + starBonus(a)),
    );
    const pick = pool[0];
    if (pick) {
      out.push(pick);
      used.add(pick.id);
    }
  }

  team.lineupIds = out.map((p) => p.id);
  return out;
}

/** Строгая проверка: состав из 11 игроков соответствует схеме */
export function currentElevenStrict(team: Team): Player[] | null {
  const byId = new Map(team.players.map((p) => [p.id, p]));
  const eleven = team.lineupIds
    .map((id) => byId.get(id))
    .filter((p): p is Player => p !== undefined);
  const need = FORMATIONS[team.formation] ?? FORMATIONS["4-4-2"];
  const cnt: Record<string, number> = {};
  for (const p of eleven) cnt[p.pos] = (cnt[p.pos] ?? 0) + 1;
  const ok =
    eleven.length === 11 && POSITIONS.every((pos) => (cnt[pos] ?? 0) === need[pos]);
  return ok ? eleven : null;
}

/** Основной состав (со строгой проверкой, иначе пересбор) */
export function getEleven(team: Team): Player[] {
  const eleven = currentElevenStrict(team);
  if (eleven === null) {
    return autoLineup(team);
  }
  return eleven;
}

/** Раскладка стартового состава по слотам схемы с процентом соответствия */
export interface SlotAssignment {
  slot: PosDetail;
  player: Player;
  /** Совместимость амплуа и слота, 0..1 */
  fit: number;
}

export function assignSlots(team: Team, elevenArg?: Player[]): SlotAssignment[] {
  const formation = FORMATIONS[team.formation] ?? FORMATIONS["4-4-2"];
  const byId = new Map(team.players.map((p) => [p.id, p]));
  const eleven = elevenArg ?? team.lineupIds
    .map((id) => byId.get(id))
    .filter((p): p is Player => p !== undefined);

  const used = new Set<number>();
  const out: SlotAssignment[] = [];
  const slots = [...formation.slots].sort(slotOrder);

  for (const slot of slots) {
    const group = groupOf(slot);
    let best: Player | null = null;
    let bestVal = -1;
    for (const p of eleven) {
      if (used.has(p.id)) continue;
      if (p.pos !== group) continue;
      const v = effAtSlot(p, slot);
      if (v > bestVal) {
        bestVal = v;
        best = p;
      }
    }
    if (best === null) {
      // Аварийно: любой свободный (перестановка между линиями)
      for (const p of eleven) {
        if (used.has(p.id)) continue;
        const v = effAtSlot(p, slot);
        if (v > bestVal) {
          bestVal = v;
          best = p;
        }
      }
    }
    if (best === null) continue;
    used.add(best.id);
    out.push({ slot, player: best, fit: posFit(detailOf(best), slot) });
  }

  // Отображение: по линиям, слева направо
  return out.sort((a, b) => slotDisplayOrder(a.slot, b.slot));
}

/** Починить состав при необходимости. Возвращает true, если пересобран. */
export function fixLineup(team: Team): boolean {
  // Целостность заявок: уникальные номера после трансферов/аренд
  normalizeNumbers(team);
  if (currentElevenStrict(team) === null) {
    autoLineup(team);
    return true;
  }
  return false;
}

/** Убедиться, что у всех игроков команды валидная роль */
export function applyRolesToTeam(team: Team): void {
  for (const p of team.players) {
    if (!p.role || !(p.role in (ROLES[p.pos] ?? {}))) {
      assignRole(p, DEFAULT_ROLES[p.pos]);
    }
  }
}

/** Суммарная зарплата команды за тур */
export function teamPayroll(team: Team): number {
  return team.players.reduce((s, p) => s + p.salary, 0);
}

/** Данные роли игрока команды (для движка) */
export function playerRoleData(p: Player) {
  return roleData(p);
}

/** Сыгранные матчи команды */
export function teamPlayed(team: Team): number {
  return team.w + team.d + team.l;
}

/** Уникальный номер для нового игрока команды */
export function nextFreeNumber(team: Team): number {
  const used = new Set(team.players.map((p) => p.number));
  let n = 2;
  while (used.has(n)) n++;
  return n;
}

/** Биография для юниора академии */
export function youthBio(league: string, club: string, pos: Position): Player["bio"] {
  return makeBio(pickNation(league), pos, 17, club);
}
