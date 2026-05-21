import { handleMessages, type UIToPluginMessage } from "../shared/messages.ts"
import { buildTree } from "./create-nodes.ts"

figma.showUI(__html__, { width: 520, height: 580 })

figma.ui.onmessage = handleMessages<UIToPluginMessage>({
    cancel() {
        figma.closePlugin()
    },
    async "import-html"(msg) {
        figma.notify("Converting HTML to Figma layers…")
        try {
            const existing = figma.currentPage.findOne(
                (n) => n.name === "HTML Import",
            )
            if (existing) {
                msg.layers.x = existing.x
                msg.layers.y = existing.y
                existing.remove()
            }

            const node = await buildTree(msg.layers, figma.currentPage)
            if (node) {
                figma.currentPage.selection = [node]
                figma.viewport.scrollAndZoomIntoView([node])
            }
            figma.notify("Import complete!")
        } catch (e) {
            figma.notify(
                `Import failed: ${e instanceof Error ? e.message : String(e)}`,
                { error: true },
            )
        }
    },
})
