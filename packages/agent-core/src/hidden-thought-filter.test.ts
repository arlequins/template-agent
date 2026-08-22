import { describe, expect, it } from "vitest";

import { createHiddenThoughtFilter } from "./hidden-thought-filter";

describe("createHiddenThoughtFilter", () => {
  it("removes hidden reasoning and keeps the final answer", () => {
    const filter = createHiddenThoughtFilter();

    expect(filter.push("<thinking>내부 계획")).toBe("");
    expect(filter.push("과정</thinking>안녕하세")).toBe("안녕하세");
    expect(filter.push("요.")).toBe("요.");
    expect(filter.flush()).toBe("");
  });

  it("handles split opening and closing tags", () => {
    const filter = createHiddenThoughtFilter();

    expect(filter.push("답변 <ana")).toBe("답변 ");
    expect(filter.push("lysis>비공개</anal")).toBe("");
    expect(filter.push("ysis>완료")).toBe("완료");
    expect(filter.flush()).toBe("");
  });

  it("does not emit an unterminated hidden section", () => {
    const filter = createHiddenThoughtFilter();

    expect(filter.push("<analysis>비공개")).toBe("");
    expect(filter.flush()).toBe("");
  });

  it("waits for a split tag terminator before entering hidden mode", () => {
    const filter = createHiddenThoughtFilter();

    expect(filter.push("<analysis ")).toBe("");
    expect(filter.push(">비공개</analysis>완료")).toBe("완료");
  });
});
