"use client";

/**
 * Экран трансляции матча. Два режима:
 *  — ЖИВОЙ (liveMatch): события разыгрываются по ходу минуты, менеджер
 *    может ставить паузу, делать замены (до 5), менять настрой и давать
 *    установку в перерыве;
 *  — ПОВТОР (после свистка или старый формат): готовый MatchResult.
 * Оформление шапки зависит от турнира (чемпионат / кубок / ЛЧ / Лига Европы).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useGameStore } from "@/game/store/gameStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { userLeagueId } from "@/game/core/state";
import { competitionTheme, clubKit } from "@/game/data/leagues";
import { MENTALITY_LABEL, type MatchResult, type Mentality } from "@/game/core/types";
import { liveViewAt, livePitchPlayers, liveBenchPlayers, liveActive, type LiveMatchView } from "@/game/systems/live";
import { TeamLogo, CompLogo } from "../ui/logos";
import { MatchPitch } from "./MatchPitch";
import type { MatchEventType } from "@/game/core/types";

/** Минут в секунду при базовой скорости (весь матч ~80 сек на 1x) */
const MIN_PER_SEC_BASE = 1.15;

const EVENT_STYLE: Record<MatchEventType, string> = {
  goal: "text-emerald-300 font-bold",
  save: "text-teal-300",
  miss: "text-zinc-500",
  yellow: "text-amber-300",
  red: "text-rose-400 font-bold",
  injury: "text-rose-400",
  suspension: "text-rose-300",
};

const EVENT_ICON: Record<MatchEventType, string> = {
  goal: "⚽",
  save: "🧤",
  miss: "✗",
  yellow: "🟨",
  red: "🟥",
  injury: "✚",
  suspension: "⛔",
};

type Speed = 0.5 | 1 | 2 | 4;

/** Собрать из живого вида объект, совместимый с MatchPitch/шапкой */
function viewAsResult(v: LiveMatchView): MatchResult {
  return {
    home: v.home,
    away: v.away,
    homeStats: v.homeStats,
    awayStats: v.awayStats,
    events: v.events,
    homeRatings: [],
    awayRatings: [],
    bestHome: null,
    bestAway: null,
    homeLineup: v.homeLineup,
    awayLineup: v.awayLineup,
  };
}

export function MatchScreen() {
  const live = useGameStore((s) => s.liveMatch);
  if (live || liveActive()) {
    return <LiveBroadcast />;
  }
  return <ReplayScreen />;
}

// ═══════════════════════ ЖИВОЙ МАТЧ ═══════════════════════

