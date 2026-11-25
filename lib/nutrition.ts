export interface NutritionLogLike {
  calories?: number | string | null;
  protein_g?: number | string | null;
  created_at: string;
}

const JAKARTA_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Mengembalikan tanggal kalender zona waktu Asia/Jakarta (YYYY-MM-DD).
 */
export function getJakartaDateKey(dateInput: string | Date): string {
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (Number.isNaN(d.getTime())) return "";
  return JAKARTA_DATE_FORMATTER.format(d);
}

/**
 * Menghitung total kalori dan protein khusus untuk entri pada hari ini (WIB / Asia/Jakarta).
 */
export function calculateDailyNutritionSummary<T extends NutritionLogLike>(
  entries: T[],
  now: Date = new Date()
): {
  todayKey: string;
  todayEntries: T[];
  totalCalories: number;
  totalProtein: number;
} {
  const todayKey = getJakartaDateKey(now);
  const todayEntries = entries.filter(
    (item) => getJakartaDateKey(item.created_at) === todayKey
  );

  const totalCalories = todayEntries.reduce(
    (acc, item) => acc + (Number(item.calories) || 0),
    0
  );
  const totalProtein = todayEntries.reduce(
    (acc, item) => acc + (Number(item.protein_g) || 0),
    0
  );

  return { todayKey, todayEntries, totalCalories, totalProtein };
}
