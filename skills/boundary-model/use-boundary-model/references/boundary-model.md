# Boundary Model

## Core Model

### Boundary

The line across which a provider exposes resources and capabilities to a consumer.

Good boundary:

- The boundary is about observable behavior: it does not include internal state the consumer cannot see or does not care about.
- A boundary matches a triplet: consumer, provider, interface.
- Model external boundaries by default. Internal boundaries are valid when the user asks for them or when the current design question cannot be resolved without clarifying responsibility, authority, lifecycle, or an internal contract. Do not map unrelated internal structure.

Arbitration examples:

- A web UI and mobile app for the same warehouse operator are two interfaces exposing the same resources and capabilities. There are two distinct boundaries.
- A local admin UI may expose fixture reset, seeded data, and debug-only modules that production never exposes. Treat that as a different boundary or boundary variant even if the consumer and provider names look similar.
- A product user-facing web app and an internal operator CLI are different boundaries even if both ultimately call the same backend functions.

### Consumer

The role, actor, system, subsystem, or module for whom a capability is available.

Good consumer:

- Model a role more than a specific person, so one person can hold many roles.

Arbitration examples:

- A requester and an approver may be the same employee, but they may be modeled as different consumers or as a single consumer with a permission attribute.
- Free and paid users may stay one consumer with a plan attribute until their goals, capabilities, or resource model diverge enough to create different boundary stories.

### Provider

The system, subsystem, or module exposing resources and capabilities across a boundary.

Good provider:

- Default to the product or system being designed unless another provider is clearly visible to the consumer.
- Do not invent providers for internal modules unless an internal boundary is in scope under the rule above.

Arbitration examples:

- A payment processor is a provider for a merchant. A fraud-scoring module inside it is not a provider to the merchant unless fraud review is exposed, but it may be a provider to internal modules or to a fraud analyst who directly works with it.
- A feature-flag service is not a provider to end users when it only selects variants behind the scenes. It is a provider to release managers if they configure flags, inspect rollout state, or trigger rollbacks.

### Resource

The consumer would plausibly refer to it as a concept or object of concern: a resource represents visible provider state, not internal state, and is not a REST/API/database object or necessarily persisted.

Good resource:

- The consumer would plausibly refer to it as an object of concern: a resource represents visible provider state, not internal state.
- Removing it would make the boundary lose important meaning.
- Ask whether it is truly a resource in itself, a property of another resource, a representation, or internal/debug state.

Arbitration examples:

- An invitation link may be a resource if the consumer can disable, regenerate, expire, or inspect it. The copied URL and QR code are representations of that link.
- A bank statement is a resource when consumers can select, filter, and manage it. The PDF export of a bank statement is only a representation of that resource.

### Relationship

A meaningful link between resources.

Good relationship:

- Documents cardinality.
- Documents the nature of the relationship in plain language.

Arbitration examples:

- A catalog contains many products. A product is part of at least one catalog.
- A webhook subscription receives updates about payments received by the merchant.

### Capability

A named ability a provider makes available to a consumer through one or multiple interfaces. A capability takes the boundary's resources as input and/or acts on them.

Good capability:

- A capability interacts with resources in at least one mode:
  - Mutates: modifies one or multiple resources.
  - Observes: exposes one or multiple resources' state, usually through a representation.
  - Ingests: produces an output that depends on one or more resources as input.
  - Triggers: reacts when one or multiple resources come to meet some condition.
- If a capability does not interact with at least one resource, either the resources are under-described or the capability is not really part of this boundary.
- Ask what output the capability creates: a resource, property change, representation, notification, or side effect.
- Do not confuse a capability with an interaction, one click, one endpoint, one verification step, or one implementation task.

Arbitration examples:

- Creating, editing, and deleting an invitation link are capabilities. Opening or copying the link are interactions with its representations.
- Participating in a live session may be a capability. At a more detailed level, starting, reconnecting, and finishing may become independent capabilities.

### Interface

The concrete access surface through which the consumer intentionally observes resources or exercises capabilities.

Good interface:

