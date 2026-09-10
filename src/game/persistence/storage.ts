/**
 * Хранение сейва в localStorage браузера.
 * v9 — стадионы/спонсоры, сложность, песочница, детальные финансы;
 * сейвы v8 мигрируются автоматически.
 */

import { deserializeGame, serializeGame, type SaveData } from "./serialize";
import { initCareerFields } from "../systems/career";
import { initNationalCups } from "../systems/cup";
import { ensureSecondDivisions } from "../systems/world";
import type { GameState } from "../core/types";

export const SAVE_KEY = "fm_web_save_v10";

export function hasSave(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SAVE_KEY) !== null;
}

/** Сохранить игру. Возвращает true при успехе. */
export function saveGame(g: GameState): boolean {
  try {
    const data = serializeGame(g);
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error("Ошибка сохранения:", e);
    return false;
  }
}

/** Загрузить игру или вернуть null */
export function loadGame(): GameState | null {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    if ((data.save_version ?? 0) < 7) {
      // Сейвы старого мира (до реальных лиг) — несовместимы
      return null;
    }
    const g = deserializeGame(data);
    initCareerFields(g, g.teams[g.user].power);
    if (Object.keys(g.cups).length === 0) initNationalCups(g);
    // Миграция мира: старые сейвы получают вторые дивизионы
    ensureSecondDivisions(g);
    return g;
  } catch (e) {
    console.error("Ошибка загрузки:", e);
    return null;
  }
}

/** Удалить сейв */
export function deleteSave(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(SAVE_KEY);
  }
}
