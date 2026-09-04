import { App, TFolder, normalizePath } from "obsidian";

import { EXTENSION, resolveCollision } from "./filename.ts";

export interface Target {
	/** Full vault path the shortcut will occupy. */
	path: string;
	/** File name including the fixed `.url` extension. */
	fileName: string;
	/** True when a collision forced a numeric suffix onto the chosen name. */
	suffixed: boolean;
}

/**
 * Works out where a shortcut will actually land, given a base name and a
 * destination folder. Shared by creation and editing so both report and
 * apply collisions identically.
 *
 * `ignorePath` excludes one file from the collision check: when editing, a
 * shortcut must not collide with itself.
 */
export function resolveTarget(
	app: App,
	folder: TFolder,
	base: string,
	ignorePath?: string,
): Target | null {
	const trimmed = base.trim();
	if (!trimmed) return null;

	const prefix = folder.path === "/" ? "" : folder.path + "/";

	const taken = (candidate: string): boolean => {
		const path = normalizePath(prefix + candidate);
		const existing = app.vault.getAbstractFileByPath(path);
		return existing !== null && existing.path !== ignorePath;
	};

	const fileName = resolveCollision(trimmed, taken);

	return {
		path: normalizePath(prefix + fileName),
		fileName,
		suffixed: fileName !== trimmed + "." + EXTENSION,
	};
}
