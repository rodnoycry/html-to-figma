import { useState } from "react"
import type { UIToPluginMessage } from "../shared/messages.ts"
import { convertHtmlToFigma } from "./convert/index.ts"

function sendToPlugin(msg: UIToPluginMessage) {
    parent.postMessage({ pluginMessage: msg }, "*")
}

const DEFAULT_SCREEN_WIDTH = 1600

const SAMPLE_HTML = `<div class="card">
  <h1>Hello Figma</h1>
  <p>Paste your HTML and CSS here.</p>
</div>`

const SAMPLE_CSS = `.card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 24px;
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}
h1 { font-size: 24px; color: #1a1a1a; }
p { font-size: 14px; color: #666; }`

export function App() {
    const [html, setHtml] = useState(SAMPLE_HTML)
    const [css, setCss] = useState(SAMPLE_CSS)
    const [viewportWidth, setViewportWidth] = useState(DEFAULT_SCREEN_WIDTH)
    const [status, setStatus] = useState("")
    const [busy, setBusy] = useState(false)

    async function handleImport() {
        if (!html.trim()) {
            setStatus("Please enter some HTML.")
            return
        }
        setBusy(true)
        setStatus("Converting…")
        try {
            const layers = await convertHtmlToFigma(html, css, viewportWidth)
            sendToPlugin({ type: "import-html", layers })
            setStatus("Sent to Figma!")
        } catch (e) {
            setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`)
        } finally {
            setBusy(false)
        }
    }

    function handleCancel() {
        sendToPlugin({ type: "cancel" })
    }

    const textareaStyle: React.CSSProperties = {
        flex: 1,
        minHeight: 80,
        padding: 8,
        fontSize: 11,
        fontFamily: "SFMono-Regular, Menlo, Consolas, monospace",
        border: "1px solid #ccc",
        borderRadius: 4,
        resize: "none",
        boxSizing: "border-box",
        lineHeight: 1.5,
    }

    return (
        <div
            style={{
                padding: 12,
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: 12,
                display: "flex",
                flexDirection: "column",
                height: "100vh",
                boxSizing: "border-box",
                gap: 6,
            }}
        >
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}
            >
                <h2 style={{ margin: 0, fontSize: 14 }}>HTML to Figma</h2>
                <label
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 11,
                        color: "#666",
                    }}
                >
                    Viewport
                    <input
                        type="number"
                        value={viewportWidth}
                        onChange={(e) =>
                            setViewportWidth(Number(e.target.value))
                        }
                        style={{
                            width: 56,
                            padding: "2px 4px",
                            fontSize: 11,
                            border: "1px solid #ccc",
                            borderRadius: 3,
                            textAlign: "center" as const,
                        }}
                        min={200}
                        max={2000}
                    />
                    px
                </label>
            </div>

            <label style={{ fontWeight: 600, color: "#333" }}>HTML</label>
            <textarea
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                style={textareaStyle}
                spellCheck={false}
            />

            <label style={{ fontWeight: 600, color: "#333" }}>CSS</label>
            <textarea
                value={css}
                onChange={(e) => setCss(e.target.value)}
                style={textareaStyle}
                spellCheck={false}
            />

            {status && (
                <div
                    style={{
                        fontSize: 11,
                        color: status.startsWith("Error") ? "#d32f2f" : "#666",
                        padding: "2px 0",
                    }}
                >
                    {status}
                </div>
            )}

            <div
                style={{
                    display: "flex",
                    gap: 8,
                    justifyContent: "flex-end",
                    paddingTop: 4,
                }}
            >
                <button
                    type="button"
                    onClick={handleCancel}
                    style={{
                        padding: "6px 16px",
                        fontSize: 12,
                        borderRadius: 4,
                        border: "1px solid #ccc",
                        background: "#fff",
                        cursor: "pointer",
                    }}
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={handleImport}
                    disabled={busy}
                    style={{
                        padding: "6px 16px",
                        fontSize: 12,
                        borderRadius: 4,
                        border: "none",
                        background: busy ? "#90caf9" : "#18a0fb",
                        color: "#fff",
                        cursor: busy ? "default" : "pointer",
                    }}
                >
                    {busy ? "Converting…" : "Import"}
                </button>
            </div>
        </div>
    )
}
