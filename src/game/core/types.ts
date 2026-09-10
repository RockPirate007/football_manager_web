/**
 * Доменные типы игры. Единственный источник правды по структурам данных.
 * Все типы сериализуемы (без методов и ссылок на объекты).
 */

export type Position = "ВРТ" | "ЗАЩ" | "ПЗ" | "НАП";

export const POSITIONS: Position[] = ["ВРТ", "ЗАЩ", "ПЗ", "НАП"];

/**
 * Детальное амплуа в духе FIFA: 15 кодов поверх четырёх групп.
 * Группа (ВРТ/ЗАЩ/ПЗ/НАП) — доменная основа движка, деталь уточняет
 * амплуа (фланги, опорник, латерали) и влияет на совместимость со слотами схемы.
 */
export type PosDetail =
  | "GK"                                   // Вратарь
  | "CB" | "LB" | "RB" | "LWB" | "RWB"     // Защита
  | "DM" | "CM" | "LM" | "RM" | "AM"       // Полузащита
  | "LW" | "RW" | "CF" | "ST";             // Атака

/** Эффект назначенной роли (вычисляется на лету из data/roles) */
export interface RoleEffect {
  passing: number;
  defending: number;
  attack: number;
  fatigue: number;
}

/** Биография игрока: национальность, антропометрия, карьера, достижения */
export interface PlayerBio {
  /** Реальный футболист из базы звёзд */
  real: boolean;
  /** Страна (гражданство) */
  nation: string;
  /** Рост, см */
  height: number;
  /** Рабочая нога */
  foot: "Правая" | "Левая" | "Обе";
  /** Карьерный путь */
  career: string;
  /** Достижения и титулы */
  honours: string;
  /** Стиль игры */
  traits: string;
}

export interface Player {
  id: number;
  name: string;
  pos: Position;
  /** Точное амплуа (FIFA-код). Для старых сейвов выводится из группы */
  detail?: PosDetail;
  age: number;
  ability: number;

  // Игровой номер
  number: number;
  // Биография
  bio: PlayerBio;

  // Физическое состояние
  stamina: number;
  fitness: number;
  morale: number;
  form: number;

  // Матчевые и сезонные показатели
  goals: number;
  assists: number;
  appearances: number;
  ratingTotal: number;
  yellowCards: number;
  redSuspension: number;
  injuryDays: number;

  // Долгосрочное развитие и атрибуты
  potential: number;
  pace: number;
  shooting: number;
  passing: number;
  defending: number;
  goalkeeping: number;

  // Экономика
  value: number;
  salary: number;

  // Роль и контракт
  role: string | null;
  contractYears: number;
  onLoan: boolean;
  loanOrigin: string | null;
  salaryHome: number;

  // Фаза 2: индивидуальная установка и личный план тренировок
  /** Индивидуальная установка на матч (undefined — «Баланс») */
  instruction?: PlayerInstruction | null;
  /** Фокус индивидуального плана тренировок (макс. 3 игрока на клуб) */
  trainFocus?: TrainFocus | null;
  /** Юниорский контракт академии (дешёвая зарплата, до повышения) */
  junior?: boolean;
}

// ─────────────── Индивидуальные установки и планы ───────────────

/** Ключ индивидуальной установки игрока на матч */
export type PlayerInstruction = "stay_back" | "join_attack" | "press_hard" | "conserve";

export const INSTRUCTION_INFO: Record<PlayerInstruction, { label: string; desc: string }> = {
  stay_back: { label: "Придерживаться позиции", desc: "+оборона, −атака, меньше бегает" },
  join_attack: { label: "Подключения к атаке", desc: "+атака, −оборона, больше усталости" },
  press_hard: { label: "Жёсткий прессинг", desc: "команда давит активнее, высокая усталость" },
  conserve: { label: "Беречь силы", desc: "меньше прессинга и усталости, чуть слабее игра" },
};

/** Ключ фокуса индивидуального плана тренировок */
export type TrainFocus = "pace" | "shooting" | "passing" | "defending";

export const TRAIN_FOCUS_INFO: Record<TrainFocus, { label: string; attr: string }> = {
  pace: { label: "Скорость", attr: "pace" },
  shooting: { label: "Удар", attr: "shooting" },
  passing: { label: "Пас", attr: "passing" },
  defending: { label: "Оборона", attr: "defending" },
};

