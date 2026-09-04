/**
 * Which destinations Elsewhere accepts.
 *
 * The rule is deliberately permissive about schemes: a shortcut points at
 * whatever the user considers "elsewhere", and application protocols like
 * `obsidian:`, `things:` and `zotero:` are exactly that. Two schemes are
 * refused because they are code rather than a destination, and a shortcut
 * pointing at them is either broken or hostile.
 *
 * Bare filesystem paths are accepted and converted, because that is how
 * people actually copy a file reference: Finder's Copy as Pathname and
 * Windows Explorer's Copy as path both produce a plain path, not a URL.
 */

/** Refused: these carry code, not a location. */
const BLOCKED_SCHEMES = new Set(["javascript:", "data:", "vbscript:"]);

/** `/Users/example/notes.md` */
const POSIX_ABSOLUTE_PATH = /^\//;

/** `~/notes.md` or a bare `~` */
const HOME_RELATIVE_PATH = /^~(\/|$)/;

/** `C:\Users\example`, `C:/Users/example`, and UNC `\\server\share` */
const WINDOWS_ABSOLUTE_PATH = /^([a-z]:[\\/]|\\\\[^\\])/i;

/**
 * A Windows drive path parses as a URL with scheme "c:", so a bare scheme
 * of a single letter is never a real protocol.
 */
function isDriveLetterScheme(protocol: string): boolean {
	return /^[a-z]:$/i.test(protocol);
}

export function isFilesystemPath(text: string): boolean {
	const trimmed = text.trim();
	if (trimmed.length === 0) return false;
	return (
		POSIX_ABSOLUTE_PATH.test(trimmed) ||
		HOME_RELATIVE_PATH.test(trimmed) ||
		WINDOWS_ABSOLUTE_PATH.test(trimmed)
	);
}

/**
 * Converts a bare absolute filesystem path into a `file:` URL, encoding
 * characters that are not legal in a URL. Backslashes become forward
 * slashes so a Windows path produces a valid URL.
 */
export function pathToFileUrl(text: string): string {
	let path = text.trim().replace(/\\/g, "/");

	// A drive path needs the extra root slash: C:/x -> file:///C:/x
	if (/^[a-z]:/i.test(path)) path = "/" + path;

	const encoded = path
		.split("/")
		.map((segment) => encodeURIComponent(segment))
		.join("/");

	return "file://" + encoded;
}

/**
 * Normalizes user input into the URL that will be written to the shortcut,
 * or null when the input is not an acceptable destination.
 */
export function normalizeDestination(
	text: string,
	homeDirectory?: string | null,
): string | null {
	const trimmed = text.trim();
	if (trimmed.length === 0) return null;

	if (HOME_RELATIVE_PATH.test(trimmed)) {
		// Expanding `~` needs the home directory, which is injected so this
		// module stays pure. Without it, refuse rather than emit
		// file://%7E/... , which is a valid-looking URL that goes nowhere.
		if (!homeDirectory) return null;
		const rest = trimmed.slice(1).replace(/^\//, "");
		const base = homeDirectory.replace(/\/$/, "");
		return pathToFileUrl(rest ? base + "/" + rest : base);
	}

	if (isFilesystemPath(trimmed)) {
		return pathToFileUrl(trimmed);
	}

	let parsed: URL;
	try {
		parsed = new URL(trimmed);
	} catch {
		return null;
	}

	if (!parsed.protocol || parsed.protocol.length < 2) return null;
	if (isDriveLetterScheme(parsed.protocol)) return null;
	if (BLOCKED_SCHEMES.has(parsed.protocol.toLowerCase())) return null;

	return trimmed;
}

