# Local agent demo

The complete no-cloud path uses Docker MinIO for S3-compatible persistence and
native Ollama for model and embedding inference.

```bash
pnpm install
pnpm agent:setup
ollama pull qwen2.5:3b
ollama pull nomic-embed-text
pnpm agent:demo:check
pnpm dev:local
```

If readiness reports Ollama unavailable, start `ollama serve` and run the check
again. The check downloads nothing and changes no data.

Open `http://localhost:3000`, sign in with any non-empty development
credentials, create a workspace and conversation, upload a small text or
Markdown document, and ask a question answered by that document. Verify that the
assistant response includes a citation. Keyword retrieval remains available if
the embedding model is temporarily offline.

Before stopping, run:

```bash
pnpm agent:readiness --api-url http://localhost:5000
pnpm storage:stop
```

Stopping MinIO preserves its Docker volume.
