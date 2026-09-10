/**
 * Тренировки: командная (одна на тур, пять типов) и индивидуальные планы
 * (Фаза 2: до 3 игроков с фокусом атрибута, развиваются автоматически).
 */

import { reprice, growthChance } from "../core/player";
import { userTeam } from "../core/state";
import { chance } from "../core/rng";
import { trainingMultiplier, recoveryBonus } from "./facilities";
import { staffBonus } from "./staff";
import { trainAcademyGroup } from "./academy";
import { MAX_INDIVIDUAL_PLANS, TRAIN_FOCUS_INFO } from "../core/types";
import type { TrainFocus, Feedback, GameState } from "../core/types";

export type TrainingType = "attack" | "defense" | "fitness" | "recovery" | "youth";

export interface TrainingResult extends Feedback {
  grown: string[];
}

/** Провести командную тренировку. Возвращает сообщение и список выросших игроков. */
export function runTraining(g: GameState, type: TrainingType): TrainingResult {
  const team = userTeam(g);
  const grown: string[] = [];

  if (type === "attack" || type === "defense") {
    const target: string[] = type === "attack" ? ["НАП", "ПЗ"] : ["ВРТ", "ЗАЩ"];
    const mult = trainingMultiplier(g.facilities);
    for (const p of team.players) {
      const ceil = Math.min(93, p.potential);
      if (target.includes(p.pos) && p.ability < ceil && chance(growthChance(p.age) * mult)) {
        p.ability += 1;
        reprice(p);
        grown.push(p.name);
      }
    }
    const message =
      grown.length > 0
        ? `Прогресс: ${grown.join(", ")}`
        : "Никто не вырос, но опыт получен";
    return { ok: true, kind: grown.length > 0 ? "success" : "info", message, grown };
  }

  if (type === "youth") {
    const coach = staffBonus(team, "coach");
    const { grown: youthGrown } = trainAcademyGroup(g, coach);
    const message =
      youthGrown.length > 0
        ? `Академия подтянулась: ${youthGrown.join(", ")}`
        : "Юниоры работали, но скачка силы не вышло";
    return { ok: true, kind: youthGrown.length > 0 ? "success" : "info", message, grown: youthGrown };
  }

  const add = (type === "fitness" ? 12 : 20) + recoveryBonus(g.facilities) * 2;
  for (const p of team.players) {
    p.stamina = Math.min(100, p.stamina + add);
    p.fitness = Math.min(100, p.fitness + Math.floor(add / 2));
  }
  return {
    ok: true,
    kind: "success",
    message: type === "fitness" ? "Команда посвежела!" : "Полное восстановление!",
    grown,
  };
}

// ─────────────────── Индивидуальные планы (Фаза 2) ───────────────────

/** Число игроков с индивидуальным планом в команде пользователя */
export function individualPlansCount(g: GameState): number {
  return userTeam(g).players.filter((p) => p.trainFocus).length;
}

/** Назначить/снять фокус. Возвращает ошибку или null. Мутирует состояние. */
export function setPlayerFocus(g: GameState, playerId: number, focus: TrainFocus | null): string | null {
  const team = userTeam(g);
  const p = team.players.find((x) => x.id === playerId);
  if (!p) return "Игрок не найден.";
  if (focus === null) {
    p.trainFocus = null;
    return null;
  }
  if (!(focus in TRAIN_FOCUS_INFO)) return "Неизвестный фокус.";
  if (p.trainFocus !== focus && individualPlansCount(g) >= MAX_INDIVIDUAL_PLANS) {
    return `Максимум ${MAX_INDIVIDUAL_PLANS} индивидуальных планов.`;
  }
  p.trainFocus = focus;
  return null;
}

/**
 * Еженедельная отработка индивидуальных планов (автоматически за тур,
 * не расходует командную тренировку). Растит целевой атрибут и иногда силу.
 */
export function applyIndividualTraining(g: GameState): void {
  const team = g.teams[g.user];
  if (!team) return;
  const mult = trainingMultiplier(g.facilities) * (1 + staffBonus(team, "coach"));
  for (const p of team.players) {
    const focus = p.trainFocus;
    if (!focus) continue;
    const chanceBase = growthChance(p.age) * 0.55 * mult;
    if (!chance(chanceBase)) continue;
    const attr = TRAIN_FOCUS_INFO[focus].attr as "pace" | "shooting" | "passing" | "defending";
    p[attr] = Math.min(95, p[attr] + 1);
    // Прорыв: атрибут тянет за собой общую силу
    if (chance(0.3) && p.ability < p.potential) {
      p.ability += 1;
    }
    reprice(p);
  }
}

/** Реэкспорт для UI */
export { MAX_INDIVIDUAL_PLANS };
