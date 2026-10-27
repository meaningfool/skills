---
name: use-boundary-model
description: Describe a system as its consumers see it — who uses it, for what, through which interfaces — kept apart from how it is built. Use when defining, shaping, extracting or reviewing boundaries.
---

# Use Boundary Model

## Concepts

- **Goal**: what a consumer wants to achieve by using the provider, in the consumer's own terms.
- **Boundary**: the line across which a provider exposes resources and capabilities to a consumer. There is one boundary per consumer–provider pair, whatever the number of interfaces.
- **Consumer**: the role that uses the provider to get something done, defined by its goals. At Level 1 the consumer is external: a person or another system.
- **Provider**: the component exposing resources and capabilities across a boundary, as the consumer perceives it.
- **Component**: a system or a part of a system. Both sides of a boundary are components, except the external consumer at Level 1. A component can contain lower-level components.
- **Resource**: something with a state that the consumer cares about in their domain.
- **Relationship**: a meaningful link between resources.
- **Capability**: something the consumer can do with the provider, through one or more interfaces, to get a result.
- **Area**: a group of a boundary's capabilities that serve one purpose for the consumer, either core or supporting.
- **Interface**: the concrete channel through which the consumer observes resources or exercises capabilities.
- **Resource property**: a consumer-visible attribute, status, timestamp, flag, count, error, or structured detail on a resource.

Related concepts:

- **Interaction**: a concrete story of a capability happening through a specific interface.
- **Output**: what a capability or interaction gives, changes, reveals, sends, produces, or causes from the consumer's perspective.
- **Representation**: a consumer-visible form of a resource, property, or output in an interface.
- **Implementation choice**: a current or proposed runtime, framework, deployment unit, process, database, or hosting arrangement used to implement a provider or responsibility. It does not create a boundary by itself.

## General guidelines

- Take the consumer's perspective at every level: describe what the consumer deals with, not how it is delivered.
- Give everything a consumer can see or do a place in a boundary, without turning behind-the-scenes behavior into extra boundaries or capabilities.
- Include every tool or app someone uses to get something done with the system, including internal ones such as a testing tool or a sample integration. Leave out machinery nobody uses for a purpose of their own, such as health checks, clean-up jobs, or routing.
- Several models are usually possible: prefer the simplest.
- Ground your modelling in the stories of how external consumers use the system. Don't assume or invent.

### Levels

- Model external boundaries by default. This is Level 1: the external consumers and the system they use. Level 1 boundaries are external.
- Level 2 opens the system: name the components it is made of and, for each one, which Level 1 areas it delivers. Then describe the boundaries between those components, and between a component and an outside service it uses.
- Every boundary below Level 1 is internal, including those with outside services. The deeper the level, the deeper the layer of the system's architecture it describes.
- Go one level deeper by opening a component the same way. Write every boundary the same way at every level, and use the same names at every level, so a reader can trace a Level 1 area down to the components that deliver it.

### Notation

```text
Resources of <Provider>: <Resource> · <Resource>

<Consumer> <-> <Provider>
  Interfaces: <interface> · <interface>
  <Area> (core)
    <Capability> · <Capability>      [<interface>, when not every interface offers it]
  <Area> (supporting)
    <Capability>
```

At Level 2 and below, start with `Components of <Provider>: <Component> — <responsibility>; serves <Consumer> › <Area>`.

## Guidelines per concept

### Goal

- State a goal as an outcome in the consumer's domain, not as a feature, a screen, or a step.
- A goal is reached through one or more capabilities, usually in the core area.

Examples:

- "Get paid for an order" is a merchant's goal. "Use the checkout page" names an interface, and "submit card details" is an interaction.

### Boundary

- A boundary is about observable behavior: it does not include internal state the consumer cannot see or does not care about.
- A boundary points one way: from the consumer, who wants something, to the provider, who delivers it. Everything exchanged to deliver it belongs to that boundary, whichever side sends it.
  - Do: put a callback, webhook, or push that delivers a result inside the boundary whose capability it completes.
  - Don't: create a second boundary in the opposite direction because the provider calls the consumer back.
