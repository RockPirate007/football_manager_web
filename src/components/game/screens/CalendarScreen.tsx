"use client";

/**
 * Календарь сезона: чемпионат, национальный кубок, ЛЧ и ЛЕ,
 * окна сборных и трансферные окна — по месяцам, как в FIFA Manager.
 */

import { useMemo, useState } from "react";
import { useGameStore } from "@/game/store/gameStore";
import { userTeam, userLeagueId, leagueTeams } from "@/game/core/state";
import { LEAGUE_BY_ID, leagueBaseId, isSecondDivision, competitionTheme, UCL_KEY, UEL_KEY } from "@/game/data/leagues";
import { cupDueRound, cupStageName } from "@/game/systems/cup";
import { internationalWindows, tournamentName } from "@/game/systems/international";
import { transferWindowAt } from "@/game/systems/market";
import { Card, CardContent } from "@/components/ui/card";
import { SectionTitle } from "../ui/game-ui";
import { cn } from "@/lib/utils";

const MONTHS = [
  "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
  "Январь", "Февраль", "Март", "Апрель", "Май",
];

interface CalEvent {
  kind: "league" | "cup" | "ucl" | "uel" | "intl" | "tournament" | "transfer";
  label: string;
  /** Дома/в гостях для матча пользователя */
  side?: "home" | "away";
  /** Счёт сыгранного матча */
  score?: string;
  /** Виновник события — ключ турнира (тема оформления) */
  theme?: string;
  /** Пометка «ваш матч» */
  mine?: boolean;
}

