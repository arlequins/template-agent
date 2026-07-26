import type { Citation } from "@arlequins/agent-core";
import { createAgentRuntime } from "@arlequins/agent-core";
import type { TRPCServices } from "../context";

export type AgentCompletionInput = {
  conversationId: string;
  question: string;
  workspaceId: string;
};

export type AgentCompletionEvent =
  | { text: string; type: "delta" }
  | {
      message: NonNullable<
        Awaited<ReturnType<TRPCServices["agent"]["addMessage"]>>
      >;
      type: "complete";
    };

/** A single persistence path for normal tRPC responses and incremental HTTP responses. */
export async function* streamAgentCompletion(
  services: TRPCServices,
  userId: string,
  input: AgentCompletionInput,
): AsyncIterable<AgentCompletionEvent> {
  if (!services.model)
    throw new Error("Local model completion is not configured");
  const actor = { userId, workspaceId: input.workspaceId };
  await services.agent.addMessage(actor, {
    content: input.question,
    conversationId: input.conversationId,
    role: "user",
  });
  const history = await services.agent.listMessages(
    actor,
    input.conversationId,
  );
  const runtime = createAgentRuntime({
    knowledgeSearch: services.knowledgeSearch,
    memorySearch: services.memorySearch,
    model: services.model,
  });
  const text: string[] = [];
  let citations: Citation[] = [];
  for await (const event of runtime.run({
    history: history.slice(0, -1).map((message) => ({
      content: message.content,
      role: message.role as "assistant" | "system" | "user",
    })),
    profile: {
      id: "local-assistant",
      instructions:
        "You are a helpful local assistant. State uncertainty instead of inventing facts.",
      name: "Local assistant",
      workspaceId: input.workspaceId,
    },
    question: input.question,
    workspaceId: input.workspaceId,
  })) {
    if (event.type === "retrieval-complete" || event.type === "complete") {
      citations = event.citations;
      continue;
    }
    if (event.type !== "text-delta") continue;
    text.push(event.text);
    yield { text: event.text, type: "delta" };
  }
  const content = text.join("").trim();
  if (!content) throw new Error("Local model returned no text");
  const message = await services.agent.addMessage(actor, {
    content,
    conversationId: input.conversationId,
    model: "ollama",
    role: "assistant",
  });
  if (!message) throw new Error("Assistant message creation failed");
  await services.agent.addMessageCitations(actor, {
    chunkIds: citations.map((citation) => citation.chunkId),
    messageId: message.id,
  });
  yield { message, type: "complete" };
}
