"use client";

/**
 * Инфраструктура клуба: стадион, тренировочная база, академия,
 * медицинский центр, фан-шоп. Апгрейды с реальными эффектами —
 * строительство клуба в духе FIFA Manager.
 */

import { useGameStore } from "@/game/store/gameStore";
import { userTeam } from "@/game/core/state";
import { fmtMoney } from "@/game/core/money";
import { effectiveCapacity, upgradeCost, facilityUpkeep } from "@/game/systems/facilities";
import {
  FACILITY_KEYS,
  FACILITY_META,
  MAX_FACILITY_LEVEL,
  type FacilityKey,
} from "@/game/core/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** Короткое описание эффекта уровня */
const LEVEL_EFFECT: Record<FacilityKey, string[]> = {
  stadium: [
    "Базовая арена без расширений",
    "+6% мест: первый ярус трибун",
    "+12% мест: расширение за воротами",
    "+18% мест: второй ярус и VIP-ложи",
    "+24% мест: современная арена-шедевр",
  ],
  training: [
    "Скромные поля и раздевалки",
    "Стандартный тренировочный центр",
    "Современные поля + тренажёрный зал",
    "Спорт-наука и реабилитация",
    "Топовая база мирового уровня",
  ],
  academy: [
    "Минимальные условия для юниоров",
    "Учебные классы и общежитие",
    "Скаутская сеть и тренеры U-17",
    "Профессиональная система подготовки",
    "Академия элитного уровня",
  ],
  medical: [
    "Приходящий врач",
    "Физиотерапевтический кабинет",
    "Штатный медцентр",
    "Диагностика и МРТ на месте",
    "Медцентр уровня сборных",
  ],
  shop: [
    "Лоток у входа на стадион",
    "Фан-шоп с базовой атрибутикой",
    "Магазин + онлайн-доставка",
    "Флагманский шоурум",
    "Глобальная сеть мерчандайзинга",
  ],
};

const LEVEL_WORDS = ["", "I", "II", "III", "IV", "V"];

function FacilityCard({ facKey }: { facKey: FacilityKey }) {
  const game = useGameStore((s) => s.game)!;
  const buildFacility = useGameStore((s) => s.buildFacility);
  const fac = game.facilities;
  const meta = FACILITY_META[facKey];
  const level = fac[facKey];
  const up = upgradeCost(fac, facKey);
  const team = userTeam(game);
  const busy = !!fac.project;
  const buildingThis = fac.project?.key === facKey;

  const doBuild = () => {
    const res = buildFacility(facKey);
    if (res.ok) toast.success(res.message);
    else toast.error(res.message);
  };

  return (
    <Card className="border-zinc-800 bg-zinc-900/70">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="text-2xl">{meta.icon}</span>
          <span className="min-w-0">
            <span className="block truncate">{meta.label}</span>
            <span className="text-xs font-normal text-zinc-500">
              Уровень {level} из {MAX_FACILITY_LEVEL}
              {level >= MAX_FACILITY_LEVEL && " — максимум"}
            </span>
          </span>
          <span className="ml-auto font-mono text-sm text-emerald-400">
            {LEVEL_WORDS[level]}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Progress value={(level / MAX_FACILITY_LEVEL) * 100} className="h-2" />
        <p className="text-sm text-zinc-300">{LEVEL_EFFECT[facKey][level - 1]}</p>

        {buildingThis && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
            🚧 Стройка идёт: до ур. {fac.project!.targetLevel} — ещё{" "}
            <b>{fac.project!.roundsLeft}</b> тур(ов)
          </div>
        )}

        {!buildingThis && up && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
            <div className="min-w-0 text-xs text-zinc-500">
              <p className="font-semibold text-zinc-300">
                Ур. {level + 1}: {LEVEL_EFFECT[facKey][level]}
              </p>
              <p>
                {fmtMoney(-up.cost)} • {up.rounds} тур(ов) • {meta.effect}
              </p>
            </div>
            <Button
              size="sm"
              className="shrink-0 bg-emerald-600 font-bold hover:bg-emerald-500"
              disabled={busy}
              onClick={doBuild}
            >
              Строить
            </Button>
          </div>
        )}
        {level >= MAX_FACILITY_LEVEL && (
          <p className="text-xs text-emerald-400/80">Максимальное развитие достигнуто 👑</p>
        )}
      </CardContent>
    </Card>
  );
}

export function FacilitiesScreen() {
  const game = useGameStore((s) => s.game)!;
  const team = userTeam(game);
  const fac = game.facilities;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-zinc-800 bg-zinc-900/70">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wider text-zinc-500">🏟 Стадион</p>
            <p className="mt-1 text-sm font-bold text-zinc-100">{team.stadium}</p>
            <p className="text-xs text-zinc-500">
              Вместимость: {team.capacity.toLocaleString("ru-RU")} →{" "}
              <b className="text-emerald-400">
                {effectiveCapacity(team, fac).toLocaleString("ru-RU")}
              </b>{" "}
              эфф.
            </p>
          </CardContent>
        </Card>
        <Card className="border-zinc-800 bg-zinc-900/70">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wider text-zinc-500">🛠 Содержание</p>
            <p className="mt-1 text-sm font-bold text-rose-400">
              −{fmtMoney(facilityUpkeep(fac))}/тур
            </p>
            <p className="text-xs text-zinc-500">5 объектов, суммарно {FACILITY_KEYS.reduce((s, k) => s + fac[k], 0)} ур.</p>
          </CardContent>
        </Card>
        <Card className="border-zinc-800 bg-zinc-900/70">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wider text-zinc-500">💼 Бюджет клуба</p>
            <p className={cn("mt-1 text-sm font-bold", team.budget < 0 ? "text-rose-400" : "text-emerald-400")}>
              {fmtMoney(team.budget)}
            </p>
            <p className="text-xs text-zinc-500">
              {fac.project ? `Стройка: ${FACILITY_META[fac.project.key].label}` : "Активных строек нет"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {FACILITY_KEYS.map((k) => (
          <FacilityCard key={k} facKey={k} />
        ))}
      </div>

      <Card className="border-zinc-800 bg-zinc-900/60">
        <CardContent className="p-4 text-sm text-zinc-400">
          <p className="font-semibold text-zinc-300">Как это работает</p>
          <p className="mt-1">
            Стадион увеличивает вместимость и билетные доходы. Тренировочная база ускоряет
            восстановление и прогресс на тренировках. Академия повышает качество юниоров.
            Медицинский центр лечит травмы быстрее. Фан-шоп умножает мерчандайзинг.
            Одновременно можно вести только одну стройку — инвестируйте с умом.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
