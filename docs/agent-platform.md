# Agent platform template

This repository is a reusable conversational-agent foundation. It can support a
personal assistant, reflection partner, or document assistant without coupling
the core runtime to one model or cloud provider.

## Runtime boundary

`@arlequins/agent-core` owns the provider-neutral loop:

```text
question
  -> workspace-scoped approved memory
  -> workspace-scoped knowledge retrieval
  -> model provider stream
  -> text events and citations
```

| Port | Local implementation | AWS implementation |
| --- | --- | --- |
| Model provider | Ollama or a deterministic test double | Amazon Bedrock, explicit opt-in |
| Agent persistence | MinIO through the S3 adapter | Private versioned S3 bucket |
| Knowledge retrieval | Ollama embeddings with keyword fallback | The same S3 records; add S3 Vectors only when needed |
| Authentication | Included OIDC mock | Existing OIDC provider; Cognito only when no provider exists |

The API streams model output over HTTP. tRPC remains the typed transport for
workspaces, conversations, documents, memory, feedback, evaluation, and
reviewed-release operations.

## Durable data and authorization

The S3 repository stores append-only events, entity read models, content-addressed
document bodies, and immutable reviewed releases. Every request derives the actor
from the verified OIDC session and checks workspace membership before reading or
writing tenant data. Raw OIDC subjects and email addresses are not object-key
components.

New objects use `If-None-Match: *`. Mutable state and head objects use
`If-Match` with the last ETag. Deletes are tombstones. See
[S3-primary agent persistence](./s3-primary-architecture.md) for the complete
layout, concurrency model, recovery procedure, and AWS controls.

## Local agent path

Install the small default chat and embedding models:

```bash
ollama pull qwen2.5:3b
ollama pull nomic-embed-text
pnpm dev:local
```

The signed-in UI creates a workspace and conversation, ingests text or Markdown,
captures memory candidates and feedback, and shows document citations. If the
embedding model is unavailable, retrieval falls back to workspace-scoped keyword
matching.

Memory starts as a candidate. An owner reviews it before it is eligible for the
next knowledge release. Document deletion writes a tombstone so the document
leaves live retrieval while audit history remains.

## Reviewed learning loop

Owners define retrieval evaluation cases with expected chunk IDs. A release can
be published only when the latest completed evaluation meets the configured
citation-recall gate, which defaults to 0.75. Publishing writes an immutable
snapshot and checksum manifest, then conditionally moves the active-release
head. Existing requests continue using the previous release until activation.

Feedback kinds are `helpful`, `incorrect`, `missing`, and
`needs-investigation`. Investigation results become candidates; they never
silently modify active memory or knowledge.

## Cost-aware AWS profile

The default API stack uses Lambda and one private S3 bucket. Bedrock is disabled
unless both a model ID and an exact permitted ARN are configured. The template
does not require Aurora, RDS, DynamoDB, NAT Gateway, ECS, or always-on compute.
PostgreSQL workspaces remain available only for applications that deliberately
add a relational feature.

Free-tier terms and model pricing change. Treat this as an architecture policy,
not a price guarantee, and configure an AWS Budget before enabling paid model or
replication features.
