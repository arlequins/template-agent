# Test Operations

## Test Layers

For file naming, mocking, and test design rules, see the
[Testing Policy](conventions/testing.md).

- Unit and contract tests run on every pull request.
- Migration upgrade tests apply the original schema and then migrate to the current schema in an isolated PostgreSQL container.
- Testcontainers creates a fresh PostgreSQL instance for repository integration tests, applies every Drizzle migration, and removes the instance after the suite.
- Playwright runs the OIDC flow and accessibility checks on desktop and mobile Chromium.
- k6 baseline load tests are manual and target a dedicated non-production endpoint.

This template does not run cloud smoke tests. Derived projects that deploy to
AWS can copy [the sandbox smoke workflow template](workflow-templates/aws-sandbox-smoke.yml)
to `.github/workflows/aws-smoke.yml` once they have an approved non-production
environment, then configure `AWS_SMOKE_FUNCTION_URL` and
`AWS_SMOKE_GATEWAY_URL` in a `sandbox` GitHub Environment. Configure
`LOAD_TEST_API_URL` separately as a repository variable. Do not run load tests
against production without an approved capacity and incident plan.

## Flaky-test Policy

A failed test is a failure until understood. Retry is diagnostic, not a pass condition. Fix deterministic race, clock, data, and selector issues first. A temporarily quarantined test must have an issue, owner, expiry date, and separate non-blocking job. Do not add arbitrary sleeps; wait on observable state. Track retry rate and remove quarantine before the expiry date.
