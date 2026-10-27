---
name: use-boundary-model
description: Describe a system as its consumers see it — who uses it, for what, through which interfaces — kept apart from how it is built. Use when defining, shaping, extracting or reviewing boundaries.
---

# Use Boundary Model

## Concepts

- **Boundary**: the line across which a provider exposes resources and capabilities to a consumer. There is one boundary per consumer–provider pair, whatever the number of interfaces.
- **Consumer**: the role that uses the provider to get something done. At Level 1 the consumer is external: a person or another system.
- **Provider**: the component exposing resources and capabilities across a boundary, as the consumer perceives it.
- **Resource**: something with a state that the consumer cares about in their domain.
- **Relationship**: a meaningful link between resources.
- **Capability**: something the consumer can do with the provider, through one or more interfaces, to get a result.
- **Area**: a group of a boundary's capabilities that serve one purpose for the consumer, either core or supporting.
- **Interface**: the concrete channel through which the consumer observes resources or exercises capabilities.
- **Resource property**: a consumer-visible attribute, status, timestamp, flag, count, error, or structured detail on a resource.

Related concepts:

- **Component**: either side of a boundary, except the external consumer at Level 1. The term exists because the same component can be a consumer in one boundary and a provider in another.
- **Interaction**: a concrete story of a capability happening through a specific interface.
- **Output**: what a capability or interaction gives, changes, reveals, sends, produces, or causes from the consumer's perspective.
- **Representation**: a consumer-visible form of a resource, property, or output in an interface.
- **Implementation choice**: a current or proposed runtime, framework, deployment unit, process, database, or hosting arrangement used to implement a provider or responsibility. It does not create a boundary by itself.

## General guidelines

- Give everything a consumer can see or do a place in a boundary, without turning behind-the-scenes behavior into extra boundaries or capabilities.
- Keep a resource or a capability only if removing it would make the boundary lose important meaning.
- Include every tool or app someone uses to get something done with the system, including internal ones such as a testing tool or a sample integration. Leave out machinery nobody uses for a purpose of their own, such as health checks, clean-up jobs, or routing.
- Several models are usually possible: prefer the simplest.
- Ground your modelling in the stories of how external consumers use the system. Don't assume or invent.
- Use plain language, in the consumer's own words.

### Levels

- Model external boundaries by default. This is Level 1: the external consumers and the system they use. Level 1 boundaries are external.
- Open a provider to get the next level: name the components it is made of and, for each one, which areas of the level above it delivers. Then describe the boundaries between those components, and between a component and an outside service it uses.
- Open a component the same way to go one level deeper, as many levels as the question needs. Every boundary below Level 1 is internal, including those with outside services; each level describes a deeper layer of the system's architecture.
- Write every boundary the same way at every level, and use the same names at every level, so a reader can trace a Level 1 area down to the components that deliver it.

Example:

- Opening an online store gives Level 2: a storefront component (serves Shopper › Browsing and Ordering), a payments component (serves Shopper › Ordering), and an inventory component, with the card network as an outside service of payments. Opening payments gives Level 3: a fraud check and a ledger.

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

- List each resource once per provider, under one name, and reference it from every boundary that uses it. Note where a consumer sees it differently.
- Below Level 1, start with `Components of <Provider>: <Component> — <responsibility>; serves <Consumer> › <Area>`.

## Guidelines per concept

### Boundary

- A boundary is about observable behavior: it does not include internal state the consumer cannot see or does not care about.
- A boundary points one way: from the consumer, who wants something, to the provider, who delivers it. Everything exchanged to deliver it belongs to that boundary, whichever side sends it.
  - Do: put a callback, webhook, or push that delivers a result inside the boundary whose capability it completes.
  - Don't: create a second boundary in the opposite direction because the provider calls the consumer back.

Examples:

- A web UI and a mobile app for the same warehouse operator are two interfaces of one boundary. A capability that only one of them offers names that interface, as in the notation.
- A product user-facing web app and an internal operator CLI are different boundaries because their consumers differ, even if both ultimately call the same backend functions.
- A payment provider's webhook telling the merchant a payment settled completes the merchant's "take a payment" capability. It is not a separate boundary from the provider to the merchant.

### Consumer and provider

- Model a consumer as a role more than a specific person, so one person can hold many roles. Merge role names that share goals (what they want to achieve) and capabilities, since documents often use several names for one role; split only where they diverge.
- Name as provider what the consumer believes it is using. The apps, servers, background services, and third-party services that deliver it stay inside it until a lower level opens it.

Examples:

- A requester and an approver may be the same employee, modeled as different consumers or as one consumer with a permission attribute. Free and paid users stay one consumer until their goals, capabilities, or resources diverge.
- "Customer", "account owner", and "key holder" in different documents are one role when their goals and capabilities are the same.
- A fraud-scoring module inside a payment processor is not a provider to the merchant unless fraud review is exposed, but it may be one to a fraud analyst who works with it directly. A feature-flag service is a provider to release managers who configure flags, not to end users.
- A product that uses a hosted identity service for sign-in stays the provider of sign-in, unless its users knowingly go to that service's own pages.

### Resource

