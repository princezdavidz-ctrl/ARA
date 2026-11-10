# ARA AI Master Plan and Phase 0 Repository Audit

**Repository:** `princezdavidz-ctrl/ARA`  
**Baseline branch:** `main`  
**Baseline commit audited:** `fab5269c5e014ed838f809113f8a39c113c87689`  
**Audit date:** 2026-11-10  
**Purpose:** Deliver a secure, measurable, tenant-isolated AI communication platform through phased implementation.

## 1. Executive summary

ARA already has meaningful AI foundations: an OpenAI integration, tenant-scoped knowledge bases, vector retrieval, evidence-grounded answer generation, company-specific AI settings, supervised response handling, human escalation, and an inbound message worker connected to supported channels.

These foundations are not equivalent to a complete AI platform. The audited code does not yet show a central orchestration layer, persistent conversation/customer memory, a configurable multi-agent runtime, a permissioned tool-execution framework, controlled learning workflows, or a dedicated AI evaluation/observability system.

This document is a baseline and delivery plan. It does not claim that the platform is production-ready or that any unimplemented capability is complete.

## 2. Phase 0 audit findings

### Existing foundations verified in source

| Area | Evidence in repository | Audit finding |
|---|---|---|
| Model integration | `src/llm/openai.service.ts` | OpenAI embeddings and chat-completion wrapper exists; provider/model selection is currently narrow and environment-configured. |
| Tenant knowledge | `migrations/014_industry_neutral_knowledge.sql`, `src/rag/ingestion.service.ts` | Industry-neutral knowledge bases, categories, document ingestion and tenant ownership exist. |
| Retrieval | `src/rag/retrieval.service.ts` | Vector similarity retrieval with tenant, knowledge-base and metadata filters exists. |
| Answer generation | `src/rag/answer.service.ts` | Evidence-grounded response generation, schema validation, citations and human-escalation outcomes exist. |
| Company AI settings | `company_ai_settings` usage in `src/rag/answer.service.ts` | Agent name, instructions, response mode, confidence threshold, sensitive-topic setting and enabled flag are read. |
| Human handoff | `src/platform/message-worker.service.ts` | Responses requiring human review create escalation records and do not enter the normal AI outbound send path. |
| Channel processing | `src/platform/message-worker.service.ts` and channel webhook services | Inbound jobs can be processed through a shared answer service and supported channel delivery workers. |
| CI | `.github/workflows/ci.yml` | PostgreSQL migrations, backend build, frontend syntax checks and Jest suite are run in GitHub Actions. |

### Gaps and risks requiring implementation or verification

1. **No central AI orchestrator module is present in the audited source tree.** The message worker calls the answer service directly. Introduce a stable orchestration boundary before adding more agent behavior.
2. **No persistent conversation/customer memory subsystem is present in the audited source tree.** The current answer request is built from the current inbound message and retrieved knowledge; prior conversation context is not assembled in the worker call.
3. **No multi-agent runtime is present in the audited source tree.** Agent name and instructions are configuration for one answer assistant, not independent agents with scoped tools and delegation.
4. **No general tool registry or permissioned action-execution framework is present in the audited source tree.** Business actions need explicit schemas, tenant authorization, idempotency, approval and audit controls.
5. **Confidence is currently a coarse model label mapped to fixed numeric values (high=0.9, medium=0.72, low=0.3).** This is not a calibrated confidence model. Calibrate against evaluation data before relying on thresholds for autonomous sending.
6. **Sensitive-topic handling is primarily expressed in the model prompt.** Add deterministic policy checks and safety tests; do not rely on model instructions alone.
7. **The AI output schema supports English and Swahili only.** Decide and test a broader supported-language policy before claiming multilingual coverage.
8. **Retrieval is vector-similarity based.** Hybrid lexical/vector retrieval, reranking, source freshness and richer retrieval diagnostics remain roadmap work.
9. **AI-specific automated coverage is small.** The audited answer-service spec contains two focused tests. Expand unit, integration, adversarial, tenant-isolation and end-to-end evaluation suites.
10. **AI disabled-state behavior needs correction/verification.** The current answer flow performs retrieval before the disabled setting is enforced, and can reach model generation when the company AI setting is disabled. Enforce the disabled policy before embedding or generation and add a regression test.
11. **Model resilience and operational visibility are limited in the current wrapper.** Add bounded retries/timeouts, provider error normalization, usage/cost telemetry, trace correlation and safe fallback behavior.
12. **Production readiness cannot be inferred from passing CI alone.** Live provider credentials, webhook permissions, channel review, load behavior, tenant-isolation tests and deployment configuration require separate verification.

### Baseline CI

At audit time, the latest observed `main` workflow run was successful:

- Run: https://github.com/princezdavidz-ctrl/ARA/actions/runs/42837687136
- Commit: `fab5269c5e014ed838f809113f8a39c113c87689`
- Result: `success`

