/**
 * Реальные лиги, кубки и клубы мира.
 * Чистые данные без логики. Сила (power) откалибрована по уровню сезона 2024/25.
 * Каждый клуб: слаг логотипа (public/logos/teams/<slug>.png), цвета формы,
 * реальный стадион и вместимость.
 */

export interface KitColors {
  /** Основной цвет формы */
  primary: string;
  /** Вторичный цвет (обводка/принт) */
  secondary: string;
  /** Тип узора для 2D-трансляции */
  pattern: "solid" | "stripes" | "sash";
}

export interface ClubData {
  name: string;
  city: string;
  power: number;
  /** Слаг файла логотипа (public/logos/teams/<slug>.png) */
  slug: string;
  /** Домашний стадион */
  stadium: string;
  /** Вместимость стадиона */
  capacity: number;
  /** Цвета формы для трансляции и UI */
  kit: KitColors;
}

export interface LeagueData {
  id: string;
  name: string;
  short: string;
  country: string;
  cupName: string;
  /** Акцентный цвет лиги (hex) */
  accent: string;
  /** Топ-дивизион (участие в ЛЧ/ЛЕ и титульных кубках) */
  top: boolean;
  clubs: ClubData[];
}

function club(
  name: string,
  city: string,
  power: number,
  slug: string,
  stadium: string,
  capacity: number,
  primary: string,
  secondary: string,
  pattern: KitColors["pattern"] = "solid",
): ClubData {
  return { name, city, power, slug, stadium, capacity, kit: { primary, secondary, pattern } };
}

