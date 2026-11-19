// Bedtime checklist history: { "YYYY-MM-DD": { noah: { toilet: "20:01", ... }, didi: {...} } }
import { getKey, setKey } from "./store.js";

const KEY = "bedtime";
const KEEP_DAYS = 400;

export async function allDays() {
  const v = await getKey(KEY, {});
  return v && typeof v === "object" ? v : {};
}

export async function setTask(date, kid, task, done, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "bad date" };
  if (!/^[a-z0-9_-]{1,30}$/i.test(kid) || !/^[a-z0-9_-]{1,30}$/i.test(task)) return { error: "bad id" };
  const days = await allDays();
  const day = days[date] || {};
  const k = day[kid] || {};
  if (done) k[task] = time || new Date().toISOString().slice(11, 16);
  else delete k[task];
  day[kid] = k;
  days[date] = day;
  const keys = Object.keys(days).sort();
  while (keys.length > KEEP_DAYS) delete days[keys.shift()];
  await setKey(KEY, days);
  return { day };
}

export async function recentDays(n = 14) {
  const days = await allDays();
  const keys = Object.keys(days).sort().slice(-n);
  return Object.fromEntries(keys.map((k) => [k, days[k]]));
}
