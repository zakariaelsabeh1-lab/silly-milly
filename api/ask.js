// POST /api/ask { text, history: [{role:"user"|"assistant", text}] }
// Silly Milly: answers a spoken question with Claude and can read/change the family calendar.
import Anthropic from "@anthropic-ai/sdk";
import { send, readBody, checkAuth, nowLocal, TZ } from "../lib/http.js";
import { eventsBetween, addEvent, updateEvent, deleteEvent } from "../lib/calendar.js";
import { recentDays } from "../lib/routine.js";

// Haiku is fast and cheap, which suits quick questions and calendar changes.
// Set MILLY_MODEL in Vercel (e.g. "claude-opus-5-5") to use a different model.
const MODEL = process.env.MILLY_MODEL || "claude-haiku-5-5";
// Opus, Sonnet, Fable and Mythos models get the newer web search and refusal fallbacks;
// Haiku uses the basic web search tool and has no server-side fallback.
const BIG_MODEL = /^claude-(opus|sonnet|fable|mythos)-/.test(MODEL);
const LAT = process.env.FAMILY_LAT || "53.9171";
const LON = process.env.FAMILY_LON || "-122.7497";
const CITY = process.env.FAMILY_CITY || "Prince George, BC";
const KIDS = process.env.FAMILY_KIDS || "Noah and Didi";

const client = new Anthropic();

const tools = [
  {
    name: "list_events",
    description:
      "List family calendar events between two dates (inclusive). Use it to answer questions about what's coming up, and to find an event's id before changing or deleting it.",
    input_schema: {
      type: "object",
      properties: {
        start_date: { type: "string", description: "YYYY-MM-DD" },
        end_date: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["start_date", "end_date"],
      additionalProperties: false,
    },
  },
  {
    name: "add_event",
    description:
      "Add an event to the family calendar. Resolve relative dates like 'next Tuesday' to YYYY-MM-DD using today's date. Leave start_time empty for all-day events.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short title, e.g. 'Dentist for Noah'" },
        date: { type: "string", description: "YYYY-MM-DD" },
        start_time: { type: "string", description: "24-hour HH:MM, or empty for all day" },
        end_time: { type: "string", description: "24-hour HH:MM, or empty" },
        who: { type: "string", description: "Who it's for: Everyone, Noah, Didi, Parents, or another name" },
        repeat: { type: "string", enum: ["none", "weekly", "monthly", "yearly"] },
        notes: { type: "string" },
      },
      required: ["title", "date"],
      additionalProperties: false,
    },
  },
  {
    name: "update_event",
    description: "Change an existing event. Get its id from list_events first. Only pass the fields that change.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD" },
        start_time: { type: "string" },
        end_time: { type: "string" },
        who: { type: "string" },
        repeat: { type: "string", enum: ["none", "weekly", "monthly", "yearly"] },
        notes: { type: "string" },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_event",
    description:
      "Delete an event by id. Only do this after the person has clearly confirmed which event to delete in this conversation.",
    input_schema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "get_weather",
    description: `Current weather, the 7-day forecast and air quality (US AQI) for ${CITY}.`,
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_bedtime_history",
    description:
      "The kids' bedtime checklist for recent days: which tasks (toilet, puffer, vitamins, teeth, jammies, ready for tomorrow) were ticked and at what time. Puffer is Noah's only.",
    input_schema: {
      type: "object",
      properties: { days: { type: "integer", description: "How many recent days, 1-60" } },
      required: ["days"],
      additionalProperties: false,
    },
  },
  {
    type: BIG_MODEL ? "web_search_20260209" : "web_search_20250305",
    name: "web_search",
    max_uses: 2,
    user_location: { type: "approximate", city: "Prince George", region: "British Columbia", country: "CA", timezone: TZ },
  },
];

function validZone(z) {
  if (!z || typeof z !== "string" || z.length > 64) return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone: z }); return true; } catch { return false; }
}