export const LEAGUES: LeagueData[] = [
  {
    id: "eng",
    name: "Английская Премьер-лига",
    short: "АПЛ",
    country: "Англия",
    cupName: "Кубок Англии",
    accent: "#e90052",
    top: true,
    clubs: [
      club("Манчестер Сити", "Манчестер", 91, "manchester-city", "Этихад", 53400, "#6CABDD", "#1C2C5B"),
      club("Арсенал", "Лондон", 89, "arsenal", "Эмирейтс", 60704, "#EF0107", "#FFFFFF"),
      club("Ливерпуль", "Ливерпуль", 89, "liverpool", "Энфилд", 61076, "#C8102E", "#F6EB61"),
      club("Челси", "Лондон", 84, "chelsea", "Стэмфорд Бридж", 40343, "#034694", "#DBA111"),
      club("Манчестер Юнайтед", "Манчестер", 83, "manchester-united", "Олд Траффорд", 74310, "#DA291C", "#FBE122"),
      club("Тоттенхэм", "Лондон", 83, "tottenham", "Тоттенхэм Хотспур", 62850, "#132257", "#FFFFFF"),
      club("Ньюкасл", "Ньюкасл", 82, "newcastle", "Сент-Джеймс Парк", 52305, "#241F20", "#FFFFFF", "stripes"),
      club("Астон Вилла", "Бирмингем", 81, "aston-villa", "Вилла Парк", 42657, "#670E36", "#95BFE5"),
      club("Брайтон", "Брайтон", 77, "brighton", "Американ Экспресс", 31800, "#0057B8", "#FFFFFF"),
      club("Вест Хэм", "Лондон", 75, "west-ham", "Лондон", 62500, "#7A263A", "#1BB1E7"),
      club("Кристал Пэлас", "Лондон", 75, "crystal-palace", "Селхерст Парк", 25486, "#1B458F", "#C4122E"),
      club("Эвертон", "Ливерпуль", 73, "everton", "Гудисон Парк", 39572, "#003399", "#FFFFFF"),
      club("Фулхэм", "Лондон", 73, "fulham", "Крейвен Коттедж", 29589, "#FFFFFF", "#000000"),
      club("Вулверхэмптон", "Вулверхэмптон", 72, "wolverhampton", "Молинью", 31750, "#FDB913", "#231F20"),
      club("Брентфорд", "Лондон", 72, "brentford", "Джип Граунд", 17250, "#E30613", "#FFFFFF"),
      club("Ноттингем Форест", "Ноттингем", 72, "nottingham-forest", "Сити Граунд", 30445, "#DD0000", "#FFFFFF"),
      club("Борнмут", "Борнмут", 71, "bournemouth", "Виталити", 11364, "#DA291C", "#000000", "stripes"),
      club("Лестер", "Лестер", 70, "leicester", "Кинг Пауэр", 32261, "#003090", "#FDBE11"),
      club("Ипсвич", "Ипсвич", 66, "ipswich", "Портман Роуд", 30311, "#3A64A3", "#FFFFFF"),
      club("Саутгемптон", "Саутгемптон", 66, "southampton", "Сент-Мэри", 32384, "#D71920", "#FFFFFF", "stripes"),
    ],
  },
  {
    id: "esp",
    name: "Ла Лига",
    short: "Ла Лига",
    country: "Испания",
    cupName: "Кубок Испании",
    accent: "#ff4b44",
    top: true,
    clubs: [
      club("Реал Мадрид", "Мадрид", 92, "real-madrid", "Сантьяго Бернабеу", 81044, "#FFFFFF", "#FEBE10"),
      club("Барселона", "Барселона", 88, "barcelona", "Камп Ноу", 99354, "#A50044", "#004D98", "stripes"),
      club("Атлетико", "Мадрид", 86, "atletico-madrid", "Метрополитано", 70460, "#CB3524", "#262E61", "stripes"),
      club("Атлетик", "Бильбао", 80, "athletic-bilbao", "Сан-Мамес", 53289, "#EE2523", "#FFFFFF"),
      club("Реал Сосьедад", "Сан-Себастьян", 78, "real-sociedad", "Реале Арена", 39500, "#0067B1", "#FFFFFF", "stripes"),
      club("Вильярреал", "Вильярреал", 77, "villarreal", "Ла Серамика", 23500, "#FFE667", "#005187"),
      club("Бетис", "Севилья", 76, "betis", "Бенито Вильямарин", 60721, "#00954C", "#FFFFFF"),
      club("Жирона", "Жирона", 75, "girona", "Монтиливи", 14624, "#CD2534", "#FFFFFF"),
      club("Севилья", "Севилья", 74, "sevilla", "Рамон Санчес-Писхуан", 43883, "#D81324", "#FFFFFF"),
      club("Валенсия", "Валенсия", 73, "valencia", "Месталья", 49430, "#FFFFFF", "#F18E00"),
      club("Сельта", "Виго", 72, "celta-vigo", "Балаидос", 29000, "#8AC3EE", "#FFFFFF"),
      club("Осасуна", "Памплона", 72, "osasuna", "Эль Садар", 23576, "#D91A21", "#0A346F"),
      club("Райо Вальекано", "Мадрид", 71, "rayo-vallecano", "Вальекас", 14708, "#FFFFFF", "#E53027", "sash"),
      club("Мальорка", "Пальма", 71, "mallorca", "Сон Моиш", 23142, "#E20613", "#000000"),
      club("Хетафе", "Хетафе", 70, "getafe", "Колисеум", 17393, "#005999", "#FFFFFF"),
      club("Алавес", "Витория", 70, "alaves", "Мендисорроса", 19840, "#0761AF", "#FFFFFF", "stripes"),
      club("Лас-Пальмас", "Лас-Пальмас", 69, "las-palmas", "Гран-Канария", 32400, "#FFE400", "#003DA5"),
      club("Эспаньол", "Барселона", 68, "espanyol", "РКД Стадиум", 40000, "#007FC8", "#FFFFFF"),
      club("Леганес", "Леганес", 66, "leganes", "Бутарке", 12594, "#FFFFFF", "#004E9E", "stripes"),
      club("Вальядолид", "Вальядолид", 65, "real-valladolid", "Хосе Соррилья", 27618, "#B4068B", "#FFFFFF", "stripes"),
    ],
  },
  {
    id: "ita",
    name: "Серия А",
    short: "Серия А",
    country: "Италия",
    cupName: "Кубок Италии",
    accent: "#0b5cff",
    top: true,
    clubs: [
      club("Интер", "Милан", 88, "inter", "Джузеппе Меацца", 75923, "#0068A8", "#000000", "stripes"),
      club("Милан", "Милан", 84, "milan", "Сан-Сиро", 75923, "#FB090B", "#000000", "stripes"),
      club("Ювентус", "Турин", 84, "juventus", "Аллианц", 41507, "#FFFFFF", "#000000", "stripes"),
      club("Наполи", "Неаполь", 83, "napoli", "Диего Марадона", 54726, "#12A0D7", "#FFFFFF"),
      club("Аталанта", "Бергамо", 83, "atalanta", "Гевисс", 24950, "#1D71B8", "#000000", "stripes"),
      club("Рома", "Рим", 80, "roma", "Олимпико", 70634, "#8E1F2F", "#F0BC42"),
      club("Лацио", "Рим", 79, "lazio", "Олимпико", 70634, "#87D8F7", "#FFFFFF"),
      club("Фиорентина", "Флоренция", 77, "fiorentina", "Артемио Франки", 43147, "#582C83", "#FFFFFF"),
      club("Болонья", "Болонья", 76, "bologna", "Ренато Далл'Ара", 38279, "#9F1C33", "#1A2F48"),
      club("Торино", "Турин", 72, "torino", "Олимпико Гранде", 27958, "#881600", "#FFFFFF"),
      club("Удинезе", "Удине", 72, "udinese", "Блуэнерджи", 25144, "#000000", "#FFFFFF", "stripes"),
      club("Дженоа", "Генуя", 71, "genoa", "Луиджи Феррарис", 33205, "#B4122D", "#02214C"),
      club("Кальяри", "Кальяри", 70, "cagliari", "Унипол Домус", 16416, "#B01E2F", "#0B2C5C"),
      club("Эмполи", "Эмполи", 69, "empoli", "Карло Кастеллани", 16841, "#0067B2", "#FFFFFF"),
      club("Верона", "Верона", 69, "hellas-verona", "Маркантонио Бентегоди", 39211, "#FFE500", "#1C2C5B", "stripes"),
      club("Парма", "Парма", 69, "parma", "Эннио Тардини", 22359, "#FFE500", "#003C7D", "stripes"),
      club("Монца", "Монца", 68, "monza", "Уменьшенный Бриантео", 16917, "#E2001A", "#FFFFFF"),
      club("Лечче", "Лечче", 67, "lecce", "Виа дель Маре", 31533, "#FFE500", "#CC0000", "stripes"),
      club("Комо", "Комо", 67, "como", "Джузеппе Синигалья", 13602, "#004A9F", "#FFFFFF"),
      club("Венеция", "Венеция", 66, "venezia", "Пьер Луиджи Пенцо", 11150, "#F26522", "#000000", "stripes"),
    ],
  },
  {
    id: "ger",
    name: "Бундеслига",
    short: "Бундеслига",
    country: "Германия",
    cupName: "Кубок Германии",
    accent: "#d20515",
    top: true,
    clubs: [
      club("Бавария", "Мюнхен", 90, "bayern-munich", "Аллианц Арена", 75000, "#DC052D", "#FFFFFF"),
      club("Байер", "Леверкузен", 88, "bayer-leverkusen", "БайАрена", 30210, "#E32221", "#000000"),
      club("Боруссия Дортмунд", "Дортмунд", 84, "borussia-dortmund", "Сигнал Идуна Парк", 81365, "#FDE100", "#000000"),
      club("РБ Лейпциг", "Лейпциг", 83, "rb-leipzig", "Ред Булл Арена", 47069, "#DD0741", "#FFFFFF"),
      club("Штутгарт", "Штутгарт", 80, "stuttgart", "MHPАрена", 60449, "#E32219", "#FFFFFF"),
      club("Айнтрахт", "Франкфурт", 78, "eintracht-frankfurt", "Дойче Банк Парк", 58000, "#E1000F", "#000000", "stripes"),
      club("Вольфсбург", "Вольфсбург", 74, "wolfsburg", "Фольксваген Арена", 30000, "#65B32E", "#FFFFFF"),
      club("Фрайбург", "Фрайбург", 74, "freiburg", "Европа-Парк", 34700, "#E2001A", "#000000"),
      club("Гладбах", "Мёнхенгладбах", 72, "gladbach", "Боруссиа Парк", 54042, "#FFFFFF", "#22A55B"),
      club("Хоффенхайм", "Зинсхайм", 71, "hoffenheim", "ПреЦеро Арена", 30150, "#1961AC", "#FFFFFF"),
      club("Аугсбург", "Аугсбург", 71, "augsburg", "ВВК Арена", 30660, "#BA3733", "#46714D"),
      club("Майнц", "Майнц", 70, "mainz", "Мева Арена", 33305, "#C3141E", "#FFFFFF"),
      club("Вердер", "Бремен", 70, "werder-bremen", "Везерштадион", 42100, "#1D9053", "#FFFFFF"),
      club("Унион Берлин", "Берлин", 69, "union-berlin", "Ан дер Альтен Фёрстерай", 22012, "#EB1923", "#FFE500"),
      club("Бохум", "Бохум", 67, "bochum", "Рурштадион", 26000, "#005CA9", "#FFFFFF"),
      club("Санкт-Паули", "Гамбург", 66, "st-pauli", "Миллернтор", 29546, "#614E37", "#FFFFFF"),
      club("Хайденхайм", "Хайденхайм", 66, "heidenheim", "Фойт-Арена", 15000, "#E30613", "#003D7D"),
      club("Гольштайн Киль", "Киль", 64, "holstein-kiel", "Хольнтайнштадион", 15034, "#FFFFFF", "#0A3A82", "stripes"),
    ],
  },
  {
    id: "fra",
    name: "Лига 1",
    short: "Лига 1",
    country: "Франция",
    cupName: "Кубок Франции",
    accent: "#091c3e",
    top: true,
    clubs: [
      club("ПСЖ", "Париж", 90, "psg", "Парк де Пренс", 47929, "#004170", "#DA291C"),
      club("Монако", "Монако", 82, "monaco", "Луи II", 18523, "#E63312", "#FFFFFF", "sash"),
      club("Марсель", "Марсель", 80, "marseille", "Оранж Велодром", 67394, "#2FAEE0", "#FFFFFF"),
      club("Лилль", "Лилль", 79, "lille", "Пьер Моруа", 50186, "#E01E13", "#101820"),
      club("Лион", "Лион", 77, "lyon", "Групама", 59186, "#FFFFFF", "#1B3A6B"),
      club("Ницца", "Ницца", 76, "nice", "Альянц Ривьера", 35624, "#ED1C24", "#000000"),
      club("Ланс", "Ланс", 75, "lens", "Боллар-Делелис", 38223, "#FFF200", "#E2001A"),
      club("Ренн", "Ренн", 74, "rennes", "Роашон Парк", 29778, "#E23636", "#000000"),
      club("Брест", "Брест", 71, "brest", "Франсис Ле Бле", 15097, "#E2001A", "#FFFFFF"),
      club("Страсбур", "Страсбур", 71, "strasbourg", "Де ла Мено", 26109, "#009DE0", "#FFFFFF"),
      club("Тулуза", "Тулуза", 71, "toulouse", "Стадион де Тулуза", 33150, "#582C83", "#FFFFFF"),
      club("Нант", "Нант", 70, "nantes", "Божуар", 35322, "#FFE500", "#00954C", "stripes"),
      club("Реймс", "Реймс", 70, "reims", "Огюст Делоне", 21727, "#E30613", "#FFFFFF"),
      club("Осер", "Осер", 68, "auxerre", "Аббэ-Дешам", 23469, "#FFFFFF", "#0055A4", "stripes"),
      club("Монпелье", "Монпелье", 67, "montpellier", "Ла Моссон", 32900, "#F27B21", "#0C2340"),
      club("Анже", "Анже", 66, "angers", "Раймон Копа", 17966, "#000000", "#FFFFFF", "stripes"),
      club("Лорьян", "Лорьян", 65, "lorient", "Мюстуар", 18500, "#F58220", "#000000"),
      club("Гавр", "Гавр", 64, "havre", "Океан", 25178, "#005CA9", "#8EC5E8", "stripes"),
    ],
  },
  {
    id: "eng2",
    name: "Чемпионшип",
    short: "Чемпионшип",
    country: "Англия",
    cupName: "Кубок Англии",
    accent: "#1e40af",
    top: false,
    clubs: [
      club("Лидс", "Лидс", 71, "leeds", "Элланд Роуд", 37645, "#FFFFFF", "#1D428A", "stripes"),
      club("Бёрнли", "Бёрнли", 69, "burnley", "Тёрф Мур", 21944, "#6C1D45", "#99D6EA"),
      club("Шеффилд Юнайтед", "Шеффилд", 69, "sheffield-united", "Брэмолл Лейн", 32050, "#EE2737", "#000000", "stripes"),
      club("Сандерленд", "Сандерленд", 67, "sunderland", "Стэдиум оф Лайт", 49000, "#EB172B", "#FFFFFF", "stripes"),
      club("Вест Бромвич", "Вест Бромвич", 66, "west-bromwich", "Хоуторнс", 26850, "#122F67", "#FFFFFF", "stripes"),
      club("Мидлсбро", "Мидлсбро", 66, "middlesbrough", "Риверсайд", 34000, "#E21C38", "#FFFFFF"),
      club("Норвич", "Норвич", 65, "norwich", "Кэрроу Роуд", 27244, "#FFF200", "#00A650"),
      club("Ковентри", "Ковентри", 65, "coventry", "Ковентри Билдинг Сосьети", 32409, "#78D0F3", "#FFFFFF", "stripes"),
      club("Сток Сити", "Сток-он-Трент", 64, "stoke-city", "Бет365", 30089, "#E03A3E", "#FFFFFF", "stripes"),
      club("Бристоль Сити", "Бристоль", 63, "bristol-city", "Аштон Гейт", 27000, "#E21C38", "#FFFFFF"),
      club("Уотфорд", "Уотфорд", 63, "watford", "Викарейдж Роуд", 22200, "#FBEE23", "#ED2127"),
      club("Миллуолл", "Лондон", 62, "millwall", "Ден", 20146, "#001D5C", "#FFFFFF"),
      club("Престон", "Престон", 62, "preston", "Дипдейл", 23404, "#FFFFFF", "#1B449C"),
      club("Халл Сити", "Халл", 62, "hull-city", "МКМ", 25400, "#F18A01", "#000000", "stripes"),
      club("Кардифф", "Кардифф", 61, "cardiff", "Кардифф Сити", 33280, "#0070B5", "#FFFFFF"),
      club("Суонси", "Суонси", 61, "swansea", "Либерти", 21088, "#FFFFFF", "#121212"),
      club("Шеффилд Уэнсдей", "Шеффилд", 60, "sheffield-wednesday", "Хиллсборо", 39814, "#0066B3", "#FFFFFF", "stripes"),
      club("Дерби", "Дерби", 60, "derby", "Прайд Парк", 33597, "#FFFFFF", "#000000"),
      club("Блэкберн", "Блэкберн", 60, "blackburn", "Ивуд Парк", 31367, "#009EE0", "#FFFFFF", "sash"),
      club("Плимут", "Плимут", 58, "plymouth", "Хоум Парк", 17904, "#007B5F", "#FFFFFF"),
    ],
  },
  {
    id: "esp2",
    name: "Сегунда",
    short: "Сегунда",
    country: "Испания",
    cupName: "Кубок Испании",
    accent: "#0d7a5f",
    top: false,
    clubs: [
      club("Леванте", "Валенсия", 68, "levante", "Сьюдат де Валенсия", 26354, "#004FA3", "#B4093C", "stripes"),
      club("Сарагоса", "Сарагоса", 67, "zaragoza", "Ла Ромареда", 33608, "#FFFFFF", "#2265B1"),
      club("Расинг Сантандер", "Сантандер", 66, "racing-santander", "Эль Сардинеро", 22314, "#FFFFFF", "#009A44", "sash"),
      club("Спортинг Хихон", "Хихон", 66, "sporting-gijon", "Эль Молинон", 30000, "#D01F26", "#FFFFFF", "stripes"),
      club("Гранада", "Гранада", 65, "granada", "Нуэво Лос Карменес", 19336, "#C8102E", "#FFFFFF", "stripes"),
      club("Малага", "Малага", 65, "malaga", "Росаледа", 30118, "#1A9CD8", "#FFFFFF", "stripes"),
      club("Депортиво", "Ла-Корунья", 64, "deportivo", "Риасор", 32570, "#0069B4", "#FFFFFF", "stripes"),
      club("Эльче", "Эльче", 64, "elche", "Мартинес Валеро", 31388, "#00953B", "#FFFFFF", "stripes"),
      club("Кадис", "Кадис", 63, "cadiz", "Рамон де Карранса", 20724, "#FFE500", "#0A3A82", "sash"),
      club("Эйбар", "Эйбар", 63, "eibar", "Ипуруа", 8109, "#9C1B30", "#8C8C8C", "stripes"),
      club("Альбасете", "Альбасете", 62, "albacete", "Карлос Бельмонте", 17300, "#FFFFFF", "#1F4E9C", "stripes"),
      club("Бургос", "Бургос", 62, "burgos", "Эль Плантиньо", 12294, "#000000", "#B4093C", "stripes"),
      club("Мирандес", "Миранда-де-Эбро", 61, "mirandes", "Андиува", 5735, "#B4093C", "#F6EB61"),
      club("Кастельон", "Кастельон", 61, "castellon", "Балаида", 15596, "#000000", "#FFFFFF", "stripes"),
      club("Тенерифе", "Санта-Крус-де-Тенерифе", 61, "tenerife", "Гелиодоро", 22724, "#FFFFFF", "#003DA5"),
      club("Уэска", "Уэска", 60, "huesca", "Эль Алькорас", 9100, "#8E1F2F", "#F0BC42"),
      club("Картагена", "Картагена", 60, "cartagena", "Картагонова", 15105, "#000000", "#F58220", "stripes"),
      club("Ферроль", "Ферроль", 59, "racing-ferrol", "А Мальата", 12043, "#006933", "#FFFFFF", "stripes"),
      club("Альмерия", "Альмерия", 60, "almeria", "Пауэрс Хорс", 15301, "#FFFFFF", "#D81E05", "stripes"),
      club("Мурсия", "Мурсия", 59, "murcia", "Энхебе", 31211, "#B4093C", "#0A3A82"),
    ],
  },
  {
    id: "ita2",
    name: "Серия Б",
    short: "Серия Б",
    country: "Италия",
    cupName: "Кубок Италии",
    accent: "#15803d",
    top: false,
    clubs: [
      club("Сассуоло", "Сассуоло", 70, "sassuolo", "Мапеи", 21504, "#00A752", "#000000", "stripes"),
      club("Пиза", "Пиза", 67, "pisa", "Гаррилда", 10300, "#0A3A82", "#FFFFFF", "sash"),
      club("Специя", "Ла Специя", 66, "spezia", "Альберто Пикко", 10150, "#FFFFFF", "#000000"),
      club("Кремонезе", "Кремона", 66, "cremonese", "Джованни Зини", 20641, "#B4093C", "#8C8C8C", "stripes"),
      club("Палермо", "Палермо", 66, "palermo", "Ренцо Барбера", 36349, "#EE7EA6", "#000000"),
      club("Брешиа", "Брешиа", 65, "brescia", "Марио Ригамонти", 16317, "#0A3A82", "#FFFFFF", "stripes"),
      club("Сампдория", "Генуя", 65, "sampdoria", "Луиджи Феррарис", 33205, "#FFFFFF", "#1B449C", "sash"),
      club("Бари", "Бари", 64, "bari", "Сан-Никола", 58000, "#B4093C", "#FFFFFF"),
      club("Салернитана", "Салерно", 64, "salernitana", "Арекки", 37245, "#6E1B33", "#FFFFFF", "stripes"),
      club("Фрозиноне", "Фрозиноне", 64, "frosinone", "Бенито Стирпе", 16227, "#FFF200", "#0A3A82"),
      club("Катандзаро", "Катандзаро", 63, "catanzaro", "Никола Сераволо", 14779, "#E21C38", "#F6EB61", "stripes"),
      club("Чезена", "Чезена", 63, "cesena", "Оромео", 23960, "#FFFFFF", "#000000"),
      club("Модена", "Модена", 62, "modena", "Альберто Брагалья", 21151, "#F6EB61", "#0A3A82"),
      club("Реджана", "Реджио-Калабрия", 62, "reggiana", "Оресте Гранилло", 9298, "#B4093C", "#FFFFFF", "stripes"),
      club("Козенца", "Козенца", 61, "cosenza", "Сан Вито", 24263, "#8E1F2F", "#0A3A82"),
      club("Юве Стабия", "Кастелламмаре-ди-Стабия", 60, "juve-stabia", "Ромео Менти", 7500, "#F6EB61", "#0A3A82"),
      club("Мантова", "Мантуя", 60, "mantova", "Данило Мартелли", 7500, "#B4093C", "#FFFFFF"),
      club("Каррарезе", "Каррара", 59, "carrarese", "Деи Марми", 11525, "#F6EB61", "#1B449C"),
      club("Кротоне", "Кротоне", 60, "crotone", "Эзио Скура", 16547, "#B4093C", "#0A3A82", "stripes"),
      club("Асколи", "Асколи-Пичено", 58, "ascoli", "Чино и Лилло Дель Дука", 24578, "#FFFFFF", "#000000", "stripes"),
    ],
  },
  {
    id: "ger2",
    name: "Вторая Бундеслига",
    short: "Бундеслига 2",
    country: "Германия",
    cupName: "Кубок Германии",
    accent: "#7c3aed",
    top: false,
    clubs: [
      club("Гамбург", "Гамбург", 71, "hamburg", "Фолькспаркстадион", 57000, "#0A3A82", "#000000"),
      club("Кёльн", "Кёльн", 70, "koln", "РайнЭнерги", 50000, "#FFFFFF", "#E21C38", "stripes"),
      club("Шальке 04", "Гельзенкирхен", 69, "schalke-04", "Фельтинс-Арена", 62271, "#004FA3", "#FFFFFF", "stripes"),
      club("Герта", "Берлин", 68, "hertha", "Олимпиаштадион", 74667, "#004FA3", "#FFFFFF", "stripes"),
      club("Фортуна Дюссельдорф", "Дюссельдорф", 66, "fortuna-dusseldorf", "Меркур Шпиль-Арена", 54600, "#B4093C", "#FFFFFF"),
      club("Ганновер 96", "Ганновер", 66, "hannover-96", "ХДИ-Арена", 49000, "#009A44", "#FFFFFF", "stripes"),
      club("Нюрнберг", "Нюрнберг", 65, "nurnberg", "Макс-Морлок", 50000, "#B4093C", "#FFFFFF"),
      club("Кайзерслаутерн", "Кайзерслаутерн", 65, "kaiserslautern", "Фритц-Вальтер", 49780, "#B4093C", "#FFFFFF", "stripes"),
      club("Карлсруэ", "Карлсруэ", 63, "karlsruher", "Вильдпарк", 34302, "#0069B4", "#F6EB61", "stripes"),
      club("Падерборн", "Падерборн", 63, "paderborn", "Бентелер-Арена", 15000, "#0A3A82", "#FFFFFF"),
      club("Дармштадт", "Дармштадт", 63, "darmstadt", "Мерек Штадион", 17810, "#004FA3", "#FFFFFF"),
      club("Гройтер Фюрт", "Фюрт", 62, "greuther-furth", "Спортпарк Ронхоф", 16626, "#006933", "#FFFFFF"),
      club("Магдебург", "Магдебург", 62, "magdeburg", "MDCC-Арена", 30098, "#0069B4", "#FFFFFF"),
      club("Брауншвейг", "Брауншвейг", 61, "braunschweig", "Айнтрахт-штадион", 23325, "#F6EB61", "#0A3A82"),
      club("Ганза Росток", "Росток", 61, "hansa-rostock", "Остзештадион", 29000, "#004FA3", "#FFFFFF"),
      club("Пройссен Мюнстер", "Мюнстер", 60, "preussen-munster", "Преуссен-Штадион", 15050, "#000000", "#F6EB61", "stripes"),
      club("Эльверсберг", "Шпизен-Эльверсберг", 60, "elversberg", "УРС-Арена", 10000, "#FFFFFF", "#1B449C"),
      club("Ульм", "Ульм", 59, "ulm", "Донауштадион", 19500, "#000000", "#FFFFFF"),
    ],
  },
  {
    id: "fra2",
    name: "Лига 2",
    short: "Лига 2",
    country: "Франция",
    cupName: "Кубок Франции",
    accent: "#b45309",
    top: false,
    clubs: [
      club("Мец", "Мец", 70, "metz", "Сент-Симфорьен", 30000, "#7B1E23", "#FFFFFF"),
      club("Труа", "Труа", 67, "troyes", "Об", 20400, "#0A3A82", "#FFFFFF"),
      club("Гренобль", "Гренобль", 65, "grenoble", "Ле Аль", 20008, "#0069B4", "#FFFFFF"),
      club("Кан", "Кан", 65, "caen", "Мишель д'Орнано", 21500, "#0A3A82", "#F6EB61", "stripes"),
      club("Генгам", "Генгам", 64, "guingamp", "Рудуру", 18725, "#B4093C", "#000000", "sash"),
      club("Амьен", "Амьен", 64, "amiens", "Крюсе", 12000, "#FFFFFF", "#000000"),
      club("Лаваль", "Лаваль", 63, "laval", "Франсис Ле Бассер", 18500, "#F58220", "#000000"),
      club("По", "По", 63, "pau", "Нуво Стад де По", 15000, "#0A3A82", "#F6EB61"),
      club("Бастиа", "Бастиа", 62, "bastia", "Армани-Чезари", 16500, "#0A3A82", "#FFFFFF", "stripes"),
      club("Аяччо", "Аяччо", 62, "ajaccio", "Франсуа Котти", 10660, "#B4093C", "#FFFFFF", "stripes"),
      club("Анси", "Анси", 62, "annecy", "Парк де Спорт", 15600, "#B4093C", "#FFFFFF"),
      club("Клермон", "Клермон-Ферран", 62, "clermont", "Габриэль Монтпье", 11980, "#0A3A82", "#FFFFFF"),
      club("Дюнкерк", "Дюнкерк", 61, "dunkerque", "Марсель-Трибу", 4550, "#0A3A82", "#F6EB61"),
      club("Ред Стар", "Сен-Уан", 61, "red-star", "Пьер Брисон", 10000, "#006933", "#FFFFFF"),
      club("Валансьен", "Валансьен", 61, "valenciennes", "Эно", 25172, "#FFFFFF", "#0A3A82"),
      club("Ним", "Ним", 60, "nimes", "Костьер", 18482, "#B4093C", "#FFFFFF"),
      club("Кретей", "Кретей", 60, "creteil", "Доминик-Дюваошери", 12200, "#0A3A82", "#FFFFFF", "stripes"),
      club("Родез", "Родез", 60, "rodez", "Поль Линь", 5955, "#F6EB61", "#0A3A82", "stripes"),
    ],
  },
];

