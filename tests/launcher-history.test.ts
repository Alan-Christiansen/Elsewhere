import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { ViewState, WorkspaceLeaf } from "obsidian";

import { LauncherHistory } from "../src/launcher-history.ts";

const LAUNCHER = "elsewhere-shortcut-view";

class FakeLeaf {
	viewState: ViewState;
	ephemeralState: unknown;
	detached = false;
	restored: { viewState: ViewState; ephemeralState: unknown } | null = null;

	constructor(type: string, state: Record<string, unknown> = {}) {
		this.viewState = { type, state };
		this.ephemeralState = { cursor: { line: 12, ch: 4 } };
	}

	getViewState(): ViewState {
		return this.viewState;
	}

	getEphemeralState(): unknown {
		return this.ephemeralState;
	}

	async setViewState(viewState: ViewState, ephemeralState: unknown): Promise<void> {
		this.restored = { viewState, ephemeralState };
		this.viewState = viewState;
	}

	detach(): void {
		this.detached = true;
	}
}

function asWorkspaceLeaf(leaf: FakeLeaf): WorkspaceLeaf {
	return leaf as unknown as WorkspaceLeaf;
}

test("restores the note that occupied a reused leaf", async () => {
	const history = new LauncherHistory(LAUNCHER);
	const leaf = new FakeLeaf("markdown", { file: "Project note.md" });
	const previousView = leaf.viewState;
	const previousEphemeralState = leaf.ephemeralState;

	history.remember(asWorkspaceLeaf(leaf));
	leaf.viewState = { type: LAUNCHER, state: { file: "Reference.url" } };
	history.remember(asWorkspaceLeaf(leaf));

	assert.equal(await history.restoreOrDetach(asWorkspaceLeaf(leaf)), "restored");
	assert.deepEqual(leaf.restored, {
		viewState: previousView,
		ephemeralState: previousEphemeralState,
	});
	assert.equal(leaf.detached, false);
});

test("detaches a new leaf that has no previous view", async () => {
	const history = new LauncherHistory(LAUNCHER);
	const leaf = new FakeLeaf(LAUNCHER, { file: "Reference.url" });

	assert.equal(await history.restoreOrDetach(asWorkspaceLeaf(leaf)), "detached");
	assert.equal(leaf.detached, true);
	assert.equal(leaf.restored, null);
});

test("an empty leaf clears an obsolete snapshot", async () => {
	const history = new LauncherHistory(LAUNCHER);
	const leaf = new FakeLeaf("markdown", { file: "Old note.md" });

	history.remember(asWorkspaceLeaf(leaf));
	leaf.viewState = { type: "empty" };
	history.remember(asWorkspaceLeaf(leaf));
	leaf.viewState = { type: LAUNCHER, state: { file: "Reference.url" } };

	assert.equal(await history.restoreOrDetach(asWorkspaceLeaf(leaf)), "detached");
	assert.equal(leaf.detached, true);
});
