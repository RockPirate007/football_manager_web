"use client";

/**
 * Клуб и финансы: бюджет, детальная разбивка доходов/расходов за тур,
 * стадион, спонсоры, репутация, доверие, схемы.
 */

import { useGameStore } from "@/game/store/gameStore";
import { userTeam, userPlace } from "@/game/core/state";
import { fmtMoney } from "@/game/core/money";
import { teamPayroll } from "@/game/core/team";
import { FORMATIONS } from "@/game/data/formations";
import { TACTICS } from "@/game/data/tactics";
import { BANKRUPT_LIMIT, LEAGUE_BY_ID } from "@/game/data/leagues";
import { prestigeOf } from "@/game/systems/ligue";
import { reputationLabel, trustLabel } from "@/game/systems/career";
import { Card, CardContent } from "@/components/ui/card";
import { Money } from "../ui/game-ui";
import { TeamLogo } from "../ui/logos";

function Row({
  icon,
  label,
  value,
  hint,
}: {
  icon: string;
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-zinc-800/60 py-1.5 last:border-0">
      <span className="min-w-0 text-sm text-zinc-400">
        {icon} {label}
        {hint && <span className="ml-1 text-xs text-zinc-600">({hint})</span>}
      </span>
      <span className="shrink-0 text-sm font-semibold tabular-nums">
        <Money value={value} colored />
      </span>
    </div>
  );
}

