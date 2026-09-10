/**
 * База реальных футболистов: структура записи.
 * Возраст и сила откалиброваны на сезон 2024/25.
 */

import type { PosDetail, Position } from "../../core/types";

export interface RealPlayerData {
  name: string;
  /** Группа позиции (ВРТ/ЗАЩ/ПЗ/НАП) — основа матчевого движка */
  pos: Position;
  /** Точное амплуа (FIFA-код: LW, ST, DM, LWB…) */
  detail?: PosDetail;
  age: number;
  ability: number;
  nation: string;
  number?: number;
  /** Карьерный путь */
  career: string;
  /** Реальные достижения и титулы */
  honours?: string;
  /** Стиль игры */
  traits?: string;
  /** Потенциал (для юных звёзд), иначе вычисляется автоматически */
  potential?: number;
}

/** Компактная фабрика записи реального игрока */
export function rp(
  name: string,
  pos: Position,
  age: number,
  ability: number,
  nation: string,
  number: number | undefined,
  career: string,
  honours?: string,
  traits?: string,
  potential?: number,
  detail?: PosDetail,
): RealPlayerData {
  return { name, pos, age, ability, nation, number, career, honours, traits, potential, detail };
}
