/**
 * Национальные сборные: вызовы игроков на товарищеские матчи,
 * Евро и чемпионат мира. Письма-оповещения + лёгкие эффекты усталости.
 *
 * Вызовы детерминированы составами (сила/нация) — состояние не нужно.
 */

import { userTeam } from "../core/state";
import { choice, weightedChoice } from "../core/rng";
import { sendMail } from "./mail";
import type { GameState, Player } from "../core/types";

export interface NationTeam {
  /** Название сборной (= национальность игрока) */
  name: string;
  /** Флаг (эмодзи) */
  flag: string;
  /** Сила сборной 60–92 */
  power: number;
  /** Минимальный рейтинг для вызова */
  threshold: number;
}

/** Топ-сборные мира (2024/25). Нации без сборной просто не вызывают игроков */
export const NATIONS: NationTeam[] = [
  { name: "Аргентина", flag: "🇦🇷", power: 92, threshold: 78 },
  { name: "Франция", flag: "🇫🇷", power: 92, threshold: 78 },
  { name: "Испания", flag: "🇪🇸", power: 91, threshold: 78 },
  { name: "Англия", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", power: 90, threshold: 78 },
  { name: "Бразилия", flag: "🇧🇷", power: 89, threshold: 78 },
  { name: "Португалия", flag: "🇵🇹", power: 88, threshold: 78 },
  { name: "Нидерланды", flag: "🇳🇱", power: 87, threshold: 78 },
  { name: "Бельгия", flag: "🇧🇪", power: 85, threshold: 77 },
  { name: "Германия", flag: "🇩🇪", power: 86, threshold: 77 },
  { name: "Италия", flag: "🇮🇹", power: 85, threshold: 77 },
  { name: "Хорватия", flag: "🇭🇷", power: 83, threshold: 76 },
  { name: "Уругвай", flag: "🇺🇾", power: 83, threshold: 76 },
  { name: "Колумбия", flag: "🇨🇴", power: 82, threshold: 76 },
  { name: "Марокко", flag: "🇲🇦", power: 81, threshold: 75 },
  { name: "Сербия", flag: "🇷🇸", power: 79, threshold: 74 },
  { name: "Швейцария", flag: "🇨🇭", power: 79, threshold: 74 },
  { name: "Дания", flag: "🇩🇰", power: 80, threshold: 74 },
  { name: "Австрия", flag: "🇦🇹", power: 78, threshold: 73 },
  { name: "Турция", flag: "🇹🇷", power: 78, threshold: 73 },
  { name: "Польша", flag: "🇵🇱", power: 77, threshold: 73 },
  { name: "Швеция", flag: "🇸🇪", power: 76, threshold: 72 },
  { name: "Норвегия", flag: "🇳🇴", power: 76, threshold: 72 },
  { name: "Сенегал", flag: "🇸🇳", power: 76, threshold: 72 },
  { name: "Гана", flag: "🇬🇭", power: 74, threshold: 71 },
  { name: "Кот-д’Ивуар", flag: "🇨🇮", power: 75, threshold: 71 },
  { name: "Египет", flag: "🇪🇬", power: 74, threshold: 71 },
  { name: "Венгрия", flag: "🇭🇺", power: 74, threshold: 70 },
  { name: "Чехия", flag: "🇨🇿", power: 74, threshold: 70 },
  { name: "Шотландия", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", power: 74, threshold: 70 },
  { name: "Нигерия", flag: "🇳🇬", power: 75, threshold: 70 },
  { name: "Алжир", flag: "🇩🇿", power: 74, threshold: 70 },
  { name: "Мексика", flag: "🇲🇽", power: 75, threshold: 70 },
  { name: "США", flag: "🇺🇸", power: 74, threshold: 70 },
  { name: "Япония", flag: "🇯🇵", power: 76, threshold: 70 },
  { name: "Южная Корея", flag: "🇰🇷", power: 74, threshold: 69 },
  { name: "Австралия", flag: "🇦🇺", power: 72, threshold: 68 },
];

const NATION_BY_NAME: Record<string, NationTeam> = Object.fromEntries(
  NATIONS.map((n) => [n.name, n]),
);

export function nationTeam(nation: string): NationTeam | null {
  return NATION_BY_NAME[nation] ?? null;
}

/** Игрок может быть вызван в сборную */
function eligible(p: Player, nt: NationTeam): boolean {
  return p.bio.nation === nt.name && p.ability >= nt.threshold;
}

export interface Callup {
  player: Player;
  club: string;
  nation: NationTeam;
}

/** Все вызовы мира: топ-23 игрока каждой сборной (детерминированно по составам) */
export function allCallups(g: GameState): Map<string, Callup[]> {
  const buckets: Record<string, Player[]> = {};
  for (const team of Object.values(g.teams)) {
    for (const p of team.players) {
      const nt = nationTeam(p.bio.nation);
      if (!nt || !eligible(p, nt)) continue;
      (buckets[nt.name] ??= []).push(p);
    }
  }
  const out = new Map<string, Callup[]>();
  for (const nt of NATIONS) {
    const list = (buckets[nt.name] ?? []).sort((a, b) => b.ability - a.ability).slice(0, 23);
    out.set(
      nt.name,
      list.map((p) => ({ player: p, club: clubOf(g, p), nation: nt })),
    );
  }
  return out;
}

/** Клуб игрока (поиск по всем составам) */
function clubOf(g: GameState, p: Player): string {
  for (const t of Object.values(g.teams)) {
    if (t.players.some((x) => x.id === p.id)) return t.name;
  }
  return "—";
}

/** Вызовы игроков клуба пользователя */
export function userCallups(g: GameState): Array<{ player: Player; nation: NationTeam }> {
  const team = userTeam(g);
  const out: Array<{ player: Player; nation: NationTeam }> = [];
  for (const p of team.players) {
    const nt = nationTeam(p.bio.nation);
    if (nt && eligible(p, nt)) {
      // Входят в топ-23 своей сборной?
      const rivals: Player[] = [];
      for (const t of Object.values(g.teams)) {
        for (const q of t.players) {
          if (q.bio.nation === nt.name && eligible(q, nt)) rivals.push(q);
        }
      }
      rivals.sort((a, b) => b.ability - a.ability || b.goals - a.goals);
      const rank = rivals.findIndex((q) => q.id === p.id);
      if (rank >= 0 && rank < 23) out.push({ player: p, nation: nt });
    }
  }
  return out.sort((a, b) => b.player.ability - a.player.ability);
}

// ─────────────────── Окна и турниры ───────────────────

/**
 * Окна сборных масштабируются под длину сезона:
 * 4 товарищеских окна (ранний сезон, треть, середина, три четверти)
 * и большой турнир (Евро/ЧМ) после двух третей дистанции.
 */
export function internationalWindows(len: number): { friendly: number[]; tournament: number } {
  const L = Math.max(18, len);
  const friendly = [
    3,
    Math.max(4, Math.round(L * 0.3)),
    Math.max(6, Math.round(L * 0.52)),
    Math.max(8, Math.round(L * 0.74)),
  ];
  const tournament = Math.max(7, Math.round(L * 0.62));
  return { friendly, tournament };
}

/** Тип международного события тура */
export function windowAt(round: number, len: number = 34): "friendly" | "tournament" | null {
  const { friendly, tournament } = internationalWindows(len);
  if (friendly.includes(round)) return "friendly";
  if (round === tournament) return "tournament";
  return null;
}

/** Название главного турнира сезона: чётный сезон — Евро, нечётный — ЧМ */
export function tournamentName(season: number): string {
  return season % 2 === 0 ? "чемпионат Европы" : "чемпионат мира";
}

/**
 * Предварительное уведомление: если на следующей неделе окно сборных,
 * менеджер получает письмо со списком вызванных заранее — чтобы
 * спланировать ротацию. Вызывается ПОСЛЕ инкремента тура.
 */
export function notifyCallupsAhead(g: GameState): void {
  const kind = windowAt(g.round, g.schedule?.length || 34);
  if (!kind) return;
  const mine = userCallups(g);
  if (mine.length === 0) return;
  const team = userTeam(g);
  const event = kind === "tournament"
    ? `финальная часть ${tournamentName(g.season)}`
    : "товарищеские матчи сборных";
  const lines = mine
    .map((c) => `• ${c.player.name} (${c.player.detail ?? c.player.pos}) — ${c.nation.flag} ${c.nation.name}`)
    .join("\n");
  sendMail(
    g,
    "Сборные: вызовы на следующей неделе",
    `На следующей неделе — ${event}.\n\nИгроки «${team.name}», получившие вызовы:\n\n${lines}\n\n` +
      `Планируйте ротацию: после матчей сборных игроки вернутся с усталостью.`,
    "сборные",
  );
}

/** Счёт товарищеского матча сборных из их силы */
function friendlyScore(a: NationTeam, b: NationTeam): [number, number] {
  const d = a.power - b.power;
  const mul = (adv: number) => Math.max(0, Math.min(5, Math.round(Math.random() * 2 + Math.max(0, adv) * 0.09)));
  return [mul(d), mul(-d)];
}

/**
 * Обработать международное окно: письма со списком вызванных,
 * результатами матчей сборных, лёгкий штраф усталости.
 * Вызывается из playRound.
 */
export function processInternationalWindow(g: GameState): void {
  const kind = windowAt(g.round, g.schedule?.length || 34);
  if (!kind) return;

  const callups = allCallups(g);
  const mine = userCallups(g);
  const team = userTeam(g);

  // Лёгкая усталость от перелётов всем вызванным
  for (const list of callups.values()) {
    for (const c of list) {
      c.player.fitness = Math.max(60, c.player.fitness - 2);
    }
  }

  if (kind === "friendly") {
    // Результаты пары популярных матчей
    const samples = NATIONS.filter((n) => n.power >= 78);
    const played: string[] = [];
    for (let i = 0; i < 3; i++) {
      const a = choice(samples);
      let b = choice(samples);
      let guard = 0;
      while (b.name === a.name && guard++ < 10) b = choice(samples);
      if (a.name === b.name) continue;
      const [gh, ga] = friendlyScore(a, b);
      played.push(`${a.flag} ${a.name} ${gh}:${ga} ${b.name} ${b.flag}`);
    }

    if (mine.length > 0) {
      const lines = mine
        .map((c) => `• ${c.player.name} (${c.player.detail ?? c.player.pos}) — ${c.nation.flag} ${c.nation.name}`)
        .join("\n");
      sendMail(
        g,
        `Вызовы в сборные: ${mine.length} игрок(а)`,
        `Международное окно. Следующие игроки «${team.name}» получили вызовы на товарищеские матчи:\n\n${lines}\n\n` +
          `Результаты недели:\n${played.join("\n")}\n\nИгроки вернутся с лёгкой усталостью от перелётов.`,
        "сборные",
      );
    } else {
      sendMail(
        g,
        "Международное окно",
        `Ваши игроки не получили вызовов на этот раз.\n\nРезультаты недели:\n${played.join("\n")}`,
        "сборные",
      );
    }
  } else {
    // Большой турнир: анонс финальной части
    const tour = tournamentName(g.season);
    if (mine.length > 0) {
      const lines = mine
        .map((c) => `• ${c.player.name} (${c.player.detail ?? c.player.pos}) — ${c.nation.flag} ${c.nation.name}`)
        .join("\n");
      sendMail(
        g,
        `${tour}: ваши игроки вызваны!`,
        `Стартует финальная часть ${tour}.\n\nИгроки «${team.name}» на турнире:\n\n${lines}\n\n` +
          `Они пропустят восстановление и вернутся с усталостью.`,
        "сборные",
      );
      for (const c of mine) {
        c.player.fitness = Math.max(55, c.player.fitness - 6);
      }
    } else {
      sendMail(
        g,
        `${tour}: следите за звёздами`,
        `Стартует финальная часть ${tour}. Ваших игроков в заявках нет — идеальное время подготовиться к решающим матчам.`,
        "сборные",
      );
    }
  }
}

/** Чемпион большого турнира сезона (weighted по силе) */
export function tournamentChampion(season: number): NationTeam {
  const pool = NATIONS.filter((n) => n.power >= 80);
  const winner = weightedChoice(
    pool,
    pool.map((n) => n.power * n.power),
  );
  return winner ?? NATIONS[0];
}

/** Итог большого турнира (вызывается в туре после него) */
export function maybeTournamentReport(g: GameState): void {
  const { tournament } = internationalWindows(g.schedule?.length || 34);
  if (g.round !== tournament + 1) return;
  const tour = tournamentName(g.season);
  const champ = tournamentChampion(g.season);
  const mine = userCallups(g);
  const mineInTeam = mine.filter((c) => c.nation.name === champ.name);
  const extra =
    mineInTeam.length > 0
      ? `\n\nПоздравляем! Ваши игроки (${mineInTeam.map((c) => c.player.name).join(", ")}) — чемпионы!`
      : "";
  sendMail(
    g,
    `${tour}: итог`,
    `Чемпион — ${champ.flag} сборная ${champ.name}!${extra}`,
    "сборные",
  );
}
