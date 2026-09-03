import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
	FALLBACK_BASE,
	isOpaqueSegment,
	resolveCollision,
	sanitizeBase,
	suggestBaseName,
} from "../src/filename.ts";

test("web root suggests the bare hostname", () => {
	assert.equal(suggestBaseName("https://example.com/"), "example.com");
	assert.equal(suggestBaseName("https://example.com"), "example.com");
});

test("leading www. is stripped", () => {
	assert.equal(suggestBaseName("https://www.example.com/"), "example.com");
	assert.equal(suggestBaseName("https://WWW.Example.com/"), "example.com");
});

test("a human-readable final segment is appended", () => {
	assert.equal(
		suggestBaseName("https://example.com/guides/getting-started"),
		"example.com - getting-started",
	);
});

test("query strings and fragments are ignored", () => {
	assert.equal(
		suggestBaseName("https://example.com/guides/getting-started?source=help#intro"),
		"example.com - getting-started",
	);
});

test("page extensions are stripped from the segment", () => {
	assert.equal(
		suggestBaseName("https://example.com/docs/install.html"),
		"example.com - install",
	);
});

test("opaque final segments fall back to the hostname alone", () => {
	assert.equal(suggestBaseName("https://example.com/12345"), "example.com");
	assert.equal(
		suggestBaseName("https://example.com/f47ac10b-58cc-4372-a567-0e02b2c3d479"),
		"example.com",
	);
	assert.equal(
		suggestBaseName("https://example.com/a1b2c3d4e5f6a7b8"),
		"example.com",
	);
});

test("percent-encoded segments are decoded", () => {
	assert.equal(
		suggestBaseName("https://example.com/notes/Quarterly%20Review"),
		"example.com - Quarterly Review",
	);
});

test("malformed percent-encoding does not throw", () => {
	assert.doesNotThrow(() => suggestBaseName("https://example.com/bad%zz"));
});

test("local file URLs use the source filename", () => {
	assert.equal(
		suggestBaseName("file:///Users/example/Documents/Budget.slvr"),
		"Budget.slvr",
	);
	assert.equal(
		suggestBaseName("file:///Users/example/Documents/Plan%20B.mindnode"),
		"Plan B.mindnode",
	);
});

test("unusable URLs fall back", () => {
	assert.equal(suggestBaseName("not a url"), FALLBACK_BASE);
	assert.equal(suggestBaseName(""), FALLBACK_BASE);
	assert.equal(suggestBaseName("mailto:someone@example.com"), FALLBACK_BASE);
});

test("illegal characters are removed", () => {
	assert.equal(sanitizeBase("a<b>c:d\"e/f\\g|h?i*j"), "a b c d e f g h i j");
});

test("control characters are removed", () => {
	assert.equal(sanitizeBase("beforeafter"), "beforeafter");
});

test("trailing periods and spaces are trimmed", () => {
	assert.equal(sanitizeBase("report...  "), "report");
	assert.equal(sanitizeBase("report   "), "report");
});

test("leading dots are removed so the file is not hidden", () => {
	assert.equal(sanitizeBase(".hidden"), "hidden");
});

test("windows reserved names are defused", () => {
	assert.equal(sanitizeBase("CON"), "CON note");
	assert.equal(sanitizeBase("nul"), "nul note");
	assert.equal(sanitizeBase("com1"), "com1 note");
	assert.equal(sanitizeBase("LPT9.txt"), "LPT9.txt note");
	assert.equal(sanitizeBase("console"), "console");
});

test("over-long names are truncated cleanly", () => {
	const result = sanitizeBase("x".repeat(400));
	assert.ok(result.length <= 120);
	assert.ok(!/[. ]$/.test(result));
});

test("opaque segment detection", () => {
	assert.equal(isOpaqueSegment("12345"), true);
	assert.equal(isOpaqueSegment(""), true);
	assert.equal(isOpaqueSegment("---"), true);
	assert.equal(isOpaqueSegment("d"), true);
	assert.equal(isOpaqueSegment("v2"), true);
	assert.equal(isOpaqueSegment("en"), true);
	assert.equal(isOpaqueSegment("spreadsheets"), false);
	assert.equal(isOpaqueSegment("getting-started"), false);
	assert.equal(isOpaqueSegment("edit"), true); // uninformative
	assert.equal(isOpaqueSegment("install"), false);
	assert.equal(isOpaqueSegment("a".repeat(30)), true);
	assert.equal(isOpaqueSegment("my-very-long-but-readable-article-title"), false);
});

test("collisions append the next available suffix", () => {
	const taken = new Set(["Shortcut.url", "Shortcut 2.url"]);
	assert.equal(
		resolveCollision("Shortcut", (name) => taken.has(name)),
		"Shortcut 3.url",
	);
	assert.equal(
		resolveCollision("Fresh", (name) => taken.has(name)),
		"Fresh.url",
	);
});

test("the walk-back rule names Google documents by kind", () => {
	assert.equal(
		suggestBaseName(
			"https://docs.google.com/spreadsheets/d/1KLO53VVqHfDuPgHYe_X8MLoXR61Gcb7DDXESh9aPfsY/edit?usp=sharing",
		),
		"docs.google.com - spreadsheets",
	);
	assert.equal(
		suggestBaseName("https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUv/edit"),
		"docs.google.com - document",
	);
	assert.equal(
		suggestBaseName("https://docs.google.com/presentation/d/1AbCdEfGhIjKlMnOpQrStUv/edit"),
		"docs.google.com - presentation",
	);
});

test("the walk-back rule stops at the first meaningful segment", () => {
	assert.equal(suggestBaseName("https://example.com/docs/index"), "example.com - docs");
	assert.equal(suggestBaseName("https://example.com/notes/view"), "example.com - notes");
	assert.equal(suggestBaseName("https://example.com/editor"), "example.com - editor");
});

test("walk-back does not invent a name when nothing is meaningful", () => {
	assert.equal(suggestBaseName("https://example.com/d/12345/edit"), "example.com");
	assert.equal(suggestBaseName("https://example.com/v2/en/index"), "example.com");
});

test("version and locale segments are skipped", () => {
	assert.equal(suggestBaseName("https://example.com/v2/reports/9912"), "example.com - reports");
	assert.equal(suggestBaseName("https://example.com/en-us/pricing"), "example.com - pricing");
});

test("single-character and identifier segments are opaque", () => {
	assert.equal(isOpaqueSegment("d"), true);
	assert.equal(isOpaqueSegment("v2"), true);
	assert.equal(isOpaqueSegment("en"), true);
	assert.equal(isOpaqueSegment("spreadsheets"), false);
});

test("numeric words survive when paired with a real word", () => {
	assert.equal(suggestBaseName("https://example.com/2026-review"), "example.com - 2026-review");
	assert.equal(suggestBaseName("https://example.com/q3-2026-results"), "example.com - q3-2026-results");
});

test("generated document ids never become names", () => {
	assert.equal(
		suggestBaseName("https://example.com/docs/1KLO53VVqHfDuPgHYe_X8MLoXR61Gcb7DDXESh9aPfsY"),
		"example.com - docs",
	);
	assert.equal(suggestBaseName("https://airtable.com/appXY12/tblAb34/viwCd56"), "airtable.com");
});

test("a trailing hash is trimmed from a readable slug", () => {
	assert.equal(
		suggestBaseName("https://notion.so/My-Page-2f8a91bc4d6e"),
		"notion.so - My-Page",
	);
});
