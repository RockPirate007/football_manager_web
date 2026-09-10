/**
 * Интеграционный тест игровой логики: мир 10 лиг (топ + вторые дивизионы),
 * полные сезоны, кубки + ЛЧ/ЛЕ, инфраструктура, совет, лента новостей,
 * конец сезона, сериализация.
 * Запуск: bun scripts/test-career.ts
 */

import { createWorld } from "../src/game/systems/world";
import { checkBankrupt } from "../src/game/systems/career";
import { playRound } from "../src/game/systems/round";
import { endOfSeason } from "../src/game/systems/season";
import { serializeGame, deserializeGame } from "../src/game/persistence/serialize";
import { userTeam, userPlace, userLeagueId, sortedLeagueTable, leagueTeams } from "../src/game/core/state";
import { LEAGUES, TOP_LEAGUES, UCL_KEY, UEL_KEY, leagueBaseId, clubBudget } from "../src/game/data/leagues";
import { realPlayersCount } from "../src/game/data/players";
import { startUpgrade, processFacilities } from "../src/game/systems/facilities";

// ─────────────── Тест 0: мир реальных лиг ───────────────

const g0 = createWorld("Тестер", "Астон Вилла");
console.log(`Клубов в мире: ${Object.keys(g0.teams).length} (ожидалось 192)`);
console.log(`Реальных звёзд в базе: ${realPlayersCount()}`);
console.log(`Туров в сезоне: ${g0.schedule.length}, лига: ${g0.teams[g0.user].league}`);

const errors: string[] = [];
if (Object.keys(g0.teams).length !== 192) errors.push(`В мире не 192 клуба, а ${Object.keys(g0.teams).length}`);
if (realPlayersCount() < 700) errors.push(`Слишком мало реальных игроков: ${realPlayersCount()}`);
// Календарь: максимальная лига — 20 клубов → 38 туров
if (g0.schedule.length !== 38) errors.push(`Туров в сезоне ${g0.schedule.length}, ожидалось 38`);
// Персонал: 6 специалистов у каждого клуба
for (const t of Object.values(g0.teams)) {
  if (t.staff.length !== 6) errors.push(`${t.name}: специалистов ${t.staff.length}, ожидалось 6`);
}
if (g0.staffMarket.length === 0) errors.push("Рынок специалистов пуст при старте");

// У каждого клуба: 16+ игроков, вратарь
for (const t of Object.values(g0.teams)) {
  if (t.players.length < 16) errors.push(`${t.name}: мало игроков (${t.players.length})`);
  if (t.players.filter((p) => p.pos === "ВРТ").length < 1) errors.push(`${t.name}: нет вратаря`);
  const nums = t.players.map((p) => p.number);
  if (new Set(nums).size !== nums.length) errors.push(`${t.name}: дублируются номера`);
}

// Реальные звёзды — в топ-дивизионах (вторые составляются генерацией)
for (const l of TOP_LEAGUES) {
  for (const c of l.clubs) {
    const t = g0.teams[c.name];
    if (!t.players.some((p) => p.bio.real)) errors.push(`${t.name}: нет реальных звёзд в топ-дивизионе`);
    const realStars = t.players.filter((p) => p.bio.real);
    for (const s of realStars) {
      if (!s.bio.career || !s.bio.nation) errors.push(`${t.name}/${s.name}: неполная биография`);
    }
  }
}

// Реальные звёзды в правильных клубах
const city = g0.teams["Манчестер Сити"];
if (!city.players.some((p) => p.name === "Эрлинг Холанд" && p.ability >= 90))
  errors.push("Холанд не найден в «Сити»");
const madrid = g0.teams["Реал Мадрид"];
if (!madrid.players.some((p) => p.name === "Килиан Мбаппе"))
  errors.push("Мбаппе не найден в «Реале»");
const bayern = g0.teams["Бавария"];
if (!bayern.players.some((p) => p.name === "Харри Кейн"))
  errors.push("Кейн не найден в «Баварии»");

// Кубки: 5 национальных (объединяют оба дивизиона) + ЛЧ + Лига Европы
const cupKeys = Object.keys(g0.cups);
const expectedCups = new Set(LEAGUES.map((l) => leagueBaseId(l.id))).size + 2;
if (cupKeys.length !== expectedCups) errors.push(`Кубков ${cupKeys.length}, ожидалось ${expectedCups}`);
if (!g0.cups[UCL_KEY]) errors.push("Лига чемпионов не создана");
if (!g0.cups[UEL_KEY]) errors.push("Лига Европы не создана");

