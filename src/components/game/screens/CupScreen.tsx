"use client";

/**
 * Турниры: вкладки по кубкам (национальные + Лига чемпионов),
 * сетки, раунды, результаты, путь пользователя.
 * Оформление карточки турнира — в цветах конкретного соревнования.
 */

import { useState } from "react";
import { useGameStore } from "@/game/store/gameStore";
import { cupStageName, CUP_ROUND_NAMES } from "@/game/systems/cup";
import { LEAGUE_BY_ID, UCL_KEY, UEL_KEY, competitionTheme, competitionLogoPath } from "@/game/data/leagues";
import { TeamLogo, CompLogo } from "../ui/logos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { SectionTitle } from "../ui/game-ui";
import { cn } from "@/lib/utils";

export function CupScreen() {
  const game = useGameStore((s) => s.game)!;
  const playCupRoundAction = useGameStore((s) => s.playCupRoundAction);
  const [tab, setTab] = useState<string>(game.teams[game.user].league);

  const cupKeys = Object.keys(game.cups);
  const cup = game.cups[tab];

  if (cupKeys.length === 0 || !cup) {
    return <p className="text-sm text-zinc-500">Турниры ещё не разыграны.</p>;
  }

  const isUcl = tab === UCL_KEY;
  const isUel = tab === UEL_KEY;
  const theme = competitionTheme(isUcl ? "ucl" : isUel ? "uel" : "cup", tab);
  const logoKey = isUcl ? "ucl" : isUel ? "uel" : `cup:${tab}`;

  const userPath = cup.results.filter((r) => r.a === game.user || r.b === game.user);
  const nextUserFixture = cup.fixtures.find(([a, b]) => a === game.user || b === game.user);

  const play = (watch: boolean) => {
    const res = playCupRoundAction(tab, watch);
    toast.info(res.message);
  };

  return (
    <div className="space-y-5">
      {/* Вкладки турниров */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {cupKeys.map((key) => {
          const c = game.cups[key];
          const isLeagueCup = key in LEAGUE_BY_ID;
          const t = competitionTheme(key === UCL_KEY ? "ucl" : key === UEL_KEY ? "uel" : "cup", key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
                tab === key
                  ? "font-semibold"
                  : "border-zinc-800 text-zinc-400 hover:border-zinc-600",
                isLeagueCup && key !== game.teams[game.user].league && tab !== key && "text-zinc-500",
              )}
              style={
                tab === key
                  ? { borderColor: `${t.accent}99`, background: `${t.accent}22`, color: t.accent }
                  : undefined
              }
            >
              <CompLogo compKey={key === UCL_KEY ? "ucl" : key === UEL_KEY ? "uel" : `cup:${key}`} size={16} />
              {key === UCL_KEY ? "ЛЧ" : key === UEL_KEY ? "ЛЕ" : c.name.replace("Кубок ", "")}
              {!c.finished && (c.fixtures.some(([a, b]) => a === game.user || b === game.user)) && (
                <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
              )}
            </button>
          );
        })}
      </div>

      {/* Турнирная карточка в цветах соревнования */}
      <Card
        className="overflow-hidden border"
        style={{
          borderColor: `${theme.accent}55`,
          background: `linear-gradient(135deg, ${theme.bg} 0%, ${theme.bg2} 60%, ${theme.bg} 100%)`,
        }}
      >
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
            <span className="flex items-center gap-2">
              <span
                className="flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ background: "#ffffff14", border: `1px solid ${theme.accent}44` }}
              >
                <CompLogo compKey={logoKey} size={30} />
              </span>
              <span>
                <span className="block" style={{ color: theme.accent }}>
                  {cup.name}
                </span>
                <span className="block text-xs font-normal text-zinc-400">Сезон {game.season}</span>
              </span>
            </span>
            {cup.finished ? (
              <span className="flex items-center gap-1.5 text-sm font-semibold text-amber-300">
                {cup.champion && <TeamLogo name={cup.champion} size={20} />} Обладатель: «{cup.champion}»
              </span>
            ) : (
              <span className="text-emerald-400">{cupStageName(cup.stageSize)}</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!cup.finished && (
            <>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {cup.fixtures
                  .filter(([a, b]) => a !== null || b !== null)
                  .map(([a, b], i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                      a === game.user || b === game.user
                        ? "border-emerald-600/50 bg-emerald-500/5 font-semibold text-emerald-300"
                        : "border-zinc-800 bg-zinc-950/60 text-zinc-400",
                    )}
                  >
                    {a && <TeamLogo name={a} size={18} />}
                    <span className="truncate">{a ?? "bye"}</span>
                    <span className="text-zinc-600">—</span>
                    {b && <TeamLogo name={b} size={18} />}
                    <span className="truncate">{b ?? "bye"}</span>
                    {(a === game.user || b === game.user) && " ←"}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button className="bg-emerald-600 font-bold hover:bg-emerald-500" onClick={() => play(true)}>
                  📺 Сыграть раунд (с трансляцией)
                </Button>
                <Button variant="outline" className="border-zinc-700" onClick={() => play(false)}>
                  ⚡ Быстрый раунд
                </Button>
              </div>
            </>
          )}
          {cup.finished && (
            <p className="text-sm text-zinc-400">
              {cup.champion === game.user
                ? "Ваш клуб — обладатель трофея! Трибуны запомнят этот финал."
                : "Турнир завершился. Новый розыгрыш — в следующем сезоне."}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Путь пользователя */}
      <div>
        <SectionTitle>Путь вашего клуба</SectionTitle>
        <Card className="border-zinc-800 bg-zinc-900/60">
          <CardContent className="p-4">
            {userPath.length === 0 && !nextUserFixture && (
              <p className="text-sm text-zinc-600">Пока нет матчей с вашим участием.</p>
            )}
            <div className="space-y-1.5">
              {userPath.map((r, i) => {
                const won = r.winner === game.user;
                return (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="flex min-w-0 items-center gap-1.5 text-zinc-400">
                      <span className="mr-1 shrink-0 text-xs text-zinc-600">{r.stage}</span>
                      <TeamLogo name={r.a ?? ""} size={16} />
                      {r.a} {r.gh}:{r.ga} {r.b}
                      <TeamLogo name={r.b ?? ""} size={16} />
                      {r.pen && <span className="ml-1 shrink-0 text-amber-400">(пен)</span>}
                    </span>
                    <span className={won ? "shrink-0 font-bold text-emerald-400" : "shrink-0 font-bold text-rose-400"}>
                      {won ? "победа" : "вылет"}
                    </span>
                  </div>
                );
              })}
              {nextUserFixture && !cup.finished && (
                <p className="flex items-center gap-1.5 text-sm text-emerald-400">
                  Далее: {nextUserFixture[0] && <TeamLogo name={nextUserFixture[0]} size={16} />} {nextUserFixture[0] ?? "bye"} —{" "}
                  {nextUserFixture[1] ?? "bye"} {nextUserFixture[1] && <TeamLogo name={nextUserFixture[1]} size={16} />}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Все результаты */}
      {cup.results.length > 0 && (
        <div>
          <SectionTitle hint={`этапы: ${Object.values(CUP_ROUND_NAMES).join(", ")}`}>
            Результаты турнира
          </SectionTitle>
          <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
            {cup.results
              .slice()
              .reverse()
              .map((r, i) => (
                <p key={i} className="flex items-center gap-1.5 rounded bg-zinc-950/60 px-3 py-1.5 text-xs text-zinc-500">
                  <span className="mr-1 shrink-0 text-zinc-600">[{r.stage}]</span>
                  {r.a && <TeamLogo name={r.a} size={14} />}
                  {r.a ?? "bye"} {r.gh}:{r.ga} {r.b ?? "bye"}
                  {r.b && <TeamLogo name={r.b} size={14} />}
                  {r.pen && <span className="text-amber-400"> (пен)</span>}
                  <span className="text-emerald-500">→ {r.winner}</span>
                </p>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