/** Максимум игроков с индивидуальным планом одновременно */
export const MAX_INDIVIDUAL_PLANS = 3;

/** Исполнители стандартов (ID игроков или null — «не назначен») */
export interface SetPieces {
  /** Штрафные удары */
  freeKick: number | null;
  /** Угловые */
  corner: number | null;
}

export interface Team {
  name: string;
  /** ID лиги (eng | esp | ita | ger | fra) */
  league: string;
  power: number;
  budget: number;
  /** Домашний стадион */
  stadium: string;
  /** Вместимость стадиона */
  capacity: number;
  /** Спонсорское название (генерируется при создании мира) */
  sponsor: string;
  players: Player[];
  /** Штат специалистов клуба (по одному на роль) */
  staff: StaffMember[];
  formation: string;
  tactic: string;
  lineupIds: number[];
  /** Исполнители стандартов (v12, старые сейвы — null) */
  setPieces?: SetPieces;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  pts: number;
}

// ───────────────────────── Персонал ─────────────────────────

/** Роли персонала клуба */
export type StaffRole =
  | "assistant"  // Ассистент: мораль и подсказки
  | "coach"      // Тренер: прогресс на тренировках
  | "scout"      // Скаут: рынок и отчёты
  | "physio"     // Физиотерапевт: скорость лечения травм
  | "fitness"    // Тренер по физподготовке: восстановление
  | "analyst";   // Аналитик: данные соперника и юниоры

export const STAFF_ROLE_INFO: Record<StaffRole, { label: string; desc: string; icon: string }> = {
  assistant: { label: "Ассистент", desc: "Поддерживает мораль игроков и помогает с составом", icon: "🧠" },
  coach: { label: "Тренер", desc: "Ускоряет прогресс игроков на тренировках", icon: "📓" },
  scout: { label: "Скаут", desc: "Находит больше кандидатов на рынке", icon: "🔍" },
  physio: { label: "Физиотерапевт", desc: "Ускоряет лечение травм", icon: "🩺" },
  fitness: { label: "Физио-подготовка", desc: "Команда восстанавливается быстрее между турами", icon: "💪" },
  analyst: { label: "Аналитик", desc: "Разбор соперников: точнее юниоры и подготовка", icon: "📊" },
};

export const STAFF_ROLES: StaffRole[] = ["assistant", "coach", "scout", "physio", "fitness", "analyst"];

/** Сотрудник клуба или кандидат на рынке */
export interface StaffMember {
  id: number;
  name: string;
  role: StaffRole;
  /** Рейтинг специалиста 45–90 */
  ability: number;
  /** Зарплата за тур */
  wage: number;
  nation: string;
}

// ───────────────────────────── Матч ─────────────────────────────

export type MatchEventType =
  | "goal"
  | "save"
  | "miss"
  | "yellow"
  | "red"
  | "injury"
  | "suspension";

/** Событие матча для трансляции (полностью сериализуемо) */
export interface MatchEvent {
  minute: number;
  team: string;
  type: MatchEventType;
  text: string;
  scorerId?: number;
  assistantId?: number;
  playerId?: number;
  xg?: number;
}

export interface TeamMatchStats {
  team: string;
  goals: number;
  shots: number;
  shotsOnTarget: number;
  xg: number;
  possession: number;
  saves: number;
}

export interface PlayerRating {
  playerId: number;
  name: string;
  pos: Position;
  detail?: PosDetail;
  rating: number;
}

export interface MatchResult {
  home: string;
  away: string;
  homeStats: TeamMatchStats;
  awayStats: TeamMatchStats;
  events: MatchEvent[];
  homeRatings: PlayerRating[];
  awayRatings: PlayerRating[];
  bestHome: PlayerRating | null;
  bestAway: PlayerRating | null;
  /** Стартовые составы для 2D-трансляции (старые сейвы — undefined) */
  homeLineup?: LineupPlayer[];
  awayLineup?: LineupPlayer[];
}

// ─────────────────── Сложность и экономика ───────────────────

/** Уровень сложности карьеры */
export type Difficulty = "easy" | "normal" | "hard" | "legend";

