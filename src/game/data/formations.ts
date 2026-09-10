/**
 * Игровые схемы (формации) и их модификаторы.
 * Слоты задаются точными амплуа (FIFA-коды), требования по группам
 * вычисляются автоматически — единственный источник правды по составу схемы.
 */

import type { PosDetail, Position } from "../core/types";
import { groupOf } from "../core/pos";

export interface FormationDef {
  /** Точные слоты (ровно 11 позиций FIFA-кодов) */
  slots: PosDetail[];
  /** Производные требования по группам */
  ВРТ: number;
  ЗАЩ: number;
  ПЗ: number;
  НАП: number;
  atk: number;
  df: number;
  possession: number;
  width: number;
  counter: number;
  fatigue: number;
  description: string;
}

type Mods = Pick<
  FormationDef,
  "atk" | "df" | "possession" | "width" | "counter" | "fatigue" | "description"
>;

function def(slots: PosDetail[], mods: Mods): FormationDef {
  const counts: Record<Position, number> = { ВРТ: 0, ЗАЩ: 0, ПЗ: 0, НАП: 0 };
  for (const s of slots) counts[groupOf(s)]++;
  return { slots, ...counts, ...mods };
}

export const FORMATIONS: Record<string, FormationDef> = {
  "4-4-2": def(
    ["GK", "LB", "CB", "CB", "RB", "LM", "CM", "CM", "RM", "ST", "ST"],
    { atk: 1.00, df: 1.00, possession: 1.00, width: 1.00, counter: 1.00, fatigue: 1.00,
      description: "Сбалансированная классика" },
  ),
  "4-3-3": def(
    ["GK", "LB", "CB", "CB", "RB", "DM", "CM", "CM", "LW", "ST", "RW"],
    { atk: 1.10, df: 0.95, possession: 0.98, width: 1.12, counter: 1.08, fatigue: 1.08,
      description: "Широкая атакующая схема" },
  ),
  "4-2-3-1": def(
    ["GK", "LB", "CB", "CB", "RB", "DM", "DM", "LM", "AM", "RM", "ST"],
    { atk: 1.02, df: 1.02, possession: 1.06, width: 1.05, counter: 1.00, fatigue: 1.02,
      description: "Два опорника и ромб атаки" },
  ),
  "5-3-2": def(
    ["GK", "LWB", "CB", "CB", "CB", "RWB", "DM", "CM", "CM", "ST", "ST"],
    { atk: 0.88, df: 1.12, possession: 0.94, width: 0.92, counter: 1.16, fatigue: 0.94,
      description: "Надёжная оборона и контратаки" },
  ),
  "3-5-2": def(
    ["GK", "CB", "CB", "CB", "LM", "DM", "CM", "CM", "RM", "ST", "ST"],
    { atk: 1.08, df: 0.92, possession: 1.12, width: 1.04, counter: 1.02, fatigue: 1.06,
      description: "Контроль центра поля" },
  ),
  "4-1-4-1": def(
    ["GK", "LB", "CB", "CB", "RB", "DM", "LM", "CM", "CM", "RM", "ST"],
    { atk: 0.94, df: 1.06, possession: 1.08, width: 1.06, counter: 0.98, fatigue: 1.00,
      description: "Опорник под двумя линиями четвёрок" },
  ),
  "3-4-3": def(
    ["GK", "CB", "CB", "CB", "LM", "CM", "CM", "RM", "LW", "ST", "RW"],
    { atk: 1.16, df: 0.90, possession: 1.06, width: 1.18, counter: 1.10, fatigue: 1.12,
      description: "Три форварда и смелые фланги" },
  ),
  "4-3-1-2": def(
    ["GK", "LB", "CB", "CB", "RB", "DM", "CM", "CM", "AM", "ST", "ST"],
    { atk: 1.06, df: 1.00, possession: 1.14, width: 0.82, counter: 0.94, fatigue: 1.04,
      description: "Узкий ромб: плеймейкер под дуэтом нападающих" },
  ),
};

export const FORMATION_NAMES = Object.keys(FORMATIONS);

/** Короткая строка слотов схемы: «GK • LB CB CB RB • DM CM CM • LW ST RW» */
export function formationSlotsLabel(f: FormationDef): string {
  const lines: string[][] = [[], [], [], []];
  for (const s of f.slots) lines[s === "GK" ? 0 : groupOf(s) === "ЗАЩ" ? 1 : groupOf(s) === "ПЗ" ? 2 : 3].push(s);
  return lines
    .filter((l) => l.length > 0)
    .map((l) => l.join(" "))
    .join(" • ");
}
