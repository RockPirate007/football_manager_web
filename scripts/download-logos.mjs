#!/usr/bin/env node
/**
 * Массовое скачивание логотипов клубов и турниров через z-ai image-search.
 * Выбирает наиболее «логотипный» результат (квадратный, достаточного размера).
 * Повторный запуск пропускает уже скачанные файлы.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

const exec = promisify(execFile);
const ROOT = "/home/z/my-project";
const CACHE = path.join(ROOT, "tmp/logos/json");
const TEAMS_DIR = path.join(ROOT, "public/logos/teams");
const COMP_DIR = path.join(ROOT, "public/logos/competitions");
mkdirSync(CACHE, { recursive: true });
mkdirSync(TEAMS_DIR, { recursive: true });
mkdirSync(COMP_DIR, { recursive: true });

const TEAMS = {
  "manchester-city": "Manchester City FC club crest logo",
  "arsenal": "Arsenal FC club crest logo",
  "liverpool": "Liverpool FC club crest logo",
  "chelsea": "Chelsea FC club crest logo",
  "manchester-united": "Manchester United FC club crest logo",
  "tottenham": "Tottenham Hotspur club crest logo",
  "newcastle": "Newcastle United club crest logo",
  "aston-villa": "Aston Villa FC club crest logo",
  "brighton": "Brighton and Hove Albion club crest logo",
  "west-ham": "West Ham United club crest logo",
  "real-madrid": "Real Madrid CF club crest logo",
  "barcelona": "FC Barcelona club crest logo",
  "atletico-madrid": "Atletico de Madrid club crest logo",
  "athletic-bilbao": "Athletic Club Bilbao crest logo",
  "real-sociedad": "Real Sociedad club crest logo",
  "villarreal": "Villarreal CF club crest logo",
  "betis": "Real Betis club crest logo",
  "girona": "Girona FC club crest logo",
  "sevilla": "Sevilla FC club crest logo",
  "valencia": "Valencia CF club crest logo",
  "inter": "Inter Milan club crest logo",
  "milan": "AC Milan club crest logo",
  "juventus": "Juventus FC club crest logo",
  "napoli": "SSC Napoli club crest logo",
  "atalanta": "Atalanta BC club crest logo",
  "roma": "AS Roma club crest logo",
  "lazio": "SS Lazio club crest logo",
  "fiorentina": "ACF Fiorentina club crest logo",
  "bologna": "Bologna FC club crest logo",
  "torino": "Torino FC club crest logo",
  "bayern-munich": "FC Bayern Munich club crest logo",
  "bayer-leverkusen": "Bayer 04 Leverkusen club crest logo",
  "borussia-dortmund": "Borussia Dortmund club crest logo",
  "rb-leipzig": "RB Leipzig club crest logo",
  "stuttgart": "VfB Stuttgart club crest logo",
  "eintracht-frankfurt": "Eintracht Frankfurt club crest logo",
  "wolfsburg": "VfL Wolfsburg club crest logo",
  "freiburg": "SC Freiburg club crest logo",
  "gladbach": "Borussia Monchengladbach club crest logo",
  "hoffenheim": "TSG Hoffenheim club crest logo",
  "psg": "Paris Saint-Germain club crest logo",
  "monaco": "AS Monaco FC club crest logo",
  "marseille": "Olympique de Marseille club crest logo",
  "lille": "LOSC Lille club crest logo",
  "lyon": "Olympique Lyonnais club crest logo",
  "nice": "OGC Nice club crest logo",
  "lens": "RC Lens club crest logo",
  "rennes": "Stade Rennais club crest logo",
  "brest": "Stade Brestois club crest logo",
  "strasbourg": "RC Strasbourg club crest logo",
};

const COMPS = {
  "premier-league": "Premier League official logo",
  "la-liga": "LaLiga official logo",
  "serie-a": "Serie A Italy official logo",
  "bundesliga": "Bundesliga official logo",
  "ligue-1": "Ligue 1 official logo",
  "ucl": "UEFA Champions League logo",
  "fa-cup": "FA Cup England logo",
  "copa-del-rey": "Copa del Rey logo",
  "coppa-italia": "Coppa Italia logo",
  "dfb-pokal": "DFB Pokal logo",
  "coupe-de-france": "Coupe de France logo",
};

/** Оценка кандидата: квадратность + размер */
function score(r) {
  const w = parseInt(r.original_width) || 0;
  const h = parseInt(r.original_height) || 0;
  if (w < 120 || h < 120) return -1;
  const ratio = Math.min(w, h) / Math.max(w, h);
  const size = Math.min(w, h);
  return ratio * 100 + Math.min(size, 600) * 0.05;
}