function LiveBroadcast() {
  const context = useGameStore((s) => s.matchContext);
  const finishLiveMatch = useGameStore((s) => s.finishLiveMatch);
  const liveSub = useGameStore((s) => s.liveSub);
  const liveSetMentality = useGameStore((s) => s.liveSetMentality);
  const liveTeamTalk = useGameStore((s) => s.liveTeamTalk);
  const liveCurrentMinute = useGameStore((s) => s.liveCurrentMinute);
  const closeMatch = useGameStore((s) => s.closeMatch);

  const [minute, setMinute] = useState(() => liveCurrentMinute());
  const [speed, setSpeed] = useState<Speed>(1);
  const [paused, setPaused] = useState(false);
  const [version, setVersion] = useState(0); // пересчёт вида после действий
  const [subsOpen, setSubsOpen] = useState(false);
  const [subOut, setSubOut] = useState<number | null>(null);
  const [subIn, setSubIn] = useState<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const htPausedRef = useRef(false);
  const minuteRef = useRef(liveCurrentMinute());
  const talkDoneRef = useRef(false);

  const view = useMemo(() => liveViewAt(minute), [minute, version]);

  // Синхронизация ref'ов из вида (без setState)
  useEffect(() => {
    talkDoneRef.current = view?.talkDone ?? false;
  }, [view]);

  const advanceTo = (nm: number) => {
    minuteRef.current = nm;
    setMinute(nm);
  };

  // Таймлайн
  useEffect(() => {
    lastTsRef.current = null;
    const tick = (ts: number) => {
      if (lastTsRef.current !== null && !paused) {
        const dt = Math.min(0.25, (ts - lastTsRef.current) / 1000);
        const nm = minuteRef.current + dt * MIN_PER_SEC_BASE * speed;
        // Автопауза в перерыве (один раз), если установка ещё не дана
        if (!htPausedRef.current && nm >= 45 && minuteRef.current < 45 && !talkDoneRef.current) {
          htPausedRef.current = true;
          setPaused(true);
        }
        advanceTo(nm);
      }
      lastTsRef.current = ts;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [paused, speed]);

  // Автоскролл ленты
  const shownCount = view ? view.events.length + view.subLines.filter((s) => s.minute <= minute).length : 0;
  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [shownCount]);

  // Тема турнира (до раннего возврата — правила хуков)
  const theme = useMemo(() => {
    const key = context?.key ?? "eng";
    return competitionTheme(context?.kind ?? "league", key);
  }, [context]);

  if (!view) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Button onClick={closeMatch}>Вернуться</Button>
      </div>
    );
  }

  const resultLike = viewAsResult(view);
  const homeKit = clubKit(view.home);
  const awayKit = clubKit(view.away);
  const done = view.finished;
  const minuteLabel = done ? "Завершён" : `${Math.floor(Math.min(minute, 97))}'`;

  // Лента: события + замены + установка
  type FeedLine = { minute: number; text: string; type: MatchEventType | "sub" | "talk"; team?: string };
  const feed: FeedLine[] = [
    ...view.events.map((e) => ({ minute: e.minute, text: e.text, type: e.type, team: e.team })),
    ...view.subLines.map((s) => ({ minute: s.minute, text: s.text, type: "sub" as const })),
    ...(view.talkMessage ? [{ minute: 46, text: `🗣 Установка: ${view.talkMessage}`, type: "talk" as const }] : []),
  ].sort((a, b) => a.minute - b.minute);

  const halfTimeIdx = feed.findIndex((f) => f.minute > 45);

  const doSub = () => {
    if (subOut === null || subIn === null) return;
    const res = liveSub(subOut, subIn);
    if (res.ok) {
      setSubsOpen(false);
      setSubOut(null);
      setSubIn(null);
      setVersion((v) => v + 1);
    } else {
      setVersion((v) => v + 1);
    }
  };

  const changeMentality = (m: Mentality) => {
    liveSetMentality(m);
    setVersion((v) => v + 1);
  };

  const giveTalk = (kind: "calm" | "motivate" | "hairdryer") => {
    liveTeamTalk(kind);
    setPaused(false);
    setVersion((v) => v + 1);
  };

  const pitchPlayers = livePitchPlayers();
  const benchPlayers = liveBenchPlayers();
  const outPlayer = pitchPlayers.find((p) => p.id === subOut);
  const benchForPos = outPlayer ? benchPlayers.filter((p) => p.pos === outPlayer.pos) : [];
  const canSub = !done && view.subsLeft > 0;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {/* Шапка в стиле турнира */}
      <div
        className="rounded-xl border p-4"
        style={{
          background: `linear-gradient(135deg, ${theme.bg} 0%, ${theme.bg2} 55%, ${theme.bg} 100%)`,
          borderColor: `${theme.accent}55`,
        }}
      >
        <div className="mb-3 flex items-center justify-center gap-2">
          <CompLogo compKey={theme.logoKey} size={22} />
          <span className="text-[11px] font-bold uppercase tracking-[0.25em]" style={{ color: theme.accent }}>
            {theme.name}
          </span>
          {!done && (
            <span className="ml-2 flex items-center gap-1.5 rounded-full bg-rose-600/90 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Live
            </span>
          )}
        </div>
        <div className="flex items-center justify-center gap-4 sm:gap-6">
          <div className="flex flex-1 items-center justify-end gap-2.5 text-right">
            <span className="truncate text-sm font-bold sm:text-lg">{view.home}</span>
            <TeamLogo name={view.home} size={38} className="hidden sm:block" />
          </div>
          <div className="shrink-0 text-center">
            <div
              className={cn(
                "rounded-xl border px-4 py-2 text-3xl font-black tabular-nums",
                !done && "animate-pulse",
              )}
              style={{ background: "#00000099", borderColor: `${theme.accent}66`, color: "#ffffff" }}
            >
              {view.score[0]}:{view.score[1]}
            </div>
            <p className="mt-1 text-xs font-semibold tabular-nums" style={{ color: theme.accent }}>
              {done ? "МАТЧ ЗАВЕРШЁН" : minuteLabel}
            </p>
          </div>
          <div className="flex flex-1 items-center gap-2.5">
            <TeamLogo name={view.away} size={38} className="hidden sm:block" />
            <span className="truncate text-sm font-bold sm:text-lg">{view.away}</span>
          </div>
        </div>
      </div>

      {/* 2D-поле */}
      <div className="relative">
        <MatchPitch match={resultLike} minute={minute} endMinute={view.endMinute} />
        <div className="pointer-events-none absolute right-3 top-3 rounded-lg border border-white/10 bg-black/60 px-2.5 py-1 text-sm font-black tabular-nums text-white backdrop-blur">
          {done ? "90'+ " : `${Math.floor(Math.min(minute, 97))}'`}
        </div>
      </div>

      {/* Панель управления менеджером */}
      {!done && (
        <Card className="border-emerald-900/60 bg-zinc-900/80">
          <CardContent className="space-y-3 p-3">
            {/* Перерыв: установка */}
            {view.halfTime && !view.talkDone && (
              <div className="rounded-lg border border-amber-700/50 bg-amber-950/30 p-3">
                <p className="mb-2 text-center text-sm font-bold text-amber-300">
                  🗣 Перерыв — дайте установку команде
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <Button size="sm" variant="outline" className="border-zinc-700 text-xs" onClick={() => giveTalk("calm")}>
                    😐 Спокойно
                    <span className="block text-[10px] font-normal text-zinc-500">мораль +1</span>
                  </Button>
                  <Button size="sm" variant="outline" className="border-emerald-700 text-xs text-emerald-300" onClick={() => giveTalk("motivate")}>
                    🔥 Мотивация
                    <span className="block text-[10px] font-normal text-zinc-500">риск мал</span>
                  </Button>
                  <Button size="sm" variant="outline" className="border-rose-800 text-xs text-rose-300" onClick={() => giveTalk("hairdryer")}>
                    🌪 Разнос
                    <span className="block text-[10px] font-normal text-zinc-500">высокий риск</span>
                  </Button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-zinc-700 bg-zinc-900"
                onClick={() => setPaused((p) => !p)}
              >
                {paused ? "▶ Продолжить" : "⏸ Пауза"}
              </Button>
              {([0.5, 1, 2, 4] as Speed[]).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={speed === s ? "default" : "outline"}
                  className={cn("min-w-12", speed === s ? "bg-emerald-600 font-bold" : "border-zinc-700 bg-zinc-900")}
                  onClick={() => setSpeed(s)}
                >
                  {s}x
                </Button>
              ))}
              <Button
                size="sm"
                variant="outline"
                className="border-zinc-700 bg-zinc-900"
                onClick={() => advanceTo(view.endMinute + 0.5)}
              >
                ⏭ До конца
              </Button>
            </div>

            {/* Настрой + замены */}
            <div className="flex flex-wrap items-center justify-center gap-2 border-t border-zinc-800 pt-2.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Настрой:</span>
              {(["defense", "normal", "attack"] as Mentality[]).map((m) => (
                <Button
                  key={m}
                  size="sm"
                  variant={view.mentality === m ? "default" : "outline"}
                  className={cn(
                    "min-w-24 text-xs",
                    view.mentality === m
                      ? m === "attack"
                        ? "bg-rose-600 font-bold"
                        : m === "defense"
                          ? "bg-sky-600 font-bold"
                          : "bg-emerald-600 font-bold"
                      : "border-zinc-700 bg-zinc-900",
                  )}
                  onClick={() => changeMentality(m)}
                >
                  {MENTALITY_LABEL[m]}
                </Button>
              ))}
              <Button
                size="sm"
                variant="outline"
                className={cn(
                  "text-xs",
                  canSub ? "border-amber-700 text-amber-300 hover:bg-amber-950" : "border-zinc-800 text-zinc-600",
                )}
                disabled={!canSub}
                onClick={() => {
                  setSubOut(null);
                  setSubIn(null);
                  setSubsOpen(true);
                  setPaused(true);
                }}
              >
                🔁 Замены ({view.subsLeft})
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Свисток — завершить */}
      {done && (
        <Button className="w-full bg-emerald-600 font-bold hover:bg-emerald-500" onClick={finishLiveMatch}>
          📊 Финальный свисток — статистика матча
        </Button>
      )}

      {/* Лента событий */}
      <Card className="border-zinc-800 bg-zinc-900/70">
        <CardContent className="p-0">
          <div ref={feedRef} className="max-h-[34vh] space-y-1.5 overflow-y-auto p-4">
            {feed.length === 0 && (
              <p className="py-6 text-center text-sm text-zinc-500">Команды выходят на поле. Свисток! ⚽</p>
            )}
            {feed.map((f, i) => (
              <div key={i}>
                {i === halfTimeIdx && halfTimeIdx > 0 && (
                  <p className="my-3 text-center text-xs text-zinc-600">─── Перерыв ───</p>
                )}
                <div className="flex items-start gap-3 rounded-lg bg-zinc-950/60 px-3 py-2">
                  <span className="w-8 shrink-0 text-right text-xs font-bold text-zinc-500 tabular-nums">
                    {Math.floor(f.minute)}&apos;
                  </span>
                  <span
                    className={cn(
                      "flex-1 text-sm",
                      f.type === "sub" ? "text-sky-300" : f.type === "talk" ? "text-amber-300" : EVENT_STYLE[f.type],
                    )}
                  >
                    <span className="mr-1">{f.type === "sub" ? "🔁" : f.type === "talk" ? "" : EVENT_ICON[f.type]}</span>
                    {f.text}
                  </span>
                  {f.team && <span className="shrink-0 text-[10px] text-zinc-600">[{f.team}]</span>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Диалог замены */}
      <Dialog open={subsOpen} onOpenChange={(o) => setSubsOpen(o)}>
        <DialogContent aria-describedby={undefined} className="border-zinc-800 bg-zinc-900 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>🔁 Замена {outPlayer ? `— вместо ${outPlayer.name}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500">На поле</p>
              <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
                {pitchPlayers.map((p) => (
                  <button
                    key={p.id}
                    className={cn(
                      "w-full rounded-lg border px-2.5 py-2 text-left transition-colors",
                      subOut === p.id
                        ? "border-rose-600 bg-rose-950/50 text-rose-200"
                        : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-600",
                    )}
                    onClick={() => {
                      setSubOut(p.id);
                      setSubIn(null);
                    }}
                  >
                    <span className="mr-1.5 font-mono text-xs text-zinc-500">{p.number}</span>
                    {p.name}
                    <span className="ml-1 text-[10px] text-zinc-500">{p.pos}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500">
                {outPlayer ? `Запас (${outPlayer.pos})` : "Запас — сначала выберите уходящего"}
              </p>
              <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
                {benchForPos.length === 0 && (
                  <p className="py-4 text-center text-xs text-zinc-600">
                    {outPlayer ? "Нет подходящих по позиции" : "Выберите игрока слева"}
                  </p>
                )}
                {benchForPos.map((p) => (
                  <button
                    key={p.id}
                    className={cn(
                      "w-full rounded-lg border px-2.5 py-2 text-left transition-colors",
                      subIn === p.id
                        ? "border-emerald-600 bg-emerald-950/50 text-emerald-200"
                        : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-600",
                    )}
                    onClick={() => setSubIn(p.id)}
                  >
                    <span className="mr-1.5 font-mono text-xs text-zinc-500">{p.number}</span>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-500" disabled={subOut === null || subIn === null} onClick={doSub}>
              Произвести замену
            </Button>
            <Button variant="outline" className="border-zinc-700" onClick={() => setSubsOpen(false)}>
              Отмена
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════ ПОВТОР / СТАРЫЙ ФОРМАТ ═══════════════════════

function ReplayScreen() {
  const match = useGameStore((s) => s.lastMatch);
  const closeMatch = useGameStore((s) => s.closeMatch);
  const context = useGameStore((s) => s.matchContext);
  const game = useGameStore((s) => s.game);
  const jumpEnd = useGameStore((s) => s.matchJumpEnd);

  const events = match?.events ?? [];
  const endMinute = useMemo(
    () => Math.max(90, ...events.map((e) => e.minute + 1)),
    [events],
  );

  const [minute, setMinute] = useState(() => (jumpEnd ? endMinute + 1 : 0));
  const [speed, setSpeed] = useState<Speed>(1);
  const [paused, setPaused] = useState(false);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  // Игровой таймлайн: rAF, минута растёт по скорости
  useEffect(() => {
    if (!match) return;
    lastTsRef.current = null;
    const tick = (ts: number) => {
      if (lastTsRef.current !== null && !paused) {
        const dt = Math.min(0.25, (ts - lastTsRef.current) / 1000);
        setMinute((m) => Math.min(endMinute + 2, m + dt * MIN_PER_SEC_BASE * speed));
      }
      lastTsRef.current = ts;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [match, paused, speed, endMinute]);

  const done = minute >= endMinute;

  // Автоскролл ленты
  const shownCount = events.filter((e) => e.minute <= minute).length;
  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [shownCount]);

  const shown = events.slice(0, shownCount);
  const score = useMemo(() => {
    let h = 0;
    let a = 0;
    for (const e of shown) {
      if (e.type !== "goal") continue;
      if (e.team === match?.home) h += 1;
      else a += 1;
    }
    return [h, a] as const;
  }, [shown, match]);

  // Тема турнира
  const theme = useMemo(() => {
    const leagueId = game ? userLeagueId(game) : "eng";
    const kind = context?.kind ?? "league";
    const key = kind === "cup" ? (context?.key ?? leagueId) : kind === "ucl" || kind === "uel" ? (context?.key ?? leagueId) : leagueId;
    return competitionTheme(kind, key);
  }, [context, game]);

  const homeKit = match ? clubKit(match.home) : null;
  const awayKit = match ? clubKit(match.away) : null;

  if (!match) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Button onClick={closeMatch}>Вернуться</Button>
      </div>
    );
  }

  const halfTimeIdx = shown.findIndex((e) => e.minute > 45);
  const hasLineup = (match.homeLineup?.length ?? 0) > 0 && (match.awayLineup?.length ?? 0) > 0;
  const minuteLabel = done ? "Завершён" : ` ${Math.floor(Math.min(minute, 90))}'`;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {/* Шапка в стиле турнира */}
      <div
        className="rounded-xl border p-4"
        style={{
          background: `linear-gradient(135deg, ${theme.bg} 0%, ${theme.bg2} 55%, ${theme.bg} 100%)`,
          borderColor: `${theme.accent}55`,
        }}
      >
        <div className="mb-3 flex items-center justify-center gap-2">
          <CompLogo compKey={context?.kind === "ucl" ? "ucl" : context?.key ?? theme.logoKey} size={22} />
          <span
            className="text-[11px] font-bold uppercase tracking-[0.25em]"
            style={{ color: theme.accent }}
          >
            {theme.name}
          </span>
        </div>
        <div className="flex items-center justify-center gap-4 sm:gap-6">
          <div className="flex flex-1 items-center justify-end gap-2.5 text-right">
            <span className="truncate text-sm font-bold sm:text-lg">{match.home}</span>
            <TeamLogo name={match.home} size={38} className="hidden sm:block" />
          </div>
          <div className="shrink-0 text-center">
            <div
              className={cn(
                "rounded-xl border px-4 py-2 text-3xl font-black tabular-nums",
                !done && "animate-pulse",
              )}
              style={{
                background: "#00000099",
                borderColor: `${theme.accent}66`,
                color: "#ffffff",
              }}
            >
              {score[0]}:{score[1]}
            </div>
            <p className="mt-1 text-xs font-semibold tabular-nums" style={{ color: theme.accent }}>
              {done ? "МАТЧ ЗАВЕРШЁН" : minuteLabel}
            </p>
          </div>
          <div className="flex flex-1 items-center gap-2.5">
            <TeamLogo name={match.away} size={38} className="hidden sm:block" />
            <span className="truncate text-sm font-bold sm:text-lg">{match.away}</span>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-zinc-400">
          <span
            className="inline-block h-3 w-3 rounded-full border"
            style={{ background: homeKit?.primary, borderColor: homeKit?.secondary }}
          />
          {match.home} — хозяева
          <span className="mx-2 text-zinc-600">•</span>
          <span
            className="inline-block h-3 w-3 rounded-full border"
            style={{ background: awayKit?.primary, borderColor: awayKit?.secondary }}
          />
          {match.away} — гости
        </div>
      </div>

      {/* 2D-поле */}
      {hasLineup ? (
        <div className="relative">
          <MatchPitch match={match} minute={minute} endMinute={endMinute} />
          {/* Индикатор минуты поверх поля */}
          <div className="pointer-events-none absolute right-3 top-3 rounded-lg border border-white/10 bg-black/60 px-2.5 py-1 text-sm font-black tabular-nums text-white backdrop-blur">
            {done ? "90'+ " : `${Math.floor(Math.min(minute, 97))}'`}
          </div>
        </div>
      ) : (
        <Card className="border-zinc-800 bg-zinc-900/70">
          <CardContent className="p-4 text-center text-sm text-zinc-500">
            Составы недоступны — показываем текстовую трансляцию.
          </CardContent>
        </Card>
      )}

      {/* Управление */}
      {!done && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-zinc-700 bg-zinc-900"
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? "▶ Продолжить" : "⏸ Пауза"}
          </Button>
          {([0.5, 1, 2, 4] as Speed[]).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={speed === s ? "default" : "outline"}
              className={cn(
                "min-w-12",
                speed === s ? "bg-emerald-600 font-bold" : "border-zinc-700 bg-zinc-900",
              )}
              onClick={() => setSpeed(s)}
            >
              {s}x
            </Button>
          ))}
          <Button
            size="sm"
            variant="outline"
            className="border-zinc-700 bg-zinc-900"
            onClick={() => setMinute(endMinute + 1)}
          >
            ⏭ Пропустить
          </Button>
        </div>
      )}

      {/* Лента событий */}
      <Card className="border-zinc-800 bg-zinc-900/70">
        <CardContent className="p-0">
          <div ref={feedRef} className="max-h-[38vh] space-y-1.5 overflow-y-auto p-4">
            {shown.length === 0 && (
              <p className="py-6 text-center text-sm text-zinc-500">
                Команды выходят на поле. Свисток! ⚽
              </p>
            )}
            {shown.map((e, i) => (
              <div key={i}>
                {i === halfTimeIdx && halfTimeIdx > 0 && (
                  <p className="my-3 text-center text-xs text-zinc-600">
                    ─── Перерыв. Счёт {shown.slice(0, i).filter((x) => x.type === "goal" && x.team === match.home).length}:
                    {shown.slice(0, i).filter((x) => x.type === "goal" && x.team !== match.home).length} ───
                  </p>
                )}
                <div className="flex items-start gap-3 rounded-lg bg-zinc-950/60 px-3 py-2">
                  <span className="w-8 shrink-0 text-right text-xs font-bold text-zinc-500 tabular-nums">
                    {e.minute}&apos;
                  </span>
                  <span className={cn("flex-1 text-sm", EVENT_STYLE[e.type])}>
                    <span className="mr-1">{EVENT_ICON[e.type]}</span>
                    {e.text}
                  </span>
                  <span className="shrink-0 text-[10px] text-zinc-600">[{e.team}]</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Статистика после матча */}
      {done && (
        <Card className="border-zinc-800 bg-zinc-900/70">
          <CardContent className="space-y-4 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
              Статистика матча
            </h3>
            <div className="grid grid-cols-4 gap-2 text-center text-sm">
              <span />
              <span className="flex items-center justify-center gap-1.5 font-bold">
                <TeamLogo name={match.home} size={18} />
                <span className="truncate">{match.home}</span>
              </span>
              <span className="flex items-center justify-center gap-1.5 font-bold">
                <span className="truncate">{match.away}</span>
                <TeamLogo name={match.away} size={18} />
              </span>
              <span />
              {(
                [
                  ["Владение", "possession", "%"],
                  ["Удары", "shots", ""],
                  ["В створ", "shotsOnTarget", ""],
                  ["xG", "xg", ""],
                  ["Сейвы", "saves", ""],
                ] as const
              ).map(([label, key, suffix]) => (
                <div key={key} className="col-span-4 grid grid-cols-4 items-center gap-2 border-t border-zinc-800/60 py-1.5">
                  <span className="text-left text-xs text-zinc-500">{label}</span>
                  <span className="font-mono">
                    {match.homeStats[key]}
                    {suffix}
                  </span>
                  <span className="font-mono">
                    {match.awayStats[key]}
                    {suffix}
                  </span>
                  <span />
                </div>
              ))}
            </div>

            {match.bestHome && match.bestAway && (
              <div className="flex flex-wrap gap-4 border-t border-zinc-800 pt-3 text-sm">
                <p>
                  <span className="text-emerald-400">{match.home}:</span>{" "}
                  лучший — {match.bestHome.name} ({match.bestHome.rating.toFixed(1)})
                </p>
                <p>
                  <span className="text-amber-400">{match.away}:</span>{" "}
                  лучший — {match.bestAway.name} ({match.bestAway.rating.toFixed(1)})
                </p>
              </div>
            )}

            <Button
              className="w-full bg-emerald-600 font-bold hover:bg-emerald-500"
              onClick={closeMatch}
            >
              Продолжить
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
