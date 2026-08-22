# Feature-sliced architecture guide

This template combines Clean Architecture for server code with
Feature-Sliced Design (FSD) for the web application. Business rules remain
testable when the delivery framework, storage provider, or screen changes.

## Dependency direction

```text
Web route -> widget -> feature -> entity -> shared
HTTP adapter -> application port <- provider adapter
                 └─ domain model
```

Server domain and application code must not import Hono, tRPC, AWS SDKs,
database clients, environment loaders, or provider-specific logging. Web
entities must not depend on features or widgets; features must not depend on
widgets. `pnpm architecture:check` checks these rules.

## Web layers

| Layer | Location | Responsibility |
| --- | --- | --- |
| Shared | `apps/web/src/shared` | UI primitives, transport helpers, formatters |
| Entities | `apps/web/src/entities` | business vocabulary and entity models |
| Features | `apps/web/src/features` | user actions and application behavior |
| Widgets | `apps/web/src/widgets` | composed screens and sections |
| App | `apps/web/src/app` | route delivery and page composition only |

Existing `components/` and `lib/` folders are compatibility seams. New code
should use the slice directories and move one cohesive feature at a time.

## Server layers

| Layer | Location | Responsibility |
| --- | --- | --- |
| Domain | `packages/*/src/domain`, `apps/api/src/features/*/domain` | pure types and invariants |
| Application | `packages/*/src/application`, `apps/api/src/features/*/application` | use cases and outbound ports |
| Infrastructure | `*/infrastructure`, `*/adaptors`, database packages | provider and persistence adapters |
| Interface | route and handler modules | validation, authorization, response mapping |
| Composition | `*/composition.ts` and app roots | concrete adapter wiring |

## Migration checklist

1. Introduce a domain type and invariant without a provider import.
2. Define an application port and test the use case with a double.
3. Move provider implementation under `infrastructure/`.
4. Wire the adapter in a composition root.
5. Keep HTTP/UI delivery thin and add a contract test.
6. Run `pnpm check`, `pnpm typecheck`, and `pnpm architecture:check`.
