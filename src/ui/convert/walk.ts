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

    const authoredStyle = createAuthoredStyleGetter(el)
    const autoLayout = extractAutoLayout(cs, authoredStyle)
    const hasBoxVisuals = hasFrameVisuals(cs)

    if (shouldConvertElementToText(el, cs, hasBoxVisuals, autoLayout)) {
        return makeTextLayerFromElement(el, rect, parentRect)
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

    if (autoLayout) Object.assign(layer, autoLayout)

    const thisIsAutoLayout = !!autoLayout
    const thisLayoutMode =
        autoLayout?.layoutMode === "VERTICAL" ? "VERTICAL" : "HORIZONTAL"

    if (parentIsAutoLayout && isOutOfFlow(cs)) {
        layer.layoutPositioning = "ABSOLUTE"
        layer.constraints = extractConstraints(cs)
    }

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
    if (
        isTextContainerElement(el, cs) &&
        hasOnlyInlineTextContent(el) &&
        textContent(el)
    ) {
        children.push(makeTextLayerFromElement(el, rect, rect))
    } else {
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
    }

    if (children.length > 0) layer.children = children
    if (layer.layoutMode === "GRID" && layer.gridColumnCount) {
        const neededRows = Math.max(
            Math.ceil(children.length / layer.gridColumnCount),
            layer.gridRowCount ?? 1,
        )
        layer.gridRowCount = neededRows
        layer.gridRowSizes = Array.from({ length: neededRows }, (_, index) => {
            return layer.gridRowSizes?.[index] ?? { type: "HUG" }
        })
    }
    return layer
}

function isOutOfFlow(cs: CSSStyleDeclaration): boolean {
    return cs.position === "absolute" || cs.position === "fixed"
}

function extractConstraints(cs: CSSStyleDeclaration): LayerData["constraints"] {
    return {
        horizontal: cs.right !== "auto" && cs.left === "auto" ? "MAX" : "MIN",
        vertical: cs.bottom !== "auto" && cs.top === "auto" ? "MAX" : "MIN",
    }
}

function hasFrameVisuals(cs: CSSStyleDeclaration): boolean {
    return !!(
        extractFills(cs) ||
        extractStrokes(cs) ||
        extractCornerRadii(cs) ||
        extractEffects(cs) ||
        parseFloat(cs.paddingTop) ||
        parseFloat(cs.paddingRight) ||
        parseFloat(cs.paddingBottom) ||
        parseFloat(cs.paddingLeft) ||
        cs.overflow === "hidden" ||
        cs.overflow === "clip"
    )
}

function shouldConvertElementToText(
    el: Element,
    cs: CSSStyleDeclaration,
    hasBoxVisuals: boolean,
    autoLayout: Partial<LayerData> | undefined,
): boolean {
    if (hasBoxVisuals || autoLayout) return false
    if (!isTextContainerElement(el, cs)) return false
    return hasOnlyInlineTextContent(el) && !!textContent(el)
}

function isTextContainerElement(el: Element, cs: CSSStyleDeclaration): boolean {
    const tag = el.tagName.toLowerCase()
    if (
        [
            "a",
            "p",
            "span",
            "em",
            "strong",
            "b",
            "i",
            "small",
            "label",
            "button",
            "li",
            "figcaption",
            "blockquote",
            "h1",
            "h2",
            "h3",
            "h4",
            "h5",
            "h6",
        ].includes(tag)
    ) {
        return true
    }

    return cs.display === "inline" || cs.display === "inline-block"
}

function isInlineTextElement(el: Element, cs: CSSStyleDeclaration): boolean {
    const tag = el.tagName.toLowerCase()
    if (["a", "span", "em", "strong", "b", "i", "small"].includes(tag)) {
        return true
    }
    return cs.display === "inline" || cs.display === "inline-block"
}

function hasOnlyInlineTextContent(el: Element): boolean {
    for (const child of el.children) {
        const cs = win(child).getComputedStyle(child)
        if (!isInlineTextElement(child, cs)) return false
        if (!hasOnlyInlineTextContent(child)) return false
    }
    return true
}

function textContent(el: Element): string {
    return normalizeText(el.textContent ?? "")
}

