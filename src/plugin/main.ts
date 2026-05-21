import { handleMessages, type UIToPluginMessage } from "../shared/messages.ts"

figma.showUI(__html__, { width: 400, height: 300 })

figma.ui.onmessage = handleMessages<UIToPluginMessage>({
    cancel() {
        figma.closePlugin()
    },
    "import-html"(_msg) {
        figma.notify("Import received — processing not yet implemented.")
    },
})
