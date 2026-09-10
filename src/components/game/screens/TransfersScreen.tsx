"use client";

/**
 * Трансферы: агенты, рынок клубов, продажа, аренды, контракты, офферы ИИ.
 */

import { useMemo, useState } from "react";
import { useGameStore } from "@/game/store/gameStore";
import { userTeam } from "@/game/core/state";
import { fmtMoney } from "@/game/core/money";
import { desiredSalary, contractLabel } from "@/game/core/player";
import { floor1000 } from "@/game/core/rng";
import { POSITIONS } from "@/game/core/types";
import { transferWindowAt, transferWindowLabel, type TransferWindow } from "@/game/systems/market";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PlayerLine, SectionTitle } from "../ui/game-ui";

export function TransfersScreen() {
  const game = useGameStore((s) => s.game)!;
  const beginAgentNegotiation = useGameStore((s) => s.beginAgentNegotiation);
  const beginClubNegotiation = useGameStore((s) => s.beginClubNegotiation);
  const sell = useGameStore((s) => s.sell);
  const takeOnLoan = useGameStore((s) => s.takeOnLoan);
  const sendOnLoan = useGameStore((s) => s.sendOnLoan);
  const checkAiOffers = useGameStore((s) => s.checkAiOffers);
  const openProfile = useGameStore((s) => s.openProfile);
  const [askYears, setAskYears] = useState<Record<number, number>>({});

  const team = userTeam(game);
  const window_ = transferWindowAt(game.round);
  const windowOpen = window_ !== "closed";

  const clubMarket = useMemo(() => {
    const pool: Array<{ teamName: string; player: (typeof team.players)[number] }> = [];
    for (const t of Object.values(game.teams)) {
      if (t.name === game.user) continue;
      for (const p of t.players) {
        if (!p.onLoan) pool.push({ teamName: t.name, player: p });
      }
    }
    return pool.sort((a, b) => b.player.ability - a.player.ability);
  }, [game]);

  const loanCandidates = useMemo(() => {
    const pool: Array<{ teamName: string; player: (typeof team.players)[number] }> = [];
    for (const t of Object.values(game.teams)) {
      if (t.name === game.user) continue;
      for (const p of t.players) {
        if (!p.onLoan && p.ability >= 60) pool.push({ teamName: t.name, player: p });
      }
    }
    return pool.sort((a, b) => b.player.ability - a.player.ability);
  }, [game]);

  const sellable = team.players
    .filter((p) => !p.onLoan)
    .sort((a, b) => b.value - a.value);

  const loanOutCandidates = team.players
    .filter((p) => !p.onLoan && !team.lineupIds.includes(p.id))
    .sort((a, b) => b.value - a.value);

  const expiring = team.players
    .filter((p) => !p.onLoan && p.contractYears <= 1)
    .sort((a, b) => b.ability - a.ability);

  const withAsk = (p: (typeof team.players)[number]) => {
    const years = askYears[p.id] ?? 3;
    const base = desiredSalary(p, years);
    return { years, ask: floor1000(base * (1.0 + ((p.id * 37) % 18) / 100)) };
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-400">
          Бюджет: <span className="font-bold text-amber-300">{fmtMoney(team.budget)}</span>
        </p>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs font-bold",
              windowOpen
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "border-zinc-700 bg-zinc-900 text-zinc-500",
            )}
            title={
              windowOpen
                ? "Окно открыто: покупки, продажи и аренды доступны"
                : "Окна: лето (туры 1–5) и зима (туры 11–12). Свободные агенты и контракты — всегда"
            }
          >
            {windowOpen ? "🛒" : "🔒"} {transferWindowLabel(window_ as TransferWindow)}
          </span>
          <Button
            size="sm"
            variant="outline"
            className={cn(
              "border-amber-700 text-amber-400 hover:bg-amber-950",
              !windowOpen && "opacity-50",
            )}
            onClick={() => checkAiOffers()}
          >
            📨 Проверить предложения ИИ
          </Button>
        </div>
      </div>

      <Tabs defaultValue="agents" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-zinc-900 lg:grid-cols-6">
          <TabsTrigger value="agents" className="text-xs">Агенты</TabsTrigger>
          <TabsTrigger value="market" className="text-xs">Рынок</TabsTrigger>
          <TabsTrigger value="sell" className="text-xs">Продажа</TabsTrigger>
          <TabsTrigger value="loanin" className="text-xs">Аренда +</TabsTrigger>
          <TabsTrigger value="loanout" className="text-xs">Аренда −</TabsTrigger>
          <TabsTrigger value="contracts" className="text-xs">Контракты</TabsTrigger>
        </TabsList>

        {/* Свободные агенты */}
        <TabsContent value="agents" className="mt-3">
          <SectionTitle hint="подпись 5–12% стоимости">Свободные агенты ({game.freeAgents.length})</SectionTitle>
          <div className="max-h-[55vh] space-y-1.5 overflow-y-auto pr-1">
            {game.freeAgents.length === 0 && (
              <p className="py-6 text-center text-sm text-zinc-600">Рынок свободных агентов пуст</p>
            )}
            {game.freeAgents
              .slice()
              .sort((a, b) => b.ability - a.ability)
              .map((p) => (
                <PlayerLine
                  key={p.id}
                  player={p}
                  onProfile={openProfile}
                  action={
                    <Button
                      size="sm"
                      className="h-7 bg-emerald-600 text-xs hover:bg-emerald-500"
                      onClick={() => beginAgentNegotiation(p.id)}
                    >
                      Подписать
                    </Button>
                  }
                />
              ))}
          </div>
        </TabsContent>

        {/* Рынок клубов */}
        <TabsContent value="market" className="mt-3">
          <SectionTitle hint="цена клуба: 115–145% стоимости">Игроки других клубов</SectionTitle>
          <div className="max-h-[55vh] space-y-1.5 overflow-y-auto pr-1">
            {clubMarket.map(({ teamName, player: p }) => (
              <PlayerLine
                key={p.id}
                player={p}
                onProfile={openProfile}
                action={
                  <div className="flex items-center gap-2">
                    <span className="hidden text-[11px] text-zinc-500 sm:inline">{teamName}</span>
                    <span className="text-xs text-amber-300">
                      ~{fmtMoney(floor1000(p.value * 1.3))}
                    </span>
                    <Button
                      size="sm"
                      className={cn("h-7 text-xs", windowOpen ? "bg-emerald-600 hover:bg-emerald-500" : "bg-zinc-700 text-zinc-400")}
                      onClick={() => beginClubNegotiation(p.id)}
                    >
                      Купить
                    </Button>
                  </div>
                }
              />
            ))}
          </div>
        </TabsContent>

        {/* Продажа */}
        <TabsContent value="sell" className="mt-3">
          <SectionTitle hint="клуб предложит 85–105% стоимости, шанс 75%">
            Продажа игроков (минимум 13 в заявке)
          </SectionTitle>
          <div className="max-h-[55vh] space-y-1.5 overflow-y-auto pr-1">
            {sellable.map((p) => (
              <PlayerLine
                key={p.id}
                player={p}
                onProfile={openProfile}
                action={
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-emerald-400">→ {fmtMoney(p.value)}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className={cn(
                        "h-7 text-xs",
                        windowOpen ? "border-rose-800 text-rose-400 hover:bg-rose-950" : "border-zinc-800 text-zinc-600",
                      )}
                      onClick={() => {
                        const res = sell(p.id);
                        if (res.ok) toast.success(res.message);
                        else toast.error(res.message);
                      }}
                    >
                      Продать
                    </Button>
                  </div>
                }
              />
            ))}
          </div>
        </TabsContent>

        {/* Аренда внутрь */}
        <TabsContent value="loanin" className="mt-3">
          <SectionTitle hint="арендная плата 8% стоимости • половина зарплаты ваша">
            Взять в аренду
          </SectionTitle>
          <div className="max-h-[55vh] space-y-1.5 overflow-y-auto pr-1">
            {loanCandidates.map(({ teamName, player: p }) => (
              <PlayerLine
                key={p.id}
                player={p}
                onProfile={openProfile}
                action={
                  <div className="flex items-center gap-2">
                    <span className="hidden text-[11px] text-zinc-500 sm:inline">{teamName}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className={cn(
                        "h-7 text-xs",
                        windowOpen ? "border-teal-800 text-teal-400 hover:bg-teal-950" : "border-zinc-800 text-zinc-600",
                      )}
                      onClick={() => {
                        const res = takeOnLoan(p.id);
                        if (res.ok) toast.success(res.message);
                        else toast.error(res.message);
                      }}
                    >
                      Арендовать
                    </Button>
                  </div>
                }
              />
            ))}
          </div>
        </TabsContent>

        {/* Аренда наружу */}
        <TabsContent value="loanout" className="mt-3">
          <SectionTitle hint="игрок уходит до конца сезона, вы экономите 50% зарплаты">
            Отдать в аренду (запасные)
          </SectionTitle>
          <div className="max-h-[55vh] space-y-1.5 overflow-y-auto pr-1">
            {loanOutCandidates.length === 0 && (
              <p className="py-6 text-center text-sm text-zinc-600">Все игроки в старте или в аренде</p>
            )}
            {loanOutCandidates.map((p) => (
              <PlayerLine
                key={p.id}
                player={p}
                onProfile={openProfile}
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    className={cn(
                      "h-7 text-xs",
                      windowOpen ? "border-teal-800 text-teal-400 hover:bg-teal-950" : "border-zinc-800 text-zinc-600",
                    )}
                    onClick={() => {
                      const res = sendOnLoan(p.id);
                      if (res.ok) toast.success(res.message);
                      else toast.error(res.message);
                    }}
                  >
                    Отдать
                  </Button>
                }
              />
            ))}
          </div>
        </TabsContent>

        {/* Контракты */}
        <TabsContent value="contracts" className="mt-3">
          <SectionTitle hint="истекают в этом/следующем сезоне">Продление контрактов</SectionTitle>
          <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
            {expiring.length === 0 && (
              <p className="py-6 text-center text-sm text-zinc-600">
                Нет игроков с истекающим контрактом (≤ 1 год)
              </p>
            )}
            {expiring.map((p) => {
              const { years, ask } = withAsk(p);
              return (
                <div key={p.id} className="space-y-2">
                  <PlayerLine
                    player={p}
                    onProfile={openProfile}
                    action={
                      <span className="text-[11px] text-zinc-500">{contractLabel(p)} • {fmtMoney(p.salary)}/тур</span>
                    }
                  />
                  <div className="flex flex-wrap items-center gap-2 pl-12 text-xs text-zinc-400">
                    <span>Срок:</span>
                    {[1, 2, 3, 4].map((y) => (
                      <button
                        key={y}
                        className={`rounded px-2 py-0.5 ${
                          years === y ? "bg-emerald-600 text-white" : "bg-zinc-800 hover:bg-zinc-700"
                        }`}
                        onClick={() => setAskYears((m) => ({ ...m, [p.id]: y }))}
                      >
                        {y} г.
                      </button>
                    ))}
                    <span className="ml-2 text-amber-300">просит {fmtMoney(ask)}/тур</span>
                    <Button
                      size="sm"
                      className="h-6 bg-emerald-600 text-[11px] hover:bg-emerald-500"
                      onClick={() => {
                        const res = useGameStore.getState().renew(p.id, years, true);
                        if (res.ok) toast.success(res.message);
                        else toast.error(res.message);
                      }}
                    >
                      Согласиться
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 border-zinc-700 text-[11px]"
                      onClick={() => {
                        const res = useGameStore.getState().renew(p.id, years, false);
                        if (res.ok) toast.success(res.message);
                        else toast.error(res.message);
                      }}
                    >
                      Предложить {fmtMoney(desiredSalary(p, years))}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      <p className="text-xs text-zinc-600">
        Позиции: {POSITIONS.join(" • ")} • Минимум 13 игроков в заявке
      </p>
    </div>
  );
}
