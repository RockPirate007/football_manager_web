/**
 * Коммерция клуба (Фаза 3): спонсорские контракты, рынок предложений,
 * мерчандайзинг и билетная политика.
 *  — действующий контракт платит за тур; в конце сезона — бонус за место
 *    и перезаключение;
 *  — предложения спонсоров приходят на рынок, живут несколько туров
 *    и требуют репутации менеджера;
 *  — менеджер сам назначает цену билета: дороже билет — меньше зрителей;
 *  — мерчандайзинг зависит от фан-шопа, престижа лиги и репутации.
 */

import { isSecondDivision, LEAGUE_BY_ID } from "../data/leagues";
import { userTeam, userPlace, leagueTeams } from "../core/state";
import { choice, randint } from "../core/rng";
import { SPONSOR_BRAND_POOL } from "../core/team";
import { sendMail } from "./mail";
import { addNews } from "./news";
import { logHistory } from "./career";
import { merchMultiplier } from "./facilities";
import { prestigeOf } from "./ligue";
import type { GameState, SponsorDeal, SponsorOffer, Team } from "../core/types";

let offerSeq = 1;

/** Автоматическая цена билета по силе клуба: 32–75 € (базовая формула клуба) */
export function ticketAutoPrice(team: Team): number {
  return Math.round(32 + Math.max(0, team.power - 62) * 1.9);
}

/** Действующая цена билета: назначение менеджера или авто */
export function currentTicketPrice(g: GameState): number {
  const auto = ticketAutoPrice(userTeam(g));
  if (g.ticketPrice == null) return auto;
  return Math.max(8, Math.min(220, Math.round(g.ticketPrice)));
}

/**
 * Эластичность посещаемости от цены: (/)deviation^1.4 — поднял цену на 20%,
 * потерял ~27% зрителей. Снизил — аншлаг с потолком +12%.
 */
export function priceAttendanceFactor(g: GameState): number {
  const team = userTeam(g);
  const auto = ticketAutoPrice(team);
  const price = currentTicketPrice(g);
  const f = Math.pow(auto / Math.max(1, price), 1.4);
  return Math.max(0.55, Math.min(1.12, f));
}

/** Спонсорский контракт по умолчанию для клуба (близко к старой формуле доходов) */
export function defaultSponsorDeal(team: Team, prestige: number): SponsorDeal {
  const base = 190_000 + Math.max(0, team.power - 62) * 24_000;
  const prestigeF = 0.8 + 0.2 * (prestige / 100);
  const perRound = Math.round(base * prestigeF * (0.92 + Math.random() * 0.16));
  const nTeams = LEAGUE_BY_ID[team.league]?.clubs.length ?? 18;
  const placeTarget = Math.max(3, Math.round(nTeams * 0.22));
  return {
    name: team.sponsor || choice(SPONSOR_BRAND_POOL),
    perRound,
    seasonsLeft: randint(2, 3),
    placeTarget,
    placeBonus: Math.round(perRound * (4 + Math.random() * 3)),
  };
}

/** Пул предложений спонсоров: качество зависит от репутации и престижа лиги */
export function makeSponsorOffers(g: GameState, count = 3): SponsorOffer[] {
  const team = userTeam(g);
  const prestige = prestigeOf(g, team.league);
  const rep = g.reputation;
  const offers: SponsorOffer[] = [];
  const base = 190_000 + Math.max(0, team.power - 62) * 24_000;
  for (let i = 0; i < count; i++) {
    // tier 0 — скромный контракт, tier 2 — щедрый и требовательный
    const tier = i;
    const quality = 0.82 + tier * 0.18 + rep * 0.004 + (prestige / 100) * 0.12;
    const perRound = Math.round(base * quality * (0.95 + Math.random() * 0.1));
    const nTeams = leagueTeams(g, team.league).length || 18;
    const placeTarget = Math.max(2, Math.round(nTeams * (0.3 - tier * 0.07)));
    offers.push({
      id: offerSeq++,
      name: choice(SPONSOR_BRAND_POOL),
      perRound,
      seasonsLeft: randint(2, 4),
      placeTarget,
      placeBonus: Math.round(perRound * (4 + Math.random() * 4)),
      signOn: Math.round(perRound * (1 + Math.random() * 2)),
      minReputation: Math.max(20, Math.round(38 + tier * 12 + (perRound / base) * 14)),
      roundsLeft: randint(3, 6),
    });
  }
  // Уникальные бренды в одном списке
  const seen = new Set<string>();
  for (const o of offers) {
    while (seen.has(o.name)) o.name = choice(SPONSOR_BRAND_POOL);
    seen.add(o.name);
  }
  return offers;
}

