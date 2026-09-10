"use client";

/**
 * Игровая оболочка в стиле FIFA Manager:
 *  — верхний статус-бар клуба (крупные читаемые чипы);
 *  — горизонтальное меню с выпадающими разделами (Клуб / Команда /
 *    Менеджмент / Ещё) — как в классических менеджерах;
 *  — на мобильных: фиксированная нижняя панель + выдвижное меню «Ещё».
 */

import { useEffect, useState } from "react";
import { useGameStore, type ScreenId } from "@/game/store/gameStore";
import { userTeam, userPlace, userLeagueName } from "@/game/core/state";
import { fmtMoney } from "@/game/core/money";
import { teamPayroll } from "@/game/core/team";
import { unreadMailCount } from "@/game/systems/mail";
import { reputationLabel, trustLabel } from "@/game/systems/career";
import { DIFFICULTY_INFO } from "@/game/core/types";
import { transferWindowAt, transferWindowLabel } from "@/game/systems/market";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import { StartScreen } from "./screens/StartScreen";
import { DashboardScreen } from "./screens/DashboardScreen";
import { SquadScreen } from "./screens/SquadScreen";
import { TrainingScreen } from "./screens/TrainingScreen";
import { TransfersScreen } from "./screens/TransfersScreen";
import { CareerScreen } from "./screens/CareerScreen";
import { CupScreen } from "./screens/CupScreen";
import { MailScreen } from "./screens/MailScreen";
import { TableScreen } from "./screens/TableScreen";
import { StatsScreen } from "./screens/StatsScreen";
import { CalendarScreen } from "./screens/CalendarScreen";
import { ArchiveScreen } from "./screens/ArchiveScreen";
import { FinancesScreen } from "./screens/FinancesScreen";
import { SponsorsScreen } from "./screens/SponsorsScreen";
import { StaffScreen } from "./screens/StaffScreen";
import { FacilitiesScreen } from "./screens/FacilitiesScreen";
import { NewsScreen } from "./screens/NewsScreen";
import { MatchScreen } from "./screens/MatchScreen";
import { TeamLogo } from "./ui/logos";
import { PlayerProfileDialog } from "./dialogs/PlayerProfileDialog";
import { NegotiationDialog } from "./dialogs/NegotiationDialog";
import { PressConferenceDialog } from "./dialogs/PressConferenceDialog";
import { AiOfferDialog, SeasonReportDialog, GameOverDialog } from "./dialogs/EventDialogs";

interface NavItem {
  id: ScreenId;
  icon: string;
  label: string;
  hint?: string;
}

const NAV_GROUPS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "Клуб",
    items: [
      { id: "dashboard", icon: "🏠", label: "Обзор", hint: "сводка клуба и матч тура" },
      { id: "news", icon: "📰", label: "Новости", hint: "лента медиа вокруг клуба" },
      { id: "calendar", icon: "📅", label: "Календарь", hint: "все турниры по месяцам" },
      { id: "table", icon: "📊", label: "Таблица", hint: "турнирное положение" },
    ],
  },
  {
    title: "Команда",
    items: [
      { id: "squad", icon: "📋", label: "Состав", hint: "11 на матч и ротация" },
      { id: "training", icon: "🏋", label: "Тренировка", hint: "недельный цикл" },
      { id: "stats", icon: "⚽", label: "Статистика", hint: "бомбардиры и карточки" },
      { id: "staff", icon: "👔", label: "Персонал", hint: "штаб специалистов" },
    ],
  },
  {
    title: "Менеджмент",
    items: [
      { id: "transfers", icon: "💰", label: "Трансферы", hint: "окна, покупки и продажи" },
      { id: "finances", icon: "🏦", label: "Финансы", hint: "бюджет и отчёты" },
      { id: "sponsors", icon: "🤝", label: "Спонсоры", hint: "контракты, мерч, билеты" },
      { id: "facilities", icon: "🏟", label: "Инфраструктура", hint: "стадион, база, академия" },
      { id: "career", icon: "🎖", label: "Карьера", hint: "совет, цели, история" },
    ],
  },
  {
    title: "Ещё",
    items: [
      { id: "cup", icon: "🏆", label: "Кубки", hint: "нац. кубки, ЛЧ и ЛЕ" },
      { id: "mail", icon: "✉", label: "Почта", hint: "уведомления клуба" },
      { id: "archive", icon: "📂", label: "Архив", hint: "прошлые сезоны" },
    ],
  },
];

