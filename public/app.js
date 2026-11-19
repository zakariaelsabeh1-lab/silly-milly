/* Family Board + Silly Milly
 * Plain JavaScript (no build step) so it runs on older Android tablets.
 * Change the CONFIG block below to adjust names, times and tasks.
 */
(function () {
  "use strict";

  var CONFIG = {
    place: "Prince George",
    lat: 53.9171,
    lon: -122.7497,
    tz: "America/Vancouver",
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
        { id: "ready", label: "Ready for tomorrow", icon: "🎒" }
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
      btns[j].classList.toggle("active", v === name || (name === "history" && v === "bedtime"));
    }
    if (name === "bedtime") renderBedtime();
    if (name === "calendar") loadMonth();
    if (name === "history") loadHistory();
    if (name === "settings") renderSettings();
  }
  function defaultView() {
    var t = hm(new Date());
    return between(t, CONFIG.bedtime.start, CONFIG.bedtime.showUntil) ? "bedtime" : "home";
  }

  // ---------- clock ----------
  var lastMinute = "";
  function tick() {
    var d = new Date();
    var h = d.getHours() % 12 || 12;
    $("clock").innerHTML = h + ":" + pad(d.getMinutes()) + "<small>" + (d.getHours() >= 12 ? "PM" : "AM") + "</small>";
    $("date").textContent = DAYS_LONG[d.getDay()] + ", " + MONTHS[d.getMonth()] + " " + d.getDate();
    $("dim-clock").textContent = h + ":" + pad(d.getMinutes());
    var m = hm(d);
    if (m !== lastMinute) { lastMinute = m; everyMinute(d, m); }
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
      say("Fifteen minutes until bed! " + whatsLeftSentence());
    } else if (m === bt.bed) {
      showView("bedtime"); chime();
      say("It's eight o'clock. Into bed for stories! Good night " + kidNames() + ".");
    }
    updateBedStatus();
    // New day: refresh
    if (m === "00:01") { loadWeather(); loadUpcoming(); renderBedtime(); }
    // Night dimming
    var night = between(m, CONFIG.nightDim.from, CONFIG.nightDim.to);
    if (!night) dimmedByUser = false;
    if (night && !dimmedByUser && Date.now() - lastTouch > 5 * 60000 && !millyBusy) $("dimmer").classList.remove("hidden");
    if (!night) $("dimmer").classList.add("hidden");
    // Go back to the main screen when nobody's touched it
    if (Date.now() - lastTouch > CONFIG.idleMinutes * 60000 && !millyBusy && $("modal").classList.contains("hidden")) {
      var dv = defaultView();
      if (currentView !== dv) showView(dv);
    }
    if (d.getMinutes() % 30 === 0) loadWeather();
    if (d.getMinutes() % 5 === 0) { loadUpcoming(); if (currentView === "bedtime") loadToday(); }
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
      "&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m" +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_probability_max,snowfall_sum,uv_index_max";
    var aUrl = "https://air-quality-api.open-meteo.com/v1/air-quality?" + base + "&forecast_days=7&current=us_aqi&hourly=us_aqi";
    Promise.all([
      fetch(fUrl).then(function (r) { return r.json(); }),
      fetch(aUrl).then(function (r) { return r.json(); }).catch(function () { return null; })
    ]).then(function (res) { renderWeather(res[0], res[1]); })
      .catch(function () { $("now-desc").textContent = "Weather unavailable"; });
  }
  function renderWeather(f, a) {
    if (!f || !f.current) return;
    var c = f.current, w = wmo(c.weather_code);
    $("now-icon").textContent = w[0];
    $("now-temp").textContent = Math.round(c.temperature_2m) + "°C";
    $("now-desc").textContent = w[1] + " in " + CONFIG.place;
    $("now-feels").textContent = "Feels like " + Math.round(c.apparent_temperature) + "° · Wind " + Math.round(c.wind_speed_10m) + " km/h";

    var dayAqi = {};
    if (a && a.hourly) {
      for (var i = 0; i < a.hourly.time.length; i++) {
        var dd = a.hourly.time[i].slice(0, 10), v = a.hourly.us_aqi[i];
        if (v != null) dayAqi[dd] = Math.max(dayAqi[dd] || 0, v);
      }
    }
    var nowAqi = a && a.current ? a.current.us_aqi : null;
    var chip = aqiChip(nowAqi, false);
    var old = $("now-aqi"); chip.id = "now-aqi"; old.parentNode.replaceChild(chip, old);

    var week = $("week"); week.innerHTML = "";
    var d = f.daily;
    for (var k = 0; k < d.time.length && k < 8; k++) {
      var date = parseYmd(d.time[k]);
      var card = el("div", "day-card" + (k === 0 ? " today" : ""));
      card.appendChild(el("div", "day-name", k === 0 ? "Today" : DAYS[date.getDay()]));
      card.appendChild(el("div", "day-icon", wmo(d.weather_code[k])[0]));
      var t = el("div", "day-temps");
      t.innerHTML = "<b>" + Math.round(d.temperature_2m_max[k]) + "°</b> " + Math.round(d.temperature_2m_min[k]) + "°";
      card.appendChild(t);
      var pop = d.precipitation_probability_max[k];
      card.appendChild(el("div", "day-pop", pop != null && pop >= 20 ? "💧" + pop + "%" : ""));
      card.appendChild(aqiChip(dayAqi[d.time[k]], true));
      week.appendChild(card);
    }
    $("wear").textContent = wearTip({
      feelsMin: d.apparent_temperature_min[0], feelsMax: d.apparent_temperature_max[0],
      pop: d.precipitation_probability_max[0] || 0, snow: d.snowfall_sum[0] || 0, uv: d.uv_index_max[0] || 0
    }, nowAqi, dayAqi[d.time[0]]);
  }

  // ---------- upcoming events (home) ----------
  function eventColor(who) {
    for (var i = 0; i < CONFIG.kids.length; i++) if (CONFIG.kids[i].name === who) return CONFIG.kids[i].color;
    return who === "Parents" ? "#b18cff" : "#ffd166";
  }
  function whenText(e) {
    var today = parseYmd(ymd(new Date()));
    var day = parseYmd(e.occurrence);
    var diff = Math.round((day - today) / 86400000);
    var label = diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : DAYS_LONG[day.getDay()] + ", " + MONTHS[day.getMonth()].slice(0, 3) + " " + day.getDate();
    return { label: label + (e.start ? " · " + to12(e.start) : ""), diff: diff };
  }
  function loadUpcoming() {
    var s = new Date();
    api("/api/events?start=" + ymd(s) + "&end=" + ymd(addDays(s, 45))).then(function (r) {
      var list = $("upcoming-list"); list.innerHTML = "";
      var nowT = hm(new Date()), todayS = ymd(new Date());
      var seen = {};
      var items = r.events.filter(function (e) {
        if (e.occurrence === todayS && e.start && (e.end || e.start) < nowT) return false; // already over today
        if (seen[e.id]) return false; // show a repeating event only once (its next time)
        seen[e.id] = true;
        return true;
      }).slice(0, 6);
      if (!items.length) { list.appendChild(el("div", "muted", "Nothing coming up. Say \"Hey Silly Milly, add swimming on Saturday at 10\".")); return; }
      items.forEach(function (e) {
        var w = whenText(e);
        var it = el("div", "up-item");
        it.style.borderLeftColor = eventColor(e.who);
        it.appendChild(el("div", "up-when", w.label + (e.who && e.who !== "Everyone" ? " · " + e.who : "")));
        it.appendChild(el("div", "up-title", e.title));
        if (w.diff >= 2) it.appendChild(el("div", "up-count", w.diff + " sleeps to go"));
        list.appendChild(it);
      });
    }).catch(function () {});
  }

  // ---------- bedtime ----------
  var today = {}; // { noah: {toilet:"19:32"}, didi: {...} }
  var celebrated = {};
  function tasksFor(kid) {
    return CONFIG.bedtime.tasks.filter(function (t) { return !t.only || t.only.indexOf(kid.id) >= 0; });
  }
  function kidNames() { return CONFIG.kids.map(function (k) { return k.name; }).join(" and "); }
  function leftFor(kid) {
    var done = today[kid.id] || {};
    return tasksFor(kid).filter(function (t) { return !done[t.id]; });
  }
  function whatsLeftSentence() {
    var parts = [];
    CONFIG.kids.forEach(function (k) {
      var left = leftFor(k);
      if (!left.length) parts.push(k.name + " is all done, great job!");
      else parts.push(k.name + " still needs: " + left.map(function (t) { return t.label.toLowerCase(); }).join(", ") + ".");
    });
    return parts.join(" ");
  }
  function loadToday() {
    var key = ymd(new Date());
    return api("/api/bedtime?days=1").then(function (r) {
      today = (r.days && r.days[key]) || {};
      CONFIG.kids.forEach(function (k) { if (!leftFor(k).length) celebrated[key + k.id] = true; });
      renderBedtime();
    }).catch(function () {});
  }
  function renderBedtime() {
    var wrap = $("bed-columns"); wrap.innerHTML = "";
    CONFIG.kids.forEach(function (kid) {
      var col = el("div", "kid-col");
      col.style.setProperty("--kid", kid.color);
      var tasks = tasksFor(kid), done = today[kid.id] || {};
      var count = tasks.filter(function (t) { return done[t.id]; }).length;
      if (count === tasks.length) col.classList.add("all-done");
      var head = el("div", "kid-head");
      head.appendChild(el("div", "kid-name", kid.name));
      head.appendChild(el("div", "kid-count", count === tasks.length ? "All done! ⭐" : count + " / " + tasks.length));
      col.appendChild(head);
      tasks.forEach(function (t) {
        var b = el("button", "task" + (done[t.id] ? " done" : ""));
        b.appendChild(el("span", "task-icon", t.icon));
        b.appendChild(el("span", "task-label", t.label));
        b.appendChild(el("span", "task-check", "✓"));
        b.onclick = function () { toggleTask(kid, t); };
        col.appendChild(b);
      });
      wrap.appendChild(col);
    });
    updateBedStatus();
  }
  function updateBedStatus() {
    var t = hm(new Date()), bt = CONFIG.bedtime, s;
    if (t < bt.start && t >= "12:00") s = "Bedtime routine starts at " + to12(bt.start);
    else if (t >= bt.start && t < bt.remind) s = "Getting ready for bed";
    else if (t >= bt.remind && t < bt.bed) s = "Almost bedtime! " + (Math.max(0, minutesUntil(bt.bed))) + " minutes left";
    else if (t >= bt.bed && t < "23:59") s = "In bed for stories 📚";
    else s = "Good morning!";
    $("bed-status").textContent = s;
    var pills = document.querySelectorAll(".time-pill");
    var idx = t >= bt.bed ? 2 : t >= bt.remind ? 1 : t >= bt.start ? 0 : -1;
    for (var i = 0; i < pills.length; i++) pills[i].classList.toggle("now", i === idx);
  }
  function minutesUntil(t) {
    var n = new Date(), p = t.split(":");
    return (+p[0] * 60 + +p[1]) - (n.getHours() * 60 + n.getMinutes());
  }
  function toggleTask(kid, t) {
    var key = ymd(new Date());
    var done = today[kid.id] = today[kid.id] || {};
    var on = !done[t.id];
    if (on) done[t.id] = hm(new Date()); else delete done[t.id];
    renderBedtime();
    if (on) blip();
    api("/api/bedtime", { method: "POST", body: { date: key, kid: kid.id, task: t.id, done: on, time: hm(new Date()) } })
      .catch(function () { /* will resync on next load */ });
    if (on && !leftFor(kid).length && !celebrated[key + kid.id]) {
      celebrated[key + kid.id] = true;
      celebrate(kid.name + " is ready for bed! 🎉", kid.name + " is all done! Amazing job, " + kid.name + "!");
    }
  }
  function loadHistory() {
    api("/api/bedtime?days=14").then(function (r) {
      var box = $("history-table"); box.innerHTML = "";
      var table = el("table"), thead = el("tr");
      thead.appendChild(el("th", null, "Day"));
      var cols = [];
      CONFIG.kids.forEach(function (k) {
        tasksFor(k).forEach(function (t) { cols.push({ kid: k, task: t }); });
      });
      cols.forEach(function (c) {
        var th = el("th", c.task.id === "puffer" ? "puffer-col" : null, c.kid.name + " " + c.task.icon);
        th.title = c.task.label;
        thead.appendChild(th);
      });
      table.appendChild(thead);
      for (var i = 0; i < 14; i++) {
        var d = addDays(new Date(), -i), key = ymd(d), day = (r.days && r.days[key]) || {};
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
  var calMonth = new Date(); calMonth.setDate(1);
  var selectedDay = ymd(new Date());
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
    var todayS = ymd(new Date());
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
  var settings = { voiceName: "", picovoiceKey: "", hasWakeWord: false, sensitivity: 0.6 };
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
  function listen() {
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
      if (gotResult && finalText.trim()) ask(finalText.trim());
      else if ($("milly-panel").classList.contains("hidden") === false && !$("milly-reply").textContent) {
        setOrb("", "I didn't hear anything");
        closeTimer = setTimeout(closeMilly, 6000);
      } else {
        setOrb("", "Tap to ask again");
        closeTimer = setTimeout(closeMilly, 8000);
      }
    };
    setOrb("listening", "Listening…");
    try { r.start(); } catch (e) { setOrb("", "Microphone busy, try again"); }
  }
  function ask(text) {
    $("milly-heard").textContent = "“" + text + "”";
    setOrb("thinking", "Thinking…");
    $("milly-reply").textContent = "";
    var lower = text.toLowerCase();
    // A couple of instant answers that don't need the internet
    if (/^(stop|never ?mind|cancel|go away|bye|goodbye)\b/.test(lower)) { say("Okay!"); closeMilly(); return; }
    api("/api/ask", { method: "POST", body: { text: text, history: history.slice(-8) } }).then(function (r) {
      history.push({ role: "user", text: text });
      history.push({ role: "assistant", text: r.reply });
      if (history.length > 12) history = history.slice(-12);
      $("milly-reply").textContent = r.reply;
      if (r.changed) { loadUpcoming(); if (currentView === "calendar") loadMonth(); }
      setOrb("speaking", "Silly Milly");
      say(r.reply, function () {
        if ($("milly-panel").classList.contains("hidden")) return;
        if (/\?\s*$/.test(r.reply) && SR) { listen(); return; } // she asked something: listen for the answer
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

  // ---------- "Hey Silly Milly" wake word (Picovoice Porcupine, optional) ----------
  var porcupine = null, wakeActive = false, wakeError = "";
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = function () { rej(new Error("Couldn't load " + src)); };
      document.head.appendChild(s);
    });
  }
  function startWake() {
    if (!settings.picovoiceKey || !settings.hasWakeWord) { wakeError = "Not set up (optional)."; updateWakeBadge(); return Promise.resolve(); }
    var p = window.PorcupineWeb ? Promise.resolve() : loadScript("/vendor/web-voice-processor.js").then(function () { return loadScript("/vendor/porcupine-web.js"); });
    return p.then(function () { return api("/api/settings?wake=1"); }).then(function (s) {
      return PorcupineWeb.PorcupineWorker.create(
        settings.picovoiceKey,
        [{ label: "Hey Silly Milly", base64: s.wakeWordBase64, sensitivity: settings.sensitivity || 0.6 }],
        function () { if (!millyBusy) openMilly(true); },
        { publicPath: "/wake/porcupine_params.pv", forceWrite: false, version: 4 },
        { processErrorCallback: function (err) { wakeError = String(err && err.message || err); updateWakeBadge(); } }
      );
    }).then(function (worker) {
      porcupine = worker;
      return resumeWake();
    }).catch(function (err) {
      wakeError = String(err && err.message || err);
      wakeActive = false; updateWakeBadge();
    });
  }
  function pauseWake() {
    if (!porcupine || !wakeActive) return Promise.resolve();
    wakeActive = false; updateWakeBadge();
    // Release the microphone so speech recognition can use it.
    return WebVoiceProcessor.WebVoiceProcessor.unsubscribe(porcupine).catch(function () {});
  }
  function resumeWake() {
    if (!porcupine || wakeActive) return Promise.resolve();
    return WebVoiceProcessor.WebVoiceProcessor.subscribe(porcupine).then(function () {
      wakeActive = true; wakeError = ""; updateWakeBadge();
    }).catch(function (err) { wakeError = String(err && err.message || err); updateWakeBadge(); });
  }
  function updateWakeBadge() {
    $("milly-btn").classList.toggle("wake-on", wakeActive);
    var s = $("wake-status");
    if (s) s.textContent = wakeActive ? "✅ Listening for \"Hey Silly Milly\"." : porcupine ? "Paused." : "Wake word off: " + (wakeError || "not set up.");
  }

  // ---------- settings ----------
  function loadSettings() {
    return api("/api/settings").then(function (s) { settings = s; }).catch(function () {});
  }
  var pendingPpn = null;
  function renderSettings() {
    $("set-pv-key").value = settings.picovoiceKey || "";
    $("set-sens").value = settings.sensitivity || 0.6;
    $("set-sens-val").textContent = "(" + (settings.sensitivity || 0.6) + ")";
    $("set-ppn-status").textContent = settings.hasWakeWord ? "A wake word file is saved." : "No wake word file yet.";
    loadVoices();
    var sel = $("set-voice"); sel.innerHTML = "";
    var auto = el("option", null, "Automatic"); auto.value = ""; sel.appendChild(auto);
    voices.filter(function (v) { return /^en/i.test(v.lang); }).forEach(function (v) {
      var o = el("option", null, v.name + " (" + v.lang + ")"); o.value = v.name; if (v.name === settings.voiceName) o.selected = true; sel.appendChild(o);
    });
    $("set-status").innerHTML = "";
    [
      ["Speech-to-text in this browser", SR ? "✅ yes" : "❌ no (use Chrome)"],
      ["Talking voice", window.speechSynthesis ? "✅ yes" : "❌ no"],
      ["Claude key on the server", settings.assistantReady ? "✅ added" : "❌ missing (add ANTHROPIC_API_KEY in Vercel)"],
      ["Screen kept awake", wakeLock ? "✅ yes" : "⚠️ no (set screen timeout in Android settings)"]
    ].forEach(function (r) { $("set-status").appendChild(el("div", null, r[0] + ": " + r[1])); });
    updateWakeBadge();
  }
  function saveSettings() {
    var body = {
      picovoiceKey: $("set-pv-key").value.trim(),
      sensitivity: parseFloat($("set-sens").value),
      voiceName: $("set-voice").value
    };
    if (pendingPpn) body.wakeWordBase64 = pendingPpn;
    api("/api/settings", { method: "POST", body: body }).then(function () {
      pendingPpn = null;
      return loadSettings();
    }).then(function () {
      renderSettings();
      $("set-status").appendChild(el("div", null, "Saved. Starting the wake word…"));
      if (porcupine) { try { WebVoiceProcessor.WebVoiceProcessor.unsubscribe(porcupine); porcupine.terminate(); } catch (e) {} porcupine = null; wakeActive = false; }
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
    $("bed-history-btn").onclick = function () { showView("history"); };
    $("history-back").onclick = function () { showView("bedtime"); };
    $("cal-prev").onclick = function () { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1); loadMonth(); };
    $("cal-next").onclick = function () { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1); loadMonth(); };
    $("cal-today").onclick = function () { calMonth = new Date(); calMonth.setDate(1); selectedDay = ymd(new Date()); loadMonth(); };
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
    $("set-sens").oninput = function () { $("set-sens-val").textContent = "(" + this.value + ")"; };
    $("set-ppn").onchange = function () {
      var f = this.files && this.files[0]; if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        pendingPpn = String(reader.result).split(",")[1] || "";
        $("set-ppn-status").textContent = "Ready to save: " + f.name;
      };
      reader.readAsDataURL(f);
    };
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
        loadToday(); loadUpcoming();
        startWake();
      });
    };
  }
  init();
})();