This confirms the repository's configured CI checks passed for that commit. It does not certify live integrations or production readiness.

## 3. AI delivery phases

The percentages below are **planned allocation of AI development effort**, not current completion percentages. They total 100%.

| Phase | Workstream | Effort |
|---|---|---:|
| 0 | Audit, architecture and measurable baseline | 5% |
| 1 | Central AI orchestrator and model gateway | 15% |
| 2 | Intent, language and context understanding | 10% |
| 3 | Knowledge/RAG quality and evidence | 15% |
| 4 | Conversation and customer memory | 10% |
| 5 | Multi-agent runtime | 15% |
| 6 | Decision engine, tools and workflow execution | 10% |
| 7 | Safety, confidence and human supervision | 8% |
| 8 | Feedback and controlled improvement | 5% |
| 9 | Evaluation, monitoring and production readiness | 7% |
| **Total** |  | **100%** |

### Phase 0 — Audit, architecture and baseline (5%)

**Status:** Repository audit completed; implementation work remains.

Deliverables:
- This audit and master plan.
- A capability inventory distinguishing implemented, partial, missing and externally unverified work.
- Architecture decision records for orchestrator, memory, agents, tools and evaluation.
- A reproducible AI test dataset and baseline measurements.
- A prioritized backlog with acceptance criteria.

Exit criteria:
- Existing behavior and API contracts documented.
- No new AI architecture duplicates existing RAG or channel services.
- Security boundaries and tenant ownership rules approved.

### Phase 1 — Central AI orchestrator and model gateway (15%)

Deliverables:
- A single orchestrator entry point for channel, CRM and API requests.
- A normalized AI request/response contract with tenant, conversation, channel and trace context.
- Model/provider adapter interface, model routing and configurable fallbacks.
- Context assembly and bounded request lifecycle.
- Timeouts, retry policy, rate limits, cancellation and idempotent processing.
- Usage/cost accounting and trace correlation.
- A hard disabled-AI gate before retrieval, embedding or generation.

Exit criteria:
- All AI entry points use the orchestrator.
- Existing channel behavior remains compatible.
- Disabled, unavailable and rate-limited AI requests fail safely without unintended model calls.
- Unit and integration tests cover routing, retries and tenant boundaries.

### Phase 2 — Intent, language and context understanding (10%)

Deliverables:
- Intent taxonomy and configurable intent classification.
- Entity extraction and normalized conversation metadata.
- Language identification and supported-language policy.
- Sentiment/urgency signals used only as routing aids, not as unsupported factual claims.
- Ambiguity detection and clarification behavior.
- Attachment understanding pipeline for approved image/document/audio types, with explicit size/type limits.

Exit criteria:
- A versioned benchmark covers supported languages, intents, ambiguous inputs and adversarial prompts.
- Classification quality meets agreed per-class thresholds.
- Unsupported input types are rejected or routed to a human safely.

### Phase 3 — Knowledge/RAG quality and evidence (15%)

Deliverables:
- Hardened ingestion pipeline with source provenance, document versions and freshness metadata.
- File and website ingestion jobs with safe parsing, size limits and malware/content controls.
- Hybrid lexical + vector retrieval and reranking.
- Tenant- and knowledge-base-scoped filters enforced in every query.
- Citation validation, source snippets and stale/conflicting evidence handling.
- Knowledge lifecycle: re-index, deactivate, delete and audit.
- Retrieval quality evaluation set and diagnostics.

Exit criteria:
- Cross-tenant retrieval tests prove zero data leakage.
- Answers requiring factual business evidence cite only retrieved tenant-owned sources.
- Missing, conflicting or stale evidence triggers safe escalation.
- Retrieval quality reaches agreed precision/recall targets on the benchmark.

### Phase 4 — Conversation and customer memory (10%)

Deliverables:
- Short-term conversation context and rolling summaries.
- Optional long-term customer memory with explicit tenant configuration.
- Memory extraction, provenance, confidence and expiry.
- Customer identity linking rules that avoid unsafe identity assumptions.
- Read/write permissions, retention, deletion and audit controls.
- Prompt-injection defenses for stored memories.

Exit criteria:
- Memory retrieval is scoped to the correct tenant and customer.
- Users can configure retention and disable long-term memory.
- Tests cover stale, conflicting, malicious and cross-customer memory.

### Phase 5 — Multi-agent runtime (15%)

Deliverables:
- Agent registry and versioned agent definitions.
- Specialized support, sales, booking, billing, marketing and technical-support templates.
- Agent-specific instructions, knowledge scopes and permission sets.
- Central planner/router with bounded delegation.
- Shared task state and structured inter-agent handoffs.
- Loop prevention, budgets, deadlines and execution traces.
- Human review for agent configuration and version promotion.

Exit criteria:
- Agent selection and delegation are deterministic enough to test.
- Agents cannot access tools or knowledge outside their permissions.
- Agent loops, runaway token use and repeated actions are bounded.
- End-to-end scenarios prove safe handoffs between agents.

