import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
	createShortcut,
	detectLineEnding,
	parseShortcut,
	withUrl,
} from "../src/shortcut.ts";

const CRLF_FILE =
	"[InternetShortcut]\r\nURL=https://example.com/\r\nIconIndex=0\r\nCustomUnknownField=preserve-me\r\n";

// A representative shortcut file: LF endings, no trailing newline.
const LF_FILE = "[InternetShortcut]\nURL=https://docs.google.com/spreadsheets/d/abc/edit";

test("reads the destination", () => {
	assert.equal(parseShortcut(CRLF_FILE).url, "https://example.com/");
	assert.equal(
		parseShortcut(LF_FILE).url,
		"https://docs.google.com/spreadsheets/d/abc/edit",
	);
});

test("a file with no URL line parses as empty rather than throwing", () => {
	assert.equal(parseShortcut("[InternetShortcut]\r\n").url, "");
});

test("the URL key is matched case-insensitively", () => {
	assert.equal(parseShortcut("[InternetShortcut]\r\nurl=https://a.test/\r\n").url, "https://a.test/");
});

test("line endings are detected", () => {
	assert.equal(detectLineEnding(CRLF_FILE), "\r\n");
	assert.equal(detectLineEnding(LF_FILE), "\n");
});

test("rewriting the URL preserves unknown fields verbatim", () => {
	const result = withUrl(CRLF_FILE, "https://obsidian.md/");
	assert.equal(
		result,
		"[InternetShortcut]\r\nURL=https://obsidian.md/\r\nIconIndex=0\r\nCustomUnknownField=preserve-me\r\n",
	);
});

test("rewriting preserves LF endings and the absent trailing newline", () => {
	const result = withUrl(LF_FILE, "https://example.com/");
	assert.equal(result, "[InternetShortcut]\nURL=https://example.com/");
	assert.ok(!result.includes("\r"));
});

test("rewriting is idempotent", () => {
	const once = withUrl(CRLF_FILE, "https://obsidian.md/");
	assert.equal(withUrl(once, "https://obsidian.md/"), once);
});

test("only the first URL line is rewritten", () => {
	const doubled = "[InternetShortcut]\r\nURL=https://a.test/\r\nURL=https://b.test/\r\n";
	const result = withUrl(doubled, "https://c.test/");
	assert.equal(
		result,
		"[InternetShortcut]\r\nURL=https://c.test/\r\nURL=https://b.test/\r\n",
	);
});

test("a missing URL line is inserted after the section header", () => {
	const result = withUrl("[InternetShortcut]\r\nIconIndex=0\r\n", "https://a.test/");
	assert.equal(result, "[InternetShortcut]\r\nURL=https://a.test/\r\nIconIndex=0\r\n");
});

test("a missing section header appends the URL", () => {
	const result = withUrl("IconIndex=0\n", "https://a.test/");
	assert.equal(result, "IconIndex=0\nURL=https://a.test/\n");
});

test("new shortcuts use CRLF and round-trip", () => {
	const created = createShortcut("https://example.com/");
	assert.equal(created, "[InternetShortcut]\r\nURL=https://example.com/\r\n");
	assert.equal(parseShortcut(created).url, "https://example.com/");
});
