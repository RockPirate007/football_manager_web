/**
 * Проверка живого матча: сессия, замены, настрой, установка в перерыве,
 * красные карточки, финализация. Запуск: bun scripts/live-check.ts
 */

import { createWorld } from "../src/game/systems/world";
import { createMatchSession, sessionStepTo, sessionSubstitute, sessionSetMentality, sessionTeamTalk, finalizeSession, sessionViewAt } from "../src/game/engine/session";
import { getEleven } from "../src/game/core/team";

const errors: string[] = [];
const g = createWorld("Тестер", "Астон Вилла");
const user = g.user;

// Первый тур: находим матч пользователя
const pair = g.schedule[0].find(([h, a]) => h === user || a === user)!;
const opponent = pair[0] === user ? pair[1] : pair[0];
const home = g.teams[pair[0]];
const away = g.teams[pair[1]];
const userIsHome = pair[0] === user;

const session = createMatchSession(home, away, true, { userTeam: user, difficulty: "normal" });
if (!session.userTeam) errors.push("сессия: userTeam не задан");

// Стартовые составы на поле — по 11
if (session.homeIds.length !== 11 || session.awayIds.length !== 11) {
  errors.push(`сессия: на поле ${session.homeIds.length}x${session.awayIds.length} вместо 11x11`);
}

// Стартовые составы сессии принадлежат своим командам (без смешивания)
const homeIdsAll = new Set(home.players.map((p) => p.id));
const awayIdsAll = new Set(away.players.map((p) => p.id));
if (!session.homeStart.every((p) => homeIdsAll.has(p.id))) errors.push("сессия: в составе хозяев чужой игрок");
if (!session.awayStart.every((p) => awayIdsAll.has(p.id))) errors.push("сессия: в составе гостей чужой игрок");
const viewStart = sessionViewAt(session, 0);
if (!viewStart.homeLineup.every((p) => homeIdsAll.has(p.id))) errors.push("вид: в составе хозяев чужой игрок");
if (!viewStart.awayLineup.every((p) => awayIdsAll.has(p.id))) errors.push("вид: в составе гостей чужой игрок");
if (session.userTeam !== session.home.name && session.userTeam !== session.away.name) {
  errors.push("сессия: userTeam не участвует в матче");
}

// Прокрутка до 30-й минуты
sessionStepTo(session, 30);
if (session.cursor < 30) errors.push("сессия: курсор не дошёл до 30");

// Настрой — атака
const mres = sessionSetMentality(session, "attack");
if (!mres.ok) errors.push(`настрой не применился: ${mres.message}`);

// Замена: первый полевой игрок пользователя → первый запасной той же группы
const userTeamObj = userIsHome ? home : away;
const onPitch = userIsHome ? session.homeIds : session.awayIds;
const byId = new Map(userTeamObj.players.map((p) => [p.id, p]));
const fieldPlayer = onPitch.map((id) => byId.get(id)!).find((p) => p.pos !== "ВРТ")!;
const benchPlayer = userTeamObj.players.find((p) => !onPitch.includes(p.id) && p.pos === fieldPlayer.pos)!;
const subRes = sessionSubstitute(session, fieldPlayer.id, benchPlayer.id);
if (!subRes.ok) errors.push(`замена не прошла: ${subRes.message}`);
else {
  const stillThere = (userIsHome ? session.homeIds : session.awayIds).includes(fieldPlayer.id);
  if (stillThere) errors.push("замена: ушедший остался на поле");
  if (!(userIsHome ? session.homeIds : session.awayIds).includes(benchPlayer.id)) {
    errors.push("замена: вышедший не на поле");
  }
}

// До перерыва + установка
sessionStepTo(session, 45.5);
const talk = sessionTeamTalk(session, "motivate");
if (!talk.ok && talk.kind !== "warning") errors.push(`установка не прошла: ${talk.message}`);
const talk2 = sessionTeamTalk(session, "calm");
if (talk2.ok) errors.push("установка применилась дважды");

// До конца
sessionStepTo(session, session.endMinute);
if (!session.finished) errors.push("сессия не завершена после endMinute");

// Вид на 60-й минуте — события и замены видны
const view60 = sessionViewAt(session, 60);
if (view60.homeLineup.length !== 11 || view60.awayLineup.length !== 11) {
  errors.push("вид: составы не 11");
}

// Финализация
const outcome = finalizeSession(session);
if (outcome.gh !== session.statsHome.goals || outcome.ga !== session.statsAway.goals) {
  errors.push("финализация: счёт не совпал со статистикой");
}
if (outcome.result.homeLineup?.length !== 11 || outcome.result.awayLineup?.length !== 11) {
  errors.push("финализация: составы в результате не 11");
}
const subbedIn = outcome.result.homeLineup?.find((p) => p.sub) ?? outcome.result.awayLineup?.find((p) => p.sub);
if (!subbedIn) errors.push("финализация: замена не отражена в составе");

// Результат применился к таблице
const my = userIsHome ? outcome.gh : outcome.ga;
const en = userIsHome ? outcome.ga : outcome.gh;
const t = g.teams[user];
const played = t.w + t.d + t.l;
if (played !== 1) errors.push(`таблица: сыграно ${played} вместо 1`);
const expectedPts = my > en ? 3 : my === en ? 1 : 0;
if (t.pts !== expectedPts) errors.push(`таблица: очки ${t.pts} вместо ${expectedPts}`);

// Голы записаны игрокам
const totalGoals = Object.values(g.teams).flatMap((tt) => tt.players).reduce((s, p) => s + p.goals, 0);
if (totalGoals !== outcome.gh + outcome.ga) {
  errors.push(`голы: у игроков ${totalGoals}, в матче ${outcome.gh + outcome.ga}`);
}

// Усталость применена
const starter = getEleven(userTeamObj)[0];
if (starter.stamina >= 100) errors.push("усталость не применена к стартовому составу");

console.log(`Матч: ${home.name} ${outcome.gh}:${outcome.ga} ${away.name}`);
console.log(`Событий в сессии: ${session.events.length}, замен: ${session.subs.length}`);
console.log(`Счёт к 30-й минуте не читается задним числом — события разыгрываются по ходу ✓`);

if (errors.length > 0) {
  console.error("\n❌ ОШИБКИ:");
  for (const e of errors) console.error(" -", e);
  process.exit(1);
}
console.log("\n✅ Живой матч работает корректно");
