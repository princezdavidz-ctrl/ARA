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
- Knowledge retrieval filters by tenant and optional knowledge base before ranking; category and arbitrary JSON metadata filters are industry-neutral.
- Webhook events are deduplicated per connection and provider event ID.

## Supervised response lifecycle
received -> classified -> tenant knowledge retrieval -> policy/confidence checks -> approved send OR human escalation -> delivery status reconciliation.
The model must not invent prices, availability, policies, stock, schedules, qualifications, or contractual terms. Answers must cite retrieved tenant-owned evidence. Company industry and AI settings guide tone and policy but cannot override evidence or platform safety rules. Missing authoritative knowledge, disabled AI, draft-only response mode, confidence below the company threshold, invalid citations, or sensitive topics create a human escalation; AI drafts are not sent to customers until the response passes the tenant's configured send policy.

## Hybrid billing
Each plan defines recurring price, included message/AI quotas, channel and seat limits, and overage unit prices. Usage events are idempotent and linked to the active subscription period. Invoice generation creates a base subscription line plus message and AI overage lines. Payment status changes only from a provider-native-verified callback relayed through ARA's signed normalized event contract or explicit reconciliation. Company billing queries are always scoped to the authenticated agency; platform billing mutations require a billing-capable platform role.

## Delivery sequence
1. Platform foundation: tenant settings, platform-admin identity/audit, subscription/usage/channel schema.
2. Tenant-safe domain services and role-guarded Super Admin APIs.
3. Database-backed provider connections, encrypted credential lifecycle, webhook account resolution, and multi-connection workers (WhatsApp, Instagram, email, TikTok).
4. Generalized tenant knowledge bases and industry templates; evidence-grounded AI policy enforcement and human escalation.
5. Subscription lifecycle, invoice generation, payment integration, and usage enforcement.
6. Separate Super Admin and Company CRM frontends.
7. Tenant-isolation, webhook, billing, AI policy, load, and recovery tests.

## Migration note
Apply migrations in numeric order through 015. Migration 011 is additive and preserves current agency-based CRM APIs. It creates the data foundation only; application endpoints, provider OAuth flows, encryption-key provisioning, payment integrations, and frontend applications are subsequent work and are not production-ready merely because this schema exists.


## Omnichannel communications expansion (approved)

ARA is an omnichannel customer-engagement platform. The expansion is additive: existing WhatsApp, Instagram, TikTok Business Messaging, email, website chat, CRM, AI, human handoff, staff console, subscription, billing, knowledge-base and administration behavior must remain compatible.

### Channel scope

| Channel | Inbound | Outbound | Required capabilities |
|---|---:|---:|---|
| SMS | Yes | Yes | Two-way inbox, delivery receipts, retries, opt-out/STOP handling, consent and suppression, templates, scheduled and bulk campaigns |
| Voice calls | Yes | Yes | Inbound AI receptionist, outbound calls, IVR/queues, agent transfer, voicemail/missed-call callbacks, call status, recording/transcription controls |
| WhatsApp | Yes | Yes | Preserve current Cloud API and tenant connection behavior |
| Instagram | Yes | Yes | Preserve current messaging integration and account ownership |
| TikTok Business | Yes | Yes | Preserve current Business Messaging integration and account ownership |
| Email | Yes | Yes | Preserve Resend outbound and signed inbound relay |
| Website chat | Yes | Yes | Shared identity, live chat widget, AI and human takeover |
| Facebook Messenger | Planned | Planned | Add through provider adapter after channel policy/review |

### Target logical architecture

`Channel Provider -> Webhook/API Gateway -> Signature Verification -> Tenant/Connection Resolver -> Normalized Event Bus -> Conversation & Customer Service -> AI Orchestrator / Human Queue -> Channel Adapter -> Provider`

Cross-cutting services:
- **Channel registry and adapters:** provider-neutral contracts for inbound events, outbound sends, delivery receipts, call lifecycle events, capability discovery and provider errors. Keep provider-specific APIs behind adapters.
- **Communication orchestration:** common routing, assignment, queueing, retries, idempotency, quiet hours, templates and channel policy.
- **Customer 360:** tenant-scoped customer identity, verified channel addresses, consent, preferences, tags, notes, timeline and deduplication with conservative identity matching.
- **AI runtime:** reuse the central AI services, company knowledge and language settings. Voice uses speech-to-text/text-to-speech adapters and turn-taking controls; it does not create a separate AI brain.
- **Human operations:** shared staff presence, assignments, handoff, queue, supervisor controls and conversation history across text and voice.
- **Campaign and automation engine:** scheduled/bulk SMS and approved outbound voice campaigns; workflow triggers, conditions, approvals, retries and execution ledger.
- **Analytics and metering:** channel/provider cost, usage, delivery, call duration, AI consumption, conversions, agent performance and tenant-scoped invoices.

