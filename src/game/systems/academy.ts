/**
 * Молодёжная академия: возрастные группы U17/U19, юниорские контракты,
 * наборы с оценкой класса поколения, развитие в межсезонье и на тренировках.
 *
 * Юниоры живут на дешёвых «юниорских» контрактах; при переводе в основу
 * автоматически подписывается профессиональный контракт.
 */

import { POSITIONS } from "../core/types";
import { academyGroupOf } from "../core/types";
import { assignRole, createPlayer, reprice } from "../core/player";
import { uniqueName } from "../core/ids";
import { pickNation } from "../data/names";
import { makeBio } from "../core/bio";
import { randint, chance, clamp } from "../core/rng";
import { academyBonus } from "./facilities";
import { sendMail } from "./mail";
import { addNews } from "./news";
import { logHistory } from "./career";
import type { Feedback, GameState, Player, YouthIntake } from "../core/types";

/** Юниор академии: молодой, с высоким потенциалом, на юниорском контракте */
export function makeYouthPlayer(clubPower: number, leagueId?: string, clubName?: string, acadBonus = 0): Player {
  const pos = POSITIONS[Math.floor(Math.random() * POSITIONS.length)];
  const ab = Math.round(randint(clubPower - 18 - 4, clubPower - 18 + 6) + acadBonus);
  const clamped = Math.max(40, Math.min(68, ab));
  const nation = leagueId ? pickNation(leagueId) : pickNation();
  const p = createPlayer(uniqueName(nation), pos, randint(15, 18), clamped);
  p.potential = Math.min(95, Math.max(p.potential, p.ability + randint(10, 22) + acadBonus));
  p.contractYears = randint(2, 4);
  // Юниорский контракт: зарплата в 2–3 раза ниже взрослой
  p.junior = true;
  p.salary = Math.max(8_000, Math.floor((p.value * 0.005) / 1000) * 1000);
  p.salaryHome = p.salary;
  p.morale = randint(70, 90);
  p.bio = makeBio(nation, pos, p.age, clubName ? `${clubName} (академия)` : "Академия");
  assignRole(p, p.role ?? "");
  return p;
}

/** Набрать группу юниоров (уровень академии повышает качество набора) */
export function generateAcademy(g: GameState, n = 6): Player[] {
  const team = g.teams[g.user];
  const bonus = academyBonus(g.facilities);
  g.academy = Array.from({ length: n }, () =>
    makeYouthPlayer(team.power, team.league, team.name, bonus),
  );
  return g.academy;
}

/**
 * Межсезонный набор: новое поколение юниоров с оценкой класса.
 * Качество зависит от уровня академии и тренерского штата.
 */
export function runYouthIntake(g: GameState): YouthIntake {
  const team = g.teams[g.user];
  const bonus = academyBonus(g.facilities);
  const n = randint(4, 6);
  const batch = Array.from({ length: n }, () =>
    makeYouthPlayer(team.power, team.league, team.name, bonus + randint(0, 3)),
  );
  g.academy = [...g.academy, ...batch];

  // Оценка класса поколения — по среднему потолку набора относительно силы клуба
  const avgPotential = batch.reduce((s, p) => s + p.potential, 0) / batch.length;
  const delta = avgPotential - team.power;
  const grade =
    delta >= 9 ? "выдающийся" :
    delta >= 5 ? "отличный" :
    delta >= 1 ? "хороший" : "средний";

  const best = batch.reduce((b, p) => (p.potential > b.potential ? p : b), batch[0]);
  const intake: YouthIntake = {
    season: g.season,
    grade,
    count: n,
    bestName: best.name,
    bestPotential: best.potential,
  };
  g.youthIntake = intake;

  const gradeIcon =
    grade === "выдающийся" ? "🌟" : grade === "отличный" ? "⭐" : grade === "хороший" ? "✔" : "·";
  sendMail(
    g,
    `Набор академии: ${grade} класс поколения`,
    `${gradeIcon} Выпускная группа академии этого лета — ${grade}.\n` +
      `Принято ${n} юниоров (U17/U19) на юниорских контрактах.\n` +
      `Лучший в наборе: ${best.name} (${best.pos}, потенциал ${best.potential}).\n\n` +
      `Юниоры с потенциалом стоит переводить в основу — профессиональный контракт подпишется автоматически.`,
    "академия",
  );
  addNews(
    g,
    "club",
    "🎓",
    `Академия: ${grade} набор`,
    `В академию принято ${n} юниоров. Скауты отмечают ${best.name} (${best.potential} потенциала).`,
  );
  logHistory(g, `Набор академии (${grade}): ${n} юниоров`);

  // Академия не бездонная: держим не более 12 юниоров, старые выпускаются
  if (g.academy.length > 12) {
    const overflow = g.academy.slice(0, g.academy.length - 12);
    g.academy = g.academy.slice(-12);
    for (const p of overflow) {
      p.junior = false;
      g.freeAgents.push(p);
    }
  }
  return intake;
}