/** Обновление рынка предложений за тур: старение, замена ушедших */
export function processSponsorOffers(g: GameState): void {
  if (!g.sponsorOffers) g.sponsorOffers = [];
  for (const o of g.sponsorOffers) o.roundsLeft -= 1;
  const alive = g.sponsorOffers.filter((o) => o.roundsLeft > 0);
  // Поддерживаем 2–3 живых предложения
  if (alive.length < 2 && Math.random() < 0.5) {
    alive.push(...makeSponsorOffers(g, 1));
  }
  g.sponsorOffers = alive;
}

/** Полный рестарт рынка (межсезонье, смена клуба) */
export function refreshSponsorOffers(g: GameState): void {
  g.sponsorOffers = makeSponsorOffers(g, 3);
}

/**
 * Подписать предложение спонсора. Возвращает null при успехе или текст ошибки.
 * Старый контракт расторгается без компенсаций (как в жизни).
 */
export function signSponsorOffer(g: GameState, offerId: number): string | null {
  const offers = g.sponsorOffers ?? [];
  const idx = offers.findIndex((o) => o.id === offerId);
  if (idx === -1) return "Предложение уже неактуально.";
  const offer = offers[idx];
  if (g.reputation < offer.minReputation) {
    return `Бренд требует репутации ${offer.minReputation} (сейчас ${g.reputation}).`;
  }
  const team = userTeam(g);
  const old = g.sponsorDeal;
  team.budget += offer.signOn;
  g.sponsorDeal = {
    name: offer.name,
    perRound: offer.perRound,
    seasonsLeft: offer.seasonsLeft,
    placeTarget: offer.placeTarget,
    placeBonus: offer.placeBonus,
  };
  g.sponsorOffers = offers.filter((o) => o.id !== offerId);
  team.sponsor = offer.name;
  logHistory(g, `Спонсорский контракт: ${offer.name} (${(offer.perRound / 1000).toFixed(0)} тыс €/тур)`);
  addNews(
    g,
    "club",
    "🤝",
    `Новый титульный спонсор: ${offer.name}`,
    `Контракт на ${offer.seasonsLeft} сезон(а): ${(offer.perRound / 1000).toFixed(0)} тыс € за тур` +
      (offer.placeBonus > 0 ? `, бонус ${(offer.placeBonus / 1e6).toFixed(1)} млн € за топ-${offer.placeTarget}` : "") +
      `. Подъёмные: ${(offer.signOn / 1e6).toFixed(2)} млн €.` +
      (old ? ` Предыдущий контракт с ${old.name} расторгнут.` : ""),
  );
  sendMail(
    g,
    `Подписан спонсорский контракт: ${offer.name}`,
    `Условия:\n• ${(offer.perRound / 1000).toFixed(0)} тыс € за тур\n• срок ${offer.seasonsLeft} сезон(а)\n` +
      `• бонус ${(offer.placeBonus / 1e6).toFixed(2)} млн € при месте ≤ ${offer.placeTarget}\n` +
      `• подъёмные ${(offer.signOn / 1e6).toFixed(2)} млн € уже зачислены`,
    "финансы",
  );
  return null;
}

