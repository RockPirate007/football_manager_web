/**
 * Трансферный рынок: свободные агенты, обновление пула,
 * трансферные окна и живые сделки ИИ-клубов между собой.
 */

import { POSITIONS } from "../core/types";
import { makePlayer, desiredSalary, signContract, reprice } from "../core/player";
import { pickNation } from "../data/names";
import { choice, chance, floor1000, randint } from "../core/rng";
import { fixLineup } from "../core/team";
import { sendMail } from "./mail";
import { logHistory } from "./career";
import type { GameState, Player, Team } from "../core/types";

/** Начальный пул свободных агентов */
export function initAgents(): Player[] {
  const agents: Player[] = [];
  for (let i = 0; i < 12; i++) {
    agents.push(makePlayer(choice(POSITIONS), randint(58, 80), pickNation()));
  }
  return agents;
}

// ─────────────────────── Трансферные окна ───────────────────────

export type TransferWindow = "summer" | "winter" | "closed";

/** Длина сезона в турах (по календарю) */
export function seasonLen(g: GameState): number {
  return g.schedule?.length || 34;
}

/**
 * Окно по номеру тура — масштабируется под длину сезона:
 *  — летнее: первые ~15% туров (старт сезона);
 *  — зимнее: два тура вокруг середины;
 *  — остальное время закрыто.
 */
export function transferWindowAt(round: number, len: number = 34): TransferWindow {
  const L = Math.max(18, len);
  const summerEnd = Math.max(4, Math.round(L * 0.15)); // туры 0..N-1 лето
  const mid = Math.floor(L / 2);
  if (round < summerEnd) return "summer";
  if (round >= mid - 1 && round <= mid) return "winter";
  return "closed";
}

export function transferWindowOpen(g: GameState): boolean {
  return transferWindowAt(g.round, seasonLen(g)) !== "closed";
}

export function transferWindowLabel(w: TransferWindow): string {
  return w === "summer" ? "Летнее окно" : w === "winter" ? "Зимнее окно" : "Окно закрыто";
}

// ─────────────────────── Обновление пула агентов ───────────────────────

/** Обновление рынка после тура */
export function refreshMarket(g: GameState): void {
  if (Math.random() < 0.6 && g.freeAgents.length > 6) {
    g.freeAgents.splice(Math.floor(Math.random() * g.freeAgents.length), 1);
  }
  if (Math.random() < 0.7) {
    g.freeAgents.push(makePlayer(choice(POSITIONS), randint(58, 82), pickNation()));
  }
}

// ─────────────────────── Живой рынок ИИ ───────────────────────

const NOTABLE_ABILITY = 79;

function movePlayer(g: GameState, buyer: Team, seller: Team | null, p: Player, fee: number): void {
  if (seller) {
    seller.players = seller.players.filter((x) => x.id !== p.id);
    seller.lineupIds = seller.lineupIds.filter((id) => id !== p.id);
    seller.budget += fee;
    fixLineup(seller);
  } else {
    g.freeAgents = g.freeAgents.filter((x) => x.id !== p.id);
  }
  buyer.budget = Math.max(0, buyer.budget - fee);
  const years = randint(2, 4);
  signContract(p, years, desiredSalary(p, years));
  buyer.players.push(p);
  fixLineup(buyer);
}

function announceDeal(g: GameState, p: Player, from: string, to: string, fee: number): void {
  const headline = `Трансфер: ${p.name} перешёл из «${from}» в «${to}» за ${fmtShort(fee)}`;
  logHistory(g, headline);
  if (p.ability >= NOTABLE_ABILITY) {
    sendMail(
      g,
      "Громкий трансфер",
      `${headline}. ${p.name} (${p.detail ?? p.pos}, рейтинг ${p.ability}) продолжает карьеру в новом клубе.`,
      "рынок",
    );
  }
}

function fmtShort(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} млн €`;
  return `${Math.round(v / 1000)} тыс €`;
}

/** Одна попытка сделки между ИИ-клубами */
function aiDeal(g: GameState): boolean {
  const clubs = Object.values(g.teams).filter((t) => t.name !== g.user);
  if (clubs.length < 2) return false;

  const buyers = clubs.filter((t) => t.budget > 800_000 && t.players.length < 26);
  if (buyers.length === 0) return false;
  const buyer = choice(buyers);
  const sellers = clubs.filter((t) => t.name !== buyer.name && t.players.length > 17);
  const seller = choice(sellers);
  if (!seller) return false;

  const targets = seller.players
    .filter((p) => !p.onLoan && p.value <= buyer.budget * 0.55 && p.ability >= buyer.power - 12)
    .sort((a, b) => b.ability - a.ability)
    .slice(0, 6);
  if (targets.length === 0) return false;
  const p = choice(targets);

  const fee = floor1000(p.value * (0.9 + Math.random() * 0.35));
  if (fee > buyer.budget) return false;
  movePlayer(g, buyer, seller, p, fee);
  announceDeal(g, p, seller.name, buyer.name, fee);
  return true;
}

/** ИИ-клуб подписывает свободного агента */
function aiSignsAgent(g: GameState): boolean {
  const clubs = Object.values(g.teams).filter((t) => t.name !== g.user && t.players.length < 21);
  if (clubs.length === 0 || g.freeAgents.length === 0) return false;
  const club = choice(clubs);
  const idx = g.freeAgents.findIndex((p) => p.ability >= club.power - 14);
  if (idx === -1) return false;
  const p = g.freeAgents[idx];
  const fee = floor1000(p.value * 0.12) + 50_000;
  if (fee > club.budget) return false;
  movePlayer(g, club, null, p, fee);
  announceDeal(g, p, "свободный агент", club.name, fee);
  return true;
}

/**
 * Живой день рынка: вызывается после каждого тура.
 * В окна — сделки клуб-клуб (1–2 за тур) и подписания агентов,
 * вне окон — редкие подписания свободных агентов.
 */
export function aiMarketDay(g: GameState): void {
  const window = transferWindowAt(g.round);

  // Свободные агенты — в любое время (редко)
  if (chance(window === "closed" ? 0.12 : 0.3)) {
    aiSignsAgent(g);
  }
  if (window === "closed") return;

  const deals = randint(1, 2);
  for (let i = 0; i < deals; i++) {
    if (chance(0.75)) aiDeal(g);
  }
}

/** Межсезонная активность рынка: пара сделок + обновление цен */
export function aiMarketOffseason(g: GameState): void {
  for (let i = 0; i < 4; i++) {
    aiDeal(g);
  }
  for (const t of Object.values(g.teams)) {
    for (const p of t.players) reprice(p);
  }
}
