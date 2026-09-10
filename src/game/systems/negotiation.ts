/**
 * Переговоры по трансферам и контрактам.
 * Формирует варианты предложений и разыгрывает ответ стороны.
 */

import { desiredSalary, signContract } from "../core/player";
import { userTeam } from "../core/state";
import { floor1000, randint } from "../core/rng";
import { fixLineup } from "../core/team";
import { logHistory } from "./career";
import type {
  Feedback,
  GameState,
  Negotiation,
  NegotiationOption,
  NegotiationOutcome,
  Player,
} from "../core/types";

/** Создать сценарий переговоров */
export function createNegotiation(
  g: GameState,
  p: Player,
  askingFee: number,
  isAgent: boolean,
  fromTeam: string | null,
): Negotiation {
  const wantYears =
    p.age <= 28 ? [2, 3, 3, 4][Math.floor(Math.random() * 4)] : [1, 2, 2][Math.floor(Math.random() * 3)];
  const wantSalary = desiredSalary(p, wantYears);
  const minFee = floor1000(askingFee * 0.82);

  const options: NegotiationOption[] = [
    {
      key: "accept",
      label: `Принять: ${fmt(askingFee)} + ${wantYears} г. / ${fmt(wantSalary)}`,
      fee: askingFee,
      years: wantYears,
      salary: wantSalary,
      acceptChance: 0.95,
    },
    {
      key: "haggle10",
      label: `Торг −10%: ${fmt(floor1000(askingFee * 0.9))} + ${wantYears} г.`,
      fee: floor1000(askingFee * 0.9),
      years: wantYears,
      salary: floor1000(wantSalary * 1.02),
      acceptChance: 0.72,
    },
    {
      key: "haggle18",
      label: `Торг −18%: ${fmt(minFee)} + ${Math.max(1, wantYears - 1)} г. (жёстко)`,
      fee: minFee,
      years: Math.max(1, wantYears - 1),
      salary: floor1000(wantSalary * 1.08),
      acceptChance: 0.42,
    },
    {
      key: "refuse",
      label: "Отказаться",
      fee: 0,
      years: 0,
      salary: 0,
      acceptChance: 0,
    },
  ];

  return {
    playerId: p.id,
    playerName: p.name,
    pos: p.pos,
    age: p.age,
    ability: p.ability,
    fromTeam,
    isAgent,
    askingFee,
    wantYears,
    wantSalary,
    playerValue: p.value,
    options,
  };
}

