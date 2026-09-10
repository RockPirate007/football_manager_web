"use client";

/**
 * Базовые переиспользуемые виджеты игрового интерфейса.
 */

import type { Player, PosDetail, Position } from "@/game/core/types";
import { DETAIL_INFO, detailOf, posFullName } from "@/game/core/pos";
import { shortStatus, contractLabel } from "@/game/core/player";
import { cn } from "@/lib/utils";

// ─────────────────────────── Цвета ───────────────────────────

export const POS_STYLES: Record<Position, string> = {
  "ВРТ": "bg-amber-500/15 text-amber-400 border-amber-500/30",
  "ЗАЩ": "bg-teal-500/15 text-teal-400 border-teal-500/30",
  "ПЗ": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "НАП": "bg-rose-500/15 text-rose-400 border-rose-500/30",
};

/**
 * Бейдж позиции. Если передано детальное амплуа (FIFA-код: LW, ST, DM…)
 * — показывает его, иначе группу. Подсказка — полное русское название.
 */
export function PosBadge({
  pos,
  detail,
  className,
}: {
  pos: Position;
  detail?: PosDetail;
  className?: string;
}) {
  const valid = detail && DETAIL_INFO[detail]?.group === pos ? detail : undefined;
  return (
    <span
      title={valid ? `${posFullName(valid)} • группа ${pos}` : undefined}
      className={cn(
        "inline-flex w-10 items-center justify-center rounded border px-1 py-0.5 text-[10px] font-bold tracking-wide",
        POS_STYLES[pos],
        className,
      )}
    >
      {valid ?? pos}
    </span>
  );
}

/** Цвет оценки способности */
export function abilityClass(v: number): string {
  if (v >= 80) return "text-emerald-400";
  if (v >= 70) return "text-teal-300";
  if (v >= 60) return "text-zinc-200";
  return "text-rose-400";
}

/** Цвет полосы состояния */
export function staminaClass(v: number): string {
  if (v >= 80) return "bg-emerald-500";
  if (v >= 50) return "bg-amber-500";
  return "bg-rose-500";
}

export function StatBar({ value, className }: { value: number; className?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden", className)}>
      <div
        className={cn("h-full rounded-full transition-all", staminaClass(clamped))}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function AbilityBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, ((value - 40) / 55) * 100));
  return (
    <div className="h-1.5 w-14 rounded-full bg-zinc-800 overflow-hidden">
      <div
        className={cn(
          "h-full rounded-full",
          value >= 80 ? "bg-emerald-500" : value >= 70 ? "bg-teal-500" : value >= 60 ? "bg-zinc-400" : "bg-rose-500",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ─────────────────────────── Строка игрока ───────────────────────────

interface PlayerLineProps {
  player: Player;
  index?: number;
  onProfile?: (id: number) => void;
  dim?: boolean;
  action?: React.ReactNode;
}

export function statusInfo(p: Player): { text: string; cls: string } {
  if (!shortStatus(p).startsWith("ГОТОВ") && shortStatus(p) !== "ГОТОВ") {
    return { text: shortStatus(p), cls: "text-rose-400" };
  }
  if (p.form >= 4) return { text: `Ф${p.form >= 0 ? "+" : ""}${p.form}`, cls: "text-emerald-400" };
  if (p.form <= -4) return { text: `Ф${p.form >= 0 ? "+" : ""}${p.form}`, cls: "text-rose-400" };
  return { text: `Ф${p.form >= 0 ? "+" : ""}${p.form}`, cls: "text-zinc-500" };
}

export function PlayerLine({ player: p, index, onProfile, dim, action }: PlayerLineProps) {
  const st = statusInfo(p);
  const role = p.role || "";
  const contractProblem = p.contractYears <= 0 || p.onLoan;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm transition-colors",
        onProfile && "hover:border-emerald-600/40 hover:bg-zinc-900 cursor-pointer",
        dim && "opacity-70",
      )}
      onClick={() => onProfile?.(p.id)}
    >
      {index !== undefined && (
        <span className="w-6 shrink-0 text-right text-xs text-zinc-600">{index}</span>
      )}
      <PosBadge pos={p.pos} detail={p.detail} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {p.number > 0 && (
            <span className="shrink-0 rounded bg-zinc-800 px-1 text-[10px] font-bold text-zinc-400">
              #{p.number}
            </span>
          )}
          <span className="truncate font-semibold text-zinc-100">{p.name}</span>
          {p.bio?.real && (
            <span
              className="shrink-0 rounded bg-amber-500/15 px-1 text-[10px] font-bold text-amber-400"
              title="Реальный футболист"
            >
              ★
            </span>
          )}
          {p.bio?.nation && (
            <span className="hidden shrink-0 text-[10px] text-zinc-600 lg:inline">{p.bio.nation}</span>
          )}
          <span className={cn("text-xs font-bold", abilityClass(p.ability))}>{p.ability}</span>
          <AbilityBar value={p.ability} />
          {role && <span className="hidden truncate text-[11px] text-zinc-500 md:inline">{role}</span>}
        </div>
      </div>
      <div className="hidden w-24 shrink-0 sm:block">
        <div className="flex items-center gap-1.5">
          <span className="w-8 text-[10px] text-zinc-500">СТ{p.stamina}</span>
          <StatBar value={p.stamina} />
        </div>
      </div>
      <div className="hidden w-20 shrink-0 items-center gap-1.5 md:flex">
        <span className="w-8 text-[10px] text-zinc-500">МР{p.morale}</span>
        <StatBar value={p.morale} />
      </div>
      <span className={cn("w-20 shrink-0 text-right text-[11px]", st.cls)}>{st.text}</span>
      <span
        className={cn(
          "hidden w-20 shrink-0 text-right text-[11px] lg:inline",
          contractProblem ? "text-rose-400" : "text-zinc-500",
        )}
      >
        {contractLabel(p)}
      </span>
      {action && <div className="shrink-0" onClick={(e) => e.stopPropagation()}>{action}</div>}
    </div>
  );
}

// ─────────────────────────── Прочее ───────────────────────────

export function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-2 flex flex-wrap items-baseline gap-2">
      <h3 className="text-base font-bold uppercase tracking-wider text-zinc-200">{children}</h3>
      {hint && <span className="text-xs font-medium text-zinc-500">{hint}</span>}
    </div>
  );
}

export function Money({ value, colored }: { value: number; colored?: boolean }) {
  const fmt = (v: number) => {
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)} млн €`;
    return `${Math.round(v / 1000)} тыс €`;
  };
  const cls = colored
    ? value > 0
      ? "text-emerald-400"
      : value < 0
        ? "text-rose-400"
        : "text-zinc-300"
    : "text-amber-300";
  return <span className={cn("font-mono text-sm", cls)}>{fmt(value)}</span>;
}

export function GoalMark({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">
      ⚽ {text}
    </span>
  );
}
