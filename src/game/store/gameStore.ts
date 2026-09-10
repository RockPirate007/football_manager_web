"use client";

/**
 * Zustand-стор: единственное место мутации состояния игры.
 * Каждый экшен работает с deep-клоном состояния (структурное
 * клонирование), что даёт честную иммутабельность для React.
 */

import { create } from "zustand";
import type {
  Difficulty,
  Feedback,
  GameState,
  MatchResult,
  Mentality,
  Negotiation,
  RoundSummary,
  SeasonReport,
} from "../core/types";
import { FORMATION_NAMES } from "../data/formations";
import { TACTIC_NAMES } from "../data/tactics";
import { ROLES } from "../data/roles";
import type { TrainingType } from "../systems/training";
import { autoLineup, fixLineup } from "../core/team";
import { assignRole } from "../core/player";
import { createWorld } from "../systems/world";
import { initCareerFields, logHistory, checkBankrupt, generateObjectives } from "../systems/career";
import { generateAcademy } from "../systems/academy";
import { playCupRound } from "../systems/cup";
import { sendMail } from "../systems/mail";
import { runTraining } from "../systems/training";
import { runScouting, assignScoutMission, cancelScoutMission, type ScoutAction } from "../systems/scouting";
import {
  createNegotiation,
  resolveNegotiation,
  renewContract,
  rollAiOffer,
  acceptAiOffer,
} from "../systems/negotiation";
import { sellPlayer, loanIn, loanOut } from "../systems/transfers";
import { playRound } from "../systems/round";
import { endOfSeason } from "../systems/season";
import {
  beginLiveRound,
  beginLiveCup,
  finishLive,
  takeFinishedRound,
  liveSubstitute,
  liveMentality,
  liveTalk,
  liveMinute,
} from "../systems/live";
import { transferWindowOpen, transferWindowAt, transferWindowLabel, seasonLen } from "../systems/market";
import { hireStaff, fireStaff, refreshStaffMarket } from "../systems/staff";
import { answerPress } from "../systems/press";
import { startUpgrade, reinitFacilities } from "../systems/facilities";
import { signSponsorOffer, reinitCommercial } from "../systems/economy";
import { promoteYouthToSquad } from "../systems/academy";
import { setPlayerFocus } from "../systems/training";
import type { FacilityKey, StaffRole, PlayerInstruction, ScoutRegionId, TrainFocus } from "../core/types";
import { hasSave, saveGame, deleteSave, loadGame } from "../persistence/storage";

export type ScreenId =
  | "dashboard"
  | "squad"
  | "training"
  | "transfers"
  | "career"
  | "cup"
  | "mail"
  | "table"
  | "stats"
  | "calendar"
  | "archive"
  | "finances"
  | "staff"
  | "facilities"
  | "sponsors"
  | "news"
  | "match";

export interface AiOfferState {
  playerId: number;
  buyer: string;
  fee: number;
}

/** Контекст турнира для тематического оформления трансляции */
export interface MatchContext {
  kind: "league" | "cup" | "ucl" | "uel";
  /** Ключ турнира (для кубков) */
  key?: string;
}

interface GameStore {
  game: GameState | null;
  screen: ScreenId;
  hasSavedGame: boolean;
  lastMatch: MatchResult | null;
  lastRound: RoundSummary | null;
  seasonReport: SeasonReport | null;
  negotiation: Negotiation | null;
  negotiationContext: { kind: "agent" | "club"; } | null;
  aiOffer: AiOfferState | null;
  gameOver: { message: string } | null;
  toastMessage: Feedback | null;
  profilePlayerId: number | null;
  matchContext: MatchContext | null;
  /** Идёт живой матч (трансляция с управлением) */
  liveMatch: boolean;
  /** Только что завершён живой матч — открыть повтор сразу на статистике */
  matchJumpEnd: boolean;

  // Инициализация
  refreshHasSave: () => void;
  startNewGame: (manager: string, clubName: string, difficulty?: Difficulty, moneyCheat?: boolean) => void;
  continueGame: () => boolean;
  restart: () => void;
  wipeSave: () => void;

  // Навигация
  setScreen: (s: ScreenId) => void;
  closeMatch: () => void;
  closeSeasonReport: () => void;
  openProfile: (playerId: number) => void;
  closeProfile: () => void;

