import type { LayerData } from "../../shared/types.ts"
import { parseColor } from "./color.ts"
import {
    extractAutoLayout,
    extractCornerRadii,
    extractEffects,
    extractFills,
    extractStrokes,
} from "./styles.ts"

export function walkDOM(root: HTMLElement): LayerData {
    const rootRect = root.getBoundingClientRect()
    const layer = convertElement(root, rootRect, false, "HORIZONTAL")
    if (layer) {
        layer.x = 0
        layer.y = 0
        layer.name = "HTML Import"
        return layer
    }
    return {
        type: "FRAME",
        x: 0,
        y: 0,
        width: Math.round(rootRect.width),
        height: Math.round(rootRect.height),
        name: "HTML Import",
    }
}

function win(el: Node): Window & typeof globalThis {
    return el.ownerDocument!.defaultView!
}

function convertElement(
    el: Element,
    parentRect: DOMRect,
    parentIsAutoLayout: boolean,
    parentLayoutMode: "HORIZONTAL" | "VERTICAL",
): LayerData | null {
    const w = win(el)
    const cs = w.getComputedStyle(el)
    if (cs.display === "none") return null

    const rect = el.getBoundingClientRect()
    if (rect.width < 0.5 || rect.height < 0.5) return null

    if (el instanceof w.SVGSVGElement) {
        return convertSvg(el as SVGSVGElement, parentRect)
    }

    const layer: LayerData = {
        type: "FRAME",
        x: Math.round(rect.left - parentRect.left),
        y: Math.round(rect.top - parentRect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        name: elementName(el),
    }

    const fills = extractFills(cs)
    if (fills) layer.fills = fills

    const strokeInfo = extractStrokes(cs)
    if (strokeInfo) {
        layer.strokes = strokeInfo.strokes
        layer.strokeWeight = strokeInfo.strokeWeight
    }

    const radii = extractCornerRadii(cs)
    if (radii) Object.assign(layer, radii)

    const effects = extractEffects(cs)
    if (effects) layer.effects = effects

    const opacity = parseFloat(cs.opacity)
    if (opacity < 1) layer.opacity = opacity

    if (cs.overflow === "hidden" || cs.overflow === "clip") {
        layer.clipsContent = true
    }

    const autoLayout = extractAutoLayout(cs)
    if (autoLayout) Object.assign(layer, autoLayout)

    const thisIsAutoLayout = !!autoLayout
    const thisLayoutMode = autoLayout?.layoutMode ?? "HORIZONTAL"

    if (parentIsAutoLayout) {
        const grow = parseFloat(cs.flexGrow) || 0
        if (grow > 0) {
            layer.layoutGrow = grow
            if (parentLayoutMode === "HORIZONTAL") {
                layer.layoutSizingHorizontal = "FILL"
            } else {
                layer.layoutSizingVertical = "FILL"
            }
        }
    }

    if (el instanceof w.HTMLImageElement || el.tagName === "IMG") {
        const img = el as HTMLImageElement
        layer.name = img.alt || "image"
        if (!layer.fills?.length) {
            layer.fills = [
                {
                    type: "SOLID",
                    color: { r: 0.85, g: 0.85, b: 0.85 },
                    opacity: 1,
                },
            ]
        }
        return layer
    }

    if (
        el instanceof w.HTMLInputElement ||
        el instanceof w.HTMLTextAreaElement
    ) {
        const input = el as HTMLInputElement | HTMLTextAreaElement
        const text = input.value || input.placeholder
        if (text) {
            layer.children = [makeTextLayer(text, cs, rect, rect)]
        }
        return layer
    }

    const children: LayerData[] = []
    for (const child of el.childNodes) {
        if (child.nodeType === Node.ELEMENT_NODE) {
            const childLayer = convertElement(
                child as Element,
                rect,
                thisIsAutoLayout,
                thisLayoutMode,
            )
            if (childLayer) children.push(childLayer)
        } else if (child.nodeType === Node.TEXT_NODE) {
            const text = child.textContent?.trim()
            if (text) {
                const textLayer = convertTextNode(child as Text, el, rect)
                if (textLayer) children.push(textLayer)
            }
        }
    }

    if (children.length > 0) layer.children = children
    return layer
}

function convertTextNode(
    textNode: Text,
    parentEl: Element,
    parentRect: DOMRect,
): LayerData | null {
    const text = textNode.textContent?.trim()
    if (!text) return null

    const doc = textNode.ownerDocument
    const range = doc.createRange()
    range.selectNodeContents(textNode)
    const rect = range.getBoundingClientRect()

    if (rect.width < 0.5 || rect.height < 0.5) return null

    const cs = win(parentEl).getComputedStyle(parentEl)
    return makeTextLayer(text, cs, rect, parentRect)
}

function makeTextLayer(
    text: string,
    cs: CSSStyleDeclaration,
    rect: DOMRect,
    parentRect: DOMRect,
): LayerData {
    const layer: LayerData = {
        type: "TEXT",
        x: Math.round(rect.left - parentRect.left),
        y: Math.round(rect.top - parentRect.top),
        width: Math.ceil(rect.width),
        height: Math.ceil(rect.height),
        characters: text,
        fontSize: Math.round(parseFloat(cs.fontSize)) || 16,
        fontFamily: extractFontFamily(cs.fontFamily),
        fontWeight: parseFontWeight(cs.fontWeight),
    }

    const alignMap: Record<string, LayerData["textAlignHorizontal"]> = {
        left: "LEFT",
        center: "CENTER",
        right: "RIGHT",
        justify: "JUSTIFIED",
        start: "LEFT",
        end: "RIGHT",
    }
    const align = alignMap[cs.textAlign]
    if (align) layer.textAlignHorizontal = align

    const color = parseColor(cs.color)
    if (color) {
        layer.fills = [
            {
                type: "SOLID",
                color: { r: color.r, g: color.g, b: color.b },
                opacity: color.a,
            },
        ]
    }

    const lh = parseFloat(cs.lineHeight)
    if (lh && cs.lineHeight !== "normal") {
        layer.lineHeight = { value: lh, unit: "PIXELS" }
    }

    const ls = parseFloat(cs.letterSpacing)
    if (ls && cs.letterSpacing !== "normal") {
        layer.letterSpacing = { value: ls, unit: "PIXELS" }
    }

    if (cs.textDecorationLine.includes("underline")) {
        layer.textDecoration = "UNDERLINE"
    } else if (cs.textDecorationLine.includes("line-through")) {
        layer.textDecoration = "STRIKETHROUGH"
    }

    if (cs.textTransform === "uppercase") layer.textCase = "UPPER"
    else if (cs.textTransform === "lowercase") layer.textCase = "LOWER"
    else if (cs.textTransform === "capitalize") layer.textCase = "TITLE"

    return layer
}

function convertSvg(svg: SVGSVGElement, parentRect: DOMRect): LayerData {
    const rect = svg.getBoundingClientRect()
    return {
        type: "SVG",
        x: Math.round(rect.left - parentRect.left),
        y: Math.round(rect.top - parentRect.top),
        width: Math.round(rect.width) || 24,
        height: Math.round(rect.height) || 24,
        name: "svg",
        svg: new XMLSerializer().serializeToString(svg),
    }
}

function extractFontFamily(raw: string): string {
    return raw.split(",")[0].trim().replace(/['"]/g, "")
}

function parseFontWeight(w: string): number {
    const n = Number(w)
    if (!Number.isNaN(n)) return n
    const map: Record<string, number> = {
        normal: 400,
        bold: 700,
        lighter: 300,
        bolder: 700,
    }
    return map[w] ?? 400
}

function elementName(el: Element): string {
    const tag = el.tagName.toLowerCase()
    const id = el.id
    const cls = el.className
    if (id) return `${tag}#${id}`
    if (typeof cls === "string" && cls) {
        return `${tag}.${cls.split(/\s+/)[0]}`
    }
    return tag
}
