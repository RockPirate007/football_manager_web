"use client";

/**
 * Статистика: бомбардиры по лигам, ассистенты, лидеры, кубки.
 */

import { useState } from "react";
import { useGameStore } from "@/game/store/gameStore";
import { userTeam, userLeagueId } from "@/game/core/state";
import { avgRating } from "@/game/core/player";
import { cupStageName } from "@/game/systems/cup";
import { LEAGUES, UCL_KEY } from "@/game/data/leagues";
import { Card, CardContent } from "@/components/ui/card";
import { PosBadge, SectionTitle } from "../ui/game-ui";
import { cn } from "@/lib/utils";

export function StatsScreen() {
  const game = useGameStore((s) => s.game)!;
  const team = userTeam(game);
  const [leagueId, setLeagueId] = useState<string>(userLeagueId(game));

  const leagueClubNames = new Set(
    Object.values(game.teams)
      .filter((t) => t.league === leagueId)
      .map((t) => t.name),
  );

  const all = Object.values(game.teams)
    .filter((t) => leagueClubNames.has(t.name))
    .flatMap((t) => t.players.map((p) => ({ p, teamName: t.name })));

  const scorers = all
    .filter(({ p }) => p.goals > 0 || p.assists > 0 || p.appearances > 0)
    .sort((a, b) => b.p.goals - a.p.goals || b.p.assists - a.p.assists || avgRating(b.p) - avgRating(a.p))
    .slice(0, 15);

  const myTop = [...team.players]
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists || avgRating(b) - avgRating(a))
    .slice(0, 5);

  const topAssist = [...all].sort((a, b) => b.p.assists - a.p.assists)[0];
  const topRating = [...all]
    .filter(({ p }) => p.appearances >= 3)
    .sort((a, b) => avgRating(b.p) - avgRating(a.p))[0];

  const userCup = game.cups[userLeagueId(game)];
  const ucl = game.cups[UCL_KEY];

  return (
    <div className="space-y-5">
      {/* Вкладки лиг */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {LEAGUES.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => setLeagueId(l.id)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors",
              leagueId === l.id
                ? "border-emerald-600 bg-emerald-600/15 font-semibold text-emerald-300"
                : "border-zinc-800 text-zinc-400 hover:border-zinc-600",
            )}
          >
            {l.short}
          </button>
        ))}
      </div>

      <div>
        <SectionTitle hint="голы, ассисты и средние оценки">Бомбардиры</SectionTitle>
        <Card className="border-zinc-800 bg-zinc-900/70">
          <CardContent className="p-0">
            {scorers.length === 0 && (
              <p className="py-6 text-center text-sm text-zinc-600">
                Статистика появится после сыгранных матчей
              </p>
            )}
            {scorers.map(({ p, teamName }, i) => (
              <div
                key={p.id}
                className={`flex items-center gap-2 border-b border-zinc-800/40 px-4 py-2 text-sm last:border-0 ${
                  teamName === game.user ? "bg-emerald-500/5" : ""
                }`}
              >
                <span className="w-7 shrink-0 text-xs text-zinc-600">
                  {i < 3 ? ["🥇", "🥈", "🥉"][i] : `${i + 1}.`}
                </span>
                <PosBadge pos={p.pos} />
                <span className="min-w-0 flex-1 truncate">
                  <span className={teamName === game.user ? "font-semibold text-emerald-300" : "text-zinc-200"}>
                    {p.name}
                  </span>
                  <span className="ml-2 text-xs text-zinc-600">{teamName}</span>
                </span>
                <span className="w-8 text-center font-bold text-amber-400">{p.goals}</span>
                <span className="w-8 text-center text-teal-400">{p.assists}</span>
                <span className="w-10 text-center text-zinc-500">{p.appearances}</span>
                <span className="w-12 text-right font-mono text-zinc-400">
                  {p.appearances > 0 ? avgRating(p).toFixed(2) : "—"}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-zinc-800 bg-zinc-900/70">
          <CardContent className="p-4">
            <SectionTitle>Ваши лидеры</SectionTitle>
            <div className="space-y-1.5">
              {myTop.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span className="truncate text-zinc-300">{p.name}</span>
                  <span className="text-xs text-zinc-500">
                    Г{p.goals} А{p.assists} М{p.appearances} • ср.{" "}
                    {p.appearances > 0 ? avgRating(p).toFixed(2) : "—"} • Ф{p.form >= 0 ? "+" : ""}
                    {p.form}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900/70">
          <CardContent className="p-4">
            <SectionTitle>Лидеры лиги</SectionTitle>
            <div className="space-y-2 text-sm">
              {scorers[0] && (
                <p className="text-zinc-300">
                  ⚽ Бомбардир: <b>{scorers[0].p.name}</b> — {scorers[0].p.goals}{" "}
                  <span className="text-zinc-600">({scorers[0].teamName})</span>
                </p>
              )}
              {topAssist && topAssist.p.assists > 0 && (
                <p className="text-zinc-300">
                  🎯 Ассистент: <b>{topAssist.p.name}</b> — {topAssist.p.assists}{" "}
                  <span className="text-zinc-600">({topAssist.teamName})</span>
                </p>
              )}
              {topRating && (
                <p className="text-zinc-300">
                  ⭐ Лучшая оценка: <b>{topRating.p.name}</b> — {avgRating(topRating.p).toFixed(2)}{" "}
                  <span className="text-zinc-600">({topRating.teamName})</span>
                </p>
              )}
              <p className="text-zinc-300">
                🏆 Кубок:{" "}
                {userCup?.finished
                  ? `«${userCup.champion}»`
                  : userCup
                    ? cupStageName(userCup.stageSize)
                    : "не начат"}
              </p>
              {ucl && (
                <p className="text-zinc-300">
                  🌍 Лига чемпионов:{" "}
                  {ucl.finished ? (
                    <b className="text-amber-400">«{ucl.champion}»</b>
                  ) : (
                    <span className="text-zinc-500">{cupStageName(ucl.stageSize)}</span>
                  )}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