export const DIFFICULTY_INFO: Record<Difficulty, { label: string; desc: string }> = {
  easy: { label: "Легко", desc: "Команда сильнее соперников, лидерство в таблице" },
  normal: { label: "Нормально", desc: "Классический баланс сил" },
  hard: { label: "Сложно", desc: "Соперники играют жёстче и удачливее" },
  legend: { label: "Легенда", desc: "Каждый момент против вас — угроза" },
};

/** Разбивка финансов за тур (для отчёта) */
export interface FinanceBreakdown {
  /** Билеты: посещаемость × цена */
  tickets: number;
  /** Посещаемость матча (чел.) */
  attendance: number;
  /** Мерч и фан-шоп */
  merch: number;
  /** Спонсорский контракт */
  sponsors: number;
  /** Телевизионные права */
  tv: number;
  /** Призовые и премии за результат */
  bonus: number;
  /** Содержание стадиона */
  upkeep: number;
  /** Содержание инфраструктуры: база, академия, медцентр, фан-шоп */
  facility: number;
  /** Фонд оплаты труда */
  payroll: number;
  /** Зарплаты персонала */
  staff: number;
  /** Прочие расходы (академия, персонал) */
  other: number;
}

/** Игрок в заявке на матч — для 2D-трансляции */
export interface LineupPlayer {
  id: number;
  name: string;
  number: number;
  pos: Position;
  detail?: PosDetail;
  /** Красная карточка: покинул поле (для трансляции) */
  off?: boolean;
  /** Вышел на замену (для трансляции) */
  sub?: boolean;
}

// ─────────────────────── Инфраструктура клуба ───────────────────────

/** Ключ объекта инфраструктуры */
export type FacilityKey = "stadium" | "training" | "academy" | "medical" | "shop";

export const FACILITY_KEYS: FacilityKey[] = ["stadium", "training", "academy", "medical", "shop"];

/** Максимальный уровень любого объекта */
export const MAX_FACILITY_LEVEL = 5;

/** Описание объекта инфраструктуры */
export interface FacilityMeta {
  label: string;
  icon: string;
  /** Что даёт уровень */
  effect: string;
}

export const FACILITY_META: Record<FacilityKey, FacilityMeta> = {
  stadium: { label: "Стадион", icon: "🏟", effect: "+6% вместимости и билетных доходов за уровень" },
  training: { label: "Тренировочная база", icon: "🏋", effect: "восстановление и прогресс на тренировках" },
  academy: { label: "Академия", icon: "🎓", effect: "качество юниоров и развитие воспитанников" },
  medical: { label: "Медицинский центр", icon: "🩺", effect: "игроки лечатся быстрее" },
  shop: { label: "Фан-шоп", icon: "🛍", effect: "+15% мерчандайзинга за уровень" },
};

/** Текущая стройка */
export interface FacilityProject {
  key: FacilityKey;
  /** Уровень, который строим */
  targetLevel: number;
  /** Осталось туров до завершения */
  roundsLeft: number;
  /** Заплачено при старте */
  cost: number;
}

/** Инфраструктура клуба менеджера */
export interface Facilities {
  stadium: number;
  training: number;
  academy: number;
  medical: number;
  shop: number;
  /** Активная стройка (одна одновременно) */
  project: FacilityProject | null;
}

// ─────────────────────── Лента новостей ───────────────────────

/** Категория новости */
export type NewsCat = "club" | "league" | "europe" | "world";

export const NEWS_CAT_LABEL: Record<NewsCat, string> = {
  club: "Клуб",
  league: "Лига",
  europe: "Европа",
  world: "Мир",
};

/** Новость ленты */
export interface NewsItem {
  season: number;
  round: number;
  cat: NewsCat;
  icon: string;
  title: string;
  text: string;
}

// ───────────────────────── Кубок / почта ─────────────────────────

export interface CupResult {
  a: string | null;
  b: string | null;
  gh: number;
  ga: number;
  winner: string | null;
  pen: boolean;
  stage: string;
}

export interface CupState {
  /** Название турнира */
  name: string;
  fixtures: Array<[string | null, string | null]>;
  results: CupResult[];
  champion: string | null;
  stageSize: number;
  finished: boolean;
}

