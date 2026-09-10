/**
 * Утилиты случайности. Единая точка доступа к Random для всей игры.
 */

/** Целое число [lo, hi] включительно */
export function randint(lo: number, hi: number): number {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

/** Случайный элемент массива */
export function choice<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Нормальное распределение (Box–Muller) */
export function gauss(mean: number, std: number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + std * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/** Случайное вещественное [lo, hi) */
export function uniform(lo: number, hi: number): number {
  return lo + Math.random() * (hi - lo);
}

/** True с вероятностью p */
export function chance(p: number): boolean {
  return Math.random() < p;
}

/**
 * Выбор индекса по весам (аналог random.choices).
 * Возвращает -1, если веса пустые.
 */
export function weightedIndex(weights: number[]): number {
  const clean = weights.map((w) => Math.max(0.1, w));
  const total = clean.reduce((s, w) => s + w, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < clean.length; i++) {
    roll -= clean[i];
    if (roll <= 0) return i;
  }
  return clean.length - 1;
}

/** Выбор элемента по весам */
export function weightedChoice<T>(items: T[], weights: number[]): T | null {
  if (items.length === 0) return null;
  const idx = weightedIndex(weights);
  return items[idx];
}

/** Случайная выборка n уникальных элементов (аналог random.sample) */
export function sample<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  const count = Math.min(n, copy.length);
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

/** Перемешивание на месте (Fisher–Yates) */
export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Ограничение значения диапазоном */
export function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

/** Среднее с дефолтом для пустого списка */
export function average(values: number[], fallback = 50.0): number {
  if (values.length === 0) return fallback;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** Округление вниз до тысячи */
export function floor1000(v: number): number {
  return Math.floor(v / 1000) * 1000;
}