/** Развитие юниоров в межсезонье */
export function developAcademy(g: GameState): void {
  const bonus = g.facilities ? academyBonus(g.facilities) : 0;
  for (const p of g.academy) {
    p.age += 1;
    const gain = (p.age <= 19 ? randint(1, 4) : randint(0, 2)) + randint(0, bonus);
    p.ability = Math.min(p.potential, p.ability + gain);
    p.stamina = 100;
    p.fitness = 100;
    reprice(p);
  }
  const stay: Player[] = [];
  const leave: Player[] = [];
  for (const p of g.academy) {
    if (p.age >= 21) leave.push(p);
    else stay.push(p);
  }
  g.academy = stay;
  for (const p of leave) {
    p.junior = false;
    g.freeAgents.push(p);
    logHistory(g, `Юниор выпущен: ${p.name}`);
  }
}

/**
 * Перевод юниора в основу: подписывается профессиональный контракт
 * (3 года, зарплата ~3× юниорской). Возвращает Feedback для тоста.
 * Мутирует состояние (вызывается из store поверх клона).
 */
export function promoteYouthToSquad(g: GameState, playerId: number): Feedback {
  const team = g.teams[g.user];
  const idx = g.academy.findIndex((x) => x.id === playerId);
  if (idx === -1) return { ok: false, kind: "error", message: "Юниор не найден." };
  if (team.players.length >= 28) {
    return { ok: false, kind: "error", message: "Заявка переполнена (макс. 28)." };
  }
  const p = g.academy.splice(idx, 1)[0];
  const juniorSalary = p.salary;
  p.junior = false;
  p.contractYears = 3;
  p.salary = Math.max(25_000, juniorSalary * 3);
  p.salaryHome = p.salary;
  p.morale = Math.min(100, p.morale + 10);
  p.bio.career = p.bio.career
    ? `${p.bio.career} → основа «${team.name}»`
    : `Академия «${team.name}» → основа`;
  team.players.push(p);
  logHistory(g, `Профконтракт: ${p.name} переведён в основу (${Math.round(p.salary / 1000)} тыс €/тур)`);
  return {
    ok: true,
    kind: "success",
    message: `${p.name} подписал профконтракт (3 года, ${Math.round(p.salary / 1000)} тыс €) и в основной команде!`,
  };
}

/**
 * Еженедельная работа с академией (тип тренировки «Академия»):
 * юниоры развиваются с шансом, зависящим от возраста, уровня академии и тренера.
 */
export function trainAcademyGroup(g: GameState, coachBonus: number): { grown: string[] } {
  const bonus = academyBonus(g.facilities);
  const grown: string[] = [];
  for (const p of g.academy) {
    const base = academyGroupOf(p.age) === "U17" ? 0.42 : 0.34;
    if (chance(clamp(base * (1 + bonus * 0.18) + coachBonus, 0.05, 0.85)) && p.ability < p.potential) {
      p.ability += 1;
      reprice(p);
      grown.push(p.name);
    }
  }
  return { grown };
}
