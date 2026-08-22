function messageError(error: unknown): string {
  return error instanceof Error ? error.message : "요청을 처리하지 못했습니다.";
}

/** Maps transport/provider failures to messages safe for the chat surface. */
export function streamErrorMessage(error: unknown): string {
  const message = messageError(error);
  if (
    message === "Local model request failed" ||
    message === "Local model completion is not configured"
  ) {
    return "Ollama에 연결하지 못했습니다. `ollama serve`와 `ollama pull qwen2.5:3b`를 확인한 뒤 다시 보내세요.";
  }
  if (message === "응답 스트림을 시작하지 못했습니다.") {
    return "에이전트 API에 연결하지 못했습니다. 로컬 개발 서버가 실행 중인지 확인한 뒤 다시 보내세요.";
  }
  return message;
}
