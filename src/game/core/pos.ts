/**
 * Детальные позиции (FIFA-коды): метаданные, русские названия,
 * матрица совместимости игрока со слотом схемы.
 *
 * Модуль чистый: только типы-зависимости, без импортов домена
 * (используется и данными, и ядром, и движком).
 */

import type { Player, PosDetail, Position } from "./types";

export interface DetailInfo {
  /** Группа позиции (доменная основа движка) */
  group: Position;
  /** Полное русское название амплуа */
  full: string;
  /** Линия: 0 — вратари, 1 — защита, 2 — полузащита, 3 — атака */
  lane: 0 | 1 | 2 | 3;
  /** Фланг */
  side: "L" | "C" | "R";
}

export const DETAIL_INFO: Record<PosDetail, DetailInfo> = {
  GK:  { group: "ВРТ", full: "Вратарь",                          lane: 0, side: "C" },
  CB:  { group: "ЗАЩ", full: "Центральный защитник",             lane: 1, side: "C" },
  LB:  { group: "ЗАЩ", full: "Левый защитник",                   lane: 1, side: "L" },
  RB:  { group: "ЗАЩ", full: "Правый защитник",                  lane: 1, side: "R" },
  LWB: { group: "ЗАЩ", full: "Левый латераль (фланговый защитник)", lane: 1, side: "L" },
  RWB: { group: "ЗАЩ", full: "Правый латераль (фланговый защитник)", lane: 1, side: "R" },
  DM:  { group: "ПЗ",  full: "Опорный полузащитник",             lane: 2, side: "C" },
  CM:  { group: "ПЗ",  full: "Центральный полузащитник",         lane: 2, side: "C" },
  LM:  { group: "ПЗ",  full: "Левый полузащитник",               lane: 2, side: "L" },
  RM:  { group: "ПЗ",  full: "Правый полузащитник",              lane: 2, side: "R" },
  AM:  { group: "ПЗ",  full: "Атакующий полузащитник",           lane: 2, side: "C" },
  LW:  { group: "НАП", full: "Левый вингер",                     lane: 3, side: "L" },
  RW:  { group: "НАП", full: "Правый вингер",                    lane: 3, side: "R" },
  CF:  { group: "НАП", full: "Центральный форвард (ложная девятка)", lane: 3, side: "C" },
  ST:  { group: "НАП", full: "Нападающий",                       lane: 3, side: "C" },
};

/** Все детальные коды (порядок — по линиям) */
export const POS_DETAIL_CODES: PosDetail[] = Object.keys(DETAIL_INFO) as PosDetail[];

export function isPosDetail(v: unknown): v is PosDetail {
  return typeof v === "string" && v in DETAIL_INFO;
}

export function groupOf(d: PosDetail): Position {
  return DETAIL_INFO[d].group;
}

/** Амплуа по умолчанию для группы */
export function defaultDetail(pos: Position): PosDetail {
  switch (pos) {
    case "ВРТ": return "GK";
    case "ЗАЩ": return "CB";
    case "ПЗ": return "CM";
    default: return "ST";
  }
}

/** Деталь игрока с проверкой согласованности группы (защита от битых сейвов) */
export function detailOf(p: { pos: Position; detail?: PosDetail }): PosDetail {
  if (p.detail && isPosDetail(p.detail) && DETAIL_INFO[p.detail].group === p.pos) {
    return p.detail;
  }
  return defaultDetail(p.pos);
}

export function posFullName(d: PosDetail): string {
  return DETAIL_INFO[d].full;
}

// ─────────────────── Совместимость «игрок → слот схемы» ───────────────────

