---
name: visualize-boundaries
description: Check a boundary map JSON file and draw it as one HTML page for review, one open box at a time, with who uses it, its interfaces, capabilities, components, resources and what it uses. Use when someone wants to see or review a boundary map, whenever it was made.
---

# Visualize boundaries

Turn one boundary map into one self-contained HTML page, and into still images for a review. The map stays the source and the page is a view of it: regenerate the page whenever the map changes, and never edit the page by hand.

## Run

1. Take the map's path from the caller, or use the location in `use-boundary-model`. Take the page's path from the caller too; without one, write the page outside the repository, in the project's scratch location when its instructions name one, otherwise in a temporary folder.
2. Run `node <this skill's folder>/scripts/render-map.mjs <map.json> <page.html>`. It needs Node 18 or later, and the `use-boundary-model` skill installed beside this one: it checks the map with that skill's checker before drawing it.
3. Open the page in a browser. It works from a file; its fonts load from Google Fonts when online.
4. Report the counts the script printed, to show the whole map was read, and how far the map is behind the main branch when it says so.

If the script lists problems, it writes no page. Each one is a place where the map breaks the format or names something it does not define: fix the map, not the page.

For still images, run `node <this skill's folder>/scripts/shoot-map.mjs <page.html> <folder>`. It writes one image of All providers and one of each box that opens, each named by how deep its screen is and the path to it, such as `2-store--payments.png`. Under the drawing, each image gives the descriptions of what it shows. It needs Chrome, Chromium, or Edge; without one it gives the address to start from.

## What the page shows

Each screen shows one open box. Going to another screen replaces it, so every screen stays about as busy as the last.

- **All providers**: each provider in a row with the consumers that use it. The page opens on the provider named after the system when there is one, and here otherwise.
- **An open box**, a provider, a component or an outside service, is a frame with columns: who uses it, its interfaces as dots on its edge, its capabilities grouped by area, the components inside it, and what it uses. Each component sits level with the capabilities it handles. A component shared with another provider or component sits in both. An outside service that a component calls sits as a dashed box in the column after its callers.
- Every box is coloured by kind and lists the resources it keeps. Plain lines join consumers to interfaces, interfaces to capabilities, and components to what they depend on.
- A box opens when its screen would show something of its own: components inside it, or capabilities it offers across a boundary of its own. Open, the bar at the foot of the box, goes inside. The box grows into the new frame while the boxes on both screens move to their new places.
- Clicking a box, an area, an interface or a resource lights what it connects to: what it calls, what calls it, what it handles and what it keeps. A lit box whose inner components are not on the screen says what each of them does. The panel beside the map adds only what the map does not show: descriptions, capability lists, and a resource's properties.
- The path above the map keeps the way you came, and Back returns to the previous screen with its scroll and selection.

## Limits

- The page reads only the map format of `use-boundary-model`, and draws only a map that passes its checks.
- A screen draws the open box's own boundaries in full, but the boundaries between its components only as lines. The map records which component handles an area, not which component an interface leads to.
- Areas with the same name from different consumers are drawn as one box.
- The page does not draw parts, relationships, places, questions, cleanup candidates or exclusions.