// Сетки кубков: нац. кубки — 32 пары (64 слота, оба дивизиона), ЛЧ/ЛЕ — 8 пар (16 слотов)
for (const [key, cup] of Object.entries(g0.cups)) {
  const expected = [UCL_KEY, UEL_KEY].includes(key) ? 8 : 32;
  if (cup.fixtures.length !== expected)
    errors.push(`${key}: пар в сетке ${cup.fixtures.length}, ожидалось ${expected}`);
}

// ─────────────── Тест 0.3: инфраструктура и лента новостей ───────────────

import { addNews } from "../src/game/systems/news";

// Стройка проверяется на отдельном мире, чтобы не ломать бюджет карьеры
{
  const probeF = createWorld("Строитель", "Астон Вилла");
  const facErr = startUpgrade(probeF, "training");
  if (facErr) errors.push(`Стройка не началась: ${facErr}`);
  else {
    const proj = probeF.facilities.project;
    if (!proj || proj.key !== "training") errors.push("Проект стройки не записан");
    if (probeF.teams[probeF.user].budget >= clubBudget(81)) errors.push("Деньги на стройку не списаны");
    const before = probeF.facilities.project!.roundsLeft;
    processFacilities(probeF);
    if (probeF.facilities.project!.roundsLeft !== before - 1) errors.push("Стройка не продвигается");
  }
  addNews(probeF, "club", "🧪", "Тестовая новость", "Проверка ленты");
  if (!probeF.news.some((n) => n.title === "Тестовая новость")) errors.push("Новость не записана в ленту");
  console.log(`Инфраструктура: стройка идёт (${probeF.facilities.project?.roundsLeft} тура), лента работает`);
}

// ─────────────── Тест 0.5: персонал и пресс-конференции ───────────────

import { hireStaff, fireStaff, staffOf, staffPayroll, applyStaffEffects } from "../src/game/systems/staff";
import { buildPressConference, answerPress, maybePressConference } from "../src/game/systems/press";

// Найм/увольнение
const myClub = g0.teams[g0.user];
const marketCandidate = g0.staffMarket[0];
if (marketCandidate) {
  const oldName = staffOf(myClub, marketCandidate.role)?.name ?? null;
  const hireRes = hireStaff(g0, marketCandidate.id);
  if (!hireRes.ok) errors.push(`Найм не сработал: ${hireRes.message}`);
  else if (staffOf(myClub, marketCandidate.role)?.name !== marketCandidate.name)
    errors.push("Найм: специалист не занял должность");
  const fireRes = fireStaff(g0, marketCandidate.role);
  if (!fireRes.ok) errors.push(`Увольнение не сработало: ${fireRes.message}`);
  else if (staffOf(myClub, marketCandidate.role)) errors.push("Увольнение: должность не пуста");
  console.log(`Персонал: найм ${marketCandidate.name} (${oldName} → рынок), увольнение — ок; ФОТ штата: ${staffPayroll(myClub)}`);
}

// Эффекты физио/физио-подготовки
for (const p of myClub.players) {
  if (p.injuryDays > 0) p.injuryDays = 5;
}
applyStaffEffects(g0);
console.log("Эффекты персонала применены без ошибок");

// Пресс-конференция: полный цикл
const pc = buildPressConference(g0, "crisis");
g0.pendingPress = pc;
let answers = 0;
while (g0.pendingPress && answers < 10) {
  const result = answerPress(g0, 0);
  if (result === null) break;
  answers++;
}
if (g0.pendingPress) errors.push("Пресс-конференция не завершилась после всех ответов");
if (answers !== pc.questions.length) errors.push(`Ответов ${answers}, ожидалось ${pc.questions.length}`);
console.log(`Пресс-конференция: ${pc.questions.length} вопросов, все ответы применены`);

// Генерация пресс-конференции после тура возможна
let pcSeen = false;
{
  const probe = createWorld("Проба", "Ливерпуль");
  for (let r = 0; r < 14 && !pcSeen; r++) {
    playRound(probe);
    if (probe.pendingPress) pcSeen = true;
  }
}
if (!pcSeen) errors.push("За 14 туров ни одной пресс-конференции после тура");
console.log(`Пресса после тура: встречается (${pcSeen ? "ок" : "нет"})`);

