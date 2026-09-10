#!/usr/bin/env node
/** Логотип Лиги Европы УЕФА (как в wiki-logos.mjs, но точечно). */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { statSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const exec = promisify(execFile);
const ROOT = "/home/z/my-project";
const COMP_DIR = path.join(ROOT, "public/logos/competitions");
const CACHE = path.join(ROOT, "tmp/logos/wiki2");
mkdirSync(CACHE, { recursive: true });

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

async function logoFileName(title) {
  const cacheFile = path.join(CACHE, `${title.replace(/[^a-z0-9]/gi, "_")}.txt`);
  const { readFileSync, writeFileSync } = await import("node:fs");
  if (existsSync(cacheFile)) {
    const cached = readFileSync(cacheFile, "utf8");
    return cached && cached !== "NONE" ? cached : null;
  }
  const url =
    `https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content` +
    `&rvslots=main&rvsection=0&titles=${encodeURIComponent(title)}&format=json&redirects=1`;
  let file = null;
  try {
    const stdout = await curlWithRetry(["-sL", "--max-time", "40", "-A", "FootballManagerGame/1.0 (local)", url]);
    const data = JSON.parse(stdout);
    const pages = data?.query?.pages ?? {};
    const page = Object.values(pages)[0];
    const wikitext = page?.revisions?.[0]?.slots?.main?.["*"] ?? "";
    const raw =
      wikitext.match(/\|\s*image\s*=\s*([^\n]+)/i) ||
      wikitext.match(/\|\s*(?:badge|crest|logo)\s*=\s*([^\n]+)/i) ||
      wikitext.match(/\[\[(?:File|Image):([^\]|\n]+\.svg)/i);
    if (raw) {
      const cleaned = raw[1]
        .replace(/\[\[(?:File|Image):/gi, "")
        .replace(/\]\]/g, "")
        .split("{{")[0]
        .split("|")[0]
        .trim();
      if (/\.(svg|png|gif|jpe?g)$/i.test(cleaned)) file = cleaned;
    }
  } catch {}
  writeFileSync(cacheFile, file ?? "NONE");
  return file;
}

async function downloadLogo(file, destBase) {
  const url = `https://en.wikipedia.org/wiki/Special:FilePath/${encodeURIComponent(file.replace(/ /g, "_"))}`;
  const isSvg = /\.svg$/i.test(file);
  const dest = `${destBase}.${isSvg ? "svg" : "png"}`;
  const { readFileSync, unlinkSync } = await import("node:fs");
  try {
    await curlWithRetry(["-sL", "--max-time", "60", "-A", "FootballManagerGame/1.0 (local)", "-o", dest, url]);
    const buf = readFileSync(dest);
    if (buf.length < 2500 || buf.slice(0, 40).toString().includes("<!DOCTYPE") || buf.slice(0, 40).toString().includes("<html")) {
      unlinkSync(dest);
      return null;
    }
    return path.basename(dest);
  } catch {
    return null;
  }
}

async function main() {
  const slug = "uel";
  const existing = ["png", "svg"].map((e) => path.join(COMP_DIR, `${slug}.${e}`));
  if (existing.some((f) => existsSync(f))) {
    console.log(`skip ${slug}`);
    return;
  }
  const file = await logoFileName("UEFA Europa League");
  if (!file) {
    console.log("NO-FILE uel");
    process.exitCode = 1;
    return;
  }
  const saved = await downloadLogo(file, path.join(COMP_DIR, slug));
  if (!saved) {
    console.log(`DL-FAIL uel ← ${file}`);
    process.exitCode = 1;
    return;
  }
  console.log(`OK uel ← ${saved} (${Math.round(statSync(path.join(COMP_DIR, saved)).size / 1024)}KB)`);
}

main();