/** Спонсорский доход за тур: контракт или аварийная формула старых сейвов */
export function sponsorIncome(g: GameState, res: "W" | "D" | "L" | null): { income: number; brand: string | null } {
  const team = userTeam(g);
  const leagueDistro = isSecondDivision(team.league) ? 300_000 : 120_000;
  const form = res === "W" ? 1.12 : res === "D" ? 1.04 : 0.95;
  const deal = g.sponsorDeal;
  if (!deal) {
    // Старый сейв без контракта: прежняя формула
    const base = 190_000 + Math.max(0, team.power - 62) * 24_000;
    return {
      income: Math.round((base * (0.85 + (g.reputation / 100) * 0.3) + leagueDistro) * form),
      brand: team.sponsor || null,
    };
  }
  const repF = 0.85 + (g.reputation / 100) * 0.3;
  return { income: Math.round(deal.perRound * repF * form) + leagueDistro, brand: deal.name };
}

/**
 * Итоги сезона по спонсорам: бонус за место, истечение контракта,
 * автоматическое заключение базовой сделки. Вызывается в endOfSeason
 * (после определения места, до старта нового сезона).
 */
export function seasonSponsorSettle(g: GameState): void {
  const team = userTeam(g);
  const place = userPlace(g);
  const deal = g.sponsorDeal;

  if (deal) {
    if (place <= deal.placeTarget && deal.placeBonus > 0) {
      team.budget += deal.placeBonus;
      addNews(
        g,
        "club",
        "💰",
        `Спонсор ${deal.name} выплатил бонус`,
        `Место ${place} (условие топ-${deal.placeTarget}) выполнено: +${(deal.placeBonus / 1e6).toFixed(2)} млн € на бюджет.`,
      );
      sendMail(
        g,
        `Бонус от ${deal.name}`,
        `Команда финишировала на ${place}-м месте и выполнила условие контракта (топ-${deal.placeTarget}).\n` +
          `На счёт клуба зачислено ${(deal.placeBonus / 1e6).toFixed(2)} млн €.`,
        "финансы",
      );
      logHistory(g, `Спонсорский бонус ${deal.name}: +${(deal.placeBonus / 1e6).toFixed(2)} млн €`);
    }
    deal.seasonsLeft -= 1;
  }

  // Контракт истёк — клуб автоматически подписывает базовую сделку
  if (deal && deal.seasonsLeft <= 0) {
    const fresh = defaultSponsorDeal(team, prestigeOf(g, team.league));
    addNews(
      g,
      "club",
      "📉",
      `Контракт с ${deal.name} истёк`,
      `Клуб подписал базовое соглашение с ${fresh.name}: ${(fresh.perRound / 1000).toFixed(0)} тыс € за тур. ` +
        `Более выгодные предложения ищите в разделе «Спонсоры».`,
    );
    g.sponsorDeal = fresh;
    team.sponsor = fresh.name;
    logHistory(g, `Контракт ${deal.name} истёк; базовое соглашение с ${fresh.name}`);
  }
  if (!g.sponsorDeal) {
    g.sponsorDeal = defaultSponsorDeal(team, prestigeOf(g, team.league));
    team.sponsor = g.sponsorDeal.name;
  }

  refreshSponsorOffers(g);
}

/** Мерчандайзинг за тур: фан-шоп × престиж лиги × репутация */
export function merchIncome(g: GameState): number {
  const team = userTeam(g);
  const prestigeF = 0.9 + 0.1 * (prestigeOf(g, team.league) / 100);
  return Math.round((team.capacity * 0.9 + g.reputation * 2_400) * merchMultiplier(g.facilities) * prestigeF);
}

/** Смена клуба: коммерция пересобирается под новый клуб */
export function reinitCommercial(g: GameState): void {
  const team = userTeam(g);
  g.sponsorDeal = defaultSponsorDeal(team, prestigeOf(g, team.league));
  team.sponsor = g.sponsorDeal.name;
  g.ticketPrice = null;
  refreshSponsorOffers(g);
}

/** Название лиги пользователя (для UI) */
export function leagueNameOf(g: GameState): string {
  return LEAGUE_BY_ID[userTeam(g).league]?.name ?? "Лига";
}
