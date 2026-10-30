# ExactKB

Resize your **photo** and **signature** to an exact KB limit (20 KB, 30 KB, 50 KB, 10 KB or any custom size) for government exam, university and online registration forms.

**Live site:** https://exactkb.in

## Features

- Presets for photo (20 / 30 / 50 KB) and signature (10 / 20 KB), plus a custom size (5–5000 KB)
- Gets as close to your KB limit as possible while keeping the best quality
- 100% client side: your image never leaves your device
- Drag & drop upload with preview, original size and dimensions
- Before / after size comparison and one-click download
- No login, no ads, works on mobile
- Clear error messages for invalid files or sizes

## How it works

1. The image is loaded in the browser and drawn on a `<canvas>` (white background, so transparent PNGs don't turn black).
2. A binary search finds the highest JPEG quality (between 0.4 and 1.0) whose file size is still under the target.
3. If even the lowest quality is too large, the dimensions are reduced proportionally and the search runs again (up to 8 rounds, never below 120 px).
4. The result is shown with a download link. If the target can't be reached, the closest result is offered with a warning.

## Project structure

```
.
├── index.html     # Page markup and SEO meta tags
├── style.css      # UI styles (dark theme, responsive)
├── resize.js      # Upload, compression and download logic
├── sitemap.xml    # Sitemap for search engines
├── robots.txt     # Crawler rules
└── README.md
```

## Run locally

No build step or dependencies are needed.

```bash
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>
# open index.html in your browser, or serve it:
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Customize

Settings are at the top of `resize.js`:

| Constant | Default | Meaning |
|---|---|---|
| `MIN_QUALITY` | `0.4` | Lowest JPEG quality before dimensions are reduced |
| `MAX_SIDE` | `4000` | Large photos are pre-shrunk to this size for speed |
| `MIN_SIDE` | `120` | Smallest allowed width/height in pixels |
| `SEARCH_STEPS` | `6` | Binary-search steps for quality |

Colors are CSS variables in the `:root` block of `style.css`.

If a form requires a minimum image width/height, increase `MIN_SIDE`.

## Deploy

It is a static site, so it works on any static host:

- **GitHub Pages:** Settings → Pages → Deploy from branch → `main` / `(root)`
- **Netlify / Vercel / Cloudflare Pages:** connect the repo, no build command, publish directory is the root

## Limitations

- Output is always JPG.
- HEIC/HEIF photos aren't supported by browsers. Convert them to JPG or PNG first.
- Very small targets (e.g. 10 KB) on large images may need heavy dimension reduction.

## Contributing

Issues and pull requests are welcome. For feedback you can also email exactkb.pravik@gmail.com.

Built for students ❤️