// ─────────────── Тест 0.7: Фаза 2 — молодёжка, скаут-сеть, тактика ───────────────

import { academyGroupOf, MAX_INDIVIDUAL_PLANS } from "../src/game/core/types";
import { promoteYouthToSquad } from "../src/game/systems/academy";
import { assignScoutMission, cancelScoutMission, maxScoutMissions, processScoutMissions, runScouting, SCOUT_REGIONS } from "../src/game/systems/scouting";
import { setPlayerFocus, applyIndividualTraining, runTraining } from "../src/game/systems/training";
import type { ScoutRegionId } from "../src/game/core/types";

{
  const p2 = createWorld("ФазТест", "Астон Вилла");
  const myP2 = p2.teams[p2.user];

  // Академия: юниорские контракты и группы U17/U19
  if (p2.academy.length === 0) errors.push("Академия пуста при старте мира");
  for (const y of p2.academy) {
    if (!y.junior) errors.push(`Юниор ${y.name}: нет юниорского контракта`);
    if (y.age < 15 || y.age > 19) errors.push(`Юниор ${y.name}: подозрительный возраст ${y.age}`);
    const grp = academyGroupOf(y.age);
    if (grp !== "U17" && grp !== "U19") errors.push(`Юниор ${y.name}: группа ${grp}`);
    if (y.salary >= 15_000) errors.push(`Юниор ${y.name}: зарплата не юниорская (${y.salary})`);
  }
  console.log(`Академия: ${p2.academy.length} юниоров (U17: ${p2.academy.filter((y) => academyGroupOf(y.age) === "U17").length}, U19: ${p2.academy.filter((y) => academyGroupOf(y.age) === "U19").length}), все на юниорских контрактах`);

  // Повышение: профконтракт автоматически
  const junior = p2.academy[0];
  const promoteRes = promoteYouthToSquad(p2, junior.id);
  if (!promoteRes.ok) errors.push(`Повышение юниора не сработало: ${promoteRes.message}`);
  else {
    if (junior.junior) errors.push("Повышение: юниорский флаг не снят");
    if (junior.contractYears !== 3) errors.push("Повышение: профконтракт не 3 года");
    if (junior.salary < 25_000) errors.push("Повышение: профзарплата ниже минимума");
    if (!myP2.players.some((p) => p.id === junior.id)) errors.push("Повышение: игрок не в основе");
  }

  // Скаут-сеть: лимиты, миссия, отчёт с задержкой
  const limit = maxScoutMissions(p2);
  if (limit < 1 || limit > 2) errors.push(`Лимит миссий ${limit}, ожидалось 1–2`);
  const regions: ScoutRegionId[] = ["sam", "eng", "fra"];
  let assigned = 0;
  const beforeBudget = myP2.budget;
  const beforeAgents = p2.freeAgents.length;
  for (let i = 0; i < regions.length && assigned < limit; i++) {
    const err = assignScoutMission(p2, regions[i]);
    if (err === null) assigned++;
  }
  if (assigned !== Math.min(2, limit)) errors.push(`Назначено миссий ${assigned}, ожидалось ${Math.min(2, limit)}`);
  const dupErr = assignScoutMission(p2, "sam");
  if (dupErr === null && (p2.scoutMissions ?? []).some((m) => m.region === "sam"))
    errors.push("Дубликат миссии в регион разрешён");
  if (myP2.budget >= beforeBudget) errors.push("Миссии: деньги не списаны");
  // Отчёт: крутим туры процесса до завершения всех миссий
  let guardM = 0;
  while ((p2.scoutMissions ?? []).length > 0 && guardM < 5) {
    processScoutMissions(p2);
    guardM++;
  }
  if (guardM >= 5) errors.push("Миссии не завершились за 5 тиков");
  if (p2.freeAgents.length <= beforeAgents) errors.push("Отчёты: кандидаты не добавлены на рынок");
  const fromRegion = p2.scoutReports.filter((r) => r.source === SCOUT_REGIONS["sam"].label || r.source === SCOUT_REGIONS["eng"].label || r.source === SCOUT_REGIONS["fra"].label);
  if (fromRegion.length === 0) errors.push("Отчёты по регионам не записаны");
  if (!p2.mail.some((m) => m.category === "скауты")) errors.push("Нет письма с отчётом скаутов");
  // Отмена с возвратом
  const err2 = assignScoutMission(p2, "eeu");
  if (err2 === null) {
    const m = p2.scoutMissions.find((x) => x.region === "eeu");
    const cancelRes = cancelScoutMission(p2, m!.id);
    if (!cancelRes.ok) errors.push("Отмена миссии не сработала");
  }
  console.log(`Скаут-сеть: ${assigned} миссии, отчётов по регионам ${fromRegion.length}, кандидатов +${p2.freeAgents.length - beforeAgents}`);

  // Тактика: стандарты + индивидуальные установки влияют на матч и сериализуются
  const striker = myP2.players.filter((p) => p.pos === "НАП").sort((a, b) => b.passing - a.passing)[0];
  myP2.setPieces = { freeKick: striker.id, corner: striker.id };
  const mid = myP2.players.find((p) => p.pos === "ПЗ");
  if (mid) mid.instruction = "press_hard";
  const def = myP2.players.find((p) => p.pos === "ЗАЩ");
  if (def) def.instruction = "stay_back";
  // Матч с новыми тактическими данными
  const opp = Object.values(p2.teams).find((t) => t.league === myP2.league && t.name !== p2.user)!;
  opp.lineupIds = [];
  const { simulate } = await import("../src/game/engine/simulate");
  const simRes = simulate(myP2, opp, false, { userTeam: p2.user, difficulty: "normal" });
  if (!simRes.result.homeStats) errors.push("Симуляция со стандартами упала");

  // Индивидуальные планы тренировок
  const focusPlayers = myP2.players.filter((p) => p.age <= 24).slice(0, MAX_INDIVIDUAL_PLANS + 1);
  let focusSet = 0;
  for (const fp of focusPlayers) {
    if (setPlayerFocus(p2, fp.id, "pace") === null) focusSet++;
  }
  if (focusSet > MAX_INDIVIDUAL_PLANS) errors.push(`Планов назначено ${focusSet}, лимит ${MAX_INDIVIDUAL_PLANS}`);
  applyIndividualTraining(p2);
  // Тренировка академии как тип
  const yt = runTraining(p2, "youth");
  if (!yt.ok) errors.push("Тренировка «Академия» не сработала");
  console.log(`Тактика/тренировки: стандарты на ${striker.name}, установок 2, планов ${focusSet}, академия-тренировка ок`);

  // Сериализация Фазы 2
  const save2 = JSON.parse(JSON.stringify(serializeGame(p2)));
  const back2 = deserializeGame(save2);
  const myBack = back2.teams[back2.user];
  if (JSON.stringify(myBack.setPieces) !== JSON.stringify(myP2.setPieces)) errors.push("load: стандарты потерялись");
  const midBack = myBack.players.find((p) => p.id === mid?.id);
  if (mid && midBack?.instruction !== "press_hard") errors.push("load: установка игрока потерялась");
  const focusBack = myBack.players.filter((p) => p.trainFocus).length;
  if (focusBack !== focusSet) errors.push(`load: планы тренировок потерялись (${focusBack}/${focusSet})`);
  const juniorBack = myBack.players.find((p) => p.id === junior.id);
  if (!juniorBack || juniorBack.junior) errors.push("load: юниорский флаг после повышения потерялся");
  if ((back2.scoutMissions ?? []).length !== (p2.scoutMissions ?? []).length) errors.push("load: миссии скаутов потерялись");
}

