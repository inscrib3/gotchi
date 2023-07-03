import { defineConfig } from "vite"
import { viteSingleFile } from "vite-plugin-singlefile"
import viteCompression from 'vite-plugin-compression'

export default defineConfig({
	plugins: [viteSingleFile(), viteCompression()]
})
