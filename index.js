const {Plugin} = require("powercord/entities")
const webpack = require("powercord/webpack")
const {getModule} = webpack
const fs = require("fs")
const fsp = fs.promises
const path = require("path")
const pj = path.join
const Parser = require("./Parser")
const sass = require("sass")

const baseDir = __dirname
const sourceDir = pj(baseDir, "source")
const cssID = "powercord-pcss"
const extension = "scss"

module.exports = class PCSS extends Plugin {
	constructor() {
		super()
		this.imports = new Map()
		this.completedModules = new Set()
		this.pendingImportsByModule = new Map()
		this.element = document.getElementById(cssID)
		if (!this.element) {
			this.element = document.createElement("style")
			this.element.id = cssID
			document.head.appendChild(this.element)
		}
	}

	/**
	 * @param {string} from
	 * @param {Map<string, string>} imports key: alias, value: property
	 */
	addImport(from, imports) {
		// if it's not already imported
		if (!this.completedModules.has(from)) {
			// if it's currently importing
			if (this.pendingImportsByModule.has(from)) {
				let pending = this.pendingImportsByModule.get(from)
				for (let entry of imports.entries) {
					if (!pending.imports.has(entry[0])) {
						pending.imports.set(entry[0], entry[1])
					}
				}
			}
			// if it's not currently importing
			else {
				let promise = getModule([from]).then(result => {
					this.pendingImportsByModule.delete(from)
					this.completedModules.add(from)
					for (let entry of imports.entries()) {
						if (result[entry[1]] && !this.imports.has(entry[0])) {
							this.imports.set(entry[0], "."+result[entry[1]].split(" ")[0]) // split to avoid pc- classes
						}
					}
				}).catch(err => {
					this.pendingImportsByModule.delete(from)
					console.error(err)
				})
				this.pendingImportsByModule.set(from, {imports, promise})
			}
		}
	}

	waitForImports() {
		return Promise.all([...this.pendingImportsByModule.values()].map(v => v.promise))
	}

	addCSS(css) {
		this.element.innerHTML = css
	}

	async startPlugin() {
		// Find files
		let sourceFiles = await fsp.readdir(sourceDir)
		sourceFiles = sourceFiles.map(f => pj(sourceDir, f))
		sourceFiles = sourceFiles.filter(f => f.endsWith("."+extension) && !fs.statSync(f).isDirectory())
		// Load files
		let contents = await Promise.all(sourceFiles.map(f => fsp.readFile(f, {encoding: "utf8"})))
		// Extract import statements
		for (let i = 0; i < contents.length; i++) {
			let c = contents[i]
			// Find lines with import
			while (c.startsWith("//import")) {
				// Grab the statement
				let lineEnd = c.indexOf("\n")
				let line = c.slice(0, lineEnd)
				c = c.slice(lineEnd+1)
				// Interpret the statement
				let parser = new Parser(line)
				parser.expect("//import")
				let importString = parser.get({split: "from"})
				parser.swallow(" ")
				let from = parser.get({split: ";"})
				if (parser.remaining().length) throw new Error("Expected end of statement, but "+parser.remaining().length+" characters remain.")
				let imports = new Map()
				importString.split(",").forEach(pair => {
					pair = pair.trim()
					// no aliasing
					if (!pair.includes("as")) {
						imports.set(pair, pair)
					}
					// aliasing
					else {
						let [property, alias] = pair.split(" as ").map(i => i.trim())
						imports.set(alias, property)
					}
				})
				console.log([imports, from])
				this.addImport(from, imports)
			}
			// Write changes back
			contents[i] = c
		}
		// Wait for imports
		console.log("Waiting for imports...")
		await this.waitForImports()
		console.log(this.imports)
		// Replace PCSS
		let result = contents.join("\n")
		for (let item of this.imports.keys()) {
			let prefixed = "/"+item
			while (result.includes(prefixed)) {
				result = result.replace(prefixed, () => this.imports.get(item))
			}
		}
		// Render SCSS
		sass.render({data: result, includePaths: [sourceDir]}, (err, output) => {
			if (err) return console.error(err)
			let css = output.css.toString()
			this.addCSS(css)
		})
	}
}
