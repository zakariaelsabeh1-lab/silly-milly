/* Family Board + Silly Milly
 * Plain JavaScript (no build step) so it runs on older Android tablets.
 * Change the CONFIG block below to adjust names, times and tasks.
 */
(function () {
  "use strict";

  var CONFIG = {
    familyName: "El Sabeh family", // used in the greeting
    place: "Prince George",
    lat: 53.9171,
    lon: -122.7497,
    // B.C. stopped changing its clocks in November 2026 and now stays on UTC-7 all year.
    // Older browsers still think B.C. "fell back" to UTC-8, so the clock was an hour behind.
    // "America/Dawson_Creek" has always been UTC-7 all year, so every browser gets it right.
    tz: "America/Dawson_Creek",       // time zone for the weather forecast's days
    clockTz: "America/Dawson_Creek",  // clock, bedtime schedule and Milly ("auto" = tablet's setting; also in ⚙️ Settings)
    kids: [
      { id: "noah", name: "Noah", color: "#5aa9ff" },
      { id: "didi", name: "Didi", color: "#ff7ab6" }
    ],
    bedtime: {
      start: "19:30",    // switch to the bedtime screen
      remind: "19:45",   // spoken reminder
      bed: "20:00",      // in bed for stories
      showUntil: "21:00",
      tasks: [
        { id: "toilet", label: "Use the toilet", icon: "🚽" },
        { id: "puffer", label: "Puffer", icon: "💨", only: ["noah"] },
        { id: "vitamins", label: "Vitamins", icon: "💊" },
        { id: "teeth", label: "Brush teeth", icon: "🦷" },
        { id: "jammies", label: "Jammies on", icon: "👕" },
        { id: "ready", label: "Ready for tomorrow", icon: "🎒" },
        { id: "hair", label: "Brush hair", icon: "🎀", only: ["didi"] }
      ]
    },
    morning: {
      // School and daycare days (Mon-Fri). These four times can also be changed in ⚙️ Settings.
      weekday: { start: "07:00", remind: "07:20", leave: "07:30", showUntil: "08:30" },
      // Weekends are slow: no countdown, no leave-the-house alert, no star challenge.
      weekend: { start: "08:30", showUntil: "11:00" },
      tasks: [
        { id: "toilet", label: "Use the toilet", icon: "🚽" },
        { id: "puffer", label: "Puffer", icon: "💨", only: ["noah"] },
        { id: "vitamins", label: "Vitamins", icon: "💊" },
        { id: "teeth", label: "Brush teeth", icon: "🦷" },
        { id: "dressed", label: "Get dressed", icon: "👕" },
        { id: "hair", label: "Brush hair", icon: "🎀", only: ["didi"] },
        { id: "breakfast", label: "Eat breakfast", icon: "🥣" },
        { id: "downstairs", label: "Go downstairs", icon: "🪜", weekdays: true },
        { id: "shoes", label: "Put your shoes on", icon: "👟", weekdays: true },
        { id: "ready", label: "Ready to go", icon: "🎒", weekdays: true, labels: { noah: "Ready for school", didi: "Ready for daycare" }, icons: { didi: "🧸" } }
      ],
      // Each kid's own order (task ids). Tasks not listed go at the end.
      // "weekdays: true" tasks only show Monday to Friday.
      order: {
        noah: ["breakfast", "vitamins", "toilet", "dressed", "puffer", "teeth", "ready", "downstairs", "shoes"],
        didi: ["toilet", "breakfast", "vitamins", "dressed", "hair", "teeth", "ready", "downstairs", "shoes"]
      }
    },
    // Weekday star challenge: a star when every morning task is ticked by leave time,
    // a broken heart if not. Enough stars Monday to Friday earns the weekly surprise.
    // Sick days and holidays can be marked "day off" in ⚙️ Settings (they count as a star).
    challenge: {
      on: true,
      need: 5 // stars needed out of 5 school days (5 = every day on time)
    },
    // Kind-heart reminders, shown on the morning and bedtime screens and said out loud. One per day.
    values: {
      morning: [
        "Today, be kind, use your good manners, and listen to your parents and your teachers.",
        "Say please and thank you, be a good friend, and listen to your teachers today.",
        "Be gentle and kind to everyone, and listen to your parents and your teachers.",
        "Use your good manners today, help someone out, and be a good listener.",
        "Be a good person today: share, take turns, and listen to your teachers.",
        "Remember: kind words, good manners, and listening ears all day long."
      ],
      bedtime: [
        "Thank you for being kind today. Tomorrow, let's use good manners and listen to our parents and teachers again.",
        "Did you help someone today? Being kind and listening makes everyone happy. Sweet dreams.",
        "Good people say sorry, say thank you, and listen. You can do all of those tomorrow too.",
        "Being kind and having good manners is the best thing you can do. Proud of you.",
        "Tomorrow is a new day to be a good friend, use your manners, and listen to your teachers.",
        "Kind hearts, good manners, and listening ears. Rest up for another great day."
      ]
    },
    who: ["Everyone", "Noah", "Didi", "Parents"],
    nightDim: { from: "21:30", to: "06:00" },
    idleMinutes: 3
  };

  // ---------- tiny helpers ----------
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function ymd(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function hm(d) { return pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function parseYmd(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  function to12(t) {
    if (!t) return "";
    var p = t.split(":"), h = +p[0], m = p[1];
    var ap = h >= 12 ? "PM" : "AM";
    h = h % 12; if (h === 0) h = 12;
    return h + ":" + m + " " + ap;
  }
  function between(t, from, to) { return from <= to ? t >= from && t < to : t >= from || t < to; }
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var DAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function storeDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

  // ---------- family time zone ----------
  // The clock follows a fixed time zone instead of the browser's own, because browsers with
  // out-of-date time zone rules show B.C. time an hour behind (see CONFIG.clockTz).
  var tzFormatter = null, tzFormatterZone = null;
  function activeTz() {
    var z = (typeof settings !== "undefined" && settings && settings.timeZone) || CONFIG.clockTz;
    return z && z !== "auto" ? z : null;
  }
  function deviceTz() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { return ""; }
  }
  // Returns a Date whose local fields (getHours, getDate...) show the wall-clock time in the family's zone.
  function now() {
    var real = new Date(), tz = activeTz();
    if (!tz) return real;
    try {
      if (tzFormatterZone !== tz) {
        tzFormatter = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false });
        tzFormatterZone = tz;
      }
      var p = {};
      tzFormatter.formatToParts(real).forEach(function (x) { p[x.type] = x.value; });
      return new Date(+p.year, +p.month - 1, +p.day, (+p.hour) % 24, +p.minute, +p.second);
    } catch (e) { return real; }
  }

  // ---------- API with family PIN ----------
  var pin = store("familyPin") || "";
  var pinWaiters = null;
  function api(path, opts) {
    opts = opts || {};
    var headers = { "Content-Type": "application/json", "X-Family-Pin": pin };
    return fetch(path, { method: opts.method || "GET", headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined })
      .then(function (r) {
        if (r.status === 401) return askPin().then(function () { return api(path, opts); });
        return r.json().then(function (j) {
          if (!r.ok) throw new Error(j && j.error ? j.error : "Request failed");
          return j;
        });
      });
  }
  function askPin() {
    if (pinWaiters) return new Promise(function (res) { pinWaiters.push(res); });
    pinWaiters = [];
    return new Promise(function (resolve) {
      pinWaiters.push(resolve);
      var typed = "";
      var card = $("modal-card");
      card.innerHTML = "";
      card.appendChild(el("h2", null, "Family PIN"));
      card.appendChild(el("p", "muted", "Enter the PIN you set in Vercel (FAMILY_PIN). You only need to do this once."));
      var dots = el("div", "pin-dots", "");
      card.appendChild(dots);
      var padEl = el("div", "pin-pad");
      ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "OK"].forEach(function (k) {
        var b = el("button", null, k);
        b.onclick = function () {
          if (k === "⌫") typed = typed.slice(0, -1);
          else if (k === "OK") {
            pin = typed; store("familyPin", pin); closeModal();
            var w = pinWaiters; pinWaiters = null;
            w.forEach(function (f) { f(); });
            return;
          } else if (typed.length < 12) typed += k;
          dots.textContent = typed.replace(/./g, "●");
        };
        padEl.appendChild(b);
      });
      card.appendChild(padEl);
      $("modal").classList.remove("hidden");
    });
  }
  function closeModal() { $("modal").classList.add("hidden"); }

  // ---------- views ----------
  var currentView = "home";
  function showView(name) {
    currentView = name;
    var views = document.querySelectorAll(".view");
    for (var i = 0; i < views.length; i++) views[i].classList.toggle("active", views[i].id === "view-" + name);
    var btns = document.querySelectorAll(".nav-btn");
    for (var j = 0; j < btns.length; j++) {
      var v = btns[j].getAttribute("data-view");
      btns[j].classList.toggle("active", v === name || (name === "history" && v === historyRoutine));
    }
    if (name === "bedtime" || name === "morning") renderBedtime();
    if (name === "calendar") loadMonth();
    if (name === "history") loadHistory();
    if (name === "settings") renderSettings();
    if (name === "news") loadNews();
  }
  function isSchoolDay(d) { var w = (d || now()).getDay(); return w >= 1 && w <= 5; }
  function addMin(t, n) { var p = t.split(":"), x = (+p[0] * 60 + +p[1] + n + 1440) % 1440; return pad(Math.floor(x / 60)) + ":" + pad(x % 60); }
  function validTime(t) { return typeof t === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(t); }
  // Today's morning schedule: school days (Mon-Fri) or the slower weekend one, with ⚙️ Settings changes.
  function morningTimes(d) {
    var mt = (settings && settings.morningTimes) || {}, c = CONFIG.morning;
    var pick = function (k, def) { return validTime(mt[k]) ? mt[k] : def; };
    if (isSchoolDay(d)) {
      var o = { school: true, start: pick("start", c.weekday.start), remind: pick("remind", c.weekday.remind), leave: pick("leave", c.weekday.leave) };
      o.showUntil = o.leave > addMin(c.weekday.showUntil, -60) ? addMin(o.leave, 60) : c.weekday.showUntil;
      return o;
    }
    var ws = pick("weekendStart", c.weekend.start);
    return { school: false, start: ws, showUntil: ws === c.weekend.start ? c.weekend.showUntil : addMin(ws, 150) };
  }
  function defaultView() {
    var t = hm(now()), mo = morningTimes();
    if (between(t, CONFIG.bedtime.start, CONFIG.bedtime.showUntil)) return "bedtime";
    if (between(t, mo.start, mo.showUntil)) return "morning";
    return "home";
  }

  // ---------- clock ----------
  var lastMinute = "";
  function tick() {
    var d = now();
    var h = d.getHours() % 12 || 12;
    $("clock").innerHTML = h + ":" + pad(d.getMinutes()) + "<small>" + (d.getHours() >= 12 ? "PM" : "AM") + "</small>";
    $("date").textContent = DAYS_LONG[d.getDay()] + ", " + MONTHS[d.getMonth()] + " " + d.getDate();
    $("dim-clock").textContent = h + ":" + pad(d.getMinutes());
    var m = hm(d);
    if (m !== lastMinute) { lastMinute = m; everyMinute(d, m); }
    if (currentView === "morning") updateTimer();
  }

  var lastTouch = Date.now();
  var dimmedByUser = false;
  function everyMinute(d, m) {
    // Bedtime schedule
    var bt = CONFIG.bedtime;
    if (m === bt.start) {
      showView("bedtime"); chime();
      say("Time to get ready for bed, " + kidNames() + "! Let's do the checklist.");
    } else if (m === bt.remind) {
      showView("bedtime"); chime();
      say("Fifteen minutes until bed! " + whatsLeftSentence("bedtime"));
    } else if (m === bt.bed) {
      showView("bedtime"); chime();
      say("It's eight o'clock. Into bed for stories! " + valuesLine("bedtime") + " Good night " + kidNames() + ".");
    }
    // Morning schedule: school days have a countdown and the star challenge, weekends are slow.
    var mo = morningTimes();
    if (m === mo.start) {
      showView("morning"); chime();
      say(mo.school
        ? "Good morning " + kidNames() + "! Time to get ready. The timer is on, let's win a star! " + valuesLine("morning")
        : "Good morning " + kidNames() + "! Happy " + DAYS_LONG[d.getDay()] + ". No rush today, here's your morning list. " + valuesLine("morning"));
    } else if (mo.school && m === mo.remind) {
      showView("morning"); chime();
      say(minutesUntil(mo.leave) + " minutes until we leave the house! " + whatsLeftSentence("morning"));
    } else if (mo.school && m === mo.leave) {
      showView("morning"); chime(); renderBedtime();
      say("Time to leave the house! Noah, off to school. Didi, off to daycare. " + starSentence() + " Have a great day, and remember your good manners!");
    }
    renderBedtime(); // also turns today's ⏳ into a star result once leave time passes
    updateGreeting(d);
    // New day: refresh
    if (m === "00:01") { loadWeather(); loadUpcoming(); loadToday(); }
    // Night dimming
    var night = between(m, CONFIG.nightDim.from, CONFIG.nightDim.to);
    if (!night) dimmedByUser = false;
    if (night && !dimmedByUser && Date.now() - lastTouch > 5 * 60000 && !millyBusy) $("dimmer").classList.remove("hidden");
    if (!night) $("dimmer").classList.add("hidden");
    wakeMinute();
    // Go back to the main screen when nobody's touched it
    if (Date.now() - lastTouch > CONFIG.idleMinutes * 60000 && !millyBusy && $("modal").classList.contains("hidden")) {
      var dv = defaultView();
      if (currentView !== dv) showView(dv);
    }
    if (d.getMinutes() % 15 === 0) { loadWeather(); if (currentView === "news") loadNews(); }
    if (d.getMinutes() % 5 === 0) { loadUpcoming(); if (currentView === "bedtime" || currentView === "morning") loadToday(); }
  }

  // ---------- weather ----------
  var WMO = {
    0: ["☀️", "Clear"], 1: ["🌤️", "Mostly clear"], 2: ["⛅", "Partly cloudy"], 3: ["☁️", "Cloudy"],
    45: ["🌫️", "Fog"], 48: ["🌫️", "Freezing fog"],
    51: ["🌦️", "Light drizzle"], 53: ["🌦️", "Drizzle"], 55: ["🌧️", "Heavy drizzle"], 56: ["🌧️", "Freezing drizzle"], 57: ["🌧️", "Freezing drizzle"],
    61: ["🌧️", "Light rain"], 63: ["🌧️", "Rain"], 65: ["🌧️", "Heavy rain"], 66: ["🌧️", "Freezing rain"], 67: ["🌧️", "Freezing rain"],
    71: ["🌨️", "Light snow"], 73: ["🌨️", "Snow"], 75: ["❄️", "Heavy snow"], 77: ["🌨️", "Snow grains"],
    80: ["🌦️", "Showers"], 81: ["🌧️", "Showers"], 82: ["⛈️", "Heavy showers"], 85: ["🌨️", "Snow showers"], 86: ["❄️", "Heavy snow showers"],
    95: ["⛈️", "Thunderstorm"], 96: ["⛈️", "Thunderstorm"], 99: ["⛈️", "Thunderstorm"]
  };
  function wmo(c) { return WMO[c] || ["🌡️", ""]; }
  function aqiLevel(v) {
    if (v == null) return null;
    if (v <= 50) return { n: 1, t: "Good" };
    if (v <= 100) return { n: 2, t: "Moderate" };
    if (v <= 150) return { n: 3, t: "Sensitive" };
    if (v <= 200) return { n: 4, t: "Unhealthy" };
    if (v <= 300) return { n: 5, t: "Very unhealthy" };
    return { n: 6, t: "Hazardous" };
  }
  function aqiChip(v, short) {
    var lv = aqiLevel(v);
    var s = el("span", "aqi-chip" + (lv ? " aqi-" + lv.n : ""));
    s.textContent = lv ? (short ? "AQ " + Math.round(v) : "Air " + Math.round(v) + " · " + lv.t) : (short ? "AQ –" : "Air –");
    return s;
  }
  function wearTip(day, nowAqi, maxAqi) {
    var lo = day.feelsMin, hi = day.feelsMax, tips = [];
    if (lo <= -25) tips.push("🧥 Big winter coat, snow pants, toque, mitts and a neck warmer. Very cold!");
    else if (lo <= -10) tips.push("🧥 Winter coat, snow pants, toque, mitts and boots.");
    else if (lo <= 0) tips.push("🧥 Winter coat, toque and mitts.");
    else if (lo <= 8) tips.push("🧥 Warm jacket and a hat.");
    else if (hi <= 17) tips.push("👕 Hoodie or a light jacket.");
    else tips.push("👕 T-shirt weather!");
    if (day.snow > 0.5) tips.push("👢 Snow boots today.");
    else if (day.pop >= 50 && hi > 2) tips.push("☔ Bring a raincoat.");
    if (day.uv >= 6) tips.push("🧴 Sunscreen and a sun hat.");
    var worst = Math.max(nowAqi || 0, maxAqi || 0);
    if (worst > 150) tips.push("😷 Smoky air. Play inside today.");
    else if (worst > 100) tips.push("😷 Air is not great. Noah should take it easy outside.");
    return tips.join(" ");
  }

  function loadWeather() {
    var base = "latitude=" + CONFIG.lat + "&longitude=" + CONFIG.lon + "&timezone=" + encodeURIComponent(CONFIG.tz);
    var fUrl = "https://api.open-meteo.com/v1/forecast?" + base + "&forecast_days=8" +
      "&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day" +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_probability_max,snowfall_sum,uv_index_max";
    var aUrl = "https://air-quality-api.open-meteo.com/v1/air-quality?" + base + "&forecast_days=7&current=us_aqi&hourly=us_aqi";
    Promise.all([
      fetch(fUrl).then(function (r) { return r.json(); }),
      fetch(aUrl).then(function (r) { return r.json(); }).catch(function () { return null; })
    ]).then(function (res) { renderWeather(res[0], res[1]); })
      .catch(function () { $("now-desc").textContent = "Weather unavailable"; });
  }
  // Weather pictures drawn as tiny SVGs, so they look the same on every device.
  var SUN = "#FFC93C", CLOUD = "#E8EEF8", CLOUD2 = "#B9C6DA", RAIN = "#5AB4FF", SNOW = "#FFFFFF";
  function sunSvg(cx, cy, r) {
    var rays = "";
    for (var i = 0; i < 8; i++) {
      var ang = i * Math.PI / 4, x1 = cx + Math.cos(ang) * (r + 4), y1 = cy + Math.sin(ang) * (r + 4), x2 = cx + Math.cos(ang) * (r + 9), y2 = cy + Math.sin(ang) * (r + 9);
      rays += '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '"/>';
    }
    return '<g stroke="' + SUN + '" stroke-width="3.5" stroke-linecap="round">' + rays + '</g><circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + SUN + '"/>';
  }
  function moonSvg(cx, cy, r) {
    return '<path d="M' + (cx + 2) + ' ' + (cy - r) + 'a' + r + ' ' + r + ' 0 1 0 ' + (r - 2) + ' ' + (r * 1.6).toFixed(1) + 'a' + (r * 0.8).toFixed(1) + ' ' + (r * 0.8).toFixed(1) + ' 0 0 1 -' + (r - 2) + ' -' + (r * 1.6).toFixed(1) + 'z" fill="#F4E7B0"/>';
  }
  function cloudSvg(tx, ty, sc, fill) {
    return '<g transform="translate(' + tx + ' ' + ty + ') scale(' + sc + ')"><path d="M18 50h30a11 11 0 0 0 1.5-21.9A15 15 0 0 0 20.6 24 12 12 0 0 0 18 50z" fill="' + (fill || CLOUD) + '"/></g>';
  }
  function weatherSvg(code, isDay) {
    var body = "", sky = isDay === 0 ? moonSvg(22, 22, 12) : sunSvg(22, 22, 10);
    if (code === 0) body = isDay === 0 ? moonSvg(30, 30, 18) : sunSvg(32, 32, 14);
    else if (code === 1) body = (isDay === 0 ? moonSvg(26, 26, 16) : sunSvg(28, 28, 13)) + cloudSvg(18, 20, 0.7);
    else if (code === 2) body = sky + cloudSvg(6, 8, 0.95);
    else if (code === 3) body = cloudSvg(-6, -2, 0.85, CLOUD2) + cloudSvg(4, 6, 1);
    else if (code === 45 || code === 48) body = cloudSvg(2, -6, 0.95, CLOUD2) + '<g stroke="' + CLOUD + '" stroke-width="4" stroke-linecap="round"><line x1="10" y1="48" x2="54" y2="48"/><line x1="16" y1="57" x2="48" y2="57"/></g>';
    else if (code >= 95) body = cloudSvg(2, -6, 0.95, CLOUD2) + '<path d="M34 38l-9 13h7l-4 11 12-15h-7l5-9z" fill="' + SUN + '"/>';
    else if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
      body = cloudSvg(2, -8, 0.95);
      [[20, 50], [32, 56], [44, 50], [26, 60], [40, 61]].forEach(function (p) { body += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3.2" fill="' + SNOW + '"/>'; });
    } else if (code >= 51) {
      var heavy = code === 55 || code === 65 || code === 82 || code === 63 || code === 81;
      body = (code >= 80 ? sky : "") + cloudSvg(2, -8, 0.95, code >= 61 ? CLOUD2 : CLOUD) + '<g stroke="' + RAIN + '" stroke-width="3.5" stroke-linecap="round">' +
        '<line x1="22" y1="48" x2="18" y2="57"/><line x1="34" y1="48" x2="30" y2="57"/>' + (heavy || code < 60 ? '<line x1="46" y1="48" x2="42" y2="57"/>' : "") + "</g>";
    } else body = cloudSvg(4, 4, 1);
    return '<svg viewBox="0 0 64 64" aria-hidden="true">' + body + "</svg>";
  }

  var lastDayAqi = {};
  function renderWeather(f, a) {
    if (!f || !f.current) return;
    var c = f.current, w = wmo(c.weather_code), d = f.daily;
    $("now-icon").innerHTML = weatherSvg(c.weather_code, c.is_day);
    $("now-temp").textContent = Math.round(c.temperature_2m) + "°C";
    $("now-desc").textContent = w[1] + " in " + CONFIG.place;
    $("now-feels").textContent = "Feels like " + Math.round(c.apparent_temperature) + "° · Wind " + Math.round(c.wind_speed_10m) + " km/h";
    $("now-hilo").innerHTML = "H " + Math.round(d.temperature_2m_max[0]) + "° <span>L " + Math.round(d.temperature_2m_min[0]) + "°</span>";

    var dayAqi = {};
    if (a && a.hourly) {
      for (var i = 0; i < a.hourly.time.length; i++) {
        var dd = a.hourly.time[i].slice(0, 10), v = a.hourly.us_aqi[i];
        if (v != null) dayAqi[dd] = Math.max(dayAqi[dd] || 0, v);
      }
    }
    lastDayAqi = dayAqi;
    var nowAqi = a && a.current ? a.current.us_aqi : null;
    var chip = aqiChip(nowAqi, false);
    var old = $("now-aqi"); chip.id = "now-aqi"; old.parentNode.replaceChild(chip, old);

    var week = $("week"); week.innerHTML = "";
    for (var k = 0; k < d.time.length && k < 8; k++) {
      var date = parseYmd(d.time[k]);
      var card = el("div", "card day-card" + (k === 0 ? " today" : ""));
      card.appendChild(el("div", "day-name", k === 0 ? "Today" : DAYS[date.getDay()]));
      var ic = el("div", "day-icon"); ic.innerHTML = weatherSvg(d.weather_code[k], 1); card.appendChild(ic);
      var t = el("div", "day-temps");
      t.innerHTML = "<b>" + Math.round(d.temperature_2m_max[k]) + "°</b> <span>" + Math.round(d.temperature_2m_min[k]) + "°</span>";
      card.appendChild(t);
      var pop = d.precipitation_probability_max[k];
      card.appendChild(el("div", "day-pop", pop != null && pop >= 20 ? pop + "% " + (d.snowfall_sum[k] > 0 ? "snow" : "rain") : ""));
      card.appendChild(aqiChip(dayAqi[d.time[k]], true));
      week.appendChild(card);
    }
    $("wear").innerHTML = "<b>What to wear:</b> " + wearTip({
      feelsMin: d.apparent_temperature_min[0], feelsMax: d.apparent_temperature_max[0],
      pop: d.precipitation_probability_max[0] || 0, snow: d.snowfall_sum[0] || 0, uv: d.uv_index_max[0] || 0
    }, nowAqi, dayAqi[d.time[0]]);
    renderAqWeek(d.time.slice(0, 7), dayAqi);
  }

  function renderAqWeek(dates, dayAqi) {
    var box = $("aq-week"); box.innerHTML = "";
    var bad = [];
    dates.forEach(function (ds, i) {
      var v = dayAqi[ds], lv = aqiLevel(v);
      var col = el("div", "aq-col");
      col.appendChild(el("div", "aq-val", v == null ? "–" : String(Math.round(v))));
      var bar = el("div", "aq-bar" + (lv ? " aqi-" + lv.n : ""));
      bar.style.height = v == null ? "8px" : Math.max(10, Math.min(v, 200) / 200 * 100) + "%";
      col.appendChild(bar);
      col.appendChild(el("div", "aq-day", i === 0 ? "Tdy" : DAYS[parseYmd(ds).getDay()]));
      box.appendChild(col);
      if (v != null && v > 100) bad.push(i === 0 ? "today" : DAYS_LONG[parseYmd(ds).getDay()]);
    });
    var known = dates.filter(function (ds) { return dayAqi[ds] != null; }).length;
    $("aq-note").textContent = !known ? "No air quality forecast right now." :
      bad.length ? "Smoky or poor air " + (bad.length > 2 ? "most of the week" : bad.join(" and ")) + ". Keep outdoor play short, especially for Noah." :
      "Good to moderate air all week. 🌲";
  }

  // ---------- events on the home screen ----------
  function eventColor(who) {
    for (var i = 0; i < CONFIG.kids.length; i++) if (CONFIG.kids[i].name === who) return CONFIG.kids[i].color;
    return who === "Parents" ? "#b18cff" : "#ffd166";
  }
  function whenText(e) {
    var todayD = parseYmd(ymd(now()));
    var day = parseYmd(e.occurrence);
    var diff = Math.round((day - todayD) / 86400000);
    var label = diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : DAYS_LONG[day.getDay()] + ", " + MONTHS[day.getMonth()].slice(0, 3) + " " + day.getDate();
    return { label: label + (e.start ? " · " + to12(e.start) : ""), diff: diff };
  }
  function agendaItem(e, showDay) {
    var w = whenText(e);
    var it = el("div", "agenda-item");
    var bar = el("div", "agenda-bar"); bar.style.background = eventColor(e.who); it.appendChild(bar);
    var txt = el("div");
    var when = showDay ? w.label : (e.start ? to12(e.start) + (e.end ? " – " + to12(e.end) : "") : "All day");
    txt.appendChild(el("div", "agenda-when", when + (e.who && e.who !== "Everyone" ? " · " + e.who : "")));
    txt.appendChild(el("div", "agenda-title", e.title));
    if (showDay && w.diff >= 2) txt.appendChild(el("div", "agenda-count", w.diff + " sleeps to go"));
    it.appendChild(txt);
    return it;
  }
  function loadUpcoming() {
    var s = now();
    api("/api/events?start=" + ymd(s) + "&end=" + ymd(addDays(s, 60))).then(function (r) {
      var todayS = ymd(now()), nowT = hm(now());
      var tList = $("today-list"), uList = $("upcoming-list");
      tList.innerHTML = ""; uList.innerHTML = "";
      var todays = r.events.filter(function (e) { return e.occurrence === todayS; });
      var later = todays.filter(function (e) { return !(e.start && (e.end || e.start) < nowT); });
      if (!todays.length) tList.appendChild(el("div", "tile-empty", "Nothing planned today. 🎈"));
      else if (!later.length) tList.appendChild(el("div", "tile-empty", "All done for today! ✅"));
      later.slice(0, 4).forEach(function (e) { tList.appendChild(agendaItem(e, false)); });
      if (later.length > 4) tList.appendChild(el("div", "agenda-when", "+" + (later.length - 4) + " more"));

      var seen = {};
      var next = r.events.filter(function (e) {
        if (e.occurrence === todayS || seen[e.id]) return false; // a repeating event shows once, at its next time
        seen[e.id] = true; return true;
      });
      if (!next.length) uList.appendChild(el("div", "tile-empty", "Nothing yet. Try: “Hey Silly Milly, add swimming on Saturday at 10.”"));
      next.slice(0, 4).forEach(function (e) { uList.appendChild(agendaItem(e, true)); });
    }).catch(function () {});
  }

  // ---------- bedtime on the home screen ----------
  function ringSvg(done, total, color) {
    var r = 26, c = 2 * Math.PI * r, pct = total ? done / total : 0;
    return '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="' + r + '" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="8"/>' +
      (pct <= 0 ? "</svg>" : '<circle cx="32" cy="32" r="' + r + '" fill="none" stroke="' + (pct >= 1 ? "#3ccf7a" : color) + '" stroke-width="8" stroke-linecap="round" stroke-dasharray="' + (c * pct).toFixed(1) + " " + c.toFixed(1) + '"/></svg>');
  }
  // Home tile: the morning routine until noon (on school days), then tonight's bedtime.
  function renderHomeBed() {
    var box = $("home-bed"); if (!box) return;
    box.innerHTML = "";
    var t = hm(now()), bt = CONFIG.bedtime, mo = morningTimes();
    var name = t >= "05:00" && t < "12:00" ? "morning" : "bedtime";
    $("routine-tile").setAttribute("data-go", name);
    $("routine-tile-title").textContent = name === "morning" ? "Morning routine" : "Bedtime tonight";
    var when;
    if (name === "morning") {
      if (!mo.school) when = t < mo.start ? "Slow morning · starts at " + to12(mo.start) : "Weekend morning, no rush 😊";
      else if (t < mo.start) when = "Starts at " + to12(mo.start);
      else if (t < mo.leave) when = "Leave the house at " + to12(mo.leave) + " · " + minutesUntil(mo.leave) + " min";
      else when = "Have a great day! ☀️";
    } else if (t >= "05:00" && t < bt.start) {
      var m = minutesUntil(bt.start), hh = Math.floor(m / 60), mm = m % 60;
      when = "Starts at " + to12(bt.start) + " · in " + (hh ? hh + " h " : "") + mm + " min";
    } else if (t >= bt.start && t < bt.bed) when = "Bed and stories at " + to12(bt.bed) + " · " + minutesUntil(bt.bed) + " min";
    else when = "Sleep tight! 🌙";
    box.appendChild(el("div", "hb-when", when));
    CONFIG.kids.forEach(function (kid) {
      var tasks = tasksFor(kid, name), done = state[name][kid.id] || {};
      var n = tasks.filter(function (x) { return done[x.id]; }).length;
      var row = el("div", "hb-kid");
      var ring = el("div", "hb-ring"); ring.innerHTML = ringSvg(n, tasks.length, kid.color); row.appendChild(ring);
      var txt = el("div");
      txt.appendChild(el("div", "hb-name", kid.name));
      txt.appendChild(el("div", "hb-sub", n === tasks.length ? "All done! ⭐" : n + " of " + tasks.length + " done"));
      row.appendChild(txt);
      box.appendChild(row);
    });
  }

  // Greeting and background colour change with the time of day
  function updateGreeting(d) {
    var h = d.getHours();
    var part = h < 5 ? "night" : h < 12 ? "morning" : h < 17 ? "day" : h < 21 ? "evening" : "night";
    var hello = h < 5 ? "Sweet dreams" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : h < 21 ? "Good evening" : "Good night";
    $("greeting").textContent = hello + ", " + CONFIG.familyName + "!";
    document.body.setAttribute("data-sky", part);
  }

  // ---------- morning and bedtime checklists ----------
  var state = { bedtime: {}, morning: {} }; // { noah: {toilet:"19:32"}, didi: {...} } for today
  var celebrated = {};
  var historyRoutine = "bedtime";
  var COLS = { bedtime: "bed-columns", morning: "morning-columns" };
  // school: true/false picks the school-day or weekend morning list (default: today).
  function tasksFor(kid, name, school) {
    var r = CONFIG[name || "bedtime"], order = r.order && r.order[kid.id];
    if (school === undefined) school = isSchoolDay();
    var list = r.tasks.filter(function (t) {
      return (!t.only || t.only.indexOf(kid.id) >= 0) && (!t.weekdays || school);
    }).map(function (t) {
      return { id: t.id, label: (t.labels && t.labels[kid.id]) || t.label, icon: (t.icons && t.icons[kid.id]) || t.icon };
    });
    if (order) {
      var pos = function (t) { var i = order.indexOf(t.id); return i < 0 ? 99 : i; };
      list.sort(function (a, b) { return pos(a) - pos(b); });
    }
    return list;
  }
  function kidNames() { return CONFIG.kids.map(function (k) { return k.name; }).join(" and "); }
  function leftFor(kid, name) {
    var done = state[name][kid.id] || {};
    return tasksFor(kid, name).filter(function (t) { return !done[t.id]; });
  }
  function whatsLeftSentence(name) {
    var parts = [];
    CONFIG.kids.forEach(function (k) {
      var left = leftFor(k, name);
      if (!left.length) parts.push(k.name + " is all done, great job!");
      else parts.push(k.name + " still needs: " + left.map(function (t) { return t.label.toLowerCase(); }).join(", ") + ".");
    });
    return parts.join(" ");
  }
  function valuesLine(name) {
    var list = CONFIG.values[name], d = now();
    var day = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
    return list[day % list.length];
  }
  function loadToday() {
    var key = ymd(now());
    return Promise.all(["bedtime", "morning"].map(function (name) {
      return api("/api/bedtime?days=" + (name === "morning" ? 7 : 1) + "&routine=" + name).then(function (r) {
        if (name === "morning") morningWeek = r.days || {};
        state[name] = (r.days && r.days[key]) || {};
        CONFIG.kids.forEach(function (k) { if (!leftFor(k, name).length) celebrated[name + key + k.id] = true; });
      });
    })).then(renderBedtime).catch(function () {});
  }
  function renderBedtime() { renderRoutine("morning"); renderRoutine("bedtime"); updateBedStatus(); renderHomeBed(); }
  function renderRoutine(name) {
    var wrap = $(COLS[name]); wrap.innerHTML = "";
    CONFIG.kids.forEach(function (kid) {
      var col = el("div", "kid-col");
      col.style.setProperty("--kid", kid.color);
      var tasks = tasksFor(kid, name), done = state[name][kid.id] || {};
      var count = tasks.filter(function (t) { return done[t.id]; }).length;
      if (count === tasks.length) col.classList.add("all-done");
      var head = el("div", "kid-head");
      head.appendChild(el("div", "kid-name", kid.name));
      if (name === "morning" && CONFIG.challenge.on && isSchoolDay()) head.appendChild(starRow(kid));
      head.appendChild(el("div", "kid-count", count === tasks.length ? "All done! ⭐" : count + " / " + tasks.length));
      col.appendChild(head);
      tasks.forEach(function (t) {
        var b = el("button", "task" + (done[t.id] ? " done" : ""));
        b.appendChild(el("span", "task-icon", t.icon));
        b.appendChild(el("span", "task-label", t.label));
        b.appendChild(el("span", "task-check", "✓"));
        b.onclick = function () { toggleTask(kid, t, name); };
        col.appendChild(b);
      });
      wrap.appendChild(col);
    });
    var vb = $(name + "-values"); vb.innerHTML = "";
    vb.appendChild(el("span", "vb-icon", name === "morning" ? "💛" : "🌟"));
    vb.appendChild(el("span", null, valuesLine(name)));
  }
  function pills(id, list, idx) {
    var box = $(id); box.innerHTML = "";
    list.forEach(function (p, i) { box.appendChild(el("span", "time-pill" + (i === idx ? " now" : ""), p)); });
  }
  function short12(t) { return to12(t).replace(/ (AM|PM)$/, ""); }
  function updateBedStatus() {
    var t = hm(now()), bt = CONFIG.bedtime, mo = CONFIG.morning, s;
    if (t < bt.start && t >= "12:00") s = "Bedtime routine starts at " + to12(bt.start);
    else if (t >= bt.start && t < bt.remind) s = "Getting ready for bed";
    else if (t >= bt.remind && t < bt.bed) s = "Almost bedtime! " + (Math.max(0, minutesUntil(bt.bed))) + " minutes left";
    else if (t >= bt.bed && t < "23:59") s = "In bed for stories 📚";
    else s = "Good morning!";
    $("bed-status").textContent = s;
    pills("bedtime-times", [short12(bt.start) + " Get ready", short12(bt.remind) + " Reminder", short12(bt.bed) + " Stories 📚"],
      t >= bt.bed ? 2 : t >= bt.remind ? 1 : t >= bt.start ? 0 : -1);
    var m;
    mo = morningTimes();
    if (!mo.school) {
      $("morning-status").textContent = "Happy " + DAYS_LONG[now().getDay()] + "! Slow morning, no rush 😊";
      pills("morning-times", [short12(mo.start) + " Good morning", "No school today 🏡"], t >= mo.start && t < "12:00" ? 0 : -1);
      updateTimer();
      return;
    }
    if (t < mo.start) m = "Getting ready starts at " + to12(mo.start);
    else if (t < mo.remind) m = "Let's get ready! We leave the house at " + to12(mo.leave) + " (" + minutesUntil(mo.leave) + " min)";
    else if (t < mo.leave) m = "Hurry hurry! " + minutesUntil(mo.leave) + " minutes left";
    else if (t < "12:00") m = "Off to school and daycare! 🚗";
    else m = "See you tomorrow morning!";
    $("morning-status").textContent = m;
    pills("morning-times", [short12(mo.start) + " Get ready", short12(mo.remind) + " Reminder", short12(mo.leave) + " Leave the house 🚗"],
      t >= "12:00" ? -1 : t >= mo.leave ? 2 : t >= mo.remind ? 1 : t >= mo.start ? 0 : -1);
    updateTimer();
  }

  // ---------- countdown timer (school days, get ready → leave the house) ----------
  function updateTimer() {
    var box = $("morning-timer"); if (!box) return;
    var mo = morningTimes(), n = now();
    var secs = function (t) { var p = t.split(":"); return +p[0] * 3600 + +p[1] * 60; };
    var nowS = n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds();
    if (!mo.school || nowS < secs(mo.start) || nowS >= secs(mo.leave) + 60) { box.classList.add("hidden"); return; }
    box.classList.remove("hidden");
    var left = Math.max(0, secs(mo.leave) - nowS), total = secs(mo.leave) - secs(mo.start) || 1;
    var pct = Math.min(100, left / total * 100);
    box.className = "morning-timer " + (left > 600 ? "ok" : left > 300 ? "soon" : "hurry");
    $("timer-bar").style.width = pct.toFixed(1) + "%";
    $("timer-text").textContent = left ? Math.floor(left / 60) + ":" + pad(left % 60) : "Time to go! 🚗";
    $("timer-label").textContent = left ? "until we leave the house" : "";
  }

  // ---------- weekly star challenge (school days) ----------
  // A star when every morning task is ticked by leave time. Parents can give a star back,
  // or mark a sick day / holiday as a day off, in ⚙️ Settings.
  var morningWeek = {}; // { "2026-11-23": { noah: {toilet:"07:05"}, didi: {...} } } for the last 7 days
  function weekDates() {
    var d = now(), mon = addDays(d, -((d.getDay() + 6) % 7)), out = [];
    for (var i = 0; i < 5; i++) out.push(addDays(mon, i));
    return out;
  }
  function overrideFor(key, kid) {
    var o = settings && settings.starOverrides && settings.starOverrides[key];
    return (o && o[kid.id]) || "";
  }
  // "star", "off" (day off, counts as a star), "missed", "pending" (today, still time) or "future"
  function dayResult(kid, d) {
    var key = ymd(d), today = ymd(now()), ov = overrideFor(key, kid);
    if (ov === "star" || ov === "off") return ov;
    if (ov === "missed") return "missed";
    if (key > today) return "future";
    var leave = morningTimes(d).leave;
    var done = key === today ? (state.morning[kid.id] || {}) : ((morningWeek[key] || {})[kid.id] || {});
    var onTime = tasksFor(kid, "morning", true).every(function (t) { return done[t.id] && done[t.id] <= leave; });
    if (onTime) return "star";
    if (key < today || hm(now()) > leave) return "missed";
    return "pending";
  }
  function weekSummary(kid) {
    var days = weekDates().map(function (d) { return { d: d, r: dayResult(kid, d) }; });
    var stars = days.filter(function (x) { return x.r === "star" || x.r === "off"; }).length;
    var missed = days.filter(function (x) { return x.r === "missed"; }).length;
    return { days: days, stars: stars, missed: missed, won: stars >= CONFIG.challenge.need, open: 5 - missed >= CONFIG.challenge.need };
  }
  var STAR_ICON = { star: "⭐", off: "🏖️", missed: "☆", pending: "⏳", future: "·" };
  function starRow(kid) {
    var w = weekSummary(kid), row = el("div", "star-row"), today = ymd(now());
    w.days.forEach(function (x) {
      var cell = el("div", "star-day " + x.r + (ymd(x.d) === today ? " today" : ""));
      cell.appendChild(el("span", "star-ico", STAR_ICON[x.r]));
      cell.appendChild(el("span", "star-lbl", DAYS[x.d.getDay()].charAt(0)));
      row.appendChild(cell);
    });
    var need = CONFIG.challenge.need - w.stars;
    row.appendChild(el("div", "star-goal" + (w.won ? " won" : ""),
      w.won ? "🎁 Surprise won!" : w.open ? "🎁 " + need + " more ⭐" : "🎁 New try Monday!"));
    return row;
  }
  // Said at leave time: cheerful either way.
  function starSentence() {
    if (!CONFIG.challenge.on) return "";
    var got = [], notYet = [], won = [];
    CONFIG.kids.forEach(function (k) {
      var r = dayResult(k, now());
      if (r === "star" || r === "off") got.push(k.name); else notYet.push(k.name);
      if (isFriday() && weekSummary(k).won) won.push(k.name);
    });
    var out = "";
    if (got.length) out += got.join(" and ") + (got.length > 1 ? " each" : "") + " won a star today! ";
    if (notYet.length) out += "No star today for " + notYet.join(" and ") + ", but that's okay. " + (isFriday() ? "New challenge on Monday!" : "Let's get it tomorrow!") + " ";
    if (won.length) out += "And " + won.join(" and ") + (won.length > 1 ? " have" : " has") + " won the weekly surprise! ";
    return out.trim();
  }
  function isFriday() { return now().getDay() === 5; }
  function minutesUntil(t) {
    var n = now(), p = t.split(":");
    return (+p[0] * 60 + +p[1]) - (n.getHours() * 60 + n.getMinutes());
  }
  function toggleTask(kid, t, name) {
    var key = ymd(now());
    var done = state[name][kid.id] = state[name][kid.id] || {};
    var on = !done[t.id];
    if (on) done[t.id] = hm(now()); else delete done[t.id];
    renderBedtime();
    if (on) blip();
    api("/api/bedtime", { method: "POST", body: { date: key, kid: kid.id, task: t.id, done: on, time: hm(now()), routine: name } })
      .catch(function () { /* will resync on next load */ });
    if (on && !leftFor(kid, name).length && !celebrated[name + key + kid.id]) {
      celebrated[name + key + kid.id] = true;
      if (name === "morning" && !isSchoolDay()) {
        celebrate(kid.name + " is all done! 🎉", "Great job, " + kid.name + "! Your morning list is all done.");
      } else if (name === "morning") {
        var place = kid.id === "didi" ? "daycare" : "school";
        var r = CONFIG.challenge.on ? dayResult(kid, now()) : "";
        if (r === "star" && isFriday() && weekSummary(kid).won)
          celebrate("🎁 " + kid.name + " won the weekly surprise! 🎉", "Wow, " + kid.name + "! You were ready on time all week. You won the weekly surprise!");
        else if (r === "star")
          celebrate(kid.name + " is ready for " + place + "! ⭐", kid.name + " is all ready for " + place + ", and that's a star! Awesome job, " + kid.name + ".");
        else
          celebrate(kid.name + " is ready for " + place + "! 🎉", kid.name + " is all ready for " + place + "! Awesome job, " + kid.name + "! Have a great day.");
      } else celebrate(kid.name + " is ready for bed! 🎉", kid.name + " is all done! Amazing job, " + kid.name + "!");
    }
  }
  function loadHistory() {
    var name = historyRoutine;
    $("history-title").textContent = name === "morning" ? "Morning history" : "Bedtime history";
    api("/api/bedtime?days=14&routine=" + name).then(function (r) {
      var box = $("history-table"); box.innerHTML = "";
      var table = el("table"), thead = el("tr");
      thead.appendChild(el("th", null, "Day"));
      var cols = [];
      CONFIG.kids.forEach(function (k) {
        tasksFor(k, name, true).forEach(function (t) { cols.push({ kid: k, task: t }); });
      });
      cols.forEach(function (c) {
        var th = el("th", c.task.id === "puffer" ? "puffer-col" : null, c.kid.name + " " + c.task.icon);
        th.title = c.task.label;
        thead.appendChild(th);
      });
      table.appendChild(thead);
      for (var i = 0; i < 14; i++) {
        var d = addDays(now(), -i), key = ymd(d), day = (r.days && r.days[key]) || {};
        var tr = el("tr");
        tr.appendChild(el("td", null, (i === 0 ? "Today" : i === 1 ? "Yesterday" : DAYS[d.getDay()] + " " + MONTHS[d.getMonth()].slice(0, 3) + " " + d.getDate())));
        cols.forEach(function (c) {
          var v = day[c.kid.id] && day[c.kid.id][c.task.id];
          var td = el("td", (v ? "yes" : "no") + (c.task.id === "puffer" ? " puffer-col" : ""), v ? "✓ " + to12(v).replace(" PM", "").replace(" AM", "") : "–");
          tr.appendChild(td);
        });
        table.appendChild(tr);
      }
      box.appendChild(table);
      box.appendChild(el("p", "muted", "The 💨 column is Noah's puffer. Times show when it was ticked."));
    }).catch(function (e) { $("history-table").textContent = "Couldn't load history: " + e.message; });
  }

  // ---------- news ----------
  var news = null, newsTab = "local", newsLoadedAt = 0;
  function timeAgo(t) {
    if (!t) return "";
    var m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return "just now";
    if (m < 60) return m + " min ago";
    var h = Math.round(m / 60);
    if (h < 24) return h + " h ago";
    var d = Math.round(h / 24);
    return d === 1 ? "yesterday" : d + " days ago";
  }
  function loadNews() {
    renderNews();
    if (news && Date.now() - newsLoadedAt < 5 * 60000) return;
    api("/api/news").then(function (r) { news = r; newsLoadedAt = Date.now(); renderNews(); })
      .catch(function (e) { if (!news) { $("news-list").innerHTML = ""; $("news-list").appendChild(el("div", "news-empty", "Couldn't load the news right now. " + e.message)); } });
  }
  function renderNews() {
    var tabs = document.querySelectorAll(".news-tab");
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle("active", tabs[i].getAttribute("data-news") === newsTab);
    var box = $("news-list"); box.innerHTML = "";
    if (!news) { box.appendChild(el("div", "news-empty", "Loading headlines…")); return; }
    $("news-updated").textContent = "Updated " + timeAgo(news.fetchedAt);
    var items = news[newsTab] || [];
    if (!items.length) { box.appendChild(el("div", "news-empty", "No headlines right now. Try again later.")); return; }
    items.forEach(function (it) {
      var b = el("button", "news-item");
      b.appendChild(el("div", "news-title", it.title));
      b.appendChild(el("div", "news-meta", it.source + (it.time ? " · " + timeAgo(it.time) : "")));
      b.onclick = function () { window.open(it.link, "_blank", "noopener"); };
      box.appendChild(b);
    });
  }

  // ---------- celebration + sounds ----------
  var audioCtx = null;
  function ctx() {
    if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    return audioCtx;
  }
  function tone(freq, start, dur, vol) {
    var c = ctx(); if (!c) return;
    var o = c.createOscillator(), g = c.createGain();
    o.type = "sine"; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, c.currentTime + start);
    g.gain.exponentialRampToValueAtTime(vol || 0.25, c.currentTime + start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
    o.connect(g); g.connect(c.destination);
    o.start(c.currentTime + start); o.stop(c.currentTime + start + dur + 0.05);
  }
  function chime() { tone(784, 0, 0.5); tone(988, 0.18, 0.5); tone(1175, 0.36, 0.8); }
  function blip() { tone(880, 0, 0.15, 0.15); tone(1320, 0.08, 0.2, 0.15); }
  function wakeSound() { tone(660, 0, 0.12, 0.2); tone(990, 0.1, 0.18, 0.2); }
  function celebrate(text, spoken) {
    $("celebrate-text").textContent = text;
    $("celebrate").classList.remove("hidden");
    var conf = $("confetti"), colors = ["#ffd166", "#5aa9ff", "#ff7ab6", "#3ccf7a", "#b18cff"];
    for (var i = 0; i < 40; i++) {
      var p = document.createElement("i");
      p.style.left = Math.random() * 100 + "vw";
      p.style.background = colors[i % colors.length];
      p.style.animationDuration = 2 + Math.random() * 2 + "s";
      p.style.animationDelay = Math.random() * 0.6 + "s";
      conf.appendChild(p);
    }
    tone(523, 0, 0.2); tone(659, 0.15, 0.2); tone(784, 0.3, 0.2); tone(1047, 0.45, 0.6);
    setTimeout(function () { say(spoken); }, 700);
    setTimeout(function () { $("celebrate").classList.add("hidden"); conf.innerHTML = ""; }, 4500);
  }

  // ---------- calendar ----------
  var calMonth = now(); calMonth.setDate(1);
  var selectedDay = ymd(now());
  var monthEvents = [];
  function loadMonth() {
    var first = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1);
    var start = addDays(first, -first.getDay());
    var end = addDays(start, 41);
    $("cal-title").textContent = MONTHS[calMonth.getMonth()] + " " + calMonth.getFullYear();
    renderMonth(start);
    api("/api/events?start=" + ymd(start) + "&end=" + ymd(end)).then(function (r) {
      monthEvents = r.events; renderMonth(start); renderDay();
    }).catch(function () {});
  }
  function renderMonth(start) {
    var grid = $("cal-grid"); grid.innerHTML = "";
    var todayS = ymd(now());
    for (var i = 0; i < 42; i++) {
      var d = addDays(start, i), key = ymd(d);
      var cell = el("button", "cal-cell" + (d.getMonth() !== calMonth.getMonth() ? " other" : "") + (key === todayS ? " today" : "") + (key === selectedDay ? " selected" : ""));
      cell.appendChild(el("span", "cal-num", String(d.getDate())));
      var evs = monthEvents.filter(function (e) { return e.occurrence === key; });
      evs.slice(0, 2).forEach(function (e) {
        var dot = el("span", "cal-dot", e.title);
        dot.style.background = eventColor(e.who); dot.style.color = "#111";
        cell.appendChild(dot);
      });
      if (evs.length > 2) cell.appendChild(el("span", "cal-dot", "+" + (evs.length - 2) + " more"));
      (function (k) { cell.onclick = function () { selectedDay = k; renderMonth(start); renderDay(); }; })(key);
      grid.appendChild(cell);
    }
  }
  function renderDay() {
    var d = parseYmd(selectedDay);
    $("day-title").textContent = DAYS_LONG[d.getDay()] + ", " + MONTHS[d.getMonth()] + " " + d.getDate();
    var list = $("day-list"); list.innerHTML = "";
    var evs = monthEvents.filter(function (e) { return e.occurrence === selectedDay; });
    if (!evs.length) list.appendChild(el("div", "muted", "No events. Tap + Add event, or ask Silly Milly."));
    evs.forEach(function (e) {
      var b = el("button", "ev");
      b.style.borderLeftColor = eventColor(e.who);
      b.appendChild(el("div", "ev-time", e.start ? to12(e.start) + (e.end ? " – " + to12(e.end) : "") : "All day"));
      b.appendChild(el("div", "ev-title", e.title));
      var extra = [e.who, e.repeat && e.repeat !== "none" ? "repeats " + e.repeat : "", e.notes].filter(Boolean).join(" · ");
      if (extra) b.appendChild(el("div", "ev-who", extra));
      b.onclick = function () { eventForm(e); };
      list.appendChild(b);
    });
  }
  function eventForm(existing) {
    var e = existing || { title: "", date: selectedDay, start: "", end: "", who: "Everyone", repeat: "none", notes: "" };
    var card = $("modal-card"); card.innerHTML = "";
    card.appendChild(el("h2", null, existing ? "Edit event" : "New event"));
    function field(label, input) { var l = el("label", null, label); l.appendChild(input); return l; }
    var title = el("input"); title.type = "text"; title.value = e.title; title.placeholder = "e.g. Swimming lessons";
    var date = el("input"); date.type = "date"; date.value = existing ? e.date : selectedDay;
    var start = el("input"); start.type = "time"; start.value = e.start || "";
    var end = el("input"); end.type = "time"; end.value = e.end || "";
    var repeat = el("select");
    [["none", "Doesn't repeat"], ["weekly", "Every week"], ["monthly", "Every month"], ["yearly", "Every year (birthdays)"]].forEach(function (o) {
      var op = el("option", null, o[1]); op.value = o[0]; if (o[0] === e.repeat) op.selected = true; repeat.appendChild(op);
    });
    var notes = el("input"); notes.type = "text"; notes.value = e.notes || ""; notes.placeholder = "Notes (optional)";
    card.appendChild(field("What", title));
    var row = el("div", "form-row");
    row.appendChild(field("Day", date)); row.appendChild(field("Start (blank = all day)", start)); row.appendChild(field("End", end));
    card.appendChild(row);
    var who = e.who || "Everyone";
    var chips = el("div", "chips");
    CONFIG.who.forEach(function (w) {
      var c = el("button", "chip" + (w === who ? " on" : ""), w);
      c.onclick = function () { who = w; var all = chips.children; for (var i = 0; i < all.length; i++) all[i].classList.toggle("on", all[i] === c); };
      chips.appendChild(c);
    });
    var wl = el("label", null, "Who"); wl.appendChild(chips); card.appendChild(wl);
    card.appendChild(field("Repeats", repeat));
    card.appendChild(notes);
    var actions = el("div", "modal-actions");
    if (existing) {
      var del = el("button", "danger-btn", "Delete");
      var armed = false;
      del.onclick = function () {
        if (!armed) { armed = true; del.textContent = "Tap again to delete"; return; }
        api("/api/events?id=" + encodeURIComponent(existing.id), { method: "DELETE" }).then(afterSave).catch(showErr);
      };
      actions.appendChild(del);
    }
    var cancel = el("button", "ghost-btn", "Cancel"); cancel.onclick = closeModal; actions.appendChild(cancel);
    var save = el("button", "big-btn", "Save");
    save.onclick = function () {
      var body = { title: title.value, date: date.value, start: start.value, end: end.value, who: who, repeat: repeat.value, notes: notes.value };
      var req = existing ? api("/api/events?id=" + encodeURIComponent(existing.id), { method: "PUT", body: body }) : api("/api/events", { method: "POST", body: body });
      req.then(function () { selectedDay = date.value || selectedDay; afterSave(); }).catch(showErr);
    };
    actions.appendChild(save);
    card.appendChild(actions);
    $("modal").classList.remove("hidden");
    function showErr(err) { alertLine(card, err.message); }
  }
  function alertLine(card, msg) { var p = el("p", null, msg); p.style.color = "var(--danger)"; card.appendChild(p); }
  function afterSave() {
    closeModal();
    var d = parseYmd(selectedDay); calMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    loadMonth(); loadUpcoming();
  }

  // ---------- speech out ----------
  var voices = [];
  var settings = { voiceName: "", wakeSens: 5, wakeMode: "" };
  function loadVoices() { try { voices = window.speechSynthesis ? speechSynthesis.getVoices() : []; } catch (e) { voices = []; } }
  function pickVoice() {
    if (!voices.length) loadVoices();
    if (settings.voiceName) for (var i = 0; i < voices.length; i++) if (voices[i].name === settings.voiceName) return voices[i];
    var en = voices.filter(function (v) { return /^en[-_](CA|US|GB|AU)/i.test(v.lang); });
    var fem = en.filter(function (v) { return /female|samantha|google us english|zira|aria|jenny/i.test(v.name); });
    return fem[0] || en[0] || null;
  }
  function say(text, done) {
    if (!window.speechSynthesis || !text) { if (done) done(); return; }
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      var v = pickVoice(); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = "en-CA";
      u.rate = 1; u.pitch = 1.1;
      var finished = false;
      var finish = function () { if (finished) return; finished = true; if (done) done(); };
      u.onend = finish; u.onerror = finish;
      // Some Android voices never fire onend; give up after a generous estimate.
      setTimeout(finish, 2500 + text.length * 90);
      speechSynthesis.speak(u);
    } catch (e) { if (done) done(); }
  }

  // ---------- Silly Milly ----------
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var millyBusy = false;
  var history = [];
  var recognizer = null;
  function setOrb(state, label) {
    $("milly-orb").className = "orb " + state;
    $("milly-state").textContent = label;
  }
  function openMilly(fromWake) {
    lastTouch = Date.now();
    $("dimmer").classList.add("hidden");
    $("milly-panel").classList.remove("hidden");
    $("milly-heard").textContent = ""; $("milly-reply").textContent = "";
    millyBusy = true;
    pauseWake().then(function () {
      if (fromWake) wakeSound();
      listen();
    });
  }
  function closeMilly() {
    try { if (recognizer) recognizer.abort(); } catch (e) {}
    try { speechSynthesis.cancel(); } catch (e) {}
    $("milly-panel").classList.add("hidden");
    $("milly-typed").classList.add("hidden");
    millyBusy = false;
    resumeWake();
  }
  var closeTimer = null;
  // followUp = listening for the next thing in a conversation: if nobody speaks, just close quietly.
  function listen(followUp) {
    clearTimeout(closeTimer);
    if (!SR) {
      setOrb("", "Type your question");
      $("milly-typed").classList.remove("hidden");
      $("milly-input").focus();
      return;
    }
    var r = new SR();
    recognizer = r;
    r.lang = "en-CA"; r.interimResults = true; r.maxAlternatives = 1; r.continuous = false;
    var finalText = "", gotResult = false;
    r.onresult = function (ev) {
      var t = "";
      for (var i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript;
      $("milly-heard").textContent = "“" + t + "”";
      if (ev.results[ev.results.length - 1].isFinal) { finalText = t; gotResult = true; }
    };
    r.onerror = function (ev) {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        setOrb("", "I need microphone permission");
        $("milly-typed").classList.remove("hidden");
      }
    };
    r.onend = function () {
      recognizer = null;
      if ($("milly-panel").classList.contains("hidden")) return;
      if (gotResult && finalText.trim()) ask(finalText.trim());
      else if (followUp) {
        setOrb("", "Say “Hey Silly Milly” any time");
        closeTimer = setTimeout(closeMilly, 1500);
      } else if (!$("milly-reply").textContent) {
        setOrb("", "I didn't hear anything");
        closeTimer = setTimeout(closeMilly, 6000);
      } else {
        setOrb("", "Tap to ask again");
        closeTimer = setTimeout(closeMilly, 8000);
      }
    };
    setOrb("listening", followUp ? "Anything else?" : "Listening…");
    try { r.start(); } catch (e) { setOrb("", "Microphone busy, try again"); }
  }
  var lastAskAt = 0;
  var WAKE_PREFIX = /^\s*(?:(?:hey|hi|okay|ok)\s+)?(?:silly|silli|sili)\s*(?:milly|millie|milli|mili)[\s,.!?]*/i;
  var DONE_RE = /^(?:(?:ok(?:ay)?|no|nope)[\s,]+)?(?:thanks?(?: you)?(?: milly)?|thank you(?: milly)?|that'?s (?:all|it)|no thanks?|nope|nothing|bye|goodbye|bye bye|see you|stop|never ?mind|cancel|go away|i'?m good|all done)[\s.!]*$/i;
  function ask(text) {
    text = text.replace(WAKE_PREFIX, "").trim();
    if (!text) { listen(true); return; } // just "Hey Silly Milly" again: keep listening
    // A new conversation after a long gap starts fresh.
    if (Date.now() - lastAskAt > 10 * 60000) history = [];
    lastAskAt = Date.now();
    $("milly-heard").textContent = "“" + text + "”";
    setOrb("thinking", "Thinking…");
    $("milly-reply").textContent = "";
    var lower = text.toLowerCase();
    // A couple of instant answers that don't need the internet
    if (DONE_RE.test(lower)) {
      var bye = /thank/.test(lower) ? "You're welcome!" : /bye|see you/.test(lower) ? "Bye bye!" : "Okay!";
      $("milly-reply").textContent = bye; setOrb("speaking", "Silly Milly");
      say(bye, closeMilly); return;
    }
    api("/api/ask", { method: "POST", body: { text: text, history: history.slice(-8), tz: activeTz() || deviceTz() } }).then(function (r) {
      history.push({ role: "user", text: text });
      history.push({ role: "assistant", text: r.reply });
      if (history.length > 12) history = history.slice(-12);
      $("milly-reply").textContent = r.reply;
      if (r.changed) { loadUpcoming(); if (currentView === "calendar") loadMonth(); }
      setOrb("speaking", "Silly Milly");
      say(r.reply, function () {
        if ($("milly-panel").classList.contains("hidden")) return;
        // Keep the conversation going: listen for a follow-up. Silence closes it.
        if (SR) { listen(true); return; }
        setOrb("", "Tap to ask again");
        closeTimer = setTimeout(closeMilly, 9000);
      });
    }).catch(function () {
      setOrb("", "Oops");
      $("milly-reply").textContent = "I couldn't reach the internet. Try again in a moment.";
      say("I couldn't reach the internet. Try again in a moment.");
      closeTimer = setTimeout(closeMilly, 8000);
    });
  }

  // ---------- "Hey Silly Milly" wake word ----------
  // Two engines:
  //  "local":  (default) listens on the tablet itself with small open speech models, matching the
  //            family's own recorded "Hey Silly Milly" samples. One continuous mic stream, so no
  //            Android beeps, and nothing is sent anywhere while waiting. See public/wake/.
  //  "chrome": Chrome's speech-to-text listening all the time. Opt-in; Android beeps on each restart.
  // Only one thing can use the microphone at a time, so the wake word pauses while Milly listens.
  var wakeEngine = null, wakeActive = false, wakeError = "";
  var wakeTemplates = [];
  function wantedEngine() {
    var m = settings.wakeMode || "";
    if (m === "off") return null;
    if (m === "chrome") return SR ? "chrome" : null;
    return window.MillyWake && MillyWake.supported ? "local" : null;
  }
  function wakeThreshold() { var s = settings.wakeSens || 5; return 0.05 + 0.007 * s; }
  function startWake() {
    stopWake();
    var eng = wantedEngine();
    if (!eng) {
      var m = settings.wakeMode || "";
      wakeError = m === "off" ? "" : m === "chrome" ? "this browser can't listen. Use Chrome." : "this browser can't run the on-tablet listener. Update Chrome.";
      updateWakeBadge(); return Promise.resolve();
    }
    wakeEngine = eng; wakeError = "";
    if (eng === "chrome") return resumeWake();
    return api("/api/settings?templates=1").then(function (r) {
      wakeTemplates = r.wakeTemplates || [];
      MillyWake.on("wake", function () { if (!millyBusy && wakeEngine === "local") openMilly(true); });
      MillyWake.on("level", onWakeLevel);
      MillyWake.on("error", function (m) { wakeError = m; updateWakeBadge(); });
      return MillyWake.setTemplates(wakeTemplates).then(function () { return MillyWake.setThreshold(wakeThreshold()); });
    }).then(function () { return resumeWake(); })
      .catch(function (err) { wakeError = String(err && err.message || err); updateWakeBadge(); });
  }
  function stopWake() {
    if (wakeEngine === "chrome") chromeWakeStop();
    if (wakeEngine === "local") MillyWake.stop();
    wakeEngine = null; wakeActive = false; updateWakeBadge();
  }
  function pauseWake() {
    if (wakeEngine === "chrome") return chromeWakeStop();
    if (wakeEngine === "local") { wakeActive = false; updateWakeBadge(); return MillyWake.stop(); }
    return Promise.resolve();
  }
  function localCanListen() {
    return wakeEngine === "local" && !millyBusy && !enrollingNow && wakeTemplates.length && document.visibilityState === "visible" && !wakeQuietTime();
  }
  function resumeWake() {
    if (wakeEngine === "chrome") { chromeWakeStart(0); return Promise.resolve(); }
    if (wakeEngine !== "local") return Promise.resolve();
    if (!localCanListen()) { wakeActive = false; updateWakeBadge(); return Promise.resolve(); }
    return MillyWake.start().then(function () {
      if (!localCanListen()) return MillyWake.stop(); // something changed while the mic was opening
      wakeActive = true; wakeError = ""; updateWakeBadge();
    }).catch(function (err) {
      var m = String(err && (err.name || err.message) || err);
      wakeError = /NotAllowed|Permission/i.test(m) ? "the microphone is blocked. In Chrome, open Site settings and set Microphone to Allow, then reload." : /NotFound/i.test(m) ? "no microphone found." : /NotReadable/i.test(m) ? "the microphone is busy in another app." : m;
      wakeActive = false; updateWakeBadge();
    });
  }
  function wakeQuietTime() {
    return between(hm(now()), CONFIG.nightDim.from, CONFIG.nightDim.to);
  }
  function updateWakeBadge() {
    // Green dot = the quiet on-tablet listener is on. (With Chrome listening, Android shows its own mic light.)
    $("milly-btn").classList.toggle("wake-on", wakeActive && wakeEngine === "local");
    var s = $("wake-status");
    if (!s) return;
    var how = wakeEngine === "local" ? " (on the tablet, quiet)" : " (Chrome speech)";
    if (wakeActive) s.textContent = "✅ Listening for \"Hey Silly Milly\"" + how + ".";
    else if (wakeEngine === "local" && !wakeTemplates.length && !wakeError) s.textContent = "👉 Almost ready: record your voices below so Milly knows what \"Hey Silly Milly\" sounds like.";
    else if (wakeEngine && wakeQuietTime() && !wakeError) s.textContent = "😴 Sleeping for the night (" + to12(CONFIG.nightDim.from) + " to " + to12(CONFIG.nightDim.to) + "). Tap Milly to talk.";
    else if (wakeEngine && !wakeError) s.textContent = "Paused while Milly is talking.";
    else if (!wakeEngine && settings.wakeMode === "off") s.textContent = "Hands-free is off. Tap the Milly button to talk.";
    else s.textContent = "Wake word off: " + (wakeError || "not set up.");
  }

  // --- Chrome built-in listening ---
  var cw = { rec: null, timer: null, want: false, delay: 0, quickEnds: 0, startedAt: 0, stopping: null };
  // Phrases Chrome tends to hear for "Hey Silly Milly".
  // Tight match: "silly milly" (optionally "hey"/"hi"/"okay" first). Nothing else wakes her.
  var WAKE_RE = /\b(?:(?:hey|hi|okay|ok)\s+)?(?:silly|silli|sili)\s*(?:milly|millie|milli|mili)\b/;
  function normalize(t) { return " " + String(t).toLowerCase().replace(/[^a-z' ]+/g, " ").replace(/\s+/g, " ").trim() + " "; }
  function findWake(t) {
    var n = normalize(t), m = WAKE_RE.exec(n);
    if (!m) return null;
    return { rest: n.slice(m.index + m[0].length).trim() };
  }
  window.__millyFindWake = findWake; // for testing
  function chromeWakeStart(delay) {
    cw.want = true;
    clearTimeout(cw.timer);
    cw.timer = setTimeout(chromeWakeRun, delay || 0);
  }
  function chromeWakeStop() {
    cw.want = false;
    clearTimeout(cw.timer);
    wakeActive = false; updateWakeBadge();
    if (!cw.rec) return Promise.resolve();
    if (cw.stopping) return cw.stopping;
    var r = cw.rec;
    cw.stopping = new Promise(function (res) {
      var t = setTimeout(res, 600);
      r.addEventListener("end", function () { clearTimeout(t); res(); });
      try { r.abort(); } catch (e) { clearTimeout(t); res(); }
    }).then(function () { cw.rec = null; cw.stopping = null; });
    return cw.stopping;
  }
  function chromeWakeRun() {
    if (!cw.want || cw.rec || millyBusy || wakeEngine !== "chrome") return;
    if (document.visibilityState !== "visible" || wakeQuietTime()) { wakeActive = false; updateWakeBadge(); return; }
    var r = new SR();
    cw.rec = r;
    r.lang = "en-CA"; r.continuous = true; r.interimResults = true; r.maxAlternatives = 3;
    var fired = false;
    function fire(rest) {
      if (fired) return; fired = true;
      cw.want = false;
      try { r.abort(); } catch (e) {}
      if (millyBusy) return;
      if (rest && rest.split(" ").length >= 2) openMillyWith(rest);
      else openMilly(true);
    }
    r.onresult = function (ev) {
      if (fired) return;
      for (var i = ev.resultIndex; i < ev.results.length; i++) {
        var res = ev.results[i];
        if (!res.isFinal) continue; // only act on what Chrome is sure it heard
        for (var a = 0; a < res.length; a++) {
          var hit = findWake(res[a].transcript);
          if (hit) { fire(hit.rest); return; }
        }
      }
    };
    r.onerror = function (ev) {
      var e = ev && ev.error;
      if (e === "not-allowed" || e === "service-not-allowed") {
        cw.want = false; wakeError = "the microphone is blocked. In Chrome, tap the lock icon (or Site settings) and set Microphone to Allow, then reload.";
      } else if (e === "network") { cw.delay = Math.min((cw.delay || 2000) * 2, 60000); wakeError = ""; }
      else if (e === "audio-capture") { cw.delay = 5000; }
    };
    r.onstart = function () { cw.startedAt = Date.now(); if (!wakeActive) { wakeActive = true; wakeError = ""; updateWakeBadge(); } };
    r.onend = function () {
      if (cw.rec === r) cw.rec = null;
      if (!cw.want || millyBusy) { wakeActive = false; updateWakeBadge(); return; }
      // Chrome stops listening every so often; start again. Back off if it keeps ending instantly.
      var ran = Date.now() - (cw.startedAt || Date.now());
      cw.quickEnds = ran < 1500 ? cw.quickEnds + 1 : 0;
      // Each restart can beep on Android, so don't restart in a tight loop.
      var wait = cw.delay || (cw.quickEnds > 2 ? Math.min(2000 * cw.quickEnds, 20000) : 1000);
      if (ran > 10000) cw.delay = 0;
      chromeWakeStart(wait);
    };
    try { r.start(); } catch (e) { cw.rec = null; chromeWakeStart(2000); }
  }
  // Sleep the built-in listening overnight (fewer beeps, less battery), wake it in the morning.
  function wakeMinute() {
    if (millyBusy || enrollingNow) return;
    if (wakeEngine === "chrome") {
      if (wakeQuietTime()) { if (cw.rec) chromeWakeStop(); updateWakeBadge(); }
      else if (!cw.rec && document.visibilityState === "visible") chromeWakeStart(0);
    } else if (wakeEngine === "local") {
      if (wakeQuietTime()) { if (MillyWake.running()) pauseWake(); else updateWakeBadge(); }
      else if (!MillyWake.running()) resumeWake();
    }
  }
  // "Hey Silly Milly, what's the weather tomorrow?" in one breath: answer straight away.
  function openMillyWith(text) {
    lastTouch = Date.now();
    $("dimmer").classList.add("hidden");
    $("milly-panel").classList.remove("hidden");
    $("milly-heard").textContent = ""; $("milly-reply").textContent = "";
    millyBusy = true;
    pauseWake().then(function () { wakeSound(); ask(text); });
  }
  document.addEventListener("visibilitychange", function () {
    if (wakeEngine === "chrome") {
      if (document.visibilityState === "visible") { if (!millyBusy) chromeWakeStart(500); }
      else chromeWakeStop();
    } else if (wakeEngine === "local") {
      if (document.visibilityState === "visible") { if (!millyBusy) resumeWake(); }
      else pauseWake();
    }
  });

  // --- Teaching Milly the family's voices (Settings) ---
  var enrollingNow = false;
  function onWakeLevel(d) {
    if (currentView !== "settings") return;
    var bar = $("wake-meter-bar"), txt = $("wake-meter-text");
    if (!bar) return;
    var thr = wakeThreshold(), sc = d.score;
    var pct = sc == null ? 0 : Math.max(0, Math.min(1, (0.25 - sc) / (0.25 - thr)));
    bar.style.width = Math.round(pct * 100) + "%";
    bar.className = pct >= 1 ? "hit" : pct > 0.7 ? "near" : "";
    txt.textContent = (d.listening ? "Hearing sound. " : "Quiet room. ") + "Match: " + Math.round(pct * 100) + "% (100% wakes Milly). Uses about " + Math.round(d.ms) + " ms of every 80 ms of audio.";
  }
  function renderWakeVoices() {
    var box = $("wake-voices"); box.innerHTML = "";
    var by = {};
    wakeTemplates.forEach(function (t) { by[t.who] = (by[t.who] || 0) + 1; });
    var names = Object.keys(by);
    if (!names.length) { box.appendChild(el("div", "muted", "No voices recorded yet.")); return; }
    names.forEach(function (n) {
      var row = el("div", "wake-voice");
      row.appendChild(el("span", null, "🗣️ " + n + " · " + by[n] + " recording" + (by[n] === 1 ? "" : "s")));
      var del = el("button", "ghost-btn", "Delete");
      del.onclick = function () {
        wakeTemplates = wakeTemplates.filter(function (t) { return t.who !== n; });
        saveTemplates().then(renderWakeVoices);
      };
      row.appendChild(del); box.appendChild(row);
    });
  }
  function saveTemplates() {
    return api("/api/settings", { method: "POST", body: { wakeTemplates: wakeTemplates } }).then(function () {
      if (window.MillyWake) return MillyWake.setTemplates(wakeTemplates);
    }).then(function () { updateWakeBadge(); if (wakeEngine === "local" && !MillyWake.running()) resumeWake(); });
  }
  function recordVoice() {
    if (enrollingNow) return;
    if (!window.MillyWake || !MillyWake.supported) { $("wake-rec-status").textContent = "This browser can't record for the wake word. Use Chrome."; return; }
    var who = ($("wake-who").value || "").trim().slice(0, 30) || "Family";
    var st = $("wake-rec-status"), btn = $("wake-record");
    enrollingNow = true; btn.disabled = true;
    var got = [], tries = 0;
    function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    function take() {
      if (got.length >= 3 || tries >= 6) return Promise.resolve();
      tries++;
      st.className = "wake-rec-status";
      st.textContent = "Get ready… (" + (got.length + 1) + " of 3)";
      return wait(900).then(function () {
        tone(880, 0, 0.12, 0.15);
        return wait(250);
      }).then(function () {
        st.className = "wake-rec-status rec";
        st.textContent = "🔴 Say “Hey Silly Milly” now (" + (got.length + 1) + " of 3)";
        return MillyWake.enrollOnce(2400);
      }).then(function (r) {
        st.className = "wake-rec-status";
        if (r.ok) { got.push({ who: who, frames: r.frames }); st.textContent = "👍 Got it."; }
        else st.textContent = "🤔 " + r.reason;
        return wait(900).then(take);
      });
    }
    pauseWake().then(function () { return MillyWake.start(); }).then(take).then(function () {
      if (got.length) {
        wakeTemplates = wakeTemplates.concat(got);
        return saveTemplates().then(function () {
          st.textContent = got.length >= 3 ? "✅ Saved " + who + "'s voice. Try it: say “Hey Silly Milly”." : "Saved " + got.length + " of 3. You can record again to add more.";
          renderWakeVoices();
        });
      }
      st.textContent = "Nothing saved. Try again a bit closer to the tablet.";
    }).catch(function (err) {
      var m = String(err && (err.name || err.message) || err);
      st.textContent = /NotAllowed|Permission/i.test(m) ? "The microphone is blocked. In Chrome, open Site settings and set Microphone to Allow." : "Couldn't record: " + m;
    }).then(function () {
      enrollingNow = false; btn.disabled = false;
      return MillyWake.stop();
    }).then(function () { if (wakeEngine) resumeWake(); });
  }

  // ---------- settings ----------
  function loadSettings() {
    return api("/api/settings").then(function (s) { settings = s; }).catch(function () {});
  }
  function renderSettings() {
    $("set-wake-mode").value = settings.wakeMode === "chrome" || settings.wakeMode === "off" ? settings.wakeMode : "";
    $("set-sens").value = settings.wakeSens || 5;
    $("set-sens-val").textContent = "(" + (settings.wakeSens || 5) + " of 10)";
    renderWakeVoices();
    loadVoices();
    var sel = $("set-voice"); sel.innerHTML = "";
    var auto = el("option", null, "Automatic"); auto.value = ""; sel.appendChild(auto);
    voices.filter(function (v) { return /^en/i.test(v.lang); }).forEach(function (v) {
      var o = el("option", null, v.name + " (" + v.lang + ")"); o.value = v.name; if (v.name === settings.voiceName) o.selected = true; sel.appendChild(o);
    });
    $("set-tz").value = settings.timeZone || "";
    var wd = morningTimes(addDays(now(), (8 - now().getDay()) % 7 || 7)), mt = settings.morningTimes || {};
    $("set-mt-start").value = wd.start; $("set-mt-remind").value = wd.remind; $("set-mt-leave").value = wd.leave;
    $("set-mt-weekend").value = validTime(mt.weekendStart) ? mt.weekendStart : CONFIG.morning.weekend.start;
    $("set-mt-msg").textContent = "";
    renderStarAdmin();
    $("set-tz-now").textContent = "The app's clock says " + to12(hm(now())) + ". The tablet's own time zone is " + (deviceTz() || "unknown") + ".";
    $("set-status").innerHTML = "";
    [
      ["Speech-to-text in this browser", SR ? "✅ yes" : "❌ no (use Chrome)"],
      ["Talking voice", window.speechSynthesis ? "✅ yes" : "❌ no"],
      ["Claude key on the server", settings.assistantReady ? "✅ added" : "❌ missing (add ANTHROPIC_API_KEY in Vercel)"],
      ["Screen kept awake", wakeLock ? "✅ yes" : "⚠️ no (set screen timeout in Android settings)"]
    ].forEach(function (r) { $("set-status").appendChild(el("div", null, r[0] + ": " + r[1])); });
    updateWakeBadge();
  }
  // Parents' star fixes: auto → give the star → day off → auto
  var OVERRIDE_NEXT = { "": "star", star: "off", off: "" };
  function renderStarAdmin() {
    var box = $("star-admin"); if (!box) return;
    box.innerHTML = "";
    var today = ymd(now());
    CONFIG.kids.forEach(function (kid) {
      var row = el("div", "star-admin-row");
      row.appendChild(el("div", "star-admin-name", kid.name));
      weekDates().forEach(function (d) {
        var key = ymd(d), ov = overrideFor(key, kid), r = dayResult(kid, d);
        var b = el("button", "star-admin-day" + (ov ? " set" : ""));
        b.appendChild(el("span", "star-ico", STAR_ICON[r]));
        b.appendChild(el("span", "star-lbl", DAYS[d.getDay()] + (ov === "star" ? " · given" : ov === "off" ? " · day off" : "")));
        b.onclick = function () {
          var next = OVERRIDE_NEXT[ov] || "";
          if (key > today && next === "star") next = "off"; // future days: only "day off"
          b.disabled = true;
          api("/api/settings", { method: "POST", body: { starOverride: { date: key, kid: kid.id, value: next } } })
            .then(loadSettings).then(function () { renderStarAdmin(); renderBedtime(); })
            .catch(function (e) { b.disabled = false; $("set-mt-msg").textContent = "Couldn't save the star: " + e.message; });
        };
        row.appendChild(b);
      });
      var w = weekSummary(kid);
      row.appendChild(el("div", "star-admin-sum", w.won ? "🎁 won" : w.stars + " / " + CONFIG.challenge.need));
      box.appendChild(row);
    });
  }
  function saveSettings() {
    var mt = { start: $("set-mt-start").value, remind: $("set-mt-remind").value, leave: $("set-mt-leave").value, weekendStart: $("set-mt-weekend").value };
    if (!(validTime(mt.start) && validTime(mt.remind) && validTime(mt.leave) && validTime(mt.weekendStart)) || !(mt.start < mt.remind && mt.remind < mt.leave)) {
      $("set-mt-msg").textContent = "Morning times need to go in order: get ready, then reminder, then leave the house.";
      return;
    }
    var body = {
      morningTimes: mt,
      wakeSens: parseInt($("set-sens").value, 10),
      voiceName: $("set-voice").value,
      timeZone: $("set-tz").value,
      wakeMode: $("set-wake-mode").value
    };
    api("/api/settings", { method: "POST", body: body }).then(function () {
      return loadSettings();
    }).then(function () {
      renderSettings();
      lastMinute = ""; tick(); loadUpcoming(); renderBedtime();
      $("set-status").appendChild(el("div", null, "Saved. Starting the wake word…"));
      startWake();
    }).catch(function (e) { $("set-status").appendChild(el("div", null, "Couldn't save: " + e.message)); });
  }

  // ---------- keep the screen on ----------
  var wakeLock = null;
  function keepAwake() {
    if (!("wakeLock" in navigator)) return;
    navigator.wakeLock.request("screen").then(function (l) {
      wakeLock = l; l.addEventListener("release", function () { wakeLock = null; });
    }).catch(function () {});
  }
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") { keepAwake(); loadToday(); loadUpcoming(); }
  });

  // ---------- wire up ----------
  function init() {
    var navs = document.querySelectorAll(".nav-btn");
    for (var i = 0; i < navs.length; i++) {
      (function (b) { b.onclick = function () { showView(b.getAttribute("data-view")); }; })(navs[i]);
    }
    var tiles = document.querySelectorAll("[data-go]");
    for (var ti = 0; ti < tiles.length; ti++) {
      (function (b) { b.onclick = function () { showView(b.getAttribute("data-go")); }; })(tiles[ti]);
    }
    var ntabs = document.querySelectorAll(".news-tab");
    for (var ni = 0; ni < ntabs.length; ni++) {
      (function (b) { b.onclick = function () { newsTab = b.getAttribute("data-news"); renderNews(); }; })(ntabs[ni]);
    }
    $("bed-history-btn").onclick = function () { historyRoutine = "bedtime"; showView("history"); };
    $("morning-history-btn").onclick = function () { historyRoutine = "morning"; showView("history"); };
    $("history-back").onclick = function () { showView(historyRoutine); };
    $("cal-prev").onclick = function () { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1); loadMonth(); };
    $("cal-next").onclick = function () { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1); loadMonth(); };
    $("cal-today").onclick = function () { calMonth = now(); calMonth.setDate(1); selectedDay = ymd(now()); loadMonth(); };
    $("add-event-btn").onclick = function () { eventForm(null); };
    $("modal").onclick = function (e) { if (e.target === $("modal") && !pinWaiters) closeModal(); };
    $("milly-btn").onclick = function () { openMilly(false); };
    $("milly-again").onclick = function () { try { speechSynthesis.cancel(); } catch (e) {} $("milly-reply").textContent = ""; listen(); };
    $("milly-close").onclick = closeMilly;
    $("milly-typed").onsubmit = function (e) { e.preventDefault(); var v = $("milly-input").value.trim(); if (v) { $("milly-input").value = ""; ask(v); } };
    $("set-save").onclick = saveSettings;
    $("set-reload").onclick = function () { location.reload(); };
    $("set-forget").onclick = function () { storeDel("familyPin"); pin = ""; location.reload(); };
    $("set-test-voice").onclick = function () { settings.voiceName = $("set-voice").value; say("Hi! I'm Silly Milly. Ask me anything!"); };
    $("set-sens").oninput = function () {
      $("set-sens-val").textContent = "(" + this.value + " of 10)";
      settings.wakeSens = parseInt(this.value, 10);
      if (window.MillyWake) MillyWake.setThreshold(wakeThreshold());
    };
    $("wake-record").onclick = recordVoice;
    $("dimmer").onclick = function () { $("dimmer").classList.add("hidden"); dimmedByUser = true; lastTouch = Date.now(); };
    document.addEventListener("pointerdown", function () { lastTouch = Date.now(); }, true);
    if (window.speechSynthesis) speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();

    tick(); setInterval(tick, 1000);
    loadWeather();
    showView(defaultView());

    // The first tap unlocks audio, the mic and fullscreen (browsers require a tap for these).
    $("start").onclick = function () {
      $("start").classList.add("hidden");
      var c = ctx(); if (c && c.resume) c.resume();
      try { var u = new SpeechSynthesisUtterance(" "); u.volume = 0; speechSynthesis.speak(u); } catch (e) {}
      keepAwake();
      var de = document.documentElement;
      if (de.requestFullscreen && !document.fullscreenElement) de.requestFullscreen().catch(function () {});
      loadSettings().then(function () {
        showView(defaultView()); // morning times may come from ⚙️ Settings
        loadToday(); loadUpcoming();
        startWake();
      });
    };
  }
  init();
})();
