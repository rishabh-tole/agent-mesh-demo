/*
 * Scenario data for the mesh demo.
 * Every machine, figure and log line here is an illustrative example.
 * None of it describes Boston Engineering systems, programs or data.
 *
 * Node kinds: supervisor (master node), sub (site sub-supervisor), worker.
 * head: "headed" runs the full worker; "headless" is reached through a nearby worker.
 *
 * Each scenario runs three phases: diagnose → fix → test.
 * Step: { node, title, out, lease?, ret (KB returned)?, t (simulated seconds), fail? }
 * fail: { mode: "reroute" | "reconnect", to?, why, via?, always? }
 */
window.MESH_SCENARIOS = [
  {
    id: "uuv",
    chip: "UUV porpoising in depth-hold",
    prompt: "The UUV started porpoising in depth-hold at the dock around 2pm, right after we loaded build 7.3. What happened?",
    keys: ["uuv", "depth", "vehicle", "porpois", "oscillat", "dock", "hold"],
    zones: [
      { id: "hq", label: "WALTHAM LAB", link: "LAN · 10 GbE", x: 24, y: 28, w: 520, h: 548 },
      { id: "field", label: "DOCKSIDE TEST SITE", link: "LTE · ≈2 Mbps", x: 586, y: 28, w: 390, h: 548 }
    ],
    nodes: [
      { id: "sup", kind: "supervisor", head: "headed", glyph: "SUP", label: "Mesh supervisor", sub: "HQ server", x: 150, y: 300, zone: "hq",
        hw: "2U server · 32 cores · 128 GB", caps: ["plan", "route", "policy", "audit"], perms: { read: "metadata only", write: "audit log", actuate: "none" } },
      { id: "repo", head: "headless", glyph: "GIT", label: "Controls repo", sub: "firmware + gains", x: 390, y: 104, parent: "sup", zone: "hq",
        hw: "VM · Gitea", caps: ["git log", "diff", "open PR"], perms: { read: "repo, tags", write: "branches + PRs only", actuate: "none" } },
      { id: "gpu", head: "headed", glyph: "GPU", label: "Analysis workstation", sub: "replay + sim", x: 400, y: 222, parent: "sup", zone: "hq",
        hw: "1× 48 GB GPU · ROS 2 Humble", caps: ["sim replay", "build", "container exec"], perms: { read: "task handles", write: "/scratch", actuate: "none" } },
      { id: "gpu2", head: "headed", glyph: "GPU", label: "Workstation B", sub: "hot spare", x: 400, y: 372, parent: "sup", zone: "hq", standby: true,
        hw: "1× 24 GB GPU · same image", caps: ["sim replay", "build", "container exec"], perms: { read: "task handles", write: "/scratch", actuate: "none" } },
      { id: "nas", head: "headless", glyph: "NAS", label: "Trial archive", sub: "112 past trials", x: 290, y: 486, parent: "sup", zone: "hq",
        hw: "NAS · 180 TB", caps: ["index search", "read"], perms: { read: "trial index", write: "none", actuate: "none" } },
      { id: "dock", kind: "sub", head: "headed", glyph: "SUB", label: "Dock laptop", sub: "sub-supervisor", x: 690, y: 300, parent: "sup", zone: "field",
        hw: "Rugged laptop · 16 GB", caps: ["local route", "summarize", "queue offline"], perms: { read: "site nodes", write: "/relay", actuate: "none" } },
      { id: "uuv", head: "headless", glyph: "UUV", label: "UUV onboard", sub: "Jetson-class · ROS 2", x: 872, y: 168, parent: "dock", zone: "field",
        hw: "Jetson-class SoM · 16 GB", caps: ["rosbag read", "event cut", "stage build", "mission exec"], perms: { read: "run logs", write: "/events, /staging", actuate: "on your click" } },
      { id: "tablet", head: "headed", glyph: "TAB", label: "Dock tech tablet", sub: "checklists", x: 872, y: 436, parent: "dock", zone: "field",
        hw: "Rugged Android tablet", caps: ["notify", "checklist"], perms: { read: "none", write: "this task's report", actuate: "none" } }
    ],
    edgeLabels: { dock: "summaries only" },
    phases: {
      diagnose: {
        steps: [
          { node: "sup", title: "Plan around the 2 Mbps dock link", out: "Cut events on the vehicle, diff the build, replay in sim, check past trials.", t: 2 },
          { node: "uuv", title: "Cut the incident window on the vehicle", lease: "read run-3 logs · write /events · 120 s", out: "3 oscillation bursts, 14:01–14:03. Pitch-rate command saturating each time.", ret: 380, t: 34 },
          { node: "repo", title: "Diff build 7.3 against the last good build", lease: "read tags + diff · 60 s", out: "7.3 retuned the depth PID: Kd cut by 30%.", ret: 6, t: 5 },
          { node: "gpu", title: "Replay the window in simulation", lease: "read 3 event handles · exec sim · 300 s", out: "Reproduces with 7.3 gains plus a 0.6 kt cross-current. 7.2 gains damp it.", ret: 220, t: 96,
            fail: { mode: "reroute", to: "gpu2", why: "Analysis workstation stopped answering heartbeats." } },
          { node: "nas", title: "Search 112 past trials for the same signature", lease: "read trial index · 60 s", out: "2 earlier matches. Both fixed by restoring Kd.", ret: 14, t: 11 }
        ],
        summary: "<b>Root cause:</b> build 7.3 cut depth-loop Kd by 30%. In a cross-current the loop under-damps and the vehicle porpoises. Fix is to restore Kd and keep the rest of 7.3.",
        note: "Opens a branch + PR, builds 7.3.1, stages it next to 7.3 on the vehicle. Nothing merges or flashes."
      },
      fix: {
        steps: [
          { node: "repo", title: "Restore Kd on a new branch", lease: "write branch fix/depth-kd · PR only", out: "Kd back to the 7.2 value. PR opened, nothing merged.", ret: 4, t: 6 },
          { node: "gpu2", title: "Build 7.3.1 and run the sim regression", lease: "exec build + sim · 1 GPU · 10 min", out: "Build OK. 24 / 24 sim cases pass, including the 0.6 kt cross-current.", ret: 60, t: 240 },
          { node: "uuv", title: "Stage 7.3.1 on the vehicle", lease: "write /staging · keep 7.3 · reversible", out: "7.3.1 staged beside 7.3. Rollback is one command.", ret: 2, t: 40 }
        ],
        summary: "<b>Fix ready.</b> Build 7.3.1 passes 24 / 24 sim cases and is staged on the vehicle. Next: prove it in the water.",
        note: "Runs a 5-minute depth hold, 3 m max. This moves the vehicle, so your click is the approval."
      },
      test: {
        steps: [
          { node: "uuv", title: "Run a 5-minute depth hold on 7.3.1", lease: "exec mission hold-5 · ≤ 3 m · ≤ 5 min", out: "Depth error within ±4 cm for the full hold. No saturation.", ret: 42, t: 300 },
          { node: "nas", title: "Compare against the last 10 good runs", lease: "read trial index · 60 s", out: "Inside the normal band on all 4 metrics.", ret: 8, t: 6 },
          { node: "tablet", title: "Send the dock tech a sign-off checklist", lease: "write this task's report", out: "Checklist on the tablet: re-trim ballast, sign off run 4.", ret: 3, t: 2 },
          { node: "sup", title: "Close out and link the evidence", out: "Report filed with every log, diff and sim run linked. All leases ended.", t: 2 }
        ]
      }
    },
    done: "Depth-hold fixed and verified in the water.",
    stayed: "41 GB of logs + sonar never left the vehicle",
    today: "≈ 1–2 engineer-days"
  },
  {
    id: "bench",
    chip: "Bench actuator dead after flash",
    prompt: "The actuator on bench rig 2 stopped responding after this morning's firmware flash. Can you find out why?",
    keys: ["bench", "rig", "actuator", "motor", "flash", "firmware", "can", "respond"],
    zones: [
      { id: "lab", label: "BENCH RIG 2", link: "LAN · USB · CAN", x: 24, y: 28, w: 952, h: 548 }
    ],
    nodes: [
      { id: "sup", kind: "supervisor", head: "headed", glyph: "SUP", label: "Mesh supervisor", sub: "dev workstation", x: 140, y: 300, zone: "lab",
        hw: "Workstation · 16 cores", caps: ["plan", "route", "policy", "audit"], perms: { read: "metadata only", write: "audit log", actuate: "none" } },
      { id: "repo", head: "headless", glyph: "GIT", label: "Firmware repo", sub: "controller firmware", x: 330, y: 110, parent: "sup", zone: "lab",
        hw: "VM · GitLab", caps: ["git log", "diff", "open PR"], perms: { read: "repo", write: "branches + PRs only", actuate: "none" } },
      { id: "you", head: "headed", glyph: "YOU", label: "Your laptop", sub: "gets the report", x: 330, y: 490, parent: "sup", zone: "lab",
        hw: "Laptop", caps: ["notify"], perms: { read: "none", write: "none", actuate: "none" } },
      { id: "rig", kind: "sub", head: "headed", glyph: "RIG", label: "Rig PC", sub: "USB · CAN · SCPI", x: 480, y: 300, parent: "sup", zone: "lab",
        hw: "Mini PC · USB-CAN adapter", caps: ["serial", "CAN", "SCPI", "test profiles"], perms: { read: "serial + CAN", write: "/runs", actuate: "on your click" } },
      { id: "mcu", head: "headless", glyph: "MCU", label: "Motor controller", sub: "ESP32-class · CAN", x: 790, y: 140, parent: "rig", zone: "lab",
        hw: "MCU · 4 MB flash · fw 4.2", caps: ["config read", "config write", "heartbeat"], perms: { read: "config + faults", write: "on your click", actuate: "via rig" } },
      { id: "psu", head: "headless", glyph: "PSU", label: "Bench supply", sub: "SCPI over LAN", x: 830, y: 300, parent: "rig", zone: "lab",
        hw: "Programmable PSU", caps: ["read V/I", "power cycle"], perms: { read: "V/I", write: "none", actuate: "power cycle on your click" } },
      { id: "scope", head: "headless", glyph: "OSC", label: "Oscilloscope", sub: "CAN decode", x: 790, y: 460, parent: "rig", zone: "lab",
        hw: "4-ch scope", caps: ["capture", "protocol decode"], perms: { read: "captures", write: "none", actuate: "none" } }
    ],
    edgeLabels: {},
    phases: {
      diagnose: {
        steps: [
          { node: "sup", title: "Plan: read-only first", out: "Logs, then the controller, then the wire, then the code.", t: 1 },
          { node: "rig", title: "Read the controller's serial log", lease: "read serial since 09:12 · 60 s", out: "CAN timeout at 09:14:03, then the controller rebooted and went quiet.", ret: 12, t: 4 },
          { node: "mcu", title: "Reach the motor controller", lease: "read heartbeat + fault codes · 120 s", out: "Rejoined on its own. Fault code BUS_BITRATE.", ret: 2, t: 9,
            fail: { mode: "reconnect", always: true, why: "Controller missed 3 heartbeats after its reboot." } },
          { node: "scope", title: "Decode the CAN bus on the wire", lease: "exec capture + decode · 60 s", out: "Bus runs at 1 Mbit/s. Controller is sending at 500 kbit/s.", ret: 48, t: 6 },
          { node: "repo", title: "Diff default configs 4.1 → 4.2", lease: "read configs · 60 s", out: "4.2 reset the CAN bitrate default to 500 kbit/s.", ret: 4, t: 3 }
        ],
        summary: "<b>Root cause:</b> firmware 4.2 silently changed the CAN bitrate default to 500 kbit/s. The rest of the bus runs at 1 Mbit/s, so the controller can't talk to anything.",
        note: "Writes one config value to the controller (old config saved first) and opens a PR. Nothing merges."
      },
      fix: {
        steps: [
          { node: "mcu", title: "Snapshot config, set can.bitrate = 1 Mbit/s", lease: "write can.bitrate · snapshot first · reversible", out: "Written. Controller restarted and joined the bus.", ret: 1, t: 8 },
          { node: "psu", title: "Power-cycle the rig to clear latched faults", lease: "power cycle × 1", out: "Clean boot. 0 latched faults.", ret: 1, t: 12 },
          { node: "repo", title: "Fix the default on a branch", lease: "write branch fix/can-default · PR only", out: "PR opened on fix/can-default. Nothing merged.", ret: 5, t: 3 }
        ],
        summary: "<b>Controller is back on the bus</b> and the bad default is fixed in a PR. Next: prove the actuator moves in spec.",
        note: "Drives the motor through the standard 2-minute step profile with an 8 A hard stop."
      },
      test: {
        steps: [
          { node: "rig", title: "Run step-response profile step-10", lease: "exec profile step-10 · 8 A hard stop", out: "Overshoot 6%, settling 0.31 s. In spec.", ret: 30, t: 120 },
          { node: "scope", title: "Check bus errors under load", lease: "exec capture · 60 s", out: "0 error frames across the run.", ret: 20, t: 4 },
          { node: "you", title: "Send you the report", out: "Report + PR link sent. Rig 2 is back in service.", ret: 5, t: 2 }
        ]
      }
    },
    done: "Rig 2 actuator back in spec.",
    stayed: "Serial logs + scope captures never left the rig PC",
    today: "≈ ½ day at the bench"
  },
  {
    id: "iiot",
    chip: "Pressure faults on 3 field units",
    prompt: "Three units at a customer site have been throwing the same low-pressure fault since this morning. What's going on?",
    keys: ["unit", "pressure", "fault", "customer", "site", "iiot", "field", "fleet"],
    zones: [
      { id: "hq", label: "HQ NETWORK", link: "LAN", x: 24, y: 28, w: 410, h: 548 },
      { id: "site", label: "CUSTOMER SITE", link: "gateway-only egress", x: 476, y: 28, w: 500, h: 548 }
    ],
    nodes: [
      { id: "sup", kind: "supervisor", head: "headed", glyph: "SUP", label: "Mesh supervisor", sub: "HQ server", x: 130, y: 300, zone: "hq",
        hw: "2U server", caps: ["plan", "route", "policy", "audit"], perms: { read: "metadata only", write: "audit log", actuate: "none" } },
      { id: "iiot", head: "headless", glyph: "IOT", label: "IIoT platform", sub: "fleet telemetry", x: 310, y: 140, parent: "sup", zone: "hq",
        hw: "App server · ThingWorx-class", caps: ["telemetry query", "alerts", "work orders"], perms: { read: "this customer's units", write: "work orders", actuate: "none" } },
      { id: "plm", head: "headless", glyph: "PLM", label: "PLM + service docs", sub: "manuals · bulletins", x: 310, y: 460, parent: "sup", zone: "hq",
        hw: "App server", caps: ["doc search", "BOM lookup"], perms: { read: "released docs", write: "none", actuate: "none" } },
      { id: "gw", kind: "sub", head: "headed", glyph: "GW", label: "Site gateway", sub: "sub-supervisor", x: 600, y: 300, parent: "sup", zone: "site",
        hw: "Fanless IPC · 8 GB", caps: ["local route", "ring buffer", "small local model"], perms: { read: "site units", write: "/relay", actuate: "none" } },
      { id: "u1", head: "headless", glyph: "U01", label: "Unit 01", sub: "PLC · Modbus", x: 840, y: 120, parent: "gw", zone: "site",
        hw: "PLC", caps: ["register read"], perms: { read: "fault + pressure", write: "none", actuate: "none" } },
      { id: "u2", head: "headless", glyph: "U02", label: "Unit 02", sub: "PLC · Modbus", x: 880, y: 250, parent: "gw", zone: "site",
        hw: "PLC", caps: ["register read"], perms: { read: "fault + pressure", write: "none", actuate: "none" } },
      { id: "u3", head: "headless", glyph: "U03", label: "Unit 03", sub: "PLC · Modbus", x: 840, y: 380, parent: "gw", zone: "site",
        hw: "PLC", caps: ["register read"], perms: { read: "fault + pressure", write: "none", actuate: "none" } },
      { id: "ar", head: "headed", glyph: "AR", label: "Tech AR headset", sub: "guided steps", x: 680, y: 500, parent: "gw", zone: "site",
        hw: "AR headset", caps: ["overlay steps", "confirm step"], perms: { read: "none", write: "this procedure", actuate: "none" } }
    ],
    edgeLabels: { gw: "results only" },
    phases: {
      diagnose: {
        steps: [
          { node: "sup", title: "Plan the triage", out: "Fleet trend at HQ, fault windows on site, then the service docs.", t: 2 },
          { node: "iiot", title: "Pull 48 h of fleet telemetry", lease: "read 3 units · 48 h · 60 s", out: "Faults began 06:10 on all 3 units, each time inlet temp passed 41 °C.", ret: 18, t: 6 },
          { node: "u1", title: "Read Unit 01's fault window", lease: "read fault + pressure regs · 30 s", out: "Pressure sags 11% for 4 s before the trip.", ret: 2, t: 3 },
          { node: "u2", title: "Read Unit 02's fault window", lease: "read fault + pressure regs · 30 s", out: "Same 4 s sag, 12%.", ret: 2, t: 3,
            fail: { mode: "reroute", to: "gw", why: "Unit 02 stopped answering Modbus.", via: "Reading the same window from the gateway's ring buffer." } },
          { node: "plm", title: "Search bulletins for this pump", lease: "read released docs · 60 s", out: "SB-114: inlet check valve sticks above 40 °C.", ret: 26, t: 5 }
        ],
        summary: "<b>Root cause:</b> inlet check valve sticking in the heat (bulletin SB-114). Same signature on all three units. It's a 6-step valve swap the tech on site can do.",
        note: "Sends the SB-114 procedure to the field tech's AR headset and opens work orders."
      },
      fix: {
        steps: [
          { node: "plm", title: "Pull the procedure and part number", lease: "read SB-114 + BOM", out: "6-step procedure + P/N 4471-C ready.", ret: 12, t: 3 },
          { node: "ar", title: "Guide the tech through the swap on Unit 01", lease: "write SB-114 to this headset · 20 min", out: "Tech confirmed all 6 steps.", ret: 4, t: 900 },
          { node: "iiot", title: "Open work orders for Units 02 + 03", lease: "write 2 work orders", out: "Work orders opened with the part number attached.", ret: 3, t: 3 }
        ],
        summary: "<b>Unit 01 valve swapped.</b> Units 02 and 03 have work orders. Next: confirm Unit 01 holds pressure in the heat.",
        note: "Read-only. Watches Unit 01 under load for 10 minutes."
      },
      test: {
        steps: [
          { node: "u1", title: "Watch Unit 01 pressure under load", lease: "read pressure regs · 10 min", out: "Steady at nominal through a 42 °C inlet.", ret: 6, t: 600 },
          { node: "iiot", title: "Compare with healthy units", lease: "read fleet baseline", out: "Unit 01 now matches the healthy fleet.", ret: 8, t: 4 },
          { node: "sup", title: "File the service record", out: "Cause, fix and evidence filed. Nobody had to call HQ.", t: 2 }
        ]
      }
    },
    done: "Unit 01 fixed and holding pressure. 02 + 03 queued.",
    stayed: "Customer telemetry never left the site",
    today: "≈ 1 day + a call to HQ"
  }
];
