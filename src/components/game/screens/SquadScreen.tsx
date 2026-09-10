"use client";

/**
 * Состав и тактика: схемы, установки, стартовый состав, скамейка,
 * замены, роли и профили игроков.
 */

import { useEffect, useState } from "react";
import { useGameStore } from "@/game/store/gameStore";
import { userTeam } from "@/game/core/state";
import { assignSlots, currentElevenStrict } from "@/game/core/team";
import type { Player, PlayerInstruction } from "@/game/core/types";
import { INSTRUCTION_INFO } from "@/game/core/types";
import { DETAIL_INFO, groupOf, posFullName } from "@/game/core/pos";
import { FORMATIONS, FORMATION_NAMES, formationSlotsLabel } from "@/game/data/formations";
import { TACTICS, TACTIC_NAMES } from "@/game/data/tactics";
import { ROLES } from "@/game/data/roles";
import { eff } from "@/game/core/player";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PlayerLine, SectionTitle, POS_STYLES } from "../ui/game-ui";
import { cn } from "@/lib/utils";

export function SquadScreen() {
  const game = useGameStore((s) => s.game)!;
  const setFormation = useGameStore((s) => s.setFormation);
  const setTactic = useGameStore((s) => s.setTactic);
  const squadAutoLineup = useGameStore((s) => s.squadAutoLineup);
  const substitute = useGameStore((s) => s.substitute);
  const openProfile = useGameStore((s) => s.openProfile);
  const setSetPiece = useGameStore((s) => s.setSetPiece);
  const setInstruction = useGameStore((s) => s.setInstruction);
  const [subOutId, setSubOutId] = useState<number | null>(null);

  const team = userTeam(game);
  const byId = new Map(team.players.map((p) => [p.id, p]));
  const bench = team.players
    .filter((p) => !team.lineupIds.includes(p.id))
    .sort((a, b) => eff(b) - eff(a));
  const setPieces = team.setPieces ?? { freeKick: null, corner: null };

  // Если состав невалиден — показать авто-сбор
  useEffect(() => {
    if (currentElevenStrict(team) === null && team.players.length >= 7) {
      squadAutoLineup();
    }
  }, [team.formation, team.players.length, team, squadAutoLineup]);

  const formation = FORMATIONS[team.formation];
  const tactic = TACTICS[team.tactic];

  // Раскладка состава по слотам схемы, сгруппированная по линиям
  const slots = assignSlots(team);
  const lanes: Array<[number, typeof slots]> = [];
  for (const s of slots) {
    const lane = DETAIL_INFO[s.slot].lane;
    const last = lanes[lanes.length - 1];
    if (last && last[0] === lane) last[1].push(s);
    else lanes.push([lane, [s]]);
  }
  const laneNames = ["Вратарь", "Защита", "Полузащита", "Атака"];

  const handleSubstitute = (inId: number) => {
    if (subOutId === null) return;
    const res = substitute(subOutId, inId);
    if (res.ok) toast.success(res.message);
    else toast.error(res.message);
    setSubOutId(null);
  };

  return (
    <div className="space-y-5">
      {/* Схема и тактика */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-zinc-800 bg-zinc-900/70">
          <CardContent className="p-4">
            <SectionTitle hint={formation.description}>Схема</SectionTitle>
            <Select value={team.formation} onValueChange={setFormation}>
              <SelectTrigger className="border-zinc-700 bg-zinc-950">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-zinc-700 bg-zinc-900">
                {FORMATION_NAMES.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f} — {FORMATIONS[f].description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-2 text-xs text-zinc-500">
              Атака {formation.atk.toFixed(2)} • Оборона {formation.df.toFixed(2)} • Ширина {formation.width.toFixed(2)}
            </p>
            <p className="mt-1.5 rounded-md bg-zinc-950/70 px-2 py-1.5 font-mono text-xs text-zinc-400" title="Слоты схемы (FIFA-коды)">
              {formationSlotsLabel(formation)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-zinc-800 bg-zinc-900/70">
          <CardContent className="p-4">
            <SectionTitle hint={tactic.description}>Тактика</SectionTitle>
            <Select value={team.tactic} onValueChange={setTactic}>
              <SelectTrigger className="border-zinc-700 bg-zinc-950">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-zinc-700 bg-zinc-900">
                {TACTIC_NAMES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t} — {TACTICS[t].description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-2 text-xs text-zinc-500">
              Прессинг {tactic.pressing.toFixed(2)} • Темп {tactic.tempo.toFixed(2)} • Риск {tactic.risk.toFixed(2)} • Усталость {tactic.fatigue.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          className="border-emerald-700 text-emerald-400 hover:bg-emerald-950"
          onClick={() => {
            squadAutoLineup();
            toast.success("Состав собран автоматически");
          }}
        >
          🔄 Авто-состав
        </Button>
      </div>

      {/* Стандарты и индивидуальные установки (Фаза 2) */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-zinc-800 bg-zinc-900/70">
          <CardContent className="p-4">
            <SectionTitle hint="навесы исполнителя повышают качество моментов у стандарта">
              🎯 Стандарты
            </SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-semibold text-zinc-400">Штрафные удары</p>
                <Select
                  value={setPieces.freeKick != null ? String(setPieces.freeKick) : "none"}
                  onValueChange={(v) => {
                    const res = setSetPiece("freeKick", v === "none" ? null : Number(v));
                    if (res.ok) toast.success(res.message);
                  }}
                >
                  <SelectTrigger className="border-zinc-700 bg-zinc-950 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72 border-zinc-700 bg-zinc-900">
                    <SelectItem value="none">— не назначен —</SelectItem>
                    {slots.map(({ player }) => (
                      <SelectItem key={player.id} value={String(player.id)}>
                        {player.name} (пас {player.passing})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold text-zinc-400">Угловые</p>
                <Select
                  value={setPieces.corner != null ? String(setPieces.corner) : "none"}
                  onValueChange={(v) => {
                    const res = setSetPiece("corner", v === "none" ? null : Number(v));
                    if (res.ok) toast.success(res.message);
                  }}
                >
                  <SelectTrigger className="border-zinc-700 bg-zinc-950 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72 border-zinc-700 bg-zinc-900">
                    <SelectItem value="none">— не назначен —</SelectItem>
                    {slots.map(({ player }) => (
                      <SelectItem key={player.id} value={String(player.id)}>
                        {player.name} (пас {player.passing})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              Навес мастера стандартов повышает xG моментов, голы со стандартов получают отметку в трансляции.
            </p>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900/70">
          <CardContent className="p-4">
            <SectionTitle hint="влияют на линии, прессинг и усталость в матче">
              🧭 Индивидуальные установки
            </SectionTitle>
            <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
              {slots.map(({ player }) => (
                <div key={player.id} className="flex items-center gap-2 text-sm">
                  <span className="w-28 shrink-0 truncate text-zinc-300" title={player.name}>
                    {player.name}
                  </span>
                  <Select
                    value={player.instruction ?? "balanced"}
                    onValueChange={(v) =>
                      setInstruction(player.id, v === "balanced" ? null : (v as PlayerInstruction))
                    }
                  >
                    <SelectTrigger className="h-8 border-zinc-700 bg-zinc-950 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-zinc-700 bg-zinc-900">
                      <SelectItem value="balanced">Баланс (по умолчанию)</SelectItem>
                      {(Object.keys(INSTRUCTION_INFO) as PlayerInstruction[]).map((k) => (
                        <SelectItem key={k} value={k}>
                          {INSTRUCTION_INFO[k].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              «Жёсткий прессинг» усиливает отбор, но съедает силы; «Беречь силы» экономит свежесть ключевых игроков.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Стартовый состав по слотам схемы */}
      <div>
        <SectionTitle hint={subOutId ? "выберите замену из скамейки" : "клик по игроку — профиль"}>
          Стартовый состав
        </SectionTitle>
        <div className="space-y-3">
          {lanes.map(([lane, rows]) => (
            <div key={lane}>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-zinc-600">
                {laneNames[lane]}
              </p>
              <div className="space-y-1.5">
                {rows.map(({ slot, player, fit }) => (
                  <div
                    key={player.id}
                    className={cn(
                      "flex items-center gap-2",
                      subOutId === player.id && "rounded-lg ring-1 ring-rose-500",
                    )}
                  >
                    <span
                      title={`Слот схемы: ${posFullName(slot)}`}
                      className={cn(
                        "inline-flex w-12 shrink-0 items-center justify-center rounded border px-1 py-0.5 text-[11px] font-bold",
                        POS_STYLES[groupOf(slot)],
                      )}
                    >
                      {slot}
                    </span>
                    <div className="min-w-0 flex-1">
                      <PlayerLine
                        player={player}
                        onProfile={subOutId === null ? openProfile : undefined}
                        action={
                          subOutId === null ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-zinc-400 hover:text-emerald-400"
                              onClick={() => setSubOutId(player.id)}
                            >
                              ⇄ Заменить
                            </Button>
                          ) : undefined
                        }
                      />
                    </div>
                    <FitChip fit={fit} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Скамейка */}
      <div>
        <SectionTitle>
          Скамейка{subOutId ? ` — кого выпустить вместо ${byId.get(subOutId)?.name ?? ""}?` : ""}
        </SectionTitle>
        {subOutId !== null && (
          <Button
            size="sm"
            variant="ghost"
            className="mb-2 text-xs text-zinc-400"
            onClick={() => setSubOutId(null)}
          >
            ← Отменить замену
          </Button>
        )}
        <div className="max-h-96 space-y-1.5 overflow-y-auto pr-1">
          {bench
            .filter((p) => subOutId === null || p.pos === byId.get(subOutId)?.pos)
            .map((p) => (
              <PlayerLine
                key={p.id}
                player={p}
                dim
                onProfile={subOutId === null ? openProfile : undefined}
                action={
                  subOutId !== null ? (
                    <Button size="sm" className="h-7 bg-emerald-600 text-xs hover:bg-emerald-500" onClick={() => handleSubstitute(p.id)}>
                      Выпустить
                    </Button>
                  ) : undefined
                }
              />
            ))}
        </div>
      </div>

      {/* О составе */}
      <p className="text-xs text-zinc-600">
        Состав: {team.players.length} игроков • Заявка: {team.lineupIds.length}/11 •
        {" "}Бюджет {fmtBudget(team.budget)}
      </p>
    </div>
  );
}

function fmtBudget(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)} млн €`;
  return `${Math.round(v / 1000)} тыс €`;
}

/** Процент соответствия амплуа игрока слоту схемы (показывается только если не 100%) */
function FitChip({ fit }: { fit: number }) {
  const pct = Math.round(fit * 100);
  if (pct >= 100) return null;
  return (
    <span
      title="Соответствие амплуа игрока слоту схемы"
      className={cn(
        "w-12 shrink-0 rounded px-1 py-0.5 text-center text-[10px] font-bold",
        pct >= 85 ? "bg-amber-500/15 text-amber-400" : "bg-rose-500/15 text-rose-400",
      )}
    >
      {pct}%
    </span>
  );
}

/** Карточка смены роли (используется в профиле) */
export function RoleSelector({
  player,
  onRoleChange,
}: {
  player: Player;
  onRoleChange: (role: string) => void;
}) {
  const roles = Object.keys(ROLES[player.pos]);
  return (
    <div className="space-y-1.5">
      {roles.map((r) => (
        <button
          key={r}
          className={cn(
            "w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors",
            (player.role || "") === r
              ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
              : "border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-600",
          )}
          onClick={() => onRoleChange(r)}
        >
          {r}
        </button>
      ))}
    </div>
  );
}
