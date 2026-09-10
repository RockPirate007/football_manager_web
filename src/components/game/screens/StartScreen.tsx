"use client";

/**
 * Стартовый экран: новая карьера (выбор реального клуба, сложности,
 * режима песочницы) или продолжение.
 */

import { useEffect, useState } from "react";
import { useGameStore } from "@/game/store/gameStore";
import { LEAGUES, findLeagueByClub, clubBudget } from "@/game/data/leagues";
import { realPlayersCount } from "@/game/data/players";
import { DIFFICULTY_INFO, type Difficulty } from "@/game/core/types";
import { TeamLogo, CompLogo } from "../ui/logos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function stars(power: number): string {
  const n = Math.max(1, Math.min(5, Math.floor((power - 56) / 6)));
  return "★".repeat(n) + "☆".repeat(5 - n);
}

const DIFF_ORDER: Difficulty[] = ["easy", "normal", "hard", "legend"];
const DIFF_STYLE: Record<Difficulty, string> = {
  easy: "border-emerald-500 bg-emerald-500/10 text-emerald-300",
  normal: "border-sky-500 bg-sky-500/10 text-sky-300",
  hard: "border-amber-500 bg-amber-500/10 text-amber-300",
  legend: "border-rose-500 bg-rose-500/10 text-rose-300",
};

