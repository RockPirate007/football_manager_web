/**
 * Тактические установки и их модификаторы.
 */

export interface TacticDef {
  atk: number;
  df: number;
  possession: number;
  pressing: number;
  tempo: number;
  risk: number;
  fatigue: number;
  counter: number;
  description: string;
}

export const TACTICS: Record<string, TacticDef> = {
  "Баланс": {
    atk: 1.00, df: 1.00, possession: 1.00, pressing: 1.00,
    tempo: 1.00, risk: 1.00, fatigue: 1.00, counter: 1.00,
    description: "Без явного перекоса",
  },
  "Высокий прессинг": {
    atk: 1.08, df: 1.06, possession: 1.06, pressing: 1.28,
    tempo: 1.12, risk: 1.12, fatigue: 1.30, counter: 0.92,
    description: "Давление сразу после потери мяча",
  },
  "Контратаки": {
    atk: 1.04, df: 1.08, possession: 0.91, pressing: 0.93,
    tempo: 1.16, risk: 0.96, fatigue: 0.91, counter: 1.35,
    description: "Отдать мяч и быстро атаковать",
  },
  "Владение": {
    atk: 1.03, df: 0.98, possession: 1.25, pressing: 1.04,
    tempo: 0.88, risk: 0.88, fatigue: 1.05, counter: 0.90,
    description: "Контроль мяча и темпа",
  },
  "Атакующий футбол": {
    atk: 1.18, df: 0.88, possession: 1.02, pressing: 1.10,
    tempo: 1.18, risk: 1.24, fatigue: 1.18, counter: 1.05,
    description: "Максимум риска ради голов",
  },
  "Низкий блок": {
    atk: 0.82, df: 1.18, possession: 0.86, pressing: 0.72,
    tempo: 0.78, risk: 0.70, fatigue: 0.82, counter: 1.22,
    description: "Глубокая оборона и экономия сил",
  },
};

export const TACTIC_NAMES = Object.keys(TACTICS);

/** Миграция старых названий тактик из сейвов */
export const TACTIC_MIGRATION: Record<string, string> = {
  "Атака": "Атакующий футбол",
  "Оборона": "Низкий блок",
};
