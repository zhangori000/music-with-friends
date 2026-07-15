# ADR 001: Use a modular monolith

- Status: **Accepted**
- Date: **2026-07-14**

## Context

The private beta needs one product API for a Next.js web client and an Expo
iPhone client. It also needs identity, social authorization, provider adapters,
listening evidence, analytics, durable ingestion, and deletion. The initial
team, traffic, and budget do not justify independent service deployment, while
provider and product requirements are still changing.

The repository already separates domain, application ports, infrastructure,
and versioned contracts. Its synthetic `/api/v1/demo` route proves both clients
can share a contract.

## Decision

Deploy one backend and one relational data boundary while keeping explicit
business modules: Identity, Social, Connections, Listening, Analytics,
Contracts, and Infrastructure.

Modules own behavior and tables logically. Cross-module work goes through
application use cases or deliberate internal contracts. Domain code remains
framework-free, enforced by architecture tests. We will not add network calls
between modules to imitate future microservices.

## Consequences

Benefits:

- low-cost deployment, local debugging, and simple transactions;
- one `/api/v1` contract for web and iPhone;
- faster refactoring while the domain is uncertain;
- adapters and module boundaries remain credible extraction seams.

Costs:

- one deployment and database are shared failure and scaling boundaries;
- convenience imports and cross-module SQL can erode modularity;
- modules cannot scale or deploy independently until extracted.

Mitigations are dependency fitness tests, module-owned migrations, versioned
HTTP contracts, and explicit ownership in architecture reviews.

## Alternatives rejected for now

- **Microservices:** premature operational, consistency, observability, and
  deployment cost without measured independent-scale needs.
- **Undifferentiated layered monolith:** easier initially, but weak ownership
  would make provider policy, social authorization, and analytics leak together.

## Revisit when

Extract only a module with measured need for independent availability, scaling,
security isolation, release cadence, or team ownership. Repository size alone
is not sufficient evidence.

Further reading: [modular monolith architecture](https://learning.oreilly.com/library/view/fundamentals-of-software/9781098175504/ch11.html).
