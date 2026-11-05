# ARA Phase 1 — Kenyan Real Estate RAG Engine

A real NestJS + PostgreSQL/pgvector + OpenAI retrieval-augmented generation service for a Kenyan real estate agency. It supports English and Kiswahili responses and indexes three knowledge categories:

- `property_listing`
- `faq`
- `business_information`

This is an implementation foundation, not a mock/demo. It calls the configured OpenAI API for embeddings and answer generation and stores/retrieves actual knowledge in PostgreSQL.

## Requirements

- Node.js 20.11+
- Docker with Docker Compose, or PostgreSQL 16 with the `vector` and `pg_trgm` extensions available
- A valid OpenAI API key
- `psql` client for the migration

## Start locally

1. Copy `.env.example` to `.env`.
2. Set a real `OPENAI_API_KEY` and a unique `INGESTION_API_KEY` (at least 32 characters).
3. Start PostgreSQL:

   ```bash
   docker compose up -d postgres
   ```

4. Install dependencies:

   ```bash
   npm install
   ```

5. Apply the database migration:

   ```bash
   npm run db:migrate
   ```

6. Start the API:

   ```bash
   npm run start:dev
   ```

7. Check health:

   ```bash
   curl http://localhost:3000/v1/health
   ```

## Index a property listing

`POST /v1/knowledge` requires the `x-ingestion-key` header. `sourceRef` is the stable agency-side ID for the listing. Re-indexing the same category/sourceRef updates the document and replaces its chunks. Re-sending unchanged content avoids unnecessary embedding calls.

```bash
curl -X POST http://localhost:3000/v1/knowledge \
  -H 'Content-Type: application/json' \
  -H 'x-ingestion-key: YOUR_INGESTION_API_KEY' \
  -d '{
    "title": "Three-bedroom house in Ongata Rongai",
    "category": "property_listing",
    "language": "en",
    "sourceRef": "agency-listing-000123",
    "content": "A three-bedroom house is listed for rent in Ongata Rongai, Kajiado County. The monthly asking rent is KES 65,000. The listing record states that the property is available. Viewings must be arranged with the agency.",
    "metadata": {
      "location": "Ongata Rongai",
      "propertyType": "house",
      "bedrooms": 3,
      "purpose": "rent",
      "price": 65000,
      "currency": "KES",
      "pricePeriod": "month",
      "availability": "available"
    }
  }'
```

Only submit genuine, current listing facts. The example above is illustrative request structure; it is not an actual property or an included database record.

## Index agency FAQs and business information

Use the same endpoint with `category: "faq"` or `category: "business_information"`. Use `language: "en"`, `"sw"`, or `"both"`. For bilingual content, provide both language versions in `content`, clearly separated and labelled.

Example FAQ content:

```text
Question (English): What is required to arrange a property viewing?
Answer (English): Contact the agency to request a viewing. The agent will confirm a suitable time.

Swali (Kiswahili): Ni nini kinahitajika ili kupanga kutembelea nyumba?
Jibu (Kiswahili): Wasiliana na kampuni ili kuomba kutembelea nyumba. Wakala atathibitisha muda unaofaa.
```

## Ask a question

`POST /v1/answer`

```bash
curl -X POST http://localhost:3000/v1/answer \
  -H 'Content-Type: application/json' \
  -d '{
    "message": "Natafuta nyumba ya vyumba vitatu Rongai. Kodi ni kiasi gani?",
    "preferredLanguage": "auto",
    "filters": {
      "location": "Ongata Rongai",
      "propertyType": "house",
      "bedrooms": 3,
      "purpose": "rent"
    }
  }'
```

The response includes:
- `answer`: customer-facing answer
- `language`: `en` or `sw`
- `status`: `answered` or `needs_human`
- `confidence`: model assessment, not a guarantee
- `citations`: knowledge document IDs used
- `escalationReason`: why human help is required, if applicable

## API reference

| Method | Endpoint | Purpose | Authentication |
|---|---|---|---|
| GET | `/v1/health` | Database/API health check | None |
| POST | `/v1/knowledge` | Create/update a knowledge document and embeddings | `x-ingestion-key` |\n| DELETE | `/v1/knowledge/:category/:sourceRef` | Deactivate a document (e.g. a rented/sold listing) | `x-ingestion-key` |
| POST | `/v1/answer` | Retrieve evidence and generate a grounded answer | None in this phase |

Do not expose the ingestion key or OpenAI key in a frontend. The answer endpoint should be placed behind the authenticated backend/customer-channel gateway before production exposure. Phase 2/4 will add tenant-aware identity, rate limiting, abuse protection, and full audit controls.

## Retrieval behaviour

- Embeddings use `text-embedding-3-small` with 1536 dimensions.
- Search combines cosine similarity and PostgreSQL full-text rank.
- Filters can constrain category, location, property type, bedrooms, maximum price, and purpose.
- A minimum similarity threshold prevents weak matches from being treated as reliable evidence.
- The generation prompt treats retrieved text as untrusted data and requires citations from retrieved document IDs.
- The grounding validator rejects invented citation IDs and escalates uncited answers.
- When retrieval or model generation fails, the API returns a human-escalation response rather than fabricating facts.

## Important data rules

1. Store price as a numeric `metadata.price`, with `currency` and `pricePeriod` alongside it.
2. Store normalized property attributes in metadata: `location`, `propertyType`, `bedrooms`, `purpose`, `availability`.
3. Keep the full source facts in `content`; metadata filters are exact-match filters.
4. Use stable `sourceRef` values from the agency's CRM/listing system.
5. Deactivate a listing when it is no longer available; do not leave stale availability marked active.
6. Do not index customer identity documents or sensitive personal data in this public-facing knowledge base.
7. Do not treat indexed title deeds or seller statements as legal verification of ownership.

## Current Phase 1 boundaries

- This service indexes and retrieves agency knowledge; it does not yet connect to WhatsApp, Gmail, social channels, a CRM, or a dashboard.
- It does not yet persist multi-turn conversation history.
- The ingestion route is protected with a shared key, but full user/tenant authorization is part of the backend/security phases.
- Property metadata filters are exact-match filters. Normalize locations and property types consistently in the source system.
- Human escalation is returned to the caller; delivery to an agent queue is implemented in a later backend phase.

## Verification

```bash
npm run typecheck
npm test
npm run build
```

Run the API against a real PostgreSQL database and a real OpenAI key to verify end-to-end ingestion and answer generation.
