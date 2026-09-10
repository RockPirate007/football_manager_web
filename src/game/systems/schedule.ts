/**
 * Календарь лиги: круговой турнир в два круга (алгоритм «карусели»).
 */

export function buildSchedule(names: string[]): Array<Array<[string, string]>> {
  const arr = [...names];
  if (arr.length % 2 !== 0) arr.push("__BYE__");
  const n = arr.length;
  const rounds: Array<Array<[string, string]>> = [];

  for (let r = 0; r < n - 1; r++) {
    const pairs: Array<[string, string]> = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a === "__BYE__" || b === "__BYE__") continue;
      pairs.push((r + i) % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    // Поворот: первый фиксируется, остальные сдвигаются
    const rotated = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
    for (let i = 0; i < n; i++) arr[i] = rotated[i];
  }

  const secondLeg = rounds.map((rd) => rd.map(([a, b]) => [b, a] as [string, string]));
  return [...rounds, ...secondLeg];
}

/**
 * Календарь мультилигового мира: туры всех лиг идут параллельно.
 * Тур r = сумма матчей r-го тура каждой лиги.
 */
export function buildMultiLeagueSchedule(clubsByLeague: string[][]): Array<Array<[string, string]>> {
  const leagueSchedules = clubsByLeague.map((clubs) => buildSchedule(clubs));
  const rounds = Math.max(...leagueSchedules.map((s) => s.length));
  return Array.from({ length: rounds }, (_, r) =>
    leagueSchedules.flatMap((s) => s[r] ?? []),
  );
}
