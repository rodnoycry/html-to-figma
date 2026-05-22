# HTML to Figma

A local Figma plugin for turning pasted HTML and CSS into editable Figma layers.

The plugin is aimed at importing static web layouts as native frames, text nodes,
effects, and auto-layout structures. It is not a browser renderer inside Figma:
the conversion is an approximation that favors editable Figma structure over a
pixel snapshot.

## How It Works

The UI renders the supplied HTML and CSS in a hidden iframe at the selected
viewport width. It walks the resulting DOM, reads computed styles and browser
bounding boxes, then sends a serializable layer tree to the plugin runtime. The
plugin runtime creates Figma nodes from that tree.

This means the browser is still responsible for resolving CSS variables,
cascade, media queries, font metrics, layout geometry, and computed color values
before the plugin maps those results into Figma concepts.

## Current Conversion Model

Layout:

- CSS flex containers become Figma auto layout frames.
- Flex direction, wrapping, gap, padding, and main/cross-axis alignment are
  mapped where Figma has equivalent properties.
- Flex children with `flex-grow` become fill-sized children on the relevant
  axis.
- Some CSS grid containers become Figma grid auto layout frames, including
  `fr`, `auto`, fixed pixel tracks, row/column counts, and gaps.
- Grid conversion is intentionally conservative. CSS grids that rely on stretch,
  min-size behavior, or browser-specific sizing may stay as measured frames.
- `position: absolute` and `position: fixed` children inside auto layout map to
  Figma absolute positioning, which is the closest equivalent to "Ignore auto
  layout".
- Margins on direct flex children are approximated with explicit spacer frames.
  This is intentionally visible in the layer tree because Figma has no native
  margin model.

Visual styles:

- Solid background colors become fills.
- Borders become inside strokes.
- Per-corner border radii are preserved.
- `box-shadow` maps to drop shadow or inner shadow effects.
- `backdrop-filter: blur(...)` maps to Figma background blur.
- Opacity and clipped overflow are mapped where possible.

Text:

- Text nodes use Figma auto-resize instead of fixed measured dimensions. This
  avoids accidental wrapping caused by tiny browser/Figma text metric
  differences.
- Font family, size, weight, italic style, color, line height, letter spacing,
  text alignment, decoration, and text transform are mapped.
- The plugin tries to load the requested Figma font style, then falls back to
  Inter.
- Text-flow elements such as paragraphs, headings, and plain links can collapse
  inline formatting children into one Figma text node with range styles.
- Layout/control elements stay granular. For example, flex buttons and anchors
  keep their inner spans as separate children so icon/text button layouts remain
  editable.

Other elements:

- Inline SVG is passed through `figma.createNodeFromSvg()`.
- Images currently import as placeholder rectangles using the measured image
  box. External image fetching is not implemented.
- Inputs and textareas produce text from their value or placeholder.

## Known Limits

The plugin does not attempt to support the whole web platform. These areas are
still incomplete or intentionally approximate:

- External image download and real image fills.
- Pseudo-elements such as `::before` and `::after`.
- CSS gradients and complex background layers.
- Advanced CSS grid placement, spanning, dense packing, and browser stretch
  behavior.
- Margin behavior outside direct flex children.
- Z-index and stacking-context edge cases.
- Interactive states, transitions, animations, and scripts.
- Exact text metrics across browser and Figma fonts.

When source HTML/CSS is authored with Figma-like structure in mind, results are
much cleaner. Auto layout, explicit gaps, padding, simple flex rows/columns, and
semantic text-flow markup convert better than layouts that depend heavily on
browser-only behavior.

## Project Structure

- `src/ui` contains the React plugin UI and the DOM-to-layer conversion code.
- `src/plugin` contains the Figma runtime code that creates nodes on the canvas.
- `src/shared` contains message and layer data types shared by both bundles.
- `dist/code.js` is the built plugin runtime.
- `dist/ui.html` is the built single-file UI.
- `dist/example.html` and `dist/example.css` are sample import inputs.

## Development

Install dependencies:

```sh
pnpm install
```

Run watch builds for both the plugin runtime and UI:

```sh
pnpm dev
```

Create production builds:

```sh
pnpm build
```

Validate the codebase:

```sh
pnpm ts
pnpm lint
pnpm fmt
```

To load the plugin in Figma, open a Figma file and choose
`Plugins > Development > Import plugin from manifest`, then select
`manifest.json` from this repository.

## License

MIT