### Phase 6 — Decision engine, tools and workflow execution (10%)

Deliverables:
- Typed tool registry with JSON-schema input/output contracts.
- Tenant authorization and least-privilege permission checks.
- Idempotency keys, execution ledger and audit events.
- Approval gates for sensitive or irreversible actions.
- CRM updates, booking, quotation and notification workflows as approved tools.
- Tool timeout, retry, compensation and rollback strategy where supported.
- Webhook/API tool sandboxing and outbound destination controls.

Exit criteria:
- Unauthorized tool calls are rejected server-side.
- Duplicate events cannot cause duplicate business actions.
- Sensitive actions require the configured approval.
- Tool execution can be audited and reconciled.

### Phase 7 — Safety, confidence and human supervision (8%)

Deliverables:
- Deterministic policy engine for sensitive topics and restricted actions.
- Calibrated confidence based on benchmark outcomes, not model self-reported labels alone.
- Evidence sufficiency and citation checks.
- Prompt-injection and data-exfiltration defenses.
- PII handling and redaction policy.
- Human approval queues, assignment, reason codes and resolution feedback.
- Clear customer-facing fallback and escalation behavior.

Exit criteria:
- Safety and policy test suites pass.
- Low-confidence, unsupported, sensitive and unauthorized requests are held for review.
- No model-generated confidence value alone can authorize a high-impact action.

### Phase 8 — Feedback and controlled improvement (5%)

Deliverables:
- Staff correction and customer feedback capture.
- Knowledge-gap and unresolved-intent reporting.
- Offline evaluation of proposed prompt, retrieval and model changes.
- Versioned experiments and approval workflow.
- Rollback to previously approved configurations.
- No autonomous production self-modification.

Exit criteria:
- Improvements are measurable against a fixed benchmark.
- Only approved versions can be promoted.
- Regressions trigger rollback or block promotion.

### Phase 9 — Evaluation, monitoring and production readiness (7%)

Deliverables:
- Versioned golden dataset covering channels, industries, languages and edge cases.
- Automated tests for grounding, citation correctness, memory, agent routing and tool permissions.
- Red-team tests for prompt injection, data leakage and abuse.
- Latency, availability, error, token and cost dashboards.
- Tracing across webhook → worker → orchestrator → model/retrieval/tool → delivery.
- Load, queue recovery, provider outage and failover tests.
- Operational runbooks, alert thresholds and release gates.

Exit criteria:
- Agreed quality, safety, latency, availability and cost SLOs are met.
- All critical security and tenant-isolation tests pass.
- Production deployment is separately verified with real provider configuration.
- Rollback and incident response procedures are tested.

## 4. Engineering guardrails

- Preserve the current NestJS/TypeScript backend and PostgreSQL/pgvector foundation unless a measured requirement justifies a change.
- Preserve existing API contracts; version any necessary breaking changes.
- Never trust a tenant ID supplied by a browser or model output.
- Derive tenant identity from authenticated server-side context.
- Keep each company's knowledge, memory, instructions, agents, tools and analytics isolated.
- Treat retrieved documents, customer messages, model outputs and tool results as untrusted data.
- Never let model output directly authorize payments, refunds, account changes or other sensitive actions.
- Keep credentials in the deployment secret manager; never commit keys or tokens.
- Keep human supervision as the safe fallback.
- Do not deploy to production merely because a pull request merges.

## 5. Delivery workflow and release gates

For every implementation phase:

1. Inspect the latest `main` and related services.
2. Create a focused feature branch.
3. Implement the smallest complete vertical slice.
4. Add unit, integration and security regression tests.
5. Run migrations, build and the full test suite in CI.
6. Review the diff for tenant isolation, secret handling and API compatibility.
7. Open a pull request with test evidence and rollback notes.
8. Merge only after CI passes and the PR is verified mergeable.
9. Verify the merge commit and post-merge CI.
10. Deploy only through the approved release process and verify runtime behavior.

A phase is complete only when its exit criteria are met. A code-complete feature without tests, security review or operational verification remains incomplete.

## 6. Immediate implementation backlog

The first implementation slice after this audit should be Phase 1 groundwork, beginning with the confirmed disabled-AI gate defect:

1. Add a regression test proving disabled company AI performs no embedding or generation call.
2. Enforce disabled AI before retrieval and model invocation.
3. Define normalized orchestration request/response contracts.
4. Route the existing answer path through the orchestrator without changing external API behavior.
5. Add trace IDs and structured outcomes for answered, needs-human, disabled, unavailable and failed states.
6. Add tests for tenant context propagation and safe failure handling.

Do not start multi-agent autonomy or customer memory writes until the orchestrator, policy boundaries and audit trail are established.

## 7. Completion definition

“100%” means all planned capabilities have met their documented acceptance criteria and operational targets. It does not mean AI is infallible. ARA must continue to expose uncertainty, escalate unsupported requests and allow human oversight.
