/**
 * Генерирует сейв на последнем туре сезона для ручной проверки
 * церемонии конца сезона в браузере.
 */

import { writeFileSync } from "node:fs";
import { createWorld } from "../src/game/systems/world";
import { playRound } from "../src/game/systems/round";
import { serializeGame } from "../src/game/persistence/serialize";
import { ALL_CLUBS } from "../src/game/data/leagues";

const g = createWorld("Тестер", ALL_CLUBS[9].name);

// Сыграть все туры, кроме последнего
for (let i = 0; i < g.schedule.length - 1; i++) playRound(g);

const data = serializeGame(g);
writeFileSync("/home/z/my-project/scripts/final-round-save.json", JSON.stringify(data));
console.log(
  `Сейв готов: сезон ${g.season}, тур ${g.round}, клуб ${g.user}, ` +
    `остался тур ${g.schedule.length} из ${g.schedule.length}`,
);