export interface MailItem {
  season: number;
  round: number;
  subject: string;
  body: string;
  category: string;
  read: boolean;
}

// ───────────────────────────── Карьера ─────────────────────────────

export type ObjectiveType = "place" | "place_max" | "points" | "wins" | "budget_min";

export interface Objective {
  id: string;
  text: string;
  target: number;
  type: ObjectiveType;
  critical: boolean;
}

export interface HistoryItem {
  season: number;
  round: number;
  text: string;
}

export interface ScoutReport {
  name: string;
  pos: Position;
  ability: number;
  potential: number;
  value: number;
  source: string;
  /** Возраст игрока (v12, региональная сеть) */
  age?: number;
}

// ─────────────── Региональная скаутская сеть (Фаза 2) ───────────────

/** Регион скаутской миссии */
export type ScoutRegionId = "eng" | "esp" | "ita" | "ger" | "fra" | "sam" | "afr" | "eeu";

export interface ScoutRegionMeta {
  label: string;
  icon: string;
  /** Страны региона (пулы имён) */
  nations: string[];
  /** Стоимость миссии */
  cost: number;
  /** Длительность в турах */
  rounds: number;
  /** Специализация региона (описание для UI) */
  desc: string;
  /** Надбавка к потенциалу найденных талантов */
  talentBoost: number;
  /** Диапазон возрастов кандидатов [min, max] */
  ageRange: [number, number];
}

export const SCOUT_REGIONS: Record<ScoutRegionId, ScoutRegionMeta> = {
  eng: { label: "Англия", icon: "🏴", nations: ["Англия", "Шотландия"], cost: 220_000, rounds: 2, desc: "высокие лимиты, зрелые игроки", talentBoost: 0, ageRange: [18, 27] },
  esp: { label: "Испания", icon: "🇪🇸", nations: ["Испания"], cost: 220_000, rounds: 2, desc: "техника и пас", talentBoost: 1, ageRange: [17, 26] },
  ita: { label: "Италия", icon: "🇮🇹", nations: ["Италия"], cost: 220_000, rounds: 2, desc: "тактическая выучка, оборона", talentBoost: 1, ageRange: [18, 27] },
  ger: { label: "Германия", icon: "🇩🇪", nations: ["Германия", "Австрия", "Швейцария"], cost: 220_000, rounds: 2, desc: "физика и дисциплина", talentBoost: 1, ageRange: [18, 26] },
  fra: { label: "Франция", icon: "🇫🇷", nations: ["Франция"], cost: 250_000, rounds: 2, desc: "лучшие академии Европы", talentBoost: 3, ageRange: [17, 24] },
  sam: { label: "Южная Америка", icon: "🌎", nations: ["Бразилия", "Аргентина", "Уругвай", "Колумбия"], cost: 450_000, rounds: 3, desc: "алмазы: юные таланты с потолком-звездой", talentBoost: 8, ageRange: [16, 21] },
  afr: { label: "Африка", icon: "🌍", nations: ["Сенегал", "Нигерия", "Гана", "Кот-д’Ивуар", "Марокко", "Алжир", "Египет"], cost: 300_000, rounds: 3, desc: "скорость и атлетизм", talentBoost: 4, ageRange: [16, 22] },
  eeu: { label: "Восточная Европа", icon: "🛰", nations: ["Сербия", "Хорватия", "Польша", "Грузия"], cost: 260_000, rounds: 2, desc: "выгодная цена, характер", talentBoost: 2, ageRange: [17, 25] },
};

export const SCOUT_REGION_IDS = Object.keys(SCOUT_REGIONS) as ScoutRegionId[];

/** Активная миссия скаутов в регион */
export interface ScoutMission {
  id: number;
  region: ScoutRegionId;
  /** Осталось туров */
  roundsLeft: number;
  /** Полная длительность (для прогресс-бара) */
  totalRounds: number;
  /** Заплачено при старте */
  cost: number;
  /** Имя скаута из штата (фиксируется на момент отправки) */
  scoutName: string;
}

// ─────────────── Экономика: спонсоры и мерч (Фаза 3) ───────────────

