/*
 * Scenario data for the mesh demo.
 * Every machine, figure and log line here is an illustrative example.
 *
 * Node kinds: supervisor (master node), sub (site sub-supervisor), worker.
 * head: "headed" runs the full worker; "headless" is reached through a nearby worker.
 * A node with no parent (other than the supervisor) roots its own group that is not on the mesh.
 * Zones: deploy marks a deployment-side site; gapped marks a site with no connection to the mesh.
 *
 * Each scenario runs three phases: diagnose → fix → test.
 * Step: { node, title, out, lease?, ret (KB returned)?, t (simulated seconds), fail?, unreachable?, revive? }
 * fail: { mode: "reroute" | "reconnect", to?, why, via? }
 */
window.MESH_SCENARIOS = [
  {
    id: "uuv",
    chip: "Underwater robot wobbling at the dock",
    prompt: "Our underwater robot started bobbing up and down at the dock around 2pm, right after we loaded software build 7.3. What happened?",
    keys: ["uuv", "underwater", "depth", "vehicle", "bob", "wobbl", "porpois", "oscillat", "dock"],
    zones: [
      { id: "hq", label: "HQ LAB", link: "office network", x: 24, y: 28, w: 456, h: 548 },
      { id: "field", label: "DOCKSIDE TEST SITE", link: "slow 4G link", x: 504, y: 28, w: 472, h: 320, deploy: true },
      { id: "enclave", label: "SECURE PROGRAM LAB", link: "air-gapped · not on mesh", x: 504, y: 372, w: 472, h: 204, gapped: true }
    ],
    nodes: [
      { id: "sup", kind: "supervisor", head: "headed", glyph: "SUP", label: "Mesh supervisor", sub: "plans the work", x: 250, y: 300, zone: "hq",
        hw: "2U server · 32 cores · 128 GB", caps: ["plan", "route", "policy", "audit"], perms: { read: "metadata only", write: "audit log", actuate: "none" } },
      { id: "repo", head: "headless", glyph: "GIT", label: "Code repo", sub: "robot software", x: 95, y: 115, parent: "sup", zone: "hq",
        hw: "VM · Gitea", caps: ["git log", "diff", "open PR"], perms: { read: "repo, tags", write: "branches + PRs only", actuate: "none" } },
      { id: "gpu", head: "headed", glyph: "GPU", label: "GPU workstation", sub: "simulation", x: 265, y: 110, parent: "sup", zone: "hq",
        hw: "1× 48 GB GPU", caps: ["sim replay", "build", "container exec"], perms: { read: "task handles", write: "/scratch", actuate: "none" } },
      { id: "gpu2", head: "headed", glyph: "GPU", label: "Workstation B", sub: "hot spare", x: 400, y: 125, parent: "sup", zone: "hq", standby: true,
        hw: "1× 24 GB GPU · same image", caps: ["sim replay", "build", "container exec"], perms: { read: "task handles", write: "/scratch", actuate: "none" } },
      { id: "ci", head: "headless", glyph: "CI", label: "Build server", sub: "signs releases", x: 95, y: 330, parent: "sup", zone: "hq",
        hw: "VM · 16 cores", caps: ["build", "sign", "checksum"], perms: { read: "repo", write: "release artifacts", actuate: "none" } },
      { id: "you", head: "headed", glyph: "YOU", label: "Your laptop", sub: "gets the report", x: 105, y: 495, parent: "sup", zone: "hq",
        hw: "Laptop", caps: ["notify"], perms: { read: "none", write: "none", actuate: "none" } },
      { id: "nas", head: "headless", glyph: "NAS", label: "Log archive", sub: "112 past tests", x: 330, y: 470, parent: "sup", zone: "hq",
        hw: "NAS · 180 TB", caps: ["index search", "read"], perms: { read: "test index", write: "none", actuate: "none" } },
      { id: "dock", kind: "sub", head: "headed", glyph: "SUB", label: "Dock laptop", sub: "site supervisor", x: 610, y: 195, parent: "sup", zone: "field",
        hw: "Rugged laptop · 16 GB", caps: ["local route", "summarize", "queue offline"], perms: { read: "site machines", write: "/relay", actuate: "none" } },
      { id: "uuv", head: "headless", glyph: "UUV", label: "Robot #1", sub: "onboard computer", x: 790, y: 105, parent: "dock", zone: "field",
        hw: "Jetson-class SoM · 16 GB", caps: ["log read", "event cut", "stage build", "run mission"], perms: { read: "run logs", write: "/events, /staging", actuate: "on your click" } },
      { id: "uuv2", head: "headless", glyph: "UUV", label: "Robot #2", sub: "on the charger", x: 915, y: 205, parent: "dock", zone: "field",
        hw: "Jetson-class SoM · 16 GB", caps: ["log read", "stage build"], perms: { read: "run logs", write: "/staging", actuate: "on your click" } },
      { id: "tablet", head: "headed", glyph: "TAB", label: "Dock tablet", sub: "tech checklist", x: 775, y: 275, parent: "dock", zone: "field",
        hw: "Rugged Android tablet", caps: ["notify", "checklist"], perms: { read: "none", write: "this task's report", actuate: "none" } },
      { id: "esup", kind: "sub", head: "headed", glyph: "SUB", label: "Lab supervisor", sub: "its own mesh", x: 610, y: 475, zone: "enclave",
        hw: "Server inside the secure lab", caps: ["plan", "route", "local model"], perms: { read: "lab only", write: "lab audit log", actuate: "none" } },
      { id: "erig", head: "headed", glyph: "RIG", label: "Test tank rig", sub: "controlled tests", x: 790, y: 440, parent: "esup", zone: "enclave",
        hw: "Rig PC", caps: ["test logs"], perms: { read: "lab users", write: "none", actuate: "none" } },
      { id: "enas", head: "headless", glyph: "NAS", label: "Program storage", sub: "controlled data", x: 905, y: 505, parent: "esup", zone: "enclave",
        hw: "NAS", caps: ["index search"], perms: { read: "lab users", write: "none", actuate: "none" } }
    ],
    edgeLabels: { dock: "summaries only" },
    phases: {
      diagnose: {
        steps: [
          { node: "sup", title: "Plan around the slow dock link", out: "Do the heavy work on the robot, check what changed, replay it in simulation, compare past tests.", t: 2 },
          { node: "uuv", title: "Find the bad moments on the robot", lease: "read today's logs · 120 s", out: "3 bursts of bobbing, 14:01–14:03. The depth controller was maxing out each time.", ret: 380, t: 34 },
          { node: "repo", title: "Compare build 7.3 with the last good build", lease: "read history · 60 s", out: "7.3 softened the depth controller's damping by 30%.", ret: 6, t: 5 },
          { node: "gpu", title: "Replay the moment in simulation", lease: "read 3 clips · run sim · 300 s", out: "Bobbing reproduces with 7.3 in a light current. The old setting stays steady.", ret: 220, t: 96,
            fail: { mode: "reroute", to: "gpu2", why: "GPU workstation stopped responding." } },
          { node: "nas", title: "Search 112 past tests for the same pattern", lease: "read test index · 60 s", out: "2 earlier matches. Both fixed by restoring the damping.", ret: 14, t: 11 },
          { node: "esup", unreachable: true, title: "Check the secure lab's tank tests", out: "That lab is not on this mesh, by design. A request went to its own team instead.", t: 0 }
        ],
        summary: "<b>Root cause:</b> build 7.3 cut the depth controller's damping by 30%. In a current the robot overshoots and bobs. Fix: put the old damping back and keep the rest of 7.3.",
        note: "Opens a code change for review, builds 7.3.1, stages it on the robot. Nothing merges or installs without you."
      },
      fix: {
        steps: [
          { node: "gpu", revive: true, title: "GPU workstation comes back online", out: "Heartbeat restored. It rejoined the mesh and takes the next job.", t: 4 },
          { node: "repo", title: "Restore the damping on a new branch", lease: "write branch fix/damping · PR only", out: "Old value restored. Change opened for review, nothing merged.", ret: 4, t: 6 },
          { node: "gpu", title: "Build 7.3.1 and rerun every simulation", lease: "build + sim · 1 GPU · 10 min", out: "Build OK. 24 / 24 simulations pass, including the current that caused it.", ret: 60, t: 240 },
          { node: "ci", title: "Sign the 7.3.1 release", lease: "sign + checksum · 60 s", out: "Release signed. Robots will only accept this exact file.", ret: 2, t: 20 },
          { node: "uuv", title: "Stage 7.3.1 on Robot #1", lease: "write /staging · keep 7.3 · reversible", out: "7.3.1 staged next to 7.3. Rollback is one command.", ret: 2, t: 40 }
        ],
        summary: "<b>Fix ready.</b> Build 7.3.1 passes 24 / 24 simulations and is staged on Robot #1. Next: prove it in the water.",
        note: "Runs a 5-minute depth hold, 3 m max. This moves the robot, so your click is the approval."
      },
      test: {
        steps: [
          { node: "uuv", title: "Run a 5-minute depth hold on Robot #1", lease: "run mission hold-5 · ≤ 3 m · ≤ 5 min", out: "Held depth within ±4 cm the whole time. No overshoot.", ret: 42, t: 300 },
          { node: "nas", title: "Compare with the last 10 good runs", lease: "read test index · 60 s", out: "Inside the normal range on all 4 measures.", ret: 8, t: 6 },
          { node: "uuv2", title: "Queue the same check on Robot #2", lease: "write /staging · run after charge", out: "7.3.1 staged. The hold test runs when it's off the charger.", ret: 2, t: 30 },
          { node: "tablet", title: "Send the dock tech a sign-off checklist", lease: "write this task's report", out: "Checklist on the tablet: re-trim weights, sign off run 4.", ret: 3, t: 2 },
          { node: "you", title: "Send you the full report", out: "Every log, change and test linked in one report.", ret: 5, t: 2 },
          { node: "sup", title: "Close out", out: "All access ended. Every action is in the audit log.", t: 2 }
        ]
      }
    },
    done: "Robot fixed and verified in the water.",
    stayed: "41 GB of robot logs and sonar never left the robot",
    today: "≈ 1–2 engineer-days"
  },
  {
    id: "bench",
    chip: "Bench motor dead after an update",
    prompt: "The motor on test bench 2 stopped responding after this morning's firmware update. Can you find out why?",
    keys: ["bench", "rig", "actuator", "motor", "flash", "firmware", "update", "respond"],
    zones: [
      { id: "office", label: "OFFICE", link: "LAN", x: 24, y: 28, w: 300, h: 548 },
      { id: "rig2", label: "TEST BENCH 2", link: "USB · CAN · LAN", x: 348, y: 28, w: 628, h: 330, deploy: true },
      { id: "rig1", label: "TEST BENCH 1", link: "fw 4.1", x: 348, y: 382, w: 300, h: 194, deploy: true },
      { id: "loaner", label: "LOANER UNIT", link: "not on mesh", x: 672, y: 382, w: 304, h: 194, gapped: true }
    ],
    nodes: [
      { id: "sup", kind: "supervisor", head: "headed", glyph: "SUP", label: "Mesh supervisor", sub: "plans the work", x: 175, y: 300, zone: "office",
        hw: "Workstation · 16 cores", caps: ["plan", "route", "policy", "audit"], perms: { read: "metadata only", write: "audit log", actuate: "none" } },
      { id: "repo", head: "headless", glyph: "GIT", label: "Firmware repo", sub: "controller code", x: 95, y: 115, parent: "sup", zone: "office",
        hw: "VM · GitLab", caps: ["git log", "diff", "open PR"], perms: { read: "repo", write: "branches + PRs only", actuate: "none" } },
      { id: "docs", head: "headless", glyph: "DOC", label: "Datasheets", sub: "wiki + PDFs", x: 250, y: 115, parent: "sup", zone: "office",
        hw: "File share", caps: ["doc search"], perms: { read: "engineering docs", write: "none", actuate: "none" } },
      { id: "ci", head: "headless", glyph: "CI", label: "CI runner", sub: "builds firmware", x: 255, y: 495, parent: "sup", zone: "office",
        hw: "VM · 8 cores", caps: ["build", "unit tests"], perms: { read: "repo", write: "build artifacts", actuate: "none" } },
      { id: "you", head: "headed", glyph: "YOU", label: "Your laptop", sub: "gets the report", x: 95, y: 495, parent: "sup", zone: "office",
        hw: "Laptop", caps: ["notify"], perms: { read: "none", write: "none", actuate: "none" } },
      { id: "rig", kind: "sub", head: "headed", glyph: "RIG", label: "Bench 2 PC", sub: "site supervisor", x: 480, y: 200, parent: "sup", zone: "rig2",
        hw: "Mini PC · USB-CAN adapter", caps: ["serial", "CAN", "SCPI", "test profiles"], perms: { read: "serial + CAN", write: "/runs", actuate: "on your click" } },
      { id: "mcu", head: "headless", glyph: "MCU", label: "Motor controller", sub: "firmware 4.2", x: 570, y: 90, parent: "rig", zone: "rig2",
        hw: "MCU · 4 MB flash", caps: ["config read", "config write", "heartbeat"], perms: { read: "config + faults", write: "on your click", actuate: "via bench PC" } },
      { id: "cam", head: "headless", glyph: "CAM", label: "Bench camera", sub: "watches the motor", x: 760, y: 90, parent: "rig", zone: "rig2",
        hw: "USB camera", caps: ["record", "clip"], perms: { read: "video", write: "none", actuate: "none" } },
      { id: "psu", head: "headless", glyph: "PSU", label: "Power supply", sub: "remote control", x: 880, y: 150, parent: "rig", zone: "rig2",
        hw: "Programmable PSU", caps: ["read V/I", "power cycle"], perms: { read: "V/I", write: "none", actuate: "power cycle on your click" } },
      { id: "scope", head: "headless", glyph: "OSC", label: "Oscilloscope", sub: "reads the wire", x: 690, y: 280, parent: "rig", zone: "rig2",
        hw: "4-ch scope", caps: ["capture", "protocol decode"], perms: { read: "captures", write: "none", actuate: "none" } },
      { id: "r1", kind: "sub", head: "headed", glyph: "RIG", label: "Bench 1 PC", sub: "site supervisor", x: 430, y: 475, parent: "sup", zone: "rig1",
        hw: "Mini PC", caps: ["serial", "CAN", "test profiles"], perms: { read: "serial + CAN", write: "/runs", actuate: "on your click" } },
      { id: "r1mcu", head: "headless", glyph: "MCU", label: "Controller", sub: "firmware 4.1", x: 575, y: 465, parent: "r1", zone: "rig1",
        hw: "MCU · 4 MB flash", caps: ["config read", "heartbeat"], perms: { read: "config + faults", write: "none", actuate: "via bench PC" } },
      { id: "lpc", kind: "sub", head: "headed", glyph: "PC", label: "Loaner PC", sub: "no connection", x: 760, y: 470, zone: "loaner",
        hw: "Mini PC at a customer site", caps: ["serial"], perms: { read: "local only", write: "local only", actuate: "local only" } },
      { id: "lmcu", head: "headless", glyph: "MCU", label: "Controller", sub: "firmware 4.2", x: 900, y: 470, parent: "lpc", zone: "loaner",
        hw: "MCU · 4 MB flash", caps: ["config read"], perms: { read: "local only", write: "local only", actuate: "local only" } }
    ],
    edgeLabels: {},
    phases: {
      diagnose: {
        steps: [
          { node: "sup", title: "Plan: look before touching anything", out: "Logs first, then the controller, then the wire, then the code.", t: 1 },
          { node: "rig", title: "Read the controller's log", lease: "read serial log since 09:12 · 60 s", out: "Lost contact at 09:14:03. The controller restarted and went quiet.", ret: 12, t: 4 },
          { node: "mcu", title: "Reach the motor controller", lease: "read heartbeat + faults · 120 s", out: "Back on the mesh. Fault code: wrong bus speed.", ret: 2, t: 9,
            fail: { mode: "reconnect", why: "Controller stopped answering after its restart." } },
          { node: "scope", title: "Read the signal on the wire", lease: "capture + decode · 60 s", out: "The bench talks at 1 Mbit/s. The controller is talking at 500 kbit/s.", ret: 48, t: 6 },
          { node: "docs", title: "Check the datasheet", lease: "read docs · 30 s", out: "This bench needs 1 Mbit/s.", ret: 3, t: 2 },
          { node: "repo", title: "Find what changed in firmware 4.2", lease: "read history · 60 s", out: "4.2 quietly reset the default bus speed to 500 kbit/s.", ret: 4, t: 3 },
          { node: "r1mcu", title: "Compare with Bench 1", lease: "read config · 30 s", out: "Bench 1 is still on 4.1 and running fine. Confirms the 4.2 change.", ret: 2, t: 3 },
          { node: "lpc", unreachable: true, title: "Check the loaner unit at a customer", out: "Not on the mesh, so nothing was sent. Flagged: it runs 4.2 and needs the same fix by hand.", t: 0 }
        ],
        summary: "<b>Root cause:</b> firmware 4.2 changed the default bus speed. Everything else on the bench runs at 1 Mbit/s, so the controller can't talk to anything.",
        note: "Writes one setting on the controller (old settings saved first) and opens a code change. Nothing merges."
      },
      fix: {
        steps: [
          { node: "mcu", title: "Save settings, then set bus speed to 1 Mbit/s", lease: "write bus speed · backup first · reversible", out: "Written. Controller restarted and is talking again.", ret: 1, t: 8 },
          { node: "psu", title: "Power-cycle the bench to clear old faults", lease: "power cycle × 1", out: "Clean start. 0 stuck faults.", ret: 1, t: 12 },
          { node: "repo", title: "Fix the default in the code", lease: "write branch fix/bus-speed · PR only", out: "Change opened for review. Nothing merged.", ret: 5, t: 3 },
          { node: "ci", title: "Build firmware 4.2.1", lease: "build + unit tests · 5 min", out: "4.2.1 built. All unit tests pass.", ret: 6, t: 180 }
        ],
        summary: "<b>The controller is talking again</b> and the bad default is fixed in code. Next: prove the motor moves the way it should.",
        note: "Drives the motor through the standard 2-minute test with a hard current limit."
      },
      test: {
        steps: [
          { node: "rig", title: "Run the standard motor test", lease: "run test step-10 · 8 A hard stop", out: "Moves smoothly. Overshoot 6%, settles in 0.31 s. In spec.", ret: 30, t: 120 },
          { node: "cam", title: "Record the run on camera", lease: "record 2 min", out: "Video attached to the report.", ret: 40, t: 2 },
          { node: "scope", title: "Watch the wire during the test", lease: "capture · 60 s", out: "0 errors across the run.", ret: 20, t: 4 },
          { node: "r1mcu", title: "Make sure Bench 1 is untouched", lease: "read config · 30 s", out: "Bench 1 unchanged and healthy.", ret: 2, t: 3 },
          { node: "you", title: "Send you the report", out: "Report, video and code change link sent. Bench 2 is back in use.", ret: 5, t: 2 }
        ]
      }
    },
    done: "Bench 2 motor back in spec.",
    stayed: "Logs, captures and video never left the bench PCs",
    today: "≈ ½ day at the bench"
  },
  {
    id: "iiot",
    chip: "Same fault on machines at 3 sites",
    prompt: "Machines at a customer site have been throwing the same low-pressure fault since this morning. What's going on?",
    keys: ["unit", "pressure", "fault", "customer", "site", "iiot", "machine", "fleet", "pump"],
    zones: [
      { id: "hq", label: "HQ", link: "office network", x: 24, y: 28, w: 376, h: 548 },
      { id: "siteA", label: "SITE A", link: "one gateway out", x: 424, y: 28, w: 552, h: 345, deploy: true },
      { id: "siteB", label: "SITE B", link: "gateway", x: 424, y: 397, w: 266, h: 179, deploy: true },
      { id: "siteC", label: "SITE C", link: "not on mesh", x: 714, y: 397, w: 262, h: 179, gapped: true }
    ],
    nodes: [
      { id: "sup", kind: "supervisor", head: "headed", glyph: "SUP", label: "Mesh supervisor", sub: "plans the work", x: 210, y: 300, zone: "hq",
        hw: "2U server", caps: ["plan", "route", "policy", "audit"], perms: { read: "metadata only", write: "audit log", actuate: "none" } },
      { id: "iiot", head: "headless", glyph: "IOT", label: "IoT platform", sub: "fleet history", x: 90, y: 115, parent: "sup", zone: "hq",
        hw: "App server", caps: ["telemetry query", "alerts"], perms: { read: "this customer's machines", write: "none", actuate: "none" } },
      { id: "plm", head: "headless", glyph: "DOC", label: "Service manuals", sub: "repair guides", x: 290, y: 115, parent: "sup", zone: "hq",
        hw: "App server", caps: ["doc search", "parts lookup"], perms: { read: "released docs", write: "none", actuate: "none" } },
      { id: "wo", head: "headless", glyph: "WO", label: "Work orders", sub: "field jobs", x: 90, y: 495, parent: "sup", zone: "hq",
        hw: "App server", caps: ["create job", "assign"], perms: { read: "jobs", write: "new jobs", actuate: "none" } },
      { id: "desk", head: "headed", glyph: "HD", label: "Support desk", sub: "customer tickets", x: 300, y: 495, parent: "sup", zone: "hq",
        hw: "Desktop", caps: ["tickets", "notify"], perms: { read: "tickets", write: "ticket notes", actuate: "none" } },
      { id: "gw", kind: "sub", head: "headed", glyph: "GW", label: "Site A gateway", sub: "site supervisor", x: 540, y: 180, parent: "sup", zone: "siteA",
        hw: "Fanless PC · 8 GB", caps: ["local route", "10-min buffer", "small local model"], perms: { read: "site machines", write: "/relay", actuate: "none" } },
      { id: "u1", head: "headless", glyph: "U01", label: "Machine 01", sub: "pump unit", x: 690, y: 105, parent: "gw", zone: "siteA",
        hw: "PLC", caps: ["register read"], perms: { read: "fault + pressure", write: "none", actuate: "none" } },
      { id: "u2", head: "headless", glyph: "U02", label: "Machine 02", sub: "pump unit", x: 850, y: 110, parent: "gw", zone: "siteA",
        hw: "PLC", caps: ["register read"], perms: { read: "fault + pressure", write: "none", actuate: "none" } },
      { id: "u3", head: "headless", glyph: "U03", label: "Machine 03", sub: "pump unit", x: 905, y: 225, parent: "gw", zone: "siteA",
        hw: "PLC", caps: ["register read"], perms: { read: "fault + pressure", write: "none", actuate: "none" } },
      { id: "u4", head: "headless", glyph: "U04", label: "Machine 04", sub: "pump unit", x: 745, y: 290, parent: "gw", zone: "siteA",
        hw: "PLC", caps: ["register read"], perms: { read: "fault + pressure", write: "none", actuate: "none" } },
      { id: "ar", head: "headed", glyph: "AR", label: "Tech headset", sub: "step-by-step guide", x: 580, y: 300, parent: "gw", zone: "siteA",
        hw: "AR headset", caps: ["show steps", "confirm step"], perms: { read: "none", write: "this procedure", actuate: "none" } },
      { id: "gwB", kind: "sub", head: "headed", glyph: "GW", label: "Site B gateway", sub: "site supervisor", x: 510, y: 480, parent: "sup", zone: "siteB",
        hw: "Fanless PC · 8 GB", caps: ["local route", "10-min buffer"], perms: { read: "site machines", write: "/relay", actuate: "none" } },
      { id: "u5", head: "headless", glyph: "U05", label: "Machine 05", sub: "pump unit", x: 635, y: 470, parent: "gwB", zone: "siteB",
        hw: "PLC", caps: ["register read"], perms: { read: "fault + pressure", write: "none", actuate: "none" } },
      { id: "u7", kind: "sub", head: "headless", glyph: "U07", label: "Machine 07", sub: "no gateway", x: 790, y: 480, zone: "siteC",
        hw: "PLC", caps: ["local screen only"], perms: { read: "local only", write: "local only", actuate: "local only" } },
      { id: "hmi", head: "headed", glyph: "HMI", label: "Local screen", sub: "on the machine", x: 910, y: 475, parent: "u7", zone: "siteC",
        hw: "Panel PC", caps: ["display"], perms: { read: "local only", write: "local only", actuate: "local only" } }
    ],
    edgeLabels: { gw: "results only", gwB: "results only" },
    phases: {
      diagnose: {
        steps: [
          { node: "sup", title: "Plan the triage", out: "History at HQ, the fault moments on site, compare with a healthy site, then the manuals.", t: 2 },
          { node: "iiot", title: "Pull 48 hours of fleet history", lease: "read 6 machines · 48 h · 60 s", out: "Faults began at 06:10 on Site A, each time the intake passed 41 °C.", ret: 18, t: 6 },
          { node: "u1", title: "Read Machine 01's fault moment", lease: "read fault + pressure · 30 s", out: "Pressure drops 11% for 4 seconds before each trip.", ret: 2, t: 3 },
          { node: "u2", title: "Read Machine 02's fault moment", lease: "read fault + pressure · 30 s", out: "Same 4-second drop, 12%.", ret: 2, t: 3,
            fail: { mode: "reroute", to: "gw", why: "Machine 02 stopped answering.", via: "Reading the same moment from the gateway's 10-minute buffer instead." } },
          { node: "u3", title: "Read Machine 03's fault moment", lease: "read fault + pressure · 30 s", out: "Same pattern again.", ret: 2, t: 3 },
          { node: "u5", title: "Compare with Machine 05 at Site B", lease: "read fault + pressure · 30 s", out: "Same model, no faults. Its intake stays at 34 °C. Points to heat.", ret: 2, t: 3 },
          { node: "plm", title: "Search the repair guides for this pump", lease: "read released docs · 60 s", out: "Known issue: an intake valve sticks above 40 °C. 6-step swap.", ret: 26, t: 5 },
          { node: "u7", unreachable: true, title: "Check Machine 07 at Site C", out: "Site C has no gateway yet, so nothing was sent. Flagged for the next tech visit.", t: 0 }
        ],
        summary: "<b>Root cause:</b> an intake valve sticks in the heat (a known issue in the repair guide). Same pattern on every Site A machine. It's a 6-step part swap the tech on site can do.",
        note: "Sends the repair steps to the technician's headset and opens jobs for the other machines."
      },
      fix: {
        steps: [
          { node: "u2", revive: true, title: "Machine 02 comes back online", out: "Answering again. Rejoined the mesh through the gateway.", t: 4 },
          { node: "plm", title: "Pull the repair steps and part number", lease: "read repair guide + parts", out: "6 steps and part 4471-C ready.", ret: 12, t: 3 },
          { node: "ar", title: "Guide the tech through the swap on Machine 01", lease: "show steps on this headset · 20 min", out: "Tech confirmed all 6 steps.", ret: 4, t: 900 },
          { node: "wo", title: "Open jobs for Machines 02, 03 and 04", lease: "create 3 jobs", out: "3 jobs opened with the part number attached.", ret: 3, t: 3 }
        ],
        summary: "<b>Machine 01 repaired.</b> Machines 02–04 have jobs. Next: confirm Machine 01 holds pressure in the heat.",
        note: "Read-only. Watches Machine 01 under load for 10 minutes."
      },
      test: {
        steps: [
          { node: "u1", title: "Watch Machine 01 under load", lease: "read pressure · 10 min", out: "Pressure steady through a 42 °C intake.", ret: 6, t: 600 },
          { node: "iiot", title: "Compare with healthy machines", lease: "read fleet baseline", out: "Machine 01 now matches Site B's healthy machines.", ret: 8, t: 4 },
          { node: "desk", title: "Update the customer ticket", lease: "write ticket notes", out: "Ticket updated with cause, fix and proof.", ret: 2, t: 2 },
          { node: "sup", title: "File the service record", out: "Cause, fix and evidence filed. Nobody had to call HQ.", t: 2 }
        ]
      }
    },
    done: "Machine 01 fixed and holding pressure. 02–04 queued.",
    stayed: "Customer machine data never left their sites",
    today: "≈ 1 day + a call to HQ"
  }
];
