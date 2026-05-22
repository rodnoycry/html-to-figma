import { parseColor } from "./color.ts"
import type { LayerData } from "../../shared/types.ts"

type Fills = NonNullable<LayerData["fills"]>
type Strokes = NonNullable<LayerData["strokes"]>
type Effects = NonNullable<LayerData["effects"]>

export function extractFills(cs: CSSStyleDeclaration): Fills | undefined {
    const fills: Fills = []
    const bg = parseColor(cs.backgroundColor)
    if (bg) {
        fills.push({
            type: "SOLID",
            color: { r: bg.r, g: bg.g, b: bg.b },
            opacity: bg.a,
        })
    }
    return fills.length > 0 ? fills : undefined
}

export function extractStrokes(
    cs: CSSStyleDeclaration,
): { strokes: Strokes; strokeWeight: number } | undefined {
    const w = parseFloat(cs.borderTopWidth)
    if (!w) return undefined
    const c = parseColor(cs.borderTopColor)
    if (!c) return undefined
    return {
        strokes: [
            {
                type: "SOLID",
                color: { r: c.r, g: c.g, b: c.b },
                opacity: c.a,
            },
        ],
        strokeWeight: w,
    }
}

export function extractCornerRadii(cs: CSSStyleDeclaration):
    | {
          topLeftRadius: number
          topRightRadius: number
          bottomLeftRadius: number
          bottomRightRadius: number
      }
    | undefined {
    const tl = parseFloat(cs.borderTopLeftRadius) || 0
    const tr = parseFloat(cs.borderTopRightRadius) || 0
    const bl = parseFloat(cs.borderBottomLeftRadius) || 0
    const br = parseFloat(cs.borderBottomRightRadius) || 0
    if (!tl && !tr && !bl && !br) return undefined
    return {
        topLeftRadius: tl,
        topRightRadius: tr,
        bottomLeftRadius: bl,
        bottomRightRadius: br,
    }
}

export function extractEffects(cs: CSSStyleDeclaration): Effects | undefined {
    const effects: Effects = []
    const blur = extractBackdropBlur(cs)
    if (blur !== undefined) {
        effects.push({
            type: "BACKGROUND_BLUR",
            radius: blur,
            visible: true,
            blurType: "NORMAL",
        })
    }

    const raw = cs.boxShadow
    if (!raw || raw === "none") {
        return effects.length > 0 ? effects : undefined
    }

    for (const part of splitOnTopLevelCommas(raw)) {
        const trimmed = part.trim()
        const isInset = trimmed.includes("inset")
        const colorMatch = trimmed.match(/rgba?\([^)]+\)/)
        if (!colorMatch) continue
        const c = parseColor(colorMatch[0])
        if (!c) continue
        const nums = trimmed
            .replace(colorMatch[0], "")
            .replace("inset", "")
            .trim()
            .split(/\s+/)
            .map(Number)
            .filter((n) => !Number.isNaN(n))

        effects.push({
            type: isInset ? "INNER_SHADOW" : "DROP_SHADOW",
            color: { r: c.r, g: c.g, b: c.b, a: c.a },
            offset: { x: nums[0] ?? 0, y: nums[1] ?? 0 },
            radius: nums[2] ?? 0,
            spread: nums[3],
            visible: true,
            blendMode: "NORMAL",
        })
    }
    return effects.length > 0 ? effects : undefined
}

function extractBackdropBlur(cs: CSSStyleDeclaration): number | undefined {
    const raw =
        cs.backdropFilter ||
        cs.getPropertyValue("backdrop-filter") ||
        cs.getPropertyValue("-webkit-backdrop-filter")
    if (!raw || raw === "none") return undefined

    const match = raw.match(/blur\(([-\d.]+)px\)/)
    if (!match) return undefined

    const radius = Number(match[1])
    return Number.isFinite(radius) && radius > 0 ? radius : undefined
}

function splitOnTopLevelCommas(s: string): string[] {
    const parts: string[] = []
    let depth = 0
    let cur = ""
    for (const ch of s) {
        if (ch === "(") depth++
        else if (ch === ")") depth--
        else if (ch === "," && depth === 0) {
            parts.push(cur)
            cur = ""
            continue
        }
        cur += ch
    }
    if (cur) parts.push(cur)
    return parts
}

