"use client";

/**
 * Диалог пресс-конференции: журналисты, варианты ответов, реакции прессы.
 * Открывается автоматически, когда в состоянии есть активная конференция.
 * Итоги показываются локально (после последнего ответа состояние уже очищено).
 */

import { useState } from "react";
import { useGameStore } from "@/game/store/gameStore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PRESS_CONTEXT_LABEL, type PressContext } from "@/game/core/types";

const EFFECT_LABELS: Array<{ key: "morale" | "board" | "rep"; label: string; icon: string }> = [
  { key: "morale", label: "мораль", icon: "🔥" },
  { key: "board", label: "доверие", icon: "🏛" },
  { key: "rep", label: "репутация", icon: "🎖" },
];

interface Summary {
  context: PressContext;
  results: string[];
}

export function PressConferenceDialog() {
  const game = useGameStore((s) => s.game);
  const answerPress = useGameStore((s) => s.answerPressAction);
  const skipPress = useGameStore((s) => s.skipPress);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [done, setDone] = useState<Summary | null>(null);

  const pc = game?.pendingPress ?? null;
  const question = pc?.questions[pc.current] ?? null;
  const total = pc?.questions.length ?? 0;
  const current = pc?.current ?? 0;

  if (!game) return null;

  const handleAnswer = (idx: number) => {
    if (!pc) return;
    const wasLast = pc.current + 1 >= pc.questions.length;
    const result = answerPress(idx);
    if (result === null) return;
    if (wasLast) {
      // Конференция закрыта — показываем итоговый экран
      setLastResult(null);
      setDone({ context: pc.context, results: [...pc.results, result] });
    } else {
      setLastResult(result);
    }
  };

  const handleNext = () => {
    // Последний ответ уже очистил конференцию — показать итоги
    setLastResult(null);
  };

  const handleClose = () => {
    skipPress();
    setLastResult(null);
    setDone(null);
  };

  // ─── Итоги конференции (локальное состояние) ───
  if (!pc || !question) {
    // pc без активного вопроса (гонка состояний) — просто не рисуем
    if (done === null) return null;
    return (
      <Dialog open={done !== null} onOpenChange={(o) => !o && handleClose()}>
        <DialogContent className="max-w-lg border-zinc-800 bg-zinc-950 sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-zinc-100">
              Пресс-конференция завершена
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              {done ? PRESS_CONTEXT_LABEL[done.context] : ""} • ответов: {done?.results.length ?? 0}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {done?.results.map((r, i) => (
              <p
                key={i}
                className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3 text-sm text-zinc-300"
              >
                <span className="mr-1.5 font-bold text-emerald-400">{i + 1}.</span>
                {r}
              </p>
            ))}
          </div>
          <button
            className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-500"
            onClick={handleClose}
          >
            К работе
          </button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={pc !== null}
      onOpenChange={(o) => {
        // Клик мимо диалога = менеджер покидает пресс-подход
        if (!o) handleClose();
      }}
    >
      <DialogContent className="max-w-lg border-zinc-800 bg-zinc-950 sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-black text-zinc-100">
            🎙 Пресс-конференция
            <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs font-bold text-emerald-400">
              {PRESS_CONTEXT_LABEL[pc.context]}
            </span>
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Вопрос {current + 1} из {total}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              {question.journalist} • {question.outlet}
            </p>
            <p className="mt-1.5 text-[15px] font-medium leading-snug text-zinc-100">
              «{question.text}»
            </p>
          </div>

          {lastResult !== null ? (
            <div className="rounded-xl border border-emerald-700/50 bg-emerald-500/10 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">Реакция прессы</p>
              <p className="mt-1 text-sm text-zinc-200">{lastResult}</p>
              <button
                className="mt-3 w-full rounded-lg bg-emerald-600 py-2 text-sm font-bold text-white hover:bg-emerald-500"
                onClick={handleNext}
              >
                Дальше
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {question.answers.map((a, idx) => (
                <button
                  key={idx}
                  className="group w-full rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5 text-left transition-colors hover:border-emerald-600/60 hover:bg-zinc-900"
                  onClick={() => handleAnswer(idx)}
                >
                  <p className="text-sm font-semibold text-zinc-100 group-hover:text-emerald-300">
                    {a.text}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-500">
                    {EFFECT_LABELS.filter((e) => a.effect[e.key]).map((e) => {
                      const v = a.effect[e.key]!;
                      return (
                        <span key={e.key} className={v > 0 ? "text-emerald-400" : "text-rose-400"}>
                          {e.icon} {e.label} {v > 0 ? `+${v}` : v}
                        </span>
                      );
                    })}
                    {EFFECT_LABELS.every((e) => !a.effect[e.key]) && (
                      <span>нейтральный ответ</span>
                    )}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
