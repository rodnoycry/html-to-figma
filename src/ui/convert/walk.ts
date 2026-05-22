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
    const layer = convertElement({
        element: root,
        parentRect: rootRect,
        parentIsAutoLayout: false,
        parentLayoutMode: "HORIZONTAL",
    })
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

function getElementWindow(el: Node): Window & typeof globalThis {
    return el.ownerDocument!.defaultView!
}

function convertElement({
    element,
    parentRect,
    parentIsAutoLayout,
    parentLayoutMode,
}: {
    element: Element
    parentRect: DOMRect
    parentIsAutoLayout: boolean
    parentLayoutMode: "HORIZONTAL" | "VERTICAL"
}): LayerData | null {
    const elementWindow = getElementWindow(element)
    const computedStyle = elementWindow.getComputedStyle(element)
    if (computedStyle.display === "none") return null

    const rect = element.getBoundingClientRect()
    if (rect.width < 0.5 || rect.height < 0.5) return null

    if (element instanceof elementWindow.SVGSVGElement) {
        return convertSvg(element as SVGSVGElement, parentRect)
    }

    const authoredStyle = createAuthoredStyleGetter(element)
    const autoLayout = extractAutoLayout(computedStyle, authoredStyle)
    const hasBoxVisuals = hasFrameVisuals(computedStyle)

    const childSizing = computeChildSizing(
        element,
        computedStyle,
        authoredStyle,
        parentIsAutoLayout,
        parentLayoutMode,
    )

    if (
        shouldConvertElementToText(
            element,
            computedStyle,
            hasBoxVisuals,
            autoLayout,
        )
    ) {
        const textLayer = makeTextLayerFromElement(element, rect, parentRect)
        Object.assign(textLayer, childSizing)
        return textLayer
    }

    const layer: LayerData = {
        type: "FRAME",
        x: Math.round(rect.left - parentRect.left),
        y: Math.round(rect.top - parentRect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        name: elementName(element),
    }

    const fills = extractFills(computedStyle)
    if (fills) layer.fills = fills

    const strokeInfo = extractStrokes(computedStyle)
    if (strokeInfo) {
        layer.strokes = strokeInfo.strokes
        layer.strokeWeight = strokeInfo.strokeWeight
    }

    const radii = extractCornerRadii(computedStyle)
    if (radii) Object.assign(layer, radii)

    const effects = extractEffects(computedStyle)
    if (effects) layer.effects = effects

    const opacity = parseFloat(computedStyle.opacity)
    if (opacity < 1) layer.opacity = opacity

    if (
        computedStyle.overflow === "hidden" ||
        computedStyle.overflow === "clip"
    ) {
        layer.clipsContent = true
    }

    if (autoLayout) Object.assign(layer, autoLayout)
    Object.assign(layer, childSizing)

    const thisIsAutoLayout = !!autoLayout && autoLayout.layoutMode !== "GRID"
    const thisLayoutMode =
        autoLayout?.layoutMode === "VERTICAL" ? "VERTICAL" : "HORIZONTAL"

    if (
        element instanceof elementWindow.HTMLImageElement ||
        element.tagName === "IMG"
    ) {
        const img = element as HTMLImageElement
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
        element instanceof elementWindow.HTMLInputElement ||
        element instanceof elementWindow.HTMLTextAreaElement
    ) {
        const input = element as HTMLInputElement | HTMLTextAreaElement
        const text = input.value || input.placeholder
        if (text) {
            layer.children = [makeTextLayer(text, computedStyle, rect, rect)]
        }
        return layer
    }

    const children: LayerData[] = []
    if (
        !autoLayout &&
        isTextFlowElement(element, computedStyle) &&
        hasOnlyInlineTextContent(element) &&
        textContent(element)
    ) {
        children.push(makeTextLayerFromElement(element, rect, rect))
    } else {
        for (const child of element.childNodes) {
            if (child.nodeType === Node.ELEMENT_NODE) {
                const childLayer = convertElement({
                    element: child as Element,
                    parentRect: rect,
                    parentIsAutoLayout: thisIsAutoLayout,
                    parentLayoutMode: thisLayoutMode,
                })
                if (childLayer) {
                    appendElementWithMarginSpacers({
                        children,
                        element: child as Element,
                        childLayer,
                        parentIsAutoLayout: thisIsAutoLayout,
                        parentLayoutMode: thisLayoutMode,
                    })
                }
            } else if (child.nodeType === Node.TEXT_NODE) {
                const text = child.textContent?.trim()
                if (text) {
                    const textLayer = convertTextNode({
                        textNode: child as Text,
                        parentElement: element,
                        parentRect: rect,
                    })
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

function appendElementWithMarginSpacers({
    children,
    element,
    childLayer,
    parentIsAutoLayout,
    parentLayoutMode,
}: {
    children: LayerData[]
    element: Element
    childLayer: LayerData
    parentIsAutoLayout: boolean
    parentLayoutMode: "HORIZONTAL" | "VERTICAL"
}): void {
    if (!parentIsAutoLayout || childLayer.layoutPositioning === "ABSOLUTE") {
        children.push(childLayer)
        return
    }

    const cs = getElementWindow(element).getComputedStyle(element)
    const before =
        parentLayoutMode === "VERTICAL"
            ? parseMargin(cs.marginTop)
            : parseMargin(cs.marginLeft)
    const after =
        parentLayoutMode === "VERTICAL"
            ? parseMargin(cs.marginBottom)
            : parseMargin(cs.marginRight)

    if (before > 0) {
        children.push(
            makeMarginSpacer(before, parentLayoutMode, "before", element),
        )
    }
    children.push(childLayer)
    if (after > 0) {
        children.push(
            makeMarginSpacer(after, parentLayoutMode, "after", element),
        )
    }
}

function parseMargin(raw: string): number {
    const value = Number.parseFloat(raw)
    return Number.isFinite(value) && value > 0 ? Math.round(value) : 0
}

function makeMarginSpacer(
    size: number,
    parentLayoutMode: "HORIZONTAL" | "VERTICAL",
    position: "before" | "after",
    el: Element,
): LayerData {
    const side =
        position === "before"
            ? parentLayoutMode === "VERTICAL"
                ? "top"
                : "left"
            : parentLayoutMode === "VERTICAL"
              ? "bottom"
              : "right"
    return {
        type: "FRAME",
        x: 0,
        y: 0,
        width: parentLayoutMode === "HORIZONTAL" ? size : 1,
        height: parentLayoutMode === "VERTICAL" ? size : 1,
        name: `margin-${side}.${elementName(el)}`,
        layoutSizingHorizontal:
            parentLayoutMode === "HORIZONTAL" ? "FIXED" : "FILL",
        layoutSizingVertical:
            parentLayoutMode === "VERTICAL" ? "FIXED" : "FILL",
    }
}

function computeChildSizing(
    el: Element,
    cs: CSSStyleDeclaration,
    authoredStyle: (property: string) => string,
    parentIsAutoLayout: boolean,
    parentLayoutMode: "HORIZONTAL" | "VERTICAL",
): Partial<LayerData> {
    if (!parentIsAutoLayout) return {}

    if (isOutOfFlow(cs)) {
        return {
            layoutPositioning: "ABSOLUTE" as const,
            constraints: extractConstraints(cs),
        }
    }

    const result: Partial<LayerData> = {}

    const grow = parseFloat(cs.flexGrow) || 0
    if (grow > 0) {
        result.layoutGrow = grow
        if (parentLayoutMode === "HORIZONTAL") {
            result.layoutSizingHorizontal = "FILL"
        } else {
            result.layoutSizingVertical = "FILL"
        }
    }

    const crossProp = parentLayoutMode === "VERTICAL" ? "width" : "height"
    const authoredCross = authoredStyle(crossProp).trim()
    if (
        (!authoredCross || authoredCross === "auto") &&
        resolvesToStretch(el, cs)
    ) {
        if (parentLayoutMode === "VERTICAL") {
            result.layoutSizingHorizontal = "FILL"
        } else {
            result.layoutSizingVertical = "FILL"
        }
    }

    return result
}

function resolvesToStretch(el: Element, cs: CSSStyleDeclaration): boolean {
    const selfAlign = cs.alignSelf
    if (
        selfAlign !== "auto" &&
        selfAlign !== "normal" &&
        selfAlign !== "stretch"
    ) {
        return false
    }
    if (selfAlign === "stretch") return true

    const parentEl = el.parentElement
    if (!parentEl) return false
    const parentCs = getElementWindow(parentEl).getComputedStyle(parentEl)
    const parentAlign = parentCs.alignItems
    return parentAlign === "normal" || parentAlign === "stretch"
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
    if (!isTextFlowElement(el, cs)) return false
    return hasOnlyInlineTextContent(el) && !!textContent(el)
}

function isTextFlowElement(el: Element, cs: CSSStyleDeclaration): boolean {
    if (isControlElement(el)) return false
    if (isLayoutDisplay(cs)) return false

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

function isControlElement(el: Element): boolean {
    const tag = el.tagName.toLowerCase()
    return (
        ["button", "select", "textarea", "input", "option"].includes(tag) ||
        el.getAttribute("role") === "button"
    )
}

function isLayoutDisplay(cs: CSSStyleDeclaration): boolean {
    return (
        cs.display === "flex" ||
        cs.display === "inline-flex" ||
        cs.display === "grid" ||
        cs.display === "inline-grid"
    )
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
        const cs = getElementWindow(child).getComputedStyle(child)
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
    const cs = getElementWindow(el).getComputedStyle(el)
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
                        getElementWindow(inheritedElement).getComputedStyle(
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
    const w = getElementWindow(doc.documentElement)
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

function convertTextNode({
    textNode,
    parentElement,
    parentRect,
}: {
    textNode: Text
    parentElement: Element
    parentRect: DOMRect
}): LayerData | null {
    const text = textNode.textContent?.trim()
    if (!text) return null

    const doc = textNode.ownerDocument
    const range = doc.createRange()
    range.selectNodeContents(textNode)
    const rect = range.getBoundingClientRect()

    if (rect.width < 0.5 || rect.height < 0.5) return null

    const cs = getElementWindow(parentElement).getComputedStyle(parentElement)
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
