"use client";

/**
 * Компоненты логотипов: клубы и турниры.
 * Файлы лежат в public/logos/teams и public/logos/competitions.
 * При отсутствии файла — аккуратный fallback с инициалами.
 */

import { useState } from "react";
import { clubSlug, findClub, clubKit, competitionLogoPath } from "@/game/data/leagues";
import { cn } from "@/lib/utils";

function initialsOf(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 1) return name.slice(0, 2).toUpperCase();
  return words
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/** Контрастный цвет текста на фоне */
function contrastOn(bg: string): string {
  const hex = bg.replace("#", "");
  if (hex.length < 6) return "#fff";
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 > 150 ? "#18181b" : "#ffffff";
}

/**
 * Логотип клуба. Кэшируется браузером; при ошибке — кружок с инициалами
 * в цветах формы клуба.
 */
export function TeamLogo({
  name,
  size = 28,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [stage, setStage] = useState(0); // 0 → png, 1 → svg, 2 → fallback
  const slug = clubSlug(name);
  const kit = clubKit(name);

  if (!slug || stage >= 2 || failed) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full border font-black",
          className,
        )}
        style={{
          width: size,
          height: size,
          background: kit.primary,
          borderColor: kit.secondary,
          color: contrastOn(kit.primary),
          fontSize: Math.max(9, size * 0.34),
        }}
        aria-label={name}
        title={name}
      >
        {initialsOf(name)}
      </span>
    );
  }

  const src = stage === 0 ? `/logos/teams/${slug}.png` : `/logos/teams/${slug}.svg`;

  return (
    <img
      key={src}
      src={src}
      alt={name}
      title={name}
      width={size}
      height={size}
      onError={() => {
        if (stage === 0) setStage(1);
        else setFailed(true);
      }}
      className={cn("shrink-0 object-contain", className)}
      style={{ width: size, height: size }}
      loading="lazy"
    />
  );
}

/** Логотип турнира: league:<id> | cup:<id> | ucl — либо ключ лиги */
export function CompLogo({
  compKey,
  size = 28,
  className,
}: {
  compKey: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [stage, setStage] = useState(0); // 0 → png, 1 → svg, 2 → нет
  const path = competitionLogoPath(compKey);
  if (!path || failed || stage >= 2) return null;
  const src = stage === 0 ? path : path.replace(/\.png$/, ".svg");
  const pad = Math.max(2, Math.round(size * 0.12));
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-md", className)}
      style={{ width: size + pad * 2, height: size + pad * 2, background: "#f4f4f5", padding: pad }}
    >
      <img
        key={src}
        src={src}
        alt=""
        width={size}
        height={size}
        onError={() => {
          if (stage === 0) setStage(1);
          else setFailed(true);
        }}
        className="object-contain"
        style={{ width: size, height: size }}
        loading="lazy"
      />
    </span>
  );
}

/** Логотип клуба + название в строку */
export function TeamBadge({
  name,
  size = 22,
  className,
  bold = true,
  truncate = true,
}: {
  name: string;
  size?: number;
  className?: string;
  bold?: boolean;
  truncate?: boolean;
}) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      <TeamLogo name={name} size={size} />
      <span className={cn(bold && "font-semibold", truncate && "truncate")}>{name}</span>
    </span>
  );
}

/** Проверка наличия клуба в базе (для отладки) */
export function knownClub(name: string): boolean {
  return findClub(name) !== null;
}
