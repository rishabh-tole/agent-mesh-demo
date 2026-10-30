/*
 * Mesh console controller: scenario tabs, step runner, inspector, metrics and audit log.
 * Runs entirely in the browser. Nothing here calls a server.
 */
(function () {
  "use strict";

  var SCENARIOS = window.MESH_SCENARIOS;
  var STEP_PAUSE_MS = 650;
  var WORK_MS = 1000;

  var ROUTES = {
    local: { label: "Local", line: "local model on the supervisor · nothing leaves your network", short: "Local model · on your hardware" },
    hosted: { label: "Agent Mesh hosted", line: "dedicated hosted model · no retention, under contract", short: "Dedicated hosted model · no retention" },
    provider: { label: "Your provider", line: "your own model endpoint and keys (e.g. Azure OpenAI, Bedrock)", short: "Your endpoint · your keys" }
  };

  var st = {
    si: 0, step: -1, playing: false, busy: false, awaiting: false, inject: false,
    route: "local", nodeState: {}, actual: {}, done: {}, log: [], clock: 0,
    leases: 0, returnedKB: 0, used: {}, run: 0, resolveApproval: null, selected: null, tab: "run"
  };
  var graph = null;

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function sc() { return SCENARIOS[st.si]; }
  function nodeOf(id) { return graph.byId[id]; }

  function fmtClock(sec) {
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
    var pad = function (v) { return (v < 10 ? "0" : "") + v; };
    return "T+" + (h ? h + ":" : "") + pad(m) + ":" + pad(s);
  }
  function fmtKB(kb) { return kb >= 1024 ? (kb / 1024).toFixed(1) + " MB" : kb + " KB"; }

  /** Stable short fingerprint for a node identity, for display only. */
  function fingerprint(id) {
    var h = 2166136261;
    var src = sc().id + ":" + id;
    for (var i = 0; i < src.length; i++) { h ^= src.charCodeAt(i); h = Math.imul(h, 16777619); }
    var hex = (h >>> 0).toString(16);
    return ("00000000" + hex).slice(-8).replace(/(.{4})/, "$1·");
  }

  function setNode(id, s) { st.nodeState = Object.assign({}, st.nodeState, (function () { var o = {}; o[id] = s; return o; })()); }
  function addLog(kind, text) { st.log = st.log.concat([{ t: fmtClock(st.clock), kind: kind, text: text }]); renderLog(); }

  /* ---------- runner ---------- */

  function reset() {
    st.run++;
    if (st.resolveApproval) { st.resolveApproval(); st.resolveApproval = null; }
    st.step = -1; st.playing = false; st.busy = false; st.awaiting = false;
    st.nodeState = {}; st.actual = {}; st.done = {}; st.log = []; st.clock = 0;
    st.leases = 0; st.returnedKB = 0; st.used = {};
    render();
  }

  function zoneNodes(zoneId) { return sc().nodes.filter(function (n) { return n.zone === zoneId; }); }

  async function doStep(i) {
    var tok = st.run;
    var s = sc().steps[i];
    var target = s.node;
    st.busy = true; st.step = i; st.tab = st.selected ? st.tab : "run";
    render();

    if (s.unreachable) {
      zoneNodes(nodeOf(target).zone).forEach(function (n) { setNode(n.id, "unreachable"); });
      addLog("warn", nodeOf(target).label + ": no path from this mesh. Disconnected component, by design.");
      render(); await sleep(WORK_MS + 300); if (tok !== st.run) return;
      return finish(i, target, s);
    }
    if (s.deny) {
      setNode(target, "denied");
      addLog("err", "Policy engine denied a lease for " + nodeOf(target).label + ". No worker sent.");
      addLog("info", "  owner notified · attempt recorded");
      render(); await sleep(WORK_MS + 300); if (tok !== st.run) return;
      return finish(i, target, s);
    }
    if (target === "sup") {
      setNode("sup", "active");
      addLog("info", "Supervisor: " + s.title.toLowerCase() + ".");
      if (i === 0) addLog("info", "  inference → " + ROUTES[st.route].line);
      render(); await sleep(WORK_MS + 200); if (tok !== st.run) return;
      return finish(i, target, s);
    }

    st.leases++;
    var leaseId = "L-" + (240 + st.leases);
    addLog("lease", "Policy engine issued " + leaseId + " → " + nodeOf(target).label + " · expires " + s.lease.ttl);
    s.lease.scopes.forEach(function (c) { addLog("scope", "  " + c); });
    setNode(target, "active");
    graph.relaysFor(target).forEach(function (r) { setNode(r, "relay"); });
    render();
    await graph.travel(target, "out", "p-lease"); if (tok !== st.run) return;

    var fail = s.fail && (st.inject || s.fail.always) ? s.fail : null;
    if (fail) {
      setNode(target, "offline");
      addLog("err", fail.why);
      render(); await sleep(1300); if (tok !== st.run) return;
      if (fail.mode === "reroute") {
        addLog("warn", "Lease " + leaseId + " revoked. " + (fail.via || "Rerouted to " + nodeOf(fail.to).label + " (same capabilities)."));
        target = fail.to;
        st.leases++;
        addLog("lease", "Policy engine issued L-" + (240 + st.leases) + " → " + nodeOf(target).label + " · same scopes");
        setNode(target, "active");
        render();
        await graph.travel(target, "out", "p-lease"); if (tok !== st.run) return;
      } else {
        setNode(target, "rejoining");
        render();
        for (var k = 1; k <= 3; k++) {
          addLog("warn", "  reconnect attempt " + k + " · last known address + heartbeat signature");
          await sleep(520); if (tok !== st.run) return;
        }
        addLog("ok", nodeOf(target).label + " rejoined the mesh. Identity verified.");
        setNode(target, "active");
        render();
      }
    }
    st.actual[i] = target;

    if (s.approval) {
      st.awaiting = true; setNode(target, "waiting");
      addLog("warn", "Waiting for a person: " + s.approval);
      render();
      await new Promise(function (res) { st.resolveApproval = res; });
      if (tok !== st.run) return;
      st.awaiting = false; st.resolveApproval = null;
      setNode(target, "active");
      addLog("ok", "Approved in console. Step continues.");
      render();
    }

    await sleep(WORK_MS); if (tok !== st.run) return;
    await graph.travel(target, "back", "p-result"); if (tok !== st.run) return;
    st.returnedKB += s.ret || 0;
    st.used[target] = true;
    graph.relaysFor(target).forEach(function (r) { setNode(r, "done"); st.used[r] = true; });
    return finish(i, target, s);
  }

  function finish(i, target, s) {
    st.actual[i] = st.actual[i] || target;
    st.clock += s.t;
    st.done[i] = true;
    if (!s.unreachable && !s.deny) setNode(target, "done");
    var where = nodeOf(target).label;
    addLog("ok", (target === "sup" ? "" : "Returned from " + where + ": ") + s.out + (s.ret ? "  [" + fmtKB(s.ret) + "]" : ""));
    if (s.raw) addLog("info", "  raw data held in place: " + s.raw);
    st.busy = false;
    if (i === sc().steps.length - 1) { st.playing = false; addLog("ok", "All leases expired. Investigation closed."); }
    render();
  }

  async function play() {
    var tok = st.run;
    if (st.step >= sc().steps.length - 1 && st.done[st.step]) { reset(); tok = st.run; }
    st.playing = true; render();
    while (st.playing && tok === st.run && st.step < sc().steps.length - 1) {
      if (!st.busy) await doStep(st.step + 1);
      if (tok !== st.run) return;
      await sleep(STEP_PAUSE_MS);
    }
    if (tok === st.run) { st.playing = false; render(); }
  }

  /* ---------- rendering ---------- */

  function renderTabs() {
    $("scenarios").innerHTML = SCENARIOS.map(function (x, i) {
      return '<button class="scn" role="tab" data-act="tab" data-i="' + i + '" aria-selected="' + (i === st.si) + '">' +
        '<span class="scn-tag">' + esc(x.tag) + '</span><span class="scn-name">' + esc(x.tab) + '</span></button>';
    }).join("");
  }

  function renderControls() {
    var scn = sc(), last = scn.steps.length - 1, finished = st.step === last && st.done[last];
    $("askText").textContent = scn.prompt;
    $("playBtn").textContent = st.playing ? "Pause" : (finished ? "Run again" : (st.step >= 0 ? "Resume" : "Run"));
    $("nextBtn").disabled = st.busy || st.playing || finished;
    $("resetBtn").disabled = st.step < 0 && !st.playing;
    $("inject").checked = st.inject;
    var f = null;
    scn.steps.forEach(function (s, i) { if (s.fail && !f) f = { s: s, i: i }; });
    var hint = !f ? "" : f.s.fail.always
      ? "This run always shows a reboot and self-reconnect at step " + (f.i + 1) + "."
      : "Step " + (f.i + 1) + ": " + nodeOf(f.s.node).label + " drops off mid-task.";
    $("injectHint").textContent = f && !f.s.fail.always ? hint : "";
    $("injectWrap").hidden = !f || f.s.fail.always;
    $("alwaysHint").hidden = !(f && f.s.fail.always);
    $("alwaysHint").textContent = hint;
    Array.prototype.forEach.call(document.querySelectorAll("[data-route]"), function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-route") === st.route));
    });
    $("routeNote").textContent = ROUTES[st.route].short;
  }

  function stepStatus(i) { return st.done[i] ? "done" : (i === st.step ? "active" : "pending"); }

  function renderSteps() {
    var html = sc().steps.map(function (s, i) {
      var status = stepStatus(i);
      var nd = nodeOf(st.actual[i] || s.node);
      var rerouted = st.actual[i] && st.actual[i] !== s.node;
      var out = '<li class="step s-' + status + '"><div class="step-dot">' + (st.done[i] ? "✓" : (i + 1)) + '</div><div class="step-body">';
      out += '<div class="step-head"><h4>' + esc(s.title) + '</h4><span class="step-where">' + esc(nd.label) + (rerouted ? " · rerouted" : "") + '</span></div>';
      if (status !== "pending") {
        out += '<p>' + esc(s.detail) + '</p>';
        if (s.lease) {
          out += '<div class="lease"><div class="lease-head"><span>LEASE · issued by policy, not the model</span><span>expires ' + esc(s.lease.ttl) + '</span></div><div class="chips">' +
            s.lease.scopes.map(function (c) { return '<span class="chip">' + esc(c) + '</span>'; }).join("") + '</div></div>';
        }
        if (status === "active" && st.awaiting && s.approval) {
          out += '<div class="approve"><span>' + esc(s.approval) + '</span><button class="btn btn-primary" data-act="approve">Approve</button></div>';
        }
        if (status === "done") out += '<div class="result' + (s.deny || s.unreachable ? " result-blocked" : "") + '">' + esc(s.out) + (s.ret ? ' <em>' + fmtKB(s.ret) + ' returned</em>' : "") + '</div>';
      }
      return out + '</div></li>';
    }).join("");
    $("steps").innerHTML = html;
    var active = $("steps").querySelector(".s-active");
    if (active && st.tab === "run") active.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function permClass(v) {
    if (/none|^—$/.test(v)) return "perm-none";
    if (/approval/.test(v)) return "perm-gate";
    return "perm-on";
  }

  function modelFor(n) {
    if (n.zone && sc().zones.some(function (z) { return z.id === n.zone && z.gapped; })) return "Local only (air-gapped)";
    if (n.kind === "supervisor") return ROUTES[st.route].short;
    if (n.caps.some(function (c) { return /local model/.test(c); })) return "Small local model on device";
    return "No model. Executes leased steps only.";
  }

  function renderInspector() {
    var id = st.selected;
    if (!id) { $("inspect").innerHTML = '<p class="muted">Click any machine in the graph to see its spec, permissions and what it holds.</p>'; return; }
    var n = nodeOf(id);
    var role = n.kind === "supervisor" ? "Supervisor · master node" : n.kind === "sub" ? "Sub-supervisor" : "Worker";
    var state = st.nodeState[id] || (n.standby ? "standby" : "idle");
    var perms = ["read", "write", "exec", "actuate"].map(function (k) {
      return '<div class="perm ' + permClass(n.perms[k]) + '"><span>' + k + '</span><b>' + esc(n.perms[k]) + '</b></div>';
    }).join("");
    $("inspect").innerHTML =
      '<div class="ins-head"><div><div class="eyebrow">' + esc(role) + '</div><h4>' + esc(n.label) + '</h4></div><span class="pill pill-' + state + '">' + esc(state) + '</span></div>' +
      '<div class="chips"><span class="chip">' + (n.head === "headed" ? "Headed · runs full worker" : "Headless · reached via nearby worker") + '</span><span class="chip mono">node:' + esc(n.id) + ' · ed25519 ' + fingerprint(n.id) + '</span></div>' +
      '<dl class="spec">' +
      '<dt>Hardware</dt><dd>' + esc(n.hw) + '</dd>' +
      '<dt>OS / stack</dt><dd>' + esc(n.os) + '</dd>' +
      '<dt>Model</dt><dd>' + esc(modelFor(n)) + '</dd>' +
      '<dt>Holds</dt><dd>' + esc(n.data) + '</dd>' +
      '<dt>Heartbeat</dt><dd>' + (state === "offline" ? "missed ×3" : state === "unreachable" ? "not on this mesh" : "every 1 s · mTLS") + '</dd>' +
      '</dl>' +
      '<div class="eyebrow">Capabilities it advertises</div><div class="chips">' + n.caps.map(function (c) { return '<span class="chip">' + esc(c) + '</span>'; }).join("") + '</div>' +
      '<div class="eyebrow">Standing permissions</div><div class="perms">' + perms + '</div>' +
      '<p class="muted small">Standing permissions are ceilings. Each task still gets its own short lease.</p>';
  }

  function renderPanelTabs() {
    $("tabRun").setAttribute("aria-selected", String(st.tab === "run"));
    $("tabInspect").setAttribute("aria-selected", String(st.tab === "inspect"));
    $("steps").hidden = st.tab !== "run";
    $("inspect").hidden = st.tab !== "inspect";
  }

  function renderMetrics() {
    var machines = Object.keys(st.used).filter(function (k) { return k !== "sup"; }).length;
    $("metrics").innerHTML =
      '<div class="metric metric-key"><b>0 B</b><span>raw data moved off machines</span></div>' +
      '<div class="metric"><b>' + fmtKB(st.returnedKB) + '</b><span>summaries returned</span></div>' +
      '<div class="metric"><b>' + st.leases + '</b><span>short-lived leases</span></div>' +
      '<div class="metric"><b>' + machines + '</b><span>machines used</span></div>' +
      '<div class="metric"><b>' + fmtClock(st.clock).replace("T+", "") + '</b><span>mesh time · today ' + esc(sc().today) + '*</span></div>';
  }

  function renderLog() {
    var box = $("log");
    if (!st.log.length) { box.innerHTML = '<div class="log-empty">$ waiting for a request · press Run</div>'; return; }
    box.innerHTML = st.log.map(function (l) {
      return '<div class="ll ll-' + l.kind + '"><span class="lt">' + l.t + '</span><span>' + esc(l.text) + '</span></div>';
    }).join("");
    box.scrollTop = box.scrollHeight;
  }

  function renderCompare() {
    var c = sc().cloud;
    $("compare").innerHTML =
      '<div class="cmp cmp-cloud"><div class="eyebrow">A cloud agent first needs</div><div class="cmp-big">' + esc(c.amount) + '</div><div class="muted">' + esc(c.note) + '</div><ul>' +
      c.needs.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + '</ul></div>' +
      '<div class="cmp cmp-mesh"><div class="eyebrow">Agent Mesh moves</div><div class="cmp-big">0 B raw</div><div class="muted">returns ' + esc(c.returned) + '</div><ul>' +
      '<li>Workers run where the data already is</li><li>Every step gets a lease that expires</li><li>Every action lands in your audit log</li></ul></div>';
  }

  function render() {
    renderTabs(); renderControls(); renderPanelTabs(); renderSteps(); renderInspector(); renderMetrics(); renderCompare();
    if (graph) graph.setState(st.nodeState, st.selected);
  }

  function mountScenario() {
    graph = window.MeshGraph.mount($("mesh"), sc(), function (id) {
      st.selected = st.selected === id ? null : id;
      st.tab = st.selected ? "inspect" : "run";
      render();
    });
    st.selected = null; st.tab = "run";
    reset();
    renderLog();
  }

  /* ---------- events ---------- */

  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]");
    if (!b) return;
    var act = b.getAttribute("data-act");
    if (act === "tab") { st.si = parseInt(b.getAttribute("data-i"), 10); mountScenario(); }
    else if (act === "reset") reset();
    else if (act === "play") { if (st.playing) { st.playing = false; render(); } else play(); }
    else if (act === "next") { if (!st.busy) doStep(st.step + 1); }
    else if (act === "approve") { if (st.resolveApproval) st.resolveApproval(); }
    else if (act === "panel") { st.tab = b.getAttribute("data-tab"); render(); }
    else if (act === "route") { st.route = b.getAttribute("data-route"); if (st.step >= 0) addLog("info", "Model routing changed → " + ROUTES[st.route].line); render(); }
  });
  $("inject").addEventListener("change", function (e) {
    st.inject = e.target.checked;
    if (st.step >= 0) addLog(st.inject ? "warn" : "info", st.inject ? "Failure injection armed." : "Failure injection disarmed.");
    render();
  });

  mountScenario();
})();
