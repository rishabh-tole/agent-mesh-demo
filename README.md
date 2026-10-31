# Mesh demo

Live, chat-driven demo of the mesh for Boston Engineering R&D.

Type what went wrong (or pick an example). The mesh diagnoses it across the machines on the graph, then fixes it and tests the fix when you click.

Static site, no build step. Served by GitHub Pages from `main` at the repo root.

- `index.html` · chat window + topology layout
- `styles.css` · black + orange theme
- `js/scenarios.js` · scenarios: machines, zones, diagnose / fix / test steps
- `js/graph.js` · SVG topology renderer and packet animation
- `js/app.js` · chat flow, step runner, meters, node spec cards

Run locally:

```bash
python3 -m http.server 8765
```

All scenarios, machine names and figures are illustrative and do not describe Boston Engineering systems or data.