const MOBILE_MAIN: NavItem[] = [
  { id: "dashboard", icon: "🏠", label: "Обзор" },
  { id: "squad", icon: "📋", label: "Состав" },
  { id: "transfers", icon: "💰", label: "Трансферы" },
  { id: "table", icon: "📊", label: "Таблица" },
];

function UnreadBadge({ unread }: { unread: number }) {
  return (
    <span className="ml-auto rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
      {unread}
    </span>
  );
}

/** Кнопка навигации (сайдбар / выдвижное меню) */
function NavButton({
  item,
  active,
  unread,
  onSelect,
}: {
  item: NavItem;
  active: boolean;
  unread: number;
  onSelect: (id: ScreenId) => void;
}) {
  return (
    <button
      className={cn(
        "group flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left text-[15px] font-medium transition-all",
        active
          ? "bg-emerald-500/15 text-emerald-300 shadow-[inset_3px_0_0_0_theme(colors.emerald.400)]"
          : "text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-100",
      )}
      onClick={() => onSelect(item.id)}
      aria-current={active ? "page" : undefined}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-base transition-colors",
          active ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-800/80 group-hover:bg-zinc-700/70",
        )}
      >
        {item.icon}
      </span>
      {item.label}
      {item.id === "mail" && unread > 0 && <UnreadBadge unread={unread} />}
    </button>
  );
}

