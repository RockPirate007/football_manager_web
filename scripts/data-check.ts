/**
 * Проверка данных: 96 клубов, у каждого есть звёзды, нет дубликатов позиций по номерам.
 */
import { LEAGUES } from "../src/game/data/leagues";
import { LEAGUE_SQUADS, realPlayersCount } from "../src/game/data/players";

let missing = 0;
let total = 0;
for (const l of LEAGUES) {
  for (const c of l.clubs) {
    const squad = LEAGUE_SQUADS[l.id]?.[c.name] ?? [];
    total += squad.length;
    if (squad.length === 0) {
      console.log(`НЕТ ИГРОКОВ: ${l.short} — «${c.name}»`);
      missing++;
    }
    const names = new Set(squad.map((p) => p.name));
    if (names.size !== squad.length) {
      console.log(`ДУБЛИКАТЫ ИМЁН: «${c.name}»`);
    }
    // Проверка: каждая группа представлена или доберётся генератором
    const groups = new Set(squad.map((p) => p.pos));
    for (const g of ["ВРТ", "ЗАЩ", "ПЗ", "НАП"] as const) {
      if (!groups.has(g) && squad.length >= 4) {
        console.log(`НЕТ ГРУППЫ ${g}: «${c.name}» (добор возможен, но лучше добавить)`);
      }
    }
  }
}
console.log(`Клубов: ${LEAGUES.reduce((s, l) => s + l.clubs.length, 0)}`);
console.log(`Реальных игроков: ${realPlayersCount()} (проверено: ${total})`);
console.log(`Клубов без звёзд: ${missing}`);
console.log(`Туров АПЛ: ${(LEAGUES[0].clubs.length - 1) * 2}, Бундеслиги: ${(LEAGUES[3].clubs.length - 1) * 2}`);
