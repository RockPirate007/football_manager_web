/**
 * Раздевалка: живые реакции команды на игровую практику и контракты.
 * Состояний не хранит — всё детерминировано по турам (письма не спамятся).
 */

import { userTeam } from "../core/state";
import { expiringContracts } from "./transfers";
import { sendMail } from "./mail";
import type { GameState } from "../core/types";

/** Туры проверки довольства звёзд */
const MORALE_CHECK_ROUNDS = [8, 14];
/** Тур напоминания об истекающих контрактах */
const CONTRACT_REMINDER_ROUND = 12;

/**
 * Обработка раздевалки после тура:
 *  — звёзды без игровой практики недовольны (мораль вниз + письмо);
 *  — напоминание об игроках с истекающим контрактом.
 */
export function processDressingRoom(g: GameState): void {
  const team = userTeam(g);

  if (MORALE_CHECK_ROUNDS.includes(g.round)) {
    const unhappy = team.players.filter(
      (p) => !p.onLoan && p.ability >= 76 && p.injuryDays <= 0 && p.appearances <= 3,
    );
    if (unhappy.length > 0) {
      for (const p of unhappy) {
        p.morale = Math.max(0, p.morale - 6);
      }
      const lines = unhappy
        .map((p) => `• ${p.name} (${p.detail ?? p.pos}, рейтинг ${p.ability})`)
        .join("\n");
      sendMail(
        g,
        "Раздевалка: недовольные звёзды",
        `Игроки с высокой репутацией не понимают, почему не играют:\n\n${lines}\n\n` +
          `Мораль упала. Дайте им практику, иначе это скажется на игре команды и на атмосфере.`,
        "команда",
      );
    }
  }

  if (g.round === CONTRACT_REMINDER_ROUND && expiringContracts(team).length > 0) {
    const expiring = expiringContracts(team);
    const lines = expiring
      .map((p) => `• ${p.name} — контракт ${p.contractYears <= 0 ? "истёк!" : "истекает в конце сезона"}`)
      .join("\n");
    sendMail(
      g,
      "Контракты: пора решать",
      `Следующие игроки скоро станут свободными агентами:\n\n${lines}\n\n` +
        `Продлите контракты в разделе «Трансферы → Контракты» или готовьтесь искать замену.`,
      "команда",
    );
  }
}