/** Симметричные пары (ключ — отсортированные коды): точная близость амплуа */
const PAIR_FIT: Record<string, number> = {
  // Фланги защиты и латерали
  "LB|LWB": 0.95, "RB|RWB": 0.95,
  "CB|LB": 0.85, "CB|RB": 0.85, "CB|LWB": 0.75, "CB|RWB": 0.75,
  // Полузащита
  "DM|CM": 0.92, "CM|AM": 0.92, "DM|AM": 0.80,
  "LM|CM": 0.85, "RM|CM": 0.85, "LM|AM": 0.80, "RM|AM": 0.80,
  "CB|DM": 0.78,
  // Связка «полузащита ↔ атака»
  "LM|LW": 0.92, "RM|RW": 0.92, "LM|LWB": 0.80, "RM|RWB": 0.80,
  "LW|CF": 0.85, "RW|CF": 0.85, "AM|CF": 0.82, "AM|ST": 0.78,
  "LW|RW": 0.82, "CF|ST": 0.95, "ST|LW": 0.78, "ST|RW": 0.78,
};

function fallbackFit(a: PosDetail, b: PosDetail): number {
  const ia = DETAIL_INFO[a];
  const ib = DETAIL_INFO[b];
  if (ia.lane === 0 || ib.lane === 0) return 0.25; // вратарь в поле и наоборот
  if (ia.lane !== ib.lane) return Math.abs(ia.lane - ib.lane) === 1 ? 0.70 : 0.55;
  return ia.side !== ib.side ? 0.78 : 0.90;
}

/** Насколько игрок с амплуа `playerDetail` подходит на слот `slotDetail` (0..1) */
export function posFit(playerDetail: PosDetail, slotDetail: PosDetail): number {
  if (playerDetail === slotDetail) return 1;
  const key = [playerDetail, slotDetail].sort().join("|");
  if (key in PAIR_FIT) return PAIR_FIT[key];
  return fallbackFit(playerDetail, slotDetail);
}

/** Процент соответствия игрока слоту — для отображения в UI */
export function posFitPercent(p: Player, slot: PosDetail): number {
  return Math.round(posFit(detailOf(p), slot) * 100);
}

// ─────────────────────── Порядок распределения слотов ───────────────────────

/** Редкие/краевые слоты разбираются первыми, центральные — по остатку */
export const SLOT_ASSIGN_ORDER: PosDetail[] = [
  "GK",
  "LWB", "RWB", "LB", "RB",
  "LM", "RM", "LW", "RW",
  "DM", "AM",
  "CB", "CM",
  "CF", "ST",
];

const ORDER_INDEX = new Map(SLOT_ASSIGN_ORDER.map((d, i) => [d, i]));

export function slotOrder(a: PosDetail, b: PosDetail): number {
  return (ORDER_INDEX.get(a) ?? 99) - (ORDER_INDEX.get(b) ?? 99);
}

/** Сортировка слотов для отображения: по линиям, внутри линии — левый→центр→правый */
export function slotDisplayOrder(a: PosDetail, b: PosDetail): number {
  const ia = DETAIL_INFO[a];
  const ib = DETAIL_INFO[b];
  if (ia.lane !== ib.lane) return ia.lane - ib.lane;
  const sideRank = { L: 0, C: 1, R: 2 } as const;
  if (ia.side !== ib.side) return sideRank[ia.side] - sideRank[ib.side];
  return ORDER_INDEX.get(a)! - ORDER_INDEX.get(b)!;
}

// ─────────────────── Ротация амплуа для сгенерированных игроков ───────────────────

/** Циклы амплуа при доборе «глубины» состава: правдоподобный микс на группу */
export const FILLER_CYCLE: Record<Position, PosDetail[]> = {
  ВРТ: ["GK"],
  ЗАЩ: ["CB", "CB", "LB", "RB", "CB", "CB", "LWB", "RWB", "CB", "CB"],
  ПЗ:  ["CM", "CM", "DM", "CM", "AM", "LM", "RM", "DM", "CM", "CM"],
  НАП: ["ST", "ST", "LW", "RW", "ST", "CF", "LW", "RW", "ST", "ST"],
};

export function cycleDetail(pos: Position, index: number): PosDetail {
  const arr = FILLER_CYCLE[pos];
  return arr[((index % arr.length) + arr.length) % arr.length];
}
