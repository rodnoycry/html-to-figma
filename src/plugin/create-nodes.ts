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
        if (layer.layoutMode === "GRID") {
            applyGridLayout(frame, layer)
        } else {
            frame.primaryAxisAlignItems = layer.primaryAxisAlignItems ?? "MIN"
            frame.counterAxisAlignItems = layer.counterAxisAlignItems ?? "MIN"
            if (layer.itemSpacing !== undefined)
                frame.itemSpacing = layer.itemSpacing
            if (layer.counterAxisSpacing !== undefined)
                frame.counterAxisSpacing = layer.counterAxisSpacing
        }
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
        if (layer.layoutPositioning) {
            frame.layoutPositioning = layer.layoutPositioning
            frame.x = layer.x
            frame.y = layer.y
            frame.resize(Math.max(layer.width, 1), Math.max(layer.height, 1))
        }
        if (layer.constraints) {
            frame.constraints = layer.constraints
        }
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

function applyGridLayout(frame: FrameNode, layer: LayerData): void {
    frame.gridColumnCount = Math.max(layer.gridColumnCount ?? 1, 1)
    frame.gridRowCount = Math.max(layer.gridRowCount ?? 1, 1)

    if (layer.gridColumnGap !== undefined) {
        frame.gridColumnGap = layer.gridColumnGap
    }
    if (layer.gridRowGap !== undefined) {
        frame.gridRowGap = layer.gridRowGap
    }

    applyGridTrackSizes(frame.gridColumnSizes, layer.gridColumnSizes)
    applyGridTrackSizes(frame.gridRowSizes, layer.gridRowSizes)
}

function applyGridTrackSizes(
    figmaTracks: GridTrackSize[],
    layerTracks: LayerData["gridColumnSizes"],
): void {
    if (!layerTracks) return

    layerTracks.forEach((track, index) => {
        const figmaTrack = figmaTracks[index]
        if (!figmaTrack) return
        figmaTrack.type = track.type
        if (track.value !== undefined) {
            figmaTrack.value = track.value
        }
    })
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
        const effects: Effect[] = layer.effects.map((e) => {
            if (e.type === "BACKGROUND_BLUR") {
                return {
                    type: e.type,
                    radius: e.radius,
                    visible: e.visible,
                    blurType: e.blurType ?? "NORMAL",
                }
            }

            if (e.type === "DROP_SHADOW") {
                return {
                    type: e.type,
                    color: e.color ?? { r: 0, g: 0, b: 0, a: 1 },
                    offset: e.offset ?? { x: 0, y: 0 },
                    radius: e.radius,
                    spread: e.spread ?? 0,
                    visible: e.visible,
                    blendMode: (e.blendMode ?? "NORMAL") as BlendMode,
                }
            }

            return {
                type: e.type,
                color: e.color ?? { r: 0, g: 0, b: 0, a: 1 },
                offset: e.offset ?? { x: 0, y: 0 },
                radius: e.radius,
                spread: e.spread ?? 0,
                visible: e.visible,
                blendMode: (e.blendMode ?? "NORMAL") as BlendMode,
            }
        })
        frame.effects = effects
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
        layer.fontStyle ?? "NORMAL",
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

    await applyTextSegments(node, layer)

    if (layer.layoutSizingHorizontal === "FILL") {
        node.textAutoResize = "HEIGHT"
        node.resize(Math.max(layer.width, 1), Math.max(layer.height, 1))
    } else {
        node.textAutoResize = "WIDTH_AND_HEIGHT"
    }

    parent.appendChild(node)
    node.x = layer.x
    node.y = layer.y

    try {
        if (layer.layoutPositioning) {
            node.layoutPositioning = layer.layoutPositioning
            node.x = layer.x
            node.y = layer.y
        }
        if (layer.constraints) {
            node.constraints = layer.constraints
        }
        if (layer.layoutGrow !== undefined && layer.layoutGrow > 0) {
            node.layoutGrow = 1
        }
        if (layer.layoutSizingHorizontal) {
            node.layoutSizingHorizontal = layer.layoutSizingHorizontal
        }
        if (layer.layoutSizingVertical) {
            node.layoutSizingVertical = layer.layoutSizingVertical
        }
    } catch {
        // Not in auto-layout context
    }

    return node
}

async function applyTextSegments(
    node: TextNode,
    layer: LayerData,
): Promise<void> {
    if (!layer.textSegments?.length) return

    for (const segment of layer.textSegments) {
        const fontName = await loadFont(
            segment.fontFamily ?? layer.fontFamily ?? "Inter",
            segment.fontWeight ?? layer.fontWeight ?? 400,
            segment.fontStyle ?? layer.fontStyle ?? "NORMAL",
        )
        node.setRangeFontName(segment.start, segment.end, fontName)
        if (segment.fontSize !== undefined) {
            node.setRangeFontSize(segment.start, segment.end, segment.fontSize)
        }
        if (segment.fills) {
            node.setRangeFills(
                segment.start,
                segment.end,
                segment.fills.map((f) => ({
                    type: "SOLID" as const,
                    color: f.color ?? { r: 0, g: 0, b: 0 },
                    opacity: f.opacity ?? 1,
                    visible: true,
                })),
            )
        }
        if (segment.letterSpacing) {
            node.setRangeLetterSpacing(
                segment.start,
                segment.end,
                segment.letterSpacing,
            )
        }
        if (segment.textDecoration && segment.textDecoration !== "NONE") {
            node.setRangeTextDecoration(
                segment.start,
                segment.end,
                segment.textDecoration,
            )
        }
        if (segment.textCase && segment.textCase !== "ORIGINAL") {
            node.setRangeTextCase(segment.start, segment.end, segment.textCase)
        }
    }
}

const fontCache = new Map<string, FontName>()

async function loadFont(
    family: string,
    weight: number,
    fontStyle: "NORMAL" | "ITALIC" = "NORMAL",
): Promise<FontName> {
    const key = `${family}:${weight}:${fontStyle}`
    const cached = fontCache.get(key)
    if (cached) return cached

    const style = weightToStyle(weight, fontStyle)
    const regularStyle = fontStyle === "ITALIC" ? "Italic" : "Regular"

    const attempts: FontName[] = [
        { family, style },
        { family, style: regularStyle },
        { family: "Inter", style },
        { family: "Inter", style: regularStyle },
        { family, style: "Regular" },
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

function weightToStyle(w: number, fontStyle: "NORMAL" | "ITALIC"): string {
    const italic = fontStyle === "ITALIC"
    if (w <= 100) return italic ? "Thin Italic" : "Thin"
    if (w <= 200) return italic ? "Extra Light Italic" : "Extra Light"
    if (w <= 300) return italic ? "Light Italic" : "Light"
    if (w <= 400) return italic ? "Italic" : "Regular"
    if (w <= 500) return italic ? "Medium Italic" : "Medium"
    if (w <= 600) return italic ? "Semi Bold Italic" : "Semi Bold"
    if (w <= 700) return italic ? "Bold Italic" : "Bold"
    if (w <= 800) return italic ? "Extra Bold Italic" : "Extra Bold"
    return italic ? "Black Italic" : "Black"
}