export function GameShell() {
  const game = useGameStore((s) => s.game);
  const screen = useGameStore((s) => s.screen);
  const setScreen = useGameStore((s) => s.setScreen);
  const save = useGameStore((s) => s.save);
  const toastMessage = useGameStore((s) => s.toastMessage);
  const restart = useGameStore((s) => s.restart);
  const liveMatch = useGameStore((s) => s.liveMatch);
  const [moreOpen, setMoreOpen] = useState(false);

  // Сброс одноразового тоста
  useEffect(() => {
    if (toastMessage) {
      if (toastMessage.kind === "success") toast.success(toastMessage.message);
      else if (toastMessage.kind === "error") toast.error(toastMessage.message);
      else toast.info(toastMessage.message);
      useGameStore.setState({ toastMessage: null });
    }
  }, [toastMessage]);

  if (!game) {
    return (
      <>
        <StartScreen />
        <Toaster position="top-center" richColors />
      </>
    );
  }

  const team = userTeam(game);
  const unread = unreadMailCount(game);

  const go = (id: ScreenId) => {
    if (liveMatch && id !== "match") {
      toast.info("Идёт матч — завершите трансляцию");
      setMoreOpen(false);
      return;
    }
    setScreen(id);
    setMoreOpen(false);
  };

  const window_ = transferWindowAt(game.round);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Статус-бар */}
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-nowrap items-center gap-x-3 gap-y-1.5 overflow-x-auto px-4 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            className="flex shrink-0 items-center gap-2 font-black tracking-tight"
            onClick={() => go("dashboard")}
            title="На главную"
          >
            <span className="text-xl">⚽</span>
            <span className="hidden text-sm sm:inline">
              FM<span className="text-emerald-400">L</span>
            </span>
          </button>

          <div className="mr-1 flex shrink-0 items-baseline gap-2">
            <span className="hidden shrink-0 self-center sm:inline">
              <TeamLogo name={team.name} size={26} />
            </span>
            <span className="text-[15px] font-bold text-emerald-400">«{team.name}»</span>
            <span className="hidden text-xs font-medium text-zinc-500 lg:inline">
              {userLeagueName(game)}
            </span>
          </div>

          {game.moneyCheat && (
            <StatusChip className="border-amber-400/40 bg-amber-400/10 font-bold text-amber-300" title="Режим песочницы: бесконечные деньги">
              💰 ∞
            </StatusChip>
          )}
          {window_ !== "closed" ? (
            <StatusChip
              className="border-emerald-500/40 bg-emerald-500/10 font-bold text-emerald-300"
              title="Трансферное окно открыто: покупки, продажи и аренды доступны"
            >
              🛒 {transferWindowLabel(window_)}
            </StatusChip>
          ) : (
            <StatusChip className="hidden lg:inline-flex" title="Трансферные окна: в начале сезона и у середины">
              🔒 Окно закрыто
            </StatusChip>
          )}
          {game.difficulty !== "normal" && (
            <StatusChip
              className={cn(
                "font-bold",
                game.difficulty === "easy" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
                game.difficulty === "hard" && "border-amber-500/40 bg-amber-500/10 text-amber-300",
                game.difficulty === "legend" && "border-rose-500/40 bg-rose-500/10 text-rose-300",
              )}
            >
              {DIFFICULTY_INFO[game.difficulty].label}
            </StatusChip>
 )}

          {(game.ffpBanRounds ?? 0) > 0 && (
            <StatusChip
              className="border-rose-500/40 bg-rose-500/10 font-bold text-rose-300"
              title="FFP-санкции: покупки и аренды запрещены"
            >
              ⚖ Бан трансферов: {game.ffpBanRounds}
            </StatusChip>
          )}
          {game.boardUltimatum && (
            <StatusChip
              className="border-rose-500/40 bg-rose-500/10 font-bold text-rose-300"
              title={`Ультиматум совета: ${game.boardUltimatum.text}`}
            >
              ⚠ Ультиматум: {game.boardUltimatum.roundsLeft} тур.
            </StatusChip>
          )}

          <StatusChip>
            Сезон <b className="text-zinc-200">{game.season}</b> • Тур{" "}
            <b className="text-zinc-200">
              {Math.min(game.round + 1, game.schedule.length)}/{game.schedule.length}
            </b>
          </StatusChip>
          <StatusChip>
            Место <b className="text-zinc-200">{userPlace(game)}</b>
          </StatusChip>
          <StatusChip className="border-amber-500/30 bg-amber-500/10 text-amber-300">
            {fmtMoney(team.budget)}
          </StatusChip>
          <StatusChip className="hidden sm:inline-flex" title="Зарплаты в тур">
            💸 <b className="text-zinc-200">{fmtMoney(-teamPayroll(team))}</b>
          </StatusChip>
          <StatusChip className="hidden md:inline-flex" title={trustLabel(game.boardTrust)}>
            🏛 Доверие <b className="text-zinc-200">{game.boardTrust}</b>
          </StatusChip>
          <StatusChip className="hidden md:inline-flex" title={reputationLabel(game.reputation)}>
            🎖 Репутация <b className="text-zinc-200">{game.reputation}</b>
          </StatusChip>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 pl-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-[13px] text-zinc-400 hover:text-emerald-400"
              onClick={() => {
                const res = save();
                if (res.ok) toast.success(res.message);
                else toast.error(res.message);
              }}
            >
              💾 <span className="hidden sm:inline">Сохранить</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-[13px] text-zinc-500 hover:text-rose-400"
              onClick={() => {
                if (liveMatch) {
                  toast.info("Идёт матч — завершите трансляцию");
                  return;
                }
                if (window.confirm("Выйти в главное меню? Прогресс сохранён в сейве.")) {
                  save();
                  restart();
                }
              }}
            >
              ⏏ <span className="hidden sm:inline">Выход</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-4">
        {/* Верхнее меню с выпадающими разделами (десктоп) */}
        <nav
          className="mb-4 hidden h-fit items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/60 px-2 py-1.5 md:flex"
          aria-label="Разделы игры"
        >
          {NAV_GROUPS.map((group) => {
            const active = group.items.some((i) => i.id === screen);
            return (
              <DropdownMenu key={group.title}>
                <DropdownMenuTrigger
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-4 py-2 text-[15px] font-bold uppercase tracking-wide transition-colors outline-none",
                    active
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "text-zinc-300 hover:bg-zinc-800/70 hover:text-zinc-100",
                  )}
                >
                  {group.title}
                  <span className="text-xs text-zinc-500">▾</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  sideOffset={8}
                  align="start"
                  className="w-72 border-zinc-800 bg-zinc-900 p-2"
                >
                  <DropdownMenuLabel className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
                    {group.title}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-zinc-800" />
                  {group.items.map((item) => (
                    <DropdownMenuItem
                      key={item.id}
                      onClick={() => go(item.id)}
                      className={cn(
                        "cursor-pointer gap-3 rounded-lg px-3 py-2.5 focus:bg-zinc-800",
                        screen === item.id && "bg-emerald-500/10",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-lg",
                          screen === item.id ? "bg-emerald-500/20" : "bg-zinc-800/80",
                        )}
                      >
                        {item.icon}
                      </span>
                      <span className="min-w-0">
                        <span
                          className={cn(
                            "block text-[15px] font-semibold",
                            screen === item.id ? "text-emerald-300" : "text-zinc-100",
                          )}
                        >
                          {item.label}
                          {item.id === "mail" && unread > 0 && (
                            <span className="ml-2 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                              {unread}
                            </span>
                          )}
                        </span>
                        {item.hint && (
                          <span className="block truncate text-xs text-zinc-500">{item.hint}</span>
                        )}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })}
          <div className="ml-auto flex items-center gap-2 pr-1 text-xs text-zinc-500">
            <span>Сезон {game.season}</span>
            <span className="text-zinc-700">•</span>
            <span>
              Тур {Math.min(game.round + 1, game.schedule.length)}/{game.schedule.length}
            </span>
          </div>
        </nav>

        {/* Контент */}
        <main className="min-w-0 pb-20 md:pb-0">
          {screen === "dashboard" && <DashboardScreen />}
          {screen === "squad" && <SquadScreen />}
          {screen === "training" && <TrainingScreen />}
          {screen === "transfers" && <TransfersScreen />}
          {screen === "career" && <CareerScreen />}
          {screen === "cup" && <CupScreen />}
          {screen === "mail" && <MailScreen />}
          {screen === "table" && <TableScreen />}
          {screen === "stats" && <StatsScreen />}
          {screen === "calendar" && <CalendarScreen />}
          {screen === "archive" && <ArchiveScreen />}
          {screen === "finances" && <FinancesScreen />}
          {screen === "sponsors" && <SponsorsScreen />}
          {screen === "staff" && <StaffScreen />}
          {screen === "facilities" && <FacilitiesScreen />}
          {screen === "news" && <NewsScreen />}
          {screen === "match" && <MatchScreen />}
        </main>
      </div>

      {/* Нижняя навигация (мобильные) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur md:hidden"
        aria-label="Быстрая навигация"
      >
        <div className="mx-auto flex max-w-xl items-stretch justify-between px-2 py-1.5">
          {MOBILE_MAIN.map((item) => (
            <button
              key={item.id}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[11px] font-medium transition-colors",
                screen === item.id ? "text-emerald-400" : "text-zinc-500 hover:text-zinc-300",
              )}
              onClick={() => go(item.id)}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              {item.label}
            </button>
          ))}
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger asChild>
              <button
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[11px] font-medium transition-colors",
                  moreOpen ? "text-emerald-400" : "text-zinc-500 hover:text-zinc-300",
                )}
              >
                <span className="relative text-lg leading-none">
                  ⋯
                  {unread > 0 && (
                    <span className="absolute -right-2 -top-1 h-2 w-2 rounded-full bg-emerald-500" />
                  )}
                </span>
                Ещё
              </button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-72 overflow-y-auto border-zinc-800 bg-zinc-950 p-3"
            >
              <SheetHeader className="px-1 pb-2 pt-0 text-left">
                <SheetTitle className="text-base text-zinc-100">Все разделы</SheetTitle>
              </SheetHeader>
              <div className="space-y-3">
                {NAV_GROUPS.map((group) => (
                  <div key={group.title}>
                    <p className="mb-1 px-2 text-[11px] font-bold uppercase tracking-widest text-zinc-600">
                      {group.title}
                    </p>
                    {group.items
                      .filter((i) => !MOBILE_MAIN.some((m) => m.id === i.id))
                      .map((item) => (
                        <NavButton
                          key={item.id}
                          item={item}
                          active={screen === item.id}
                          unread={unread}
                          onSelect={go}
                        />
                      ))}
                  </div>
                ))}
                {/* Пустая группа-заглушка не нужна; кнопка «Обзор» для полноты */}
                <div className="border-t border-zinc-800 pt-2">
                  {MOBILE_MAIN.slice(0, 1).map((item) => (
                    <NavButton
                      key={item.id}
                      item={item}
                      active={screen === item.id}
                      unread={unread}
                      onSelect={go}
                    />
                  ))}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>

      {/* Диалоги */}
      <PlayerProfileDialog />
      <NegotiationDialog />
      <PressConferenceDialog />
      <AiOfferDialog />
      <SeasonReportDialog />
      <GameOverDialog />

      <Toaster position="top-center" richColors />
    </div>
  );
}

/** Чип статуса в шапке */
function StatusChip({
  children,
  className,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-zinc-800 bg-zinc-900/80 px-2 py-1 text-xs font-medium text-zinc-400",
        className,
      )}
    >
      {children}
    </span>
  );
}
