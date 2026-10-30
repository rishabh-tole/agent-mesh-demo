# Agent Mesh demo

Interactive demo of Agent Mesh (working name), prepared for a conversation with Boston Engineering R&D.

Static site, no build step. Served by GitHub Pages from `main` at the repo root.

- `index.html` · page structure and sections
- `styles.css` · theme and layout
- `js/scenarios.js` · scenario data (nodes, zones, steps)
- `js/graph.js` · SVG topology renderer and packet animation
- `js/app.js` · console runner, inspector, metrics, audit log

Run locally:

```bash
python3 -m http.server 8765
```

All scenarios, machine names and figures are illustrative examples and do not describe Boston Engineering systems or data.
