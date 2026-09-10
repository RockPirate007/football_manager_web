"use client";

/**
 * 2D-трансляция матча: вертикальное поле с воротами, игроки — круглые
 * значки в цветах форм клубов, мяч анимируется по событиям движка.
 *
 * Компонент полностью детерминирован по `minute` (float): вся анимация —
 * чистая функция от игрового времени, таймер держит MatchScreen.
 */

import { useMemo } from "react";
import type { LineupPlayer, MatchResult, PosDetail, TeamMatchStats } from "@/game/core/types";
import { clubKit } from "@/game/data/leagues";
import { cn } from "@/lib/utils";

// ─────────────────── Геометрия поля ───────────────────

const W = 680;
const H = 1050;
const CX = W / 2;

/** Координаты игрока на поле (0–100) */
interface PitchPos {
  x: number;
  y: number;
}

/**
 * Расстановка по амплуа (FIFA-коды). Линии: ВРТ y≈93, защита y≈78,
 * полузащита y≈58, атака y≈30. Хозяева: снизу (атакуют вверх) —
 * y инвертируется для гостей.
 */
function pitchPositions(details: Array<PosDetail | undefined>): PitchPos[] {
  const groups: Record<string, Array<{ idx: number; d: PosDetail }>> = {
    GK: [],
    DEF: [],
    MID: [],
    FWD: [],
  };
  const order: Record<PosDetail, number> = {
    GK: 0, CB: 1, LB: 0, RB: 2, LWB: 0, RWB: 2,
    DM: 1, CM: 1, LM: 0, RM: 2, AM: 1,
    LW: 0, CF: 1, ST: 1, RW: 2,
  };
  details.forEach((d, idx) => {
    const key = !d ? "MID" : d === "GK" ? "GK" : ["CB", "LB", "RB", "LWB", "RWB"].includes(d) ? "DEF" : ["DM", "CM", "LM", "RM", "AM"].includes(d) ? "MID" : "FWD";
    groups[key].push({ idx, d: d ?? "CM" });
  });

  const out: PitchPos[] = new Array(details.length);

  const spread = (items: Array<{ idx: number; d: PosDetail }>, yBase: number, xMin: number, xMax: number) => {
    // Фланги — по своему краю, центральные — равномерно
    const wide = items.filter((i) => i.d !== "CB" && i.d !== "DM" && i.d !== "CM" && i.d !== "AM" && i.d !== "ST" && i.d !== "CF");
    const central = items.filter((i) => !wide.includes(i));
    for (const w of wide) {
      const prio = order[w.d];
      out[w.idx] = { x: prio === 0 ? xMin : prio === 2 ? xMax : CX / 10, y: yBase };
    }
    const n = central.length;
    central.forEach((c, i) => {
      const x = n === 1 ? (xMin + xMax) / 2 : xMin + ((xMax - xMin) * i) / (n - 1);
      out[c.idx] = { x, y: yBase };
    });
  };

  // Вратарь
  if (groups.GK[0]) out[groups.GK[0].idx] = { x: 50, y: 93 };

  // Защита: LWB/LB — крайние, CB — центр, RB/RWB — правый
  const def = groups.DEF;
  if (def.length > 0) {
    const wideDef = def.filter((i) => ["LB", "LWB", "RB", "RWB"].includes(i.d));
    const cbs = def.filter((i) => i.d === "CB");
    for (const w of wideDef) {
      out[w.idx] = { x: ["LB", "LWB"].includes(w.d) ? 14 : 86, y: w.d === "LWB" || w.d === "RWB" ? 70 : 78 };
    }
    const n = cbs.length;
    cbs.forEach((c, i) => {
      out[c.idx] = { x: n === 1 ? 50 : 34 + (32 * i) / Math.max(1, n - 1), y: 81 };
    });
    if (out.length === 0) spread(def, 78, 20, 80);
  }

  // Полузащита: DM чуть глубже, AM выше, LM/RM — фланги
  for (const m of groups.MID) {
    let y = 56;
    let x = 50;
    if (m.d === "DM") {
      y = 65;
      const dms = groups.MID.filter((i) => i.d === "DM");
      const rank = dms.findIndex((i) => i.idx === m.idx);
      x = dms.length === 1 ? 50 : dms.length === 2 ? 40 + 20 * rank : 34 + (32 * rank) / Math.max(1, dms.length - 1);
    } else if (m.d === "AM") {
      y = 40;
      x = 50;
    } else if (m.d === "LM" || m.d === "RM") {
      y = 54;
      x = m.d === "LM" ? 16 : 84;
    } else {
      const cms = groups.MID.filter((i) => i.d === "CM");
      const rank = cms.findIndex((i) => i.idx === m.idx);
      y = 54;
      x = cms.length === 1 ? 50 : cms.length === 2 ? 38 + 24 * rank : 30 + (40 * rank) / Math.max(1, cms.length - 1);
    }
    out[m.idx] = { x, y };
  }

  // Атака: вингеры — фланги, CF/ST — центр
  const fwd = groups.FWD;
  const wingers = fwd.filter((i) => i.d === "LW" || i.d === "RW");
  const centrals = fwd.filter((i) => i.d === "ST" || i.d === "CF");
  for (const w of wingers) out[w.idx] = { x: w.d === "LW" ? 17 : 83, y: w.d === "LW" ? 32 : 32 };
  const n = centrals.length;
  centrals.forEach((c, i) => {
    const y = c.d === "CF" ? 26 : 20;
    out[c.idx] = { x: n === 1 ? 50 : n === 2 ? 42 + 16 * i : 36 + (28 * i) / Math.max(1, n - 1), y };
  });

  // Страховка: незаполненные — по кругу центра
  for (let i = 0; i < out.length; i++) {
    if (!out[i]) out[i] = { x: 30 + (40 * i) / 11, y: 55 };
  }
  return out;
}

