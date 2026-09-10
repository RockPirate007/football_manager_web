/**
 * Доменная модель игрока: фабрика, роли, развитие, состояние.
 * Чистая логика без UI и I/O.
 */

import { ROLES, DEFAULT_ROLES } from "../data/roles";
import { nextId, uniqueName } from "./ids";
import { defaultBio, makeBio } from "./bio";
import { defaultDetail } from "./pos";
import { marketValue } from "./money";
import { chance, choice, floor1000, gauss, randint, clamp } from "./rng";
import type { Player, PlayerBio, PosDetail, Position, RoleEffect } from "./types";

function makePotential(ability: number, age: number): number {
  const ageBonus = age <= 20 ? 8 : age <= 23 ? 5 : 2;
  const ceiling = ability + randint(2, 14) + ageBonus;
  return Math.max(ability, Math.min(95, ceiling));
}

function generateAttributes(p: Player): void {
  const base = p.ability;
  const stat = (delta = 0) =>
    Math.max(35, Math.min(95, Math.round(gauss(base + delta, 5))));

  switch (p.pos) {
    case "ВРТ":
      p.goalkeeping = stat(6);
      p.defending = stat(-4);
      p.passing = stat(-7);
      p.pace = stat(-12);
      p.shooting = stat(-22);
      break;
    case "ЗАЩ":
      p.defending = stat(7);
      p.pace = stat(1);
      p.passing = stat(-2);
      p.shooting = stat(-10);
      p.goalkeeping = stat(-28);
      break;
    case "ПЗ":
      p.passing = stat(6);
      p.pace = stat(0);
      p.shooting = stat(-1);
      p.defending = stat(-2);
      p.goalkeeping = stat(-28);
      break;
    default: // НАП
      p.shooting = stat(8);
      p.pace = stat(4);
      p.passing = stat(-2);
      p.defending = stat(-12);
      p.goalkeeping = stat(-28);
      break;
  }
}

export interface CreatePlayerOptions {
  bio?: PlayerBio;
  number?: number;
  potential?: number;
  contractYears?: number;
  /** Точное амплуа (FIFA-код), по умолчанию выводится из группы */
  detail?: PosDetail;
}

export function createPlayer(
  name: string,
  pos: Position,
  age: number,
  ability: number,
  opts: CreatePlayerOptions = {},
): Player {
  const p: Player = {
    id: nextId(),
    name,
    pos,
    detail: opts.detail ?? defaultDetail(pos),
    age,
    ability: Math.round(ability),

    number: opts.number ?? 0,
    bio: opts.bio ?? defaultBio(),

    stamina: 100,
    fitness: 100,
    morale: randint(62, 82),
    form: 0,

    goals: 0,
    assists: 0,
    appearances: 0,
    ratingTotal: 0.0,
    yellowCards: 0,
    redSuspension: 0,
    injuryDays: 0,

    potential: 0,
    pace: 0,
    shooting: 0,
    passing: 0,
    defending: 0,
    goalkeeping: 0,

    value: 0,
    salary: 0,

    role: null,
    contractYears: opts.contractYears ?? randint(1, 4),
    onLoan: false,
    loanOrigin: null,
    salaryHome: 0,
  };
  p.potential = opts.potential ?? makePotential(p.ability, p.age);
  generateAttributes(p);
  p.value = marketValue(p.ability, p.age);
  p.salary = Math.max(20_000, floor1000(p.value * 0.018));
  p.salaryHome = p.salary;
  return p;
}

/** Случайный игрок для рынка/состава (с биографией по стране) */
export function makePlayer(
  pos: Position,
  ability: number,
  nation?: string,
  club?: string,
  detail?: PosDetail,
): Player {
  const nat = nation ?? "Англия";
  const age = randint(17, 34);
  const p = createPlayer(uniqueName(nat), pos, age, Math.round(ability), { detail });
  p.bio = makeBio(nat, pos, age, club ?? "—");
  return p;
}

/** Обновление рыночной стоимости (зарплата по контракту не трогается) */
export function reprice(p: Player): void {
  const potentialBonus = Math.max(0, p.potential - p.ability) * 0.025;
  const formBonus = p.form * 0.012;
  const moraleBonus = (p.morale - 50) * 0.002;
  const valueFactor = 1.0 + potentialBonus + formBonus + moraleBonus;
  const baseValue = marketValue(p.ability, p.age);
  p.value = Math.max(60_000, floor1000(baseValue * Math.max(0.65, valueFactor)));
  if (!p.salary || p.salary <= 0) {
    p.salary = Math.max(20_000, floor1000(p.value * 0.018));
    p.salaryHome = p.salary;
  }
}

/** Роль по умолчанию для позиции */
export function defaultRoleForPlayer(p: Player): string {
  return DEFAULT_ROLES[p.pos] ?? "Бокс-ту-бокс";
}

/** Валидная роль игрока (или дефолт) */
export function getPlayerRole(p: Player): string {
  const role = p.role || defaultRoleForPlayer(p);
  const group = ROLES[p.pos] ?? {};
  return role in group ? role : defaultRoleForPlayer(p);
}

/** Данные роли (эффекты) */
export function roleData(p: Player): RoleEffect {
  const role = getPlayerRole(p);
  return ROLES[p.pos][role];
}

/** Назначить роль игроку */
export function assignRole(p: Player, role: string): void {
  if (role in ROLES[p.pos]) {
    p.role = role;
  }
}

