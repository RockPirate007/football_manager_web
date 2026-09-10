/**
 * Типы хранения (плоские сериализуемые структуры).
 * Игрок и команда уже сериализуемы, поэтому DB-типы — алиасы.
 */

import type { Player, Team } from "../core/types";

export type PlayerDB = Player;
export type TeamDB = Team;
