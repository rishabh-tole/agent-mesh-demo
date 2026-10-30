/*
 * SVG topology renderer for the mesh console.
 * Draws zones, parent→child edges and nodes once per scenario, then flips CSS classes for state.
 * Packets travel along the edge chain from the supervisor to a node and back.
 */
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var VIEW_W = 1000;
  var VIEW_H = 604;
  var RADIUS = { supervisor: 33, sub: 26, worker: 23 };

  /** @param {string} tag @param {Object<string, string|number>} attrs @returns {SVGElement} */
  function el(tag, attrs) {
    var node = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, String(attrs[k])); });
    return node;
  }

  function radiusOf(n) { return RADIUS[n.kind || "worker"]; }

  /** Gentle curve between two nodes, bowed perpendicular to the straight line. */
  function edgePath(a, b) {
    var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    var dx = b.x - a.x, dy = b.y - a.y;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var bow = Math.min(46, len * 0.14);
    var cx = mx - (dy / len) * bow, cy = my + (dx / len) * bow;
    return "M " + a.x + " " + a.y + " Q " + cx + " " + cy + " " + b.x + " " + b.y;
  }

  function nodeShape(n) {
    var r = radiusOf(n);
    if (n.head === "headless") {
      var s = r * 1.7;
      return el("rect", { "class": "n-body", x: -s / 2, y: -s / 2, width: s, height: s, rx: 7 });
    }
    return el("circle", { "class": "n-body", r: r });
  }

  /**
   * @param {SVGSVGElement} svg
   * @param {{zones: Array, nodes: Array, edgeLabels: Object}} scenario
   * @param {(id: string) => void} onSelect
   * @returns {{ setState: Function, travel: Function, byId: Object }}
   */
  function mount(svg, scenario, onSelect) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute("viewBox", "0 0 " + VIEW_W + " " + VIEW_H);

    var byId = {};
    scenario.nodes.forEach(function (n) { byId[n.id] = n; });

    var defs = el("defs", {});
    var glow = el("filter", { id: "glow", x: "-50%", y: "-50%", width: "200%", height: "200%" });
    glow.appendChild(el("feGaussianBlur", { stdDeviation: "4", result: "b" }));
    var merge = el("feMerge", {});
    merge.appendChild(el("feMergeNode", { "in": "b" }));
    merge.appendChild(el("feMergeNode", { "in": "SourceGraphic" }));
    glow.appendChild(merge);
    defs.appendChild(glow);
    svg.appendChild(defs);

    var gZones = el("g", { "class": "zones" });
    scenario.zones.forEach(function (z) {
      var g = el("g", { "class": "zone" + (z.gapped ? " zone-gapped" : ""), "data-zone": z.id });
      g.appendChild(el("rect", { x: z.x, y: z.y, width: z.w, height: z.h, rx: 14 }));
      var label = el("text", { "class": "z-label", x: z.x + 16, y: z.y + 24 });
      label.textContent = z.label;
      g.appendChild(label);
      var link = el("text", { "class": "z-link", x: z.x + z.w - 16, y: z.y + 24, "text-anchor": "end" });
      link.textContent = z.link;
      g.appendChild(link);
      gZones.appendChild(g);
    });
    svg.appendChild(gZones);

    var gEdges = el("g", { "class": "edges" });
    var edges = {};
    scenario.nodes.forEach(function (n) {
      if (!n.parent) return;
      var p = byId[n.parent];
      var d = edgePath(p, n);
      var path = el("path", { "class": "edge" + (n.standby ? " edge-standby" : ""), d: d, "data-to": n.id });
      gEdges.appendChild(path);
      edges[n.id] = path;
      var label = scenario.edgeLabels && scenario.edgeLabels[n.id];
      if (label) {
        var at = path.getPointAtLength(path.getTotalLength() * 0.74);
        var t = el("text", { "class": "e-label", x: at.x, y: at.y - 12, "text-anchor": "middle" });
        t.textContent = label;
        gEdges.appendChild(t);
      }
    });
    svg.appendChild(gEdges);

    var gPackets = el("g", { "class": "packets" });

    var gNodes = el("g", { "class": "nodes" });
    var groups = {};
    scenario.nodes.forEach(function (n) {
      var r = radiusOf(n);
      var g = el("g", {
        "class": "n n-" + (n.kind || "worker") + " n-" + n.head + (n.standby ? " is-standby" : ""),
        transform: "translate(" + n.x + "," + n.y + ")", tabindex: 0, role: "button",
        "aria-label": n.label + ", " + n.sub
      });
      g.appendChild(el("circle", { "class": "n-halo", r: r + 14 }));
      g.appendChild(el("circle", { "class": "n-ring", r: r + 7 }));
      if (n.kind === "supervisor" || n.kind === "sub") g.appendChild(el("circle", { "class": "n-orbit", r: r + 4 }));
      g.appendChild(nodeShape(n));
      var glyph = el("text", { "class": "n-glyph", y: 4, "text-anchor": "middle" });
      glyph.textContent = n.glyph;
      g.appendChild(glyph);
      var name = el("text", { "class": "n-name", y: r + 28, "text-anchor": "middle" });
      name.textContent = n.label;
      g.appendChild(name);
      var sub = el("text", { "class": "n-sub", y: r + 44, "text-anchor": "middle" });
      sub.textContent = n.sub;
      g.appendChild(sub);
      var badge = el("text", { "class": "n-badge", y: -r - 14, "text-anchor": "middle" });
      g.appendChild(badge);
      g.addEventListener("click", function () { onSelect(n.id); });
      g.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(n.id); } });
      gNodes.appendChild(g);
      groups[n.id] = { g: g, badge: badge };
    });
    svg.appendChild(gPackets);
    svg.appendChild(gNodes);

    /** Chain of node ids from the root of this node's component down to the node. */
    function chain(id) {
      var out = [];
      var cur = byId[id];
      while (cur) { out.unshift(cur.id); cur = cur.parent ? byId[cur.parent] : null; }
      return out;
    }

    var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function animateAlong(path, reverse, cls, ms) {
      return new Promise(function (resolve) {
        var len = path.getTotalLength();
        var dot = el("circle", { "class": "packet " + cls, r: 5, filter: "url(#glow)" });
        gPackets.appendChild(dot);
        if (reduced) { gPackets.removeChild(dot); resolve(); return; }
        var start = null;
        function frame(ts) {
          if (start === null) start = ts;
          var k = Math.min(1, (ts - start) / ms);
          var e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          var pt = path.getPointAtLength((reverse ? 1 - e : e) * len);
          dot.setAttribute("cx", pt.x);
          dot.setAttribute("cy", pt.y);
          if (k < 1) requestAnimationFrame(frame);
          else { gPackets.removeChild(dot); resolve(); }
        }
        requestAnimationFrame(frame);
      });
    }

    /**
     * Send a packet from the supervisor to `id` (direction "out") or back ("back").
     * @returns {Promise<void>}
     */
    function travel(id, direction, cls) {
      var ids = chain(id).slice(1);
      if (!ids.length) return Promise.resolve();
      var paths = ids.map(function (x) { return edges[x]; }).filter(Boolean);
      if (direction === "back") paths.reverse();
      var per = Math.max(380, 820 / paths.length);
      return paths.reduce(function (p, path) {
        return p.then(function () {
          path.classList.add("edge-hot");
          return animateAlong(path, direction === "back", cls, per).then(function () { path.classList.remove("edge-hot"); });
        });
      }, Promise.resolve());
    }

    /**
     * @param {Object<string, string>} states id → idle|active|waiting|done|offline|denied|unreachable|standby
     * @param {string|null} selected
     */
    function setState(states, selected) {
      var labels = { active: "WORKING", relay: "RELAYING", waiting: "NEEDS YOU", done: "DONE", offline: "OFFLINE", denied: "DENIED", unreachable: "NO PATH · BY DESIGN", rejoining: "REJOINING" };
      scenario.nodes.forEach(function (n) {
        var s = states[n.id] || (n.standby ? "standby" : "idle");
        var grp = groups[n.id];
        grp.g.setAttribute("class", "n n-" + (n.kind || "worker") + " n-" + n.head + " s-" + s + (selected === n.id ? " is-selected" : ""));
        var quiet = (n.kind === "supervisor" && s === "done") || (s === "unreachable" && n.kind !== "sub");
        grp.badge.textContent = quiet ? "" : (labels[s] || "");
        var edge = edges[n.id];
        if (edge) edge.setAttribute("class", "edge e-" + s + (n.standby && s === "standby" ? " edge-standby" : ""));
      });
      scenario.zones.forEach(function (z) {
        var zoneEl = svg.querySelector('[data-zone="' + z.id + '"]');
        var hit = scenario.nodes.some(function (n) { return n.zone === z.id && (states[n.id] === "unreachable" || states[n.id] === "denied"); });
        zoneEl.setAttribute("class", "zone" + (z.gapped ? " zone-gapped" : "") + (hit ? " zone-blocked" : ""));
      });
    }

    /** Sub-supervisors between the root and `id`, which relay the lease and the result. */
    function relaysFor(id) {
      return chain(id).slice(1, -1).filter(function (x) { return byId[x].kind === "sub"; });
    }

    return { setState: setState, travel: travel, relaysFor: relaysFor, byId: byId };
  }

  window.MeshGraph = { mount: mount };
})();