/** Действующий спонсорский контракт клуба */
export interface SponsorDeal {
  /** Бренд-спонсор */
  name: string;
  /** Платёж за тур */
  perRound: number;
  /** Сколько сезонов осталось */
  seasonsLeft: number;
  /** Бонусное условие: место не ниже */
  placeTarget: number;
  /** Бонус в конце сезона за выполнение условия */
  placeBonus: number;
}

/** Предложение от спонсора на рынке */
export interface SponsorOffer extends SponsorDeal {
  id: number;
  /** Подъёмные при подписании */
  signOn: number;
  /** Минимальная репутация менеджера для подписания */
  minReputation: number;
  /** Через сколько туров предложение уйдёт */
  roundsLeft: number;
}

/** Ультиматум совета: срок истёк — увольнение */
export interface BoardUltimatum {
  text: string;
  /** Осталось туров */
  roundsLeft: number;
}

// ─────────────── Динамика лиг (Фаза 3) ───────────────

/** Начальный престиж топ-лиг (шкала 0–100) */
export const LEAGUE_PRESTIGE_BASE: Record<string, number> = {
  eng: 100,
  esp: 95,
  ita: 88,
  ger: 86,
  fra: 78,
};

// ─────────────── Молодёжная академия (Фаза 2) ───────────────

/** Возрастная группа академии по возрасту */
export type YouthGroup = "U17" | "U19";

/** Возрастная группа игрока академии: до 18 — U17, далее U19 */
export function academyGroupOf(age: number): YouthGroup {
  return age <= 17 ? "U17" : "U19";
}

/** Класс поколения — итог набора академии в межсезонье */
export interface YouthIntake {
  season: number;
  /** Оценка класса: «выдающийся» | «отличный» | «хороший» | «средний» */
  grade: string;
  count: number;
  /** Лучший юниор набора */
  bestName: string;
  bestPotential: number;
}

export interface ArchiveEntry {
  season: number;
  club: string;
  /** Название лиги клуба */
  league: string;
  place: number;
  pts: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  budget: number;
  reputation: number;
  cup: string | null;
  manager: string;
}

export interface ObjectiveCheck {
  obj: Objective;
  ok: boolean;
}

// ───────────────────────── Состояние игры ─────────────────────────

/** Результат пары: [хозяева, гости, голы хозяев, голы гостей] */
export type FixtureResult = [string, string, number, number];

// ─────────────────────── Пресс-конференции ───────────────────────

/** Сюжет пресс-конференции */
export type PressContext =
  | "post_win"      // после победы
  | "post_draw"     // после ничьей
  | "post_loss"     // после поражения
  | "crisis"        // серия поражений
  | "title_race"    // титульная гонка
  | "transfer";     // трансферное окно

export const PRESS_CONTEXT_LABEL: Record<PressContext, string> = {
  post_win: "Разбор победы",
  post_draw: "Ничья под микроскопом",
  post_loss: "Разбор поражения",
  crisis: "Кризисный брифинг",
  title_race: "Титульная гонка",
  transfer: "Окно трансферов",
};

/** Эффект ответа журналисту */
export interface PressEffect {
  /** Изменение морали игроков команды */
  morale?: number;
  /** Изменение доверия совета */
  board?: number;
  /** Изменение репутации менеджера */
  rep?: number;
}

export interface PressAnswer {
  text: string;
  effect: PressEffect;
  /** Реакция прессы на ответ */
  result: string;
}

export interface PressQuestion {
  journalist: string;
  outlet: string;
  text: string;
  answers: PressAnswer[];
}

/** Активная пресс-конференция (сериализуемо) */
export interface PressConference {
  context: PressContext;
  questions: PressQuestion[];
  /** Индекс текущего вопроса */
  current: number;
  /** Реакции на уже данные ответы */
  results: string[];
}