  // Сохранение
  save: () => Feedback;

  // Состав
  squadAutoLineup: () => void;
  setFormation: (f: string) => void;
  setTactic: (t: string) => void;
  changeRole: (playerId: number, role: string) => void;
  substitute: (outId: number, inId: number) => Feedback;
  /** Назначить/снять исполнителя стандарта (v12) */
  setSetPiece: (kind: "freeKick" | "corner", playerId: number | null) => Feedback;
  /** Индивидуальная установка игрока на матч (v12) */
  setInstruction: (playerId: number, instruction: PlayerInstruction | null) => void;

  // Тренировка
  train: (t: TrainingType) => Feedback;

  // Трансферы
  beginAgentNegotiation: (playerId: number) => void;
  beginClubNegotiation: (playerId: number) => void;
  resolveNegotiationChoice: (optionIndex: number) => Feedback;
  cancelNegotiation: () => void;
  sell: (playerId: number) => Feedback;
  takeOnLoan: (playerId: number) => Feedback;
  sendOnLoan: (playerId: number) => Feedback;
  renew: (playerId: number, years: number, agree: boolean) => Feedback;
  checkAiOffers: () => void;
  respondAiOffer: (mode: "accept" | "refuse" | "counter") => void;

  // Карьера
  academyPromote: (playerId: number) => Feedback;
  academyRegen: () => Feedback;
  scout: (action: ScoutAction) => ReturnType<typeof runScouting>;
  /** Региональная миссия скаутов (v12) */
  scoutRegion: (region: ScoutRegionId) => Feedback;
  /** Отменить региональную миссию с возвратом 50% (v12) */
  cancelScoutMissionAction: (missionId: number) => Feedback;
  /** Индивидуальный план тренировок (v12) */
  setTrainFocus: (playerId: number, focus: TrainFocus | null) => Feedback;

  // Кубок
  playCupRoundAction: (cupKey: string, watch: boolean) => Feedback;

  // Матч / тур / сезон
  playRoundAction: (watch: boolean) => void;

  // Живой матч
  finishLiveMatch: () => void;
  liveSub: (outId: number, inId: number) => Feedback;
  liveSetMentality: (m: Mentality) => Feedback;
  liveTeamTalk: (kind: "calm" | "motivate" | "hairdryer") => Feedback;
  liveCurrentMinute: () => number;

  // Персонал
  hireStaffAction: (memberId: number) => Feedback;
  fireStaffAction: (role: StaffRole) => Feedback;

  // Инфраструктура
  buildFacility: (key: FacilityKey) => Feedback;

  // Коммерция (Фаза 3)
  /** Подписать спонсорское предложение */
  signSponsor: (offerId: number) => Feedback;
  /** Цена билета: число или null — «авто» */
  setTicketPrice: (price: number | null) => Feedback;

  // Пресс-конференция
  answerPressAction: (answerIndex: number) => string | null;
  skipPress: () => void;

  // Приглашение в другой клуб
  acceptJobOffer: (offer: { club: string }) => void;
}

/** Глубокий клон состояния (структурное клонирование поддерживает все данные игры) */
function clone(g: GameState): GameState {
  return typeof structuredClone === "function"
    ? structuredClone(g)
    : (JSON.parse(JSON.stringify(g)) as GameState);
}

