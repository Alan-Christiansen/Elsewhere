/**
 * Which destinations v0.1 accepts.
 *
 * Pending final ratification of the PRD's open question on accepted URL
 * forms. Current rule: any well-formed absolute URI with a scheme is
 * accepted, so custom application protocols such as `obsidian:` or `things:`
 * work. Bare hostnames are rejected, because a confirmation-first flow gives
 * the user a chance to type the scheme themselves, and guessing wrongly
 * produces a shortcut that silently fails later.
 */

/** Schemes we have naming and launch rules for. */
export const KNOWN_SCHEMES = ["http:", "https:", "file:"] as const;

export function parseUrl(text: string): URL | null {
	const trimmed = text.trim();
	if (trimmed.length === 0) return null;
	if (/\s/.test(trimmed)) return null;
	try {
		const parsed = new URL(trimmed);
		if (!parsed.protocol || parsed.protocol.length < 2) return null;
		return parsed;
	} catch {
		return null;
	}
}

export function isSupportedUrl(text: string): boolean {
	return parseUrl(text) !== null;
}

export function isKnownScheme(text: string): boolean {
	const parsed = parseUrl(text);
	if (!parsed) return false;
	return (KNOWN_SCHEMES as readonly string[]).includes(parsed.protocol);
}
