import { useState } from "react"

export function App() {
    const [url, setUrl] = useState("")

    function handleImport() {
        parent.postMessage(
            {
                pluginMessage: {
                    type: "import",
                    data: { url },
                },
            },
            "*",
        )
    }

    function handleCancel() {
        parent.postMessage({ pluginMessage: { type: "cancel" } }, "*")
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