export interface GameState {
  season: number;
  manager: string;
  user: string;
  round: number;
  trained: boolean;
  schedule: Array<Array<[string, string]>>;
  results: Record<number, FixtureResult[]>;
  teams: Record<string, Team>;
  freeAgents: Player[];
  /** Рынок свободных специалистов (обновляется каждый тур) */
  staffMarket: StaffMember[];
  /** Серия поражений подряд (для кризисных пресс-конференций) */
  lossStreak: number;
  /** Активная пресс-конференция, ожидающая менеджера */
  pendingPress: PressConference | null;
  lastFin: [number, number] | null;
  reputation: number;
  boardTrust: number;
  objectives: Objective[];
  history: HistoryItem[];
  academy: Player[];
  scoutReports: ScoutReport[];
  scoutedThisRound: boolean;
  /** Региональные миссии скаутов (v12) */
  scoutMissions: ScoutMission[];
  /** Последний набор академии — класс поколения (v12) */
  youthIntake: YouthIntake | null;
  warnings: number;
  /** Турниры: ключ = id лиги (нац. кубки) или "ucl" */
  cups: Record<string, CupState>;
  mail: MailItem[];
  archive: ArchiveEntry[];
  /** Сложность карьеры */
  difficulty: Difficulty;
  /** Режим песочницы: бесконечные деньги */
  moneyCheat: boolean;
  /** Детальная разбивка финансов последнего тура */
  lastFinDetail: FinanceBreakdown | null;
  /** Инфраструктура клуба менеджера (v11) */
  facilities: Facilities;
  /** Лента новостей (v11) */
  news: NewsItem[];
  /** Сезон последнего предупреждения по FFP (v11) */
  ffpWarnedSeason: number;
  /** Престиж лиг: id → 0–100 (v13) */
  leaguePrestige: Record<string, number>;
  /** Действующий спонсорский контракт (v13; null — старый сейв, формула-заглушка) */
  sponsorDeal: SponsorDeal | null;
  /** Рынок спонсорских предложений (v13) */
  sponsorOffers: SponsorOffer[];
  /** Цена билета, назначенная менеджером (null — авто по силе клуба) */
  ticketPrice: number | null;
  /** Осталось туров FFP-запрета на покупки (v13) */
  ffpBanRounds: number;
  /** Сезон последних санкций FFP (v13) */
  ffpSancSeason: number;
  /** Активный ультиматум совета (v13) */
  boardUltimatum: BoardUltimatum | null;
}

// ──────────────────────── Переговоры ────────────────────────

export interface NegotiationOption {
  key: "accept" | "haggle10" | "haggle18" | "refuse";
  label: string;
  fee: number;
  years: number;
  salary: number;
  acceptChance: number;
}

export interface Negotiation {
  playerId: number;
  playerName: string;
  pos: Position;
  age: number;
  ability: number;
  fromTeam: string | null;
  isAgent: boolean;
  askingFee: number;
  wantYears: number;
  wantSalary: number;
  playerValue: number;
  options: NegotiationOption[];
}

export interface NegotiationOutcome {
  accepted: boolean;
  message: string;
  fee: number;
  years: number;
  salary: number;
}

// ──────────────────────── Отчёты UI ────────────────────────

export type FeedbackKind = "success" | "error" | "info" | "warning";

export interface Feedback {
  ok: boolean;
  kind: FeedbackKind;
  message: string;
}

export interface RoundSummary {
  round: number;
  userMatch: MatchResult | null;
  results: FixtureResult[];
  income: number;
  spend: number;
  budget: number;
  pressLine: string;
  leaderLine: string;
  boardWarning: boolean;
  /** Детальная разбивка финансов тура */
  finance?: FinanceBreakdown;
}

export interface SeasonReport {
  season: number;
  /** Название лиги пользователя */
  leagueName: string;
  champion: string;
  place: number;
  teamsCount: number;
  prize: number;
  budget: number;
  topScorer: { name: string; goals: number } | null;
  objectiveChecks: ObjectiveCheck[];
  boardMessage: string;
  /** Обладатель национального кубка пользователя */
  cupChampion: string | null;
  /** Победитель Лиги чемпионов */
  uclChampion: string | null;
  /** Победитель Лиги Европы */
  uelChampion?: string | null;
  /** Приглашение в другой клуб (принять/отказаться) */
  jobOffer?: { club: string; leagueName: string; power: number } | null;
  newSeason: number;
}

// ──────────────────── Живой матч ────────────────────

/** Настрой команды по ходу матча */
export type Mentality = "defense" | "normal" | "attack";

export const MENTALITY_LABEL: Record<Mentality, string> = {
  defense: "Оборона",
  normal: "Баланс",
  attack: "Атака",
};
