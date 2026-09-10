/**
 * Инфраструктура клуба: стадион, тренировочная база, академия,
 * медицинский центр, фан-шоп. Строительство и апгрейды с реальными
 * эффектами: посещаемость, доходы, восстановление, лечение, молодёжь.
 *
 * Уровни 1–5. Одна стройка одновременно. Деньги списываются при старте.
 */

import { clamp, randint } from "../core/rng";
import { sendMail } from "./mail";
import { logHistory } from "./career";
import { addNews } from "./news";
import {
  FACILITY_META,
  MAX_FACILITY_LEVEL,
  type FacilityKey,
  type Facilities,
  type GameState,
  type Team,
} from "../core/types";

// ─────────────────────── Инициализация ───────────────────────

/** Стартовые уровни по силе клуба: топ-клубы располагают развитой базой */
export function defaultFacilities(clubPower: number): Facilities {
  const lv = Math.max(1, Math.min(4, Math.round((clubPower - 56) / 8) + 1));
  return {
    stadium: clamp(lv + (clubPower >= 82 ? 1 : 0), 1, 5),
    training: clamp(lv, 1, 5),
    academy: clamp(lv, 1, 5),
    medical: clamp(lv, 1, 5),
    shop: clamp(lv - (clubPower >= 75 ? 0 : 1), 1, 5),
    project: null,
  };
}

// ─────────────────────── Стоимость и сроки ───────────────────────

export interface FacilityUpgrade {
  cost: number;
  rounds: number;
}

/** Стоимость и длительность апгрейда до следующего уровня */
export function upgradeCost(fac: Facilities, key: FacilityKey): FacilityUpgrade | null {
  const level = fac[key];
  if (level >= MAX_FACILITY_LEVEL) return null;
  const target = level + 1;
  switch (key) {
    case "stadium":
      return { cost: Math.round((4_000_000 + target * 2_800_000) * 1), rounds: 3 + target };
    case "training":
      return { cost: 1_600_000 + target * 1_400_000, rounds: 3 };
    case "academy":
      return { cost: 1_400_000 + target * 1_200_000, rounds: 3 };
    case "medical":
      return { cost: 1_200_000 + target * 1_000_000, rounds: 2 };
    case "shop":
      return { cost: 1_000_000 + target * 900_000, rounds: 2 };
  }
}

// ─────────────────────── Эффекты уровней ───────────────────────

/** Эффективная вместимость: стадион расширяет трибуны */
export function effectiveCapacity(team: Team, fac: Facilities): number {
  return Math.round(team.capacity * (1 + 0.06 * (fac.stadium - 1)));
}

/** Бонус восстановления за тур (база/фитнес) от тренировочной базы */
export function recoveryBonus(fac: Facilities): number {
  return fac.training - 1;
}

/** Экстра-дни лечения за тур от медицинского центра */
export function medicalBonus(fac: Facilities): number {
  return fac.medical - 1;
}

/** Множитель прогресса на тренировках */
export function trainingMultiplier(fac: Facilities): number {
  return 1 + 0.08 * (fac.training - 1);
}

/** Множитель доходов мерчандайзинга */
export function merchMultiplier(fac: Facilities): number {
  return 1 + 0.15 * (fac.shop - 1);
}

/** Бонус потенциала юниоров академии */
export function academyBonus(fac: Facilities): number {
  return fac.academy - 1;
}

/** Содержание инфраструктуры: расходы за тур */
export function facilityUpkeep(fac: Facilities): number {
  const total = fac.stadium + fac.training + fac.academy + fac.medical + fac.shop;
  return 15_000 * total;
}

// ─────────────────────── Строительство ───────────────────────

/** Запустить стройку. Возвращает сообщение об ошибке или null при успехе */
export function startUpgrade(g: GameState, key: FacilityKey): string | null {
  const fac = g.facilities;
  if (fac.project) return `Стройка уже идёт: ${FACILITY_META[fac.project.key].label}.`;
  const level = fac[key];
  if (level >= MAX_FACILITY_LEVEL) return `${FACILITY_META[key].label} уже максимального уровня.`;
  const up = upgradeCost(fac, key)!;
  const team = g.teams[g.user];
  if (!g.moneyCheat && team.budget < up.cost) {
    return `Не хватает денег: нужно ${(up.cost / 1e6).toFixed(1)} млн €.`;
  }
  if (!g.moneyCheat) team.budget -= up.cost;
  fac.project = { key, targetLevel: level + 1, roundsLeft: up.rounds, cost: up.cost };
  logHistory(g, `Начата стройка: ${FACILITY_META[key].label} → ур. ${level + 1} (${(up.cost / 1e6).toFixed(1)} млн €)`);
  addNews(g, "club", FACILITY_META[key].icon, `Строительство началось: ${FACILITY_META[key].label}`,
    `Клуб инвестировал ${(up.cost / 1e6).toFixed(1)} млн € в модернизацию. Срок — ${up.rounds} нед.`);
  return null;
}

/** Продвижение строек за тур (вызывается в completeRound) */
export function processFacilities(g: GameState): void {
  const fac = g.facilities;
  if (!fac.project) return;
  fac.project.roundsLeft -= 1;
  if (fac.project.roundsLeft > 0) return;

  const { key, targetLevel } = fac.project;
  fac[key] = targetLevel;
  fac.project = null;
  const meta = FACILITY_META[key];
  const label = targetLevel === MAX_FACILITY_LEVEL ? "максимальный уровень!" : `уровень ${targetLevel}`;
  sendMail(g, `${meta.label}: стройка завершена`, `${meta.icon} ${meta.label} вышёл на ${label}.\n\n${meta.effect}.`);
  logHistory(g, `${meta.label} — ${label}`);
  addNews(g, "club", meta.icon, `${meta.label} — ${label}`,
    `Модернизация завершена: ${meta.effect}.`);
  // Лёгкий бонус репутации за развитие клуба
  g.reputation = Math.min(100, g.reputation + 1);
}

/** Смена клуба: инфраструктура пересобирается под новый клуб */
export function reinitFacilities(g: GameState): void {
  g.facilities = defaultFacilities(g.teams[g.user].power);
}

/** Случайное событие стройки: задержка (редкое, для атмосферы) */
export function maybeConstructionDelay(g: GameState): void {
  const fac = g.facilities;
  if (!fac.project || fac.project.roundsLeft <= 0) return;
  if (randint(1, 20) === 1) {
    fac.project.roundsLeft += 1;
    addNews(
      g,
      "club",
      "🚧",
      `Задержка стройки: ${FACILITY_META[fac.project.key].label}`,
      "Поставщики подвели — срок увеличен на неделю.",
    );
  }
}
