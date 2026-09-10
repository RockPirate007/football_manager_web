"use client";

/**
 * Персонал клуба: штаб специалистов (6 ролей) и рынок свободных тренеров.
 */

import { useGameStore } from "@/game/store/gameStore";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { STAFF_ROLE_INFO, STAFF_ROLES, type StaffMember, type StaffRole } from "@/game/core/types";
import { fmtMoney } from "@/game/core/money";
import { userTeam } from "@/game/core/state";
import { cn } from "@/lib/utils";

function AbilityBar({ ability }: { ability: number }) {
  const pct = Math.max(0, Math.min(100, ability));
  const color =
    ability >= 80 ? "bg-emerald-500" : ability >= 68 ? "bg-lime-500" : ability >= 58 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function StaffCard({
  member,
  role,
  onFire,
  busy,
}: {
  member: StaffMember | null;
  role: StaffRole;
  onFire?: () => void;
  busy?: boolean;
}) {
  const info = STAFF_ROLE_INFO[role];
  return (
    <Card className="border-zinc-800 bg-zinc-900/70">
      <CardHeader className="flex-row items-center gap-3 space-y-0 p-4 pb-2">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-xl">
          {info.icon}
        </span>
        <div className="min-w-0 flex-1">
          <CardTitle className="text-[15px] font-bold text-zinc-100">{info.label}</CardTitle>
          <p className="text-xs text-zinc-500">{info.desc}</p>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        {member ? (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-sm font-semibold text-zinc-100">{member.name}</span>
              <span className="shrink-0 text-sm font-bold text-emerald-400">{member.ability}</span>
            </div>
            <AbilityBar ability={member.ability} />
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-zinc-500">
                {member.nation} • {fmtMoney(member.wage)}/тур
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                className="h-7 px-2 text-xs text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                onClick={onFire}
              >
                Уволить
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex h-[72px] flex-col items-center justify-center text-center">
            <p className="text-sm font-medium text-zinc-400">Должность пуста</p>
            <p className="text-xs text-zinc-600">Наймите специалиста на рынке ниже</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function StaffScreen() {
  const game = useGameStore((s) => s.game)!;
  const hire = useGameStore((s) => s.hireStaffAction);
  const fire = useGameStore((s) => s.fireStaffAction);
  const team = userTeam(game);

  const byRole = new Map<StaffRole, StaffMember | null>(STAFF_ROLES.map((r) => [r, null]));
  for (const s of team.staff) byRole.set(s.role, s);

  const totalWages = team.staff.reduce((sum, s) => sum + s.wage, 0);

  const handleHire = (id: number) => {
    const res = hire(id);
    if (res.ok) toast.success(res.message);
    else toast.error(res.message);
  };
  const handleFire = (role: StaffRole) => {
    const res = fire(role);
    if (res.ok) toast.success(res.message);
    else toast.error(res.message);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-zinc-500">
          Штаб определяет рост игроков, восстановление, лечение и качество скаутинга.
        </p>
        <p className="text-sm font-semibold text-amber-300">
          ФОТ персонала: {fmtMoney(totalWages)}/тур
        </p>
      </div>

      {/* Текущий штаб */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {STAFF_ROLES.map((role) => (
          <StaffCard
            key={role}
            role={role}
            member={byRole.get(role) ?? null}
            busy={game.moneyCheat ? false : team.budget < 1}
            onFire={() => handleFire(role)}
          />
        ))}
      </div>

      {/* Рынок специалистов */}
      <div>
        <h3 className="mb-2 mt-1 text-lg font-bold text-zinc-100">Рынок специалистов</h3>
        <p className="mb-3 text-xs text-zinc-500">
          Кандидаты обновляются каждый тур. Подписной бонус — три оклада. Найм заменяет действующего
          специалиста (тот уходит на рынок).
        </p>
        <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
          {game.staffMarket.length === 0 && (
            <p className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-500">
              Рынок пуст — новые имена появятся после следующего тура.
            </p>
          )}
          {game.staffMarket.map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-lg">
                {STAFF_ROLE_INFO[s.role].icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-zinc-100">
                  {s.name} <span className="font-normal text-zinc-500">• {STAFF_ROLE_INFO[s.role].label}</span>
                </p>
                <p className="text-xs text-zinc-500">
                  {s.nation} • рейтинг <b className="text-zinc-300">{s.ability}</b> • оклад {fmtMoney(s.wage)}/тур
                </p>
              </div>
              <span className="text-xs font-medium text-amber-300">
                Бонус: {fmtMoney(s.wage * 3)}
              </span>
              <Button
                size="sm"
                className="h-8 bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-500"
                onClick={() => handleHire(s.id)}
              >
                Нанять
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
