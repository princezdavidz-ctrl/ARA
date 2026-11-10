# ARA Platform Architecture

## Confirmed decisions
- AI: shared infrastructure with isolated company knowledge, instructions, configuration, and conversation context.
- Response approval: supervised automatic replies. Only replies passing configured confidence and policy checks may be sent; uncertain, sensitive, or unsupported requests go to human review.
- Billing: recurring subscription plus metered overages.
- Frontend: separate ARA Super Admin and Company CRM applications sharing API contracts and a design system.

## Product boundaries
1. ARA Super Admin: company onboarding/lifecycle, plans and subscriptions, usage, channel health, operational metrics, and audited support access.
2. Company CRM: tenant-owned inbox, customer profiles, assignments, human takeover, channel connections, knowledge workspace, AI settings, team access, and analytics.
3. Shared AI services: orchestration, industry-aware agent templates, tenant-scoped retrieval, policy/confidence checks, and escalation.
4. Communication gateway: provider adapters, webhook verification, tenant resolution, normalized events, idempotency, outbound delivery, and provider receipt reconciliation.
5. Billing and metering: subscription lifecycle, invoices, payment references, included quotas, and overage accounting.

## Tenant isolation requirements
- The existing agencies table remains the tenant root during compatibility migration.
- Every company-owned query must be scoped by authenticated agency_id; never trust a tenant ID supplied by a browser.
- Provider account identifiers resolve to a single active channel connection. Credentials are encrypted at rest and never returned by CRM/admin list APIs. Email and TikTok relay signatures are validated using the selected tenant connection's webhook secret.
- Platform support uses a separate platform identity, least-privilege role, explicit reason, and platform audit entry.
- Knowledge retrieval filters by tenant and knowledge base before ranking.
- Webhook events are deduplicated per connection and provider event ID.

## Supervised response lifecycle
received -> classified -> tenant knowledge retrieval -> policy/confidence checks -> approved send OR human escalation -> delivery status reconciliation.
The model must not invent prices, availability, policies, or professional advice. Missing authoritative knowledge results in a clarifying question or escalation. Sensitive topics default to human review.

## Hybrid billing
Each plan defines recurring price, included message/AI quotas, channel and seat limits, and overage unit prices. Usage events are immutable and idempotent. Invoice generation aggregates usage for a subscription period; payment status changes only from verified provider callbacks or reconciliation.

## Delivery sequence
1. Platform foundation: tenant settings, platform-admin identity/audit, subscription/usage/channel schema.
2. Tenant-safe domain services and role-guarded Super Admin APIs.
3. Database-backed provider connections, encrypted credential lifecycle, webhook account resolution, and multi-connection workers (WhatsApp, Instagram, email, TikTok).
4. Generalized knowledge bases and industry templates; supervised AI policy enforcement.
5. Subscription lifecycle, invoice generation, payment integration, and usage enforcement.
6. Separate Super Admin and Company CRM frontends.
7. Tenant-isolation, webhook, billing, AI policy, load, and recovery tests.

## Migration note
Apply migrations in numeric order. Migration 011 is additive and preserves current agency-based CRM APIs. It creates the data foundation only; application endpoints, provider OAuth flows, encryption-key provisioning, payment integrations, and frontend applications are subsequent work and are not production-ready merely because this schema exists.
