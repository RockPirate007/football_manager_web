/**
 * Роли игроков по позициям и веса позиций в атаке/обороне.
 */

import type { Position } from "../core/types";

export interface RoleDef {
  passing: number;
  defending: number;
  attack: number;
  fatigue: number;
}

export type RoleGroup = Record<string, RoleDef>;

export const ROLES: Record<Position, RoleGroup> = {
  "ВРТ": {
    "Вратарь-либеро": { passing: 1.10, defending: 0.95, attack: 0.10, fatigue: 1.12 },
    "Классический вратарь": { passing: 0.92, defending: 1.08, attack: 0.04, fatigue: 0.92 },
  },
  "ЗАЩ": {
    "Центральный защитник": { passing: 0.96, defending: 1.10, attack: 0.16, fatigue: 0.92 },
    "Защитник с пасом": { passing: 1.14, defending: 0.98, attack: 0.22, fatigue: 1.03 },
    "Атакующий защитник": { passing: 1.05, defending: 0.91, attack: 0.34, fatigue: 1.15 },
  },
  "ПЗ": {
    "Опорник": { passing: 1.02, defending: 1.18, attack: 0.66, fatigue: 1.06 },
    "Плеймейкер": { passing: 1.18, defending: 0.84, attack: 1.08, fatigue: 1.05 },
    "Бокс-ту-бокс": { passing: 1.04, defending: 1.04, attack: 1.02, fatigue: 1.22 },
  },
  "НАП": {
    "Таран": { passing: 0.84, defending: 0.62, attack: 1.18, fatigue: 1.03 },
    "Оттянутый нападающий": { passing: 1.12, defending: 0.70, attack: 1.04, fatigue: 1.06 },
    "Прессингующий форвард": { passing: 0.94, defending: 0.88, attack: 1.08, fatigue: 1.24 },
  },
};

export const DEFAULT_ROLES: Record<Position, string> = {
  "ВРТ": "Классический вратарь",
  "ЗАЩ": "Центральный защитник",
  "ПЗ": "Бокс-ту-бокс",
  "НАП": "Таран",
};

/** Веса позиций для подбора бомбардира / ассистента / защитника */
export const SCORER_POS_BONUS: Record<Position, number> = {
  "ВРТ": 0.02, "ЗАЩ": 0.20, "ПЗ": 0.85, "НАП": 1.70,
};
export const ASSIST_POS_BONUS: Record<Position, number> = {
  "ВРТ": 0.03, "ЗАЩ": 0.38, "ПЗ": 1.60, "НАП": 0.72,
};
export const DEFENDER_POS_BONUS: Record<Position, number> = {
  "ВРТ": 0.15, "ЗАЩ": 1.75, "ПЗ": 0.95, "НАП": 0.28,
};
