"use client";

/**
 * Диалог переговоров по трансферу.
 */

import { useGameStore } from "@/game/store/gameStore";
import { userTeam } from "@/game/core/state";
import { fmtMoney } from "@/game/core/money";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { PosBadge, abilityClass } from "../ui/game-ui";

export function NegotiationDialog() {
  const game = useGameStore((s) => s.game)!;
  const negotiation = useGameStore((s) => s.negotiation);
  const resolve = useGameStore((s) => s.resolveNegotiationChoice);
  const cancel = useGameStore((s) => s.cancelNegotiation);

  if (!negotiation) return null;
  const team = userTeam(game);
  const { options } = negotiation;

  return (
    <Dialog open onOpenChange={(o) => !o && cancel()}>
      <DialogContent aria-describedby={undefined} className="border-zinc-800 bg-zinc-900 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            🤝 ПЕРЕГОВОРЫ
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <PosBadge pos={negotiation.pos} />
            <span className="text-base font-bold text-zinc-100">{negotiation.playerName}</span>
            <span className="text-zinc-500">
              {negotiation.age} л • <span className={abilityClass(negotiation.ability)}>{negotiation.ability}</span>
            </span>
          </div>

          <div className="space-y-1 rounded-lg bg-zinc-950/60 p-3 text-zinc-300">
            <p className="flex justify-between">
              <span className="text-zinc-500">Стоимость:</span>
              <span className="text-amber-300">{fmtMoney(negotiation.playerValue)}</span>
            </p>
            <p className="flex justify-between">
              <span className="text-zinc-500">
                {negotiation.isAgent ? "Подпись (агент):" : `Запрос «${negotiation.fromTeam}»:`}
              </span>
              <span className="text-amber-300">{fmtMoney(negotiation.askingFee)}</span>
            </p>
            <p className="flex justify-between">
              <span className="text-zinc-500">Хочет:</span>
              <span>
                {negotiation.wantYears} г. • {fmtMoney(negotiation.wantSalary)}/тур
              </span>
            </p>
            <p className="flex justify-between border-t border-zinc-800 pt-1">
              <span className="text-zinc-500">Ваш бюджет:</span>
              <span className={team.budget >= negotiation.askingFee ? "text-emerald-400" : "text-rose-400"}>
                {fmtMoney(team.budget)}
              </span>
            </p>
          </div>

          <p className="text-xs uppercase tracking-wider text-zinc-500">Предложение</p>
          <div className="space-y-2">
            {options.map((opt, i) => (
              <button
                key={opt.key}
                className={
                  opt.key === "refuse"
                    ? "w-full rounded-lg border border-zinc-800 px-3 py-2.5 text-left text-sm text-zinc-400 transition-colors hover:border-rose-700 hover:text-rose-300"
                    : "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-left text-sm text-zinc-200 transition-colors hover:border-emerald-600 hover:bg-emerald-950/30"
                }
                onClick={() => {
                  const res = resolve(i);
                  if (opt.key === "refuse") {
                    cancel();
                    return;
                  }
                  if (res.ok) {
                    cancel();
                    toast.success(res.message);
                  } else {
                    toast.error(res.message, { duration: 4000 });
                    if (res.message.includes("Недостаточно")) cancel();
                  }
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-zinc-600">
            Жёсткий торг снижает шанс согласия, но экономит бюджет
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
