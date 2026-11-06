---
name: visualize-boundaries
description: Check a boundary map JSON file and draw it as one HTML page for review, with every boundary at a level, one boundary in focus, and the way inside each provider. Use when someone wants to see or review a boundary map, whenever it was made.
---

# Visualize boundaries

Turn one boundary map into one self-contained HTML page, and into still images for a review. The map stays the source and the page is a view of it: regenerate the page whenever the map changes, and never edit the page by hand.

## Run

1. Take the map's path from the caller, or use the location in `use-boundary-model`. Take the page's path from the caller too; without one, write the page outside the repository, in the project's scratch location when its instructions name one, otherwise in a temporary folder.
2. Run `node <this skill's folder>/scripts/render-map.mjs <map.json> <page.html>`. It needs Node 18 or later and nothing else.
3. Open the page in a browser. It works from a file; its fonts load from Google Fonts when online.
4. Report the counts the script printed, to show the whole map was read.

If the script lists problems, it writes no page. Each one is a place where the map breaks the format or names something it does not define: fix the map, not the page.

For still images, run `node <this skill's folder>/scripts/shoot-map.mjs <page.html> <folder>`. It writes one image per screen, level by level, each with the definitions of what it shows under the drawing. It needs Chrome, Chromium, or Edge; without one it lists the screens' addresses.

## What the page shows

Every level has the same two screens and the same moves:

- **All boundaries**: each consumer sits left of the providers it uses, so something that both uses and provides sits between them. One arrow per interface. Nothing is drawn inside a provider. Inside a provider, the provider becomes the frame around its components, and outside services sit outside the frame.
- **One boundary in focus**: the consumer, its interfaces on the provider's outline, the areas with their capabilities, then the resources each capability acts on.
- Selecting an element shows its details in the side panel and highlights its path. An interface's panel offers Focus; a provider's or component's panel offers Go inside when the map opens it. The back link names the screen above.
- Every element's panel gives its description. A provider's or component's panel lists its parts that are not components, with why.

## Limits

- The page reads only the format in [`boundary-map.schema.json`](boundary-map.schema.json), which `extract-boundaries` writes. The script also checks that every name refers to something the map defines, and that boundaries sharing an interface offer the same capabilities through it.
- Interfaces link to the areas they reach, not to each capability, so selecting a resource lights every interface that reaches an area acting on it.
