import type { ViewState, WorkspaceLeaf } from "obsidian";

interface LeafSnapshot {
	viewState: ViewState;
	ephemeralState: unknown;
}

export type LauncherCleanup = "restored" | "detached";

/**
 * Remembers what each workspace leaf contained before Obsidian navigated that
 * leaf to a shortcut. A WeakMap lets closed leaves disappear normally.
 */
export class LauncherHistory {
	private readonly snapshots = new WeakMap<WorkspaceLeaf, LeafSnapshot>();
	private readonly launcherViewType: string;

	constructor(launcherViewType: string) {
		this.launcherViewType = launcherViewType;
	}

	remember(leaf: WorkspaceLeaf): void {
		const viewState = leaf.getViewState();

		// Opening a shortcut must not replace the view we intend to restore.
		if (viewState.type === this.launcherViewType) return;

		// A new tab begins as an empty leaf. It should be closed after launch,
		// rather than restored as an unexplained blank tab.
		if (viewState.type === "empty") {
			this.snapshots.delete(leaf);
			return;
		}

		this.snapshots.set(leaf, {
			viewState,
			ephemeralState: leaf.getEphemeralState(),
		});
	}

	async restoreOrDetach(leaf: WorkspaceLeaf): Promise<LauncherCleanup> {
		const snapshot = this.snapshots.get(leaf);
		if (!snapshot) {
			leaf.detach();
			return "detached";
		}

		await leaf.setViewState(snapshot.viewState, snapshot.ephemeralState);
		return "restored";
	}
}
