/**
 * Проверка системы детальных позиций: мир → состав → слоты.
 * Запуск: bun scripts/pos-check.ts
 */

import { createWorld } from "../src/game/systems/world";
import { assignSlots, autoLineup } from "../src/game/core/team";
import { detailOf } from "../src/game/core/pos";
import type { GameState, PosDetail } from "../src/game/core/types";

const g: GameState = createWorld("Тест", "Манчестер Сити");
const team = g.teams["Манчестер Сити"];

// Распределение амплуа в составе клуба
const dist: Partial<Record<PosDetail, number>> = {};
for (const p of team.players) {
  const d = detailOf(p);
  dist[d] = (dist[d] ?? 0) + 1;
}
console.log("Амплуа состава «Манчестер Сити»:", dist);

// Слоты стартового состава
const slots = assignSlots(team);
console.log(`\nСтартовый состав (${team.formation}):`);
for (const s of slots) {
  const mark = s.fit < 1 ? ` (${Math.round(s.fit * 100)}%)` : "";
  console.log(
    `  ${s.slot.padEnd(4)} ${s.player.name.padEnd(22)} амплуа ${detailOf(s.player).padEnd(3)} сила ${s.player.ability}${mark}`,
  );
}

// Смена схемы: 5-3-2 требует латералей
team.formation = "5-3-2";
autoLineup(team);
console.log(`\nСхема 5-3-2 (латерали):`);
for (const s of assignSlots(team)) {
  const mark = s.fit < 1 ? ` (${Math.round(s.fit * 100)}%)` : "";
  console.log(`  ${s.slot.padEnd(4)} ${s.player.name.padEnd(22)} ← ${detailOf(s.player)}${mark}`);
}

console.log("\n✅ pos-check завершён");
