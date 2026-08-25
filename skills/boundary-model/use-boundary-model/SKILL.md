---
name: use-boundary-model
description: Use the boundary model to define a system from an outside view while distinguishing consumer-facing contracts from how they are or could be implemented.
---

# Use Boundary Model

Use this as a lightweight model pass, not as a full refinement workflow.

Load the detailed reference when actively modeling a boundary, resolving terminology, or deciding whether something is a resource, property, output, representation, interaction, or interface: [boundary-model.md](./references/boundary-model.md).

## Core Model Concepts

- **Boundary**: the line across which a provider exposes resources and capabilities to a consumer.
- **Consumer**: the role, actor, system, subsystem, or module for whom a capability is available.
- **Provider**: the system, subsystem, or module exposing resources and capabilities across a boundary.
- **Resource**: a consumer-recognized concept or object of concern that represents observable provider state; not a REST/API/database object and not necessarily persisted.
- **Relationship**: a meaningful link between resources in observable state.
- **Capability**: a named ability the provider makes available to the consumer through one or more interfaces.
- **Interface**: the concrete access surface where the consumer intentionally observes resources or exercises capabilities. Examples: product UI, admin UI, CLI command, operator script, public/partner API, webhook endpoint, scheduled-job/control-plane surface. A repository, database table, or backend function is not an interface unless that is the direct surface the consumer invokes.
- **Resource property**: a consumer-visible attribute, status, timestamp, flag, count, error, or structured detail on a resource.

## Related Concepts

- **Interaction**: a concrete story of a capability happening through a specific interface.
- **Output**: what a capability or interaction gives, changes, reveals, sends, produces, or causes from the consumer's perspective.
- **Representation**: a consumer-visible form of a resource, property, or output in an interface.
- **Implementation choice**: a current or proposed runtime, framework, deployment unit, process, database, or hosting arrangement used to implement a provider or responsibility. It does not create a boundary by itself.

## Guidelines

- Attribute every consumer-observable behaviour in scope to a boundary. Do not turn supporting implementation behaviour into additional boundaries or capabilities merely to satisfy this rule.
- In any given situation there are multiple ways to model boundaries. Prefer the simplest one by default.
- When multiple options of similar complexity cannot be arbitrated solely based on the available context, highlight those options and relative tradeoffs.
- Model external boundaries by default. Include an internal boundary when the user asks for it or when the current design question cannot be resolved without clarifying responsibility, authority, lifecycle, or an internal contract. Do not map unrelated internal structure. Before listing resources or capabilities, state the boundary scope as `External` or `Internal`.
- Ground your modelling in the stories of how these humans use the system. Don't assume or invent.
- Watch for REST/API/database drift: in this model, resources are consumer-recognized concepts, not necessarily endpoints, records, tables, or persisted objects.
- Do not treat an implementation choice as a boundary merely because it is separately deployed, stateful, or named in the architecture. Replace the technology name with its stable responsibility. Model an internal boundary only when a distinct interface or separate responsibility, authority, or lifecycle changes the contract; otherwise keep the choice or constraint outside the boundary model.
