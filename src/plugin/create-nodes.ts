import type { LayerData } from "../shared/types.ts"

export async function buildTree(
    layer: LayerData,
    parent: PageNode | FrameNode,
): Promise<SceneNode | null> {
    if (layer.type === "TEXT") {
        return createTextNode(layer, parent)
    }

    if (layer.type === "SVG" && layer.svg) {
        try {
            const node = figma.createNodeFromSvg(layer.svg)
            node.x = layer.x
            node.y = layer.y
            if (layer.width && layer.height) {
                node.resize(layer.width, layer.height)
            }
            if (layer.name) node.name = layer.name
            parent.appendChild(node)
            return node
        } catch {
            return null
        }
    }

    const frame = figma.createFrame()
    frame.name = layer.name ?? "frame"

    applyVisuals(frame, layer)

    if (layer.layoutMode) {
        frame.layoutMode = layer.layoutMode
        frame.primaryAxisAlignItems = layer.primaryAxisAlignItems ?? "MIN"
        frame.counterAxisAlignItems = layer.counterAxisAlignItems ?? "MIN"
        if (layer.itemSpacing !== undefined)
            frame.itemSpacing = layer.itemSpacing
        if (layer.counterAxisSpacing !== undefined)
            frame.counterAxisSpacing = layer.counterAxisSpacing
        if (layer.paddingTop !== undefined) frame.paddingTop = layer.paddingTop
        if (layer.paddingRight !== undefined)
            frame.paddingRight = layer.paddingRight
        if (layer.paddingBottom !== undefined)
            frame.paddingBottom = layer.paddingBottom
        if (layer.paddingLeft !== undefined)
            frame.paddingLeft = layer.paddingLeft
        if (layer.layoutWrap) frame.layoutWrap = layer.layoutWrap
        frame.layoutSizingHorizontal = "FIXED"
        frame.layoutSizingVertical = "FIXED"
    }

    parent.appendChild(frame)
    frame.x = layer.x
    frame.y = layer.y
    frame.resize(Math.max(layer.width, 1), Math.max(layer.height, 1))

    if (layer.children) {
        for (const child of layer.children) {
            await buildTree(child, frame)
        }
    }

    try {
        if (layer.layoutGrow !== undefined && layer.layoutGrow > 0) {
            frame.layoutGrow = 1
        }
        if (layer.layoutSizingHorizontal) {
            frame.layoutSizingHorizontal = layer.layoutSizingHorizontal
        }
        if (layer.layoutSizingVertical) {
            frame.layoutSizingVertical = layer.layoutSizingVertical
        }
    } catch {
        // Not in auto-layout context
    }

    return frame
}

function applyVisuals(frame: FrameNode, layer: LayerData): void {
    if (layer.fills) {
        frame.fills = layer.fills.map((f) => ({
            type: "SOLID" as const,
            color: f.color ?? { r: 0, g: 0, b: 0 },
            opacity: f.opacity ?? 1,
            visible: true,
        }))
    } else {
        frame.fills = []
    }

    if (layer.strokes && layer.strokeWeight) {
        frame.strokes = layer.strokes.map((s) => ({
            type: "SOLID" as const,
            color: s.color ?? { r: 0, g: 0, b: 0 },
            opacity: s.opacity ?? 1,
            visible: true,
        }))
        frame.strokeWeight = layer.strokeWeight
        frame.strokeAlign = "INSIDE"
    }

    if (layer.topLeftRadius !== undefined)
        frame.topLeftRadius = layer.topLeftRadius
    if (layer.topRightRadius !== undefined)
        frame.topRightRadius = layer.topRightRadius
    if (layer.bottomLeftRadius !== undefined)
        frame.bottomLeftRadius = layer.bottomLeftRadius
    if (layer.bottomRightRadius !== undefined)
        frame.bottomRightRadius = layer.bottomRightRadius

    if (layer.effects) {
        frame.effects = layer.effects.map((e) => ({
            type: e.type,
            color: e.color,
            offset: e.offset,
            radius: e.radius,
            spread: e.spread ?? 0,
            visible: e.visible,
            blendMode: e.blendMode as BlendMode,
        }))
    }

    if (layer.opacity !== undefined) frame.opacity = layer.opacity
    if (layer.clipsContent) frame.clipsContent = true
}

async function createTextNode(
    layer: LayerData,
    parent: PageNode | FrameNode,
): Promise<TextNode> {
    const node = figma.createText()
    const fontName = await loadFont(
        layer.fontFamily ?? "Inter",
        layer.fontWeight ?? 400,
    )
    node.fontName = fontName
    node.characters = layer.characters ?? ""
    node.fontSize = (layer.fontSize ?? 16) as number

    if (layer.fills) {
        node.fills = layer.fills.map((f) => ({
            type: "SOLID" as const,
            color: f.color ?? { r: 0, g: 0, b: 0 },
            opacity: f.opacity ?? 1,
            visible: true,
        }))
    }

    if (layer.textAlignHorizontal) {
        node.textAlignHorizontal = layer.textAlignHorizontal
    }

    if (layer.lineHeight) {
        node.lineHeight =
            layer.lineHeight.unit === "AUTO"
                ? { unit: "AUTO" }
                : {
                      value: layer.lineHeight.value,
                      unit: layer.lineHeight.unit,
                  }
    }

    if (layer.letterSpacing) {
        node.letterSpacing = layer.letterSpacing
    }

    if (layer.textDecoration && layer.textDecoration !== "NONE") {
        node.textDecoration = layer.textDecoration
    }

    if (layer.textCase && layer.textCase !== "ORIGINAL") {
        node.textCase = layer.textCase
    }

    node.textAutoResize = "HEIGHT"
    node.resize(Math.max(layer.width, 1), Math.max(layer.height, 1))

    parent.appendChild(node)
    node.x = layer.x
    node.y = layer.y

    try {
        if (layer.layoutGrow !== undefined && layer.layoutGrow > 0) {
            node.layoutGrow = 1
        }
    } catch {
        // Not in auto-layout context
    }

    return node
}

const fontCache = new Map<string, FontName>()

async function loadFont(family: string, weight: number): Promise<FontName> {
    const key = `${family}:${weight}`
    const cached = fontCache.get(key)
    if (cached) return cached

    const style = weightToStyle(weight)

    const attempts: FontName[] = [
        { family, style },
        { family, style: "Regular" },
        { family: "Inter", style },
        { family: "Inter", style: "Regular" },
    ]

    for (const name of attempts) {
        try {
            await figma.loadFontAsync(name)
            fontCache.set(key, name)
            return name
        } catch {
            // try next
        }
    }

    const fallback: FontName = {
        family: "Inter",
        style: "Regular",
    }
    await figma.loadFontAsync(fallback)
    fontCache.set(key, fallback)
    return fallback
}

function weightToStyle(w: number): string {
    if (w <= 100) return "Thin"
    if (w <= 200) return "Extra Light"
    if (w <= 300) return "Light"
    if (w <= 400) return "Regular"
    if (w <= 500) return "Medium"
    if (w <= 600) return "Semi Bold"
    if (w <= 700) return "Bold"
    if (w <= 800) return "Extra Bold"
    return "Black"
}
