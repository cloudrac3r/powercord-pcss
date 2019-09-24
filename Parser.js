class Parser {
	constructor(string) {
		this.string = string
		this.cursor = 0
		this.cursorStore = []
		this.mode = "until"
		this.transform = s => s
		this.split = " "
	}

	/**
	 * Return everything else in the buffer.
	 */
	remaining() {
		return this.string.slice(this.cursor)
	}

	/**
	 * Get a section of the buffer.
	 * @param {Object} options
	 * @param {String} options.split The string to split on
	 * @param {String} options.mode The mode type. "until" to get up to the split point, "between" to get between the next two split points.
	 * @param {String} options.transform A function to perform on the result before it is returned
	 */
	get(options = {}) {
		["mode", "split", "transform"].forEach(o => {
			if (!options[o]) options[o] = this[o]
		})
		if (options.mode == "until") {
			let next = this.string.indexOf(options.split, this.cursor+options.split.length)
			if (next == -1) {
				let result = this.remaining()
				this.cursor = this.string.length
				return result
			} else {
				let result = this.string.slice(this.cursor, next)
				this.cursor = next + options.split.length
				return options.transform(result)
			}
		} else if (options.mode == "between") {
			let start = this.string.indexOf(options.split, this.cursor)
			let end = this.string.indexOf(options.split, start+options.split.length)
			let result = this.string.slice(start+options.split.length, end)
			this.cursor = end + options.split.length
			return options.transform(result)
		} else if (options.mode == "length") {
			let result = this.string.slice(this.cursor, this.cursor+options.length)
			this.cursor += options.length
			return options.transform(result)
		}
	}

	/**
	 * Get a slice of the buffer.
	 * @param {Number} length Number of characters
	 * @param {Boolean} move Whether to move the cursor forward that number of characters
	 */
	slice(length, move) {
		let result = this.string.slice(this.cursor, this.cursor+length)
		if (move) this.cursor += length
		return result
	}

	/**
	 * Repeatedly swallow a character.
	 * @param {String} char The character to swallow
	 */
	swallow(char) {
		let before = this.cursor
		while (this.string[this.cursor] == char) this.cursor++
		return this.cursor - before
	}

	store() {
		this.cursorStore.push(this.cursor)
	}

	restore() {
		this.cursor = this.cursorStore.pop()
	}

	/**
	 * Run a get operation, test against an input, return success or failure, and restore the cursor.
	 * @param {String} value The value to test against
	 * @param {Object} options Options for get
	 */
	test(value, options) {
		this.store()
		let next = this.get(options)
		let result = next == value
		this.restore()
		return result
	}

	/**
	 * Run a get operation, test against an input, and throw an error if it fails.
	 * @param {String} value The expected value
	 * @param {Object} options Options for get
	 */
	expect(value, options) {
		let next = this.get(options)
		if (next != value) throw new Error("Expected "+value+", got "+next)
	}
}

module.exports = Parser
