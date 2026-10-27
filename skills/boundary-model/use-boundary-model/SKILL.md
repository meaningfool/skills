---
name: use-boundary-model
description: Model a system from the outside, as its consumers see it — who uses it, for which goals, through which interfaces, on which resources — while keeping these contracts apart from how they are implemented. Use when defining, shaping, extracting or reviewing boundaries, or when deciding whether something is a consumer, provider, interface, resource, capability, area or implementation detail.
---

# Use Boundary Model

Use this as a lightweight model pass. When a call is close, read the worked examples in [boundary-model.md](./references/boundary-model.md).

A boundary is the contract between a consumer and a provider: the resources the consumer cares about and what it can do with them, through one or more interfaces. How the provider delivers that contract is implementation.

## Concepts

- **Consumer**: a role defined by its goals — a person, team, agent or system that uses a provider to achieve something. One person can hold several roles. Merge role names that share goals and capabilities; split only where goals or capabilities diverge.
- **Provider**: what the consumer perceives it is dealing with, usually the product or system as a whole. Its apps, servers, background services and the third-party services it relies on are inside it. Name another provider only when the consumer knowingly deals with it in its own right.
- **Boundary**: one consumer–provider pair, written `Consumer <-> Provider`. It holds the capabilities the consumer uses, grouped into areas, and the interfaces that offer them.
- **Interface**: a channel through which the consumer reaches the provider: a web or mobile app, CLI, API, webhook, scheduled job or another control surface. A boundary can have several. A screen, endpoint or command inside a channel is not an interface; neither is code (a module, table or function) unless the consumer invokes it directly.
- **Resource**: something with state that the consumer cares about in the domain. Define each resource once per provider, under one name, and reference it from every boundary that uses it. Note where a consumer sees it differently.
- **Resource property**: a consumer-visible attribute of a resource, such as a status, date, count, flag or error.
- **Relationship**: a link between resources, stating its nature or cardinality.
- **Capability**: something the consumer sets out to do with the provider that produces an output: a resource or property created or changed, a representation shown, a notification sent, or an external effect. It works in one or more modes: **mutate** resources, **observe** their state, **produce** an output computed from them, or **react** when they meet a condition.
- **Area**: a group of capabilities within a boundary that serve one purpose for the consumer. The **core** area holds what the consumer comes for. **Supporting** areas hold what they would skip if they could, such as account and access, credits or settings.

Related concepts:

- **Interaction**: one concrete occurrence of a capability through an interface. Stories of interactions reveal the model; they are not capabilities.
- **Representation**: a consumer-visible form of a resource or output, such as a QR code, chart or PDF. It becomes a resource when it gains identity, lifecycle or capabilities of its own.
- **Implementation choice**: a runtime, framework, deployment unit, process, database or hosting arrangement. It never creates a boundary by itself. Replace its name with the responsibility it holds, and record it as a constraint when it affects feasibility, sequencing or risk.

## Tests

Keep a **resource** only when it has state of its own and the consumer cares about it for its own sake. These usually fail:

- a credential or access artifact used only to reach something else (it is a resource only in the supporting area where the consumer manages it);
- a setting or limit (a property or a constraint);
- the record a capability leaves behind (the resource is what the capability changed);
- a stream or exchange with no state of its own (its state belongs to a resource property).

Keep a **capability** only when the consumer intends it as a goal and it produces an output for them. These usually fail:

- something the provider does to the consumer, such as enforcing a limit;
- a check or precondition of another capability;
- a step, retry or continuation inside another capability;
- an automated process (what a consumer does with its output can be a capability).

An observe capability is an ordinary capability; its area shows how much it matters.

## Rules

- Take the consumer's perspective at every level: describe what the consumer deals with, not how it is delivered.
- Read direction conceptually. A boundary runs from consumer to provider. A call back from the provider (a callback, webhook or push) that delivers the output of the consumer's capability belongs to that same boundary.
- Count every surface someone uses to reach a goal, including internal tools and reference consumers. A mechanism nobody uses as a goal — health checks, housekeeping, routing, deployment plumbing — is not a boundary.
- Attribute every consumer-observable behavior in scope to a capability. Do not invent boundaries or capabilities for supporting implementation behavior to satisfy this rule.
- Ground the model in stories of how people actually use the system. Do not assume or invent.
- Prefer the simplest model. When options of similar complexity cannot be settled from the context, show them with their tradeoffs.
- Watch for REST, API and database drift: resources are consumer concepts, not endpoints, records or tables.

## Levels

- **Level 1** shows each consumer and the provider it perceives. Start here.
- **Level 2** opens one provider. List its **parts**, each named for its responsibility and the Level 1 areas it serves. Then write the boundaries between parts, then the boundaries between parts and the **outside services** they use. A boundary is internal when both sides are parts of the opened provider, and external otherwise.
- A part holds its own responsibility, authority or lifecycle. Being separately deployed or stateful does not make something a part.
- Open a level only when the task asks for it or a design question needs it. Go deeper where a part has sub-parts with contracts of their own. Never open an interface as if it were a provider.
- Give every boundary the same shape at every level, and keep names identical across levels so a reader can follow an outer area to the part that serves it.

## Notation

```text
Resources of <Provider>: <Resource> · <Resource>

<Consumer> <-> <Provider>
  Interfaces: <interface> · <interface>
  <Area> (core)
    <Capability> · <Capability>      [<interface>, when not every interface offers it]
  <Area> (supporting)
    <Capability>
```

Below Level 1, start with `Parts of <Provider>: <Part> — <responsibility>; serves <Consumer> › <Area>`.
