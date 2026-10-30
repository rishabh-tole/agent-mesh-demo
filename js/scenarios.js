/*
 * Scenario data for the mesh console.
 * Every machine, figure and log line here is an illustrative example for discussion.
 * None of it describes Boston Engineering systems, programs or data.
 *
 * Node kinds: supervisor (master node), sub (site sub-supervisor), worker.
 * head: "headed" runs the full worker; "headless" is reached through a nearby worker or a thin agent.
 */
window.MESH_SCENARIOS = [
  {
    id: "uuv",
    tab: "UUV field incident",
    tag: "Field robotics",
    prompt: "Dockside trial, run 3: the vehicle oscillated in depth-hold around 14:02. What happened, and what should the tech on the dock check before we call it a day?",
    zones: [
      { id: "hq", label: "WALTHAM LAB NETWORK", link: "LAN · 10 GbE", x: 24, y: 28, w: 520, h: 548 },
      { id: "field", label: "DOCKSIDE TEST SITE", link: "LTE · ≈2 Mbps", x: 586, y: 28, w: 390, h: 548 }
    ],
    nodes: [
      { id: "sup", kind: "supervisor", head: "headed", glyph: "SUP", label: "Mesh supervisor", sub: "HQ server · master node", x: 150, y: 300, zone: "hq",
        hw: "2U server · 32 cores · 128 GB", os: "Ubuntu 24.04", caps: ["plan", "route", "policy", "audit"], perms: { read: "metadata only", write: "audit log", exec: "none", actuate: "none" }, data: "Capability graph + audit log. No raw data." },
      { id: "repo", head: "headless", glyph: "GIT", label: "Controls repo", sub: "firmware + gain tables", x: 390, y: 104, parent: "sup", zone: "hq",
        hw: "VM", os: "Gitea", caps: ["git log", "diff"], perms: { read: "repo, tags", write: "none", exec: "none", actuate: "none" }, data: "Controller source, gain tables" },
      { id: "gpu", head: "headed", glyph: "GPU", label: "Analysis workstation", sub: "replay + sim", x: 400, y: 222, parent: "sup", zone: "hq",
        hw: "1× 48 GB GPU · 24 cores", os: "Ubuntu 22.04 · ROS 2 Humble", caps: ["sim replay", "python sandbox", "container exec"], perms: { read: "task handles", write: "/scratch", exec: "approved containers", actuate: "none" }, data: "Hydrodynamic model, sim images" },
      { id: "gpu2", head: "headed", glyph: "GPU", label: "Workstation B", sub: "standby · same image", x: 400, y: 372, parent: "sup", zone: "hq", standby: true,
        hw: "1× 24 GB GPU", os: "Ubuntu 22.04 · ROS 2 Humble", caps: ["sim replay", "python sandbox"], perms: { read: "task handles", write: "/scratch", exec: "approved containers", actuate: "none" }, data: "Mirror of sim images" },
      { id: "nas", head: "headless", glyph: "NAS", label: "Trial archive", sub: "112 past trials", x: 290, y: 486, parent: "sup", zone: "hq",
        hw: "NAS · 180 TB", os: "TrueNAS", caps: ["index search", "read"], perms: { read: "trial index", write: "none", exec: "indexer only", actuate: "none" }, data: "≈ 9 TB of trial logs + sonar" },
      { id: "dock", kind: "sub", head: "headed", glyph: "SUB", label: "Dock sub-supervisor", sub: "rugged laptop · relays", x: 690, y: 300, parent: "sup", zone: "field",
        hw: "Rugged laptop · 16 GB", os: "Ubuntu 22.04", caps: ["local route", "summarize", "queue when offline"], perms: { read: "site nodes", write: "/relay", exec: "local model", actuate: "none" }, data: "Store-and-forward queue" },
      { id: "uuv", head: "headless", glyph: "UUV", label: "UUV onboard computer", sub: "Jetson-class · ROS 2", x: 872, y: 168, parent: "dock", zone: "field",
        hw: "Jetson-class SoM · 16 GB", os: "L4T · ROS 2", caps: ["rosbag read", "event cut", "small local model", "mission exec"], perms: { read: "run-3 logs", write: "/events", exec: "approved missions", actuate: "approval required" }, data: "41 GB from this run: nav, IMU, depth @200 Hz, sonar, camera" },
      { id: "tablet", head: "headed", glyph: "TAB", label: "Dock tech tablet", sub: "first-look guide", x: 872, y: 436, parent: "dock", zone: "field",
        hw: "Rugged tablet", os: "Android", caps: ["notify", "checklist"], perms: { read: "none", write: "this task's report", exec: "none", actuate: "none" }, data: "None" }
    ],
    edgeLabels: { dock: "summaries only" },
    steps: [
      { node: "sup", title: "Plan around the thin link", detail: "The dock link is about 2 Mbps. Work goes to the vehicle first; only summaries cross the link.", out: "Plan: cut events on the vehicle, check what changed, replay on a GPU, compare the archive.", t: 2 },
      { node: "uuv", title: "Cut the incident window on the vehicle", detail: "A worker on the onboard computer reads run 3, finds where depth error passed the limit, and summarizes with a small local model.", lease: { scopes: ["read: run-3 logs", "write: /events (new)", "net: dock only"], ttl: "120 s" }, out: "3 oscillation bursts, 14:01:48 to 14:03:10. Pitch-rate command saturating each time.", ret: 380, raw: "41 GB", t: 34 },
      { node: "repo", title: "Check what changed since the last good run", detail: "Reads tags and diffs between the last clean trial and today's build.", lease: { scopes: ["read: repo tags + diff", "write: none"], ttl: "60 s" }, out: "Build 7.3 retuned depth-PID gains (Kd −30%) and loaded ballast table v12.", ret: 6, t: 5 },
      { node: "gpu", title: "Replay the window in simulation", detail: "Feeds the 3 event windows through the hydrodynamic model with old and new gains.", lease: { scopes: ["read: 3 event handles", "exec: sim container", "gpu: 1 × 48 GB"], ttl: "300 s" }, out: "Oscillation reproduces with new gains plus a 0.6 kt cross-current. Old gains damp it.", ret: 220, t: 96,
        fail: { mode: "reroute", to: "gpu2", why: "No heartbeat from Analysis workstation for 3 s." } },
      { node: "nas", title: "Search 112 past trials", detail: "Looks for the same signature across the archive without moving it.", lease: { scopes: ["read: trial index", "write: none"], ttl: "60 s" }, out: "2 earlier trials match. Both were fixed by restoring Kd.", ret: 14, t: 11 },
      { node: "uuv", title: "Re-run a 5-minute depth hold", detail: "Moves real hardware, so it waits for a person. Previous gains, hard depth and time limits.", lease: { scopes: ["exec: approved mission 'hold-5'", "gains: build 7.2", "limit: 3 m, 5 min"], ttl: "8 min" }, approval: "This moves the vehicle. Run the 5-minute depth hold with build 7.2 gains?", out: "Depth error stayed within ±4 cm for the full hold.", ret: 42, t: 300 },
      { node: "tablet", title: "Send the dock tech a first look", detail: "A short checklist on the tablet, plus a full report for engineering back at HQ.", lease: { scopes: ["write: this task's report"], ttl: "30 s" }, out: "Checklist: keep build 7.2 gains, re-trim ballast, file v12 table for review.", ret: 3, t: 2 },
      { node: "sup", title: "Close the investigation", detail: "Ranks causes, links every piece of evidence, and ends all leases.", out: "Root cause: Kd retune in build 7.3. Raw logs and sonar never left the vehicle or the lab.", t: 2 }
    ],
    today: "≈ 1–2 engineer-days",
    cloud: { amount: "≈ 41 GB", note: "≈ 45 h over a 2 Mbps dock link", needs: ["Upload the full run before anyone can look", "Rebuild the sim pipeline in someone else's cloud", "Clear each upload with the program's data rules"], returned: "≈ 0.7 MB of summaries and handles" }
  },
  {
    id: "bench",
    tab: "Self-healing bench",
    tag: "Dev loop",
    prompt: "The actuator on bench rig 2 stopped responding after this morning's firmware flash. Find out why and get it moving again.",
    zones: [
      { id: "lab", label: "BENCH RIG 2", link: "LAN · USB · CAN", x: 24, y: 28, w: 952, h: 548 }
    ],
    nodes: [
      { id: "sup", kind: "supervisor", head: "headed", glyph: "SUP", label: "Mesh supervisor", sub: "dev workstation · master", x: 140, y: 300, zone: "lab",
        hw: "Workstation · 16 cores", os: "Ubuntu 24.04", caps: ["plan", "route", "policy", "audit"], perms: { read: "metadata only", write: "audit log", exec: "none", actuate: "none" }, data: "Capability graph + audit log" },
      { id: "repo", head: "headless", glyph: "GIT", label: "Firmware repo", sub: "controller firmware", x: 330, y: 110, parent: "sup", zone: "lab",
        hw: "VM", os: "GitLab", caps: ["git log", "open PR"], perms: { read: "repo", write: "branches + PRs only", exec: "none", actuate: "none" }, data: "Firmware source, default configs" },
      { id: "you", head: "headed", glyph: "YOU", label: "Your laptop", sub: "gets the report", x: 330, y: 490, parent: "sup", zone: "lab",
        hw: "Laptop", os: "macOS", caps: ["notify"], perms: { read: "none", write: "none", exec: "none", actuate: "none" }, data: "None" },
      { id: "rig", kind: "sub", head: "headed", glyph: "RIG", label: "Rig PC", sub: "bridges USB · CAN · SCPI", x: 480, y: 300, parent: "sup", zone: "lab",
        hw: "Mini PC · USB-CAN adapter", os: "Ubuntu 22.04", caps: ["serial", "CAN", "SCPI", "test profiles"], perms: { read: "serial + CAN", write: "/runs", exec: "approved test profiles", actuate: "approval required" }, data: "Bench run logs" },
      { id: "mcu", head: "headless", glyph: "MCU", label: "Motor controller", sub: "ESP32-class · CAN", x: 790, y: 140, parent: "rig", zone: "lab",
        hw: "MCU · 4 MB flash", os: "Firmware 4.2", caps: ["config read", "config write", "heartbeat"], perms: { read: "config + fault codes", write: "approval required", exec: "none", actuate: "via rig only" }, data: "Config, fault log" },
      { id: "psu", head: "headless", glyph: "PSU", label: "Bench power supply", sub: "SCPI over LAN", x: 830, y: 300, parent: "rig", zone: "lab",
        hw: "Programmable PSU", os: "SCPI", caps: ["read V/I", "power cycle"], perms: { read: "V/I", write: "none", exec: "none", actuate: "power cycle · approval" }, data: "None" },
      { id: "scope", head: "headless", glyph: "OSC", label: "Oscilloscope", sub: "CAN decode", x: 790, y: 460, parent: "rig", zone: "lab",
        hw: "4-ch scope", os: "SCPI", caps: ["capture", "protocol decode"], perms: { read: "captures", write: "none", exec: "capture only", actuate: "none" }, data: "Captures" }
    ],
    edgeLabels: {},
    steps: [
      { node: "sup", title: "Plan the diagnosis", detail: "Start read-only: logs, then the controller, then the wire. Anything that powers or moves hardware waits for you.", out: "Plan: read logs, reconnect the controller, check the bus, fix with approval, test.", t: 1 },
      { node: "rig", title: "Read the controller's serial log", detail: "The rig PC worker reads the USB serial log since the flash.", lease: { scopes: ["read: serial log since 09:12", "write: none"], ttl: "60 s" }, out: "CAN timeout at 09:14:03, then the controller rebooted and went quiet.", ret: 12, t: 4 },
      { node: "mcu", title: "Reconnect to the controller", detail: "After a reboot the old session is gone. The mesh remembers its address and heartbeat and keeps asking it to rejoin.", lease: { scopes: ["read: heartbeat + fault codes"], ttl: "120 s" }, out: "Controller rejoined on its own after 3 reconnect attempts. Fault code: BUS_BITRATE.", ret: 2, t: 9,
        fail: { mode: "reconnect", always: true, why: "Motor controller missed 3 heartbeats after its reboot." } },
      { node: "scope", title: "Check the bus on the wire", detail: "Captures and decodes 200 ms of CAN traffic.", lease: { scopes: ["exec: capture + decode", "write: none"], ttl: "60 s" }, out: "Bus runs at 1 Mbit/s. Controller is sending at 500 kbit/s.", ret: 48, t: 6 },
      { node: "repo", title: "Find where the setting changed", detail: "Compares default configs between firmware 4.1 and 4.2.", lease: { scopes: ["read: configs 4.1 → 4.2"], ttl: "60 s" }, out: "4.2 reset the CAN bitrate default to 500 kbit/s.", ret: 4, t: 3 },
      { node: "mcu", title: "Write the corrected bitrate", detail: "A write to hardware config, so it waits for a person. The old config is snapshotted first.", lease: { scopes: ["write: can.bitrate = 1000000", "snapshot: before write", "reversible"], ttl: "60 s" }, approval: "Write can.bitrate = 1 Mbit/s to the motor controller? (old config saved)", out: "Config written, controller restarted, bus errors at zero.", ret: 1, t: 8 },
      { node: "rig", title: "Run the standard step-response test", detail: "Runs the approved bench profile with an 8 A hard stop.", lease: { scopes: ["exec: approved profile 'step-10'", "limit: 8 A hard stop"], ttl: "5 min" }, approval: "This drives the motor. Run the 2-minute step-response test?", out: "Actuator moving. Overshoot 6%, settling 0.31 s, within spec.", ret: 30, t: 120 },
      { node: "you", title: "Report and open a fix", detail: "Sends you the summary and opens a PR with the corrected default. It cannot merge.", lease: { scopes: ["write: PR on branch fix/can-default"], ttl: "60 s" }, out: "PR opened for review on fix/can-default. Nothing merged.", ret: 5, t: 3 }
    ],
    today: "≈ ½ day of an engineer",
    cloud: { amount: "Can't reach it", note: "the bench has no cloud path", needs: ["A cloud agent cannot see a USB serial port", "It cannot power-cycle a supply or read a scope", "Someone still has to sit at the bench"], returned: "A fixed rig and an open PR" }
  },
  {
    id: "iiot",
    tab: "Connected devices + AR",
    tag: "IIoT field service",
    prompt: "Three units at a customer site are throwing the same pressure fault. Give the field tech a first answer in their headset before anyone calls HQ.",
    zones: [
      { id: "hq", label: "HQ NETWORK", link: "LAN", x: 24, y: 28, w: 410, h: 548 },
      { id: "site", label: "CUSTOMER SITE", link: "gateway-only egress", x: 476, y: 28, w: 500, h: 548 }
    ],
    nodes: [
      { id: "sup", kind: "supervisor", head: "headed", glyph: "SUP", label: "Mesh supervisor", sub: "HQ server · master node", x: 130, y: 300, zone: "hq",
        hw: "2U server", os: "Ubuntu 24.04", caps: ["plan", "route", "policy", "audit"], perms: { read: "metadata only", write: "audit log", exec: "none", actuate: "none" }, data: "Capability graph + audit log" },
      { id: "iiot", head: "headless", glyph: "IOT", label: "IIoT platform", sub: "ThingWorx-class · telemetry", x: 310, y: 140, parent: "sup", zone: "hq",
        hw: "App server", os: "Windows Server", caps: ["telemetry query", "alerts"], perms: { read: "this customer's things", write: "none", exec: "query only", actuate: "none" }, data: "Fleet telemetry history" },
      { id: "plm", head: "headless", glyph: "PLM", label: "PLM + service docs", sub: "manuals · bulletins", x: 310, y: 460, parent: "sup", zone: "hq",
        hw: "App server", os: "Windows Server", caps: ["doc search", "BOM lookup"], perms: { read: "released docs", write: "none", exec: "none", actuate: "none" }, data: "Released manuals, service bulletins" },
      { id: "gw", kind: "sub", head: "headed", glyph: "GW", label: "Site edge gateway", sub: "industrial PC · sub-supervisor", x: 600, y: 300, parent: "sup", zone: "site",
        hw: "Fanless IPC · 8 GB", os: "Debian 12", caps: ["local route", "ring buffer", "small local model"], perms: { read: "site units", write: "/relay", exec: "local model", actuate: "none" }, data: "10-min ring buffer per unit" },
      { id: "u1", head: "headless", glyph: "U01", label: "Unit 01 controller", sub: "PLC · Modbus", x: 840, y: 120, parent: "gw", zone: "site",
        hw: "PLC", os: "vendor RTOS", caps: ["register read"], perms: { read: "fault + pressure regs", write: "none", exec: "none", actuate: "none" }, data: "Local fault log" },
      { id: "u2", head: "headless", glyph: "U02", label: "Unit 02 controller", sub: "PLC · Modbus", x: 880, y: 250, parent: "gw", zone: "site",
        hw: "PLC", os: "vendor RTOS", caps: ["register read"], perms: { read: "fault + pressure regs", write: "none", exec: "none", actuate: "none" }, data: "Local fault log" },
      { id: "u3", head: "headless", glyph: "U03", label: "Unit 03 controller", sub: "PLC · Modbus", x: 840, y: 380, parent: "gw", zone: "site",
        hw: "PLC", os: "vendor RTOS", caps: ["register read"], perms: { read: "fault + pressure regs", write: "none", exec: "none", actuate: "none" }, data: "Local fault log" },
      { id: "ar", head: "headed", glyph: "AR", label: "Tech AR headset", sub: "guided procedure", x: 680, y: 500, parent: "gw", zone: "site",
        hw: "AR headset", os: "vendor OS", caps: ["overlay steps", "confirm step"], perms: { read: "none", write: "this procedure", exec: "none", actuate: "none" }, data: "None" }
    ],
    edgeLabels: { gw: "results only" },
    steps: [
      { node: "sup", title: "Plan the triage", detail: "Telemetry and docs live at HQ. The fault windows live on site. The answer goes to the tech, not to a ticket queue.", out: "Plan: fleet trend, on-site fault windows, matching bulletin, guided steps.", t: 2 },
      { node: "iiot", title: "Pull the fleet trend", detail: "Queries telemetry for this customer's three units over 48 hours.", lease: { scopes: ["read: 3 things, last 48 h", "write: none"], ttl: "60 s" }, out: "Faults began 06:10 on all 3 units, each time inlet temperature passed 41 °C.", ret: 18, t: 6 },
      { node: "u1", title: "Read Unit 01 fault window", detail: "The gateway reads fault and pressure registers around the last trip.", lease: { scopes: ["read: fault + pressure regs"], ttl: "30 s" }, out: "Pressure sags 11% for 4 s before the trip.", ret: 2, t: 3 },
      { node: "u2", title: "Read Unit 02 fault window", detail: "Same read on the second unit.", lease: { scopes: ["read: fault + pressure regs"], ttl: "30 s" }, out: "Same 4 s sag, 12%.", ret: 2, t: 3,
        fail: { mode: "reroute", to: "gw", why: "Unit 02 controller stopped answering Modbus.", via: "Read the same window from the gateway's ring buffer instead." } },
      { node: "plm", title: "Find the matching service bulletin", detail: "Searches released manuals and bulletins for this pump assembly.", lease: { scopes: ["read: released docs, this product line"], ttl: "60 s" }, out: "Bulletin SB-114: inlet check valve sticks above 40 °C. 6-step swap procedure.", ret: 26, t: 5 },
      { node: "ar", title: "Put the procedure in the tech's headset", detail: "Sends the 6 steps with the part number. Asks first, because it goes to a person on a customer floor.", lease: { scopes: ["write: procedure SB-114 to this headset"], ttl: "20 min" }, approval: "Send the SB-114 check-valve procedure to the field tech's headset?", out: "Tech confirmed step 6. Unit 01 pressure back to nominal.", ret: 4, t: 900 },
      { node: "sup", title: "Write the service record", detail: "Records cause, fix, and evidence links. Customer telemetry stayed on site except what the tech needed.", out: "Service record filed. HQ was never called.", t: 2 }
    ],
    today: "≈ 1 day + a call to HQ",
    cloud: { amount: "Customer data", note: "telemetry, logs and manuals copied out", needs: ["Copy the customer's unit data to a vendor cloud", "Copy controlled manuals next to it", "Get the customer's approval for both"], returned: "A guided fix in the tech's headset" }
  },
  {
    id: "walls",
    tab: "Program walls",
    tag: "Security",
    prompt: "Find every test where a thruster motor ran above 80 °C, across the programs I'm cleared for.",
    zones: [
      { id: "hq", label: "YOUR NETWORK", link: "LAN", x: 24, y: 28, w: 330, h: 548 },
      { id: "a", label: "PROGRAM A", link: "commercial", x: 396, y: 28, w: 230, h: 548 },
      { id: "b", label: "PROGRAM B · ENCLAVE", link: "air-gapped", x: 668, y: 28, w: 308, h: 262, gapped: true },
      { id: "c", label: "PROGRAM C", link: "not cleared", x: 668, y: 314, w: 308, h: 262 }
    ],
    nodes: [
      { id: "sup", kind: "supervisor", head: "headed", glyph: "SUP", label: "Mesh supervisor", sub: "master node", x: 140, y: 300, zone: "hq",
        hw: "2U server", os: "Ubuntu 24.04", caps: ["plan", "route", "audit"], perms: { read: "metadata only", write: "audit log", exec: "none", actuate: "none" }, data: "Capability graph + audit log" },
      { id: "policy", head: "headless", glyph: "POL", label: "Policy engine", sub: "deterministic · not the model", x: 140, y: 110, parent: "sup", zone: "hq",
        hw: "Runs beside the supervisor", os: "—", caps: ["check clearance", "issue leases", "deny"], perms: { read: "access lists", write: "lease registry", exec: "none", actuate: "none" }, data: "Access lists, lease registry" },
      { id: "ws", head: "headed", glyph: "WS", label: "Your workstation", sub: "local test logs", x: 250, y: 480, parent: "sup", zone: "hq",
        hw: "Workstation", os: "Windows 11", caps: ["file search"], perms: { read: "~/tests", write: "none", exec: "indexer", actuate: "none" }, data: "Your test runs" },
      { id: "nasA", head: "headless", glyph: "NAS", label: "Program A storage", sub: "test archive", x: 510, y: 200, parent: "sup", zone: "a",
        hw: "NAS", os: "TrueNAS", caps: ["index search"], perms: { read: "Program A tests", write: "none", exec: "indexer", actuate: "none" }, data: "Program A test archive" },
      { id: "nasA2", head: "headless", glyph: "NAS", label: "Program A mirror", sub: "standby", x: 510, y: 400, parent: "sup", zone: "a", standby: true,
        hw: "NAS", os: "TrueNAS", caps: ["index search"], perms: { read: "Program A tests", write: "none", exec: "indexer", actuate: "none" }, data: "Nightly mirror" },
      { id: "bsup", kind: "sub", head: "headed", glyph: "SUB", label: "Enclave supervisor", sub: "own mesh · local model", x: 760, y: 186, zone: "b",
        hw: "Server inside enclave", os: "RHEL 9", caps: ["plan", "route", "local model"], perms: { read: "enclave only", write: "enclave audit log", exec: "local model", actuate: "none" }, data: "Never connected to this mesh" },
      { id: "bnas", head: "headless", glyph: "NAS", label: "Enclave storage", sub: "controlled data", x: 900, y: 112, parent: "bsup", zone: "b",
        hw: "NAS", os: "—", caps: ["index search"], perms: { read: "enclave users", write: "none", exec: "none", actuate: "none" }, data: "Controlled test data" },
      { id: "brig", head: "headed", glyph: "RIG", label: "Enclave test rig", sub: "thruster bench", x: 900, y: 208, parent: "bsup", zone: "b",
        hw: "Rig PC", os: "—", caps: ["test logs"], perms: { read: "enclave users", write: "none", exec: "none", actuate: "none" }, data: "Rig logs" },
      { id: "cnas", head: "headless", glyph: "NAS", label: "Program C storage", sub: "you are not cleared", x: 820, y: 446, parent: "sup", zone: "c",
        hw: "NAS", os: "—", caps: ["index search"], perms: { read: "Program C team only", write: "none", exec: "none", actuate: "none" }, data: "Program C tests" }
    ],
    edgeLabels: {},
    steps: [
      { node: "policy", title: "Check what you may search", detail: "The policy engine reads your access lists. The model cannot change this answer.", lease: { scopes: ["read: your clearances"], ttl: "10 s" }, out: "Cleared for Program A. Program B is enclave-only. Not cleared for Program C.", ret: 1, t: 1 },
      { node: "nasA", title: "Search Program A tests", detail: "Searches thermal logs where they are stored.", lease: { scopes: ["read: Program A test logs", "write: none", "net: none"], ttl: "120 s" }, out: "6 matching tests. Files stay on Program A storage.", ret: 9, t: 18,
        fail: { mode: "reroute", to: "nasA2", why: "Program A storage went offline mid-search." } },
      { node: "bsup", title: "Leave Program B alone", detail: "The enclave runs its own mesh with a local model. There is no path from here, by design.", unreachable: true, out: "Not reachable from this mesh. A request was filed for someone inside the enclave.", t: 0 },
      { node: "cnas", title: "Skip Program C", detail: "No lease is issued, so no worker goes. The attempt is logged for Program C's owner.", deny: true, out: "Denied by policy. Nothing was read.", t: 0 },
      { node: "ws", title: "Search your own test logs", detail: "Looks through runs stored on your workstation.", lease: { scopes: ["read: ~/tests", "write: none"], ttl: "60 s" }, out: "3 matching runs.", ret: 2, t: 5 },
      { node: "sup", title: "Combine the results", detail: "Groups hits by motor type and shows exactly which programs were searched.", out: "9 tests across Program A and your machine. B and C untouched, and the log shows why.", t: 2 }
    ],
    today: "≈ several emails + a day",
    cloud: { amount: "Every program", note: "copied into one index", needs: ["Copy every program's data into one cloud index", "Rebuild each program's access wall inside it", "Never works for an air-gapped enclave"], returned: "1 list of 9 tests" }
  }
];
