/**
 * Профиль команды для матчевого движка: силы линий с учётом
 * схемы, тактики и ролей игроков.
 */

import { FORMATIONS } from "../data/formations";
import { TACTICS } from "../data/tactics";
import { eff, roleData } from "../core/player";
import { assignSlots, applyRolesToTeam, getEleven } from "../core/team";
import { average } from "../core/rng";
import { clamp } from "../core/rng";
import type { Player, Team } from "../core/types";

export interface TeamMatchProfile {
  keeper: number;
  defense: number;
  midfield: number;
  attack: number;
  pace: number;
  passing: number;
  defending: number;
  shooting: number;
  effective: number;
  morale: number;
  fitness: number;
  pressing: number;
  tempo: number;
  risk: number;
  counter: number;
  fatigue: number;
  width: number;
  possession: number;
}

export function teamMatchProfile(team: Team): TeamMatchProfile {
  applyRolesToTeam(team);
  return profileFromPlayers(team, getEleven(team));
}

/**
 * Профиль по явному списку игроков на поле (живой матч: замены,
 * красные карточки). team — источник схемы/тактики.
 */
export function profileFromPlayers(team: Team, eleven: Player[]): TeamMatchProfile {
  const formation = FORMATIONS[team.formation] ?? FORMATIONS["4-4-2"];
  const tactic = TACTICS[team.tactic] ?? TACTICS["Баланс"];

  const gks = eleven.filter((p) => p.pos === "ВРТ");
  const defs = eleven.filter((p) => p.pos === "ЗАЩ");
  const mids = eleven.filter((p) => p.pos === "ПЗ");
  const fwds = eleven.filter((p) => p.pos === "НАП");

  const keeper = average(gks.map((p) => p.goalkeeping), 48);
  const defense = average(defs.map((p) => p.defending), 45);
  const midfield = average(mids.map((p) => p.passing), 45);
  const attack = average(fwds.map((p) => p.shooting), 45);

  const defenseValues: number[] = [];
  const passingValues: number[] = [];
  const attackValues: number[] = [];
  const paceValues: number[] = [];
  for (const p of eleven) {
    const effects = roleData(p);
    const instr = instructionAttributeMods(p);
    defenseValues.push(p.defending * effects.defending * instr.defense);
    passingValues.push(p.passing * effects.passing);
    attackValues.push(p.shooting * effects.attack * instr.attack);
    paceValues.push(p.pace);
  }

  const roleDefending = average(defenseValues, 45);
  const rolePassing = average(passingValues, 45);
  const roleAttack = average(attackValues, 45);
  // Эффективность с учётом соответствия амплуа слотам схемы:
  // игрок не на своей позиции слабее (FIFA-подобный штраф за неф в позицию)
  const slots = assignSlots(team, eleven);
  const effValues =
    slots.length === 11 ? slots.map((s) => eff(s.player) * s.fit) : eleven.map((p) => eff(p));
  const effective = average(effValues, 45);
  const morale = average(eleven.map((p) => p.morale), 70);
  const fitness = average(eleven.map((p) => p.fitness), 80);

  // Индивидуальные установки (Фаза 2): сдвиги прессинга/усталости на уровне команды.
  // Атрибутные сдвиги stay_back/join_attack учтены в defense/attack выше.
  let pressHard = 0;
  let conserve = 0;
  let fatigueMod = 1.0;
  for (const p of eleven) {
    if (p.instruction === "press_hard") {
      pressHard += 1;
      fatigueMod *= 1.03;
    } else if (p.instruction === "conserve") {
      conserve += 1;
      fatigueMod *= 0.92;
    } else if (p.instruction === "stay_back") {
      fatigueMod *= 0.99;
    } else if (p.instruction === "join_attack") {
      fatigueMod *= 1.02;
    }
  }

  return {
    keeper,
    defense: defense * formation.df * tactic.df,
    midfield: midfield * formation.possession * tactic.possession,
    attack: attack * formation.atk * tactic.atk,
    pace: average(paceValues, 50),
    passing: rolePassing * formation.possession * tactic.possession,
    defending: roleDefending * formation.df * tactic.df,
    shooting: roleAttack * formation.atk * tactic.atk,
    effective,
    morale,
    fitness,
    pressing: clamp(tactic.pressing + pressHard * 0.04 - conserve * 0.03, 0.5, 1.6),
    tempo: tactic.tempo,
    risk: tactic.risk,
    counter: tactic.counter * formation.counter,
    fatigue: clamp(tactic.fatigue * formation.fatigue * fatigueMod, 0.7, 1.45),
    width: formation.width,
    possession: formation.possession * tactic.possession,
  };
}

/** Множители атрибутов от индивидуальной установки игрока */
export function instructionAttributeMods(p: Player): { defense: number; attack: number } {
  switch (p.instruction) {
    case "stay_back":
      return { defense: 1.08, attack: 0.85 };
    case "join_attack":
      return { defense: 0.90, attack: 1.10 };
    default:
      return { defense: 1.0, attack: 1.0 };
  }
}

/** Совокупные сила атаки и обороны (совместимость со старыми расчётами) */
export function calcStrength(team: Team): { attack: number; defense: number } {
  const profile = teamMatchProfile(team);
  const attack =
    profile.attack * 0.42 +
    profile.midfield * 0.24 +
    profile.passing * 0.16 +
    profile.pace * 0.10 +
    profile.effective * 0.08;
  const defense =
    profile.keeper * 0.30 +
    profile.defense * 0.35 +
    profile.defending * 0.20 +
    profile.effective * 0.15;
  return { attack, defense };
}
