/**
 * Рыночная стоимость и форматирование денег.
 */

import { floor1000 } from "./rng";

/** Базовая рыночная стоимость по рейтингу и возрасту */
export function marketValue(ability: number, age: number): number {
  const base = Math.pow(Math.max(ability, 40) - 30, 2.2) * 600;
  let af: number;
  if (age <= 21) af = 1.6;
  else if (age <= 25) af = 1.25;
  else if (age <= 29) af = 1.0;
  else if (age <= 32) af = 0.55;
  else af = 0.25;
  return Math.max(60_000, floor1000(base * af));
}

/** Компактный формат: «2.35 млн €» / «850 тыс €» */
export function fmtMoney(v: number): string {
  if (Math.abs(v) >= 1_000_000) {
    return `${(v / 1_000_000).toFixed(2)} млн €`;
  }
  return `${Math.round(v / 1000)} тыс €`;
}
