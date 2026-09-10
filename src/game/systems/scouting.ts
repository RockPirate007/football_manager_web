/**
 * Скаутинг: экспресс-разведка (мгновенно) и региональная сеть (Фаза 2).
 *
 * Региональные миссии: скаут отправляется в регион мира, отчёт приходит
 * через несколько туров. Найденные кандидаты попадают на рынок свободных
 * агентов; точность оценки в отчёте зависит от рейтинга скаута в штате.
 * Число параллельных миссий растёт с качеством скаутского штаба.
 */

import { POSITIONS, SCOUT_REGIONS, SCOUT_REGION_IDS } from "../core/types";
import type { Feedback, GameState, ScoutMission, ScoutRegionId, ScoutReport } from "../core/types";
import { makePlayer, assignRole } from "../core/player";
import { pickNation } from "../data/names";
import { randint, choice, chance, gauss, clamp } from "../core/rng";
import { nextId } from "../core/ids";
import { staffOf } from "./staff";
import { sendMail } from "./mail";
import { addNews } from "./news";
import { logHistory } from "./career";
import { makeYouthPlayer } from "./academy";

export const SCOUT_FREE_COST = 80_000;
export const SCOUT_YOUTH_COST = 120_000;

export type ScoutAction = "free" | "youth" | "reports";

export interface ScoutResult extends Feedback {
  found?: Array<{ name: string; pos: string; ability: number; potential: number; value: number }>;
}

// ─────────────────── Региональная сеть ───────────────────

/** Максимум параллельных миссий: 1 базово, +1 при скауте 70+ */
export function maxScoutMissions(g: GameState): number {
  const scout = staffOf(g.teams[g.user], "scout");
  return 1 + (scout && scout.ability >= 70 ? 1 : 0);
}

/** Качество скаутского штаба 0..1 — влияет на точность и объём отчётов */
function scoutQuality(g: GameState): number {
  const scout = staffOf(g.teams[g.user], "scout");
  const analyst = staffOf(g.teams[g.user], "analyst");
  const q = ((scout?.ability ?? 50) * 0.75 + (analyst?.ability ?? 50) * 0.25 - 45) / 45;
  return clamp(q, 0, 1);
}

/** Погрешность оценки в отчёте (±): у слабого штаба до ±8, у элитного ±1 */
function estimateError(g: GameState): number {
  return Math.max(1, Math.round(8 - scoutQuality(g) * 7));
}

/**
 * Отправить миссию в регион. Возвращает сообщение об ошибке или null при успехе.
 * Мутирует состояние (вызывается из store поверх клона).
 */
export function assignScoutMission(g: GameState, regionId: ScoutRegionId): string | null {
  const region = SCOUT_REGIONS[regionId];
  if (!region) return "Неизвестный регион.";
  const team = g.teams[g.user];
  const active = g.scoutMissions ?? [];
  if (active.some((m) => m.region === regionId)) {
    return `Миссия в регионе «${region.label}» уже идёт.`;
  }
  if (active.length >= maxScoutMissions(g)) {
    return "Все скауты заняты. Улучшите специалиста-скаута для второй миссии.";
  }
  if (!g.moneyCheat && team.budget < region.cost) {
    return `Не хватает денег: нужно ${(region.cost / 1000).toFixed(0)} тыс €.`;
  }
  if (!g.moneyCheat) team.budget -= region.cost;

  const scout = staffOf(team, "scout");
  const mission: ScoutMission = {
    id: nextId(),
    region: regionId,
    roundsLeft: region.rounds,
    totalRounds: region.rounds,
    cost: region.cost,
    scoutName: scout?.name ?? "Резервный скаут",
  };
  g.scoutMissions = [...active, mission];
  logHistory(g, `Скауты отправлены: ${region.label} (${region.rounds} тура)`);
  return null;
}

/** Отменить миссию с возвратом половины бюджета */
export function cancelScoutMission(g: GameState, missionId: number): Feedback {
  const idx = (g.scoutMissions ?? []).findIndex((m) => m.id === missionId);
  if (idx === -1) return { ok: false, kind: "error", message: "Миссия не найдена." };
  const m = g.scoutMissions[idx];
  const refund = Math.floor(m.cost / 2);
  if (!g.moneyCheat) g.teams[g.user].budget += refund;
  g.scoutMissions = g.scoutMissions.filter((x) => x.id !== missionId);
  return { ok: true, kind: "info", message: `Миссия отменена, возврат ${(refund / 1000).toFixed(0)} тыс €.` };
}

/**
 * Продвижение миссий за тур (вызывается в completeRound).
 * По завершении выпускает отчёт: кандидаты попадают на рынок,
 * письмо и новость — менеджеру.
 */
