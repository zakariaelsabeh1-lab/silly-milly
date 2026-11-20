// Checklist history for the bedtime and morning routines, stored under their own keys:
// { "YYYY-MM-DD": { noah: { toilet: "20:01", ... }, didi: {...} } }
import { getKey, setKey } from "./store.js";

export const ROUTINES = ["bedtime", "morning"];
const KEEP_DAYS = 400;
const keyFor = (routine) => (ROUTINES.includes(routine) ? routine : "bedtime");

export async function allDays(routine) {
  const v = await getKey(keyFor(routine), {});
  return v && typeof v === "object" ? v : {};
}

export async function setTask(date, kid, task, done, time, routine) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "bad date" };
  if (!/^[a-z0-9_-]{1,30}$/i.test(kid) || !/^[a-z0-9_-]{1,30}$/i.test(task)) return { error: "bad id" };
  const days = await allDays(routine);
  const day = days[date] || {};
  const k = day[kid] || {};
  if (done) k[task] = time || new Date().toISOString().slice(11, 16);
  else delete k[task];
  day[kid] = k;
  days[date] = day;
  const keys = Object.keys(days).sort();
  while (keys.length > KEEP_DAYS) delete days[keys.shift()];
  await setKey(keyFor(routine), days);
  return { day };
}

export async function recentDays(n = 14, routine) {
  const days = await allDays(routine);
  const keys = Object.keys(days).sort().slice(-n);
  return Object.fromEntries(keys.map((k) => [k, days[k]]));
}