// tz is the family's time zone sent by the tablet, so Milly's "today" and "now" match its clock.
function systemPrompt(tz) {
  const now = nowLocal(tz);
  return `You are Silly Milly, the friendly voice assistant on a family's kitchen wall tablet in ${CITY}, Canada. The family's kids are ${KIDS}; kids and grown-ups both talk to you.

Right now it is ${now.weekday}, ${now.date}, ${now.time} (${tz}). Use this time zone for all dates and times.

How to answer:
- Your words are read aloud by a text-to-speech voice. Reply in plain spoken sentences: no markdown, lists, emoji, URLs or symbols. Usually one to three short sentences. Longer only when asked for a story, a joke or an explanation.
- Be warm, playful and a little silly, but get facts right. Keep everything kid-appropriate.
- Use metric units and Celsius. Say times in 12-hour form like "3:30 PM".
- The family has its own calendar (not Google Calendar). Use the calendar tools for anything about plans, appointments, birthdays or reminders. After adding or changing an event, confirm what you saved in one sentence (title, day, time).
- If a request to add an event is missing the date, ask for it. If the time is missing, save it as all-day unless a time obviously matters, then ask.
- Before deleting an event, say which event you found and ask "Should I delete it?"; delete only after a yes.
- Use web search for news, sports scores, store hours and other things that change. Use get_weather for weather and air quality.
- If you didn't catch what someone said, or it makes no sense, ask them to say it again.`;
}

async function fetchWeather() {
  const f = new URL("https://api.open-meteo.com/v1/forecast");
  f.search = new URLSearchParams({
    latitude: LAT, longitude: LON, timezone: TZ, forecast_days: "8",
    current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,snowfall_sum,uv_index_max",
  }).toString();
  const a = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  a.search = new URLSearchParams({ latitude: LAT, longitude: LON, timezone: TZ, forecast_days: "7", current: "us_aqi", hourly: "us_aqi" }).toString();
  const [fw, aq] = await Promise.all([fetch(f).then((r) => r.json()), fetch(a).then((r) => r.json()).catch(() => null)]);
  const dailyAqi = {};
  if (aq && aq.hourly) {
    aq.hourly.time.forEach((t, i) => {
      const d = t.slice(0, 10);
      const v = aq.hourly.us_aqi[i];
      if (v != null) dailyAqi[d] = Math.max(dailyAqi[d] || 0, v);
    });
  }
  return {
    note: "weather_code uses WMO codes (0 clear, 1-3 partly cloudy to overcast, 45/48 fog, 51-57 drizzle, 61-67 rain, 71-77 snow, 80-82 showers, 85-86 snow showers, 95-99 thunderstorms). AQI is US AQI: 0-50 good, 51-100 moderate, 101-150 unhealthy for sensitive groups, 151+ unhealthy.",
    current: fw.current,
    current_us_aqi: aq && aq.current ? aq.current.us_aqi : null,
    daily: (fw.daily && fw.daily.time ? fw.daily.time : []).map((d, i) => ({
      date: d,
      code: fw.daily.weather_code[i],
      high_c: fw.daily.temperature_2m_max[i],
      low_c: fw.daily.temperature_2m_min[i],
      precip_chance: fw.daily.precipitation_probability_max[i],
      precip_mm: fw.daily.precipitation_sum[i],
      snow_cm: fw.daily.snowfall_sum[i],
      uv: fw.daily.uv_index_max[i],
      max_us_aqi: dailyAqi[d] ?? null,
    })),
  };
}

async function runTool(name, input, state) {
  switch (name) {
    case "list_events": {
      const ev = await eventsBetween(input.start_date, input.end_date);
      return ev.map((e) => ({ id: e.id, title: e.title, date: e.occurrence, start: e.start, end: e.end, who: e.who, repeat: e.repeat, notes: e.notes }));
    }
    case "add_event": {
      const r = await addEvent(input, "voice");
      if (!r.error) state.changed = true;
      return r;
    }
    case "update_event": {
      const { id, ...rest } = input;
      const r = await updateEvent(id, rest);
      if (!r.error) state.changed = true;
      return r;
    }
    case "delete_event": {
      const r = await deleteEvent(input.id);
      if (!r.error) state.changed = true;
      return r;
    }
    case "get_weather":
      return await fetchWeather();
    case "get_bedtime_history":
      return await recentDays(Math.min(Math.max(Number(input.days) || 7, 1), 60));
    default:
      return { error: "Unknown tool" };
  }
}

