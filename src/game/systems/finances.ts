/**
 * Финансы клуба: детальная экономика тура — билеты, мерч, спонсоры,
 * ТВ-права, содержание стадиона, зарплаты, академия.
 */

import { PRESS } from "../data/press";
import { teamPayroll } from "../core/team";
import { userTeam, userLeagueId, leagueLeader, userPlace, leagueTeams } from "../core/state";
import { staffPayroll } from "./staff";
import { effectiveCapacity, facilityUpkeep } from "./facilities";
import { tvIncomeFor } from "./ligue";
import { sponsorIncome, currentTicketPrice, priceAttendanceFactor, merchIncome } from "./economy";
import { choice } from "../core/rng";
import type { FinanceBreakdown, GameState } from "../core/types";

export interface FinanceResult extends FinanceBreakdown {
  income: number;
  spend: number;
  budget: number;
}

/**
 * Посещаемость домашнего матча: доля заполнения зависит от места,
 * формы, репутации и назначенной менеджером цены билета. От 42% до 100%.
 * Вместимость растёт от уровня стадиона.
 */
export function attendanceOf(g: GameState, homeGame: boolean, res: "W" | "D" | "L" | null): number {
  const team = userTeam(g);
  if (!homeGame) return 0;
  const cap = effectiveCapacity(team, g.facilities);
  const played = team.w + team.d + team.l;
  const placeFactor = played > 0 ? Math.max(0.46, 1.02 - (team.pts / Math.max(1, played * 3)) * 0.28) : 0.78;
  const formFactor = res === "W" ? 1.0 : res === "D" ? 0.94 : 0.88;
  const repFactor = 0.72 + (g.reputation / 100) * 0.28;
  const priceF = priceAttendanceFactor(g);
  const fill = Math.min(1, placeFactor * formFactor * repFactor * priceF + Math.random() * 0.06);
  return Math.round(cap * fill);
}

/** Применить финансы после тура (полная разбивка) */
export function applyFinances(g: GameState, homeGame: boolean, res: "W" | "D" | "L" | null): FinanceResult {
  const team = userTeam(g);

  // ─── Доходы ───
  const attendance = attendanceOf(g, homeGame, res);
  const price = currentTicketPrice(g); // цена менеджера или авто
  const tickets = Math.round(attendance * price * 0.92); // 8% — сборы лиги/налоги
  const merch = merchIncome(g); // фан-шоп × престиж лиги × репутация
  // Спонсорский контракт: действующая сделка или аварийная формула старых сейвов.
  // Плюс выравнивающие выплаты дивизионам.
  const sponsors = sponsorIncome(g, res).income;
  // ТВ-права: пакет лиги зависит от престижа, внутри лиги — доля по месту
  const nTeams = leagueTeams(g, team.league).length || 18;
  const tv = tvIncomeFor(g, team.league, Math.max(1, userPlace(g)), nTeams);
  // Премии за результат
  const bonus = res === "W" ? 320_000 : res === "D" ? 110_000 : 0;

  const income = tickets + merch + sponsors + tv + bonus;

  // ─── Расходы ───
  const payroll = teamPayroll(team);
  const staffW = staffPayroll(team);
  const upkeep = Math.round(team.capacity * 3.4 + 85_000); // обслуживание арены
  const facility = facilityUpkeep(g.facilities);
  const other = 90_000 + g.academy.length * 14_000; // академия, скаутские выезды
  const spend = payroll + staffW + upkeep + facility + other;

  if (!g.moneyCheat) {
    team.budget += income - spend;
  } else {
    team.budget = 1_000_000_000; // режим песочницы: бесконечные деньги
  }

  const detail: FinanceBreakdown = {
    tickets,
    attendance,
    merch,
    sponsors,
    tv,
    bonus,
    upkeep,
    facility,
    payroll,
    staff: staffW,
    other,
  };
  g.lastFinDetail = detail;
  g.lastFin = [income, spend];
  return { ...detail, income, spend, budget: team.budget };
}

/** Реплика прессы и лидер лиги */
export function pressLines(g: GameState, res: "W" | "D" | "L" | null): { pressLine: string; leaderLine: string } {
  let pressLine = "";
  if (res) {
    pressLine = choice(PRESS[res]).replace("{t}", userTeam(g).name);
  }
  const lead = leagueLeader(g, userLeagueId(g));
  const leaderLine = `Лидер лиги: «${lead.name}» — ${lead.pts} очк.`;
  return { pressLine, leaderLine };
}