// ─────────────────── Анимация мяча ───────────────────

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/** Псевдослучайное блуждание мяча (детерминировано по минуте) */
function roamPos(minute: number, homeStats: TeamMatchStats): PitchPos {
  const t = minute;
  const wx = Math.sin(t * 0.9) * 90 + Math.sin(t * 0.33 + 1.7) * 130;
  const bias = (homeStats.possession - 50) * 3.2; // владение тянет мяч к половине соперника хозяев
  const wy = H / 2 - bias + Math.cos(t * 0.7 + 0.5) * 110 + Math.sin(t * 0.21) * 80;
  return { x: CX + wx * 0.55, y: Math.max(90, Math.min(H - 90, wy)) };
}

interface BallState {
  x: number;
  y: number;
  /** 0..1 — сила события (для вспышки) */
  flash: number;
  flashTeam: string | null;
}

/**
 * Состояние мяча на минуту: между событиями — блуждание,
 * в окне события (−0.9 … +1.0 мин) — забегание, удар, результат.
 */
function ballAt(minute: number, match: MatchResult, endMinute: number): BallState {
  const events = match.events;
  const roam = roamPos(minute, match.homeStats);
  let flash = 0;
  let flashTeam: string | null = null;

  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.type !== "goal" && e.type !== "save" && e.type !== "miss") continue;
    const start = e.minute - 0.9;
    const end = e.minute + 1.0;
    if (minute < start || minute > end) continue;

    const homeAttacking = e.team === match.home;
    // Точка удара: штрафная атакующей стороны
    const shot = { x: CX + ((i % 3) - 1) * 70, y: homeAttacking ? 205 : H - 205 };
    // Цели: гол — в ворота, сейв — вратарь, мимо — рядом со штангой
    let target: PitchPos;
    if (e.type === "goal") target = { x: CX + ((i % 2) * 40 - 20), y: homeAttacking ? 26 : H - 26 };
    else if (e.type === "save") target = { x: CX, y: homeAttacking ? 60 : H - 60 };
    else target = { x: homeAttacking ? CX - 190 : CX + 190, y: homeAttacking ? 55 : H - 55 };

    const t = minute - start;
    if (t < 0.9) {
      // Забегание к точке удара
      const k = easeInOut(t / 0.9);
      return { x: roam.x + (shot.x - roam.x) * k, y: roam.y + (shot.y - roam.y) * k, flash, flashTeam };
    }
    if (t < 1.15) {
      // Удар — полёт к цели
      const k = easeInOut((t - 0.9) / 0.25);
      if (e.type === "goal") {
        flash = Math.max(0, 1 - Math.abs(t - 1.05) * 2);
        flashTeam = e.team;
      }
      return { x: shot.x + (target.x - shot.x) * k, y: shot.y + (target.y - shot.y) * k, flash, flashTeam };
    }
    // Отскок/возврат
    const k = easeInOut((t - 1.15) / 0.75);
    return { x: target.x + (CX - target.x) * k, y: target.y + (H / 2 - target.y) * k, flash, flashTeam };
  }

  // В самом конце — мяч в центре
  if (minute >= endMinute - 0.5) {
    return { x: CX, y: H / 2, flash, flashTeam };
  }
  return { x: roam.x, y: roam.y, flash, flashTeam };
}

// ─────────────────── Вспомогательное ───────────────────

function contrastText(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length < 6) return "#fff";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 > 150 ? "#18181b" : "#ffffff";
}

