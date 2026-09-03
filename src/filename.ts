/**
 * Deterministic, offline filename suggestion (decision D-003).
 *
 * No network access: the suggestion is derived purely from the URL's own
 * components, never from a fetched page title.
 */

export const FALLBACK_BASE = "URL Note";
export const EXTENSION = "url";

/** Longest base name we will suggest, well under every filesystem limit. */
const MAX_BASE_LENGTH = 120;

/** Illegal on Windows, plus the path separators. */
const ILLEGAL_CHARACTERS = /[<>:"/\\|?*]/g;

/** Reserved device names on Windows, with or without an extension. */
const WINDOWS_RESERVED = new Set([
	"con", "prn", "aux", "nul",
	"com1", "com2", "com3", "com4", "com5", "com6", "com7", "com8", "com9",
	"lpt1", "lpt2", "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9",
]);

/** Page extensions that carry no meaning in a shortcut's name. */
const STRIPPABLE_PAGE_EXTENSIONS = /\.(html?|php|aspx?|jsp|cgi)$/i;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Final segments that are readable but say nothing about the destination.
 * Google Sheets URLs end in `/edit`, which would otherwise produce
 * "docs.google.com - edit" instead of the more honest "docs.google.com".
 */
const UNINFORMATIVE_SEGMENTS = new Set([
	"edit", "view", "preview", "index", "home", "default", "main",
	"new", "create", "open", "share", "www", "api", "app", "page",
	"file", "files", "item", "items", "content", "public",
]);

/** Version and locale segments: /v2/, /en/, /en-us/. */
const VERSION_OR_LOCALE = /^(v\d+|[a-z]{2}([-_][a-z]{2})?)$/i;

/**
 * True when a path segment looks generated rather than human-readable: a
 * numeric id, a UUID, a hash, or an unbroken run of characters long enough
 * that it cannot be a title.
 */
/**
 * True when a segment reads like separated words rather than an identifier.
 * Generated ids often contain underscores, so the presence of a separator is
 * not enough on its own; each part also has to be short enough to be a word.
 */
function looksLikeWords(segment: string): boolean {
	const parts = segment.split(/[-_\s]+/).filter((part) => part.length > 0);
	if (parts.length < 2) return false;
	if (!parts.some((part) => /[a-z]/i.test(part))) return false;
	return parts.every((part) => part.length <= 12 && /^[a-z0-9]+$/i.test(part));
}

/**
 * True when a path segment looks generated rather than human-readable: a
 * numeric id, a UUID, a hash, a mixed-case alphanumeric token, or an
 * unbroken run too long to be a title.
 */
export function isOpaqueSegment(segment: string): boolean {
	if (segment.length < 2) return true;
	if (!/[a-z]/i.test(segment)) return true;
	if (VERSION_OR_LOCALE.test(segment)) return true;
	if (UUID.test(segment)) return true;
	if (/^[0-9a-f]{8,}$/i.test(segment)) return true;
	if (UNINFORMATIVE_SEGMENTS.has(segment.toLowerCase())) return true;

	if (looksLikeWords(segment)) return false;

	// Long unbroken token: an identifier, not a title.
	if (segment.length > 24) return true;
	// Mixed case with digits mixed in: a generated key.
	if (/\d/.test(segment) && /[a-z]/.test(segment) && /[A-Z]/.test(segment)) {
		return true;
	}
	// Leading digits with letters attached: a record id.
	if (/^\d/.test(segment) && segment.length > 4) return true;

	return false;
}

/**
 * Makes a string safe as a filename base on both macOS and Windows.
 * Returns an empty string when nothing usable survives.
 */
export function sanitizeBase(input: string): string {
	let base = input.replace(ILLEGAL_CHARACTERS, " ");

	base = Array.from(base)
		.filter((character) => character.charCodeAt(0) >= 32)
		.join("");

	base = base.replace(/\s+/g, " ").trim();
	base = base.replace(/[. ]+$/, "");
	base = base.replace(/^\.+/, "").trim();

	if (base.length > MAX_BASE_LENGTH) {
		base = base.slice(0, MAX_BASE_LENGTH).replace(/[. ]+$/, "");
	}

	const withoutExtension = base.split(".")[0].toLowerCase();
	if (WINDOWS_RESERVED.has(withoutExtension)) {
		base = base + " note";
	}

	return base;
}

/**
 * Drops a trailing id from an otherwise readable slug. Notion and similar
 * services append a hash to the page title: `My-Page-2f8a91bc4d6e`.
 */
function trimTrailingId(segment: string): string {
	const parts = segment.split(/[-_]/);
	if (parts.length < 2) return segment;
	const last = parts[parts.length - 1];
	if (/^[0-9a-f]{8,}$/i.test(last) || /^\d{6,}$/.test(last)) {
		return parts.slice(0, -1).join("-");
	}
	return segment;
}

function decodeSegment(segment: string): string {
	try {
		return decodeURIComponent(segment);
	} catch {
		return segment;
	}
}

/**
 * Walks the path from right to left and returns the first segment that reads
 * like a label rather than an identifier.
 *
 * Looking only at the final segment is not enough in practice. A Google
 * Sheets URL ends `/spreadsheets/d/<id>/edit`, where the last three segments
 * are all uninformative but `spreadsheets` describes what the shortcut points
 * at. Walking back finds it.
 */
function lastMeaningfulSegment(pathname: string): string | null {
	const segments = pathname
		.split("/")
		.filter((segment) => segment.length > 0)
		.map(decodeSegment)
		.map((segment) => segment.replace(STRIPPABLE_PAGE_EXTENSIONS, ""));

	for (let index = segments.length - 1; index >= 0; index--) {
		const segment = segments[index];
		if (!isOpaqueSegment(segment)) return trimTrailingId(segment);
	}

	return null;
}

/**
 * Suggests a base name (without the `.url` extension) for a destination.
 * Query strings and fragments are ignored entirely.
 */
export function suggestBaseName(rawUrl: string): string {
	let parsed: URL;
	try {
		parsed = new URL(rawUrl.trim());
	} catch {
		return FALLBACK_BASE;
	}

	if (parsed.protocol === "file:") {
		const name = lastMeaningfulSegment(parsed.pathname);
		return (name ? sanitizeBase(name) : "") || FALLBACK_BASE;
	}

	if (parsed.protocol === "http:" || parsed.protocol === "https:") {
		const host = parsed.hostname.replace(/^www\./i, "");
		const segment = lastMeaningfulSegment(parsed.pathname);
		const combined = segment ? host + " - " + segment : host;
		return sanitizeBase(combined) || FALLBACK_BASE;
	}

	return FALLBACK_BASE;
}

/**
 * Resolves a collision by appending ` 2`, ` 3`, and so on before the
 * extension. `exists` reports whether a file name is already taken in the
 * destination folder.
 */
export function resolveCollision(
	base: string,
	exists: (fileName: string) => boolean,
): string {
	const first = base + "." + EXTENSION;
	if (!exists(first)) return first;

	for (let suffix = 2; suffix < 1000; suffix++) {
		const candidate = base + " " + suffix + "." + EXTENSION;
		if (!exists(candidate)) return candidate;
	}

	return base + " " + Date.now() + "." + EXTENSION;
}
