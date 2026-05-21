# HTML to Figma

A Figma plugin that turns HTML and CSS into native Figma layers. Paste your markup into one textarea, your styles into another, hit Import, and the plugin creates frames, text nodes, and auto-layout structures directly on your canvas. Everything runs locally inside the plugin

## What it does

The plugin renders your HTML + CSS in a hidden iframe, reads the computed styles and bounding boxes from the resulting DOM, and builds a matching tree of Figma nodes

It handles:

- **Layout** — CSS `display: flex` becomes Figma auto-layout. Direction, gap, padding, alignment, and wrap all carry over
- **Fills and strokes** — Background colors become solid fills. Borders become strokes with correct weight, positioned inside the frame
- **Corner radius** — All four corners, independently
- **Shadows** — `box-shadow` maps to drop shadow or inner shadow effects, including offset, blur, spread, and color
- **Opacity and overflow** — `opacity` and `overflow: hidden` work as expected
- **Typography** — Font family, size, weight, color, line height, letter spacing, alignment, decoration, and text-transform. The plugin tries to load the exact font in Figma, then falls back to Inter (lol)
- **SVG** — Inline `<svg>` elements are serialized and passed to `figma.createNodeFromSvg()`
- **Images** — `<img>` tags produce a placeholder rectangle (since there's no network access to fetch the actual image)
- **Form elements** — `<input>` and `<textarea>` values or placeholders become text nodes
- **Flex children** — `flex-grow` on children sets `layoutGrow` and `FILL` sizing in Figma

The viewport width defaults to 1600px. You can change it in the plugin UI.

## What it doesn't do

- Gradients (linear, radial, conic)
- Grid layout (`display: grid`)
- Positioned elements that rely on stacking context tricks
- External images or fonts loaded from URLs
- Pseudo-elements (`::before`, `::after`)
- Multi-style text runs within a single text node (e.g., a `<span>` with different styling mid-paragraph — it becomes a separate frame)

These are known gaps

## Project structure

The plugin and UI are separate bundles. The plugin compiles to an IIFE (`dist/code.js`). The UI compiles to a single HTML file (`dist/ui.html`) via `vite-plugin-singlefile`

## Development

Requires [pnpm](https://pnpm.io/) and Node 18+.

```sh
pnpm install
pnpm dev         
pnpm build      
```

To load the plugin in Figma: open a file, go to **Plugins > Development > Import plugin from manifest**, and select the `manifest.json` in this repo's root

Other scripts:

```sh
# format with Biome
pnpm fmt           
# lint with Biome and ESLint
pnpm lint        
# type-check both plugin and UI  
pnpm ts            
```

## License

MIT
