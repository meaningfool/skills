---
name: review-boundaries
description: Walk a person through a boundary map level by level, with still images and short questions, and apply what they decide. Use after extracting or updating a map, or when someone wants a map reviewed.
---

# Review boundaries

A map is finished when a person has reviewed it. Code settles what exists; only people settle what the parts are called, which ones matter, and whether the map reads clearly. This skill turns a draft into the map at its location.

## Before you start

- Load the `use-boundary-model` skill. If it is unavailable, say so and stop.
- Take from the caller the draft map and the scope: the whole map, or the changes an update lists.
- Work on a copy in the working folder. The map at its location changes only when the review ends.

## Prepare a level

1. Draw the draft with `render-map.mjs` from the `visualize-boundaries` skill, then run `node <that skill's folder>/scripts/shoot-map.mjs <page.html> <folder>`. Each level gets a folder with an overview and one image per boundary. Every image carries the definitions of what it shows, so nobody needs to open the page.
2. Before asking anything, check the level against the code, and against the project's plans and vocabulary. A question you can settle by reading is not a question.
3. Look for what a person would stumble on:
   - **Names** that the code, the product or the plans do not use, and the same word used for different things.
   - **Definitions** a newcomer could not follow.
   - **Capabilities that are really steps**: they sound like tasks rather than something the consumer wants.
   - **Interfaces** named after types rather than what they are for.
   - **Boundaries that share a contract** but offer different capabilities.
   - **Components** that keep nothing and decide little, and **resources** that are only properties of another resource.
   - **Facts the draft got wrong**: open the code for every capability you doubt.

## Walk the levels

Go from the top down, one level at a time. In an update, show only the levels the changes reach.

1. Send the images first: the overview, then the boundaries with something to decide or to read closely. Add a link to the page as an extra, never as the only way to see the map.
2. Ask at most five questions. Each one gives the choice in plain words, the fact behind it, and your suggestion.
3. List what stays unless they object. Say which choices already match an earlier review.
4. Keep the text short: they are reading the images. Then stop and wait.
5. Apply the answers before you show the next level, so its images already include them. Remove from `questions` each entry an answer settles.

When a person finds a part unclear, do not defend it in prose. Check the code, draw the alternatives as separate copies of the draft, send their images side by side, and recommend one. Adopt the person's own wording when they give it.

## Finish

- Run `render-map.mjs` on the final draft and fix each problem it lists. Check that every evidence path still exists.
- Write the map at its location, as `use-boundary-model` describes.
- Report what changed, what stays open, and the map's revision.