export function processScoutMissions(g: GameState): void {
  if (!g.scoutMissions || g.scoutMissions.length === 0) return;
  const err = estimateError(g);
  const q = scoutQuality(g);
  const finished: ScoutMission[] = [];
  for (const m of g.scoutMissions) {
    m.roundsLeft -= 1;
    if (m.roundsLeft <= 0) finished.push(m);
  }
  if (finished.length === 0) return;
  g.scoutMissions = g.scoutMissions.filter((m) => m.roundsLeft > 0);

  for (const m of finished) {
    const region = SCOUT_REGIONS[m.region];
    const team = g.teams[g.user];
    const found: ScoutReport[] = [];
    let count = randint(1, 3) + (q >= 0.7 ? 1 : 0);
    count = Math.min(count, 4);
    for (let i = 0; i < count; i++) {
      const p = makeRegionCandidate(g, m.region);
      g.freeAgents.push(p);
      // Точность отчёта: оценка способности с погрешностью штаба
      const shownAbility = clamp(p.ability + randint(-err, err), 40, 95);
      const shownPotential = clamp(p.potential + randint(-err, err), shownAbility, 95);
      const row: ScoutReport = {
        name: p.name,
        pos: p.pos,
        ability: shownAbility,
        potential: shownPotential,
        value: p.value,
        source: region.label,
        age: p.age,
      };
      found.push(row);
      g.scoutReports.push(row);
    }
    if (g.scoutReports.length > 40) g.scoutReports = g.scoutReports.slice(-40);

    const best = found.reduce((b, r) => (r.potential > b.potential ? r : b), found[0]);
    const lines = found
      .map((r) => `• ${r.name} (${r.age}) [${r.pos}] ${r.ability}→${r.potential} — ${Math.round(r.value / 1000)} тыс €`)
      .join("\n");
    sendMail(
      g,
      `Отчёт из региона: ${region.label}`,
      `Скаут ${m.scoutName} вернулся из региона «${region.label}».\n\n${lines}\n\n` +
        `Кандидаты открыты для переговоров на рынке свободных агентов. Точность оценки: ±${err}.`,
      "скауты",
    );
    logHistory(g, `Скауты вернулись из региона ${region.label}: +${found.length} кандидатов`);
    if (best.potential >= 85 && chance(0.8)) {
      addNews(
        g,
        "world",
        "🔍",
        `Сенсация скаутского рынка: ${best.name}`,
        `Скаутская сеть «${g.user}» обнаружила в регионе ${region.label} талант с потенциалом ${best.potential}. Клубы уже присматриваются.`,
      );
    }
  }
}

/** Кандидат из региона: профиль зависит от специализации региона */
function makeRegionCandidate(g: GameState, regionId: ScoutRegionId) {
  const region = SCOUT_REGIONS[regionId];
  const team = g.teams[g.user];
  const nation = choice(region.nations);
  const pos = choice(POSITIONS);
  const base = clamp(Math.round(gauss(team.power - 7, 7)), 52, 84);
  const [ageMin, ageMax] = region.ageRange;
  const young = ageMax <= 22;

  const p = makePlayer(pos, base, nation, region.label);
  p.age = randint(ageMin, ageMax);
  if (young) {
    // Юные таланты: способность пониже, потенциал заметно выше
    p.ability = Math.max(45, p.ability - randint(2, 6));
    p.potential = Math.min(95, Math.max(p.potential, p.ability + randint(8, 16) + region.talentBoost));
  } else {
    p.potential = Math.min(95, Math.max(p.potential, p.ability + randint(1, 7) + region.talentBoost));
  }
  if (regionId === "afr") {
    p.pace = Math.min(96, p.pace + randint(2, 7));
  }
  if (regionId === "ita") {
    p.defending = Math.min(96, p.defending + randint(1, 5));
  }
  if (regionId === "esp") {
    p.passing = Math.min(96, p.passing + randint(1, 5));
  }
  p.contractYears = randint(1, 3);
  assignRole(p, p.role ?? "");
  return p;
}

// ─────────────────── Экспресс-действия (как раньше) ───────────────────

/** Выполнить действие скаутов */
export function runScouting(g: GameState, action: ScoutAction): ScoutResult {
  const team = g.teams[g.user];

  if (action === "free") {
    if (g.scoutedThisRound) {
      return { ok: false, kind: "warning", message: "В этом туре скауты уже работали." };
    }
    if (team.budget < SCOUT_FREE_COST) {
      return { ok: false, kind: "error", message: "Недостаточно средств." };
    }
    team.budget -= SCOUT_FREE_COST;
    g.scoutedThisRound = true;
    const found: ScoutResult["found"] = [];
    const count = randint(2, 4);
    for (let i = 0; i < count; i++) {
      const ab = randint(62, Math.min(88, 55 + Math.floor(g.reputation / 3)));
      const p = makePlayer(POSITIONS[Math.floor(Math.random() * POSITIONS.length)], ab, pickNation(), g.user);
      g.freeAgents.push(p);
      g.scoutReports.push({
        name: p.name,
        pos: p.pos,
        ability: p.ability,
        potential: p.potential,
        value: p.value,
        source: "свободный",
      });
      found.push({ name: p.name, pos: p.pos, ability: p.ability, potential: p.potential, value: p.value });
    }
    logHistory(g, `Скаутинг: +${found.length} свободных агентов`);
    return {
      ok: true,
      kind: "success",
      message: `Найдено кандидатов: ${found.length}`,
      found,
    };
  }

  if (action === "youth") {
    if (team.budget < SCOUT_YOUTH_COST) {
      return { ok: false, kind: "error", message: "Недостаточно средств." };
    }
    team.budget -= SCOUT_YOUTH_COST;
    const p = makeYouthPlayer(team.power + randint(0, 8), team.league, team.name);
    if (Math.random() < 0.2) {
      p.potential = Math.min(95, p.potential + randint(3, 8));
      p.ability = Math.min(p.ability + 2, p.potential - 5);
    }
    g.academy.push(p);
    logHistory(g, `Скаут нашёл юниора: ${p.name}`);
    return {
      ok: true,
      kind: "success",
      message: `Обнаружен талант: ${p.name} [${p.pos}] ${p.ability}→${p.potential}`,
    };
  }

  return { ok: true, kind: "info", message: "Отчёты скаутов обновлены." };
}

/** Реэкспорт для UI */
export { SCOUT_REGIONS, SCOUT_REGION_IDS };
