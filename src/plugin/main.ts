import type { PluginMessage } from "../shared/types.ts"

figma.showUI(__html__, { width: 400, height: 300 })

figma.ui.onmessage = async (msg: PluginMessage) => {
    if (msg.type === "cancel") {
        figma.closePlugin()
        return
    }

    if (msg.type === "import") {
        figma.notify("Import received — processing not yet implemented.")
    }
}
