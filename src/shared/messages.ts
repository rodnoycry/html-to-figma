interface UIToPluginMessages {
    "import-html": { url: string }
    cancel: {}
}

export type UIToPluginMessage = {
    [K in keyof UIToPluginMessages]: { type: K } & UIToPluginMessages[K]
}[keyof UIToPluginMessages]

type MessageHandlers<T extends { type: string }> = {
    [K in T["type"]]: (msg: Extract<T, { type: K }>) => void | Promise<void>
}

export function handleMessages<T extends { type: string }>(
    handlers: MessageHandlers<T>,
): (msg: T) => void {
    return (msg) => {
        const key = msg.type as keyof typeof handlers
        const handler = handlers[key] as (msg: T) => void
        handler(msg)
    }
}
