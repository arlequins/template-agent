import type {
  KnowledgeSearchPort,
  MemorySearchPort,
} from "@arlequins/agent-core";
import type { Database } from "@arlequins/db-backbone/client";
import {
  Document,
  DocumentChunk,
  MemoryRecord,
} from "@arlequins/db-backbone/schema";
import { type AnyColumn, and, desc, eq, ilike, isNull, or } from "drizzle-orm";

const MAX_RESULTS = 6;
const pattern = (query: string) => `%${query.replace(/[\\%_]/g, "\\$&")}%`;

function queryTerms(query: string) {
  const terms = query.match(/[\p{L}\p{N}]{2,}/gu) ?? [];
  return [...new Set(terms)].slice(0, 8);
}

function textMatch(column: AnyColumn, query: string) {
  const terms = queryTerms(query);
  return terms.length > 0
    ? or(...terms.map((term) => ilike(column, pattern(term))))
    : ilike(column, pattern(query));
}

export function createDatabaseMemorySearch(
  database: Database,
): MemorySearchPort {
  return {
    search: async ({ query, workspaceId }) =>
      database
        .select({
          content: MemoryRecord.content,
          id: MemoryRecord.id,
          importance: MemoryRecord.importance,
        })
        .from(MemoryRecord)
        .where(
          and(
            eq(MemoryRecord.workspaceId, workspaceId),
            eq(MemoryRecord.status, "approved"),
            isNull(MemoryRecord.expiresAt),
            textMatch(MemoryRecord.content, query),
          ),
        )
        .orderBy(desc(MemoryRecord.importance))
        .limit(MAX_RESULTS),
  };
}

export function createDatabaseKnowledgeSearch(
  database: Database,
): KnowledgeSearchPort {
  return {
    search: async ({ query, workspaceId }) => {
      const rows = await database
        .select({
          chunkId: DocumentChunk.id,
          content: DocumentChunk.content,
          documentId: Document.id,
          label: Document.filename,
          locator: DocumentChunk.locator,
        })
        .from(DocumentChunk)
        .innerJoin(Document, eq(DocumentChunk.documentId, Document.id))
        .where(
          and(
            eq(Document.workspaceId, workspaceId),
            eq(Document.status, "completed"),
            isNull(Document.deletedAt),
            textMatch(DocumentChunk.content, query),
          ),
        )
        .limit(MAX_RESULTS);
      return rows.map((row) => ({
        citation: {
          chunkId: row.chunkId,
          documentId: row.documentId,
          label: row.label,
          ...(row.locator ? { locator: row.locator } : {}),
        },
        content: row.content,
        score: 1,
      }));
    },
  };
}
