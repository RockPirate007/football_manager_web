"use client";

/**
 * Лента новостей: медиапоток вокруг клуба, лиги, Европы и мира.
 * Фильтры по категориям, свежие — сверху.
 */

import { useState } from "react";
import { useGameStore } from "@/game/store/gameStore";
import { NEWS_CAT_LABEL, type NewsCat } from "@/game/core/types";
import { Card, CardContent } from "@/components/ui/card";
import { SectionTitle } from "../ui/game-ui";
import { cn } from "@/lib/utils";

const CAT_TABS: Array<{ key: NewsCat | "all"; label: string }> = [
  { key: "all", label: "Все" },
  { key: "club", label: "Клуб" },
  { key: "league", label: "Лига" },
  { key: "europe", label: "Европа" },
  { key: "world", label: "Мир" },
];

export function NewsScreen() {
  const game = useGameStore((s) => s.game)!;
  const [cat, setCat] = useState<NewsCat | "all">("all");

  const news = [...game.news]
    .reverse()
    .filter((n) => cat === "all" || n.cat === cat)
    .slice(0, 60);

  return (
    <div className="space-y-4">
      <SectionTitle hint="что говорят газеты и телеканалы">📰 Лента новостей</SectionTitle>

      <div className="flex flex-wrap gap-2">
        {CAT_TABS.map((t) => (
          <button
            key={t.key}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
              cat === t.key
                ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200",
            )}
            onClick={() => setCat(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {news.length === 0 && (
        <Card className="border-zinc-800 bg-zinc-900/70">
          <CardContent className="py-10 text-center text-sm text-zinc-600">
            Новостей пока нет — сыграйте тур, и пресса не заставит себя ждать
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {news.map((n, i) => (
          <Card key={`${n.season}-${n.round}-${i}`} className="border-zinc-800 bg-zinc-900/70">
            <CardContent className="flex gap-3 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-800/80 text-xl">
                {n.icon}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-2">
                  <p className="font-bold text-zinc-100">{n.title}</p>
                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    {NEWS_CAT_LABEL[n.cat]}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-400">{n.text}</p>
                <p className="mt-1 text-[11px] text-zinc-600">
                  Сезон {n.season} • тур {n.round + 1}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
