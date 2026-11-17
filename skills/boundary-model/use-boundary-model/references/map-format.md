# Boundary map format

A boundary map is one JSON file that follows [`boundary-map.schema.json`](../assets/boundary-map.schema.json). This example is the Store of the model, cut down to three boundaries:

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
          "serves": [{ "consumer": "Shopper", "area": "Shop" }],
          "parts": [{ "name": "Routes", "why": "pass requests on" }]
        },
        {
          "name": "Payments",
          "description": "…",
          "resources": ["Charge"],
          "serves": [{ "consumer": "Shopper", "area": "Shop" }],
          "parts": []
        }
      ]
    }
  ],
  "outsideServices": [{ "name": "Card network", "description": "…", "resources": ["Card authorization"] }],
  "resources": [
    { "name": "Order", "description": "…", "properties": ["status"] },
    { "name": "Charge", "description": "…" },
    { "name": "Card authorization", "description": "…" }
  ],
  "interfaces": [
    { "name": "web shop", "description": "…" },
    { "name": "charges API", "description": "…" },
    { "name": "card network API", "description": "…" }
  ],
  "places": [
    { "place": "Storefront", "kind": "component", "paths": ["src/storefront/**"] },
    { "place": "Payments", "kind": "component", "paths": ["src/payments/**"] },
    { "place": "Tests", "kind": "tooling", "paths": ["**/*.test.*"] }
  ],
  "boundaries": [
    {
      "consumer": "Shopper",
      "provider": "Store",
      "interfaces": ["web shop"],
      "areas": [
        {
          "name": "Shop",
          "type": "core",
          "description": "…",
          "capabilities": [
            {
              "name": "Place order",
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
          "name": "Charge orders",
          "type": "core",
          "description": "…",
          "capabilities": [
            {
              "name": "Charge order",
              "takes": "an order and a card",
              "gives": "the charge",
              "acts": [{ "mode": "produces", "resource": "Charge" }]
            }
          ]
        }
      ],
      "evidence": [{ "path": "…", "shows": "…" }]
    },
    {
      "consumer": "Payments",
      "provider": "Card network",
      "interfaces": ["card network API"],
      "areas": [
        {
          "name": "Authorize card payment",
          "type": "core",
          "description": "…",
          "capabilities": [
            {
              "name": "Authorize card payment",
              "takes": "a card and an amount",
              "gives": "an authorization or a decline",
              "acts": [{ "mode": "produces", "resource": "Card authorization" }]
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

## Rules

- Define each resource and interface once, at the top, and refer to it by name everywhere else.
- Every consumer, provider, component, outside service, resource, interface, and area has a one-sentence `description` that says what it is, in plain words.
- `resources`, on a provider, component, or outside service, lists the resources it keeps, as the Resource guidelines of the model say.
- A provider or component is opened when it lists `components`. `parts` holds its pieces that are not components, each with why.
- A component that sits inside two providers or components is defined under the first, and named in the second's `sharedComponents` with the areas it serves there.
- `relationships`, on a provider or component, may say how its resources link and with what cardinality, as the Relationship guideline says.
- A boundary sits at the level of its consumer: a consumer of the system at Level 1, a component inside its provider.
- Every capability says what it `takes` and `gives`. Leave out its `interfaces` when every interface of the boundary offers it.
- A mode is `observes`, `mutates`, `produces`, or `reacts`, as the Output guidelines of the model define them.
- `places` says where the corpus's files sit, by folder where a whole folder shares one place: `kind` is `component` or `interface`, with that element's name, or `library`, `tooling`, `excluded`, or `cleanup`, with a name of your own. An update uses them to trace a change to its boundaries.
- `questions` holds the choices no rule settles, `cleanupCandidates` what looks legacy or temporary, and `excluded` what was left out on purpose, one line per kind.
- `system.revision` is the commit the map describes, or `unknown` when there is none; a map with an unknown revision cannot be updated, only extracted again.
- Use an empty array for an empty list.

## Checks

Run `node <this skill's folder>/scripts/check-map.mjs <map.json>`. It needs Node 18 or later, and lists each problem it finds:

- The map breaks the schema.
- A name refers to nothing the map defines, or two things share a name.
- A capability works on no resource, or on one its provider does not keep.
- One interface is used by two providers.
- A boundary has no core area, more than one, a core area with no capability, or no evidence.
- A consumer or an outside service is on no boundary, or a resource has neither a capability nor properties.