- Check that it is not really a property of another resource, a representation, internal or debug state, a credential used only to get access to something else, a setting or limit, the record a capability leaves behind, or a stream with no state of its own.
- Watch for REST/API/database drift: in this model, resources are consumer-recognized concepts, not necessarily endpoints, records, tables, or persisted objects.

Examples:

- An invitation link may be a resource if the consumer can disable, regenerate, expire, or inspect it. The copied URL and QR code are representations of that link.
- A bank statement is a resource when consumers can select, filter, and manage it. The PDF export of a bank statement is only a representation of that resource.
- An API key is a resource where the customer creates and revokes it; in the API itself it only authenticates calls. A rate limit is a constraint of the API, not a resource.
- A balance is the resource; the adjustment records behind it are how "adjust balance" is implemented. A progress stream delivers "follow an order"; the order and its status are the resource and its property.

### Relationship

- State what links the resources and its cardinality.

Examples:

- A catalog contains many products. A product is part of at least one catalog.

### Capability and interaction

- A capability interacts with resources in at least one mode:
  - Mutates: modifies one or multiple resources.
  - Observes: exposes one or multiple resources' state, usually through a representation.
  - Produces: creates an output that depends on one or more resources as input.
  - Reacts: acts when one or multiple resources come to meet some condition.
- If a capability does not interact with at least one resource, either the resources are under-described or the capability is not really part of this boundary.
- Every capability gives the consumer an output; Output lists what each mode gives. If you cannot name the output, you are probably looking at a step or an interaction.
- Name a capability with a verb: "Change order status", not "Manage order lifecycle".
- Infer capabilities from interaction stories. "The employee submits a time-off request through the HR portal" gives the capability Request time off, on the resource Time-off request, through the HR portal interface.
- Some things look like capabilities but are not:
  - A step of another capability has no output of its own for the consumer: checking a coupon is part of paying, and retrying an uncertain start is part of starting.
  - What the provider does on its own is not something the consumer does: enforcing a rate limit, or a nightly job that builds a report. Reading the report is a capability.
  - An interaction is one occurrence of a capability in a story, not a capability of its own.

Examples:

- Creating, editing, and deleting an invitation link are capabilities. Opening or copying the link are interactions with its representations.
- Participating in a live session may be a capability. Opening the invitation, deciding to begin, submitting a response, and finishing may all be interactions inside it; they should not become separate capabilities just because they happen in sequence. At a more detailed level, starting and finishing may become independent capabilities when consumers do them independently; reconnecting stays part of participating.
- Selecting an empty document and selecting a populated document can be the same interaction with different resource state, not two capabilities.
- Checking seat availability is a traveler's goal in its own right, unlike checking a coupon.

### Area

- Give each boundary one core area, holding what the consumer comes for. Put what they would skip if they could, such as account and access, credits, or settings, in supporting areas.

Examples:

- In a store, browsing and ordering form the core area; sign-in, saved cards, and the loyalty balance are supporting areas.

### Interface

- It is clearly identifiable by its user (the consumer).
- It is a channel or product surface where interactions happen, not every screen or widget inside that channel.
- It can be external or internal: product UI, admin UI, operator CLI, agent script, public API, partner API, webhook endpoint, service-to-service API, scheduled-job runner, or another control-plane surface.
- It is not merely implementation plumbing. A database table, repository adapter, backend module, or server function is not an interface unless the consumer directly invokes that thing as the access surface.
- A client that only presents or relays the provider's capabilities, such as a thin CLI, is part of an interface, not a provider.

Examples:

- A partner API may be an interface; one endpoint is usually an interaction surface, not a separate interface.

### Resource property

- A property is a detail of a resource that the consumer does not identify or act on by itself. Whether something is a property or a resource depends on the context, not on what kind of thing it is.

Examples:

- A receipt number may be a property until consumers search, dispute, reconcile, or manage receipts independently; then Receipt may be a resource.

### Output

- Each capability mode gives a typical output:
  - Mutates: the changed resource or property. "Change order status" gives the order with its new status.
  - Observes: a representation of resource state. "Review past orders" gives a list of orders.
  - Produces: a new resource, a representation, or a side effect. "Export monthly statement" gives a PDF.
  - Reacts: a notification or a side effect. "Alert on low stock" sends a notification.
- Do not model an output as a resource unless the consumer can identify, manage, relate, or act on it independently.

Examples:

- An alerting capability sends notifications. Alerts are likely a resource that can be managed. Notifications are probably just an output, unless they can be managed system-wide as their own object of concern.

### Representation

- Resources are exposed to consumers through representations; not directly.
- A representation can become a resource when it gains consumer-visible identity, lifecycle, relationships, or capabilities.

Examples:

- A chart of monthly revenue is a representation of the report data. Once consumers save it, name it, and share it, it has an identity of its own and becomes a resource: Saved report.

### Implementation choice

- Its existence, isolation, or statefulness does not create a boundary.
- Replace technology names with stable responsibilities. If another technology could preserve the contract and ownership, keep the choice outside the boundary model.

Examples:

- A stateful actor or a serverless function may implement a run lifecycle controller. Model the responsibility as the component unless its platform-specific contract is in scope. A process that only hosts request handling is not automatically a provider.
