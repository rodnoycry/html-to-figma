export interface LayerData {
    type: "FRAME" | "TEXT" | "RECTANGLE" | "SVG" | "GROUP" | "COMPONENT"
    x: number
    y: number
    width: number
    height: number
    name?: string
    children?: LayerData[]
    fills?: Paint[]
    strokes?: Paint[]
    strokeWeight?: number
    opacity?: number
    clipsContent?: boolean
    cornerRadius?: number
    topLeftRadius?: number
    topRightRadius?: number
    bottomLeftRadius?: number
    bottomRightRadius?: number
    effects?: Effect[]
    constraints?: Constraints
    // Text properties
    characters?: string
    fontSize?: number
    fontFamily?: string
    fontWeight?: number
    textAlignHorizontal?: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED"
    lineHeight?: LineHeight
    letterSpacing?: LetterSpacing
    // Auto-layout properties
    layoutMode?: "HORIZONTAL" | "VERTICAL"
    primaryAxisAlignItems?: "MIN" | "MAX" | "CENTER" | "SPACE_BETWEEN"
    counterAxisAlignItems?: "MIN" | "MAX" | "CENTER" | "BASELINE"
    itemSpacing?: number
    counterAxisSpacing?: number
    paddingTop?: number
    paddingRight?: number
    paddingBottom?: number
    paddingLeft?: number
    layoutSizingHorizontal?: "FIXED" | "HUG" | "FILL"
    layoutSizingVertical?: "FIXED" | "HUG" | "FILL"
    layoutWrap?: "WRAP" | "NO_WRAP"
    layoutGrow?: number
    // Image
    imageUrl?: string
    imageScaleMode?: "FILL" | "FIT" | "CROP" | "TILE"
    // SVG
    svg?: string
}

interface Paint {
    type: "SOLID" | "IMAGE"
    color?: { r: number; g: number; b: number }
    opacity?: number
    url?: string
    scaleMode?: string
    imageHash?: null
}

interface Effect {
    type: "DROP_SHADOW" | "INNER_SHADOW"
    color: { r: number; g: number; b: number; a: number }
    offset: { x: number; y: number }
    radius: number
    spread?: number
    visible: boolean
    blendMode: string
}

interface Constraints {
    horizontal: "MIN" | "MAX" | "CENTER" | "STRETCH" | "SCALE"
    vertical: "MIN" | "MAX" | "CENTER" | "STRETCH" | "SCALE"
}

interface LineHeight {
    value: number
    unit: "PIXELS" | "PERCENT" | "AUTO"
}

interface LetterSpacing {
    value: number
    unit: "PIXELS" | "PERCENT"
}

export type PluginMessage =
    | { type: "import"; data: { layers: LayerData } }
    | { type: "cancel" }
