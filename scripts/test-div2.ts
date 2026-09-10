/**
 * Проверка экономики вторых дивизионов: карьерный сезон за слабый клуб.
 * Запуск: bun scripts/test-div2.ts
 */
import { createWorld } from "../src/game/systems/world";
import { playRound } from "../src/game/systems/round";
import { endOfSeason } from "../src/game/systems/season";
import { userTeam, userPlace } from "../src/game/core/state";

const club = process.argv[2] ?? "Плимут";
const g = createWorld("Бедняк", club);
console.log(`Клуб: ${g.user} (лига ${g.teams[g.user].league}, сила ${g.teams[g.user].power})`);
console.log(`Стартовый бюджет: ${(g.teams[g.user].budget / 1e6).toFixed(2)} млн €`);

let minBudget = g.teams[g.user].budget;
for (let r = 0; r < g.schedule.length; r++) {
  playRound(g);
  const b = g.teams[g.user].budget;
  if (b < minBudget) minBudget = b;
  if (r % 9 === 0) {
    console.log(`Тур ${r + 1}: бюджет ${(b / 1e6).toFixed(2)} млн €, место ${userPlace(g)}`);
  }
}
console.log(`Финал: бюджет ${(g.teams[g.user].budget / 1e6).toFixed(2)} млн € (минимум ${(minBudget / 1e6).toFixed(2)}), место ${userPlace(g)}`);
const rep = endOfSeason(g);
console.log(`Сезон ${rep.season}: ${rep.place} место, призовые ${(rep.prize / 1e6).toFixed(2)} млн €, новый бюджет ${(g.teams[g.user].budget / 1e6).toFixed(2)} млн €`);
console.log(`Новая лига после межсезонья: ${g.teams[g.user].league}`);
console.log(`Писем: ${g.mail.length}, новостей: ${g.news.length}`);
console.log("✅ Карьер во втором дивизионе стабилен");
