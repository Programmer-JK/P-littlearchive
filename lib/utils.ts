// ── Date utils ──────────────────────────────────────────────────────────────

/** Parse YYYY-MM-DD as local date (not UTC) */
export function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Format Date to YYYY-MM-DD */
export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Today as local midnight Date */
export function today(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Days between two dates (positive if a is after b) */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

/** Days since start date (start day = day 1) */
export function dayCount(startDate: string): number {
  return daysBetween(today(), parseLocalDate(startDate)) + 1;
}

const DOW = "일월화수목금토";

/** YYYY년 M월 D일 X요일 */
export function formatLong(s: string): string {
  const d = parseLocalDate(s);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${DOW[d.getDay()]}요일`;
}

/** YYYY년 M월 D일 */
export function formatYMD(s: string): string {
  const d = parseLocalDate(s);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** M월 D일 */
export function formatMD(d: Date): string {
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** YYYY.MM.DD */
export function formatDot(s: string): string {
  const d = parseLocalDate(s);
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

/** D-n / D-DAY label */
export function ddLabel(targetDate: Date): string {
  const n = daysBetween(targetDate, today());
  if (n === 0) return "D-DAY";
  if (n > 0) return `D-${n}`;
  return `D+${-n}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// ── Korean particle utils ────────────────────────────────────────────────────

/** Returns true if the last character has a final consonant (받침) */
export function hasJongseong(word: string): boolean {
  if (!word) return false;
  const code = word.charCodeAt(word.length - 1);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

/** 이/가 */
export function iga(word: string): string {
  return word + (hasJongseong(word) ? "이" : "가");
}

/** 이/가 suffix only */
export function igaSuffix(word: string): string {
  return hasJongseong(word) ? "이" : "가";
}

/** 과/와 */
export function gwa(word: string): string {
  return word + (hasJongseong(word) ? "과" : "와");
}

/** 은/는 */
export function eun(word: string): string {
  return word + (hasJongseong(word) ? "은" : "는");
}

/** 을/를 */
export function eul(word: string): string {
  return word + (hasJongseong(word) ? "을" : "를");
}

// ── Upcoming anniversaries/milestones ────────────────────────────────────────

interface UpcomingItem {
  title: string;
  date: Date;
  dateStr: string;
  daysLeft: number;
}

export function computeUpcoming(
  startDate: string,
  anniversaries: Array<{ title: string; date: string; repeatYearly: boolean }>,
  maxItems = 3
): UpcomingItem[] {
  const items: UpcomingItem[] = [];
  const t = today();
  const startD = parseLocalDate(startDate);

  // Auto: next 100-day milestones (2 of them)
  const currentDay = daysBetween(t, startD) + 1;
  for (let mult = 1; ; mult++) {
    const targetDay = mult * 100;
    if (targetDay <= currentDay) continue;
    const targetDate = new Date(startD.getTime() + (targetDay - 1) * 86_400_000);
    if (targetDate >= t) {
      items.push({
        title: `${targetDay}일`,
        date: targetDate,
        dateStr: toDateString(targetDate),
        daysLeft: daysBetween(targetDate, t),
      });
    }
    if (items.filter((i) => i.title.endsWith("일")).length >= 2) break;
    if (mult > 1000) break;
  }

  // Auto: next N anniversary (yearly from startDate)
  for (let year = 1; year <= 20; year++) {
    const annDate = new Date(
      startD.getFullYear() + year,
      startD.getMonth(),
      startD.getDate()
    );
    if (annDate >= t) {
      items.push({
        title: `${year}주년`,
        date: annDate,
        dateStr: toDateString(annDate),
        daysLeft: daysBetween(annDate, t),
      });
      break;
    }
  }

  // User anniversaries
  for (const ann of anniversaries) {
    const d = parseLocalDate(ann.date);
    if (ann.repeatYearly) {
      // Find next occurrence
      let targetYear = t.getFullYear();
      let candidate = new Date(targetYear, d.getMonth(), d.getDate());
      if (candidate < t) candidate = new Date(targetYear + 1, d.getMonth(), d.getDate());
      items.push({
        title: ann.title,
        date: candidate,
        dateStr: toDateString(candidate),
        daysLeft: daysBetween(candidate, t),
      });
    } else {
      if (d >= t) {
        items.push({
          title: ann.title,
          date: d,
          dateStr: ann.date,
          daysLeft: daysBetween(d, t),
        });
      }
    }
  }

  // Sort by date, take top N
  items.sort((a, b) => a.daysLeft - b.daysLeft);
  return items.slice(0, maxItems);
}

// ── Photo placeholder tones ──────────────────────────────────────────────────

const TONES: Record<string, [string, string]> = {
  sage: ["#C5CDB6", "#A4B096"],
  clay: ["#E2C6B2", "#C9A086"],
  sky: ["#C7D1D4", "#A3B3B8"],
  butter: ["#EDE0BA", "#D6C18E"],
  rose: ["#E3C3BE", "#C99D97"],
  stone: ["#D6CEC1", "#B5AA98"],
};

const TONE_KEYS = Object.keys(TONES);

export function getPlaceholderGradient(id: string): string {
  let hash = 0;
  for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
  const tone = TONE_KEYS[hash % TONE_KEYS.length];
  const [from, to] = TONES[tone];
  return `linear-gradient(160deg,${from},${to})`;
}

/** Hash-based tilt in degrees: -2.4 to +2.4 */
export function getTilt(id: string): number {
  let hash = 0;
  for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
  return ((hash % 49) - 24) / 10; // -2.4 ~ +2.4
}

// ── Formatting ────────────────────────────────────────────────────────────────

/** Format cost: 30,000원 */
export function formatWon(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

/** Relative time: 오늘 HH:mm / 어제 HH:mm / M월 D일 */
export function formatRelativeTime(date: Date): string {
  const t = today();
  const diff = daysBetween(t, new Date(date.getFullYear(), date.getMonth(), date.getDate()));
  const hhmm = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  if (diff === 0) return `오늘 ${hhmm}`;
  if (diff === 1) return `어제 ${hhmm}`;
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}
