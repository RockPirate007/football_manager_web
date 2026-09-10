"use client";

/**
 * Диалог профиля игрока: атрибуты, состояние, контракт, роль.
 */

import { useMemo, useState } from "react";
import { useGameStore } from "@/game/store/gameStore";
import { fmtMoney } from "@/game/core/money";
import { avgRating, contractLabel, shortStatus } from "@/game/core/player";
import { detailOf, posFullName } from "@/game/core/pos";
import { ROLES } from "@/game/data/roles";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AbilityBar, PosBadge, StatBar, abilityClass } from "../ui/game-ui";
import { RoleSelector } from "../screens/SquadScreen";
import { toast } from "sonner";

function findPlayer(g: NonNullable<ReturnType<typeof useGameStore.getState>["game"]>, id: number) {
  for (const t of Object.values(g.teams)) {
    const p = t.players.find((x) => x.id === id);
    if (p) return { p, teamName: t.name, isMine: t.name === g.user };
  }
  const p = g.freeAgents.find((x) => x.id === id) ?? g.academy.find((x) => x.id === id);
  if (p) return { p, teamName: p.onLoan ? p.loanOrigin ?? "" : "Свободен", isMine: false };
  return null;
}

export function PlayerProfileDialog() {
  const game = useGameStore((s) => s.game);
  const profilePlayerId = useGameStore((s) => s.profilePlayerId);
  const closeProfile = useGameStore((s) => s.closeProfile);
  const changeRole = useGameStore((s) => s.changeRole);
  const [showRoles, setShowRoles] = useState(false);

  const found = useMemo(
    () => (game && profilePlayerId !== null ? findPlayer(game, profilePlayerId) : null),
    [game, profilePlayerId],
  );

  if (!found) {
    return (
      <Dialog open={profilePlayerId !== null} onOpenChange={(o) => !o && closeProfile()}>
        <DialogContent aria-describedby={undefined} className="border-zinc-800 bg-zinc-900 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Профиль игрока</DialogTitle>
          </DialogHeader>
          <p className="py-6 text-center text-sm text-zinc-500">Игрок не найден</p>
        </DialogContent>
      </Dialog>
    );
  }

  const { p, teamName, isMine } = found;
  const bio = p.bio;
  const attr = [
    ["Скорость", p.pace],
    ["Удар", p.shooting],
    ["Пас", p.passing],
    ["Защита", p.defending],
    ["Вратарь", p.goalkeeping],
  ] as const;

  return (
    <Dialog open={profilePlayerId !== null} onOpenChange={(o) => !o && closeProfile()}>
      <DialogContent aria-describedby={undefined} className="border-zinc-800 bg-zinc-900 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 pr-6 text-lg">
            {p.name} <PosBadge pos={p.pos} detail={p.detail} />
            <span className="text-sm font-normal text-zinc-500">
              {p.age} лет • {teamName}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Способность / потенциал */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="mb-1 flex items-baseline justify-between text-sm">
                <span className="text-zinc-400">Рейтинг</span>
                <span className={`text-xl font-black ${abilityClass(p.ability)}`}>{p.ability}</span>
              </div>
              <AbilityBar value={p.ability} />
            </div>
            <div className="flex-1">
              <div className="mb-1 flex items-baseline justify-between text-sm">
                <span className="text-zinc-400">Потенциал</span>
                <span className="text-xl font-black text-teal-300">{p.potential}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-zinc-800">
                <div className="h-full rounded-full bg-teal-500" style={{ width: `${((p.potential - 40) / 55) * 100}%` }} />
              </div>
            </div>
          </div>

          {/* Атрибуты */}
          <div className="grid grid-cols-5 gap-2">
            {attr.map(([label, v]) => (
              <div key={label} className="text-center">
                <p className={`text-lg font-bold ${abilityClass(v)}`}>{v}</p>
                <p className="text-[10px] text-zinc-500">{label}</p>
              </div>
            ))}
          </div>

          {/* Состояние */}
          <div className="space-y-2 rounded-lg bg-zinc-950/60 p-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="w-20 text-xs text-zinc-500">Вынослив.</span>
              <StatBar value={p.stamina} />
              <span className="w-9 text-right font-mono text-zinc-300">{p.stamina}%</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="w-20 text-xs text-zinc-500">Фитнес</span>
              <StatBar value={p.fitness} />
              <span className="w-9 text-right font-mono text-zinc-300">{p.fitness}%</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="w-20 text-xs text-zinc-500">Мораль</span>
              <StatBar value={p.morale} />
              <span className="w-9 text-right font-mono text-zinc-300">{p.morale}</span>
            </div>
            <div className="flex flex-wrap justify-between gap-2 pt-1 text-xs">
              <span className="text-zinc-400">Форма: <b className="text-zinc-200">{p.form >= 0 ? "+" : ""}{p.form}</b></span>
              <span className={shortStatus(p) === "ГОТОВ" ? "text-emerald-400" : "text-rose-400"}>
                {shortStatus(p)}
              </span>
            </div>
          </div>

          {/* Контракт */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <p className="text-zinc-400">Контракт: <b className="text-zinc-200">{contractLabel(p)}</b></p>
            <p className="text-right text-zinc-400">ЗП: <b className="text-amber-300">{fmtMoney(p.salary)}/тур</b></p>
            <p className="text-zinc-400">Стоимость: <b className="text-amber-300">{fmtMoney(p.value)}</b></p>
            <p className="text-right text-zinc-400">Роль: <b className="text-teal-300">{p.role || "—"}</b></p>
          </div>

          {/* Биография */}
          {bio && (
            <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Биография</p>
                {bio.real && (
                  <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
                    ★ Реальный футболист
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
                {p.number > 0 && (
                  <p className="text-zinc-400">Номер: <b className="text-zinc-200">#{p.number}</b></p>
                )}
                <p className="text-zinc-400">
                  Амплуа: <b className="text-zinc-200">{posFullName(detailOf(p))}</b>
                </p>
                <p className="text-zinc-400">Гражданство: <b className="text-zinc-200">{bio.nation}</b></p>
                <p className="text-zinc-400">Рост: <b className="text-zinc-200">{bio.height || "—"} см</b></p>
                <p className="text-zinc-400">Нога: <b className="text-zinc-200">{bio.foot}</b></p>
              </div>
              {bio.career && (
                <p className="text-sm text-zinc-300">
                  <span className="text-zinc-500">Карьера: </span>{bio.career}
                </p>
              )}
              {bio.honours && (
                <p className="text-sm text-amber-200/90">
                  <span className="text-zinc-500">Достижения: </span>{bio.honours}
                </p>
              )}
              {bio.traits && (
                <p className="text-sm text-teal-200/80">
                  <span className="text-zinc-500">Стиль: </span>{bio.traits}
                </p>
              )}
            </div>
          )}

          {/* Сезон */}
          <div className="rounded-lg bg-zinc-950/60 p-3 text-sm text-zinc-300">
            <p>
              Сезон: <b>{p.goals}</b> гол. • <b>{p.assists}</b> асист. • <b>{p.appearances}</b> матчей
              {p.appearances > 0 && <> • ср. оценка <b>{avgRating(p).toFixed(2)}</b></>}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              ЖК {p.yellowCards} • дисквалификация {p.redSuspension} • травма {p.injuryDays} дн.
            </p>
          </div>

          {/* Роли (только свои игроки) */}
          {isMine && (
            <div>
              <button
                className="text-sm font-semibold text-emerald-400 hover:underline"
                onClick={() => setShowRoles((v) => !v)}
              >
                🎭 Назначить роль {showRoles ? "▲" : "▼"}
              </button>
              {showRoles && (
                <div className="mt-2">
                  <RoleSelector
                    player={p}
                    onRoleChange={(role) => {
                      changeRole(p.id, role);
                      toast.success(`${p.name}: ${role}`);
                      setShowRoles(false);
                    }}
                  />
                  <p className="mt-2 text-xs text-zinc-600">
                    Доступные роли позиции {p.pos}: {Object.keys(ROLES[p.pos]).join(", ")}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
