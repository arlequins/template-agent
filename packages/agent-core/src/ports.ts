import type {
  IndexDocumentRequest,
  KnowledgeMatch,
  Memory,
  StreamTextRequest,
} from "./types";

export type KnowledgeSearchPort = {
  search(input: {
    query: string;
    workspaceId: string;
  }): Promise<KnowledgeMatch[]>;
};

export type MemorySearchPort = {
  search(input: { query: string; workspaceId: string }): Promise<Memory[]>;
};

export type ModelProviderPort = {
  streamText(input: StreamTextRequest): AsyncIterable<string>;
};

/** Boundary for object storage. Implement with filesystem in local development or S3 in AWS. */
export type DocumentSourcePort = {
  read(input: { sourceUri: string; workspaceId: string }): Promise<Uint8Array>;
};

/** Boundary for vector stores. The relational store maps every vector id back to an authorized chunk. */
export type VectorIndexPort = {
  delete(input: { recordIds: string[]; workspaceId: string }): Promise<void>;
  upsert(input: IndexDocumentRequest): Promise<{ recordIds: string[] }>;
};

/** Queue only an opaque, validated command; workers perform the provider-specific work. */
export type AgentWorkflowPort = {
  startFeedbackInvestigation(input: { feedbackId: string }): Promise<void>;
  startIndexing(input: { indexRunId: string }): Promise<void>;
};