// ─────────────── Тест 0.8: Фаза 3 — престиж лиг, спонсоры, билеты, FFP, ультиматум ───────────────

import { initLeaguePrestige, tvIncomeFor, recomputePrestige } from "../src/game/systems/ligue";
import {
  defaultSponsorDeal, makeSponsorOffers, signSponsorOffer, sponsorIncome,
  processSponsorOffers, ticketAutoPrice, currentTicketPrice, priceAttendanceFactor, seasonSponsorSettle,
} from "../src/game/systems/economy";
import { checkFinancialFairPlay, ffpZone, processBoardDeadline } from "../src/game/systems/board";

void initLeaguePrestige;
void defaultSponsorDeal;
void makeSponsorOffers;

{
  const p3 = createWorld("ЭкономТест", "Астон Вилла");
  const myP3 = p3.teams[p3.user];

  // Престиж лиг инициализирован для всех 10 лиг
  const nLeagues = Object.keys(p3.leaguePrestige).length;
  if (nLeagues !== LEAGUES.length) errors.push(`Престиж: ${nLeagues} лиг, ожидалось ${LEAGUES.length}`);
  if (p3.leaguePrestige["eng"] !== 100) errors.push(`Престиж АПЛ ${p3.leaguePrestige["eng"]}, ожидалось 100`);
  if ((p3.leaguePrestige["eng2"] ?? 0) < 30 || (p3.leaguePrestige["eng2"] ?? 0) > 50)
    errors.push(`Престиж Чемпионшипа ${p3.leaguePrestige["eng2"]} вне диапазона`);

  // ТВ-деньги: зависят от места и престижа
  const tvTop = tvIncomeFor(p3, "eng", 1, 20);
  const tvBottom = tvIncomeFor(p3, "eng", 20, 20);
  const tvFraTop = tvIncomeFor(p3, "fra", 1, 18);
  if (tvTop <= tvBottom) errors.push(`ТВ: лидер (${tvTop}) должен получать больше аутсайдера (${tvBottom})`);
  if (tvFraTop >= tvTop) errors.push(`ТВ: АПЛ (${tvTop}) должна платить больше Лиги 1 (${tvFraTop})`);

  // Спонсорский контракт создан при старте мира
  if (!p3.sponsorDeal) errors.push("Спонсорский контракт не создан при старте мира");
  else {
    if (p3.sponsorDeal.perRound <= 0) errors.push("Контракт: платеж за тур неположительный");
    if (p3.sponsorDeal.seasonsLeft < 1) errors.push("Контракт: срок меньше сезона");
    const inc = sponsorIncome(p3, "W").income;
    if (inc <= 120_000) errors.push(`Спонсорский доход подозрительно мал: ${inc}`);
  }
  if ((p3.sponsorOffers ?? []).length === 0) errors.push("Рынок спонсорских предложений пуст при старте");

  // Подписание: поднимаем репутацию до порога лучшего оффера
  const offer = [...p3.sponsorOffers].sort((a, b) => a.minReputation - b.minReputation)[0];
  p3.reputation = 100;
  const oldDeal = p3.sponsorDeal!;
  const budgetBefore = myP3.budget;
  const signErr = signSponsorOffer(p3, offer.id);
  if (signErr) errors.push(`Подписание контракта не сработало: ${signErr}`);
  else {
    if (p3.sponsorDeal!.name !== offer.name) errors.push("Подписание: контракт не заменён");
    if (myP3.budget !== budgetBefore + offer.signOn) errors.push("Подписание: подъёмные не зачислены");
    if ((p3.sponsorOffers ?? []).some((o) => o.id === offer.id)) errors.push("Подписание: оффер остался на рынке");
    if (oldDeal.name === p3.sponsorDeal!.name) errors.push("Подписание: бренд совпал со старым (пул слишком мал?)");
  }

  // Рынок: старение предложений
  const rounds = p3.sponsorOffers.map((o) => o.roundsLeft);
  processSponsorOffers(p3);
  if (p3.sponsorOffers.some((o, i) => o.roundsLeft !== rounds[i] - 1)) errors.push("Рынок: предложения не стареют");

  // Билеты: авто-цена, назначение и эластичность
  const auto = ticketAutoPrice(myP3);
  if (currentTicketPrice(p3) !== auto) errors.push("Билеты: без назначения должна работать авто-цена");
  p3.ticketPrice = Math.round(auto * 1.3);
  if (priceAttendanceFactor(p3) >= 1) errors.push("Билеты: дороже авто — посещаемость должна падать");
  p3.ticketPrice = Math.max(8, Math.round(auto * 0.7));
  if (priceAttendanceFactor(p3) <= 1) errors.push("Билеты: дешевле авто — посещаемость должна расти");
  p3.ticketPrice = null;

  // FFP: свежий мир — норма; фабрикаем нарушение красной зоны
  if (ffpZone(p3) !== "ok") errors.push("FFP: новый мир должен быть в норме");
  p3.lastFinDetail = {
    tickets: 100_000, attendance: 1000, merch: 100_000, sponsors: 100_000, tv: 100_000, bonus: 0,
    upkeep: 50_000, facility: 20_000, payroll: 900_000, staff: 100_000, other: 50_000,
  }; // ведомость 1.0 млн при доходах 0.4 млн → ratio 2.5
  myP3.budget = -1_000_000;
  checkFinancialFairPlay(p3);
  if (p3.ffpBanRounds !== 6) errors.push(`FFP: запрет покупок не наложен (${p3.ffpBanRounds})`);
  if (myP3.budget >= -1_000_000) errors.push("FFP: штраф не списан");
  if (ffpZone(p3) !== "danger") errors.push("FFP: зона должна быть danger");
  if (!p3.mail.some((m) => m.subject.includes("FFP"))) errors.push("FFP: письмо о санкциях не отправлено");

  // Ультиматум: при пустой таблице место = 1 → дедлайн снимает ультиматум и поднимает доверие
  const p3b = createWorld("Ультиматум", "Астон Вилла");
  p3b.boardUltimatum = { text: "Тест", roundsLeft: 1 };
  const trustBefore = p3b.boardTrust;
  processBoardDeadline(p3b);
  if (p3b.boardUltimatum !== null) errors.push("Ультиматум: не снят после дедлайна");
  if (p3b.boardTrust <= trustBefore) errors.push("Ультиматум: успешное выполнение не подняло доверие");
  p3b.boardUltimatum = { text: "Тест 2", roundsLeft: 1 };
  processBoardDeadline(p3b);
  if (p3b.boardUltimatum !== null) errors.push("Ультиматум 2: не снят");

  // Сезонные итоги спонсора: бонус за место и обновление рынка
  const p3c = createWorld("СезонСпонс", "Астон Вилла");
  p3c.reputation = 100;
  // На пустой таблице место = позиция в порядке данных (8) — ставим условие заведомо выполнимым
  if (p3c.sponsorDeal) p3c.sponsorDeal.placeTarget = 18;
  const bonusBefore = p3c.teams[p3c.user].budget;
  seasonSponsorSettle(p3c);
  // Пока таблица пуста место = 1 ≤ target → бонус должен быть выплачен
  if (p3c.teams[p3c.user].budget <= bonusBefore) errors.push("Спонсор: бонус за место не выплачен");
  if ((p3c.sponsorOffers ?? []).length === 0) errors.push("Спонсор: рынок не обновлён в межсезонье");

  // Пересчёт престижа: смена лиги-чемпиона ЛЧ двигает шкалу
  const p3d = createWorld("Престиж", "Астон Вилла");
  const beforePrestige = { ...p3d.leaguePrestige };
  p3d.cups["ucl"] = { ...p3d.cups["ucl"], champion: "Реал Мадрид" };
  recomputePrestige(p3d);
  if ((p3d.leaguePrestige["esp"] ?? 0) <= (beforePrestige["esp"] ?? 0))
    errors.push("Престиж: победа в ЛЧ не подняла Ла Лигу");

  // Сериализация Фазы 3
  p3.ticketPrice = 45;
  p3.boardUltimatum = { text: "Сериализуй меня", roundsLeft: 3 };
  p3.ffpBanRounds = 4;
  const save3 = JSON.parse(JSON.stringify(serializeGame(p3)));
  const back3 = deserializeGame(save3);
  if (!back3.sponsorDeal || back3.sponsorDeal.name !== p3.sponsorDeal!.name) errors.push("load: спонсорский контракт потерялся");
  if ((back3.sponsorOffers ?? []).length !== (p3.sponsorOffers ?? []).length) errors.push("load: предложения спонсоров потерялись");
  if (back3.ticketPrice !== 45) errors.push("load: цена билета потерялась");
  if (back3.ffpBanRounds !== 4) errors.push("load: FFP-бан потерялся");
  if (back3.boardUltimatum?.text !== "Сериализуй меня") errors.push("load: ультиматум потерялся");
  if (Math.abs((back3.leaguePrestige["eng"] ?? 0) - (p3.leaguePrestige["eng"] ?? 0)) > 0.01) errors.push("load: престиж лиг потерялся");

  // Миграция v12 → v13: сейв без новых полей получает дефолты
  const oldSave = JSON.parse(JSON.stringify(save3));
  delete oldSave.league_prestige;
  delete oldSave.sponsor_deal;
  delete oldSave.sponsor_offers;
  delete oldSave.ticket_price;
  delete oldSave.ffp_ban_rounds;
  delete oldSave.board_ultimatum;
  const migrated = deserializeGame(oldSave);
  if (Object.keys(migrated.leaguePrestige).length === 0) errors.push("Миграция: престиж не восстановлен дефолтом");
  if (!migrated.sponsorDeal) errors.push("Миграция: контракт спонсора не восстановлен");
  if (migrated.ticketPrice !== null) errors.push("Миграция: цена билета должна быть авто");
  if (migrated.ffpBanRounds !== 0) errors.push("Миграция: FFP-бан должен быть 0");

  console.log(`Фаза 3: престиж 10 лиг (АПЛ ${p3.leaguePrestige["eng"]}), ТВ ${tvTop}/${tvBottom} лидер/аутсайдер, спонсор «${p3.sponsorDeal?.name}» ${(p3.sponsorDeal!.perRound / 1000).toFixed(0)} тыс/тур, офферов ${p3.sponsorOffers.length}, билеты ${auto}→45 €, FFP-бан ${p3.ffpBanRounds}, миграция v12→v13 ок`);
}

