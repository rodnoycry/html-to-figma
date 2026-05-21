import { useState } from "react"
import type { UIToPluginMessage } from "../shared/messages.ts"

function sendToPlugin(msg: UIToPluginMessage) {
    parent.postMessage({ pluginMessage: msg }, "*")
}

export function App() {
    const [url, setUrl] = useState("")

    function handleImport() {
        sendToPlugin({ type: "import", url })
    }

    function handleCancel() {
        sendToPlugin({ type: "cancel" })
    }

    return (
        <div style={{ padding: 16, fontFamily: "Inter, sans-serif" }}>
            <h2 style={{ margin: "0 0 12px", fontSize: 14 }}>HTML to Figma</h2>
            <input
                type="text"
                placeholder="http://localhost:3000"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                style={{
                    width: "100%",
                    padding: "8px 10px",
                    fontSize: 13,
                    border: "1px solid #ccc",
                    borderRadius: 4,
                    boxSizing: "border-box",
                }}
            />
            <div
                style={{
                    display: "flex",
                    gap: 8,
                    marginTop: 12,
                    justifyContent: "flex-end",
                }}
            >
                <button type="button" onClick={handleCancel}>
                    Cancel
                </button>
                <button type="button" onClick={handleImport}>
                    Import
                </button>
            </div>
        </div>
    )
}
