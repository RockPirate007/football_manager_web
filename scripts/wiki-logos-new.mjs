/**
 * Скачивание логотипов 46 новых клубов с Wikipedia.
 * Запуск: node scripts/wiki-logos-new.mjs
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";

const CLUBS = {
  // АПЛ
  "crystal-palace": "Crystal_Palace_F.C.",
  everton: "Everton_F.C.",
  fulham: "Fulham_F.C.",
  wolverhampton: "Wolverhampton_Wanderers_F.C.",
  brentford: "Brentford_F.C.",
  "nottingham-forest": "Nottingham_Forest_F.C.",
  bournemouth: "AFC_Bournemouth",
  leicester: "Leicester_City_F.C.",
  ipswich: "Ipswich_Town_F.C.",
  southampton: "Southampton_F.C.",
  // Ла Лига
  "celta-vigo": "RC_Celta_de_Vigo",
  osasuna: "CA_Osasuna",
  "rayo-vallecano": "Rayo_Vallecano",
  mallorca: "RCD_Mallorca",
  getafe: "Getafe_CF",
  alaves: "Deportivo_Alav%C3%A9s",
  "las-palmas": "UD_Las_Palmas",
  espanyol: "RCD_Espanyol",
  leganes: "CD_Legan%C3%A9s",
  "real-valladolid": "Real_Valladolid",
  // Серия А
  udinese: "Udinese_Calcio",
  genoa: "Genoa_C.F.C.",
  cagliari: "Cagliari_Calcio",
  empoli: "Empoli_F.C.",
  "hellas-verona": "Hellas_Verona_FC",
  parma: "Parma_Calcio_1913",
  monza: "AC_Monza",
  lecce: "US_Lecce",
  como: "Como_1907",
  venezia: "Venezia_FC",
  // Бундеслига
  augsburg: "FC_Augsburg",
  mainz: "1._FSV_Mainz_05",
  "werder-bremen": "SV_Werder_Bremen",
  "union-berlin": "1._FC_Union_Berlin",
  bochum: "VfL_Bochum",
  "st-pauli": "FC_St._Pauli",
  heidenheim: "FC_Heidenheim",
  "holstein-kiel": "Holstein_Kiel",
  // Лига 1
  toulouse: "Toulouse_FC",
  nantes: "FC_Nantes",
  reims: "Stade_de_Reims",
  auxerre: "AJ_Auxerre",
  montpellier: "Montpellier_HSC",
  angers: "Angers_SCR",
  lorient: "FC_Lorient",
  havre: "Le_Havre_AC",
};

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const outDir = "public/logos/teams";
mkdirSync(outDir, { recursive: true });

async function fetchJson(url, opts = {}) {
  for (let i = 0; i < 4; i++) {
    const res = await fetch(url, { headers: { "User-Agent": UA }, ...opts });
    if (res.ok) return res.json();
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 4000 * (i + 1)));
      continue;
    }
    throw new Error(`HTTP ${res.status}`);
  }
  throw new Error("HTTP 429 (retries exhausted)");
}

function findImage(obj, depth = 0) {
  if (depth > 6 || obj === null || typeof obj !== "object") return null;
  if (typeof obj === "string") {
    if (/\.(svg|png)$/i.test(obj) && /(logo|crest|badge)/i.test(obj)) return obj;
    return null;
  }
  if (Array.isArray(obj)) {
    for (const v of obj) {
      const r = findImage(v, depth + 1);
      if (r) return r;
    }
    return null;
  }
  // Приоритет: infobox image / logo
  for (const key of ["image", "logo", "crest", "image_logo", "badge", "logo_image"]) {
    if (obj[key]) {
      const r = typeof obj[key] === "string" ? obj[key] : findImage(obj[key], depth + 1);
      if (r) return r;
    }
  }
  for (const v of Object.values(obj)) {
    const r = findImage(v, depth + 1);
    if (r) return r;
  }
  return null;
}

async function main() {
  let ok = 0, skip = 0, fail = 0;
  for (const [slug, title] of Object.entries(CLUBS)) {
    const svgPath = `${outDir}/${slug}.svg`;
    const pngPath = `${outDir}/${slug}.png`;
    if (existsSync(svgPath) || existsSync(pngPath)) { skip++; continue; }
    try {
      const page = await fetchJson(
        `https://en.wikipedia.org/w/api.php?action=parse&page=${title}&prop=wikitext&format=json&redirects=1`,
      );
      const wikitext = page.parse?.wikitext?.["*"] ?? "";
      // Ищем infobox image
      const m = wikitext.match(/\|\s*(?:image_logo|logo|image|crest)\s*=\s*([^\n|]+)/i);
      if (!m) { console.log(`нет image: ${slug}`); fail++; continue; }
      const fileName = m[1].trim().replace(/^\[?\[/, "").replace(/\]?]$/, "");
      if (!/\.(svg|png|gif|jpg)$/i.test(fileName)) { console.log(`не файл: ${slug} (${fileName})`); fail++; continue; }
      const info = await fetchJson(
        `https://commons.wikimedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(fileName.replace(/\s/g, "_"))}&prop=imageinfo&iiprop=url&format=json`,
      );
      const pages = info.query?.pages ?? {};
      const first = Object.values(pages)[0];
      const url = first?.imageinfo?.[0]?.url;
      if (!url) { console.log(`нет URL: ${slug}`); fail++; continue; }
      const ext = url.toLowerCase().endsWith(".svg") ? "svg" : "png";
      const img = await fetch(url, { headers: { "User-Agent": UA } });
      if (!img.ok) { console.log(`ошибка скачивания: ${slug}`); fail++; continue; }
      const buf = Buffer.from(await img.arrayBuffer());
      if (buf.length < 1200) { console.log(`слишком мал: ${slug}`); fail++; continue; }
      writeFileSync(`${outDir}/${slug}.${ext}`, buf);
      console.log(`OK: ${slug}.${ext} (${(buf.length / 1024).toFixed(0)} KB)`);
      ok++;
      await new Promise((r) => setTimeout(r, 1200));
    } catch (e) {
      console.log(`FAIL: ${slug}: ${e.message}`);
      fail++;
    }
  }
  console.log(`\nИтого: ok=${ok} skip=${skip} fail=${fail}`);
}

main();