export function FinancesScreen() {
  const game = useGameStore((s) => s.game)!;
  const team = userTeam(game);
  const formation = FORMATIONS[team.formation];
  const tactic = TACTICS[team.tactic];
  const fin = game.lastFinDetail;

  const income = fin ? fin.tickets + fin.merch + fin.sponsors + fin.tv + fin.bonus : game.lastFin?.[0] ?? 0;
  const spend = fin ? fin.payroll + (fin.staff ?? 0) + fin.upkeep + (fin.facility ?? 0) + fin.other : game.lastFin?.[1] ?? 0;
  const net = income - spend;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-zinc-800 bg-zinc-900/70">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wider text-zinc-500">🏦 Бюджет</p>
            <p className="mt-1 flex items-center gap-2">
              {game.moneyCheat && <span className="text-xs font-bold text-amber-400">∞</span>}
              <Money value={team.budget} />
            </p>
            {game.moneyCheat && (
              <p className="mt-0.5 text-[11px] text-amber-500/80">Режим песочницы</p>
            )}
          </CardContent>
        </Card>
        <Card className="border-zinc-800 bg-zinc-900/70">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wider text-zinc-500">💸 Зарплаты/тур</p>
            <p className="mt-1"><Money value={-teamPayroll(team)} colored /></p>
          </CardContent>
        </Card>
        <Card className="border-zinc-800 bg-zinc-900/70">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wider text-zinc-500">🎖 Репутация</p>
            <p className="mt-1 text-sm font-bold text-emerald-400">
              {game.reputation}/100 <span className="font-normal text-zinc-500">({reputationLabel(game.reputation)})</span>
            </p>
          </CardContent>
        </Card>
        <Card className="border-zinc-800 bg-zinc-900/70">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wider text-zinc-500">🏛 Доверие</p>
            <p
              className={
                game.boardTrust <= 30
                  ? "mt-1 text-sm font-bold text-rose-400"
                  : "mt-1 text-sm font-bold text-emerald-400"
              }
            >
              {game.boardTrust}/100 <span className="font-normal text-zinc-500">({trustLabel(game.boardTrust)})</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Стадион и клуб */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-zinc-800 bg-zinc-900/70">
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center gap-2">
              <TeamLogo name={team.name} size={30} />
              <div>
                <p className="text-sm font-bold text-zinc-100">{team.name}</p>
                <p className="text-xs text-zinc-500">Стадион: {team.stadium}</p>
              </div>
            </div>
            <div className="mt-2 space-y-1.5 text-sm text-zinc-300">
              <p>
                Вместимость: <b className="text-zinc-100">{team.capacity.toLocaleString("ru-RU")}</b> мест
              </p>
              <p>
                Спонсор:{" "}
                {game.sponsorDeal ? (
                  <>
                    <b className="text-amber-300">{game.sponsorDeal.name}</b>
                    <span className="text-xs text-zinc-500"> ({game.sponsorDeal.seasonsLeft} сезон., бонус за топ-{game.sponsorDeal.placeTarget})</span>
                  </>
                ) : team.sponsor ? (
                  <b className="text-amber-300">{team.sponsor}</b>
                ) : (
                  <span className="text-zinc-500">контракт не подписан</span>
                )}
              </p>
              <p>
                Престиж {LEAGUE_BY_ID[team.league]?.short ?? "лиги"}:{" "}
                <b className="text-zinc-100">{prestigeOf(game, team.league).toFixed(1)}/100</b>
                <span className="text-xs text-zinc-500"> — влияет на ТВ-доходы лиги</span>
              </p>
              <p>
                Менеджер: <b>{game.manager}</b>
              </p>
              <p>
                Место: {userPlace(game)} из {Object.keys(game.teams).length} • Очки: {team.pts}
              </p>
              <p>
                Состав: {team.players.length} игроков • Академия: {game.academy.length}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900/70">
          <CardContent className="space-y-2 p-4 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Тактика</p>
            <p className="text-zinc-300">
              <span className="text-teal-400">Формация:</span> {team.formation} — {formation.description}
            </p>
            <p className="text-zinc-300">
              <span className="text-teal-400">Установка:</span> {team.tactic} — {tactic.description}
            </p>
            <p className="text-xs text-zinc-500">
              Атака {tactic.atk.toFixed(2)} | Оборона {tactic.df.toFixed(2)} | Владение{" "}
              {tactic.possession.toFixed(2)} | Прессинг {tactic.pressing.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Отчёт за тур */}
      <Card className="border-zinc-800 bg-zinc-900/70">
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
              Отчёт за тур {Math.max(1, game.round)}
            </h3>
            <span className="text-sm font-bold">
              Итог:{" "}
              <Money value={net} colored />
            </span>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-emerald-400">Доходы</p>
              <Row icon="🎟" label="Билеты" value={fin?.tickets ?? 0} hint={fin ? `${fin.attendance.toLocaleString("ru-RU")} зрителей` : undefined} />
              <Row icon="👕" label="Мерч и фан-шоп" value={fin?.merch ?? 0} />
              <Row icon="🤝" label="Спонсоры" value={fin?.sponsors ?? 0} hint={team.sponsor || undefined} />
              <Row icon="📺" label="ТВ-права" value={fin?.tv ?? 0} />
              <Row icon="🏅" label="Премии за результат" value={fin?.bonus ?? 0} />
              <div className="mt-1 flex items-center justify-between border-t border-zinc-700 pt-2">
                <span className="text-sm font-bold text-zinc-300">Всего доходов</span>
                <span className="text-sm font-bold text-emerald-400 tabular-nums">+{fmtMoney(income)}</span>
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-rose-400">Расходы</p>
              <Row icon="💼" label="Зарплаты" value={-(fin?.payroll ?? 0)} />
              <Row icon="🏗" label="Содержание стадиона" value={-(fin?.upkeep ?? 0)} hint={team.stadium} />
              <Row icon="🏟" label="Содержание инфраструктуры" value={-(fin?.facility ?? 0)} hint="база, академия, медцентр" />
              <Row icon="👔" label="Персонал" value={-(fin?.staff ?? 0)} />
              <Row icon="🎓" label="Академия и скауты" value={-(fin?.other ?? 0)} />
              <div className="mt-1 flex items-center justify-between border-t border-zinc-700 pt-2">
                <span className="text-sm font-bold text-zinc-300">Всего расходов</span>
                <span className="text-sm font-bold text-rose-400 tabular-nums">−{fmtMoney(spend)}</span>
              </div>
              {fin && (
                <p className="mt-2 text-xs text-zinc-500">
                  Заполнение арены: {Math.round((fin.attendance / Math.max(1, team.capacity)) * 100)}% •
                  посещаемость растёт от места в таблице, формы и репутации
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {!game.moneyCheat && (
        <p className="rounded-lg border border-rose-900/50 bg-rose-950/20 px-4 py-3 text-sm text-rose-300">
          ⚠ Бюджет ниже {fmtMoney(BANKRUPT_LIMIT)} или доверие ≤ 18 — увольнение!
        </p>
      )}
    </div>
  );
}
