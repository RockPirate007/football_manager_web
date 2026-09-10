"use client";

/**
 * Карьера: молодёжная академия (U17/U19, юниорские контракты, классы
 * поколений), региональная скаутская сеть с отложенными отчётами,
 * история, прогресс задач, репутация/доверие.
 */

import { useState } from "react";
import { useGameStore } from "@/game/store/gameStore";
import { userTeam, userPlace } from "@/game/core/state";
import { fmtMoney } from "@/game/core/money";
import { reputationLabel, trustLabel, evaluateObjectives } from "@/game/systems/career";
import { expectedPlace } from "@/game/systems/board";
import { SCOUT_FREE_COST, SCOUT_YOUTH_COST, maxScoutMissions } from "@/game/systems/scouting";
import {
  academyGroupOf,
  SCOUT_REGIONS,
  SCOUT_REGION_IDS,
  type ScoutRegionId,
  type Player,
  type YouthGroup,
} from "@/game/core/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { PosBadge, SectionTitle, Money, StatBar } from "../ui/game-ui";
import { cn } from "@/lib/utils";

const GROUP_LABEL: Record<YouthGroup, { title: string; desc: string }> = {
  U17: { title: "Группа U17", desc: "до 18 лет — самое время растить и не спешить" },
  U19: { title: "Группа U19", desc: "18–20 лет — кандидаты на профконтракт" },
};