async function callClaude(messages, useFallbacks, tz) {
  const params = {
    model: MODEL,
    max_tokens: 4000,
    system: systemPrompt(tz),
    output_config: { effort: process.env.MILLY_EFFORT || "low" },
    tools,
    messages,
  };
  if (useFallbacks) {
    // If Claude declines a request on safety grounds, the API retries it on a fallback model.
    return client.beta.messages.create({ ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" });
  }
  return client.beta.messages.create(params);
}

export default async function handler(req, res) {
  if (!checkAuth(req, res)) return;
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  if (!process.env.ANTHROPIC_API_KEY) {
    return send(res, 200, { reply: "I can't think yet, because my Claude key hasn't been added. A grown-up needs to add it in Vercel.", changed: false });
  }

  const body = await readBody(req);
  const text = String(body.text || "").trim().slice(0, 2000);
  if (!text) return send(res, 400, { error: "No question" });

  const messages = [];
  for (const h of Array.isArray(body.history) ? body.history.slice(-8) : []) {
    if ((h.role === "user" || h.role === "assistant") && h.text) {
      const last = messages[messages.length - 1];
      if (last && last.role === h.role) continue; // keep turns alternating
      messages.push({ role: h.role, content: String(h.text).slice(0, 2000) });
    }
  }
  if (messages.length && messages[0].role !== "user") messages.shift();
  if (messages.length && messages[messages.length - 1].role === "user") messages.pop();
  messages.push({ role: "user", content: text });

  const tz = validZone(body.tz) ? body.tz : TZ;
  const state = { changed: false };
  let useFallbacks = BIG_MODEL;
  try {
    for (let step = 0; step < 8; step++) {
      let response;
      try {
        response = await callClaude(messages, useFallbacks, tz);
      } catch (e) {
        if (useFallbacks && e instanceof Anthropic.BadRequestError) {
          useFallbacks = false; // fallback feature not available on this account; try plainly
          response = await callClaude(messages, false, tz);
        } else {
          throw e;
        }
      }

      messages.push({ role: "assistant", content: response.content });

      if (response.stop_reason === "pause_turn") continue;
      if (response.stop_reason === "tool_use") {
        const results = [];
        for (const block of response.content) {
          if (block.type !== "tool_use") continue;
          let out;
          try {
            out = await runTool(block.name, block.input || {}, state);
          } catch (err) {
            console.error("tool error", block.name, err);
            out = { error: "That didn't work: " + (err && err.message ? err.message : "unknown error") };
          }
          results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(out), is_error: Boolean(out && out.error) });
        }
        messages.push({ role: "user", content: results });
        continue;
      }

      if (response.stop_reason === "refusal") {
        return send(res, 200, { reply: "Hmm, that's not something I can help with. Ask me something else!", changed: state.changed });
      }
      const reply = response.content.filter((b) => b.type === "text").map((b) => b.text).join(" ").trim();
      return send(res, 200, { reply: reply || "Sorry, I got mixed up. Can you ask me again?", changed: state.changed });
    }
    return send(res, 200, { reply: "That took me too many steps. Can you ask it a simpler way?", changed: state.changed });
  } catch (e) {
    console.error(e);
    let reply = "Oops, my brain had a hiccup. Try again in a moment.";
    if (e instanceof Anthropic.AuthenticationError) reply = "My Claude key isn't working. A grown-up needs to check it in Vercel.";
    else if (e instanceof Anthropic.RateLimitError) reply = "I'm a bit too busy right now. Try again in a minute.";
    else if (e instanceof Anthropic.APIError && e.status === 400) reply = "Something's wrong with how I'm set up. A grown-up should check the Vercel logs.";
    return send(res, 200, { reply, changed: state.changed, error: true });
  }
}