/** Заливка формы: полосы/диагональ — паттерном, однотонная — цветом */
function KitDefs({ id, primary, secondary, pattern }: { id: string; primary: string; secondary: string; pattern: string }) {
  if (pattern === "stripes") {
    return (
      <pattern id={id} width="10" height="10" patternUnits="userSpaceOnUse">
        <rect width="10" height="10" fill={primary} />
        <rect width="5" height="10" fill={secondary} />
      </pattern>
    );
  }
  if (pattern === "sash") {
    return (
      <pattern id={id} width="20" height="20" patternUnits="userSpaceOnUse">
        <rect width="20" height="20" fill={primary} />
        <rect x="0" y="0" width="20" height="7" fill={secondary} opacity="0.85" transform="rotate(45 10 10)" />
      </pattern>
    );
  }
  return (
    <pattern id={id} width="4" height="4" patternUnits="userSpaceOnUse">
      <rect width="4" height="4" fill={primary} />
    </pattern>
  );
}

// ─────────────────── Компонент ───────────────────

export function MatchPitch({
  match,
  minute,
  endMinute,
  className,
}: {
  match: MatchResult;
  minute: number;
  endMinute: number;
  className?: string;
}) {
  const homeKit = clubKit(match.home);
  const awayKit = clubKit(match.away);

  const homeLineup = match.homeLineup ?? [];
  const awayLineup = match.awayLineup ?? [];

  // Расстановки (мемо по составам)
  const homePos = useMemo(
    () => pitchPositions(homeLineup.map((p) => p.detail)),
    [homeLineup],
  );
  const awayPos = useMemo(
    () => pitchPositions(awayLineup.map((p) => p.detail)),
    [awayLineup],
  );
  const ball = ballAt(minute, match, endMinute);

  const toField = (p: PitchPos, isHome: boolean): { x: number; y: number } => {
    // p.y — дистанция от СВОИХ ворот (GK≈93 у своих, FWD≈20 у чужих).
    // Хозяева снизу (атакуют вверх), гости сверху. Инвертируем относительно своих ворот.
    const fx = (p.x / 100) * W;
    const fy = isHome
      ? H - 30 - ((100 - p.y) / 100) * (H - 60)
      : 30 + ((100 - p.y) / 100) * (H - 60);
    return { x: fx, y: fy };
  };

  const ballField = { x: ball.x, y: Math.max(20, Math.min(H - 20, ball.y)) };

  // Пометки дисциплинарных событий у игроков
  const marks = match.events
    .filter((e) => (e.type === "yellow" || e.type === "red" || e.type === "injury") && minute >= e.minute && minute <= e.minute + 1.2)
    .map((e) => {
      const isHome = e.team === match.home;
      const lineup = isHome ? homeLineup : awayLineup;
      const pos = isHome ? homePos : awayPos;
      const idx = lineup.findIndex((p) => p.id === e.playerId);
      if (idx === -1) return null;
      const f = toField(pos[idx], isHome);
      return { ...f, kind: e.type, team: e.team };
    })
    .filter(Boolean) as Array<{ x: number; y: number; kind: string; team: string }>;

  // Лёгкое «дыхание» игроков вокруг своей позиции
  const wobble = (p: PitchPos, seed: number, isHome: boolean): { x: number; y: number } => {
    const base = toField(p, isHome);
    const dx = Math.sin(minute * 1.4 + seed * 2.1) * 6;
    const dy = Math.cos(minute * 1.1 + seed * 1.7) * 6;
    return { x: base.x + dx, y: base.y + dy };
  };

  const kitIdHome = "kit-home";
  const kitIdAway = "kit-away";

  return (
    <div className={cn("relative overflow-hidden rounded-xl border border-emerald-950/60", className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Трансляция матча">
        <defs>
          <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0d5c2e" />
            <stop offset="50%" stopColor="#127a3c" />
            <stop offset="100%" stopColor="#0d5c2e" />
          </linearGradient>
          <KitDefs id={kitIdHome} primary={homeKit.primary} secondary={homeKit.secondary} pattern={homeKit.pattern} />
          <KitDefs id={kitIdAway} primary={awayKit.primary} secondary={awayKit.secondary} pattern={awayKit.pattern} />
          <radialGradient id="goalflash">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="60%" stopColor="#fbbf24" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Газон + полосы газона */}
        <rect width={W} height={H} fill="url(#grass)" />
        {[...Array(8)].map((_, i) => (
          <rect key={i} y={(i * H) / 8} width={W} height={H / 16} fill="#ffffff" opacity="0.045" />
        ))}

        {/* Разметка */}
        <g stroke="#eafff2" strokeOpacity="0.75" strokeWidth="3" fill="none">
          <rect x="24" y="24" width={W - 48} height={H - 48} />
          <line x1="24" y1={H / 2} x2={W - 24} y2={H / 2} />
          <circle cx={CX} cy={H / 2} r="88" />
          <circle cx={CX} cy={H / 2} r="4" fill="#eafff2" />
          {/* Штрафные верх */}
          <rect x={CX - 190} y="24" width="380" height="170" />
          <rect x={CX - 90} y="24" width="180" height="70" />
          <circle cx={CX} cy="150" r="3.5" fill="#eafff2" />
          {/* Штрафные низ */}
          <rect x={CX - 190} y={H - 194} width="380" height="170" />
          <rect x={CX - 90} y={H - 94} width="180" height="70" />
          <circle cx={CX} cy={H - 150} r="3.5" fill="#eafff2" />
        </g>

        {/* Ворота */}
        <g>
          <rect x={CX - 92} y="6" width="184" height="18" rx="4" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2" />
          <rect x={CX - 92} y={H - 24} width="184" height="18" rx="4" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2" />
        </g>

        {/* Вспышка гола */}
        {ball.flash > 0 && ball.flashTeam && (
          <>
            <circle
              cx={ball.flashTeam === match.home ? CX : CX}
              cy={ball.flashTeam === match.home ? 15 : H - 15}
              r={90 * ball.flash}
              fill="url(#goalflash)"
            />
            <text
              x={CX}
              y={ball.flashTeam === match.home ? 70 : H - 60}
              textAnchor="middle"
              fontSize="46"
              fontWeight="900"
              fill="#ffffff"
              opacity={Math.min(1, ball.flash * 1.6)}
            >
              ГОЛ!
            </text>
          </>
        )}

        {/* Гости (сверху) */}
        {awayLineup.map((p, i) => {
          const pos = wobble(awayPos[i] ?? { x: 50, y: 50 }, i + 40, false);
          const textColor = contrastText(awayKit.primary);
          return (
            <g key={`a-${p.id}`} opacity={p.off ? 0.32 : 1}>
              <circle cx={pos.x} cy={pos.y} r="17" fill={`url(#${kitIdAway})`} stroke={awayKit.secondary} strokeWidth="2.5" opacity="0.97" />
              <text x={pos.x} y={pos.y + 4.5} textAnchor="middle" fontSize="13" fontWeight="800" fill={textColor}>
                {p.off ? "✕" : p.number}
              </text>
              <text x={pos.x} y={pos.y - 24} textAnchor="middle" fontSize="11.5" fontWeight="700" fill="#ffffff" opacity="0.92" style={{ paintOrder: "stroke" }} stroke="#052e16" strokeWidth="3">
                {p.name.split(" ").slice(-1)[0]}
              </text>
            </g>
          );
        })}

        {/* Хозяева (снизу) */}
        {homeLineup.map((p, i) => {
          const pos = wobble(homePos[i] ?? { x: 50, y: 50 }, i, true);
          const textColor = contrastText(homeKit.primary);
          return (
            <g key={`h-${p.id}`} opacity={p.off ? 0.32 : 1}>
              <circle cx={pos.x} cy={pos.y} r="17" fill={`url(#${kitIdHome})`} stroke={homeKit.secondary} strokeWidth="2.5" opacity="0.97" />
              <text x={pos.x} y={pos.y + 4.5} textAnchor="middle" fontSize="13" fontWeight="800" fill={textColor}>
                {p.off ? "✕" : p.number}
              </text>
              <text x={pos.x} y={pos.y + 36} textAnchor="middle" fontSize="11.5" fontWeight="700" fill="#ffffff" opacity="0.92" style={{ paintOrder: "stroke" }} stroke="#052e16" strokeWidth="3">
                {p.name.split(" ").slice(-1)[0]}
              </text>
            </g>
          );
        })}

        {/* Пометки карточек/травм */}
        {marks.map((m, i) => (
          <g key={`m-${i}`}>
            <circle cx={m.x + 13} cy={m.y - 13} r="11" fill={m.kind === "yellow" ? "#facc15" : m.kind === "red" ? "#ef4444" : "#f472b6"} stroke="#18181b" strokeWidth="1.5" />
            <text x={m.x + 13} y={m.y - 8.5} textAnchor="middle" fontSize="12" fontWeight="900" fill={m.kind === "yellow" ? "#18181b" : "#ffffff"}>
              {m.kind === "injury" ? "+" : "!"}
            </text>
          </g>
        ))}

        {/* Мяч */}
        <g>
          <circle cx={ballField.x} cy={ballField.y} r="9" fill="#ffffff" stroke="#052e16" strokeWidth="2" />
          <circle cx={ballField.x - 2.5} cy={ballField.y - 2.5} r="2.6" fill="#052e16" opacity="0.85" />
          <circle cx={ballField.x + 3} cy={ballField.y + 2.5} r="2" fill="#334155" opacity="0.7" />
        </g>
      </svg>
    </div>
  );
}
