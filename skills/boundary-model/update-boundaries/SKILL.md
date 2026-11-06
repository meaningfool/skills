---
name: update-boundaries
description: Bring a boundary map up to date with the code: list what changed since its revision, work out what that does to the map, and review the result. Use after changes land, or when someone asks whether the map is current.
---

# Update boundaries

The map describes one reviewed revision. An update moves it to a later one by looking only at what changed, so it keeps every decision made in earlier reviews.

## Before you start

- Load the `use-boundary-model` skill. If it is unavailable, say so and stop.
- Find the map at its location. Without one, use `extract-boundaries` instead.
- Take the target revision from the caller. Without one, use the head of the main branch.
- Keep working files outside the repository, as `extract-boundaries` does.

## Method

1. **List the changes.** From the repository root, run `node <this skill's folder>/scripts/find-delta.mjs <map> <target>` and save its report in the working folder. It sorts every changed file by the place the map gives it, and lists the boundaries touched directly, those a change inside could reach, and those with nothing changed.
2. **Read why things changed.** For each commit, read its message. For each merged pull request, read its description, its issue, and the plans and documents it changed. These tell you what to look for; the code decides what exists.
3. **Work out the delta.** Go through the boundaries touched directly, then those a change could reach. Read the changed code against the map, and write each difference in `delta.md` in the working folder, marked NEW, MODIFIED, or REMOVED, for any consumer, provider, component, interface, area, capability, or resource. Leave boundaries with nothing changed alone.
4. **Settle the rest of the report.**
   - Give every file with no place a place, or a new element if it is one.
   - Fix evidence that moved or went away.
   - Remove cleanup candidates the changes dealt with, and add new ones.
5. **Apply the delta to a copy of the map**, and set its revision to the target. Follow `use-boundary-model`, and the output format of `extract-boundaries`. Keep existing names and earlier decisions unless the code contradicts them; a contradiction is a question for the review.
6. **Review.** Use `review-boundaries` with the delta as its scope. When nothing changes for any consumer or component, say so in a line, and move the revision without questions.

When most components changed shape, say so, and suggest a full extraction and review instead.