/** Сила игрока в его роли (взвешенная сумма атрибутов) */
export function roleStrength(p: Player): number {
  switch (p.pos) {
    case "ВРТ":
      return p.goalkeeping * 0.78 + p.passing * 0.08 + p.defending * 0.14;
    case "ЗАЩ":
      return p.defending * 0.58 + p.pace * 0.20 + p.passing * 0.17 + p.shooting * 0.05;
    case "ПЗ":
      return p.passing * 0.46 + p.pace * 0.18 + p.defending * 0.18 + p.shooting * 0.18;
    default:
      return p.shooting * 0.48 + p.pace * 0.27 + p.passing * 0.17 + p.defending * 0.08;
  }
}

/** Доступен ли игрок (не травмирован и не дисквалифицирован) */
export function isAvailable(p: Player): boolean {
  return p.injuryDays <= 0 && p.redSuspension <= 0;
}

/** Средняя оценка за сезон */
export function avgRating(p: Player): number {
  if (p.appearances <= 0) return 0.0;
  return Math.round((p.ratingTotal / p.appearances) * 100) / 100;
}

/** Эффективность в матче (с учётом формы, морали, выносливости) */
export function eff(p: Player): number {
  if (!isAvailable(p)) return 0.0;
  const staminaFactor = 0.72 + 0.28 * (p.stamina / 100);
  const fitnessFactor = 0.70 + 0.30 * (p.fitness / 100);
  const moraleFactor = 0.92 + 0.16 * (p.morale / 100);
  const formFactor = 1.0 + p.form / 100;
  const base = p.ability * 0.48 + roleStrength(p) * 0.52;
  return base * staminaFactor * fitnessFactor * moraleFactor * formFactor;
}

/** Учёт матчевой оценки: форма и мораль */
export function addMatchRating(p: Player, rating: number): void {
  const r = Math.max(1.0, Math.min(10.0, rating));
  p.appearances += 1;
  p.ratingTotal += r;
  if (r >= 8.0) {
    p.form = Math.min(10, p.form + 2);
    p.morale = Math.min(100, p.morale + 4);
  } else if (r >= 7.0) {
    p.form = Math.min(10, p.form + 1);
    p.morale = Math.min(100, p.morale + 1);
  } else if (r < 5.5) {
    p.form = Math.max(-10, p.form - 2);
    p.morale = Math.max(0, p.morale - 4);
  } else if (r < 6.0) {
    p.form = Math.max(-10, p.form - 1);
    p.morale = Math.max(0, p.morale - 1);
  }
}

/** Восстановление между турами */
export function dailyRecovery(p: Player, days = 3): void {
  if (p.injuryDays > 0) {
    p.injuryDays = Math.max(0, p.injuryDays - days);
    p.fitness = Math.min(100, p.fitness + days * 4);
    p.stamina = Math.min(100, p.stamina + days * 3);
    return;
  }
  p.stamina = Math.min(100, p.stamina + days * 5);
  p.fitness = Math.min(100, p.fitness + days * 4);
  if (p.form > 0 && chance(0.25)) p.form -= 1;
  else if (p.form < 0 && chance(0.25)) p.form += 1;
}

/** Короткий текст статуса */
export function shortStatus(p: Player): string {
  if (p.redSuspension > 0) return `ДИСКВ: ${p.redSuspension} матч.`;
  if (p.injuryDays > 0) return `ТРАВМА: ${p.injuryDays} дн.`;
  if (p.fitness < 55) return "НЕ ГОТОВ";
  return "ГОТОВ";
}

/** Шанс роста от тренировки по возрасту */
export function growthChance(age: number): number {
  if (age <= 21) return 0.50;
  if (age <= 25) return 0.35;
  if (age <= 29) return 0.18;
  return 0.06;
}

/** Ожидаемая зарплата при переговорах */
export function desiredSalary(p: Player, years = 3): number {
  const base = Math.max(20_000, floor1000(p.value * 0.018));
  const ageMod = p.age <= 23 ? 1.15 : p.age <= 28 ? 1.05 : 0.92;
  const formMod = 1.0 + p.form * 0.01;
  const yearMod = 1.0 + Math.max(0, years - 2) * 0.04;
  return Math.max(20_000, floor1000(base * ageMod * formMod * yearMod));
}

/** Подпись контракта */
export function signContract(p: Player, years: number, salary: number): void {
  p.contractYears = Math.max(1, Math.min(5, Math.round(years)));
  p.salary = Math.max(20_000, Math.round(salary));
  p.salaryHome = p.salary;
  p.onLoan = false;
  p.loanOrigin = null;
}

/** Текстовая метка контракта */
export function contractLabel(p: Player): string {
  if (p.onLoan) return `аренда ← ${p.loanOrigin ?? "?"}`;
  if (p.contractYears <= 0) return "истекает!";
  return `${p.contractYears} г.`;
}

/** Сезонное развитие игрока (межсезонье) */
export function seasonProgress(p: Player): void {
  p.age += 1;
  if (p.age <= 23) p.ability += randint(1, 3);
  else if (p.age <= 28) p.ability += choice([0, 1, 1]);
  else if (p.age <= 31) p.ability += choice([-1, 0]);
  else p.ability -= randint(2, 4);

  p.ability = clamp(p.ability, 40, 93);
  p.ability = Math.min(p.ability, p.potential);
  if (p.age > 28) {
    p.potential = Math.max(p.ability, p.potential - randint(0, 1));
  }
  p.stamina = 100;
  p.fitness = 100;
  p.form = 0;
  p.morale = Math.max(55, Math.min(85, p.morale + randint(-5, 8)));
  p.goals = 0;
  p.assists = 0;
  p.appearances = 0;
  p.ratingTotal = 0.0;
  p.yellowCards = 0;
  p.redSuspension = 0;
  p.injuryDays = 0;
  if (!p.onLoan) {
    p.contractYears = Math.max(0, p.contractYears - 1);
  }
  reprice(p);
}