export function CalendarScreen() {
  const game = useGameStore((s) => s.game)!;
  const team = userTeam(game);
  const user = game.user;
  const len = game.schedule.length;
  const leagueId = userLeagueId(game);
  const leagueNames = new Set(leagueTeams(game, leagueId).map((t) => t.name));

  const [openMonth, setOpenMonth] = useState<number>(() => {
    // Текущий месяц открыт по умолчанию
    const r = Math.min(len, Math.max(1, game.round + 1));
    return Math.min(9, Math.floor(((r - 1) / Math.max(1, len)) * 10));
  });

  const months = useMemo(() => {
    const out: Array<{ month: string; rounds: Array<{ round: number; events: CalEvent[] }> }> = [];

    // Каденции турниров: раунд → стадии
    const cupPlans: Array<{ key: string; name: string; rounds: number[]; sizes: number[]; theme: string }> = [];
    const nationalDue = Array.from({ length: len }, (_, i) => i + 1).filter((r) => cupDueRound(leagueBaseId(leagueId), r));
    if (nationalDue.length > 0) {
      cupPlans.push({
        key: leagueBaseId(leagueId),
        name: LEAGUE_BY_ID[leagueBaseId(leagueId)].cupName,
        rounds: nationalDue,
        sizes: nationalDue.map((_, i) => Math.max(2, 64 / 2 ** i)),
        theme: `cup:${leagueBaseId(leagueId)}`,
      });
    }
    const uclDue = Array.from({ length: len }, (_, i) => i + 1).filter((r) => r % 4 === 2);
    const uelDue = Array.from({ length: len }, (_, i) => i + 1).filter((r) => r % 4 === 3);
    cupPlans.push({
      key: UCL_KEY,
      name: "Лига чемпионов",
      rounds: uclDue,
      sizes: uclDue.map((_, i) => Math.max(2, 16 / 2 ** i)),
      theme: "ucl",
    });
    cupPlans.push({
      key: UEL_KEY,
      name: "Лига Европы",
      rounds: uelDue,
      sizes: uelDue.map((_, i) => Math.max(2, 16 / 2 ** i)),
      theme: "uel",
    });

    // Окна сборных
    const { friendly, tournament } = internationalWindows(len);

    for (let m = 0; m < 10; m++) {
      const rounds: Array<{ round: number; events: CalEvent[] }> = [];
      const rStart = Math.floor((m * len) / 10);
      const rEnd = Math.floor(((m + 1) * len) / 10);
      for (let r = rStart + 1; r <= rEnd && r <= len; r++) {
        const idx = r - 1;
        const events: CalEvent[] = [];

        // Матч чемпионата
        const fixtures = game.schedule[idx] ?? [];
        const my = fixtures.find(([h, a]) => (h === user || a === user) && leagueNames.has(h) && leagueNames.has(a));
        if (my) {
          const [h, a] = my;
          const played = game.results[idx]?.find(([hh, aa]) => hh === h && aa === a);
          events.push({
            kind: "league",
            label: played ? `${h} ${played[2]}:${played[3]} ${a}` : `${h} — ${a}`,
            side: h === user ? "home" : "away",
            score: played ? `${played[2]}:${played[3]}` : undefined,
            theme: leagueId,
            mine: true,
          });
        }

        // Турниры
        for (const plan of cupPlans) {
          const pos = plan.rounds.indexOf(r);
          if (pos === -1) continue;
          const cup = game.cups[plan.key];
          if (!cup) continue;
          const finished = cup.finished && r > game.round;
          const userIn = cup.fixtures.some(([a, b]) => a === user || b === user) || (cup.finished && plan.key === leagueBaseId(leagueId));
          if (finished) continue;
          events.push({
            kind: plan.key === UCL_KEY ? "ucl" : plan.key === UEL_KEY ? "uel" : "cup",
            label: `${plan.name}: ${cupStageName(plan.sizes[pos])}`,
            theme: plan.theme,
            mine: userIn,
          });
        }

        // Окна сборных
        if (friendly.includes(idx)) {
          events.push({ kind: "intl", label: "Окно сборных: товарищеские матчи", theme: "intl" });
        }
        if (idx === tournament) {
          events.push({ kind: "tournament", label: `Финал ${tournamentName(game.season)}`, theme: "intl" });
        }

        // Трансферные окна
        const tw = transferWindowAt(idx, len);
        if (tw === "summer") {
          events.push({ kind: "transfer", label: "Летнее трансферное окно", theme: "transfer" });
        } else if (tw === "winter") {
          events.push({ kind: "transfer", label: "Зимнее трансферное окно", theme: "transfer" });
        }

        rounds.push({ round: r, events });
      }
      out.push({ month: MONTHS[m], rounds });
    }
    return out;
  }, [game, len, leagueId, leagueNames, user]);

  return (
    <div className="space-y-4">
      <SectionTitle hint="чемпионат, кубок, еврокубки, сборные и окна">📅 Календарь сезона</SectionTitle>

      {/* Легенда */}
      <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
        <LegendChip color="#22c55e" label="Чемпионат" />
        <LegendChip color="#eab308" label="Нац. кубок" />
        <LegendChip color="#5b7fdb" label="Лига чемпионов" />
        <LegendChip color="#f97316" label="Лига Европы" />
        <LegendChip color="#a855f7" label="Сборные" />
        <LegendChip color="#64748b" label="Трансферное окно" />
      </div>

      {/* Полоса месяцев */}
      <div className="flex flex-wrap gap-1.5">
        {months.map((m, i) => {
          const hasRound = m.rounds.length > 0;
          return (
            <button
              key={m.month}
              disabled={!hasRound}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors",
                openMonth === i
                  ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                  : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200",
                !hasRound && "cursor-default opacity-40",
              )}
              onClick={() => setOpenMonth(i)}
            >
              {m.month}
            </button>
          );
        })}
      </div>

      {/* Открытый месяц */}
      {months.map((m, mi) => {
        if (mi !== openMonth) return null;
        const theme = competitionTheme("league", leagueId);
        return (
          <Card key={m.month} className="overflow-hidden border-zinc-800 bg-zinc-900/70">
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ background: `linear-gradient(90deg, ${theme.bg}, ${theme.bg2})` }}
            >
              <p className="text-base font-bold" style={{ color: theme.accent }}>
                {m.month}
              </p>
              <p className="text-xs text-zinc-400">
                {isSecondDivision(leagueId) ? LEAGUE_BY_ID[leagueId].name : "Топ-дивизион"}
              </p>
            </div>
            <CardContent className="p-0">
              {m.rounds.map(({ round, events }) => {
                const isNow = round === game.round + 1;
                return (
                  <div
                    key={round}
                    className={cn(
                      "border-b border-zinc-800/50 px-4 py-2.5 last:border-0",
                      isNow && "bg-emerald-500/5",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                          isNow
                            ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/50"
                            : "bg-zinc-800/80 text-zinc-400",
                        )}
                      >
                        {round}
                      </span>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        {events.length === 0 && (
                          <p className="text-sm text-zinc-600">Свободная неделя — восстановление и тренировки</p>
                        )}
                        {events.map((ev, i) => {
                          const color = EVENT_COLORS[ev.kind];
                          return (
                            <div key={i} className="flex min-w-0 items-center gap-2">
                              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                              <p
                                className={cn(
                                  "min-w-0 truncate text-sm",
                                  ev.mine ? "font-semibold text-zinc-100" : "text-zinc-400",
                                )}
                              >
                                {ev.label}
                              </p>
                              {ev.side === "home" && <Tag className="bg-emerald-500/15 text-emerald-400">дома</Tag>}
                              {ev.side === "away" && <Tag className="bg-amber-500/15 text-amber-400">в гостях</Tag>}
                              {isNow && <Tag className="bg-emerald-500/20 text-emerald-300">сейчас</Tag>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
              {m.rounds.length === 0 && (
                <p className="py-8 text-center text-sm text-zinc-600">Матчей в этом месяце нет</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

const EVENT_COLORS: Record<CalEvent["kind"], string> = {
  league: "#22c55e",
  cup: "#eab308",
  ucl: "#5b7fdb",
  uel: "#f97316",
  intl: "#a855f7",
  tournament: "#c026d3",
  transfer: "#64748b",
};

function LegendChip({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/70 px-2 py-1">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold", className)}>
      {children}
    </span>
  );
}