export const LEAGUE_BY_ID: Record<string, LeagueData> = Object.fromEntries(
  LEAGUES.map((l) => [l.id, l]),
);

/** Только топ-дивизионы (отбор в ЛЧ/ЛЕ) */
export const TOP_LEAGUES = LEAGUES.filter((l) => l.top);

/** Базовый id страны по id лиги: eng2 → eng, ita → ita */
export function leagueBaseId(leagueId: string): string {
  return leagueId.endsWith("2") ? leagueId.slice(0, -1) : leagueId;
}

/** Это второй дивизион? */
export function isSecondDivision(leagueId: string): boolean {
  return LEAGUE_BY_ID[leagueId]?.top === false;
}

/** Пара дивизионов страны: [топ, второй] или null (для топ-лиг без второго) */
export function divisionPair(leagueId: string): [LeagueData, LeagueData] | null {
  const top = LEAGUE_BY_ID[leagueBaseId(leagueId)];
  if (!top) return null;
  const second = LEAGUES.find((l) => l.id === `${top.id}2`);
  return second ? [top, second] : null;
}

export const ALL_CLUBS: ClubData[] = LEAGUES.flatMap((l) => l.clubs);

export function findLeagueByClub(clubName: string): LeagueData | null {
  return LEAGUES.find((l) => l.clubs.some((c) => c.name === clubName)) ?? null;
}

