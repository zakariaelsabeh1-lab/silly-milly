// "Hey Silly Milly" wake-word worker. Runs off the main thread so the screen stays smooth.
//
// How it works:
//  1. Microphone audio arrives as 80 ms chunks (16 kHz).
//  2. Two small open models from openWakeWord (Apache-2.0, based on Google's speech_embedding)
//     turn the audio into a 96-number "sound fingerprint" every 80 ms.
//  3. The family records "Hey Silly Milly" a few times in Settings. Those fingerprint sequences are
//     the templates. We compare the last ~1.5 s of live fingerprints to each template with dynamic
//     time warping (so fast or slow speech still matches). A close enough match = wake.
//  Nothing leaves the tablet, and no beeps: the microphone stays open as one stream.
/* global ort */
var BASE = "/";
var melSess = null, embSess = null, ready = false;
var tail = new Float32Array(480);            // last 30 ms of audio, for overlapping mel frames
var mel = [];                                 // recent mel frames (Float32Array(32)), newest last
var MEL_KEEP = 76 + 8 * 30;
var embs = [];                                // per-chunk embeddings (normalized), null = not computed
var rmsHist = [];
var KEEP = 40;
var quietRun = 99;
var templates = [];                           // [{who, frames:[Float32Array(96)...]}]
var threshold = 0.07;
var enrolling = null;                         // {embs:[], rms:[]}
var cooldownUntil = 0;
var busy = false, queue = [];
var timeSum = 0, timeN = 0, lastScores = [];
var chunkCount = 0;
var FLOOR = 60;                               // below this RMS (16-bit scale) we treat the room as silent

function post(m) { self.postMessage(m); }

async function init(base) {
  BASE = base || "/";
  importScripts(BASE + "vendor/ort/ort.wasm.min.js");
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.simd = true;
  ort.env.wasm.wasmPaths = BASE + "vendor/ort/";
  var opt = { executionProviders: ["wasm"], graphOptimizationLevel: "all" };
  melSess = await ort.InferenceSession.create(BASE + "wake/melspectrogram.onnx", opt);
  embSess = await ort.InferenceSession.create(BASE + "wake/embedding_model.onnx", opt);
  for (var i = 0; i < 76; i++) mel.push(new Float32Array(32).fill(1));
  ready = true;
  post({ type: "ready" });
}

async function melFrames(chunk) {
  var x = new Float32Array(1760);
  x.set(tail, 0); x.set(chunk, 480);
  tail = chunk.slice(1280 - 480);
  var out = await melSess.run({ input: new ort.Tensor("float32", x, [1, 1760]) });
  var d = out[melSess.outputNames[0]].data; // [1,1,frames,32]
  var n = d.length / 32;
  for (var f = 0; f < n; f++) {
    var fr = new Float32Array(32);
    for (var k = 0; k < 32; k++) fr[k] = d[f * 32 + k] / 10 + 2;
    mel.push(fr);
  }
  if (mel.length > MEL_KEEP) mel.splice(0, mel.length - MEL_KEEP);
}

// Embedding of the 76 mel frames that end `back` chunks ago (8 frames per chunk).
async function embedAt(back) {
  var end = mel.length - 8 * back;
  if (end - 76 < 0) return null;
  var x = new Float32Array(76 * 32);
  for (var i = 0; i < 76; i++) x.set(mel[end - 76 + i], i * 32);
  var out = await embSess.run({ input_1: new ort.Tensor("float32", x, [1, 76, 32, 1]) });
  var e = Float32Array.from(out[embSess.outputNames[0]].data);
  var norm = 0; for (var j = 0; j < e.length; j++) norm += e[j] * e[j];
  norm = Math.sqrt(norm) || 1;
  for (j = 0; j < e.length; j++) e[j] /= norm;
  return e;
}

function rmsOf(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i] * a[i]; return Math.sqrt(s / a.length); }

// Subsequence DTW: template T against the stream window S (free start, end pinned to newest frame).
function sdtw(T, S) {
  var n = T.length, m = S.length, skip = Math.floor(n * 0.3);
  var prevC = new Float64Array(m), prevL = new Float64Array(m), C = new Float64Array(m), L = new Float64Array(m);
  function dist(a, b) { var s = 0; for (var k = 0; k < 96; k++) s += a[k] * b[k]; return 1 - s; }
  for (var j = 0; j < m; j++) { prevC[j] = dist(T[0], S[j]); prevL[j] = 1; }
  for (var i = 1; i < n; i++) {
    for (j = 0; j < m; j++) {
      var best = prevC[j], l = prevL[j];
      if (j > 0 && prevC[j - 1] <= best) { best = prevC[j - 1]; l = prevL[j - 1]; }
      if (j > 0 && C[j - 1] < best) { best = C[j - 1]; l = L[j - 1]; }
      var d = dist(T[i], S[j]);
      // Allow skipping the start of the template (e.g. "Silly Milly" without "Hey").
      if (i <= skip && d < (d + best) / (l + 1)) { C[j] = d; L[j] = 1; }
      else { C[j] = d + best; L[j] = l + 1; }
    }
    var tc = prevC; prevC = C; C = tc; var tl = prevL; prevL = L; L = tl;
  }
  return prevC[m - 1] / prevL[m - 1];
}