- List the boundary's interfaces once. When not every interface offers a capability, tag the capability with the interfaces that do.

Examples:

- A web UI and a mobile app for the same warehouse operator are two interfaces of one boundary. A capability only one of them offers is tagged with it.
- A local admin UI may expose fixture reset, seeded data, and debug-only modules that production never exposes. Tag those capabilities with that interface. If they serve a different goal, such as a developer resetting test data, they belong to that consumer's boundary.
- A product user-facing web app and an internal operator CLI are different boundaries because their consumers differ, even if both ultimately call the same backend functions.
- A payment provider's webhook telling the merchant a payment settled completes the merchant's "take a payment" capability. It is not a separate boundary from the provider to the merchant.

### Consumer

- Model a role more than a specific person, so one person can hold many roles.
- Merge role names that share goals and capabilities, since documents often use several names for one role. Split only where goals or capabilities diverge.

Examples:

- A requester and an approver may be the same employee, but they may be modeled as different consumers or as a single consumer with a permission attribute.
- Free and paid users may stay one consumer with a plan attribute until their goals, capabilities, or resource model diverge enough to create different boundary stories.
- "Customer", "account owner", and "key holder" in different documents are one role when their goals and capabilities are the same.

### Provider

- Default to the product or system being designed unless another provider is clearly visible to the consumer. Its apps, servers, background services, and the third-party services it relies on are inside it.

Examples:

- A payment processor is a provider for a merchant. A fraud-scoring module inside it is not a provider to the merchant unless fraud review is exposed, but it may be a provider to internal components or to a fraud analyst who directly works with it.
- A feature-flag service is not a provider to end users when it only selects variants behind the scenes. It is a provider to release managers if they configure flags, inspect rollout state, or trigger rollbacks.
- A product that uses a hosted identity service for sign-in stays the provider of sign-in, unless its users knowingly go to the identity service's own pages and treat it as a separate service.

### Component

- A component holds its own responsibility, authority, or lifecycle. Being separately deployed, stateful, or named in the architecture does not make something a component.
- Name a component for its stable responsibility, not its technology.
- A client that only presents or relays an interface is evidence for that interface, not a component.

Examples:

- Opening an online store shows a storefront component (serves Shopper › Browsing and Ordering), a payments component (serves Shopper › Ordering), and an inventory component. The storefront asks payments to charge an order; the card network is an outside service of the payments component.

### Resource

- Removing it would make the boundary lose important meaning.
- Check that it is not really a property of another resource, a representation, internal or debug state, a credential used only to get access to something else, a setting or limit, the record a capability leaves behind, or a stream with no state of its own.
- Define each resource once per provider, under one name, and reference it from every boundary that uses it. Note where a consumer sees it differently.
- Watch for REST/API/database drift: in this model, resources are consumer-recognized concepts, not necessarily endpoints, records, tables, or persisted objects.

Examples:

- An invitation link may be a resource if the consumer can disable, regenerate, expire, or inspect it. The copied URL and QR code are representations of that link.
- A bank statement is a resource when consumers can select, filter, and manage it. The PDF export of a bank statement is only a representation of that resource.
- An API key is a resource in the account and access area, where the customer creates and revokes it. In the API itself it only authenticates calls, so it is not one of the API's resources.
- A rate limit is a constraint of the API, not a resource.
- A balance changes through recorded adjustments. The balance is the resource; each adjustment record is how "adjust balance" is implemented.
- A live progress stream delivers "follow an order". The order and its status are the resource and its property; the stream is not a resource.

### Relationship

- Document cardinality.
- Document the nature of the relationship in plain language.

Examples:

- A catalog contains many products. A product is part of at least one catalog.
- A webhook subscription receives updates about payments received by the merchant.

### Capability and interaction

- A capability interacts with resources in at least one mode:
  - Mutates: modifies one or multiple resources.
  - Observes: exposes one or multiple resources' state, usually through a representation.
  - Produces: creates an output that depends on one or more resources as input.
  - Reacts: acts when one or multiple resources come to meet some condition.
