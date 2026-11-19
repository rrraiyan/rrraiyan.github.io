# Portfolio Website

Raiyan Razi Rahman's interactive portfolio. Plain HTML, CSS and JavaScript: no build step, no libraries.

## Files
- `index.html`: all page content and copy. Edit text here.
- `css/style.css`: colours (tokens at the top), layout, dark mode.
- `js/main.js`: charts and interactive pieces.
- `js/data.js`: chart data, generated from these public repos. Don't hand-edit the numbers:
  - Smartphone forecast: `rrraiyan/Canadian-Smartphone-Demand-Forecasting-for-2026` (`canada_smartphones_VALIDATED.csv`, `forecast_2026_final.csv`)
  - Adobe errors per horizon: `rrraiyan/Prophet-N-HITS-Comparative-Analysis` (summary table in the full notebook)
  - Avatar forecast (3,800-theatre scenario): `rrraiyan/Avatar-Fire-and-Ash-Prediction` (`final_ebm_avatar/*.json`). The model predicts first-week gross; actual first week $153,827,123 (The Numbers, Dec 19 to 25, 2025)

## Run locally
```
python -m http.server 5173
```
Then open http://localhost:5173.

## Publish on GitHub Pages
1. Create a public repo named `rrraiyan.github.io`.
2. Push these files to its `main` branch.
3. The site goes live at https://rrraiyan.github.io within a minute or two.

After changing CSS or JS, bump the `?v=` number on the three links in `index.html` so visitors don't get a cached copy.

## Palette
Main: deep green `#0E4A3B` · Secondary: marigold `#E3A72F` · Accent: vermilion `#D9481F` (charts) / `#B5381A` (text) · Paper `#F4EFE4`.
Chart colours pass colour-blind separation and 3:1 contrast checks in light and dark mode.