function fmt(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)} млн €`;
  return `${Math.round(v / 1000)} тыс €`;
}

/**
 * Разыграть выбор варианта. При успехе — завершает сделку:
 * подписывает контракт и перемещает игрока.
 */
export function resolveNegotiation(
  g: GameState,
  neg: Negotiation,
  optionIndex: number,
): NegotiationOutcome {
  const option = neg.options[optionIndex];
  if (!option || option.key === "refuse") {
    return { accepted: false, message: "Переговоры прерваны.", fee: 0, years: 0, salary: 0 };
  }

  const team = userTeam(g);
  if (option.fee > team.budget) {
    return {
      accepted: false,
      message: "Недостаточно средств для этого предложения.",
      fee: option.fee,
      years: option.years,
      salary: option.salary,
    };
  }

  if (Math.random() > option.acceptChance) {
    return {
      accepted: false,
      message: "Сторона отклонила условия.",
      fee: option.fee,
      years: option.years,
      salary: option.salary,
    };
  }

  completeSigning(g, neg, option.fee, option.years, option.salary);
  return {
    accepted: true,
    message: `Согласие: ${fmt(option.fee)} • ${option.years} г. • ${fmt(option.salary)}/тур`,
    fee: option.fee,
    years: option.years,
    salary: option.salary,
  };
}

/** Завершить подпись: деньги, контракт, перемещение игрока */
export function completeSigning(
  g: GameState,
  neg: Negotiation,
  fee: number,
  years: number,
  salary: number,
): void {
  const team = userTeam(g);
  const byId = new Map<number, Player>();
  for (const t of Object.values(g.teams)) {
    for (const p of t.players) byId.set(p.id, p);
  }
  for (const p of g.freeAgents) byId.set(p.id, p);
  for (const p of g.academy) byId.set(p.id, p);

  const p = byId.get(neg.playerId);
  if (!p) return;

  team.budget -= fee;
  if (neg.fromTeam && g.teams[neg.fromTeam]) {
    const seller = g.teams[neg.fromTeam];
    seller.budget += fee;
    seller.players = seller.players.filter((x) => x.id !== p.id);
    seller.lineupIds = seller.lineupIds.filter((id) => id !== p.id);
    fixLineup(seller);
  } else {
    g.freeAgents = g.freeAgents.filter((x) => x.id !== p.id);
    g.academy = g.academy.filter((x) => x.id !== p.id);
  }

  signContract(p, years, salary);
  team.players.push(p);
  fixLineup(team);
  logHistory(g, `Трансфер: ${p.name} → «${team.name}» за ${fmt(fee)}`);
}

/** Случайный исход продления контракта */
export function renewContract(
  g: GameState,
  playerId: number,
  years: number,
  agreeImmediately: boolean,
): Feedback {
  const team = userTeam(g);
  const p = team.players.find((x) => x.id === playerId);
  if (!p) return { ok: false, kind: "error", message: "Игрок не найден." };

  const newSal = desiredSalary(p, years);
  const ask = floor1000(newSal * (1.0 + Math.random() * 0.18));
  const finalSal = agreeImmediately ? ask : newSal;
  const acceptChance = agreeImmediately ? 0.9 : 0.55;

  if (Math.random() < acceptChance) {
    signContract(p, years, finalSal);
    p.morale = Math.min(100, p.morale + 5);
    return {
      ok: true,
      kind: "success",
      message: `Контракт: ${p.name} — ${years} г., ${fmt(finalSal)}/тур`,
    };
  }
  return { ok: false, kind: "error", message: `${p.name} не принял условия.` };
}

/** Запросить +15% при продаже (возвращается новая сумма или отказ) */
export function aiOfferCounter(g: GameState, fee: number): { accepted: boolean; fee: number } {
  const bumped = floor1000(fee * 1.15);
  if (Math.random() < 0.4) {
    return { accepted: false, fee: bumped };
  }
  void g;
  return { accepted: true, fee: bumped };
}

/** Случайное предложение ИИ-клуба по игроку пользователя */
export interface AiOffer {
  playerId: number;
  buyer: string;
  fee: number;
}

export function rollAiOffer(g: GameState): AiOffer | null {
  const team = userTeam(g);
  const valuable = team.players.filter(
    (p) => !p.onLoan && p.value >= 400_000 && p.ability >= 68,
  );
  if (valuable.length === 0 || Math.random() > 0.55) return null;
  const p = valuable[Math.floor(Math.random() * valuable.length)];
  const buyers = Object.values(g.teams).filter((t) => t.name !== g.user);
  if (buyers.length === 0) return null;
  const buyer = buyers[Math.floor(Math.random() * buyers.length)];
  const fee = floor1000(p.value * (0.95 + Math.random() * 0.4));
  return { playerId: p.id, buyer: buyer.name, fee };
}

/** Принять предложение ИИ: продать игрока */
export function acceptAiOffer(g: GameState, offer: AiOffer): Feedback {
  const team = userTeam(g);
  const p = team.players.find((x) => x.id === offer.playerId);
  const buyer = g.teams[offer.buyer];
  if (!p || !buyer) return { ok: false, kind: "error", message: "Предложение устарело." };
  if (team.players.length <= 13) {
    return { ok: false, kind: "error", message: "Нельзя продать — минимум 13 игроков." };
  }

  team.budget += offer.fee;
  buyer.budget = Math.max(0, buyer.budget - offer.fee);
  team.players = team.players.filter((x) => x.id !== p.id);
  team.lineupIds = team.lineupIds.filter((id) => id !== p.id);
  const years = randint(2, 4);
  signContract(p, years, desiredSalary(p, years));
  buyer.players.push(p);
  fixLineup(team);
  fixLineup(buyer);
  logHistory(g, `Продажа: ${p.name} в «${buyer.name}» за ${fmt(offer.fee)}`);
  return {
    ok: true,
    kind: "success",
    message: `${p.name} продан в «${buyer.name}» за ${fmt(offer.fee)}.`,
  };
}