function normalizeText(text: string): string {
    return text.replace(/\s+/g, " ").trim()
}

function makeTextLayerFromElement(
    el: Element,
    rect: DOMRect,
    parentRect: DOMRect,
): LayerData {
    const text = textContent(el)
    const cs = win(el).getComputedStyle(el)
    const layer = makeTextLayer(text, cs, rect, parentRect)
    layer.textSegments = collectTextSegments(el, text)
    return layer
}

function collectTextSegments(
    el: Element,
    expectedText: string,
): LayerData["textSegments"] {
    const segments: NonNullable<LayerData["textSegments"]> = []
    let cursor = 0

    const visit = (node: Node, inheritedElement: Element) => {
        if (node.nodeType === Node.TEXT_NODE) {
            const raw = normalizeText(node.textContent ?? "")
            if (!raw) return

            if (cursor > 0 && expectedText[cursor] === " ") cursor++
            const start = cursor
            cursor += raw.length
            const end = cursor

            if (end > start) {
                segments.push({
                    ...extractTextStyle(
                        win(inheritedElement).getComputedStyle(
                            inheritedElement,
                        ),
                    ),
                    start,
                    end,
                })
            }
            return
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return
        const childElement = node as Element
        for (const child of childElement.childNodes) {
            visit(child, childElement)
        }
    }

    visit(el, el)
    return segments.length > 1 ? segments : undefined
}

function extractTextStyle(
    cs: CSSStyleDeclaration,
): Omit<NonNullable<LayerData["textSegments"]>[number], "start" | "end"> {
    const style: Omit<
        NonNullable<LayerData["textSegments"]>[number],
        "start" | "end"
    > = {
        fontSize: Math.round(parseFloat(cs.fontSize)) || 16,
        fontFamily: extractFontFamily(cs.fontFamily),
        fontWeight: parseFontWeight(cs.fontWeight),
        fontStyle: cs.fontStyle === "italic" ? "ITALIC" : "NORMAL",
    }

    const color = parseColor(cs.color)
    if (color) {
        style.fills = [
            {
                type: "SOLID",
                color: { r: color.r, g: color.g, b: color.b },
                opacity: color.a,
            },
        ]
    }

    const ls = parseFloat(cs.letterSpacing)
    if (ls && cs.letterSpacing !== "normal") {
        style.letterSpacing = { value: ls, unit: "PIXELS" }
    }

    if (cs.textDecorationLine.includes("underline")) {
        style.textDecoration = "UNDERLINE"
    } else if (cs.textDecorationLine.includes("line-through")) {
        style.textDecoration = "STRIKETHROUGH"
    }

    if (cs.textTransform === "uppercase") style.textCase = "UPPER"
    else if (cs.textTransform === "lowercase") style.textCase = "LOWER"
    else if (cs.textTransform === "capitalize") style.textCase = "TITLE"

    return style
}

function createAuthoredStyleGetter(el: Element): (property: string) => string {
    const doc = el.ownerDocument
    const rules = collectStyleRules(doc)
    return (property: string) => {
        let value = ""
        for (const rule of rules) {
            try {
                if (el.matches(rule.selectorText)) {
                    value = rule.style.getPropertyValue(property) || value
                }
            } catch {
                // Ignore selectors unsupported by matches().
            }
        }
        return value
    }
}

function collectStyleRules(doc: Document): CSSStyleRule[] {
    const result: CSSStyleRule[] = []
    const w = win(doc.documentElement)
    const visit = (rules: CSSRuleList) => {
        for (const rule of Array.from(rules)) {
            if (rule instanceof w.CSSStyleRule) {
                result.push(rule)
            } else if (rule instanceof w.CSSMediaRule) {
                if (w.matchMedia(rule.conditionText).matches) {
                    visit(rule.cssRules)
                }
            }
        }
    }

    for (const sheet of Array.from(doc.styleSheets)) {
        try {
            visit(sheet.cssRules)
        } catch {
            // Cross-origin stylesheets are not expected in srcdoc, but skip safely.
        }
    }
    return result
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
        fontStyle: cs.fontStyle === "italic" ? "ITALIC" : "NORMAL",
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
