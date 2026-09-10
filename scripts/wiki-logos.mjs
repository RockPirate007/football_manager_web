#!/usr/bin/env node
/**
 * Логотипы через Wikipedia: из инфобокса статьи вытаскиваем точное имя
 * файла герба, скачиваем через Special:FilePath (SVG сохраняем как .svg).
 * Компоненты TeamLogo/CompLogo пробуют .png → .svg → инициалы.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFileSync, statSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const exec = promisify(execFile);
const ROOT = "/home/z/my-project";
const TEAMS_DIR = path.join(ROOT, "public/logos/teams");
const COMP_DIR = path.join(ROOT, "public/logos/competitions");
const CACHE = path.join(ROOT, "tmp/logos/wiki2");
mkdirSync(CACHE, { recursive: true });

const TEAMS = {
  "manchester-city": "Manchester City F.C.",
  "arsenal": "Arsenal F.C.",
  "liverpool": "Liverpool F.C.",
  "chelsea": "Chelsea F.C.",
  "manchester-united": "Manchester United F.C.",
  "tottenham": "Tottenham Hotspur F.C.",
  "newcastle": "Newcastle United F.C.",
  "aston-villa": "Aston Villa F.C.",
  "brighton": "Brighton & Hove Albion F.C.",
  "west-ham": "West Ham United F.C.",
  "real-madrid": "Real Madrid CF",
  "barcelona": "FC Barcelona",
  "atletico-madrid": "Atlético Madrid",
  "athletic-bilbao": "Athletic Bilbao",
  "real-sociedad": "Real Sociedad",
  "villarreal": "Villarreal CF",
  "betis": "Real Betis",
  "girona": "Girona FC",
  "sevilla": "Sevilla FC",
  "valencia": "Valencia CF",
  "inter": "Inter Milan",
  "milan": "AC Milan",
  "juventus": "Juventus FC",
  "napoli": "SSC Napoli",
  "atalanta": "Atalanta BC",
  "roma": "AS Roma",
  "lazio": "SS Lazio",
  "fiorentina": "ACF Fiorentina",
  "bologna": "Bologna FC 1909",
  "torino": "Torino FC",
  "bayern-munich": "FC Bayern Munich",
  "bayer-leverkusen": "Bayer 04 Leverkusen",
  "borussia-dortmund": "Borussia Dortmund",
  "rb-leipzig": "RB Leipzig",
  "stuttgart": "VfB Stuttgart",
  "eintracht-frankfurt": "Eintracht Frankfurt",
  "wolfsburg": "VfL Wolfsburg",
  "freiburg": "SC Freiburg",
  "gladbach": "Borussia Mönchengladbach",
  "hoffenheim": "TSG 1899 Hoffenheim",
  "psg": "Paris Saint-Germain F.C.",
  "monaco": "AS Monaco FC",
  "marseille": "Olympique de Marseille",
  "lille": "LOSC Lille",
  "lyon": "Olympique Lyonnais",
  "nice": "OGC Nice",
  "lens": "RC Lens",
  "rennes": "Stade Rennais F.C.",
  "brest": "Stade Brestois 29",
  "strasbourg": "RC Strasbourg Alsace",
};

const COMPS = {
  "premier-league": "Premier League",
  "la-liga": "La Liga",
  "serie-a": "Serie A",
  "bundesliga": "Bundesliga",
  "ligue-1": "Ligue 1",
  "ucl": "UEFA Champions League",
  "fa-cup": "FA Cup",
  "copa-del-rey": "Copa del Rey",
  "coppa-italia": "Coppa Italia",
  "dfb-pokal": "DFB-Pokal",
  "coupe-de-france": "Coupe de France",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function curlWithRetry(args, tries = 5) {
  for (let i = 1; i <= tries; i++) {
    try {
      const { stdout } = await exec("curl", [...args, "-w", "\n%{http_code}"], { timeout: 90_000, maxBuffer: 20 * 1024 * 1024 });
      const nl = stdout.lastIndexOf("\n");
      const code = stdout.slice(nl + 1).trim();
      const body = stdout.slice(0, nl);
      if (code === "429" || code === "503") {
        console.log(`  http ${code}, retry ${i}`);
        await sleep(8000 * i);
        continue;
      }
      return body;
    } catch (e) {
      if (i === tries) throw e;
      await sleep(6000 * i);
    }
  }
  throw new Error("curl retries exhausted");
}

/** Имя файла логотипа из инфобокса (секция 0 статьи) */
async function logoFileName(title) {
  const cacheFile = path.join(CACHE, `${title.replace(/[^a-z0-9]/gi, "_")}.txt`);
  if (existsSync(cacheFile)) {
    const { readFileSync } = await import("node:fs");
    const cached = readFileSync(cacheFile, "utf8");
    if (cached && cached !== "NONE") return cached;
    return null;
  }
  const url =
    `https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content` +
    `&rvslots=main&rvsection=0&titles=${encodeURIComponent(title)}&format=json&redirects=1`;
  let file = null;
  try {
    const stdout = await curlWithRetry([
      "-sL", "--max-time", "40", "-A", "FootballManagerGame/1.0 (local)", url,
    ]);
    const data = JSON.parse(stdout);
    const pages = data?.query?.pages ?? {};
    const page = Object.values(pages)[0];
    const wikitext = page?.revisions?.[0]?.slots?.main?.["*"] ?? "";
    // Варианты: | image = [[File:Foo.svg|...]] | image = Foo.svg{{!}}class=skin-invert | logo = ...
    const raw =
      wikitext.match(/\|\s*image\s*=\s*([^\n]+)/i) ||
      wikitext.match(/\|\s*(?:badge|crest|logo)\s*=\s*([^\n]+)/i) ||
      wikitext.match(/\[\[(?:File|Image):([^\]|\n]+\.svg)/i);
    if (raw) {
      const cleaned = raw[1]
        .replace(/\[\[(?:File|Image):/gi, "")
        .replace(/\]\]/g, "")
        .split("{{")[0]       // срезаем шаблоны {{!}}class=skin-invert
        .split("|")[0]
        .trim();
      if (/\.(svg|png|gif|jpe?g)$/i.test(cleaned)) file = cleaned;
    }
  } catch {}
  writeFileSync(cacheFile, file ?? "NONE");
  return file;
}

/** Скачать файл логотипа через Special:FilePath */
async function downloadLogo(file, destBase) {
  const url = `https://en.wikipedia.org/wiki/Special:FilePath/${encodeURIComponent(file.replace(/ /g, "_"))}`;
  const isSvg = /\.svg$/i.test(file);
  const dest = `${destBase}.${isSvg ? "svg" : "png"}`;
  try {
    const out = await curlWithRetry([
      "-sL", "--max-time", "60", "-A", "FootballManagerGame/1.0 (local)", "-o", dest, url,
    ]);
    void out;
    const { readFileSync } = await import("node:fs");
    const buf = readFileSync(dest);
    if (buf.length < 2500 || buf.slice(0, 40).toString().includes("<!DOCTYPE") || buf.slice(0, 40).toString().includes("<html")) {
      // Ошибка/заглушка
      await import("node:fs").then((fs) => fs.unlinkSync(dest));
      return null;
    }
    return path.basename(dest);
  } catch {
    return null;
  }
}

async function processOne(slug, title, dir) {
  const existing = ["png", "svg"].map((e) => path.join(dir, `${slug}.${e}`));
  if (existing.some((f) => existsSync(f))) {
    console.log(`skip ${slug}`);
    return true;
  }
  const file = await logoFileName(title);
  if (!file) {
    console.log(`NO-FILE ${slug} (${title})`);
    return false;
  }
  const saved = await downloadLogo(file, path.join(dir, slug));
  if (!saved) {
    console.log(`DL-FAIL ${slug} ← ${file}`);
    return false;
  }
  console.log(`OK ${slug} ← ${saved} (${Math.round(statSync(path.join(dir, saved)).size / 1024)}KB)`);
  return true;
}

async function main() {
  let ok = 0;
  let total = 0;
  for (const [slug, title] of Object.entries(TEAMS)) {
    total++;
    if (await processOne(slug, title, TEAMS_DIR)) ok++;
    await sleep(2500);
  }
  for (const [slug, title] of Object.entries(COMPS)) {
    total++;
    if (await processOne(slug, title, COMP_DIR)) ok++;
    await sleep(2500);
  }
  console.log(`DONE ${ok}/${total}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
