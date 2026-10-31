/*
 * Mesh demo controller: chat window drives a diagnose → fix → test run over the topology graph.
 * Runs entirely in the browser. Nothing here calls a server.
 */
(function () {
  "use strict";

  var SCENARIOS = window.MESH_SCENARIOS;
  var PHASES = ["diagnose", "fix", "test"];
  var HEADER = { diagnose: "Diagnosing", fix: "Fixing", test: "Testing" };
  var NEXT_CTA = { diagnose: "Fix it", fix: "Test it" };
  var USER_ECHO = { fix: "Go ahead, fix it.", test: "Looks good. Test it." };
  var TYPE_MS = 16;
  var BASE = { plan: 700, work: 900, pause: 380, failWait: 1000, retry: 520 };

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    log: $("chatLog"), empty: $("empty"), chips: $("chips"), input: $("input"), form: $("composer"),
    send: $("send"), status: $("chatStatus"), svg: $("mesh"), card: $("nodeCard"), wrap: $("graphWrap"),
    phases: $("phases"), mRaw: $("mRaw"), mRet: $("mRet"), mMach: $("mMach"), mLease: $("mLease"), mTime: $("mTime")
  };

  var st = {
    sc: SCENARIOS[0], graph: null, states: {}, run: 0, busy: false, started: false,
    speed: 1, kb: 0, leases: 0, machines: {}, t: 0, typing: false
  };

  /* ---------- helpers ---------- */

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /** Resolves after `ms` scaled by speed, or rejects quietly if the run was reset. */
  function wait(ms, token) {
    return new Promise(function (resolve, reject) {
      setTimeout(function () { token === st.run ? resolve() : reject("reset"); }, ms / st.speed);
    });
  }

  function guard(token) { if (token !== st.run) throw "reset"; }

  function fmtKB(kb) { return kb >= 1000 ? (kb / 1000).toFixed(1) + " MB" : kb + " KB"; }

  function fmtTime(s) {
    var m = Math.floor(s / 60), r = s % 60;
    return m >= 60 ? Math.floor(m / 60) + "h " + (m % 60) + "m" : m + ":" + (r < 10 ? "0" : "") + r;
  }

  function scrollChat() { els.log.scrollTop = els.log.scrollHeight; }

  function setStatus(text, hot) {
    els.status.textContent = text;
    els.status.className = "chat-status" + (hot ? " hot" : "");
  }

  function paint() { st.graph.setState(st.states, null); }

  function setNode(id, s) {
    var patch = {};
    patch[id] = s;
    st.states = Object.assign({}, st.states, patch);
  }

  /* ---------- meters + phases ---------- */

  function renderMeters() {
    els.mRet.textContent = fmtKB(st.kb);
    els.mMach.textContent = String(Object.keys(st.machines).length);
    els.mLease.textContent = String(st.leases);
    els.mTime.textContent = fmtTime(st.t);
  }

  function renderPhases(active, doneUpTo) {
    Array.prototype.forEach.call(els.phases.children, function (ph) {
      var i = PHASES.indexOf(ph.getAttribute("data-ph"));
      var cls = "ph";
      if (i < doneUpTo) cls += " done";
      if (PHASES[i] === active) cls += " active";
      ph.className = cls;
    });
  }

  /* ---------- graph + node card ---------- */

  function mount(sc) {
    st.sc = sc;
    st.states = {};
    st.graph = window.MeshGraph.mount(els.svg, sc, showCard);
    hideCard();
    paint();
  }

  function showCard(id) {
    var n = st.graph.byId[id];
    var p = n.perms;
    els.card.innerHTML =
      '<div class="c-top"><span class="c-glyph">' + esc(n.glyph) + '</span><div><b>' + esc(n.label) + '</b><span>' + esc(n.sub) + '</span></div>' +
      '<button type="button" class="c-x" data-act="close-card" aria-label="Close">×</button></div>' +
      '<dl><dt>Hardware</dt><dd>' + esc(n.hw) + '</dd>' +
      '<dt>Type</dt><dd>' + (n.head === "headed" ? "Headed · runs a worker" : "Headless · reached via " + esc(st.graph.byId[n.parent] ? st.graph.byId[n.parent].label : "a worker")) + '</dd>' +
      '<dt>Can do</dt><dd>' + n.caps.map(esc).join(" · ") + '</dd>' +
      '<dt>Read</dt><dd>' + esc(p.read) + '</dd><dt>Write</dt><dd>' + esc(p.write) + '</dd><dt>Actuate</dt><dd>' + esc(p.actuate) + '</dd></dl>';
    var box = els.svg.getBoundingClientRect();
    var wrap = els.wrap.getBoundingClientRect();
    var k = box.width / 1000;
    var x = box.left - wrap.left + els.wrap.scrollLeft + n.x * k;
    var y = box.top - wrap.top + n.y * k;
    var left = Math.min(Math.max(8, x + 34), els.wrap.scrollWidth - 268);
    if (x > box.width * 0.62) left = Math.max(8, x - 300);
    els.card.style.left = left + "px";
    els.card.style.top = Math.max(8, Math.min(y - 40, wrap.height - 250)) + "px";
    els.card.hidden = false;
  }

  function hideCard() { els.card.hidden = true; }

  /* ---------- chat rendering ---------- */

  function append(html) {
    var div = document.createElement("div");
    div.innerHTML = html;
    var node = div.firstElementChild;
    els.log.appendChild(node);
    scrollChat();
    return node;
  }

  function userMsg(text) {
    return append('<div class="msg user"><div class="who">You</div><div class="bubble">' + esc(text) + '</div></div>');
  }

  function agentBlock(phase) {
    return append(
      '<div class="msg agent"><div class="who"><span class="mk"></span>Mesh · ' + HEADER[phase].toLowerCase() + '</div>' +
      '<ol class="trace"></ol></div>'
    ).querySelector(".trace");
  }

  function traceRow(list, step) {
    var n = st.graph.byId[step.node];
    var li = document.createElement("li");
    li.className = "row running";
    li.innerHTML =
      '<div class="r-head"><span class="tag">' + esc(n.glyph) + '</span><span class="r-title">' + esc(step.title) + '</span><span class="r-st"><i class="spin"></i></span></div>' +
      '<div class="r-where">' + esc(n.label) + (step.lease ? ' <span class="lease">lease · ' + esc(step.lease) + '</span>' : '') + '</div>' +
      '<div class="r-events"></div><div class="r-out"></div>';
    list.appendChild(li);
    scrollChat();
    return li;
  }

  function rowEvent(li, cls, text) {
    var e = document.createElement("div");
    e.className = "ev " + cls;
    e.textContent = text;
    li.querySelector(".r-events").appendChild(e);
    scrollChat();
    return e;
  }

  function finishRow(li, step) {
    li.className = "row done";
    li.querySelector(".r-st").innerHTML = step.ret ? '<span class="kb">' + fmtKB(step.ret) + '</span>✓' : "✓";
    li.querySelector(".r-out").textContent = step.out;
    scrollChat();
  }

  function summaryMsg(phase) {
    var p = st.sc.phases[phase];
    var nextPhase = PHASES[PHASES.indexOf(phase) + 1];
    return append(
      '<div class="msg agent sum"><div class="bubble">' + p.summary + '</div>' +
      '<div class="cta-row"><button type="button" class="cta" data-act="next" data-phase="' + nextPhase + '">' + NEXT_CTA[phase] +
      ' <span aria-hidden="true">→</span></button><span class="cta-note">' + esc(p.note) + '</span></div></div>'
    );
  }

  function finalMsg() {
    var sc = st.sc;
    var others = SCENARIOS.filter(function (x) { return x.id !== sc.id; });
    append(
      '<div class="msg agent final"><div class="f-tag">RESOLVED</div><div class="f-head">' + esc(sc.done) + '</div>' +
      '<div class="f-grid">' +
      '<div><span>Elapsed</span><b>' + fmtTime(st.t) + '</b></div>' +
      '<div><span>Typical today</span><b>' + esc(sc.today) + '</b></div>' +
      '<div><span>Raw data moved</span><b class="hot">0 B</b></div>' +
      '<div><span>Machines</span><b>' + Object.keys(st.machines).length + '</b></div>' +
      '</div><div class="f-stay">' + esc(sc.stayed) + '.</div>' +
      '<div class="f-next"><span>Try another:</span>' + others.map(function (x) {
        return '<button type="button" class="chip" data-act="chip" data-id="' + x.id + '">' + esc(x.chip) + '</button>';
      }).join("") + '</div></div>'
    );
  }

  /* ---------- run ---------- */

  async function travelOut(id, token) {
    var relays = st.graph.relaysFor(id);
    relays.forEach(function (r) { setNode(r, "relay"); });
    paint();
    await st.graph.travel(id, "out", "p-out", st.speed);
    guard(token);
    return relays;
  }

  async function handleFail(step, li, token) {
    var f = step.fail;
    setNode(step.node, "offline");
    paint();
    rowEvent(li, "bad", "⚠ " + f.why);
    await wait(BASE.failWait, token);
    if (f.mode === "reroute") {
      var to = st.graph.byId[f.to];
      rowEvent(li, "heal", "↻ " + (f.via || "Rerouted to " + to.label + ". Same image, same lease."));
      setNode(f.to, "active");
      paint();
      await st.graph.travel(f.to, "out", "p-out", st.speed);
      guard(token);
      return f.to;
    }
    setNode(step.node, "rejoining");
    paint();
    var ev = rowEvent(li, "heal", "↻ Reconnecting · attempt 1 / 3");
    for (var i = 2; i <= 3; i++) {
      await wait(BASE.retry, token);
      ev.textContent = "↻ Reconnecting · attempt " + i + " / 3";
    }
    await wait(BASE.retry, token);
    ev.textContent = "↻ Rejoined the mesh. Lease resumed.";
    setNode(step.node, "active");
    paint();
    return step.node;
  }

  async function doStep(step, list, token) {
    var li = traceRow(list, step);
    var node = st.graph.byId[step.node];
    setNode(step.node, "active");
    paint();

    if (node.kind === "supervisor") {
      await wait(BASE.plan, token);
      setNode(step.node, "done");
      st.machines[step.node] = true;
    } else {
      st.leases += step.lease ? 1 : 0;
      renderMeters();
      var relays = await travelOut(step.node, token);
      var actual = step.node;
      if (step.fail) actual = await handleFail(step, li, token);
      await wait(BASE.work, token);
      await st.graph.travel(actual, "back", "p-back", st.speed);
      guard(token);
      setNode(actual, "done");
      relays.forEach(function (r) { setNode(r, "done"); });
      st.machines[actual] = true;
      relays.forEach(function (r) { st.machines[r] = true; });
    }
    st.kb += step.ret || 0;
    st.t += step.t || 0;
    paint();
    finishRow(li, step);
    renderMeters();
    await wait(BASE.pause, token);
  }

  /** Dims finished nodes between phases so the next phase's activity reads clearly. */
  function settle() {
    var next = {};
    Object.keys(st.states).forEach(function (k) {
      var s = st.states[k];
      next[k] = s === "offline" ? "offline" : "idle";
    });
    st.states = next;
    paint();
  }

  async function runPhase(phase) {
    var token = st.run;
    st.busy = true;
    lockComposer(true);
    renderPhases(phase, PHASES.indexOf(phase));
    setStatus(HEADER[phase].toLowerCase() + "…", true);
    settle();
    try {
      var list = agentBlock(phase);
      var steps = st.sc.phases[phase].steps;
      for (var i = 0; i < steps.length; i++) await doStep(steps[i], list, token);
      st.busy = false;
      if (phase === "test") {
        renderPhases(null, 3);
        setStatus("resolved", false);
        finalMsg();
        lockComposer(false);
      } else {
        setStatus("waiting on you", true);
        summaryMsg(phase);
      }
    } catch (e) {
      if (e !== "reset") throw e;
    }
  }

  /* ---------- input ---------- */

  function lockComposer(on) {
    els.input.disabled = on;
    els.send.disabled = on;
    els.form.classList.toggle("locked", on);
  }

  function matchScenario(text) {
    var t = text.toLowerCase();
    var best = null, score = 0;
    SCENARIOS.forEach(function (sc) {
      var s = sc.keys.filter(function (k) { return t.indexOf(k) !== -1; }).length;
      if (s > score) { best = sc; score = s; }
    });
    return best || st.sc;
  }

  function renderChips() {
    els.chips.innerHTML = SCENARIOS.map(function (sc) {
      return '<button type="button" class="chip" data-act="chip" data-id="' + sc.id + '">' + esc(sc.chip) + '</button>';
    }).join("");
  }

  async function typeInto(text) {
    var token = st.run;
    st.typing = true;
    els.input.value = "";
    els.input.focus();
    for (var i = 1; i <= text.length; i++) {
      if (token !== st.run) return;
      els.input.value = text.slice(0, i);
      await new Promise(function (r) { setTimeout(r, TYPE_MS); });
    }
    st.typing = false;
    els.send.classList.add("pulse");
  }

  function pickScenario(id) {
    var sc = SCENARIOS.filter(function (x) { return x.id === id; })[0];
    if (!sc || st.busy) return;
    if (st.started) reset();
    mount(sc);
    typeInto(sc.prompt);
  }

  function submit(e) {
    if (e) e.preventDefault();
    var text = els.input.value.trim();
    if (!text || st.busy || st.typing) return;
    var sc = matchScenario(text);
    if (sc !== st.sc) mount(sc);
    st.started = true;
    els.empty.hidden = true;
    els.send.classList.remove("pulse");
    els.input.value = "";
    userMsg(text);
    runPhase("diagnose");
  }

  function next(phase, btn) {
    if (st.busy) return;
    btn.closest(".cta-row").classList.add("used");
    userMsg(USER_ECHO[phase]);
    runPhase(phase);
  }

  function reset() {
    st.run += 1;
    st.busy = false;
    st.started = false;
    st.typing = false;
    st.kb = 0; st.leases = 0; st.machines = {}; st.t = 0;
    Array.prototype.slice.call(els.log.children).forEach(function (c) { if (c !== els.empty) els.log.removeChild(c); });
    els.empty.hidden = false;
    els.input.value = "";
    els.send.classList.remove("pulse");
    lockComposer(false);
    renderPhases(null, 0);
    setStatus("ready", false);
    renderMeters();
    mount(st.sc);
  }

  /* ---------- events ---------- */

  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-act], [data-speed]");
    if (!t) {
      if (!e.target.closest(".card, .n")) hideCard();
      return;
    }
    if (t.hasAttribute("data-speed")) {
      st.speed = Number(t.getAttribute("data-speed"));
      Array.prototype.forEach.call(document.querySelectorAll("[data-speed]"), function (b) { b.classList.toggle("on", b === t); });
      return;
    }
    var act = t.getAttribute("data-act");
    if (act === "chip") pickScenario(t.getAttribute("data-id"));
    else if (act === "next") next(t.getAttribute("data-phase"), t);
    else if (act === "reset") reset();
    else if (act === "close-card") hideCard();
  });

  els.form.addEventListener("submit", submit);
  els.input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) submit(e);
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") hideCard(); });

  renderChips();
  reset();
})();