export function findClub(clubName: string): ClubData | null {
  return ALL_CLUBS.find((c) => c.name === clubName) ?? null;
}

/** Слаг логотипа по названию клуба (null — нет данных, показываем инициалы) */
export function clubSlug(clubName: string): string | null {
  return findClub(clubName)?.slug ?? null;
}

/** Цвета формы клуба (дефолт для неизвестных названий) */
export function clubKit(clubName: string): KitColors {
  return findClub(clubName)?.kit ?? { primary: "#3f3f46", secondary: "#a1a1aa", pattern: "solid" };
}

// ─────────────────── Логотипы и темы турниров ───────────────────

export const UCL_KEY = "ucl";
export const UCL_NAME = "Лига чемпионов УЕФА";
export const UEL_KEY = "uel";
export const UEL_NAME = "Лига Европы УЕФА";

/** Слаг логотипа турнира (public/logos/competitions/<slug>.png) */
export const COMPETITION_LOGOS: Record<string, string> = {
  eng: "premier-league",
  esp: "la-liga",
  ita: "serie-a",
  ger: "bundesliga",
  fra: "ligue-1",
  ucl: "ucl",
  uel: "uel",
  "cup:eng": "fa-cup",
  "cup:esp": "copa-del-rey",
  "cup:ita": "coppa-italia",
  "cup:ger": "dfb-pokal",
  "cup:fra": "coupe-de-france",
};

