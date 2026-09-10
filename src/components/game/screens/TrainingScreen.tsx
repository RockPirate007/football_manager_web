"use client";

/**
 * Тренировка: командная (одна на тур, пять типов) и индивидуальные
 * планы для избранных игроков (Фаза 2: до 3 фокусов атрибутов).
 */

import { useGameStore } from "@/game/store/gameStore";
import { userTeam } from "@/game/core/state";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionTitle } from "../ui/game-ui";
import { cn } from "@/lib/utils";
import type { TrainingType } from "@/game/systems/training";
import {
  MAX_INDIVIDUAL_PLANS,
  TRAIN_FOCUS_INFO,
  type TrainFocus,
} from "@/game/core/types";

const TRAININGS: Array<{
  key: TrainingType;
  icon: string;
  title: string;
  desc: string;
}> = [
  { key: "attack", icon: "⚔", title: "Атака", desc: "Рост НАП и ПЗ (шанс выше у молодых, потолок — потенциал)" },
  { key: "defense", icon: "🛡", title: "Защита", desc: "Рост ВРТ и ЗАЩ" },
  { key: "youth", icon: "🎓", title: "Академия", desc: "Юниоры U17/U19 прогрессируют (уровень академии и тренер усиливают)" },
  { key: "fitness", icon: "🏃", title: "Физподготовка", desc: "Всем +12% выносливости" },
  { key: "recovery", icon: "😌", title: "Восстановление", desc: "Всем +20% выносливости" },
];

export function TrainingScreen() {
  const game = useGameStore((s) => s.game)!;
  const train = useGameStore((s) => s.train);
  const setTrainFocus = useGameStore((s) => s.setTrainFocus);

  const team = userTeam(game);
  const planned = team.players.filter((p) => p.trainFocus);
  const candidates = team.players
    .filter((p) => !p.trainFocus && p.age <= 28)
    .sort((a, b) => b.potential - b.ability - (a.potential - a.ability))
    .slice(0, 12);

  const handleTrain = (t: TrainingType) => {
    const res = train(t);
    if (res.ok) toast.success(res.message);
    else toast.warning(res.message);
  };

  const handleFocus = (playerId: number, focus: TrainFocus | null) => {
    const res = setTrainFocus(playerId, focus);
    if (res.ok) toast.success(res.message);
    else toast.warning(res.message);
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-zinc-500">
        Одна командная тренировка в тур. Индивидуальные планы работают автоматически и не расходуют её.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TRAININGS.map((tr) => (
          <Card
            key={tr.key}
            className={cn(
              "border-zinc-800 bg-zinc-900/70 transition-colors",
              game.trained ? "opacity-40" : "cursor-pointer hover:border-emerald-600/50",
            )}
            onClick={() => !game.trained && handleTrain(tr.key)}
          >
            <CardHeader className="p-4 pb-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="text-xl">{tr.icon}</span> {tr.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-xs text-zinc-500">{tr.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      {game.trained && (
        <p className="text-sm text-amber-400">✓ На этой неделе тренировка уже проведена</p>
      )}

      {/* Индивидуальные планы (Фаза 2) */}
      <Card className="border-zinc-800 bg-zinc-900/70">
        <CardContent className="p-4">
          <SectionTitle hint={`лимит: ${MAX_INDIVIDUAL_PLANS} игрока; фокус растит атрибут еженедельно`}>
            📌 Индивидуальные планы ({planned.length}/{MAX_INDIVIDUAL_PLANS})
          </SectionTitle>

          {planned.length > 0 && (
            <div className="mb-3 space-y-1.5">
              {planned.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-900/50 bg-emerald-950/20 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                  <span className="text-xs text-zinc-500">
                    {p.age} л • {p.ability}→{p.potential}
                  </span>
                  <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[11px] font-bold text-emerald-300">
                    {TRAIN_FOCUS_INFO[p.trainFocus!].label}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[11px] text-zinc-500 hover:text-rose-400"
                    onClick={() => handleFocus(p.id, null)}
                  >
                    снять
                  </Button>
                </div>
              ))}
            </div>
          )}

          {planned.length < MAX_INDIVIDUAL_PLANS && candidates.length > 0 && (
            <div className="space-y-1">
              <p className="mb-1 text-xs font-semibold text-zinc-400">
                Кандидаты (молодые с разрывом «потенциал − сила»):
              </p>
              {candidates.map((p) => (
                <div key={p.id} className="flex items-center gap-2 text-sm">
                  <span className="w-32 shrink-0 truncate text-zinc-300" title={p.name}>
                    {p.name}
                  </span>
                  <span className="hidden w-24 shrink-0 text-xs text-zinc-500 sm:inline">
                    {p.ability}→{p.potential}
                  </span>
                  <Select onValueChange={(v) => handleFocus(p.id, v as TrainFocus)}>
                    <SelectTrigger className="h-8 w-44 border-zinc-700 bg-zinc-950 text-xs">
                      <SelectValue placeholder="Назначить фокус…" />
                    </SelectTrigger>
                    <SelectContent className="border-zinc-700 bg-zinc-900">
                      {(Object.keys(TRAIN_FOCUS_INFO) as TrainFocus[]).map((k) => (
                        <SelectItem key={k} value={k}>
                          {TRAIN_FOCUS_INFO[k].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}
          {planned.length === 0 && candidates.length === 0 && (
            <p className="text-sm text-zinc-600">Нет подходящих кандидатов — все планы уже заняты.</p>
          )}
          <p className="mt-2 text-xs text-zinc-500">
            Кандидаты по умолчанию — молодые игроки с разрывом «потенциал − сила». Работают и на ветеранов
            (через список состава), но прогресс медленнее.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
