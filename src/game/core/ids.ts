/**
 * Генератор уникальных ID игроков и уникальных имён.
 * Счётчик переносится между сессиями через сейв (setCounter).
 */

import { NATION_POOLS } from "../data/names";
import { choice } from "./rng";

let counter = 1;
const usedNames = new Set<string>();

export function nextId(): number {
  const v = counter;
  counter += 1;
  return v;
}

export function setCounter(value: number): void {
  counter = Math.max(counter, value);
}

export function getCounter(): number {
  return counter;
}

export function resetNames(): void {
  usedNames.clear();
}

/** Случайное имя по стране (реалистичные пулы) */
export function randomName(nation: string): string {
  const pool = NATION_POOLS[nation];
  if (!pool || pool.first.length === 0) {
    return `${choice(["Матео", "Джек", "Лука", "Карлос", "Джамал"])} ${choice(["Силва", "Уокер", "Росси", "Мендес", "Диалло"])}`;
  }
  return `${choice(pool.first)} ${choice(pool.last)}`;
}

/** Уникальное имя игрока по стране */
export function uniqueName(nation: string): string {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const name = randomName(nation);
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
  }
  // Крайний случай — добавляем номер
  const fallback = `${randomName(nation)} II`;
  usedNames.add(fallback);
  return fallback;
}
