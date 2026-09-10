"use client";

/**
 * Спонсоры и мерч (Фаза 3): действующий контракт, рынок предложений,
 * билетная политика и FFP-статус. Мерчандайзинг считается автоматически
 * (фан-шоп × престиж лиги × репутация) — здесь виден отчёт.
 */

import { useState } from "react";
import { useGameStore } from "@/game/store/gameStore";
import { userTeam, userPlace, leagueTeams } from "@/game/core/state";
import { fmtMoney } from "@/game/core/money";
import { teamPayroll } from "@/game/core/team";
import { prestigeOf } from "@/game/systems/ligue";
import { ticketAutoPrice, currentTicketPrice } from "@/game/systems/economy";
import { ffpZone } from "@/game/systems/board";
import { LEAGUE_BY_ID } from "@/game/data/leagues";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Money, SectionTitle } from "../ui/game-ui";
import { cn } from "@/lib/utils";

export function SponsorsScreen() {
  const game = useGameStore((s) => s.game)!;
  const signSponsor = useGameStore((s) => s.signSponsor);
  const setTicketPrice = useGameStore((s) => s.setTicketPrice);
  const team = userTeam(game);
  const [priceDraft, setPriceDraft] = useState<string>("");

  const deal = game.sponsorDeal;
  const offers = game.sponsorOffers ?? [];
  const autoPrice = ticketAutoPrice(team);
  const curPrice = currentTicketPrice(game);
  const nTeams = leagueTeams(game, team.league).length || 18;
  const place = Math.max(1, userPlace(game));
  const prestige = prestigeOf(game, team.league);
  const leagueName = LEAGUE_BY_ID[team.league]?.name ?? "Лига";
  const fin = game.lastFinDetail;
  const zone = ffpZone(game);

  const doSign = (id: number) => {
    const res = signSponsor(id);
    if (res.ok) toast.success(res.message);
    else toast.warning(res.message);
  };

  const applyPrice = () => {
    const raw = priceDraft.trim();
    if (raw === "") {
      toast.warning("Введите цену или нажмите «Авто»");
      return;
    }
    const res = setTicketPrice(Number(raw));
    if (res.ok) {
      toast.success(res.message);
      setPriceDraft("");
    } else toast.warning(res.message);
  };

  const autoPriceAction = () => {
    const res = setTicketPrice(null);
    if (res.ok) toast.success(res.message);
  };

  return (
    <div className="space-y-4">
      <SectionTitle hint="контракты, мерч и билетная политика">🤝 Спонсоры и мерч</SectionTitle>

      {/* Действующий контракт */}
      <Card className="border-zinc-800 bg-zinc-900/70">
        <CardContent className="space-y-2 p-4">
          {deal ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-500">Титульный спонсор</p>
                  <p className="text-lg font-black text-amber-300">{deal.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-zinc-500">Платёж за тур</p>
                  <Money value={deal.perRound} />
                </div>
              </div>
              <div className="grid gap-1.5 text-sm text-zinc-300 sm:grid-cols-3">
                <p>Срок: <b>{deal.seasonsLeft > 0 ? `${deal.seasonsLeft} сезон(а)` : "истекает"}</b></p>
                <p>Бонус: <Money value={deal.placeBonus} /> за топ-{deal.placeTarget}</p>
                <p>
                  Условие: место ≤ {deal.placeTarget} (сейчас {place}-е)
                  {place <= deal.placeTarget && <span className="ml-1 font-bold text-emerald-400">✓ в графике</span>}
                </p>
              </div>
            </>
          ) : (
            <p className="text-sm text-zinc-400">Контракт не подписан — доходы по базовой формуле. Подпишите предложение ниже.</p>
          )}
        </CardContent>
      </Card>

      {/* Рынок предложений */}
      <Card className="border-zinc-800 bg-zinc-900/70">
        <CardContent className="space-y-3 p-4">
          <p className="text-sm font-bold uppercase tracking-wider text-zinc-400">
            Предложения спонсоров
            <span className="ml-2 font-normal normal-case text-zinc-500">предложения уходят через несколько туров</span>
          </p>
          {offers.length === 0 && (
            <p className="text-sm text-zinc-500">Рынок пуст — предложения придут по ходу сезона и в межсезонье.</p>
          )}
          <div className="grid gap-3 lg:grid-cols-3">
            {offers.map((o) => {
              const locked = game.reputation < o.minReputation;
              const better = !deal || o.perRound > deal.perRound;
              return (
                <div
                  key={o.id}
                  className={cn(
                    "flex flex-col gap-2 rounded-xl border p-3",
                    better ? "border-emerald-700/50 bg-emerald-950/20" : "border-zinc-800 bg-zinc-950/40",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-zinc-100">{o.name}</p>
                    <span className="rounded-md bg-zinc-800 px-1.5 py-0.5 text-[11px] text-zinc-400">
                      истекает: {o.roundsLeft} тур.
                    </span>
                  </div>
                  <div className="space-y-1 text-sm text-zinc-300">
                    <p className="flex justify-between"><span className="text-zinc-500">За тур</span><Money value={o.perRound} /></p>
                    <p className="flex justify-between"><span className="text-zinc-500">Подъёмные</span><Money value={o.signOn} /></p>
                    <p className="flex justify-between"><span className="text-zinc-500">Срок</span><b>{o.seasonsLeft} сезон(а)</b></p>
                    <p className="flex justify-between"><span className="text-zinc-500">Бонус</span><span>{fmtMoney(o.placeBonus)} за топ-{o.placeTarget}</span></p>
                    <p className={cn("flex justify-between", locked && "text-rose-400")}>
                      <span className="text-zinc-500">Требует репутации</span>
                      <b>{o.minReputation} {locked && `(у вас ${game.reputation})`}</b>
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="mt-auto w-full"
                    variant={locked ? "outline" : "default"}
                    disabled={locked}
                    onClick={() => doSign(o.id)}
                  >
                    {locked ? "Репутация мала" : "Подписать контракт"}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Билеты и мерч */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-zinc-800 bg-zinc-900/70">
          <CardContent className="space-y-3 p-4">
            <p className="text-sm font-bold uppercase tracking-wider text-zinc-400">🎟 Билетная политика</p>
            <div className="space-y-1 text-sm text-zinc-300">
              <p className="flex justify-between">
                <span className="text-zinc-500">Авто-цена по силе клуба</span>
                <b>{autoPrice} €</b>
              </p>
              <p className="flex justify-between">
                <span className="text-zinc-500">Действующая цена</span>
                <b className={cn(game.ticketPrice != null && "text-emerald-400")}>
                  {curPrice} € {game.ticketPrice == null ? "(авто)" : "(назначена)"}
                </b>
              </p>
              <p className="text-xs text-zinc-500">
                Дороже билет — меньше зрителей: +20% к цене ≈ −27% посещаемости. Ниже авто — аншлаги до +12%.
              </p>
            </div>
            <div className="flex gap-2">
              <Input
                className="h-9 w-28 border-zinc-700 bg-zinc-950 text-sm"
                inputMode="numeric"
                placeholder="8–220 €"
                value={priceDraft}
                onChange={(e) => setPriceDraft(e.target.value.replace(/[^\d]/g, ""))}
              />
              <Button size="sm" className="h-9" onClick={applyPrice}>Применить</Button>
              <Button size="sm" variant="outline" className="h-9" onClick={autoPriceAction}>Авто</Button>
            </div>
            {fin && (
              <p className="text-xs text-zinc-500">
                Прошлый тур: {fin.attendance.toLocaleString("ru-RU")} зрителей, билеты +{fmtMoney(fin.tickets)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900/70">
          <CardContent className="space-y-3 p-4">
            <p className="text-sm font-bold uppercase tracking-wider text-zinc-400">👕 Мерчандайзинг</p>
            {fin ? (
              <div className="space-y-1 text-sm text-zinc-300">
                <p className="flex justify-between"><span className="text-zinc-500">Доход за прошлый тур</span><Money value={fin.merch} /></p>
                <p className="flex justify-between"><span className="text-zinc-500">Уровень фан-шопа</span><b>{game.facilities.shop}/5</b></p>
                <p className="flex justify-between">
                  <span className="text-zinc-500">Престиж лиги</span>
                  <b>{prestige.toFixed(1)} / 100</b>
                </p>
                <p className="text-xs text-zinc-500">
                  Мерч растёт от фан-шопа (Инфраструктура), репутации клуба и престижа {leagueName}.
                </p>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Отчёт появится после первого тура.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* FFP-статус */}
      <Card className="border-zinc-800 bg-zinc-900/70">
        <CardContent className="space-y-2 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold uppercase tracking-wider text-zinc-400">⚖ Финансовый fair play</p>
            <span
              className={cn(
                "rounded-md px-2 py-0.5 text-xs font-bold",
                zone === "ok" && "bg-emerald-600/20 text-emerald-400",
                zone === "warn" && "bg-amber-500/20 text-amber-400",
                zone === "danger" && "bg-rose-600/20 text-rose-400",
              )}
            >
              {zone === "ok" ? "Норма" : zone === "warn" ? "Предупреждение" : "Угроза санкций"}
            </span>
          </div>
          {fin && (
            <div className="space-y-1 text-sm text-zinc-300">
              <p className="flex justify-between">
                <span className="text-zinc-500">Ведомость (игроки + штат)</span>
                <Money value={-(fin.payroll + (fin.staff ?? 0))} />
              </p>
              <p className="flex justify-between">
                <span className="text-zinc-500">Доходы за тур</span>
                <Money value={fin.tickets + fin.merch + fin.sponsors + fin.tv + fin.bonus} />
              </p>
              <p className="text-xs text-zinc-500">
                Правило: ведомость ≤ 115% доходов — норма; &gt; 125% при пустом бюджете — предупреждение;
                &gt; 145% при минусе — штраф 1,5 млн € и запрет покупок на 6 туров.
              </p>
            </div>
          )}
          {(game.ffpBanRounds ?? 0) > 0 && (
            <p className="rounded-lg border border-rose-900/50 bg-rose-950/20 px-3 py-2 text-sm font-bold text-rose-300">
              ⚖ Действует санкция: запрет покупок и аренд ещё {game.ffpBanRounds} тур(ов).
            </p>
          )}
          {fin && (fin.payroll + (fin.staff ?? 0)) > teamPayroll(team) + 0 && (
            <p className="text-xs text-zinc-600">Подсказка: продажи игроков снижают ведомость мгновенно.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