- Is clearly identifiable by its user (the consumer).
- Is a channel or product surface where interactions happen, not every screen or widget inside that channel.
- Can be external or internal: product UI, admin UI, operator CLI, agent script, public API, partner API, webhook endpoint, service-to-service API, scheduled-job runner, or another control-plane surface.
- Is not merely implementation plumbing. A database table, repository adapter, backend module, or server function is not an interface unless the consumer directly invokes that thing as the access surface.
- If the only current access is through a framework developer tool such as a console, REPL, or framework CLI command, label it a provisional developer control-plane interface and note that no designed interface exists yet.

Arbitration examples:

- Admin web UI, native mobile app, partner API, and admin CLI can be interfaces. A dashboard, chart, table, modal, or form is usually a view or representation inside an interface.
- A partner API may be an interface; one endpoint is usually an interaction surface, not a separate interface.
- A framework mutation or backend job is usually implementation behind an interface. A framework CLI command that invokes it can be a provisional developer control-plane interface when the operator directly uses that command to trigger the capability.
- A TypeScript repository adapter is not an interface by itself. It may support a future interface such as an agent script, admin UI, or operator CLI.

### Resource Property

A consumer-visible attribute, status, timestamp, flag, count, error, or structured detail that describes a resource.

Good resource property:

- It describes a resource without becoming an object of concern on its own.
- Keep statuses, flags, counts, timestamps, and errors as properties unless they become independently actionable.

Arbitration examples:

- Payment status, statement date, retry count, and transcript length are usually properties.
- A receipt number may be a property until consumers search, dispute, reconcile, or manage receipts independently; then Receipt may be a resource.

## Related Concepts

### Interaction

- Consumer/provider interactions are identified through interaction stories, for example: "The employee submits a time-off request through an HR portal."
- Identifying interactions and their specifics allows inferring the model's core concepts because they reveal the consumers, providers, interfaces, resources, and capabilities expected.

Arbitration examples:

- Open invitation, decide to begin, submit a response, and finish a session may all be interactions inside Participate in session. They should not become separate capabilities just because they happen in sequence.
- Selecting an empty document and selecting a populated document can be the same interaction with different resource state, not two capabilities.

### Output

An output is the result of a capability from the consumer's perspective:

- A new or changed resource instance, a changed resource property, a representation, a notification, or an external side effect.
- An Observe capability usually outputs a representation of resource state.
- A Produce/Ingest capability may output a new resource, a representation, or a side effect.
- Do not model an output as a resource unless the consumer can identify, manage, relate, or act on it independently.

Arbitration examples:

- Export monthly statement may output a PDF representation. If consumers manage statements across periods, Statement is likely the resource and the PDF is one representation of it.
- An alerting capability sends notifications. Alerts are likely a resource that can be managed. Notifications are probably just an output, unless they can be managed system-wide as their own object of concern.
- Show revenue trend outputs a chart; the chart is a representation, not the interface, not a resource.

### Representation

A consumer-visible form of a resource, property, or output in an interface.

- Resources are exposed to consumers through representations; not directly.
- A representation can become a resource when it gains consumer-visible identity, lifecycle, relationships, or capabilities.

Arbitration examples:

- A QR code, copied URL, and button label can all represent the same access link. If consumers rotate, expire, or audit the access link, model the link/token as the resource, not each representation.
- A chart and table can represent the same report data. If consumers name, share, schedule, or permission a saved report, Saved Report may be the resource.

### Implementation Choice

A current or proposed runtime, framework, deployment unit, process, database, or hosting arrangement used to implement a provider or responsibility.

- Its existence, isolation, or statefulness does not create a boundary.
- Replace technology names with stable responsibilities. If another technology could preserve the contract and ownership, keep the choice outside the boundary model.
- Model an internal boundary only when a distinct interface or separate responsibility, authority, or lifecycle ownership changes the contract.
- Record choices that affect feasibility, sequencing, or risk as architecture constraints.

Examples: A Durable Object may implement `Run Lifecycle Controller`; model the responsibility as the provider unless its platform-specific contract is in scope. A Worker that only hosts request handling is not automatically a provider.
