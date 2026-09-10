"use client";

/**
 * Таблицы лиг: вкладки по лигам, зоны Лиги чемпионов.
 */

import { useState } from "react";
import { useGameStore } from "@/game/store/gameStore";
import { sortedLeagueTable } from "@/game/core/state";
import { teamPlayed } from "@/game/core/team";
import { LEAGUES, competitionTheme } from "@/game/data/leagues";
import { TeamLogo, CompLogo } from "../ui/logos";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function TableScreen() {
  const game = useGameStore((s) => s.game)!;
  const [leagueId, setLeagueId] = useState<string>(game.teams[game.user].league);
  const teams = sortedLeagueTable(game, leagueId);
  const theme = competitionTheme("league", leagueId);

  return (
    <Card className="border-zinc-800 bg-zinc-900/70">
      <CardContent className="p-0">
        {/* Шапка лиги в фирменном цвете */}
        <div
          className="flex items-center gap-2.5 px-4 py-3"
          style={{ background: `linear-gradient(90deg, ${theme.bg} 0%, ${theme.bg2} 100%)` }}
        >
          <CompLogo compKey={leagueId} size={28} />
          <span className="text-sm font-bold" style={{ color: theme.accent }}>
            {theme.name}
          </span>
          <span className="ml-auto text-xs text-zinc-500">Сезон {game.season}</span>
        </div>

        {/* Вкладки лиг */}
        <div className="flex gap-1.5 overflow-x-auto border-b border-zinc-800 px-3 py-2.5">
          {LEAGUES.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setLeagueId(l.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
                leagueId === l.id
                  ? "font-semibold"
                  : "border-zinc-800 text-zinc-400 hover:border-zinc-600",
              )}
              style={
                leagueId === l.id
                  ? { borderColor: `${l.accent}99`, background: `${l.accent}22`, color: l.accent }
                  : undefined
              }
            >
              <CompLogo compKey={l.id} size={16} />
              {l.short}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-[2rem_1fr_repeat(6,2.2rem)] items-center gap-1 border-b border-zinc-800 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 sm:grid-cols-[2rem_1fr_repeat(6,3rem)]">
          <span>#</span>
          <span>Клуб</span>
          <span className="text-center">И</span>
          <span className="text-center">В</span>
          <span className="text-center">Н</span>
          <span className="text-center">П</span>
          <span className="text-center">М</span>
          <span className="text-center">О</span>
        </div>
        {teams.map((t, i) => {
          const isUser = t.name === game.user;
          const uclZone = i <= 2;
          return (
            <div
              key={t.name}
              className={cn(
                "grid grid-cols-[2rem_1fr_repeat(6,2.2rem)] items-center gap-1 border-b border-zinc-800/40 px-4 py-2.5 text-sm last:border-0 sm:grid-cols-[2rem_1fr_repeat(6,3rem)]",
                isUser && "bg-emerald-500/5 font-semibold text-emerald-300",
              )}
            >
              <span
                className={cn(
                  "text-xs",
                  uclZone
                    ? "font-bold text-amber-400"
                    : i === 3
                      ? "font-bold text-teal-500"
                      : "text-zinc-500",
                )}
                title={uclZone ? "Зона Лиги чемпионов" : i === 3 ? "Стык плей-офф ЛЧ" : undefined}
              >
                {uclZone ? "★" : ""}{i + 1}
              </span>
              <span className="flex min-w-0 items-center gap-2">
                <TeamLogo name={t.name} size={22} />
                <span className="truncate">{t.name}</span>
              </span>
              <span className="text-center text-zinc-400">{teamPlayed(t)}</span>
              <span className="text-center text-zinc-400">{t.w}</span>
              <span className="text-center text-zinc-400">{t.d}</span>
              <span className="text-center text-zinc-400">{t.l}</span>
              <span className="text-center text-zinc-500">
                {t.gf}:{t.ga}
              </span>
              <span className="text-center font-bold">{t.pts}</span>
            </div>
          );
        })}
        <p className="px-4 py-2.5 text-xs text-zinc-600">
          ★ топ-3 — прямая путёвка в Лигу чемпионов • 4-е место — стык
        </p>
      </CardContent>
    </Card>
  );
}