- If a capability does not interact with at least one resource, either the resources are under-described or the capability is not really part of this boundary.
- Ask what output the capability creates: a resource, property change, representation, notification, or side effect.
- Name a capability with a verb, in the words the consumer would use: "Change order status", not "Manage order lifecycle".
- These are usually not capabilities: an interaction, click, or endpoint; a check of another capability; a step, retry, or continuation inside one; something the provider does to the consumer, such as enforcing a limit; an implementation task; an automated process, although what a consumer does with its output can be one.
- Consumer/provider interactions are identified through interaction stories, for example: "The employee submits a time-off request through an HR portal."
- Identifying interactions and their specifics allows inferring the model's core concepts because they reveal the consumers, providers, interfaces, resources, and capabilities expected.

Examples:

- Creating, editing, and deleting an invitation link are capabilities. Opening or copying the link are interactions with its representations.
- Participating in a live session may be a capability. Opening the invitation, deciding to begin, submitting a response, and finishing may all be interactions inside it; they should not become separate capabilities just because they happen in sequence. At a more detailed level, starting and finishing may become independent capabilities when consumers do them independently; reconnecting stays part of participating.
- Selecting an empty document and selecting a populated document can be the same interaction with different resource state, not two capabilities.
- Checking whether a coupon is valid is a step of paying. Checking seat availability is a traveler's goal in its own right.
- Retrying or recovering an uncertain start is part of starting.
- A nightly job that builds a report is not a capability. Reading the report, or subscribing to it, is.

### Area

- Give each boundary one core area, holding what the consumer comes for. Put what they would skip if they could, such as account and access, credits, or settings, in supporting areas.

Examples:

- In a store, browsing and ordering form the core area; sign-in, saved cards, and the loyalty balance are supporting areas.

### Interface

- It is clearly identifiable by its user (the consumer).
- It is a channel or product surface where interactions happen, not every screen or widget inside that channel.
- It can be external or internal: product UI, admin UI, operator CLI, agent script, public API, partner API, webhook endpoint, service-to-service API, scheduled-job runner, or another control-plane surface.
- It is not merely implementation plumbing. A database table, repository adapter, backend module, or server function is not an interface unless the consumer directly invokes that thing as the access surface.
- If the only current access is through a framework developer tool such as a console, REPL, or framework CLI command, label it a provisional developer control-plane interface and note that no designed interface exists yet.

Examples:

- A partner API may be an interface; one endpoint is usually an interaction surface, not a separate interface.

### Resource property

- It describes a resource without becoming an object of concern on its own.
- Keep statuses, flags, counts, timestamps, and errors as properties unless they become independently actionable.

Examples:

- Payment status, statement date, retry count, and transcript length are usually properties.
- A receipt number may be a property until consumers search, dispute, reconcile, or manage receipts independently; then Receipt may be a resource.

### Output

- An Observes capability usually outputs a representation of resource state.
- A Produces capability may output a new resource, a representation, or a side effect.
- Do not model an output as a resource unless the consumer can identify, manage, relate, or act on it independently.

Examples:

- An alerting capability sends notifications. Alerts are likely a resource that can be managed. Notifications are probably just an output, unless they can be managed system-wide as their own object of concern.

### Representation

- Resources are exposed to consumers through representations; not directly.
- A representation can become a resource when it gains consumer-visible identity, lifecycle, relationships, or capabilities.

Examples:

- A chart and table can represent the same report data. If consumers name, share, schedule, or permission a saved report, Saved Report may be the resource.

### Implementation choice

- If another technology could preserve the contract and ownership, keep the choice outside the boundary model.
- Record choices that affect feasibility, sequencing, or risk as architecture constraints.

Examples:

- A stateful actor or a serverless function may implement a run lifecycle controller. Model the responsibility as the component unless its platform-specific contract is in scope. A process that only hosts request handling is not automatically a provider.