// ─────────────── Тест 1: два полных сезона ───────────────

let g = g0;
let seasonsDone = 0;
let guard = 0;
const seasonSummaries: string[] = [];
let fired = false;
let firedMessage = "";

while (seasonsDone < 2 && guard < 300) {
  guard++;
  if (g.round >= g.schedule.length) {
    const report = endOfSeason(g);
    seasonsDone++;
    seasonSummaries.push(
      `Сезон ${report.season} [${report.leagueName}]: чемпион «${report.champion}», мы ${report.place} место, ` +
        `призовые ${report.prize}, нац. кубок: ${report.cupChampion ?? "—"}, ЛЧ: ${report.uclChampion ?? "—"}, ЛЕ: ${report.uelChampion ?? "—"}`,
    );
    const check = checkBankrupt(g);
    if (check.fired) {
      fired = true;
      firedMessage = `УВОЛЬНЕНИЕ: ${check.message}`;
      break;
    }
    continue;
  }
  playRound(g);
  const check = checkBankrupt(g);
  if (check.fired) {
    fired = true;
    firedMessage = `УВОЛЬНЕНИЕ после тура ${g.round}: ${check.message}`;
    break;
  }
}

console.log(firedMessage);

console.log("\n── Итоги сезонов ──");
for (const s of seasonSummaries) console.log(s);
console.log(`Текущий сезон: ${g.season}, тур: ${g.round}, место: ${userPlace(g)} (${userLeagueId(g)})`);
console.log(`Архив: ${g.archive.length} записей, история: ${g.history.length}, писем: ${g.mail.length}`);
const team = userTeam(g);
console.log(`Состав: ${team.players.length} игроков, бюджет: ${team.budget}`);
for (const [key, cup] of Object.entries(g.cups)) {
  console.log(`Кубок [${key}]: ${cup.name} — чемпион «${cup.champion}», завершён: ${cup.finished}`);
}