async function searchQuery(query, slug) {
  const cacheFile = path.join(CACHE, `${slug}.json`);
  if (existsSync(cacheFile)) {
    try {
      const cached = JSON.parse(readFileSync(cacheFile, "utf8"));
      if (cached?.success && Array.isArray(cached.results) && cached.results.length > 0) {
        return cached;
      }
    } catch {}
  }
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const { stdout } = await exec("z-ai", [
        "image-search", "-q", query, "--count", "6", "--gl", "us", "--no-rank",
      ], { timeout: 150_000, maxBuffer: 10 * 1024 * 1024 });
      const idx = stdout.indexOf("{");
      const data = JSON.parse(stdout.slice(idx));
      if (data?.success && Array.isArray(data.results) && data.results.length > 0) {
        writeFileSync(cacheFile, JSON.stringify(data, null, 2));
        return data;
      }
      console.log(`  attempt ${attempt} ${slug}: empty results`);
    } catch (e) {
      console.log(`  attempt ${attempt} ${slug}: ${e.message.slice(0, 80)}`);
    }
    await new Promise((r) => setTimeout(r, 8000 * attempt));
  }
  return null;
}

async function download(url, dest) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await exec("curl", ["-sL", "--max-time", "60", "-o", dest, url], { timeout: 70_000 });
      return true;
    } catch (e) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  return false;
}

async function processOne(slug, query, dir) {
  const dest = path.join(dir, `${slug}.png`);
  if (existsSync(dest)) {
    console.log(`skip ${slug}`);
    return { slug, ok: true, skipped: true };
  }
  const data = await searchQuery(query, slug);
  if (!data || !data.success || !Array.isArray(data.results) || data.results.length === 0) {
    console.log(`EMPTY ${slug}`);
    return { slug, ok: false };
  }
  const ranked = data.results
    .map((r) => ({ r, s: score(r) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);
  if (ranked.length === 0) {
    console.log(`NO-CANDIDATE ${slug}`);
    return { slug, ok: false };
  }
  const ok = await download(ranked[0].r.original_url, dest);
  if (!ok) {
    console.log(`DL-FAIL ${slug}`);
    return { slug, ok: false };
  }
  const { statSync } = await import("node:fs");
  const size = statSync(dest).size;
  if (size < 3000) {
    const alt = ranked[1];
    if (alt && (await download(alt.r.original_url, dest)) && statSync(dest).size < 3000) {
      console.log(`TINY ${slug}`);
      return { slug, ok: false };
    }
  }
  console.log(`OK ${slug} (${Math.round(size / 1024)}KB, ${ranked[0].r.original_width}x${ranked[0].r.original_height})`);
  return { slug, ok: true };
}

async function runPool(items, fn, poolSize) {
  const queue = [...items];
  const workers = Array.from({ length: poolSize }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      await fn(item);
    }
  });
  await Promise.all(workers);
}

async function main() {
  const only = process.argv[2];
  if (!only || only === "teams") {
    const entries = Object.entries(TEAMS);
    await runPool(entries, async ([slug, q]) => {
      await processOne(slug, q, TEAMS_DIR);
      await new Promise((r) => setTimeout(r, 3000));
    }, 1);
  }
  if (!only || only === "comps") {
    const entries = Object.entries(COMPS);
    for (const [slug, q] of entries) {
      await processOne(slug, q, COMP_DIR);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  console.log("ALL_DONE");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
