import { describe, expect, it } from "vitest";

import { AppRouter } from "./root";

type RuntimeRouter = {
  _def?: { record: Record<string, unknown> };
};

function procedureNames(router: unknown) {
  const runtimeRouter = router as RuntimeRouter;
  return Object.keys(
    runtimeRouter._def?.record ?? (router as Record<string, unknown>),
  ).sort();
}

describe("public tRPC contract", () => {
  it("keeps top-level domain routers stable", () => {
    expect(procedureNames(AppRouter)).toEqual([
      "agent",
      "auth",
      "file",
      "post",
    ]);
  });

  it("keeps generic file procedures stable", () => {
    expect(procedureNames(AppRouter._def.record.file)).toEqual([
      "createUpload",
    ]);
  });

  it("keeps example procedures stable", () => {
    expect(procedureNames(AppRouter._def.record.auth)).toEqual(["me"]);
    expect(procedureNames(AppRouter._def.record.post)).toEqual([
      "all",
      "byId",
      "create",
      "delete",
      "update",
    ]);
  });

  it("publishes workspace-scoped agent procedures", () => {
    expect(procedureNames(AppRouter._def.record.agent)).toEqual([
      "addMessage",
      "complete",
      "conversations",
      "createConversation",
      "createDocument",
      "createMemory",
      "createWorkspace",
      "ingestTextDocument",
      "messages",
      "reviewMemory",
      "startIndex",
      "submitFeedback",
      "workspaces",
    ]);
  });
});
