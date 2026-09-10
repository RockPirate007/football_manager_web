/**
 * Персонал клуба: найм, увольнение, эффекты специалистов.
 * 6 ролей: ассистент, тренер, скаут, физиотерапевт, физио-подготовка, аналитик.
 */

import { STAFF_ROLES, type GameState, type StaffMember, type StaffRole, type Team } from "../core/types";
import { gauss, choice } from "../core/rng";
import { pickNation } from "../data/names";
import { nextId } from "../core/ids";
import { uniqueName } from "../core/ids";

const NATIONS_FALLBACK = ["Англия", "Испания", "Италия", "Германия", "Франция"];

/** Сгенерировать специалиста нужной роли под силу клуба */
export function genStaffMember(role: StaffRole, base: number): StaffMember {
  const ability = Math.round(Math.max(45, Math.min(90, gauss(base, 8))));
  const wage = Math.round((3_000 + ability * 900) / 1000) * 1000;
  let nation = NATIONS_FALLBACK[Math.floor(Math.random() * NATIONS_FALLBACK.length)];
  try {
    nation = pickNation();
  } catch {
    /* фолбэк уже выбран */
  }
  return { id: nextId(), name: uniqueName(nation), role, ability, wage, nation };
}

/** Начальный штат клуба: специалисты слегка слабее силы клуба (есть куда расти) */
export function genInitialStaff(team: Team): void {
  team.staff = STAFF_ROLES.map((role) => genStaffMember(role, team.power - 8));
}

/** Обновить рынок свободных специалистов (раз в тур) */
export function refreshStaffMarket(g: GameState): void {
  const user = g.teams[g.user];
  const base = user ? user.power - 2 : 65;
  const roles: StaffRole[] = [];
  // 2-3 случайные роли + пара случайных
  for (let i = 0; i < 5; i++) {
    roles.push(STAFF_ROLES[Math.floor(Math.random() * STAFF_ROLES.length)]);
  }
  g.staffMarket = roles.map((role) => genStaffMember(role, base + Math.round(gauss(0, 6))));
}

/** Найти специалиста по роли в штате */
export function staffOf(team: Team, role: StaffRole): StaffMember | undefined {
  return team.staff.find((s) => s.role === role);
}

/**
 * Бонус специалиста: 0 при среднем (65) уровне, до ~+25% у элитных
 * и до −15% у слабых. Формула: (ability − 65) / 200.
 */
export function staffBonus(team: Team, role: StaffRole): number {
  const s = staffOf(team, role);
  if (!s) return -0.1; // нет специалиста — штраф
  return (s.ability - 65) / 200;
}

/** Зарплата всего персонала за тур */
export function staffPayroll(team: Team): number {
  return team.staff.reduce((sum, s) => sum + s.wage, 0);
}

/** Сумма компенсаций за увольнение (2 оклада) */
export function staffCompensation(s: StaffMember): number {
  return s.wage * 2;
}

export interface HireStaffResult {
  ok: boolean;
  message: string;
}

/** Найм специалиста с рынка: заменяет действующего (того провожаем) */
export function hireStaff(g: GameState, memberId: number): HireStaffResult {
  const team = g.teams[g.user];
  const idx = g.staffMarket.findIndex((s) => s.id === memberId);
  if (idx === -1) return { ok: false, message: "Специалист недоступен." };
  const member = g.staffMarket[idx];
  const fee = member.wage * 3; // подписной бонус
  if (!g.moneyCheat && team.budget < fee) {
    return { ok: false, message: `Нужно ${fee.toLocaleString("ru-RU")} € на подписной бонус.` };
  }
  if (!g.moneyCheat) team.budget -= fee;
  const outgoing = staffOf(team, member.role);
  team.staff = team.staff.filter((s) => s.role !== member.role);
  team.staff.push(member);
  g.staffMarket.splice(idx, 1);
  // Освободившийся специалист попадает на рынок
  if (outgoing) g.staffMarket.push(outgoing);
  return {
    ok: true,
    message: `${member.name} (${member.ability}) принял приглашение: ${roleLabel(member.role)}.` +
      (outgoing ? ` ${outgoing.name} покинул штаб.` : ""),
  };
}

/** Увольнение специалиста: компенсация 2 оклада */
export function fireStaff(g: GameState, role: StaffRole): HireStaffResult {
  const team = g.teams[g.user];
  const s = staffOf(team, role);
  if (!s) return { ok: false, message: "Должность пуста." };
  const comp = staffCompensation(s);
  if (!g.moneyCheat && team.budget < comp) {
    return { ok: false, message: `Нужна компенсация ${comp.toLocaleString("ru-RU")} €.` };
  }
  if (!g.moneyCheat) team.budget -= comp;
  team.staff = team.staff.filter((x) => x.role !== role);
  return { ok: true, message: `${s.name} покинул клуб (компенсация ${comp.toLocaleString("ru-RU")} €).` };
}

function roleLabel(role: StaffRole): string {
  switch (role) {
    case "assistant": return "ассистент";
    case "coach": return "тренер";
    case "scout": return "скаут";
    case "physio": return "физиотерапевт";
    case "fitness": return "физио-подготовка";
    case "analyst": return "аналитик";
  }
}

/**
 * Ежитурное влияние персонала:
 *  — физиотерапевт ускоряет лечение травм;
 *  — тренер по физподготовке добавляет свежести;
 *  — ассистент поддерживает мораль.
 * Вызывается в prepareRound для команды пользователя.
 */
export function applyStaffEffects(g: GameState): void {
  const team = g.teams[g.user];
  if (!team) return;

  const physio = staffOf(team, "physio");
  const fitness = staffOf(team, "fitness");
  const assistant = staffOf(team, "assistant");

  for (const p of team.players) {
    if (p.injuryDays > 0) {
      const heal = 1 + (physio ? Math.max(0, Math.floor((physio.ability - 55) / 12)) : 0);
      p.injuryDays = Math.max(0, p.injuryDays - heal);
    }
    if (fitness) {
      const boost = Math.max(0, Math.round((fitness.ability - 55) / 5));
      p.stamina = Math.min(100, p.stamina + boost);
      p.fitness = Math.min(100, p.fitness + Math.floor(boost / 2));
    }
    if (assistant && p.morale < 60) {
      p.morale = Math.min(100, p.morale + (assistant.ability >= 75 ? 2 : 1));
    }
  }
}

/** Случайная смена персонала ИИ-клубов в межсезонье (лёгкая ротация) */
export function aiStaffTurnover(g: GameState): void {
  for (const t of Object.values(g.teams)) {
    if (t.name === g.user) continue;
    if (Math.random() < 0.25 && t.staff.length > 0) {
      const idx = Math.floor(Math.random() * t.staff.length);
      t.staff[idx] = genStaffMember(t.staff[idx].role, t.power - 8);
    }
  }
}