function fmtMoneyShort(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)} млн €`;
  return `${Math.round(v / 1000)} тыс €`;
}

export const useGameStore = create<GameStore>((set, get) => ({
  game: null,
  screen: "dashboard",
  hasSavedGame: false,
  lastMatch: null,
  lastRound: null,
  seasonReport: null,
  negotiation: null,
  negotiationContext: null,
  aiOffer: null,
  gameOver: null,
  toastMessage: null,
  profilePlayerId: null,
  matchContext: null,
  liveMatch: false,
  matchJumpEnd: false,

  refreshHasSave: () => set({ hasSavedGame: hasSave() }),

  startNewGame: (manager, clubName, difficulty = "normal", moneyCheat = false) => {
    const g = createWorld(manager, clubName, difficulty, moneyCheat);
    saveGame(g);
    set({
      game: g,
      screen: "dashboard",
      lastMatch: null,
      lastRound: null,
      seasonReport: null,
      negotiation: null,
      aiOffer: null,
      gameOver: null,
      hasSavedGame: true,
    });
  },

  continueGame: () => {
    const g = hasSave() ? loadGame() : null;
    if (!g) {
      set({ hasSavedGame: hasSave() });
      return false;
    }
    set({ game: g, screen: "dashboard", gameOver: null });
    return true;
  },

  restart: () => {
    set({ game: null, screen: "dashboard", gameOver: null, lastMatch: null, seasonReport: null });
    get().refreshHasSave();
  },

  wipeSave: () => {
    deleteSave();
    set({ hasSavedGame: false });
  },

  setScreen: (s) => set({ screen: s }),

  closeMatch: () => set({ screen: "dashboard", lastMatch: null, matchContext: null, liveMatch: false, matchJumpEnd: false }),

  closeSeasonReport: () => set({ seasonReport: null }),

  openProfile: (playerId) => set({ profilePlayerId: playerId }),
  closeProfile: () => set({ profilePlayerId: null }),

  save: () => {
    const g = get().game;
    if (!g) return { ok: false, kind: "error", message: "Нет активной игры." };
    const ok = saveGame(g);
    return ok
      ? { ok: true, kind: "success", message: "Игра сохранена" }
      : { ok: false, kind: "error", message: "Ошибка сохранения" };
  },

  squadAutoLineup: () => {
    const g = get().game;
    if (!g) return;
    const ng = clone(g);
    autoLineup(ng.teams[ng.user]);
    set({ game: ng });
  },

  setFormation: (f) => {
    if (!FORMATION_NAMES.includes(f)) return;
    const g = get().game;
    if (!g) return;
    const ng = clone(g);
    const team = ng.teams[ng.user];
    team.formation = f;
    fixLineup(team);
    set({ game: ng });
  },

  setTactic: (t) => {
    if (!TACTIC_NAMES.includes(t)) return;
    const g = get().game;
    if (!g) return;
    const ng = clone(g);
    ng.teams[ng.user].tactic = t;
    set({ game: ng });
  },

  changeRole: (playerId, role) => {
    const g = get().game;
    if (!g) return;
    const ng = clone(g);
    const p = ng.teams[ng.user].players.find((x) => x.id === playerId);
    if (!p || !(role in ROLES[p.pos])) return;
    assignRole(p, role);
    set({ game: ng });
  },

  setSetPiece: (kind, playerId) => {
    const g = get().game;
    if (!g) return { ok: false, kind: "error", message: "Нет игры." };
    const ng = clone(g);
    const team = ng.teams[ng.user];
    if (!team.setPieces) team.setPieces = { freeKick: null, corner: null };
    if (playerId !== null && !team.players.some((p) => p.id === playerId)) {
      return { ok: false, kind: "error", message: "Игрок не найден." };
    }
    team.setPieces[kind] = playerId;
    set({ game: ng });
    const label = kind === "freeKick" ? "Штрафные" : "Угловые";
    const who =
      playerId === null
        ? "исполнитель снят"
        : `исполнитель: ${team.players.find((p) => p.id === playerId)?.name ?? ""}`;
    return { ok: true, kind: "success", message: `${label}: ${who}` };
  },

  setInstruction: (playerId, instruction) => {
    const g = get().game;
    if (!g) return;
    const ng = clone(g);
    const p = ng.teams[ng.user].players.find((x) => x.id === playerId);
    if (!p) return;
    p.instruction = instruction;
    set({ game: ng });
  },

  substitute: (outId, inId) => {
    const g = get().game;
    if (!g) return { ok: false, kind: "error", message: "Нет игры." };
    const ng = clone(g);
    const team = ng.teams[ng.user];
    const outP = team.players.find((x) => x.id === outId);
    const inP = team.players.find((x) => x.id === inId);
    if (!outP || !inP) return { ok: false, kind: "error", message: "Игрок не найден." };
    if (inP.pos !== outP.pos) {
      return { ok: false, kind: "error", message: "Замена возможна только на ту же позицию." };
    }
    const idx = team.lineupIds.indexOf(outId);
    if (idx === -1) return { ok: false, kind: "error", message: "Игрок не в старте." };
    team.lineupIds[idx] = inId;
    return { ok: true, kind: "success", message: `Замена: ${outP.name} → ${inP.name}` };
  },

  train: (t) => {
    const g = get().game;
    if (!g) return { ok: false, kind: "error", message: "Нет игры." };
    if (g.trained) {
      return { ok: false, kind: "warning", message: "На этой неделе тренировка уже проведена." };
    }
    const ng = clone(g);
    const res = runTraining(ng, t);
    ng.trained = true;
    set({ game: ng });
    return res;
  },

  beginAgentNegotiation: (playerId) => {
    const g = get().game;
    if (!g) return;
    if ((g.ffpBanRounds ?? 0) > 0) {
      set({ toastMessage: { ok: false, kind: "warning", message: `FFP: запрет на покупки ещё ${g.ffpBanRounds} тур(ов).` } });
      return;
    }
    const p = g.freeAgents.find((x) => x.id === playerId);
    if (!p) return;
    const signing = Math.max(50_000, Math.floor((p.value * (0.05 + Math.random() * 0.07)) / 1000) * 1000);
    const neg = createNegotiation(g, p, signing, true, null);
    set({ negotiation: neg, negotiationContext: { kind: "agent" } });
  },

  beginClubNegotiation: (playerId) => {
    const g = get().game;
    if (!g) return;
    if ((g.ffpBanRounds ?? 0) > 0) {
      set({ toastMessage: { ok: false, kind: "warning", message: `FFP: санкции — покупки запрещены ещё ${g.ffpBanRounds} тур(ов).` } });
      return;
    }
    if (!transferWindowOpen(g)) {
      set({
        toastMessage: {
          ok: false,
          kind: "warning",
          message: `Трансферное окно закрыто. Покупки возможны в начале сезона и у середины.`,
        },
      });
      return;
    }
    // Найти игрока в чужих клубах и его стоимость
    for (const t of Object.values(g.teams)) {
      if (t.name === g.user) continue;
      const p = t.players.find((x) => x.id === playerId);
      if (p && !p.onLoan) {
        const fee = Math.floor((p.value * (1.15 + Math.random() * 0.3)) / 1000) * 1000;
        const neg = createNegotiation(g, p, fee, false, t.name);
        set({ negotiation: neg, negotiationContext: { kind: "club" } });
        return;
      }
    }
  },

  resolveNegotiationChoice: (optionIndex) => {
    const { game, negotiation } = get();
    if (!game || !negotiation) {
      return { ok: false, kind: "error", message: "Нет активных переговоров." };
    }
    const ng = clone(game);
    const outcome = resolveNegotiation(ng, negotiation, optionIndex);
    set({
      game: ng,
      negotiation: outcome.accepted ? null : negotiation,
      negotiationContext: outcome.accepted ? null : get().negotiationContext,
    });
    return {
      ok: outcome.accepted,
      kind: outcome.accepted ? "success" : "error",
      message: outcome.message,
    };
  },

  cancelNegotiation: () => set({ negotiation: null, negotiationContext: null }),

  sell: (playerId) => {
    const g = get().game;
    if (!g) return { ok: false, kind: "error", message: "Нет игры." };
    if (!transferWindowOpen(g)) {
      return { ok: false, kind: "warning", message: "Трансферное окно закрыто — продажи только в начале сезона и у середины." };
    }
    const ng = clone(g);
    const res = sellPlayer(ng, playerId);
    if (res.ok) set({ game: ng });
    return res;
  },

  takeOnLoan: (playerId) => {
    const g = get().game;
    if (!g) return { ok: false, kind: "error", message: "Нет игры." };
    if ((g.ffpBanRounds ?? 0) > 0) {
      return { ok: false, kind: "warning", message: `FFP: санкции — аренды запрещены ещё ${g.ffpBanRounds} тур(ов).` };
    }
    if (!transferWindowOpen(g)) {
      return { ok: false, kind: "warning", message: "Трансферное окно закрыто — аренды только в окна." };
    }
    const ng = clone(g);
    const res = loanIn(ng, playerId);
    if (res.ok) set({ game: ng });
    return res;
  },

  sendOnLoan: (playerId) => {
    const g = get().game;
    if (!g) return { ok: false, kind: "error", message: "Нет игры." };
    if (!transferWindowOpen(g)) {
      return { ok: false, kind: "warning", message: "Трансферное окно закрыто — аренды только в окна." };
    }
    const ng = clone(g);
    const res = loanOut(ng, playerId);
    if (res.ok) set({ game: ng });
    return res;
  },

  renew: (playerId, years, agree) => {
    const g = get().game;
    if (!g) return { ok: false, kind: "error", message: "Нет игры." };
    const ng = clone(g);
    const res = renewContract(ng, playerId, years, agree);
    if (res.ok) set({ game: ng });
    return res;
  },

  checkAiOffers: () => {
    const g = get().game;
    if (!g) return;
    if (!transferWindowOpen(g)) {
      set({
        toastMessage: {
          ok: false,
          kind: "warning",
          message: "Окно закрыто: клубы не покупают игроков вне трансферных окон.",
        },
      });
      return;
    }
    const ng = clone(g);
    const offer = rollAiOffer(ng);
    if (offer) set({ game: ng, aiOffer: offer });
    else set({ toastMessage: { ok: true, kind: "info", message: "Пока предложений нет." } });
  },

  respondAiOffer: (mode) => {
    const { game, aiOffer } = get();
    if (!game || !aiOffer) return;
    if (mode !== "refuse" && !transferWindowOpen(game)) {
      set({
        toastMessage: {
          ok: false,
          kind: "warning",
          message: "Окно закрыто — сделку нельзя совершить.",
        },
      });
      return;
    }
    const ng = clone(game);

    if (mode === "refuse") {
      set({ game: ng, aiOffer: null });
      return;
    }

    if (mode === "counter") {
      // Запросить +15%: 40% шанс отказа клуба, иначе продажа по новой цене
      const bumped = Math.floor(aiOffer.fee * 1.15 / 1000) * 1000;
      if (Math.random() < 0.4) {
        set({ game: ng, aiOffer: null, toastMessage: { ok: false, kind: "error", message: "Клуб не готов платить больше." } });
        return;
      }
      acceptAiOffer(ng, { ...aiOffer, fee: bumped });
      set({
        game: ng,
        aiOffer: null,
        toastMessage: { ok: true, kind: "success", message: `Согласились на ${fmtMoneyShort(bumped)}` },
      });
      return;
    }

    const res = acceptAiOffer(ng, { ...aiOffer });
    set({ game: ng, aiOffer: null, toastMessage: res });
  },

  academyPromote: (playerId) => {
    const g = get().game;
    if (!g) return { ok: false, kind: "error", message: "Нет игры." };
    const ng = clone(g);
    const res = promoteYouthToSquad(ng, playerId);
    if (res.ok) {
      fixLineup(ng.teams[ng.user]);
      ng.reputation = Math.min(100, ng.reputation + 1);
      set({ game: ng });
    }
    return res;
  },

  academyRegen: () => {
    const g = get().game;
    if (!g) return { ok: false, kind: "error", message: "Нет игры." };
    const ng = clone(g);
    const team = ng.teams[ng.user];
    if (team.budget < 150_000) {
      return { ok: false, kind: "error", message: "Нужно 150 тыс €." };
    }
    team.budget -= 150_000;
    generateAcademy(ng, 5 + Math.floor(Math.random() * 4));
    logHistory(ng, "Обновление академии");
    return { ok: true, kind: "success", message: "Набор завершён." };
  },

  scout: (action) => {
    const g = get().game;
    if (!g) return { ok: false, kind: "error", message: "Нет игры." };
    const ng = clone(g);
    const res = runScouting(ng, action);
    set({ game: ng });
    return res;
  },

  scoutRegion: (region) => {
    const g = get().game;
    if (!g) return { ok: false, kind: "error", message: "Нет игры." };
    const ng = clone(g);
    const err = assignScoutMission(ng, region);
    if (err) return { ok: false, kind: "warning", message: err };
    set({ game: ng });
    return { ok: true, kind: "success", message: "Скауты отправились в регион — отчёт через несколько туров." };
  },

  cancelScoutMissionAction: (missionId) => {
    const g = get().game;
    if (!g) return { ok: false, kind: "error", message: "Нет игры." };
    const ng = clone(g);
    const res = cancelScoutMission(ng, missionId);
    if (res.ok) set({ game: ng });
    return res;
  },

  setTrainFocus: (playerId, focus) => {
    const g = get().game;
    if (!g) return { ok: false, kind: "error", message: "Нет игры." };
    const ng = clone(g);
    const err = setPlayerFocus(ng, playerId, focus);
    if (err) return { ok: false, kind: "warning", message: err };
    set({ game: ng });
    return { ok: true, kind: "success", message: focus ? "Индивидуальный план обновлён" : "План снят" };
  },

  playCupRoundAction: (cupKey, watch) => {
    const g = get().game;
    if (!g) return { ok: false, kind: "error", message: "Нет игры." };
    const cup = g.cups[cupKey];
    if (!cup) {
      return { ok: false, kind: "error", message: "Турнир не найден." };
    }
    if (cup.finished) {
      return { ok: false, kind: "info", message: `${cup.name} завершён.` };
    }
    const userInCup = cup.fixtures.some(([a, b]) => g.user === a || g.user === b);

    if (watch && userInCup) {
      // Живой кубковый матч
      const ng = clone(g);
      const session = beginLiveCup(ng, cupKey);
      if (session) {
        set({
          liveMatch: true,
          matchJumpEnd: false,
          screen: "match",
          matchContext: { kind: cupKey === "ucl" ? "ucl" : cupKey === "uel" ? "uel" : "cup", key: cupKey },
        });
        return { ok: true, kind: "info", message: "Трансляция начинается..." };
      }
    }

    const ng = clone(g);
    const result = playCupRound(ng, cupKey, watch && !userInCup);
    const feedback: Feedback = {
      ok: true,
      kind: "info",
      message:
        result.champion !== null
          ? `Обладатель трофея: «${result.champion}»!`
          : result.lines[result.lines.length - 1] ?? "Раунд сыгран",
    };
    if (watch && !userInCup && result.userMatch) {
      set({
        game: ng,
        lastMatch: result.userMatch,
        screen: "match",
        matchContext: { kind: cupKey === "ucl" ? "ucl" : cupKey === "uel" ? "uel" : "cup", key: cupKey },
      });
    } else {
      set({ game: ng });
    }
    return feedback;
  },

  playRoundAction: (watch) => {
    const g = get().game;
    if (!g) return;
    const ng = clone(g);

    // Сезон завершён — церемония и переход
    if (ng.round >= ng.schedule.length) {
      const report = endOfSeason(ng);
      const check = checkBankrupt(ng);
      saveGame(ng);
      set({
        game: ng,
        seasonReport: report,
        lastRound: null,
        gameOver: check.fired ? { message: check.message } : null,
      });
      return;
    }

    // Живой тур: трансляция с управлением
    if (watch) {
      const session = beginLiveRound(ng);
      if (session) {
        set({ liveMatch: true, matchJumpEnd: false, screen: "match", matchContext: { kind: "league" } });
        return;
      }
      const done = takeFinishedRound();
      if (done) {
        const check = checkBankrupt(done.game);
        saveGame(done.game);
        set({
          game: done.game,
          lastRound: done.summary,
          lastMatch: done.match,
          screen: done.match ? "match" : "dashboard",
          matchContext: done.match ? { kind: "league" } : null,
          gameOver: check.fired ? { message: check.message } : null,
        });
        return;
      }
      return;
    }

    const summary = playRound(ng);
    const check = checkBankrupt(ng);
    summary.boardWarning = check.warning && !check.fired;
    saveGame(ng);
    set({
      game: ng,
      lastRound: summary,
      lastMatch: null,
      screen: "dashboard",
      matchContext: null,
      gameOver: check.fired ? { message: check.message } : null,
    });
  },

  finishLiveMatch: () => {
    const done = finishLive();
    if (!done) {
      set({ liveMatch: false });
      return;
    }
    const check = checkBankrupt(done.game);
    saveGame(done.game);
    if (done.type === "round") {
      set({
        game: done.game,
        liveMatch: false,
        matchJumpEnd: true,
        lastMatch: done.match,
        lastRound: done.summary,
        gameOver: check.fired ? { message: check.message } : null,
      });
      // Экран остаётся «match»: показываем повтор/статистику завершённого матча
      if (!done.match) set({ screen: "dashboard", matchContext: null });
    } else {
      const rr = done.roundResult;
      set({
        game: done.game,
        liveMatch: false,
        matchJumpEnd: true,
        lastMatch: done.match,
        toastMessage: {
          ok: true,
          kind: rr.champion ? "success" : "info",
          message:
            rr.champion
              ? `Обладатель трофея: «${rr.champion}»!`
              : rr.lines[rr.lines.length - 1] ?? "Матч сыгран",
        },
        gameOver: check.fired ? { message: check.message } : null,
      });
    }
  },

  liveSub: (outId, inId) => {
    const res = liveSubstitute(outId, inId);
    if (res.ok) set({ toastMessage: { ok: true, kind: "success", message: res.message } });
    return res;
  },

  liveSetMentality: (m) => liveMentality(m),

  liveTeamTalk: (kind) => liveTalk(kind),

  liveCurrentMinute: () => liveMinute(),

  hireStaffAction: (memberId) => {
    const g = get().game;
    if (!g) return { ok: false, kind: "error", message: "Нет игры." };
    const ng = clone(g);
    const res = hireStaff(ng, memberId);
    if (res.ok) set({ game: ng });
    return { ok: res.ok, kind: res.ok ? "success" : "error", message: res.message };
  },

  fireStaffAction: (role) => {
    const g = get().game;
    if (!g) return { ok: false, kind: "error", message: "Нет игры." };
    const ng = clone(g);
    const res = fireStaff(ng, role);
    if (res.ok) set({ game: ng });
    return { ok: res.ok, kind: res.ok ? "success" : "error", message: res.message };
  },

  buildFacility: (key) => {
    const g = get().game;
    if (!g) return { ok: false, kind: "error", message: "Нет игры." };
    const ng = clone(g);
    const err = startUpgrade(ng, key);
    if (err) return { ok: false, kind: "warning", message: err };
    set({ game: ng });
    return { ok: true, kind: "success", message: "Строительство началось!" };
  },

  signSponsor: (offerId) => {
    const g = get().game;
    if (!g) return { ok: false, kind: "error", message: "Нет игры." };
    const ng = clone(g);
    const err = signSponsorOffer(ng, offerId);
    if (err) return { ok: false, kind: "warning", message: err };
    set({ game: ng });
    return { ok: true, kind: "success", message: "Контракт подписан!" };
  },

  setTicketPrice: (price) => {
    const g = get().game;
    if (!g) return { ok: false, kind: "error", message: "Нет игры." };
    const ng = clone(g);
    if (price === null) {
      ng.ticketPrice = null;
      set({ game: ng });
      return { ok: true, kind: "success", message: "Цена билета: авто по силе клуба" };
    }
    if (!Number.isFinite(price) || price < 8 || price > 220) {
      return { ok: false, kind: "warning", message: "Цена билета: от 8 до 220 € (или «авто»)." };
    }
    ng.ticketPrice = Math.round(price);
    set({ game: ng });
    return { ok: true, kind: "success", message: `Цена билета установлена: ${ng.ticketPrice} €` };
  },

  answerPressAction: (answerIndex) => {
    const g = get().game;
    if (!g) return null;
    const ng = clone(g);
    const result = answerPress(ng, answerIndex);
    set({ game: ng });
    return result;
  },

  skipPress: () => {
    const g = get().game;
    if (!g) return;
    const ng = clone(g);
    ng.pendingPress = null;
    set({ game: ng });
  },

  acceptJobOffer: (offer) => {
    const g = get().game;
    if (!g) return;
    const ng = clone(g);
    const club = ng.teams[offer.club];
    if (!club) return;
    ng.user = club.name;
    ng.boardTrust = 62;
    ng.warnings = 0;
    ng.objectives = generateObjectives(ng);
    // Инфраструктура и коммерция пересобираются под новый клуб
    reinitFacilities(ng);
    reinitCommercial(ng);
    ng.ffpBanRounds = 0;
    ng.boardUltimatum = null;
    fixLineup(club);
    logHistory(ng, `Возглавил «${club.name}»`);
    sendMail(
      ng,
      `Добро пожаловать в «${club.name}»!`,
      `Совет директоров «${club.name}» приветствует вас, ${ng.manager}!\nНовые задачи уже поставлены, болельщики ждут результатов.`,
      "совет",
    );
    saveGame(ng);
    set({ game: ng, seasonReport: null });
  },
}));
