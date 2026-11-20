# Family Board + Silly Milly

A wall-tablet dashboard for the family: big clock, Prince George weather and air quality for the week, a what-to-wear tip, Noah and Didi's bedtime checklist with history, a family calendar, and **Silly Milly**, a voice assistant powered by Claude that can answer questions and add events to the calendar.

**Setup instructions: see [SETUP.md](SETUP.md).**

## How it's built

- `public/` is the tablet app: plain HTML, CSS and JavaScript with no build step, so it stays light on old tablets.
- `api/` holds small Vercel serverless functions:
  - `ask.js`: Silly Milly. Sends the question to Claude with tools for the calendar, weather, bedtime history and web search.
  - `events.js`: the family calendar (add, edit, delete, list; weekly, monthly and yearly repeats).
  - `bedtime.js`: ticks on the bedtime checklist and history.
  - `settings.js`: wake word key and file, voice choice.
- `lib/store.js` saves data in Upstash Redis (free), or a local JSON file when testing on a computer.
- Weather and air quality come from Open-Meteo (free, no key).
- Wake word: tap-to-talk by default. Picovoice Porcupine Web (files in `public/vendor` and `public/wake`) is used once an AccessKey and .ppn are saved. Opt-in "chrome" mode uses continuous webkitSpeechRecognition (Android beeps on each restart). Speech-to-text and the voice use Chrome's built-in Web Speech features.

## Environment variables (set in Vercel)

| Name | Required | What it's for |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | Claude API key for Silly Milly |
| `FAMILY_PIN` | yes | PIN the tablet sends with every request |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | yes | Added automatically when you connect Upstash Redis |
| `MILLY_MODEL` | no | Claude model, default `claude-haiku-5-5` (e.g. `claude-opus-5-5` for a smarter but pricier Milly) |
| `MILLY_EFFORT` | no | `low` (default), `medium` or `high` |
| `FAMILY_CITY`, `FAMILY_LAT`, `FAMILY_LON`, `FAMILY_TIMEZONE`, `FAMILY_KIDS` | no | Change location or names for Milly |

## Test on a computer

```bash
npm install
FAMILY_PIN=1234 ANTHROPIC_API_KEY=sk-ant-... npm run dev
# open http://localhost:3000
```
