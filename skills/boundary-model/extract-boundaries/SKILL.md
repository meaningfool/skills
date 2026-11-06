---
name: extract-boundaries
description: Map an existing system's boundaries from its repository — documentation and code, or code alone — with the boundary model, from its external consumers down through its components. Use when recovering how a system already serves its consumers.
---

# Extract boundaries

Write one JSON map of a system's current boundaries at the output path, using the concepts and levels of the `use-boundary-model` skill and the format of `boundary-map.schema.json` in the `visualize-boundaries` skill.

## Before you start

- Load the `use-boundary-model` skill. It defines the concepts and the levels; this skill adds only how to extract them from a repository. If it is unavailable, say so and stop.
- Read `boundary-map.schema.json` in the `visualize-boundaries` skill. It defines the map's format. If it is unavailable, say so and stop.
- Take three inputs from the caller: the system to map, the corpus (the repository material included and excluded), and the output path. Ask for a missing system. Without an output path, use the map's location in `use-boundary-model`, and ask before replacing an existing map. Without a stated corpus, include the whole repository except dependencies, generated output, and secrets, together with its version-control history, read only. Record the source revision when available, for example with `git rev-parse HEAD`.
- Stay inside the corpus: do not read, cite, or take names from excluded material.
- Keep working files in a folder outside the repository, in the project's scratch location when its instructions name one, otherwise in a temporary folder. A caller can name the folder. It is not part of the corpus.

## Extraction rules

- **Code decides what exists.** Documents carry intent, history, plans, and vocabulary; they can be outdated, aspirational, inconsistent, or written from an implementation perspective. Use them to understand the domain and reconcile its vocabulary, then verify every candidate against current code and configuration. Exclude a boundary that is documented but absent from the code, with that reason. Keep the consumer's perspective where a document frames a boundary technically.
- **Code structure is evidence.** Deployment units and the connections between them, databases, tables, routes, functions, and adapters show where boundaries are; they are not boundaries or components by themselves. An interface alone does not make a boundary: it also needs a resource the consumer recognizes and a capability that works today.
- **Evidence has an order.** Decide components and their boundaries from the strongest evidence first:
  1. Seams the code enforces: architecture and boundary checks, import and visibility rules such as private or internal modules, typed contracts, and the code that registers implementations, such as a plugin registry or dependency-injection setup.
  2. Which part writes which data.
  3. Which part decides what.
  4. Files that change together in the history.
  5. Folders, deployment units, and wiring, which group code without separating it.
- **Local and deployed forms of the same thing are one boundary** unless what the consumer gets differs.
- **Components follow `use-boundary-model`.** Test each part of a provider against its component guideline. In code, what a part exposes is an API, an internal service endpoint, or a contract declared in code; a part that only passes requests on is not a component. Test parts by contract, not by folder: a folder can hold pieces written to different contracts, and each piece takes the component test on its own. A group of files that an architecture check gives rules of its own is a part of its own, even when other parts import it.
- **Inner boundaries come from the contract.** Below Level 1, take a boundary's capabilities from the operations the consumer calls on the provider's contract, grouped by what the consumer gets back, and its resource from the state those operations read and change. Apply the look-alike test from the checks to each operation, and ask whether the consumer would call it if the other operations did not need it. One it would not call, such as a keep-alive, an acknowledgement, a retry, or a clean-up after a failure, is a step of the operation it serves, not a capability. Reuse a resource of the level above only when the contract works on it directly.
- **Interfaces name what is used.** Between components, name the interface after the contract between them; what the provider sends back to complete a capability, such as a delivery or a callback, travels inside that interface. For an outside service, name what the component actually uses, as its configuration and credentials show: an API it calls, or tokens it only verifies.
- **Engineering tooling is a separate perimeter.** Leave out what works on the system itself, as `use-boundary-model` describes, unless the caller asks for it, and list it in `excluded`, one line per kind. Read architecture and boundary checks anyway, as evidence: they state which parts may reach which.
- **Show what looks legacy or temporary.** List old hosts, redirects, bridges, compatibility paths, and similar transitional pieces in `cleanupCandidates`, saying what each is and why it looks transitional.
- **Write for someone who does not know the code.** Name consumers, components, resources, and capabilities in plain words. Name a capability with a short verb phrase and put what it takes and gives in parentheses after it, such as "Cancel an order (takes the order; gives the refund)". In every list, say what an item is before saying why it is there.

## Reading by altitude