if (seasonsDone < 1) errors.push(`Сезонов завершено: ${seasonsDone}, минимум 1`);
if (!fired) {
  if (g.season !== 3) errors.push(`Сезон должен быть 3, а ${g.season}`);
  if (g.round !== 0) errors.push(`Тур должен быть 0 после межсезонья, а ${g.round}`);
  // ЛЧ нового сезона: 16 участников
  const ucl = g.cups[UCL_KEY];
  const uclTeams = new Set(ucl.fixtures.flatMap(([a, b]) => [a, b]).filter(Boolean));
  if (uclTeams.size !== 16) errors.push(`В ЛЧ нового сезона ${uclTeams.size} команд, ожидалось 16`);
  if (!uclTeams.has("Манчестер Сити")) errors.push("«Сити» не попал в ЛЧ (сезон 3)");
}
for (const t of Object.values(g.teams)) {
  if (t.players.length < 13) errors.push(`${t.name}: слишком мало игроков после сезона (${t.players.length})`);
}
// Свежесть кубков нового сезона — только если сезон доигран (не уволили)
if (!fired) {
  for (const [key, cup] of Object.entries(g.cups)) {
    if (cup.finished) errors.push(`Кубок ${key} нового сезона должен быть свежим`);
    if (!cup.name) errors.push(`Кубок ${key}: нет названия`);
  }
}

