/**
 * Трансферы: покупка/продажа, аренда, контракты, предложения ИИ.
 * Чистые операции над GameState; результаты — Feedback для UI.
 */

import { contractLabel, desiredSalary, reprice, signContract } from "../core/player";
import { userTeam } from "../core/state";
import { floor1000, randint, choice, chance } from "../core/rng";
import { fixLineup } from "../core/team";
import { logHistory } from "./career";
import type { Feedback, GameState, Player, Team } from "../core/types";

/** Найти игрока по id во всех пулах игры */
export function findPlayerEverywhere(g: GameState, playerId: number): { player: Player; team: Team | null } | null {
  for (const t of Object.values(g.teams)) {
    const p = t.players.find((x) => x.id === playerId);
    if (p) return { player: p, team: t };
  }
  const free = g.freeAgents.find((x) => x.id === playerId);
  if (free) return { player: free, team: null };
  return null;
}

// ─────────────────────────── Продажа ───────────────────────────

/** Продать игрока случайному клубу */
export function sellPlayer(g: GameState, playerId: number): Feedback {
  const team = userTeam(g);
  const p = team.players.find((x) => x.id === playerId);
  if (!p) return { ok: false, kind: "error", message: "Игрок не найден." };
  if (team.players.length <= 13) {
    return { ok: false, kind: "error", message: "Минимум 13 игроков в заявке." };
  }

  const buyers = Object.values(g.teams).filter((t) => t.name !== g.user);
  if (buyers.length === 0) return { ok: false, kind: "error", message: "Нет покупателей." };
  const buyer = choice(buyers);
  const fee = floor1000(p.value * (0.85 + Math.random() * 0.2));

  if (!chance(0.75)) {
    return { ok: false, kind: "error", message: `«${buyer.name}» не сошлись в цене.` };
  }

  team.budget += fee;
  buyer.budget = Math.max(0, buyer.budget - fee);
  team.players = team.players.filter((x) => x.id !== p.id);
  team.lineupIds = team.lineupIds.filter((id) => id !== p.id);
  const years = randint(2, 4);
  signContract(p, years, desiredSalary(p, years));
  buyer.players.push(p);
  fixLineup(team);
  fixLineup(buyer);
  logHistory(g, `Продажа: ${p.name} в «${buyer.name}» за ${fee}`);
  return { ok: true, kind: "success", message: `${p.name} продан в «${buyer.name}» за ${fee} €.`, };
}

// ─────────────────────────── Аренда ───────────────────────────

/** Взять игрока в аренду */
export function loanIn(g: GameState, playerId: number): Feedback {
  const team = userTeam(g);
  const found = findPlayerEverywhere(g, playerId);
  if (!found || !found.team) return { ok: false, kind: "error", message: "Игрок не найден." };
  const { player: p, team: owner } = found;
  if (p.onLoan) return { ok: false, kind: "error", message: "Игрок уже в аренде." };

  const fee = Math.max(30_000, floor1000(p.value * 0.08));
  if (fee > team.budget) {
    return { ok: false, kind: "error", message: "Не хватает на арендную плату." };
  }
  if (!chance(0.65)) {
    return { ok: false, kind: "error", message: `«${owner.name}» отказал в аренде.` };
  }

  team.budget -= fee;
  owner.budget += fee;
  owner.players = owner.players.filter((x) => x.id !== p.id);
  owner.lineupIds = owner.lineupIds.filter((id) => id !== p.id);
  p.salaryHome = p.salary;
  p.onLoan = true;
  p.loanOrigin = owner.name;
  p.salary = Math.max(15_000, Math.floor(p.salary / 2));
  team.players.push(p);
  fixLineup(owner);
  fixLineup(team);
  logHistory(g, `Аренда: ${p.name} из «${owner.name}»`);
  return { ok: true, kind: "success", message: `Аренда: ${p.name} из «${owner.name}» до конца сезона.` };
}

/** Отдать своего игрока в аренду */
export function loanOut(g: GameState, playerId: number): Feedback {
  const team = userTeam(g);
  const p = team.players.find((x) => x.id === playerId);
  if (!p) return { ok: false, kind: "error", message: "Игрок не найден." };
  if (team.players.length <= 13) {
    return { ok: false, kind: "error", message: "Минимум 13 игроков." };
  }

  const hosts = Object.values(g.teams).filter((t) => t.name !== g.user);
  if (hosts.length === 0) return { ok: false, kind: "error", message: "Нет клубов-кандидатов." };
  const host = choice(hosts);
  const fee = Math.max(20_000, floor1000(p.value * 0.06));

  if (!chance(0.7)) {
    return { ok: false, kind: "error", message: `Интереса к ${p.name} нет.` };
  }

  team.budget += fee;
  host.budget = Math.max(0, host.budget - fee);
  team.players = team.players.filter((x) => x.id !== p.id);
  team.lineupIds = team.lineupIds.filter((id) => id !== p.id);
  p.salaryHome = p.salary;
  p.onLoan = true;
  p.loanOrigin = team.name;
  p.salary = Math.max(15_000, Math.floor(p.salary / 2));
  host.players.push(p);
  fixLineup(team);
  fixLineup(host);
  logHistory(g, `Аренда: ${p.name} → «${host.name}»`);
  return { ok: true, kind: "success", message: `${p.name} в аренде в «${host.name}». +${fee} €` };
}

// ─────────────────── Межсезонные обязательства ───────────────────

/** Вернуть всех арендованных игроков владельцам (конец сезона) */
export function returnLoansEndSeason(g: GameState): string[] {
  const messages: string[] = [];
  for (const t of Object.values(g.teams)) {
    const returning = t.players.filter((p) => p.onLoan);
    for (const p of returning) {
      const originName = p.loanOrigin;
      t.players = t.players.filter((x) => x.id !== p.id);
      t.lineupIds = t.lineupIds.filter((id) => id !== p.id);
      if (p.salaryHome) p.salary = p.salaryHome;
      p.onLoan = false;
      p.loanOrigin = null;
      reprice(p);
      if (originName && g.teams[originName]) {
        g.teams[originName].players.push(p);
      } else {
        g.freeAgents.push(p);
      }
      if (t.name === g.user || originName === g.user) {
        messages.push(`Аренда завершена: ${p.name} → «${originName ?? "?"}»`);
      }
    }
    if (returning.length > 0) fixLineup(t);
  }
  return messages;
}

/** Игроки с истёкшим контрактом уходят в свободные агенты */
export function processExpiredContracts(g: GameState): string[] {
  const messages: string[] = [];
  for (const t of Object.values(g.teams)) {
    const expired = t.players.filter((p) => !p.onLoan && p.contractYears <= 0);
    for (const p of expired) {
      t.players = t.players.filter((x) => x.id !== p.id);
      t.lineupIds = t.lineupIds.filter((id) => id !== p.id);
      p.morale = Math.max(40, p.morale - 8);
      g.freeAgents.push(p);
      if (t.name === g.user) {
        messages.push(`Контракт истёк: ${p.name} стал свободным агентом.`);
      }
    }
    if (expired.length > 0) fixLineup(t);
  }
  return messages;
}

/** Список игроков с истекающим контрактом (для UI) */
export function expiringContracts(team: Team): Player[] {
  return team.players
    .filter((p) => !p.onLoan && p.contractYears <= 1)
    .sort((a, b) => b.ability - a.ability);
}

export { contractLabel };
