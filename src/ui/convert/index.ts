import type { LayerData } from "../../shared/types.ts"
import { walkDOM } from "./walk.ts"

export async function convertHtmlToFigma(
    html: string,
    css: string,
    viewportWidth: number,
): Promise<LayerData> {
    return new Promise((resolve, reject) => {
        const iframe = document.createElement("iframe")
        iframe.style.cssText = [
            "position:fixed",
            "left:-9999px",
            "top:-9999px",
            `width:${viewportWidth}px`,
            "height:10000px",
            "border:none",
            "visibility:hidden",
        ].join(";")

        const cleanup = () => {
            if (iframe.parentNode) {
                iframe.parentNode.removeChild(iframe)
            }
        }

        iframe.onload = () => {
            requestAnimationFrame(() => {
                try {
                    const doc = iframe.contentDocument
                    if (!doc) {
                        cleanup()
                        reject(new Error("Cannot access iframe document"))
                        return
                    }

                    iframe.style.height = `${doc.body.scrollHeight}px`

                    const result = walkDOM(doc.body)
                    cleanup()
                    resolve(result)
                } catch (e) {
                    cleanup()
                    reject(e instanceof Error ? e : new Error(String(e)))
                }
            })
        }

        iframe.onerror = () => {
            cleanup()
            reject(new Error("Failed to render HTML"))
        }

        iframe.srcdoc = [
            "<!DOCTYPE html><html><head><style>",
            "body{margin:0;}",
            css,
            "</style></head><body>",
            html,
            "</body></html>",
        ].join("")

        document.body.appendChild(iframe)
    })
}
