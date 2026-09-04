import { strict as assert } from "node:assert";
import { test } from "node:test";

import { isFilesystemPath, normalizeDestination, pathToFileUrl } from "../src/url.ts";

test("ordinary web URLs pass through unchanged", () => {
	assert.equal(normalizeDestination("https://example.com/"), "https://example.com/");
	assert.equal(normalizeDestination("  https://example.com/  "), "https://example.com/");
});

test("file URLs with spaces are accepted", () => {
	assert.equal(
		normalizeDestination("file:///Users/example/My Documents/Budget.slvr"),
		"file:///Users/example/My Documents/Budget.slvr",
	);
	assert.equal(
		normalizeDestination("file:///Users/example/My%20Documents/Budget.slvr"),
		"file:///Users/example/My%20Documents/Budget.slvr",
	);
});

test("application protocols are accepted", () => {
	for (const url of [
		"obsidian://open?vault=Example Vault",
		"things:///show?id=abc",
		"zotero://select/items/1_ABCD",
		"mailto:someone@example.com",
	]) {
		assert.equal(normalizeDestination(url), url, url);
	}
});

test("code-bearing schemes are refused", () => {
	assert.equal(normalizeDestination("javascript:alert(1)"), null);
	assert.equal(normalizeDestination("data:text/html,<h1>hi</h1>"), null);
	assert.equal(normalizeDestination("vbscript:msgbox(1)"), null);
	assert.equal(normalizeDestination("JavaScript:alert(1)"), null);
});

test("bare POSIX paths become file URLs", () => {
	assert.equal(
		normalizeDestination("/Users/example/Documents/Budget.slvr"),
		"file:///Users/example/Documents/Budget.slvr",
	);
	assert.equal(
		normalizeDestination("/Users/example/My Documents/Budget.slvr"),
		"file:///Users/example/My%20Documents/Budget.slvr",
	);
});

test("bare Windows paths become file URLs rather than a bogus scheme", () => {
	assert.equal(
		normalizeDestination("C:\\Users\\example\\Budget.slvr"),
		"file:///C%3A/Users/example/Budget.slvr",
	);
	assert.equal(
		normalizeDestination("C:/Users/example/Budget.slvr"),
		"file:///C%3A/Users/example/Budget.slvr",
	);
});

test("a drive letter is never treated as a URL scheme", () => {
	// The original bug: new URL("C:\\x") parses with protocol "c:".
	const result = normalizeDestination("C:\\Users\\example\\Budget.slvr");
	assert.ok(result !== null);
	assert.ok(result.startsWith("file://"));
});

test("unusable input is refused", () => {
	assert.equal(normalizeDestination(""), null);
	assert.equal(normalizeDestination("   "), null);
	assert.equal(normalizeDestination("example.com"), null);
	assert.equal(normalizeDestination("www.example.com"), null);
	assert.equal(normalizeDestination("not a url at all"), null);
});

test("filesystem path detection", () => {
	assert.equal(isFilesystemPath("/Users/example"), true);
	assert.equal(isFilesystemPath("~/notes"), true);
	assert.equal(isFilesystemPath("C:\\Users"), true);
	assert.equal(isFilesystemPath("\\\\server\\share"), true);
	assert.equal(isFilesystemPath("https://example.com/"), false);
	assert.equal(isFilesystemPath("relative/path"), false);
});

test("path conversion round-trips through the URL parser", () => {
	const url = pathToFileUrl("/Users/example/My Documents/a b.txt");
	assert.doesNotThrow(() => new URL(url));
	assert.equal(decodeURIComponent(new URL(url).pathname), "/Users/example/My Documents/a b.txt");
});

test("home-relative paths expand when the home directory is known", () => {
	assert.equal(
		normalizeDestination("~/Downloads/invoice.pdf", "/Users/example"),
		"file:///Users/example/Downloads/invoice.pdf",
	);
	assert.equal(
		normalizeDestination("~/My Files/a b.txt", "/Users/example/"),
		"file:///Users/example/My%20Files/a%20b.txt",
	);
	assert.equal(normalizeDestination("~", "/Users/example"), "file:///Users/example");
});

test("home-relative paths are refused rather than producing a dead URL", () => {
	// Without a home directory the old code emitted file://%7E/... , which
	// parses cleanly and points nowhere.
	assert.equal(normalizeDestination("~/Downloads/invoice.pdf"), null);
	assert.equal(normalizeDestination("~/Downloads/invoice.pdf", null), null);
});

test("an expanded home path is a valid file URL", () => {
	const result = normalizeDestination("~/Downloads/invoice.pdf", "/Users/example");
	assert.ok(result !== null);
	const parsed = new URL(result);
	assert.equal(parsed.protocol, "file:");
	assert.equal(parsed.host, "");
	assert.equal(decodeURIComponent(parsed.pathname), "/Users/example/Downloads/invoice.pdf");
});