function matchScore() {
  var best = 9, who = "";
  for (var t = 0; t < templates.length; t++) {
    var T = templates[t].frames, w = Math.ceil(T.length * 1.5);
    if (embs.length < w) continue;
    var S = embs.slice(embs.length - w);
    if (S.some(function (e) { return !e; })) continue;
    var s = sdtw(T, S);
    if (s < best) { best = s; who = templates[t].who; }
  }
  return { score: best, who: who };
}

async function onChunk(chunk) {
  var t0 = Date.now();
  var r = rmsOf(chunk);
  await melFrames(chunk);
  chunkCount++;
  rmsHist.push(r); if (rmsHist.length > KEEP) rmsHist.shift();
  quietRun = r < FLOOR ? quietRun + 1 : 0;
  var active = !!enrolling || (quietRun < 15 && templates.length);
  embs.push(null); if (embs.length > KEEP) embs.shift();
  if (active) {
    // Fill in fingerprints skipped while the room was quiet (up to ~2 s back), so a phrase that
    // starts right after silence still has its full history.
    var maxBack = Math.min(embs.length, 25);
    for (var b = maxBack - 1; b >= 0; b--) {
      var idx = embs.length - 1 - b;
      if (!embs[idx]) embs[idx] = await embedAt(b);
    }
  }
  if (enrolling) {
    enrolling.embs.push(embs[embs.length - 1]);
    enrolling.rms.push(r);
  } else if (active && Date.now() > cooldownUntil) {
    var m = matchScore();
    lastScores.push(m.score);
    if (m.score < threshold) {
      cooldownUntil = Date.now() + 2500;
      post({ type: "wake", score: m.score, who: m.who });
    }
  }
  timeSum += Date.now() - t0; timeN++;
  if (chunkCount % 4 === 0) {
    var s = lastScores.length ? Math.min.apply(null, lastScores) : null;
    lastScores = [];
    post({ type: "level", score: s, rms: r, ms: timeSum / timeN, listening: active });
    if (timeN > 200) { timeSum /= 2; timeN /= 2; }
  }
}

function finishEnroll() {
  var e = enrolling; enrolling = null;
  if (!e || !e.rms.length) return { ok: false, reason: "Nothing recorded." };
  var sorted = e.rms.slice().sort(function (a, b) { return a - b; });
  var floor = sorted[Math.floor(sorted.length * 0.2)], peak = sorted[sorted.length - 1];
  if (peak < 200) return { ok: false, reason: "I couldn't hear you. Come a little closer and say it again." };
  var lim = Math.max(floor * 2.5, peak * 0.12, FLOOR);
  var a = -1, b = -1;
  for (var i = 0; i < e.rms.length; i++) if (e.rms[i] > lim) { if (a < 0) a = i; b = i; }
  var frames = e.embs.slice(a + 2, Math.min(b + 3, e.embs.length)).filter(Boolean);
  if (frames.length < 5) return { ok: false, reason: "That was too short. Say the whole \"Hey Silly Milly\"." };
  if (frames.length > 26) return { ok: false, reason: "That was too long or noisy. Try again in a quieter moment." };
  return { ok: true, frames: frames.map(function (f) { return Array.from(f, function (v) { return Math.round(v * 10000) / 10000; }); }) };
}

function pump() {
  if (busy || !queue.length || !ready) return;
  busy = true;
  var c = queue.shift();
  if (queue.length > 25) queue.splice(0, queue.length - 25); // fell far behind: drop old audio
  onChunk(c).catch(function (err) { post({ type: "error", message: String(err && err.message || err) }); })
    .then(function () { busy = false; pump(); });
}

function onAudio(e) { if (e.data && e.data.type === "audio") { queue.push(e.data.pcm); pump(); } }

self.onmessage = function (e) {
  var d = e.data || {};
  if (d.type === "init") init(d.base).catch(function (err) { post({ type: "error", message: "Couldn't load the wake word: " + (err && err.message || err) }); });
  else if (d.type === "port") { d.port.onmessage = onAudio; queue = []; quietRun = 99; }
  else if (d.type === "audio") onAudio(e);
  else if (d.type === "templates") {
    templates = (d.list || []).map(function (t) {
      return { who: t.who || "", frames: t.frames.map(function (f) {
        var a = Float32Array.from(f), n = 0; for (var i = 0; i < a.length; i++) n += a[i] * a[i]; n = Math.sqrt(n) || 1;
        for (i = 0; i < a.length; i++) a[i] /= n; return a; }) };
    });
  }
  else if (d.type === "threshold") threshold = d.value;
  else if (d.type === "enroll-start") { enrolling = { embs: [], rms: [] }; }
  else if (d.type === "enroll-stop") { var r = finishEnroll(); r.type = "enrolled"; post(r); }
  else if (d.type === "reset") { embs = []; queue = []; quietRun = 99; }
};
