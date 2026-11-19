// The family calendar: stored as one list of events.
// An event: { id, title, date: "YYYY-MM-DD", start: "HH:MM" | "", end: "HH:MM" | "",
//             who: "Everyone" | name, repeat: "none" | "weekly" | "monthly" | "yearly", notes, createdAt }
import { getKey, setKey } from "./store.js";

const KEY = "events";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const REPEATS = ["none", "weekly", "monthly", "yearly"];

export async function allEvents() {
  const list = await getKey(KEY, []);
  return Array.isArray(list) ? list : [];
}

function cleanTime(t) {
  if (!t) return "";
  const s = String(t).trim();
  if (/^\d:\d\d$/.test(s)) return "0" + s;
  return TIME_RE.test(s) ? s : "";
}

export function validateEvent(input) {
  const title = String(input.title || "").trim().slice(0, 120);
  const date = String(input.date || "").trim();
  if (!title) return { error: "The event needs a title." };
  if (!DATE_RE.test(date) || isNaN(Date.parse(date + "T00:00:00Z"))) {
    return { error: "The date must look like YYYY-MM-DD." };
  }
  const repeat = REPEATS.includes(input.repeat) ? input.repeat : "none";
  return {
    event: {
      title,
      date,
      start: cleanTime(input.start || input.start_time),
      end: cleanTime(input.end || input.end_time),
      who: String(input.who || "Everyone").trim().slice(0, 40) || "Everyone",
      repeat,
      notes: String(input.notes || "").trim().slice(0, 500),
    },
  };
}

export async function addEvent(input, source = "tablet") {
  const { event, error } = validateEvent(input);
  if (error) return { error };
  const list = await allEvents();
  const full = {
    id: Math.random().toString(36).slice(2, 10),
    ...event,
    source,
    createdAt: new Date().toISOString(),
  };
  list.push(full);
  await setKey(KEY, list);
  return { event: full };
}

export async function updateEvent(id, input) {
  const list = await allEvents();
  const i = list.findIndex((e) => e.id === id);
  if (i < 0) return { error: "No event with that id." };
  const { event, error } = validateEvent({ ...list[i], ...input });
  if (error) return { error };
  list[i] = { ...list[i], ...event };
  await setKey(KEY, list);
  return { event: list[i] };
}

export async function deleteEvent(id) {
  const list = await allEvents();
  const found = list.find((e) => e.id === id);
  if (!found) return { error: "No event with that id." };
  await setKey(KEY, list.filter((e) => e.id !== id));
  return { deleted: found };
}

function toDate(s) {
  return new Date(s + "T00:00:00Z");
}
function fmt(d) {
  return d.toISOString().slice(0, 10);
}

function occursOn(ev, day) {
  if (day < ev.date) return false;
  if (ev.repeat === "none" || !ev.repeat) return day === ev.date;
  const a = toDate(ev.date);
  const b = toDate(day);
  if (ev.repeat === "weekly") return a.getUTCDay() === b.getUTCDay();
  if (ev.repeat === "monthly") return a.getUTCDate() === b.getUTCDate();
  if (ev.repeat === "yearly") return a.getUTCDate() === b.getUTCDate() && a.getUTCMonth() === b.getUTCMonth();
  return false;
}

// Every occurrence between start and end (inclusive), sorted by date and time.
export async function eventsBetween(start, end) {
  if (!DATE_RE.test(start) || !DATE_RE.test(end)) return [];
  const list = await allEvents();
  const out = [];
  const last = toDate(end);
  let d = toDate(start);
  for (let n = 0; d <= last && n < 400; n++) {
    const day = fmt(d);
    for (const ev of list) {
      if (occursOn(ev, day)) out.push({ ...ev, occurrence: day });
    }
    d = new Date(d.getTime() + 86400000);
  }
  out.sort((x, y) => (x.occurrence + (x.start || "00:00")).localeCompare(y.occurrence + (y.start || "00:00")));
  return out;
}
