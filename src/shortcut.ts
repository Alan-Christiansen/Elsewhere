/**
 * Reading and writing `.url` Internet Shortcut files.
 *
 * The format is a small INI dialect:
 *
 *   [InternetShortcut]
 *   URL=https://example.com/
 *   IconIndex=0
 *
 * Real-world files carry fields we do not understand and must not destroy, so
 * every operation here is line-preserving: we rewrite the single `URL=` line
 * and pass everything else through byte for byte, including the original line
 * endings and the presence or absence of a trailing newline.
 */

export type LineEnding = "\r\n" | "\n";

export interface Shortcut {
	/** The destination, or an empty string when the file has no `URL=` line. */
	url: string;
	/** Line ending used by the existing file. */
	lineEnding: LineEnding;
}

const URL_LINE = /^\s*URL\s*=\s*(.*)$/i;
const SECTION_HEADER = /^\s*\[InternetShortcut\]\s*$/i;

export function detectLineEnding(text: string): LineEnding {
	return text.includes("\r\n") ? "\r\n" : "\n";
}

export function parseShortcut(text: string): Shortcut {
	const lineEnding = detectLineEnding(text);
	for (const line of text.split(/\r?\n/)) {
		const match = line.match(URL_LINE);
		if (match) {
			return { url: match[1].trim(), lineEnding };
		}
	}
	return { url: "", lineEnding };
}

/**
 * Returns `text` with its destination replaced. Only the first `URL=` line is
 * touched; unknown fields, comments, ordering, casing of other keys, line
 * endings and the trailing-newline state are all preserved.
 *
 * When the file has no `URL=` line, one is inserted directly after the
 * `[InternetShortcut]` header, or appended if there is no header.
 */
export function withUrl(text: string, url: string): string {
	const lineEnding = detectLineEnding(text);
	const hadTrailingNewline = /\r?\n$/.test(text);
	const lines = text.replace(/\r?\n$/, "").split(/\r?\n/);

	let replaced = false;
	const out = lines.map((line) => {
		if (!replaced && URL_LINE.test(line)) {
			replaced = true;
			return `URL=${url}`;
		}
		return line;
	});

	if (!replaced) {
		const headerIndex = out.findIndex((line) => SECTION_HEADER.test(line));
		if (headerIndex >= 0) {
			out.splice(headerIndex + 1, 0, `URL=${url}`);
		} else {
			out.push(`URL=${url}`);
		}
	}

	return out.join(lineEnding) + (hadTrailingNewline ? lineEnding : "");
}

/**
 * Builds a new shortcut file. New files use CRLF, which is what the format's
 * Windows origin specifies and what every platform we target accepts.
 */
export function createShortcut(url: string): string {
	return ["[InternetShortcut]", `URL=${url}`, ""].join("\r\n");
}
