"use client";

/**
 * Архив завершённых сезонов.
 */

import { useGameStore } from "@/game/store/gameStore";
import { Card, CardContent } from "@/components/ui/card";
import { SectionTitle } from "../ui/game-ui";
import { cn } from "@/lib/utils";

export function ArchiveScreen() {
  const game = useGameStore((s) => s.game)!;
  const arch = game.archive;
  const best = arch.length > 0 ? arch.reduce((a, b) => (b.place < a.place ? b : a)) : null;

  return (
    <div className="space-y-4">
      <SectionTitle hint={`записей: ${arch.length}`}>Архив сезонов</SectionTitle>
      {arch.length === 0 && (
        <p className="py-8 text-center text-sm text-zinc-600">
          Архив заполнится после первого завершённого сезона
        </p>
      )}
      <div className="space-y-1.5">
        {arch
          .slice()
          .reverse()
          .map((e, i) => (
            <Card key={i} className="border-zinc-800 bg-zinc-900/60">
              <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span className="font-bold text-zinc-300">С{e.season}</span>
                {"league" in e && (
                  <span className="hidden text-[11px] text-zinc-600 sm:inline">{String(e.league)}</span>
                )}
                <span className={cn("font-semibold", e.club === game.user ? "text-emerald-300" : "text-zinc-200")}>
                  «{e.club}»
                </span>
                <span className="text-zinc-400">
                  {e.place} место • {e.pts} очк.
                </span>
                <span className="font-mono text-xs text-zinc-500">
                  {e.w}-{e.d}-{e.l} • {e.gf}:{e.ga}
                </span>
                {e.cup === e.club && <span className="text-amber-400">🏆Кубок</span>}
              </CardContent>
            </Card>
          ))}
      </div>
      {best && (
        <p className="text-xs text-zinc-600">
          Лучший сезон: С{best.season} — {best.place} место
        </p>
      )}
    </div>
  );
}
