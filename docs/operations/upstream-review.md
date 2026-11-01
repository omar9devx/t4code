# Reviewing upstream T3 updates

Create a report before manually porting a new T3 release into T4:

```sh
vp run upstream:review -- <currently-integrated-t4-tag> <new-t4-tag>
```

For example, after integrating `v0.1.7-nightly.20261101.4016`, use that as the first tag and the next release tag as the second. The command requires a clean worktree, fetches only those tags from the `upstream` remote, and verifies the old tag is an ancestor of both the new tag and current `HEAD`.

It writes a non-overwriting report under `.t4/upstream-review/<old>_to_<new>/`. The report contains the full upstream patch, the T4 changes since the baseline, one patch per upstream-changed file, and a table of changed paths. A path changed on both sides is marked as a potential overlap for manual review; this is deliberately not presented as a confirmed text conflict. Added upstream lines are scanned against [upstream-brand-map.json](../../scripts/upstream-brand-map.json), which reports T3→T4 replacement suggestions without changing files.

This is a review aid only: it does not merge, apply patches, stage, commit, or edit application files. Review each patch, preserve T4 behavior, and apply only the needed changes manually. Git tag refs may be fetched as part of report generation. The report directory is ignored by Git and an existing report is never overwritten.