- Read the top altitude in full, yourself: the documents that describe the product and its users (overviews, READMEs, product or context documents) and the documentation index if there is one. Then read in full the current guides and contracts written for the system's users and operators.
- Read deeper as you zoom in: in a provider's round, read the design documents that describe it, chosen from the index or their titles. Open research and prototypes only to answer a specific question.
- Choose what to read, then read it. A keyword search tells you where to look, not what a document says, and reading the whole corpus would exhaust your context.
- When the reading is substantial, delegate the broad sweep to parallel subagents on a small, fast model, giving each the corpus limits. Each reads its share in full and returns structured notes, also saved in the working folder: consumers and their goals, capabilities, resources and vocabulary, claims that look outdated or aspirational, and the files behind each note.
- Ask readers for facts, such as routes, screens, commands, stored records, and the calls between parts, not for the names you expect to find: a brief that suggests names steers what readers report. When a reader reports a contract, an interface, a check, or a registry, it quotes the type, signature, or rule with its path.
- Read the **deciding files** yourself: architecture and boundary checks, contract and interface definitions, the code that registers implementations, and the configuration of service connections and credentials. Readers point you to them; decide from the files, since a summary flattens the structure a decision rests on.
- Read the history for change coupling: list the files changed together over recent months, for example with `git log --since=<date> --name-only --format=%h`, and note the groups that keep changing together.
- With little or no documentation, the consumer-facing surface in code is the top altitude.

## Method

Work in rounds, one level at a time: each round searches for the evidence its decisions need, and its decisions set what the next round searches. Once no component is left to open, you read the contract behind each inner boundary, a writer drafts the map, and you review the draft into the final map.

1. **Consumers and Level 1.** Read by altitude until you can say who uses the system, what each role wants from it, and in what words. Then search the consumer-facing surface in code, such as UI routes and screens, CLI commands, public APIs, entry points, and the tests that exercise them, for consumers and capabilities the documentation missed. Decide one boundary per consumer.
2. **One round per level.** Keep the providers still to open in `open-list.md` in the working folder, starting with the Level 1 providers inside the system. Each round takes every provider on the list at once:
   - Search their insides: read their design documents, then search the code yourself or through readers briefed on each provider in parallel, from the entry points behind its interfaces, for its parts, what each part keeps, which parts call which and through what, and the outside services they use.
   - Decide yourself, with the whole system in view and its deciding files read. For each provider, list its parts in `open-list.md`, test each part against the component guideline in `use-boundary-model`, and write each result with the files behind it. A verdict without its parts, such as "one store" or "variants of one contract", does not count.
   - Open a provider when two or more of its parts are components, and put those components on the list. Leave it closed otherwise.
   - Decide whether a component opens in the round after the one that found it, never in the same round. When the evidence cannot settle a part, search again rather than leave it undecided.
   - Stop after a round in which no provider opens.
3. **Inner boundaries.** For every boundary below Level 1, open the contract the consumer calls and list its operations. Write in `boundaries.md` in the working folder the interface, capabilities, and resource they give, following the rule for inner boundaries, with the contract's path. The step is done when every boundary below Level 1 has its entry.
4. **Draft.** Save your own notes in the working folder, beside the readers' notes, the list, and `boundaries.md`. Then start a writer subagent on your own model: load this skill and `use-boundary-model`, skip this method, and write the complete map from the working folder's evidence alone, without further reading, following the extraction rules, the checks, and the output format, to `draft.json` in the working folder.
5. **Review into the final map.** Check the draft against the rules of `use-boundary-model` and the evidence, reading the corpus again when needed, and write the reviewed draft to `map.json` in the working folder yourself. List in `questions` each choice that no rule settles, including those the draft raises, with the choice you made and the one you did not.
6. **Check before finishing.**
   - Read every boundary, at every level, as its consumer would. Fix any whose provider is a technical artifact, or whose capabilities are steps, provider behavior, or engineering mechanics.
   - Every consumer and goal found while reading has a boundary, a cleanup candidate, or an exclusion line.
   - Every boundary has its interfaces, a core area with at least one capability, and at least one evidence file.
   - Every capability names at least one resource it works on, with its mode, and every resource it names is listed.
   - Every capability gives its consumer an output they want for itself, as described for its mode in `use-boundary-model`.
   - A capability that fails either test is a look-alike: fold a step into the capability it belongs to, and list provider behavior in `excluded`.
   - Every part in `open-list.md` is a component or sits in its provider's `parts`, with why it is not one.
   - Every capability below Level 1 matches an operation of the contract its interface names, and every interface between components names a contract the code declares.
   - Every source file in the corpus has one place: a component, an interface, engineering tooling, or a cleanup candidate. Write the places in the map's `places`, by folder where a whole folder shares one place, and settle every file left over.
   - No call between components goes around their contract: search the imports between the files of different components, and settle each one that reaches past the contract.
   - Every element has a description a newcomer can follow, and every capability says what it takes and gives.
   - Every evidence path is an existing file: check each one from the repository root, for example with `test -f <path>`.
   - The map passes the checks of the format: run `node <the visualize-boundaries skill's folder>/scripts/render-map.mjs <working folder>/map.json <working folder>/map.html` and fix each problem it lists.
