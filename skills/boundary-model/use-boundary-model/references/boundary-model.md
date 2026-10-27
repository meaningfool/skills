# Boundary Model Examples

Worked examples for close calls. The definitions, tests and rules live in [SKILL.md](../SKILL.md).

## Boundary and interface

- A web UI and a mobile app for the same warehouse operator are two interfaces of one boundary. A capability only one of them offers is tagged with it.
- A local admin UI exposes fixture reset and debug modules that production never exposes. Tag those capabilities with that interface. If they serve a different goal, such as a developer resetting test data, they belong to that consumer's boundary.
- A customer web app and an operator CLI are different boundaries because their consumers differ, even when both call the same backend functions.
- An admin web UI, a mobile app, a partner API and an admin CLI can be interfaces. A dashboard, chart, table, modal or form is a representation or interaction inside one. One endpoint of a partner API is an interaction, not an interface.
- When the only access is a framework console or CLI, label it a provisional developer control-plane interface and note that no designed interface exists yet.
- A repository adapter is not an interface. It may support a future one, such as an agent script, admin UI or operator CLI.
- A command-line client that only forwards requests to the product's API is evidence for the CLI interface, not a part of its own.

## Consumer

- A requester and an approver may be the same employee, modeled as two consumers or as one consumer with a permission attribute.
- Free and paid users stay one consumer until their goals, capabilities or resources diverge.
- "Customer", "account owner" and "key holder" in different documents are one role when their goals and capabilities are the same.

## Provider

- A payment processor is a provider to a merchant. A fraud-scoring module inside it is not, unless fraud review is exposed to the merchant; it may be a provider to internal parts or to a fraud analyst who works with it directly.
- A feature-flag service is not a provider to end users when it only selects variants behind the scenes. It is one to release managers who configure flags, inspect rollout state or trigger rollbacks.
- A product that uses a hosted identity service for sign-in stays the provider of sign-in, unless its users knowingly go to the identity service's own pages and treat it as a separate service.

## Resource and property

- An invitation link is a resource when the consumer can disable, regenerate, expire or inspect it. Its URL and QR code are representations.
- A bank statement is a resource when consumers select, filter and manage statements. Its PDF export is a representation.
- Payment status, statement date, retry count and transcript length are usually properties. A receipt number becomes a Receipt resource once consumers search, dispute or reconcile receipts independently.
- An API key is a resource in the account and access area, where the customer creates and revokes it. In the API itself it only authenticates calls, so it is not one of the API's resources.
- A rate limit is a constraint of the API, not a resource. Refusing calls over the limit is the provider's behavior, not a consumer capability.
- A balance changes through recorded adjustments. The balance is the resource; each adjustment record is how "adjust balance" is implemented.
- A live progress stream delivers "follow an order". The order and its status are the resource and its property; the stream is not a resource.

## Relationship

- A catalog contains many products. A product is part of at least one catalog.
- A webhook subscription receives updates about payments received by the merchant.

## Capability and area

- Creating, editing and deleting an invitation link are capabilities. Opening or copying the link are interactions with its representations.
- Taking part in a live session can be one capability, or Start and End separately when consumers do them independently. Reconnecting is part of taking part.
- Checking whether a coupon is valid is a step of paying. Checking seat availability is a traveler's goal in its own right. The same verb can pass or fail the test.
- Retrying or recovering an uncertain start is part of starting.
- A nightly job that builds a report is not a capability. Reading the report, or subscribing to it, is.
- In a store, browsing and ordering form the core area; sign-in, saved cards and the loyalty balance are supporting areas. Reviewing past orders is a core observe capability; seeing the loyalty balance is a supporting one.

## Direction

- A payment provider's webhook telling the merchant a payment settled completes the merchant's "take a payment" capability. It is not a separate boundary from the provider to the merchant.

## Interaction, output and representation

- Opening an invitation, deciding to begin, submitting a response and finishing a session may all be interactions inside Participate in session. They do not become separate capabilities because they happen in sequence.
- Selecting an empty document and selecting a populated one can be the same interaction with different resource state.
- Exporting a monthly statement outputs a PDF representation. If consumers manage statements across periods, Statement is the resource and the PDF one representation of it.
- An alerting capability sends notifications. Alerts are likely a resource that can be managed; notifications are an output unless they can be managed system-wide as their own object of concern.
- Showing a revenue trend outputs a chart. The chart is a representation, not the interface and not a resource.
- A QR code, copied URL and button label can all represent the same access link. If consumers rotate, expire or audit the link, model the link as the resource, not each representation.
- A chart and a table can represent the same report data. If consumers name, share, schedule or permission a saved report, Saved Report may be the resource.

## Levels and implementation

- A stateful actor or a serverless function may implement a run lifecycle controller. Model the responsibility as the part, not the technology, unless its platform-specific contract is itself in scope.
- Opening an online store shows a storefront part (serves Shopper › Browsing and Ordering), a payments part (serves Shopper › Ordering) and an inventory part. The storefront asks payments to charge an order; the card network is an outside service of the payments part.
