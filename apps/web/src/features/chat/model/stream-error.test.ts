import { describe, expect, it } from "vitest";

import { streamErrorMessage } from "./stream-error";

describe("streamErrorMessage", () => {
  it("explains a local model connection failure", () => {
    expect(
      streamErrorMessage(new Error("Local model request failed")),
    ).toContain("Ollama에 연결하지 못했습니다");
  });

  it("keeps an unknown user-facing error message", () => {
    expect(streamErrorMessage(new Error("잠시 후 다시 시도하세요."))).toBe(
      "잠시 후 다시 시도하세요.",
    );
  });
});
