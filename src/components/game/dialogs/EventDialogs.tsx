"use client";

/**
 * Диалоги событий: предложение ИИ, отчёт сезона, увольнение.
 */

import { useGameStore } from "@/game/store/gameStore";
import { userTeam } from "@/game/core/state";
import { fmtMoney } from "@/game/core/money";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/** Предложение ИИ-клуба о покупке вашего игрока */
export function AiOfferDialog() {
  const game = useGameStore((s) => s.game)!;
  const aiOffer = useGameStore((s) => s.aiOffer);
  const respond = useGameStore((s) => s.respondAiOffer);

  if (!aiOffer) return null;
  const player = userTeam(game).players.find((p) => p.id === aiOffer.playerId);
  if (!player) return null;

  return (
    <Dialog open onOpenChange={() => respond("refuse")}>
      <DialogContent aria-describedby={undefined} className="border-zinc-800 bg-zinc-900 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>💰 Предложение о покупке</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-zinc-300">
            «<b className="text-emerald-400">{aiOffer.buyer}</b>» хочет купить{" "}
            <b className="text-zinc-100">{player.name}</b> [{player.pos}] • рейтинг {player.ability} •{" "}
            {player.contractYears} г.
          </p>
          <p className="rounded-lg bg-zinc-950/60 p-3 text-center">
            Сумма: <b className="text-lg text-amber-300">{fmtMoney(aiOffer.fee)}</b>
          </p>
          <div className="grid grid-cols-3 gap-2 pt-1">
            <Button className="bg-emerald-600 hover:bg-emerald-500" onClick={() => respond("accept")}>
              Принять
            </Button>
            <Button variant="outline" className="border-zinc-700" onClick={() => respond("refuse")}>
              Отклонить
            </Button>
            <Button
              variant="outline"
              className="border-amber-700 text-amber-400 hover:bg-amber-950"
              onClick={() => respond("counter")}
            >
              +15%
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Церемония конца сезона */
export function SeasonReportDialog() {
  const report = useGameStore((s) => s.seasonReport);
  const close = useGameStore((s) => s.closeSeasonReport);
  const acceptJobOffer = useGameStore((s) => s.acceptJobOffer);
  if (!report) return null;

  const placeColor =
    report.place === 1
      ? "text-amber-400"
      : report.place <= 3
        ? "text-emerald-400"
        : report.place <= 8
          ? "text-zinc-200"
          : "text-rose-400";

  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent aria-describedby={undefined} className="border-amber-900/50 bg-zinc-900 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">🏁 Конец сезона {report.season}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <p className="text-center text-lg">
            🥇 Чемпион {report.leagueName}: <b className="text-amber-400">«{report.champion}»</b>
          </p>
          <p className="text-center">
            Ваше место:{" "}
            <b className={placeColor}>
              {report.place} из {report.teamsCount}
            </b>
          </p>
          <p className="text-center text-zinc-400">
            🏆 Призовые: <b className="text-emerald-400">{fmtMoney(report.prize)}</b> • Бюджет:{" "}
            <b className="text-emerald-400">{fmtMoney(report.budget)}</b>
          </p>
          {report.topScorer && (
            <p className="text-center text-zinc-300">
              👑 Лучший бомбардир: <b>{report.topScorer.name}</b> — {report.topScorer.goals} гол(ов)
            </p>
          )}
          {report.cupChampion && (
            <p className="text-center text-zinc-300">
              🏆 Обладатель Кубка: <b className="text-amber-400">«{report.cupChampion}»</b>
            </p>
          )}
          {report.uelChampion && (
            <p className="text-center text-zinc-300">
              🟠 Лига Европы: <b className="text-amber-400">«{report.uelChampion}»</b>
            </p>
          )}
          {report.uclChampion && (
            <p className="text-center text-zinc-300">
              🌍 Лига чемпионов: <b className="text-amber-400">«{report.uclChampion}»</b>
            </p>
          )}

          <div className="rounded-lg bg-zinc-950/60 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Отчёт совету директоров
            </p>
            <div className="space-y-1">
              {report.objectiveChecks.map(({ obj, ok }) => (
                <p key={obj.id} className={ok ? "text-emerald-400" : "text-rose-400"}>
                  {ok ? "✓" : "✗"} {obj.text}
                </p>
              ))}
            </div>
            <p className="mt-2 border-t border-zinc-800 pt-2 text-zinc-400">{report.boardMessage}</p>
          </div>

          {report.jobOffer && (
            <div className="rounded-lg border border-sky-800/60 bg-sky-950/30 p-3">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-sky-400">
                📜 Приглашение от клуба
              </p>
              <p className="text-zinc-300">
                «<b className="text-sky-300">{report.jobOffer.club}</b>» ({report.jobOffer.leagueName}, сила
                состава {report.jobOffer.power}) предлагает вам контракт. Принять — значит начать новый
                проект: доверие совета сбрасывается, задачи будут новыми.
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button
                  className="bg-sky-600 font-bold hover:bg-sky-500"
                  onClick={() => acceptJobOffer({ club: report.jobOffer!.club })}
                >
                  Принять приглашение
                </Button>
                <Button variant="outline" className="border-zinc-700" onClick={close}>
                  Остаться в клубе
                </Button>
              </div>
            </div>
          )}

          {!report.jobOffer && (
            <Button className="w-full bg-emerald-600 font-bold hover:bg-emerald-500" onClick={close}>
              Начать сезон {report.newSeason} 🎉
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Увольнение */
export function GameOverDialog() {
  const gameOver = useGameStore((s) => s.gameOver);
  const restart = useGameStore((s) => s.restart);
  const wipeSave = useGameStore((s) => s.wipeSave);
  if (!gameOver) return null;

  return (
    <Dialog open>
      <DialogContent aria-describedby={undefined} className="border-rose-900/50 bg-zinc-900 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl text-rose-400">⚠ Карьера завершена</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <p className="text-zinc-300">{gameOver.message}</p>
          <p className="text-zinc-500">
            Совет директоров отправил вас в отставку. История карьеры сохранена в архиве.
          </p>
          <Button
            className="w-full bg-emerald-600 font-bold hover:bg-emerald-500"
            onClick={() => {
              wipeSave();
              restart();
            }}
          >
            🌟 Новая карьера
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
