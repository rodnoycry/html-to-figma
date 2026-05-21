import { defineConfig } from "vite"

export default defineConfig({
    build: {
        outDir: "dist",
        emptyOutDir: false,
        lib: {
            entry: "src/plugin/main.ts",
            name: "code",
            formats: ["iife"],
            fileName: () => "code.js",
        },
        rollupOptions: {
            output: {
                extend: true,
            },
        },
    },
})