/** Путь к файлу логотипа турнира или null */
export function competitionLogoPath(key: string): string | null {
  const slug = COMPETITION_LOGOS[key];
  return slug ? `/logos/competitions/${slug}.png` : null;
}

export interface CompetitionTheme {
  /** Название турнира для шапки */
  name: string;
  /** Акцентный цвет */
  accent: string;
  /** Основной цвет фона шапки */
  bg: string;
  /** Дополнительный цвет градиента */
  bg2: string;
  /** Ключ логотипа */
  logoKey: string;
  /** Эмодзи/символ узора */
  icon: string;
}

/**
 * Темы оформления по типу турнира: чемпионат, национальный кубок, Лига чемпионов.
 * Ключи: league:<id> | cup:<id> | ucl
 */
export const COMPETITION_THEMES: Record<string, CompetitionTheme> = {
  "league:eng": { name: "Английская Премьер-лига", accent: "#e90052", bg: "#1a0526", bg2: "#38093f", logoKey: "eng", icon: "🦁" },
  "league:esp": { name: "Ла Лига", accent: "#ff6b3d", bg: "#2b0f04", bg2: "#4a1a06", logoKey: "esp", icon: "⚽" },
  "league:ita": { name: "Серия А", accent: "#0b5cff", bg: "#041233", bg2: "#0a2058", logoKey: "ita", icon: "🇮🇹" },
  "league:ger": { name: "Бундеслига", accent: "#d20515", bg: "#26060a", bg2: "#45090f", logoKey: "ger", icon: "🦅" },
  "league:fra": { name: "Лига 1", accent: "#c6ff00", bg: "#04101f", bg2: "#0a1e3a", logoKey: "fra", icon: "🐓" },
  "league:eng2": { name: "Чемпионшип", accent: "#4f7bff", bg: "#040b22", bg2: "#081741", logoKey: "eng", icon: "🦁" },
  "league:esp2": { name: "Сегунда", accent: "#22c58b", bg: "#03150f", bg2: "#062a1c", logoKey: "esp", icon: "⚽" },
  "league:ita2": { name: "Серия Б", accent: "#37b96b", bg: "#03180d", bg2: "#073018", logoKey: "ita", icon: "🇮🇹" },
  "league:ger2": { name: "Вторая Бундеслига", accent: "#a26bff", bg: "#0e0626", bg2: "#1c0c45", logoKey: "ger", icon: "🦅" },
  "league:fra2": { name: "Лига 2", accent: "#f0a63a", bg: "#170b02", bg2: "#2b1504", logoKey: "fra", icon: "🐓" },
  "cup:eng": { name: "Кубок Англии", accent: "#00c56f", bg: "#03271a", bg2: "#06452c", logoKey: "cup:eng", icon: "🟢" },
  "cup:esp": { name: "Кубок Испании", accent: "#d9a441", bg: "#251003", bg2: "#3f1d06", logoKey: "cup:esp", icon: "👑" },
  "cup:ita": { name: "Кубок Италии", accent: "#39a0ff", bg: "#04182b", bg2: "#072a47", logoKey: "cup:ita", icon: "🏆" },
  "cup:ger": { name: "Кубок Германии", accent: "#ffd23f", bg: "#1f1602", bg2: "#382803", logoKey: "cup:ger", icon: "🥇" },
  "cup:fra": { name: "Кубок Франции", accent: "#5aa9ff", bg: "#051426", bg2: "#0a2240", logoKey: "cup:fra", icon: "🎖" },
  ucl: { name: "Лига чемпионов УЕФА", accent: "#5b7fdb", bg: "#050b2e", bg2: "#0d1554", logoKey: "ucl", icon: "⭐" },
  uel: { name: "Лига Европы УЕФА", accent: "#ff8c1a", bg: "#1f0d02", bg2: "#3d1a05", logoKey: "uel", icon: "🟠" },
};

/** Тема турнира по типу и ключу */
export function competitionTheme(kind: "league" | "cup" | "ucl" | "uel", leagueId: string): CompetitionTheme {
  if (kind === "ucl") return COMPETITION_THEMES.ucl;
  if (kind === "uel") return COMPETITION_THEMES.uel;
  return COMPETITION_THEMES[`${kind}:${leagueId}`] ?? COMPETITION_THEMES[`league:${leagueId}`] ?? COMPETITION_THEMES["league:eng"];
}

/** Лимит банкротства клуба */
export const BANKRUPT_LIMIT = -5_000_000;

/** Стартовый бюджет клуба: «5 + (сила − 62) × 0.6» млн € */
export function clubBudget(power: number): number {
  return Math.round((5 + Math.max(0, power - 62) * 0.6) * 1_000_000);
}