export function extractAutoLayout(
    cs: CSSStyleDeclaration,
    authoredStyle?: (property: string) => string,
): Partial<LayerData> | undefined {
    if (cs.display === "grid" || cs.display === "inline-grid") {
        return extractGridLayout(cs, authoredStyle)
    }

    if (cs.display !== "flex" && cs.display !== "inline-flex") return undefined

    const dir = cs.flexDirection
    const layoutMode: "HORIZONTAL" | "VERTICAL" =
        dir === "column" || dir === "column-reverse" ? "VERTICAL" : "HORIZONTAL"

    const justify: Record<string, LayerData["primaryAxisAlignItems"]> = {
        "flex-start": "MIN",
        start: "MIN",
        "flex-end": "MAX",
        end: "MAX",
        center: "CENTER",
        "space-between": "SPACE_BETWEEN",
    }
    const align: Record<string, LayerData["counterAxisAlignItems"]> = {
        "flex-start": "MIN",
        start: "MIN",
        "flex-end": "MAX",
        end: "MAX",
        center: "CENTER",
        baseline: "BASELINE",
    }

    const result: Partial<LayerData> = {
        layoutMode,
        primaryAxisAlignItems: justify[cs.justifyContent] ?? "MIN",
        counterAxisAlignItems: align[cs.alignItems] ?? "MIN",
    }
    Object.assign(result, extractAutoSizing(cs, authoredStyle))

    const rowGap = parseFloat(cs.rowGap) || 0
    const colGap = parseFloat(cs.columnGap) || 0
    if (layoutMode === "HORIZONTAL") {
        if (colGap) result.itemSpacing = colGap
        if (rowGap) result.counterAxisSpacing = rowGap
    } else {
        if (rowGap) result.itemSpacing = rowGap
        if (colGap) result.counterAxisSpacing = colGap
    }

    const pt = parseFloat(cs.paddingTop) || 0
    const pr = parseFloat(cs.paddingRight) || 0
    const pb = parseFloat(cs.paddingBottom) || 0
    const pl = parseFloat(cs.paddingLeft) || 0
    if (pt) result.paddingTop = pt
    if (pr) result.paddingRight = pr
    if (pb) result.paddingBottom = pb
    if (pl) result.paddingLeft = pl

    if (cs.flexWrap === "wrap" || cs.flexWrap === "wrap-reverse") {
        result.layoutWrap = "WRAP"
    }

    return result
}

function extractGridLayout(
    cs: CSSStyleDeclaration,
    authoredStyle?: (property: string) => string,
): Partial<LayerData> | undefined {
    if (!isSafeFigmaGrid(cs)) return undefined

    const columnTracks = parseGridTracks(
        authoredStyle?.("grid-template-columns") || cs.gridTemplateColumns,
    )
    if (columnTracks.length === 0) return undefined

    const rowTracks = parseGridTracks(
        authoredStyle?.("grid-template-rows") || cs.gridTemplateRows,
    )
    const rowGap = parseFloat(cs.rowGap) || 0
    const columnGap = parseFloat(cs.columnGap) || 0

    return {
        layoutMode: "GRID",
        gridColumnCount: columnTracks.length,
        gridRowCount: Math.max(rowTracks.length, 1),
        gridColumnSizes: columnTracks,
        gridRowSizes: rowTracks.length > 0 ? rowTracks : [{ type: "HUG" }],
        gridRowGap: rowGap,
        gridColumnGap: columnGap,
        ...extractAutoSizing(cs, authoredStyle),
        ...extractPadding(cs),
    }
}

function isSafeFigmaGrid(cs: CSSStyleDeclaration): boolean {
    if (cs.alignItems === "stretch" || cs.justifyItems === "stretch") {
        return false
    }

    if (parseFloat(cs.minHeight) > 0 || parseFloat(cs.minWidth) > 0) {
        return false
    }

    return true
}

function extractAutoSizing(
    cs: CSSStyleDeclaration,
    authoredStyle?: (property: string) => string,
): Partial<LayerData> {
    const result: Partial<LayerData> = {}
    const authoredWidth = authoredStyle?.("width").trim()
    const authoredHeight = authoredStyle?.("height").trim()

    if (
        (cs.display === "inline-flex" || cs.display === "inline-grid") &&
        (!authoredWidth || authoredWidth === "auto")
    ) {
        result.layoutSizingHorizontal = "HUG"
    }

    if (!authoredHeight || authoredHeight === "auto") {
        result.layoutSizingVertical = "HUG"
    }

    return result
}

function parseGridTracks(
    raw: string,
): NonNullable<LayerData["gridColumnSizes"]> {
    if (!raw || raw === "none") return []

    const expanded = raw.replace(
        /repeat\((\d+),\s*([^)]+)\)/g,
        (_match, count: string, value: string) =>
            Array.from({ length: Number(count) }, () => value.trim()).join(" "),
    )

    return expanded
        .trim()
        .split(/\s+/)
        .map((track) => {
            if (track === "auto" || track.startsWith("min-content")) {
                return { type: "HUG" as const }
            }
            if (track.endsWith("fr")) {
                const value = Number.parseFloat(track)
                return {
                    type: "FLEX" as const,
                    value: Number.isFinite(value) ? value : undefined,
                }
            }
            const fixed = Number.parseFloat(track)
            if (Number.isFinite(fixed) && track.endsWith("px")) {
                return { type: "FIXED" as const, value: fixed }
            }
            return { type: "HUG" as const }
        })
}

function extractPadding(cs: CSSStyleDeclaration): Partial<LayerData> {
    const result: Partial<LayerData> = {}
    const pt = parseFloat(cs.paddingTop) || 0
    const pr = parseFloat(cs.paddingRight) || 0
    const pb = parseFloat(cs.paddingBottom) || 0
    const pl = parseFloat(cs.paddingLeft) || 0
    if (pt) result.paddingTop = pt
    if (pr) result.paddingRight = pr
    if (pb) result.paddingBottom = pb
    if (pl) result.paddingLeft = pl
    return result
}
