#!/usr/bin/env node
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

const repoRoot = NodePath.resolve(NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)), "..");
const tagPattern = /^v?\d+\.\d+\.\d+(?:-(?:nightly|preview)\.\d{8}\.\d+)?$/;

function git(args, { binary = false } = {}) {
  const result = NodeChildProcess.spawnSync("git", args, {
    cwd: repoRoot,
    encoding: binary ? "buffer" : "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = result.stderr?.toString().trim();
    throw new Error(detail || `git ${args[0]} failed with exit code ${result.status}`);
  }
  return result.stdout;
}

function parseNameStatus(output) {
  const parts = output.split("\0");
  const changes = [];
  for (let index = 0; index < parts.length && parts[index];) {
    const status = parts[index++];
    const firstPath = parts[index++];
    const paths = /^[RC]/.test(status) ? [firstPath, parts[index++]] : [firstPath];
    changes.push({ status, paths: paths.filter(Boolean) });
  }
  return changes;
}

function safeName(value) {
  return value.replaceAll("/", "_").replaceAll("\\", "_").replaceAll("\0", "_");
}

function addedLines(patch) {
  return patch
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .join("\n");
}

function run() {
  const args = process.argv.slice(2);
  if (args[0] === "--") args.shift();
  if (args.length === 1 && ["--help", "-h"].includes(args[0])) {
    process.stdout.write(
      "Usage: vp run upstream:review -- <current-upstream-tag> <new-upstream-tag>\n\n" +
        "Creates a read-only comparison report and per-file patches under .t4/upstream-review/.\n" +
        "It does not merge, apply patches, stage, or modify source files.\n",
    );
    return;
  }
  if (args.length !== 2 || args.some((tag) => !tagPattern.test(tag))) {
    throw new Error(
      "Pass two exact tags, for example: vp run upstream:review -- v0.1.7-nightly.20261101.4016 v0.1.7-nightly.NEXT",
    );
  }
  const [oldTag, newTag] = args;
  if (oldTag === newTag) throw new Error("The old and new upstream tags must differ.");

  const status = git(["status", "--porcelain"]);
  if (status.trim()) {
    throw new Error("Review requires a clean worktree so the recorded T4 snapshot is unambiguous.");
  }
  const upstreamUrl = git(["remote", "get-url", "upstream"]).trim();
  if (!/github\.com[:/]pingdotgg\/t3code(?:\.git)?$/i.test(upstreamUrl)) {
    throw new Error("The 'upstream' remote must point to github.com/pingdotgg/t3code.");
  }

  git([
    "fetch",
    "--no-tags",
    "upstream",
    `refs/tags/${oldTag}:refs/tags/${oldTag}`,
    `refs/tags/${newTag}:refs/tags/${newTag}`,
  ]);
  const oldSha = git(["rev-parse", "--verify", `refs/tags/${oldTag}^{commit}`]).trim();
  const newSha = git(["rev-parse", "--verify", `refs/tags/${newTag}^{commit}`]).trim();
  const headSha = git(["rev-parse", "HEAD"]).trim();
  git(["merge-base", "--is-ancestor", oldSha, newSha]);
  git(["merge-base", "--is-ancestor", oldSha, headSha]);

  const outputDir = NodePath.join(
    repoRoot,
    ".t4",
    "upstream-review",
    `${safeName(oldTag)}_to_${safeName(newTag)}`,
  );
  if (NodeFS.existsSync(outputDir)) {
    throw new Error(
      `Report already exists; refusing to overwrite it: ${NodePath.relative(repoRoot, outputDir)}`,
    );
  }

  const upstreamChanges = parseNameStatus(
    git(["diff", "--name-status", "-z", "--find-renames", oldSha, newSha]),
  );
  const forkChanges = parseNameStatus(
    git(["diff", "--name-status", "-z", "--find-renames", oldSha, headSha]),
  );
  const forkPaths = new Set(forkChanges.flatMap((change) => change.paths));
  const brandMap = JSON.parse(
    NodeFS.readFileSync(NodePath.join(repoRoot, "scripts", "upstream-brand-map.json"), "utf8"),
  );
  const replacements = [...brandMap.replacements].sort(
    (left, right) => right.upstream.length - left.upstream.length,
  );
  const reportRows = [];
  const upstreamPatch = git(
    ["diff", "--binary", "--no-ext-diff", "--no-color", "--find-renames", oldSha, newSha],
    { binary: true },
  );
  const forkPatch = git(
    ["diff", "--binary", "--no-ext-diff", "--no-color", "--find-renames", oldSha, headSha],
    { binary: true },
  );
  const filePatches = [];

  upstreamChanges.forEach((change, index) => {
    const patch = git(
      [
        "diff",
        "--binary",
        "--no-ext-diff",
        "--no-color",
        "--find-renames",
        "--unified=3",
        oldSha,
        newSha,
        "--",
        ...change.paths,
      ],
      { binary: true },
    );
    const patchName = `${String(index + 1).padStart(4, "0")}-${safeName(change.paths.at(-1))}.patch`;
    filePatches.push({ patchName, patch });
    const overlap = change.paths.some((filePath) => forkPaths.has(filePath));
    const additions = addedLines(patch.toString("utf8"));
    const suggestions = replacements
      .map((replacement) => {
        let count = 0;
        for (
          let offset = 0;
          (offset = additions.indexOf(replacement.upstream, offset)) !== -1;
          offset += replacement.upstream.length
        )
          count++;
        return count ? { ...replacement, count } : null;
      })
      .filter(Boolean);
    reportRows.push({ ...change, overlap, patchName, suggestions });
  });

  const lines = [
    `# Upstream review: ${oldTag} → ${newTag}`,
    "",
    `Generated: ${new Date().toISOString()}`,
    `T4 HEAD: \`${headSha}\``,
    `Old upstream: \`${oldSha}\` (${oldTag})`,
    `New upstream: \`${newSha}\` (${newTag})`,
    "",
    "## Summary",
    "",
    `- Upstream files changed: ${upstreamChanges.length}`,
    `- T4 paths changed since the old upstream tag: ${forkPaths.size}`,
    `- Upstream files also touched by T4: ${reportRows.filter((row) => row.overlap).length} (potential overlap; this is path-level, not a confirmed hunk conflict)`,
    `- Full upstream diff: [upstream.patch](upstream.patch)`,
    `- T4 changes since base: [t4-since-base.patch](t4-since-base.patch)`,
    "",
    "## Upstream file changes",
    "",
    "Each row links to a patch containing the file's upstream change. Status uses Git's name-status code (M, A, D, R…). Review overlapping paths against both patches before applying anything.",
    "",
    "| Status | File path(s) | Review | T3→T4 rename suggestions in added lines | Patch |",
    "| --- | --- | --- | --- | --- |",
  ];
  for (const row of reportRows) {
    const paths = row.paths.map((filePath) => `\`${filePath.replaceAll("|", "\\|")}\``).join(" → ");
    const review = row.overlap ? "Potential T4 overlap" : "Upstream-only path";
    const suggestionText =
      row.suggestions
        .map(
          ({ upstream, fork, enabled, count }) =>
            `\`${upstream}\` → \`${fork}\` (${count}, ${enabled ? "enabled" : "planned"})`,
        )
        .join("; ") || "—";
    lines.push(
      `| ${row.status} | ${paths} | ${review} | ${suggestionText} | [patch](files/${row.patchName}) |`,
    );
  }
  lines.push("", "## T4 paths changed since the old upstream tag", "");
  if (forkChanges.length === 0) lines.push("No T4-only path changes detected.");
  else
    for (const change of forkChanges)
      lines.push(`- ${change.status}: ${change.paths.map((item) => `\`${item}\``).join(" → ")}`);
  lines.push(
    "",
    "## How to read this report",
    "",
    "`upstream.patch` is the authoritative upstream old-to-new patch. `t4-since-base.patch` records the fork's changes from the old base to the captured HEAD. A shared path means both sides changed that path; inspect the patch hunks to decide how to preserve T4 behavior. Rename suggestions are string matches in upstream added lines only; they are hints, not automatic edits. No patch is applied by this command.",
    "",
  );
  const filesDir = NodePath.join(outputDir, "files");
  NodeFS.mkdirSync(filesDir, { recursive: true });
  NodeFS.writeFileSync(NodePath.join(outputDir, "upstream.patch"), upstreamPatch);
  NodeFS.writeFileSync(NodePath.join(outputDir, "t4-since-base.patch"), forkPatch);
  for (const { patchName, patch } of filePatches) {
    NodeFS.writeFileSync(NodePath.join(filesDir, patchName), patch);
  }
  NodeFS.writeFileSync(NodePath.join(outputDir, "README.md"), lines.join("\n"));
  process.stdout.write(`Created read-only review: ${NodePath.relative(repoRoot, outputDir)}\n`);
  process.stdout.write(
    `Upstream file changes: ${upstreamChanges.length}; potential path overlaps: ${reportRows.filter((row) => row.overlap).length}\n`,
  );
}

try {
  run();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
