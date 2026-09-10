"use client";

/**
 * Клубная почта: список писем + чтение.
 */

import { useState } from "react";
import { useGameStore } from "@/game/store/gameStore";
import { markMailRead } from "@/game/systems/mail";
import { Card, CardContent } from "@/components/ui/card";
import { SectionTitle } from "../ui/game-ui";
import { cn } from "@/lib/utils";

export function MailScreen() {
  const game = useGameStore((s) => s.game)!;
  const [selected, setSelected] = useState<number | null>(null);

  const mails = game.mail.slice().reverse();
  const unread = game.mail.filter((m) => !m.read).length;

  const open = (idx: number) => {
    const realIdx = game.mail.length - 1 - idx;
    if (!game.mail[realIdx].read) {
      const { game: _g } = useGameStore.getState();
      // Мутация через стор для реактивности
      useGameStore.setState((s) => {
        if (!s.game) return s;
        const ng = structuredClone(s.game);
        markMailRead(ng, realIdx);
        return { game: ng };
      });
    }
    setSelected(idx);
  };

  const mail = selected !== null ? mails[selected] : null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div>
        <SectionTitle hint={`непрочитанных: ${unread} • всего ${mails.length}`}>Почта</SectionTitle>
        <div className="max-h-[55vh] space-y-1.5 overflow-y-auto pr-1">
          {mails.length === 0 && (
            <p className="py-6 text-center text-sm text-zinc-600">Ящик пуст</p>
          )}
          {mails.map((m, idx) => (
            <button
              key={idx}
              className={cn(
                "w-full rounded-lg border px-3 py-2.5 text-left transition-colors",
                selected === idx
                  ? "border-emerald-600/60 bg-emerald-500/5"
                  : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-600",
              )}
              onClick={() => open(idx)}
            >
              <div className="flex items-center gap-2">
                <span className={m.read ? "text-zinc-600" : "text-emerald-400"}>
                  {m.read ? "○" : "●"}
                </span>
                <span className="flex-1 truncate text-sm font-medium text-zinc-200">
                  {m.subject}
                </span>
                <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                  {m.category}
                </span>
              </div>
              <p className="mt-1 pl-5 text-[10px] text-zinc-600">
                Сезон {m.season} • тур {m.round}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <SectionTitle>Письмо</SectionTitle>
        <Card className="border-zinc-800 bg-zinc-900/60">
          <CardContent className="p-4">
            {!mail && <p className="py-8 text-center text-sm text-zinc-600">Выберите письмо слева</p>}
            {mail && (
              <div className="space-y-3">
                <h3 className="text-base font-bold text-zinc-100">{mail.subject}</h3>
                <p className="text-xs text-zinc-500">
                  Сезон {mail.season} • тур {mail.round} • {mail.category}
                </p>
                <div className="whitespace-pre-line border-t border-zinc-800 pt-3 text-sm leading-relaxed text-zinc-300">
                  {mail.body}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