7. **Review.** Use `review-boundaries` with the whole map as its scope; it writes the map at the output path when the person is done. When no person is there, as in an unattended evaluation, write the map at the output path yourself and say it is unreviewed.

## Output format

The map is one JSON file that follows `boundary-map.schema.json`.

```json
{
  "system": { "name": "Store", "description": "…", "corpus": { "included": "…", "excluded": "…" }, "revision": "<commit, or unknown>" },
  "consumers": [{ "name": "Shopper", "description": "…" }],
  "providers": [
    {
      "name": "Store",
      "description": "…",
      "resources": ["Order"],
      "parts": [{ "name": "Web app", "why": "a client, part of an interface" }],
      "components": [
        {
          "name": "Storefront",
          "description": "…",
          "resources": ["Order"],
          "serves": [{ "consumer": "Shopper", "area": "Shopping" }],
          "parts": [{ "name": "Routes", "why": "pass requests on" }]
        }
      ]
    }
  ],
  "outsideServices": [{ "name": "Payments", "description": "…", "resources": ["Charge"] }],
  "resources": [
    { "name": "Order", "description": "…", "properties": ["status"] },
    { "name": "Charge", "description": "…" }
  ],
  "interfaces": [
    { "name": "website", "description": "…" },
    { "name": "charges API", "description": "…" }
  ],
  "places": [
    { "place": "Storefront", "kind": "component", "paths": ["src/storefront/**"] },
    { "place": "Tests", "kind": "tooling", "paths": ["**/*.test.*"] }
  ],
  "boundaries": [
    {
      "consumer": "Shopper",
      "provider": "Store",
      "interfaces": ["website"],
      "areas": [
        {
          "name": "Shopping",
          "type": "core",
          "description": "…",
          "capabilities": [
            {
              "name": "Place an order",
              "takes": "a cart",
              "gives": "a confirmed order",
              "acts": [{ "mode": "produces", "resource": "Order" }]
            }
          ]
        }
      ],
      "evidence": [{ "path": "<repository-relative path>", "shows": "<what it shows; no line ranges>" }]
    },
    {
      "consumer": "Storefront",
      "provider": "Payments",
      "interfaces": ["charges API"],
      "areas": [
        {
          "name": "Charging",
          "type": "core",
          "description": "…",
          "capabilities": [
            {
              "name": "Charge a card",
              "takes": "an amount and a card",
              "gives": "the charge",
              "acts": [{ "mode": "produces", "resource": "Charge" }]
            }
          ]
        }
      ],
      "evidence": [{ "path": "…", "shows": "…" }]
    }
  ],
  "questions": [{ "question": "…", "answer": "<the choice made> rather than <the alternative>; <why no rule settles it>" }],
  "cleanupCandidates": [{ "name": "…", "why": "<why it looks legacy or temporary>" }],
  "excluded": [{ "name": "…", "why": "<why it is out>" }]
}
```

- Define each resource and interface once, at the top, and refer to it by name everywhere else.
- Every consumer, provider, component, outside service, resource, interface, and area has a one-sentence `description` that says what it is, in plain words.
- A provider or component is opened when it lists `components`. `parts` holds its pieces that are not components, each with why.
- A component that sits inside two providers is defined under the first, and named in the second's `sharedComponents`.
- A boundary sits at the level of its consumer: a consumer of the system at Level 1, a component inside its provider.
- Leave out a capability's `interfaces` when every interface of the boundary offers it. Boundaries that share an interface offer the same capabilities through it.
- A mode is `observes`, `mutates`, `produces`, or `reacts`, as defined in `use-boundary-model`.
- `places` says where the corpus's files sit, by folder where a whole folder shares one place: `kind` is `component` or `interface`, with that element's name, or `library`, `tooling`, `excluded`, or `cleanup`, with a name of your own. An update uses them to trace a change to its boundaries.
- Use an empty array for an empty list.