export function CareerScreen() {
  const game = useGameStore((s) => s.game)!;
  const academyPromote = useGameStore((s) => s.academyPromote);
  const academyRegen = useGameStore((s) => s.academyRegen);
  const scout = useGameStore((s) => s.scout);
  const scoutRegion = useGameStore((s) => s.scoutRegion);
  const cancelScoutMissionAction = useGameStore((s) => s.cancelScoutMissionAction);
  const openProfile = useGameStore((s) => s.openProfile);

  const team = userTeam(game);
  const checks = evaluateObjectives(game);
  const missions = game.scoutMissions ?? [];
  const missionLimit = maxScoutMissions(game);

  const doScout = (action: "free" | "youth") => {
    const res = scout(action);
    if (res.ok) toast.success(res.message);
    else if (res.kind === "warning") toast.warning(res.message);
    else toast.error(res.message);
  };

  const doScoutRegion = (region: ScoutRegionId) => {
    const res = scoutRegion(region);
    if (res.ok) toast.success(res.message);
    else toast.warning(res.message);
  };

  const doCancelMission = (id: number) => {
    const res = cancelScoutMissionAction(id);
    if (res.ok) toast.info(res.message);
    else toast.error(res.message);
  };

  const promote = (p: Player) => {
    const res = academyPromote(p.id);
    if (res.ok) toast.success(res.message);
    else toast.error(res.message);
  };

  // Юниоры по возрастным группам
  const u17 = game.academy.filter((p) => academyGroupOf(p.age) === "U17");
  const u19 = game.academy.filter((p) => academyGroupOf(p.age) === "U19");

  return (
    <div className="space-y-5">
      {/* Репутация / доверие */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="border-zinc-800 bg-zinc-900/70">
          <CardContent className="p-4">
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-sm text-zinc-400">🎖 Репутация</span>
              <span className="text-sm font-bold text-emerald-400">
                {game.reputation}/100 • {reputationLabel(game.reputation)}
              </span>
            </div>
            <StatBar value={game.reputation} />
          </CardContent>
        </Card>
        <Card className="border-zinc-800 bg-zinc-900/70">
          <CardContent className="p-4">
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-sm text-zinc-400">🏛 Доверие совета</span>
              <span
                className={
                  game.boardTrust <= 30
                    ? "text-sm font-bold text-rose-400"
                    : "text-sm font-bold text-emerald-400"
                }
              >
                {game.boardTrust}/100 • {trustLabel(game.boardTrust)}
              </span>
            </div>
            <StatBar value={game.boardTrust} />
            {game.warnings > 0 && (
              <p className="mt-2 text-xs text-rose-400">⚠ Предупреждений: {game.warnings}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Совет директоров: ожидания и положение */}
      <Card className="border-zinc-800 bg-zinc-900/70">
        <CardContent className="space-y-2 p-4">
          <p className="text-sm font-bold uppercase tracking-wider text-zinc-400">🏛 Совет директоров</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-zinc-300">
            <p>
              Ожидания: <b className="text-amber-300">топ-{expectedPlace(game)}</b>
            </p>
            <p>
              Сейчас: <b className="text-zinc-100">{userPlace(game)}-е место</b>
            </p>
            <p>
              Предупреждений: <b className={game.warnings > 0 ? "text-rose-400" : "text-zinc-100"}>{game.warnings}</b>
            </p>
            <p className="text-xs text-zinc-500">
              Обзоры совета — на 25%, 50% и 75% сезона; за отставание — ультиматум с дедлайном.
            </p>
          </div>
          {game.boardUltimatum && (
            <div className="rounded-lg border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-sm">
              <p className="font-bold text-rose-300">
                ⚠ Активный ультиматум: {game.boardUltimatum.text}
              </p>
              <p className="text-xs text-rose-200/80">
                До дедлайна {game.boardUltimatum.roundsLeft} тур(ов). Не выполните — контракт расторгнут.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="academy" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-zinc-900">
          <TabsTrigger value="academy" className="text-xs">Академия</TabsTrigger>
          <TabsTrigger value="scout" className="text-xs">Скаутинг</TabsTrigger>
          <TabsTrigger value="history" className="text-xs">История</TabsTrigger>
          <TabsTrigger value="progress" className="text-xs">Задачи</TabsTrigger>
        </TabsList>

        {/* ─────────── Академия ─────────── */}
        <TabsContent value="academy" className="mt-3 space-y-3">
          {/* Последний набор — класс поколения */}
          {game.youthIntake && (
            <Card className="border-emerald-900/60 bg-emerald-950/20">
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <p className="text-sm font-bold text-emerald-300">
                    🎓 Набор сезона {game.youthIntake.season}: {game.youthIntake.grade} класс поколения
                  </p>
                  <p className="text-xs text-zinc-400">
                    Принято {game.youthIntake.count} юниоров • Лучший:{" "}
                    <b className="text-zinc-200">{game.youthIntake.bestName}</b> (потенциал{" "}
                    {game.youthIntake.bestPotential})
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-emerald-700 text-emerald-400 hover:bg-emerald-950"
              onClick={() => {
                const res = academyRegen();
                if (res.ok) toast.success(res.message);
                else toast.error(res.message);
              }}
            >
              🔄 Доскомплектовать (150 тыс €)
            </Button>
            <p className="self-center text-xs text-zinc-500">
              Новое поколение приходит автоматически в межсезонье
            </p>
          </div>

          {game.academy.length === 0 && (
            <p className="py-4 text-center text-sm text-zinc-600">
              Академия пуста. Новое поколение — в межсезонье.
            </p>
          )}

          {(["U17", "U19"] as YouthGroup[]).map((grp) => {
            const list = grp === "U17" ? u17 : u19;
            if (list.length === 0) return null;
            return (
              <div key={grp}>
                <div className="mb-1.5 flex items-baseline gap-3">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
                    {GROUP_LABEL[grp].title}
                  </p>
                  <p className="text-[11px] text-zinc-600">{GROUP_LABEL[grp].desc}</p>
                </div>
                <div className="space-y-1.5">
                  {list.map((p) => (
                    <div
                      key={p.id}
                      className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm sm:gap-3"
                    >
                      <PosBadge pos={p.pos} detail={p.detail} />
                      <button className="min-w-0 flex-1 text-left font-medium hover:text-emerald-400" onClick={() => openProfile(p.id)}>
                        {p.name}
                      </button>
                      <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-400" title="Юниорский контракт">
                        юниор
                      </span>
                      <span className={p.ability >= 70 ? "text-emerald-400" : "text-zinc-300"}>
                        {p.ability}→{p.potential}
                      </span>
                      <span className="text-xs text-zinc-500">{p.age} л</span>
                      <span className="hidden text-xs text-zinc-500 sm:inline">{fmtMoney(p.salary)}/тур</span>
                      <Button
                        size="sm"
                        className="h-7 bg-emerald-600 text-xs hover:bg-emerald-500"
                        title={`Перевод в основу с автоподписанием профконтракта (зарплата вырастет ~в 3 раза)`}
                        onClick={() => promote(p)}
                      >
                        ⬆ Профконтракт
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </TabsContent>

        {/* ─────────── Скаутинг ─────────── */}
        <TabsContent value="scout" className="mt-3 space-y-4">
          {/* Активные миссии */}
          <div>
            <SectionTitle hint={`лимит: ${missionLimit} параллельно — улучшите скаута в штате`}>
              Региональная сеть — миссии в работе
            </SectionTitle>
            {missions.length === 0 ? (
              <p className="rounded-lg border border-dashed border-zinc-800 px-3 py-3 text-center text-sm text-zinc-600">
                Скауты в клубе — отправьте миссию в регион ниже
              </p>
            ) : (
              <div className="space-y-1.5">
                {missions.map((m) => {
                  const region = SCOUT_REGIONS[m.region];
                  const done = m.totalRounds - m.roundsLeft;
                  return (
                    <div key={m.id} className="rounded-lg border border-emerald-900/60 bg-emerald-950/20 px-3 py-2">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        <span>{region.icon}</span>
                        <b className="text-emerald-300">{region.label}</b>
                        <span className="text-xs text-zinc-500">скаут: {m.scoutName}</span>
                        <span className="ml-auto text-xs font-bold text-amber-300">
                          отчёт через {m.roundsLeft} {m.roundsLeft === 1 ? "тур" : "тура"}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[11px] text-zinc-500 hover:text-rose-400"
                          onClick={() => doCancelMission(m.id)}
                        >
                          отменить
                        </Button>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded bg-zinc-800">
                        <div
                          className="h-full rounded bg-emerald-500 transition-all"
                          style={{ width: `${Math.round((done / m.totalRounds) * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Выбор региона */}
          <div>
            <SectionTitle hint="отчёт придёт письмом через 2–3 тура; точность зависит от скаута в штате">
              Отправить миссию
            </SectionTitle>
            <div className="grid gap-2 sm:grid-cols-2">
              {SCOUT_REGION_IDS.map((id) => {
                const r = SCOUT_REGIONS[id];
                const busy = missions.some((m) => m.region === id);
                const limitReached = missions.length >= missionLimit;
                return (
                  <div
                    key={id}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2.5",
                      busy && "opacity-50",
                    )}
                  >
                    <span className="text-xl">{r.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-zinc-100">{r.label}</p>
                      <p className="truncate text-xs text-zinc-500">{r.desc}</p>
                      <p className="text-[11px] text-zinc-600">
                        {fmtMoney(r.cost)} • {r.rounds} {r.rounds === 2 ? "тура" : "тура"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 border-emerald-700 text-xs text-emerald-400 hover:bg-emerald-950"
                      disabled={busy || (limitReached && !busy)}
                      onClick={() => doScoutRegion(id)}
                    >
                      {busy ? "в работе" : "Отправить"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Экспресс-действия */}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              disabled={game.scoutedThisRound}
              onClick={() => doScout("free")}
            >
              🔍 Экспресс-разведка свободных ({fmtMoney(SCOUT_FREE_COST)})
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-700 text-amber-400 hover:bg-amber-950"
              onClick={() => doScout("youth")}
            >
              ⭐ Талант в академию ({fmtMoney(SCOUT_YOUTH_COST)})
            </Button>
          </div>
          {game.scoutedThisRound && (
            <p className="text-xs text-amber-400">В этом туре экспресс-разведка уже проведена</p>
          )}

          <SectionTitle>Отчёты скаутов</SectionTitle>
          <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
            {game.scoutReports.length === 0 && (
              <p className="py-4 text-center text-sm text-zinc-600">Отчётов пока нет</p>
            )}
            {game.scoutReports
              .slice(-14)
              .reverse()
              .map((r, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded bg-zinc-950/60 px-3 py-1.5 text-xs text-zinc-400"
                >
                  <PosBadge pos={r.pos} />
                  <span className="flex-1">{r.name}{r.age ? <span className="text-zinc-600"> ({r.age})</span> : null}</span>
                  <span>{r.ability}→{r.potential}</span>
                  <span className="text-amber-400/70">{fmtMoney(r.value)}</span>
                  <span className="text-zinc-600">{r.source}</span>
                </div>
              ))}
          </div>
        </TabsContent>

        {/* История */}
        <TabsContent value="history" className="mt-3">
          <div className="max-h-[50vh] space-y-1 overflow-y-auto pr-1">
            {game.history.length === 0 && (
              <p className="py-4 text-center text-sm text-zinc-600">
                Пока пусто — события появятся по ходу сезона
              </p>
            )}
            {game.history
              .slice()
              .reverse()
              .slice(0, 25)
              .map((h, i) => (
                <p key={i} className="rounded bg-zinc-950/60 px-3 py-1.5 text-sm text-zinc-400">
                  <span className="mr-2 text-xs text-zinc-600">
                    С{h.season} т{h.round}
                  </span>
                  {h.text}
                </p>
              ))}
          </div>
        </TabsContent>

        {/* Задачи */}
        <TabsContent value="progress" className="mt-3 space-y-2">
          <p className="text-sm text-zinc-400">
            Место {userPlace(game)} • Очки {team.pts} • Победы {team.w} • Бюджет <Money value={team.budget} />
          </p>
          {checks.map(({ obj, ok }) => {
            const early = (obj.type === "place" || obj.type === "place_max") && game.round < 8;
            return (
              <div
                key={obj.id}
                className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm"
              >
                <span className="text-zinc-300">
                  <span className={obj.critical ? "mr-2 text-amber-400" : "mr-2 text-zinc-600"}>
                    {obj.critical ? "★" : "·"}
                  </span>
                  {obj.text}
                </span>
                <span
                  className={
                    early
                      ? "text-xs text-zinc-500"
                      : ok
                        ? "text-xs font-bold text-emerald-400"
                        : "text-xs font-bold text-amber-400"
                  }
                >
                  {early ? "рано судить" : ok ? "✓ вероятно" : "… в процессе"}
                </span>
              </div>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}