export function StartScreen() {
  const startNewGame = useGameStore((s) => s.startNewGame);
  const continueGame = useGameStore((s) => s.continueGame);
  const refreshHasSave = useGameStore((s) => s.refreshHasSave);
  const hasSavedGame = useGameStore((s) => s.hasSavedGame);
  const [manager, setManager] = useState("");
  const [club, setClub] = useState(LEAGUES[0].clubs[0].name);
  const [leagueId, setLeagueId] = useState(LEAGUES[0].id);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [moneyCheat, setMoneyCheat] = useState(false);
  const [step, setStep] = useState<"menu" | "new">("menu");

  useEffect(() => {
    refreshHasSave();
  }, [refreshHasSave]);

  const activeLeague = LEAGUES.find((l) => l.id === leagueId) ?? LEAGUES[0];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-4 py-12">
        {/* Логотип */}
        <div className="mb-10 text-center">
          <div className="mb-3 text-6xl">⚽</div>
          <h1 className="text-4xl font-black tracking-tight">
            FOOTBALL <span className="text-emerald-400">MANAGER</span>
          </h1>
          <p className="mt-2 text-sm uppercase tracking-[0.3em] text-zinc-500">
            Реальные лиги • 50 клубов • {realPlayersCount()} звёзд
          </p>
        </div>

        {step === "menu" ? (
          <div className="w-full space-y-4">
            {hasSavedGame && (
              <Button
                size="lg"
                className="h-14 w-full bg-emerald-600 text-base font-bold hover:bg-emerald-500"
                onClick={() => continueGame()}
              >
                📂 Продолжить карьеру
              </Button>
            )}
            <Button
              size="lg"
              variant="outline"
              className="h-14 w-full border-zinc-700 bg-zinc-900 text-base font-bold hover:bg-zinc-800"
              onClick={() => setStep("new")}
            >
              🌟 Новая игра
            </Button>
            <div className="flex items-center justify-center gap-3 pt-4 opacity-80">
              {LEAGUES.map((l) => (
                <CompLogo key={l.id} compKey={l.id} size={30} />
              ))}
              <CompLogo compKey="ucl" size={30} />
            </div>
            <p className="text-center text-xs text-zinc-600">
              АПЛ • Ла Лига • Серия А • Бундеслига • Лига 1 — национальные кубки и Лига чемпионов
            </p>
          </div>
        ) : (
          <div className="w-full space-y-6">
            <Card className="border-zinc-800 bg-zinc-900">
              <CardHeader>
                <CardTitle className="text-lg">Новая карьера</CardTitle>
                <CardDescription>Выберите лигу, клуб и уровень вызова</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <label className="mb-1.5 block text-sm text-zinc-400" htmlFor="manager-name">
                    Ваше имя
                  </label>
                  <Input
                    id="manager-name"
                    placeholder="Наставник"
                    value={manager}
                    onChange={(e) => setManager(e.target.value)}
                    className="border-zinc-700 bg-zinc-950"
                    maxLength={20}
                  />
                </div>

                {/* Выбор лиги */}
                <div>
                  <label className="mb-1.5 block text-sm text-zinc-400">Лига</label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {LEAGUES.map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => setLeagueId(l.id)}
                        className={cn(
                          "flex flex-col items-center rounded-lg border px-2 py-2 text-center text-xs font-semibold transition-colors",
                          leagueId === l.id
                            ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                            : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-600",
                        )}
                      >
                        <CompLogo compKey={l.id} size={26} className="mb-1" />
                        <span className="block truncate">{l.short}</span>
                        <span className="block text-[10px] font-normal text-zinc-600">{l.country}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Выбор клуба */}
                <div>
                  <label className="mb-1.5 block text-sm text-zinc-400">
                    Клуб — {activeLeague.name}
                  </label>
                  <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                    {activeLeague.clubs.map((c) => {
                      const lg = findLeagueByClub(c.name);
                      const isUserLeague = lg?.id === leagueId;
                      void isUserLeague;
                      return (
                        <button
                          key={c.name}
                          type="button"
                          onClick={() => setClub(c.name)}
                          className={cn(
                            "flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors",
                            club === c.name
                              ? "border-emerald-500 bg-emerald-500/10"
                              : "border-zinc-800 bg-zinc-950 hover:border-zinc-600",
                          )}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <TeamLogo name={c.name} size={30} />
                            <span className="min-w-0">
                              <span className="block truncate font-semibold">{c.name}</span>
                              <span className="block text-[10px] text-zinc-600">
                                {c.city} • {c.stadium}
                              </span>
                            </span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="block text-xs text-amber-400">{stars(c.power)}</span>
                            <span className="block text-[10px] text-zinc-500">
                              {(clubBudget(c.power) / 1_000_000).toFixed(1)} млн €
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Сложность */}
                <div>
                  <label className="mb-1.5 block text-sm text-zinc-400">Сложность</label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {DIFF_ORDER.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDifficulty(d)}
                        className={cn(
                          "rounded-lg border px-2 py-2 text-center transition-colors",
                          difficulty === d
                            ? DIFF_STYLE[d]
                            : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-600",
                        )}
                      >
                        <span className="block text-sm font-bold">{DIFFICULTY_INFO[d].label}</span>
                        <span className="mt-0.5 block text-[10px] leading-tight text-zinc-500">
                          {DIFFICULTY_INFO[d].desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Песочница */}
                <button
                  type="button"
                  onClick={() => setMoneyCheat((v) => !v)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors",
                    moneyCheat
                      ? "border-amber-500/60 bg-amber-500/10"
                      : "border-zinc-800 bg-zinc-950 hover:border-zinc-600",
                  )}
                  aria-pressed={moneyCheat}
                >
                  <span>
                    <span className={cn("block text-sm font-bold", moneyCheat ? "text-amber-300" : "text-zinc-300")}>
                      💰 Бесконечные деньги
                    </span>
                    <span className="block text-xs text-zinc-500">
                      Бюджет 1 млрд €, банкротство и увольнения за долги отключены
                    </span>
                  </span>
                  <span
                    className={cn(
                      "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                      moneyCheat ? "bg-amber-500" : "bg-zinc-700",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all",
                        moneyCheat ? "left-[22px]" : "left-0.5",
                      )}
                    />
                  </span>
                </button>

                <div className="flex gap-3">
                  <Button
                    className="h-11 flex-1 bg-emerald-600 font-bold hover:bg-emerald-500"
                    onClick={() => startNewGame(manager.trim(), club, difficulty, moneyCheat)}
                  >
                    Начать карьеру
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-11"
                    onClick={() => setStep("menu")}
                  >
                    Назад
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