// Фаза 2 после сезонов: набор академии, юниоры
if (!fired) {
  if (!g.youthIntake) errors.push("Межсезонный набор академии не создан");
  else console.log(`Набор академии: сезон ${g.youthIntake.season}, ${g.youthIntake.grade} класс, лучший ${g.youthIntake.bestName} (${g.youthIntake.bestPotential})`);
  for (const y of g.academy) {
    if (!y.junior) errors.push(`Юниор после сезона ${y.name}: нет юниорского контракта`);
  }
}
for (const s of seasonSummaries) {
  if (!s.includes("нац. кубок:")) errors.push("В отчёте сезона нет данных кубка");
}

// ─────────────── Тест 2: таблицы лиг согласованы (с учётом переходов) ───────────────

for (const l of LEAGUES) {
  const table = sortedLeagueTable(g, l.id);
  // Размер может колебаться из-за повышений/понижений
  if (table.length < 10 || table.length > 30) {
    errors.push(`Таблица ${l.short}: подозрительный размер ${table.length}`);
  }
  for (const t of table) {
    if (t.league !== l.id) errors.push(`В таблице ${l.short} чужой клуб ${t.name}`);
  }
}
// Каждый клуб мира принадлежит ровно одной лиге из LEAGUES
const validLeagueIds = new Set(LEAGUES.map((l) => l.id));
for (const t of Object.values(g.teams)) {
  if (!validLeagueIds.has(t.league)) errors.push(`${t.name}: неизвестная лига ${t.league}`);
}
const engTable = sortedLeagueTable(g, "eng");
if (engTable.length > 0 && engTable[0].pts < engTable[engTable.length - 1].pts) {
  errors.push("Таблица отсортирована неверно");
}

