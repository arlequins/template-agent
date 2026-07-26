# Agent Platform Template

This template is a reusable conversational-agent foundation, not a code-agent
implementation. A project made from it can begin as a personal assistant,
reflection partner, or enterprise document assistant; repository analysis and
data lineage are later additions.

## Runtime boundary

`@arlequins/agent-core` owns the provider-neutral agent loop:

```text
question
  -> workspace-scoped memory search
  -> workspace-scoped knowledge search
  -> model provider stream
  -> text events and citations
```

It deliberately has no AWS SDK, database, HTTP, or UI dependency. Adapters are
added at the boundary:

| Port | Local implementation | AWS implementation |
| --- | --- | --- |
| Model provider | Ollama or a deterministic test double | Amazon Bedrock |
| Memory | PostgreSQL/Docker | Aurora PostgreSQL or a DynamoDB adapter |
| Knowledge retrieval | PostgreSQL full-text/test fixtures | S3 source objects + S3 Vectors |
| Long-running work | direct local runner | Step Functions + Lambda |

The API converts agent events into a streaming response. tRPC remains the typed
CRUD transport for conversations, documents, workspaces, feedback, and admin
operations.

## First template milestones

1. **Conversation:** profile selection, streaming messages, titles, history,
   summaries, and workspace isolation.
2. **Memory and feedback:** durable memories are candidates until reviewed;
   feedback can be helpful, incorrect, missing, or needs-investigation.
3. **Document RAG:** original files in S3, retrieval IDs in S3 Vectors, and
   authorization plus citation resolution in the relational store.
4. **Learning loop:** feedback becomes a reviewed investigation, knowledge
   patch, and regression evaluation before it affects future answers.
5. **Enterprise code analysis:** CodeBuild creates repository-wide manifests;
   Step Functions and Lambda process shards and activate a verified version.

## Free-tier-first profile

The template must be useful for a newly created AWS account without creating
standing infrastructure by default.

```text
Local default: Docker PostgreSQL + OIDC mock + Ollama
AWS personal proof of concept: Lambda + S3 + DynamoDB + Cognito (when no other OIDC exists)
Enterprise upgrade: Aurora + S3 Vectors + Bedrock + CodeBuild
```

Free-tier eligibility, promotional credits, and regional availability change.
Treat this as a design policy rather than a price guarantee. In particular,
Amazon Bedrock inference and Aurora capacity must be budgeted as potentially
billable. Set AWS Budgets before enabling either service.

The optional Aurora stack is documented in [Aurora PostgreSQL with SST](./aurora-sst.md).

## Durable data and authorization

The `agent` PostgreSQL schema is the durable control plane. It contains
workspaces and memberships, conversations and messages, reviewed memory,
documents and chunks, message citations, feedback and investigations, and
index runs. Every tenant-owned query enters through a workspace membership
check. Vector IDs and object URIs are metadata only: a vector hit is never
shown until its chunk, document, and workspace are resolved in PostgreSQL.

`0003_agent-platform.sql` is additive and safe to apply to a local Docker
database before enabling Aurora. It deliberately does not create a vector
extension or an AWS resource.

The typed `agent.*` tRPC contract accepts workspace-scoped IDs, validates size,
hash, source URI, roles, and feedback kinds, and derives the actor from the
authenticated session. The adapter checks membership again before each write;
do not expose a repository directly to an HTTP handler.

## Workflows and provider boundaries

`apps/batch/config/step-defs/agent.ts` declares three Step Functions workflows:

- document ingestion: claim index run, extract/chunk, vector upsert, complete;
- feedback investigation: claim, collect evidence, evaluate, persist findings;
- weekly evaluation: snapshot reviewed cases, evaluate, publish metrics.

The first two schedules are disabled because requests should start them with an
opaque validated run ID. Weekly evaluation is scheduled only in production.
All workflows are deployment definitions, not a deployment action.

`DocumentSourcePort`, `VectorIndexPort`, and `AgentWorkflowPort` keep S3,
S3 Vectors, and Step Functions outside `@arlequins/agent-core`. A Bedrock
adapter implements the existing `ModelProviderPort`; a local model or test
double implements the same port. No AWS SDK is imported by the core package.

## Local Ollama quick start

The default local model is `qwen2.5:3b`, selected for a small first download,
predictable non-reasoning responses, and reasonable Apple Silicon performance.
Install it with:

```bash
ollama pull qwen2.5:3b
```

Copy `.env.example` to `.env`; it sets `OLLAMA_BASE_URL` to the loopback-only
address `http://127.0.0.1:11434` and `OLLAMA_MODEL=qwen2.5:3b`. The
`@arlequins/agent-ollama` adapter rejects non-loopback endpoints, preventing a
local configuration from silently sending conversation content to a remote
server. Omit `OLLAMA_BASE_URL` to disable completion entirely.

The signed-in starter UI has a workspace-scoped chat, a small text-document
registration panel, memory-candidate capture, and helpful/investigation
feedback actions. `POST /agent/stream` emits newline-delimited JSON (`delta`,
then `complete`) while `agent.complete` is the compatible typed, non-streaming
alternative. Both paths save the user question and assistant response through
the same application service. Retrieved document chunks are saved as durable
message citations before completion.

Text documents are chunked locally and searched with PostgreSQL case-insensitive
term matching. This is deliberately a minimal local RAG baseline, not semantic
vector search. Memory starts as `candidate`; only `agent.reviewMemory` can mark
it `approved`, and only approved, unexpired memories enter model context.

Ollama values are not included in `LambdaEnvironment`, so this local default is
unavailable after an AWS deployment unless a separate provider adapter is
explicitly wired.
