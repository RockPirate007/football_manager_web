"use client";

/**
 * Дашборд: сводка, матч тура, задачи, кнопка игры тура.
 * Таблицы и места считаются внутри лиги пользователя.
 */

import { useState } from "react";
import { useGameStore } from "@/game/store/gameStore";
import { userTeam, userPlace, sortedLeagueTable, userLeagueId, userLeagueName, leagueTeams } from "@/game/core/state";
import { fmtMoney } from "@/game/core/money";
import { teamPayroll } from "@/game/core/team";
import { cupStageName, cupDueRound, activeCups } from "@/game/systems/cup";
import { UCL_KEY } from "@/game/data/leagues";
import { userCallups, windowAt, tournamentName, internationalWindows } from "@/game/systems/international";
import { latestNews } from "@/game/systems/news";
import { FACILITY_META } from "@/game/core/types";
import { DIFFICULTY_INFO } from "@/game/core/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { SectionTitle, Money } from "../ui/game-ui";
import { TeamLogo } from "../ui/logos";

export function DashboardScreen() {
  const game = useGameStore((s) => s.game)!;
  const playRoundAction = useGameStore((s) => s.playRoundAction);
  const save = useGameStore((s) => s.save);
  const lastRound = useGameStore((s) => s.lastRound);
  const setScreen = useGameStore((s) => s.setScreen);
  const [watchOpen, setWatchOpen] = useState(false);

  const team = userTeam(game);
  const place = userPlace(game);
  const leagueSize = leagueTeams(game, userLeagueId(game)).length;
  const leagueName = userLeagueName(game);
  const seasonOver = game.round >= game.schedule.length;

  // Международные вызовы: игроки клуба в сборных
  const callups = userCallups(game);
  const intWindows = internationalWindows(game.schedule?.length || 34);
  const upcomingWindow = intWindows.friendly.concat(intWindows.tournament).find((r) => r > game.round);
  const windowKind = upcomingWindow !== undefined ? windowAt(upcomingWindow) : null;

  // Матч тура — только матчи лиги пользователя
  const roundFixtures = game.schedule[Math.min(game.round, game.schedule.length - 1)] ?? [];
  const leagueNames = new Set(leagueTeams(game, userLeagueId(game)).map((t) => t.name));
  const nextFixture =
    roundFixtures.find(([h, a]) => leagueNames.has(h) && leagueNames.has(a) && (h === game.user || a === game.user)) ?? null;

  // Кубки с матчем пользователя в текущей стадии
  const activeCupsWithUser = activeCups(game).filter(([, cup]) =>
    cup.fixtures.some(([a, b]) => a === game.user || b === game.user),
  );
  const uclActive = activeCupsWithUser.some(([key]) => key === UCL_KEY);

  const doPlay = (watch: boolean) => {
    setWatchOpen(false);
    if (seasonOver) {
      playRoundAction(false);
      return;
    }
    playRoundAction(watch);
  };

  const doSave = () => {
    const res = save();
    if (res.ok) toast.success(res.message);
    else toast.error(res.message);
  };

  return (
    <div className="space-y-5">
      {/* Статус-карточки */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="border-zinc-800 bg-zinc-900/70">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Сезон • Тур</p>
            <p className="mt-1 text-xl font-bold">
              {game.season} •{" "}
              {seasonOver ? "финал" : `${Math.min(game.round + 1, game.schedule.length)}/${game.schedule.length}`}
            </p>
          </CardContent>
        </Card>
        <Card className="border-zinc-800 bg-zinc-900/70">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wider text-zinc-500">{leagueName}</p>
            <p className="mt-1 text-xl font-bold text-emerald-400">{place} из {leagueSize}</p>
          </CardContent>
        </Card>
        <Card className="border-zinc-800 bg-zinc-900/70">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Бюджет</p>
            <p className="mt-1"><Money value={team.budget} /></p>
          </CardContent>
        </Card>
        <Card className="border-zinc-800 bg-zinc-900/70">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Очки (W-D-L)</p>
            <p className="mt-1 text-xl font-bold">
              {team.pts} <span className="text-sm font-normal text-zinc-500">({team.w}-{team.d}-{team.l})</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Ультиматум совета: дедлайн горит */}
      {game.boardUltimatum && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-rose-800/60 bg-rose-950/30 px-4 py-3">
          <span className="text-lg">⚠</span>
          <p className="min-w-0 text-sm font-bold text-rose-300">
            Ультиматум совета: {game.boardUltimatum.text}
          </p>
          <p className="ml-auto text-sm font-black text-rose-200">
            Осталось туров: {game.boardUltimatum.roundsLeft}
          </p>
        </div>
      )}

      {/* Матч тура */}
      <Card className="border-emerald-900/40 bg-gradient-to-br from-emerald-950/40 to-zinc-900">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {seasonOver ? "🏁 Сезон завершён" : nextFixture ? "🎯 Матч тура" : "Календарь"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {nextFixture && !seasonOver && (
            <div className="flex items-center gap-3">
              <TeamLogo name={nextFixture[0]} size={34} />
              <p className="min-w-0 text-lg font-semibold">
                <span className="truncate">{nextFixture[0]}</span> <span className="text-zinc-500">—</span>{" "}
                <span className="truncate">{nextFixture[1]}</span>
              </p>
              <TeamLogo name={nextFixture[1]} size={34} />
              {nextFixture[0] === game.user && (
                <span className="ml-auto shrink-0 text-xs font-normal text-emerald-400">(дома)</span>
              )}
              {nextFixture[1] === game.user && (
                <span className="ml-auto shrink-0 text-xs font-normal text-amber-400">(в гостях)</span>
              )}
            </div>
          )}
          {activeCupsWithUser.map(([key, cup]) => (
            <p key={key} className="text-sm text-amber-400">
              🏆 {key === UCL_KEY ? "Лига чемпионов" : cup.name}: ваш матч ({cupStageName(cup.stageSize)})
              {cupDueRound(key, game.round + 1) && " — сыграйте раунд в разделе «Кубок»"}
            </p>
          ))}
          <div className="flex flex-wrap gap-3">
            <Button
              size="lg"
              className="flex-1 bg-emerald-600 font-bold hover:bg-emerald-500 sm:flex-none sm:px-8"
              onClick={() => (seasonOver ? doPlay(false) : setWatchOpen(true))}
            >
              {seasonOver ? "🏆 Подвести итоги сезона" : "▶▶ ИГРАТЬ ТУР"}
            </Button>
            <Button size="lg" variant="outline" className="border-zinc-700" onClick={doSave}>
              💾 Сохранить
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Лента новостей и стройка */}
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionTitle hint="смотрите весь раздел «Новости»">📰 Свежие новости</SectionTitle>
          <Card className="border-zinc-800 bg-zinc-900/60">
            <CardContent className="p-0">
              {latestNews(game, 3).map((n, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 border-b border-zinc-800/50 px-4 py-2.5 text-sm last:border-0"
                >
                  <span className="text-base">{n.icon}</span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-zinc-200">{n.title}</p>
                    <p className="truncate text-xs text-zinc-500">{n.text}</p>
                  </div>
                </div>
              ))}
              {game.news.length === 0 && (
                <p className="py-5 text-center text-sm text-zinc-600">Пресса молчит — сыграйте тур</p>
              )}
              <button
                className="w-full px-4 py-2 text-center text-xs text-emerald-500 hover:bg-zinc-800/50"
                onClick={() => setScreen("news")}
              >
                Вся лента →
              </button>
            </CardContent>
          </Card>
        </div>

        <div>
          <SectionTitle hint="апгрейды с эффектами">🏗 Инфраструктура</SectionTitle>
          <Card className="border-zinc-800 bg-zinc-900/60">
            <CardContent className="space-y-2 p-4 text-sm">
              {game.facilities.project ? (
                <p className="text-amber-300">
                  🚧 {FACILITY_META[game.facilities.project.key].label}: до ур. {" "}
                  {game.facilities.project.targetLevel} — ещё {game.facilities.project.roundsLeft} тур(ов)
                </p>
              ) : (
                <p className="text-zinc-500">Строек нет — самое время инвестировать</p>
              )}
              <button
                className="w-full text-center text-xs text-emerald-500 hover:text-emerald-400"
                onClick={() => setScreen("facilities")}
              >
                Открыть раздел →
              </button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Международные сборные */}
      {callups.length > 0 && (
        <div>
          <SectionTitle
            hint={
              upcomingWindow !== undefined
                ? windowKind === "tournament"
                  ? `финал ${tournamentName(game.season)} — тур ${intWindows.tournament + 1}`
                  : `товарищеское окно — тур ${upcomingWindow + 1}`
                : undefined
            }
          >
            🌍 Вызовы в сборные
          </SectionTitle>
          <Card className="border-zinc-800 bg-zinc-900/60">
            <CardContent className="p-0">
              {callups.map(({ player, nation }) => (
                <div
                  key={player.id}
                  className="flex items-center gap-3 border-b border-zinc-800/50 px-4 py-2 text-sm last:border-0"
                >
                  <span className="text-lg">{nation.flag}</span>
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => useGameStore.getState().openProfile(player.id)}
                  >
                    <span className="block truncate font-semibold text-zinc-200">{player.name}</span>
                    <span className="block text-xs text-zinc-500">
                      {player.detail ?? player.pos} • рейтинг {player.ability}
                    </span>
                  </button>
                  <span className="shrink-0 text-xs font-medium text-emerald-400">{nation.name}</span>
                </div>
              ))}
              <p className="px-4 py-2 text-xs text-zinc-500">
                Перед окнами игроки уезжают в сборные — ожидайте лёгкую усталость от перелётов.
                Уведомления приходят на почту.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Задачи совета */}
      <div>
        <SectionTitle hint={`${game.reputation} репутация • ${game.boardTrust} доверие`}>
          Задачи совета
        </SectionTitle>
        <div className="grid gap-2 sm:grid-cols-2">
          {game.objectives.map((o) => (
            <div
              key={o.id}
              className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm"
            >
              <span className={o.critical ? "text-amber-400" : "text-zinc-600"}>
                {o.critical ? "★" : "·"}
              </span>
              <span className="text-zinc-300">{o.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Итоги прошлого тура (лига пользователя) */}
      {lastRound && (
        <div>
          <SectionTitle hint={`тур ${lastRound.round + 1}`}>Итоги тура</SectionTitle>
          <Card className="border-zinc-800 bg-zinc-900/60">
            <CardContent className="space-y-3 p-4">
              <div className="space-y-1">
                {lastRound.results
                  .filter(([h, a]) => leagueNames.has(h) && leagueNames.has(a))
                  .map(([h, a, gh, ga], i) => {
                    const isUser = h === game.user || a === game.user;
                    const my = h === game.user ? gh : ga;
                    const en = h === game.user ? ga : gh;
                    const res = my > en ? "В" : my === en ? "Н" : "П";
                    return (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className={isUser ? "font-semibold text-emerald-300" : "text-zinc-500"}>
                          {h} {gh}:{ga} {a}
                        </span>
                        {isUser && (
                          <span
                            className={
                              res === "В"
                                ? "font-bold text-emerald-400"
                                : res === "Н"
                                  ? "font-bold text-amber-400"
                                  : "font-bold text-rose-400"
                            }
                          >
                            {res}
                          </span>
                        )}
                      </div>
                    );
                  })}
              </div>
              <div className="border-t border-zinc-800 pt-2 text-sm text-zinc-400">
                💵 Доходы <Money value={lastRound.income} colored />{" "}
                <span className="text-zinc-600">•</span> 💸 Зарплаты <Money value={-lastRound.spend} colored />{" "}
                <span className="text-zinc-600">•</span> 🏦 <Money value={lastRound.budget} />
              </div>
              {lastRound.pressLine && <p className="text-sm text-zinc-300">📰 {lastRound.pressLine}</p>}
              <p className="text-sm text-amber-400">👑 {lastRound.leaderLine}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Мини-таблица лиги */}
      <div>
        <SectionTitle>Топ таблицы — {leagueName}</SectionTitle>
        <Card className="border-zinc-800 bg-zinc-900/60">
          <CardContent className="p-0">
            {sortedLeagueTable(game, userLeagueId(game))
              .slice(0, 5)
              .map((t, i) => (
                <div
                  key={t.name}
                  className={`flex items-center justify-between border-b border-zinc-800/50 px-4 py-2 text-sm last:border-0 ${
                    t.name === game.user ? "bg-emerald-500/5 font-semibold text-emerald-300" : ""
                  }`}
                >
                  <span>
                    {i + 1}. {t.name}
                  </span>
                  <span className="text-zinc-400">
                    {t.pts} очк. • {t.w}-{t.d}-{t.l}
                  </span>
                </div>
              ))}
            <button
              className="w-full px-4 py-2 text-center text-xs text-emerald-500 hover:bg-zinc-800/50"
              onClick={() => setScreen("table")}
            >
              Вся таблица →
            </button>
          </CardContent>
        </Card>
      </div>

      {/* Диалог: как смотрим матч */}
      <Dialog open={watchOpen} onOpenChange={setWatchOpen}>
        <DialogContent aria-describedby={undefined} className="border-zinc-800 bg-zinc-900 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Как смотрим матч?</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Button
              className="h-14 bg-emerald-600 text-base font-bold hover:bg-emerald-500"
              onClick={() => doPlay(true)}
            >
              📺 Смотреть трансляцию
            </Button>
            <Button
              variant="outline"
              className="h-14 border-zinc-700 text-base font-bold hover:bg-zinc-800"
              onClick={() => doPlay(false)}
            >
              ⚡ Быстрый результат
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
