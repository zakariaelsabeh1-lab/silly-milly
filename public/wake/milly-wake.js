// Main-thread side of the on-tablet "Hey Silly Milly" wake word.
// window.MillyWake.start() opens the microphone as one continuous stream (no beeps) and feeds the
// worker. stop() releases the microphone so Chrome's speech-to-text can use it for the question.
(function () {
  var worker = null, workerReady = null, ctx = null, stream = null, node = null, src = null;
  var handlers = { wake: null, level: null, error: null };
  var enrollWaiter = null;

  function ensureWorker() {
    if (workerReady) return workerReady;
    worker = new Worker("/wake/wake-worker.js");
    workerReady = new Promise(function (resolve, reject) {
      worker.onmessage = function (e) {
        var d = e.data || {};
        if (d.type === "ready") resolve();
        else if (d.type === "error") { if (handlers.error) handlers.error(d.message); reject(new Error(d.message)); }
        else if (d.type === "wake") { if (handlers.wake) handlers.wake(d); }
        else if (d.type === "level") { if (handlers.level) handlers.level(d); }
        else if (d.type === "enrolled") { var w = enrollWaiter; enrollWaiter = null; if (w) w(d); }
      };
      worker.postMessage({ type: "init", base: "/" });
    });
    workerReady.catch(function () { workerReady = null; });
    return workerReady;
  }

  function start() {
    if (stream) return Promise.resolve();
    return ensureWorker().then(function () {
      return navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
    }).then(function (s) {
      stream = s;
      try { ctx = new AudioContext({ sampleRate: 16000 }); } catch (e) { ctx = new AudioContext(); }
      return ctx.audioWorklet.addModule("/wake/capture-worklet.js");
    }).then(function () {
      if (!stream) throw new Error("stopped");
      src = ctx.createMediaStreamSource(stream);
      node = new AudioWorkletNode(ctx, "milly-capture");
      // Send audio straight from the audio thread to the worker.
      var ch = new MessageChannel();
      node.port.postMessage({ port: ch.port1 }, [ch.port1]);
      worker.postMessage({ type: "port", port: ch.port2 }, [ch.port2]);
      src.connect(node);
      return ctx.resume();
    }).catch(function (err) { stop(); throw err; });
  }

  function stop() {
    try { if (src) src.disconnect(); } catch (e) {}
    try { if (node) node.disconnect(); } catch (e) {}
    if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
    if (ctx) { try { ctx.close(); } catch (e) {} }
    src = node = stream = ctx = null;
    if (worker) worker.postMessage({ type: "reset" });
    return new Promise(function (r) { setTimeout(r, 150); }); // give Android a moment to free the mic
  }

  // Record one "Hey Silly Milly" (about 2.4 s). Resolves {ok, frames} or {ok:false, reason}.
  function enrollOnce(ms) {
    return start().then(function () {
      return new Promise(function (resolve) {
        worker.postMessage({ type: "enroll-start" });
        setTimeout(function () { enrollWaiter = resolve; worker.postMessage({ type: "enroll-stop" }); }, ms || 2400);
      });
    });
  }

  window.MillyWake = {
    supported: !!(window.AudioWorkletNode && window.Worker && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.WebAssembly),
    load: ensureWorker,
    start: start,
    stop: stop,
    running: function () { return !!stream; },
    enrollOnce: enrollOnce,
    setTemplates: function (list) { return ensureWorker().then(function () { worker.postMessage({ type: "templates", list: list || [] }); }); },
    setThreshold: function (v) { return ensureWorker().then(function () { worker.postMessage({ type: "threshold", value: v }); }); },
    on: function (name, fn) { handlers[name] = fn; }
  };
})();
