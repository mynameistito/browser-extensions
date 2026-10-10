#!/usr/bin/env bun
/**
 * Cleanup script
 *
 * Recursively removes temporary files matching:
 * - tmpclaude-*
 * - NUL / nul / Nul (case-insensitive, common Windows junk files)
 *
 * Skips: node_modules, .git
 *
 * Usage:
 *   bun run scripts/cleanup.ts          # normal run (deletes + logs)
 *   bun run scripts/cleanup.ts --dry-run # shows what would be deleted, no changes
 */

import type { Dirent } from "node:fs";
import { readdir, unlink } from "node:fs/promises";
import { join, relative } from "node:path";

// NUL: exact match, case-insensitive
const TARGET_PATTERNS = [/^tmpclaude-/u, /^nul$/iu];
const SKIP_DIRS = new Set(["node_modules", ".git"]);

const dryRun = process.argv.includes("--dry-run");

const shouldDelete = (name: string): boolean =>
  TARGET_PATTERNS.some((pattern) => pattern.test(name));

const readDirectorySafe = async (
  directory: string,
  root: string
): Promise<Dirent[]> => {
  try {
    return await readdir(directory, { withFileTypes: true });
  } catch (error) {
    const relDir = relative(root, directory) || ".";
    console.error(
      `Error reading directory ./${relDir}: ${(error as Error).message}`
    );
    return [];
  }
};

const deleteFile = async (
  fullPath: string,
  relPath: string
): Promise<boolean> => {
  if (dryRun) {
    console.log(`[Dry-run] Would delete: ./${relPath}`);
    return true;
  }

  try {
    await unlink(fullPath);
    console.log(`Deleted: ./${relPath}`);
    return true;
  } catch (error) {
    console.error(`Failed to delete ./${relPath}: ${(error as Error).message}`);
    return false;
  }
};

interface FileToDelete {
  fullPath: string;
  relPath: string;
}

const collectFilesToDelete = (
  entries: Dirent[],
  currentDir: string,
  root: string,
  queue: string[]
): FileToDelete[] => {
  const filesToDelete: FileToDelete[] = [];

  for (const entry of entries) {
    const fullPath = join(currentDir, entry.name);

    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        queue.push(fullPath);
      }
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (shouldDelete(entry.name)) {
      filesToDelete.push({ fullPath, relPath: relative(root, fullPath) });
    }
  }

  return filesToDelete;
};

const cleanup = async () => {
  const root = process.cwd();
  const queue: string[] = [root];
  let count = 0;

  while (queue.length > 0) {
    const currentDir = queue.shift();
    if (!currentDir) {
      continue;
    }

    const entries = await readDirectorySafe(currentDir, root);
    const filesToDelete = collectFilesToDelete(
      entries,
      currentDir,
      root,
      queue
    );

    // Delete files in parallel for better I/O performance
    const results = await Promise.all(
      filesToDelete.map(({ fullPath, relPath }) =>
        deleteFile(fullPath, relPath)
      )
    );
    count += results.filter(Boolean).length;
  }

  const action = dryRun ? "Would have deleted" : "Deleted";
  const plural = count === 1 ? "" : "s";
  console.log(`Cleanup complete. ${action} ${count} file${plural}.`);
};

await cleanup();