// ─────────────── Тест 2.5: лента, почта, инфраструктура после сезонов ───────────────

if (g.news.length < 3) errors.push(`Лента новостей почти пуста: ${g.news.length}`);
if (!g.mail.some((m) => m.category === "сборные")) errors.push("Нет писем о вызовах в сборные");
if (!g.mail.some((m) => m.category === "совет")) errors.push("Нет писем совета директоров");
if (!g.facilities || g.facilities.training < 1) errors.push("Инфраструктура не сериализуется");

// ─────────────── Тест 3: сейв/лоад ───────────────

const save = serializeGame(g);
const json = JSON.stringify(save);
const restored = deserializeGame(JSON.parse(json));

if (restored.season !== g.season) errors.push("load: сезон не совпал");
if (Object.keys(restored.teams).length !== Object.keys(g.teams).length) errors.push("load: команды не совпали");
if (restored.teams[restored.user].players.length !== team.players.length) errors.push("load: число игроков не совпало");
if (restored.archive.length !== g.archive.length) errors.push("load: архив не совпал");
if (JSON.stringify(restored.cups[UCL_KEY].champion) !== JSON.stringify(g.cups[UCL_KEY].champion))
  errors.push("load: ЛЧ не совпала");
const restoredStar = restored.teams["Манчестер Сити"].players.find((p) => p.bio.real);
if (!restoredStar || !restoredStar.bio.career) errors.push("load: биографии звёзд потерялись");
if (restored.teams[restored.user].staff.length !== team.staff.length) errors.push("load: штат не совпал");
if (restored.teams[restored.user].staff[0]?.name !== team.staff[0]?.name) errors.push("load: персонал исказился");
if (restored.staffMarket.length !== g.staffMarket.length) errors.push("load: рынок специалистов не совпал");

// Игра продолжается после загрузки? (если карьера не уволена — иначе тур за пределами календаря)
const roundBefore = restored.round;
if (!fired && roundBefore < restored.schedule.length) {
  playRound(restored);
  if (restored.round !== roundBefore + 1)
    errors.push("load: тур не сыгран после загрузки");
}

console.log("\n── Сейв/лоад ──");
console.log(`Размер сейва: ${(json.length / 1024).toFixed(1)} КБ, восстановление корректно, матч после загрузки сыгран`);

// ─────────────── Результат ───────────────

if (errors.length > 0) {
  console.error("\n❌ ОШИБКИ:");
  const shown = errors.slice(0, 20);
  for (const e of shown) console.error(" -", e);
  if (errors.length > shown.length) console.error(` ... и ещё ${errors.length - shown.length}`);
  process.exit(1);
} else {
  console.log("\n✅ Все тесты пройдены");
}
