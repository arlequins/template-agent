import {
  addMessageInputSchema,
  completeAgentInputSchema,
  conversationScopeInputSchema,
  createConversationInputSchema,
  createDocumentInputSchema,
  createMemoryInputSchema,
  createWorkspaceInputSchema,
  ingestTextDocumentInputSchema,
  reviewMemoryInputSchema,
  startIndexInputSchema,
  submitFeedbackInputSchema,
  workspaceScopeInputSchema,
} from "@arlequins/validators";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";

import { streamAgentCompletion } from "../application/agent-completion";
import { protectedProcedure } from "../trpc";

function actor(userId: string, workspaceId: string) {
  return { userId, workspaceId };
}

/** Workspace is taken from validated input and checked by the repository on every operation. */
export const agentRouter = {
  workspaces: protectedProcedure.query(({ ctx }) =>
    ctx.services.agent.listWorkspaces(ctx.session.user.id),
  ),
  createWorkspace: protectedProcedure
    .input(createWorkspaceInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.agent.createWorkspace({
        ...input,
        userId: ctx.session.user.id,
      }),
    ),
  conversations: protectedProcedure
    .input(workspaceScopeInputSchema)
    .query(({ ctx, input }) =>
      ctx.services.agent.listConversations(
        actor(ctx.session.user.id, input.workspaceId),
      ),
    ),
  messages: protectedProcedure
    .input(conversationScopeInputSchema)
    .query(({ ctx, input }) =>
      ctx.services.agent.listMessages(
        actor(ctx.session.user.id, input.workspaceId),
        input.conversationId,
      ),
    ),
  createConversation: protectedProcedure
    .input(createConversationInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.agent.createConversation(
        actor(ctx.session.user.id, input.workspaceId),
        input.title,
      ),
    ),
  addMessage: protectedProcedure
    .input(addMessageInputSchema)
    .mutation(({ ctx, input }) => {
      const { workspaceId, ...message } = input;
      return ctx.services.agent.addMessage(
        actor(ctx.session.user.id, workspaceId),
        message,
      );
    }),
  ingestTextDocument: protectedProcedure
    .input(ingestTextDocumentInputSchema)
    .mutation(({ ctx, input }) => {
      const { workspaceId, ...document } = input;
      return ctx.services.agent.ingestTextDocument(
        actor(ctx.session.user.id, workspaceId),
        document,
      );
    }),
  createMemory: protectedProcedure
    .input(createMemoryInputSchema)
    .mutation(({ ctx, input }) => {
      const { workspaceId, ...memory } = input;
      return ctx.services.agent.createMemory(
        actor(ctx.session.user.id, workspaceId),
        memory,
      );
    }),
  reviewMemory: protectedProcedure
    .input(reviewMemoryInputSchema)
    .mutation(({ ctx, input }) => {
      const { workspaceId, ...memory } = input;
      return ctx.services.agent.reviewMemory(
        actor(ctx.session.user.id, workspaceId),
        memory,
      );
    }),
  complete: protectedProcedure
    .input(completeAgentInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.services.model) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Local model completion is not configured",
        });
      }
      let message: Awaited<ReturnType<typeof ctx.services.agent.addMessage>>;
      try {
        for await (const event of streamAgentCompletion(
          ctx.services,
          ctx.session.user.id,
          input,
        )) {
          if (event.type === "complete") message = event.message;
        }
      } catch (error) {
        throw new TRPCError({
          code: "BAD_GATEWAY",
          cause: error,
          message: "Local model request failed",
        });
      }
      return { message };
    }),
  createDocument: protectedProcedure
    .input(createDocumentInputSchema)
    .mutation(({ ctx, input }) => {
      const { workspaceId, ...document } = input;
      return ctx.services.agent.createDocument(
        actor(ctx.session.user.id, workspaceId),
        document,
      );
    }),
  startIndex: protectedProcedure
    .input(startIndexInputSchema)
    .mutation(async ({ ctx, input }) => {
      const indexRun = await ctx.services.agent.createIndexRun(
        actor(ctx.session.user.id, input.workspaceId),
        input.documentId,
        input.provider,
      );
      // This is intentionally only an audit-safe command. A Step Functions adapter may be attached by the host app.
      return indexRun;
    }),
  submitFeedback: protectedProcedure
    .input(submitFeedbackInputSchema)
    .mutation(({ ctx, input }) => {
      const { workspaceId, ...feedback } = input;
      return ctx.services.agent.submitFeedback(
        actor(ctx.session.user.id, workspaceId),
        feedback,
      );
    }),
} satisfies TRPCRouterRecord;
