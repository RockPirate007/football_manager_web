/**
 * Клубная почта: системные и сюжетные уведомления.
 */

import type { GameState } from "../core/types";

/** Отправить письмо */
export function sendMail(
  g: GameState,
  subject: string,
  body: string,
  category = "система",
): void {
  g.mail.push({
    season: g.season,
    round: g.round,
    subject,
    body,
    category,
    read: false,
  });
  if (g.mail.length > 60) {
    g.mail = g.mail.slice(-60);
  }
}

/** Число непрочитанных писем */
export function unreadMailCount(g: GameState): number {
  return g.mail.filter((m) => !m.read).length;
}

/** Пометить письмо прочитанным */
export function markMailRead(g: GameState, index: number): void {
  const mail = g.mail[index];
  if (mail) mail.read = true;
}
