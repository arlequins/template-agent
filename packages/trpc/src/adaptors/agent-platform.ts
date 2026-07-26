import { createHash } from "node:crypto";
import type { Database } from "@arlequins/db-backbone/client";
import {
  Conversation,
  Document,
  DocumentChunk,
  Feedback,
  IndexRun,
  Investigation,
  MemoryRecord,
  Message,
  MessageCitation,
  Workspace,
  WorkspaceMember,
} from "@arlequins/db-backbone/schema";
import { and, desc, eq, isNull } from "drizzle-orm";

export type WorkspaceActor = { userId: string; workspaceId: string };

/** Every query scopes through workspace membership; callers never supply an arbitrary tenant id alone. */
export function createAgentPlatformRepository(database: Database) {
  async function assertMember(actor: WorkspaceActor): Promise<void> {
    const [membership] = await database
      .select({ userId: WorkspaceMember.userId })
      .from(WorkspaceMember)
      .where(
        and(
          eq(WorkspaceMember.workspaceId, actor.workspaceId),
          eq(WorkspaceMember.userId, actor.userId),
        ),
      )
      .limit(1);
    if (!membership) throw new Error("Workspace membership is required");
  }

  return {
    assertMember,
    async createWorkspace(input: {
      name: string;
      slug: string;
      userId: string;
    }) {
      return database.transaction(async (tx) => {
        const [workspace] = await tx
          .insert(Workspace)
          .values({ name: input.name, slug: input.slug })
          .returning();
        if (!workspace) throw new Error("Workspace creation failed");
        await tx.insert(WorkspaceMember).values({
          workspaceId: workspace.id,
          userId: input.userId,
          role: "owner",
        });
        return workspace;
      });
    },
    async listWorkspaces(userId: string) {
      return database
        .select({
          id: Workspace.id,
          name: Workspace.name,
          slug: Workspace.slug,
          role: WorkspaceMember.role,
          createdAt: Workspace.createdAt,
        })
        .from(WorkspaceMember)
        .innerJoin(Workspace, eq(WorkspaceMember.workspaceId, Workspace.id))
        .where(eq(WorkspaceMember.userId, userId))
        .orderBy(Workspace.name);
    },
    async createConversation(actor: WorkspaceActor, title?: string) {
      await assertMember(actor);
      const [conversation] = await database
        .insert(Conversation)
        .values({
          workspaceId: actor.workspaceId,
          createdByUserId: actor.userId,
          ...(title ? { title } : {}),
        })
        .returning();
      return conversation;
    },
    async listConversations(actor: WorkspaceActor) {
      await assertMember(actor);
      return database
        .select()
        .from(Conversation)
        .where(
          and(
            eq(Conversation.workspaceId, actor.workspaceId),
            isNull(Conversation.archivedAt),
          ),
        )
        .orderBy(desc(Conversation.updatedAt));
    },
    async addMessage(
      actor: WorkspaceActor,
      input: {
        content: string;
        conversationId: string;
        model?: string;
        role: "assistant" | "system" | "user";
      },
    ) {
      await assertMember(actor);
      const [conversation] = await database
        .select({ id: Conversation.id })
        .from(Conversation)
        .where(
          and(
            eq(Conversation.id, input.conversationId),
            eq(Conversation.workspaceId, actor.workspaceId),
          ),
        )
        .limit(1);
      if (!conversation)
        throw new Error("Conversation was not found in this workspace");
      return database.transaction(async (tx) => {
        const [message] = await tx.insert(Message).values(input).returning();
        await tx
          .update(Conversation)
          .set({ updatedAt: new Date() })
          .where(eq(Conversation.id, input.conversationId));
        return message;
      });
    },
    async listMessages(actor: WorkspaceActor, conversationId: string) {
      await assertMember(actor);
      const [conversation] = await database
        .select({ id: Conversation.id })
        .from(Conversation)
        .where(
          and(
            eq(Conversation.id, conversationId),
            eq(Conversation.workspaceId, actor.workspaceId),
          ),
        )
        .limit(1);
      if (!conversation)
        throw new Error("Conversation was not found in this workspace");
      return database
        .select({
          content: Message.content,
          createdAt: Message.createdAt,
          id: Message.id,
          role: Message.role,
        })
        .from(Message)
        .where(eq(Message.conversationId, conversationId))
        .orderBy(Message.createdAt);
    },
    async createDocument(
      actor: WorkspaceActor,
      input: {
        contentHash: string;
        contentType: string;
        filename: string;
        sizeBytes: number;
        sourceUri: string;
      },
    ) {
      await assertMember(actor);
      const [document] = await database
        .insert(Document)
        .values({
          ...input,
          workspaceId: actor.workspaceId,
          uploadedByUserId: actor.userId,
        })
        .returning();
      return document;
    },
    async ingestTextDocument(
      actor: WorkspaceActor,
      input: { content: string; filename: string },
    ) {
      await assertMember(actor);
      const contentHash = createHash("sha256")
        .update(input.content)
        .digest("hex");
      const chunks = input.content.match(/[\s\S]{1,1200}/g) ?? [];
      return database.transaction(async (tx) => {
        const [document] = await tx
          .insert(Document)
          .values({
            contentHash,
            contentType: "text/plain",
            filename: input.filename,
            sizeBytes: Buffer.byteLength(input.content),
            sourceUri: `local://text/${contentHash}`,
            status: "completed",
            uploadedByUserId: actor.userId,
            workspaceId: actor.workspaceId,
          })
          .returning();
        if (!document) throw new Error("Document creation failed");
        if (chunks.length > 0)
          await tx.insert(DocumentChunk).values(
            chunks.map((content, ordinal) => ({
              content,
              documentId: document.id,
              ordinal,
            })),
          );
        return document;
      });
    },
    async listDocuments(actor: WorkspaceActor) {
      await assertMember(actor);
      return database
        .select({
          createdAt: Document.createdAt,
          filename: Document.filename,
          id: Document.id,
          sizeBytes: Document.sizeBytes,
          status: Document.status,
        })
        .from(Document)
        .where(
          and(
            eq(Document.workspaceId, actor.workspaceId),
            isNull(Document.deletedAt),
          ),
        )
        .orderBy(desc(Document.createdAt));
    },
    async deleteDocument(actor: WorkspaceActor, documentId: string) {
      await assertMember(actor);
      const [document] = await database
        .update(Document)
        .set({ deletedAt: new Date(), status: "deleted" })
        .where(
          and(
            eq(Document.id, documentId),
            eq(Document.workspaceId, actor.workspaceId),
            isNull(Document.deletedAt),
          ),
        )
        .returning({ id: Document.id });
      if (!document)
        throw new Error("Document was not found in this workspace");
      return document;
    },
    async listIndexRuns(actor: WorkspaceActor, documentId?: string) {
      await assertMember(actor);
      return database
        .select({
          completedAt: IndexRun.completedAt,
          createdAt: IndexRun.createdAt,
          documentId: IndexRun.documentId,
          error: IndexRun.error,
          id: IndexRun.id,
          provider: IndexRun.provider,
          startedAt: IndexRun.startedAt,
          status: IndexRun.status,
        })
        .from(IndexRun)
        .where(
          and(
            eq(IndexRun.workspaceId, actor.workspaceId),
            ...(documentId ? [eq(IndexRun.documentId, documentId)] : []),
          ),
        )
        .orderBy(desc(IndexRun.createdAt));
    },
    async listMessageCitations(actor: WorkspaceActor, messageId: string) {
      await assertMember(actor);
      return database
        .select({
          content: DocumentChunk.content,
          documentId: Document.id,
          filename: Document.filename,
          locator: DocumentChunk.locator,
          ordinal: MessageCitation.ordinal,
        })
        .from(MessageCitation)
        .innerJoin(Message, eq(MessageCitation.messageId, Message.id))
        .innerJoin(Conversation, eq(Message.conversationId, Conversation.id))
        .innerJoin(DocumentChunk, eq(MessageCitation.chunkId, DocumentChunk.id))
        .innerJoin(Document, eq(DocumentChunk.documentId, Document.id))
        .where(
          and(
            eq(MessageCitation.messageId, messageId),
            eq(Conversation.workspaceId, actor.workspaceId),
            eq(Document.workspaceId, actor.workspaceId),
            isNull(Document.deletedAt),
          ),
        )
        .orderBy(MessageCitation.ordinal);
    },
    async addMessageCitations(
      actor: WorkspaceActor,
      input: { chunkIds: string[]; messageId: string },
    ) {
      await assertMember(actor);
      if (input.chunkIds.length === 0) return;
      await database.insert(MessageCitation).values(
        input.chunkIds.map((chunkId, ordinal) => ({
          chunkId,
          messageId: input.messageId,
          ordinal,
        })),
      );
    },
    async createMemory(
      actor: WorkspaceActor,
      input: {
        content: string;
        importance?: number;
        sourceConversationId?: string;
      },
    ) {
      await assertMember(actor);
      if (input.sourceConversationId) {
        const [conversation] = await database
          .select({ id: Conversation.id })
          .from(Conversation)
          .where(
            and(
              eq(Conversation.id, input.sourceConversationId),
              eq(Conversation.workspaceId, actor.workspaceId),
            ),
          )
          .limit(1);
        if (!conversation)
          throw new Error("Conversation was not found in this workspace");
      }
      const [memory] = await database
        .insert(MemoryRecord)
        .values({
          content: input.content,
          importance: input.importance ?? 50,
          sourceConversationId: input.sourceConversationId,
          workspaceId: actor.workspaceId,
        })
        .returning();
      return memory;
    },
    async reviewMemory(
      actor: WorkspaceActor,
      input: { memoryId: string; status: "approved" | "rejected" },
    ) {
      await assertMember(actor);
      const [memory] = await database
        .update(MemoryRecord)
        .set({ reviewedAt: new Date(), status: input.status })
        .where(
          and(
            eq(MemoryRecord.id, input.memoryId),
            eq(MemoryRecord.workspaceId, actor.workspaceId),
          ),
        )
        .returning();
      if (!memory) throw new Error("Memory was not found in this workspace");
      return memory;
    },
    async createIndexRun(
      actor: WorkspaceActor,
      documentId: string,
      provider = "local",
    ) {
      await assertMember(actor);
      const [document] = await database
        .select({ id: Document.id })
        .from(Document)
        .where(
          and(
            eq(Document.id, documentId),
            eq(Document.workspaceId, actor.workspaceId),
          ),
        )
        .limit(1);
      if (!document)
        throw new Error("Document was not found in this workspace");
      const [run] = await database
        .insert(IndexRun)
        .values({ documentId, provider, workspaceId: actor.workspaceId })
        .returning();
      return run;
    },
    async submitFeedback(
      actor: WorkspaceActor,
      input: {
        comment?: string;
        kind: "helpful" | "incorrect" | "missing" | "needs-investigation";
        messageId: string;
      },
    ) {
      await assertMember(actor);
      const [message] = await database
        .select({ id: Message.id })
        .from(Message)
        .innerJoin(Conversation, eq(Message.conversationId, Conversation.id))
        .where(
          and(
            eq(Message.id, input.messageId),
            eq(Conversation.workspaceId, actor.workspaceId),
          ),
        )
        .limit(1);
      if (!message) throw new Error("Message was not found in this workspace");
      return database.transaction(async (tx) => {
        const [feedback] = await tx
          .insert(Feedback)
          .values({
            ...input,
            workspaceId: actor.workspaceId,
            submittedByUserId: actor.userId,
          })
          .returning();
        if (!feedback) throw new Error("Feedback creation failed");
        const [investigation] =
          input.kind === "needs-investigation"
            ? await tx
                .insert(Investigation)
                .values({ feedbackId: feedback.id })
                .returning()
            : [];
        return { feedback, investigation };
      });
    },
  };
}