### Provider abstraction and initial rollout

Do not hard-code a single telecom provider into the domain model. Define adapter contracts and provider capability flags first. Evaluate Africa's Talking and Twilio, plus additional country-specific providers, against Kenya coverage, sender-ID/short-code registration, two-way number support, voice number availability, call recording/transcription rules, pricing, delivery receipts, webhook security, data residency and support. Provider selection and credentials are deployment configuration; no provider availability or account approval is assumed by this architecture.

Initial implementation order:
1. **Communication foundation:** normalized channel/event contracts, tenant-owned endpoints, provider adapter interfaces, idempotency, delivery state machine, consent/suppression model, shared conversation timeline and metering events.
2. **SMS two-way vertical slice:** provider-neutral SMS adapter, inbound webhook verification, outbound send queue, delivery receipts, retries, tenant inbox and opt-out enforcement. Start with one approved provider adapter after a documented provider decision.
3. **Voice two-way vertical slice:** inbound number routing, AI receptionist, speech pipeline, queue/IVR, live-agent transfer, outbound calls, call state events and configurable recording/retention.
4. **Customer 360 and unified inbox:** cross-channel customer timeline, identity linking and staff assignment.
5. **Campaigns and automation:** consent-aware segments, scheduling, throttling, templates, approval, STOP suppression, workflow builder and audit history.
6. **Call-center operations:** staff presence, queues, ring groups, missed calls, callbacks, supervisor tools and QA.
7. **Analytics, billing and mobile staff app:** channel-level costs and performance, quota enforcement, alerts and mobile workflows.
8. **Developer platform and additional channels:** versioned API, webhooks, sandbox, Messenger and provider marketplace.

### Non-negotiable safeguards

- **Tenant isolation:** derive agency/company identity from authenticated server context or a verified provider-connection mapping; never accept tenant ownership from model output or untrusted webhook fields.
- **Consent and opt-out:** persist consent source, purpose, channel, timestamp and scope; enforce per-channel suppression before every outbound send; process SMS STOP/START/HELP and provider-equivalent keywords; provide clear opt-out in campaigns.
- **Calling controls:** distinguish service calls from marketing calls; enforce applicable national do-not-call, consent, calling-hour and caller-ID requirements. Outbound campaigns require auditable authorization and rate limits.
- **Recording and transcription:** configurable announcement/consent, recording disabled by default until legal basis and provider policy are verified, encryption, role-based playback, retention/deletion and access audit.
- **Human control:** customer request, low confidence, sensitive intent, repeated failures or agent transfer must reach a staffed queue or a clear fallback. AI cannot impersonate a human.
- **Reliability:** webhook signature verification, replay protection, idempotency, bounded retries, dead-letter handling, provider outage circuit breakers and reconciled delivery/call states.
- **Security and privacy:** encrypt provider credentials and sensitive media, redact logs, restrict media access, set retention policies and audit exports.
- **Billing integrity:** meter accepted provider operations with idempotency keys; distinguish queued, provider-accepted, delivered, failed, ringing, answered and completed states. Do not bill on an unverified UI event.
- **Release safety:** feature flags per tenant/channel; preserve existing provider adapters and API contracts; migrations additive; no production enablement until provider, regulatory, security and operational checks pass.

### Expanded implementation backlog

| Priority | Work package | Completion evidence |
|---:|---|---|
| P0 | Inventory current channel/webhook/message schemas and fix staging migration drift | Reconciled migration state and healthy staging |
| P1 | Unified communication contracts, customer identity and consent/suppression foundation | Schema/API contracts, tenant isolation and idempotency tests |
| P2 | SMS inbound + outbound adapter and two-way inbox | Verified webhook, send, receipts, STOP/START/HELP, retry and metering tests |
| P3 | Voice inbound + outbound and AI receptionist | Call lifecycle, IVR/queue, transfer, consent and outage tests |
| P4 | Unified Customer 360 and inbox | Cross-channel timeline and safe identity-link tests |
| P5 | Campaigns and workflow automation | Consent-aware scheduling, approvals, suppression and execution ledger |
| P6 | Contact-center operations | Presence, queues, callbacks, supervisor and audit controls |
| P7 | Analytics, subscription metering and mobile staff app | Reconciled provider costs, tenant dashboards and mobile workflows |
| P8 | Developer API, webhooks and additional channels | Versioned contracts, signed webhooks and sandbox |

### Definition of done

A channel is not complete merely because an API request succeeds. It must support authenticated tenant resolution, secure credential storage, inbound/outbound lifecycle, idempotency, provider status reconciliation, consent policy, human escalation, metering, audit logs, observability, migration rollback notes and automated tests. Live production readiness additionally requires provider account approval, valid sender/number provisioning and jurisdiction-specific compliance review.
