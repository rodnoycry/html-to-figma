export function parseColor(
    value: string,
): { r: number; g: number; b: number; a: number } | null {
    if (!value || value === "transparent" || value === "rgba(0, 0, 0, 0)")
        return null

    const match = value.match(
        /rgba?\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/,
    )
    if (!match) return null

    return {
        r: Number(match[1]) / 255,
        g: Number(match[2]) / 255,
        b: Number(match[3]) / 255,
        a: match[4] !== undefined ? parseAlpha(match[4]) : 1,
    }
}

function parseAlpha(v: string): number {
    if (v.endsWith("%")) return Number(v.slice(0, -1)) / 100
    return Number(v)
}
