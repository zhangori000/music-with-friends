export const MAX_IMPORT_BYTES = 25 * 1024 * 1024;

const number = new Intl.NumberFormat("en-US");

export function formatListeningTime(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) return "Unavailable";
  const totalSeconds = Math.round(minutes * 60);
  const hours = Math.floor(totalSeconds / 3_600);
  const remainingSeconds = totalSeconds % 3_600;
  const wholeMinutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const parts: string[] = [];

  if (hours) parts.push(`${number.format(hours)}h`);
  if (wholeMinutes) parts.push(`${wholeMinutes}m`);
  if (seconds) parts.push(`${seconds}s`);
  return parts.length ? parts.join(" ") : "0m";
}
