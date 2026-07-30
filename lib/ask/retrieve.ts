import { cosineDistance, desc, eq, sql } from 'drizzle-orm';
import { getDb } from './db';
import { askEvents, chunks, documents } from './schema';
import { embedTexts } from './embed';

const EMBEDDING_MODEL = 'text-embedding-3-large';
const EMBEDDING_DIMENSIONS = 1024;
const RETRIEVAL_TOP_K = 8;

export interface RetrievedChunk {
  documentId: string;
  slug: string;
  title: string;
  route: string | null;
  ordinal: number;
  heading: string | null;
  content: string;
  similarity: number;
}

export interface RetrieveInput {
  question: string;
  /** Set only when the previous turn in this conversation was answered, not refused. */
  previousQuestion?: string;
}

export class NoIngestRecordedError extends Error {
  constructor() {
    super('No ingest_completed event found. Run `npm run ingest` before retrieving.');
    this.name = 'NoIngestRecordedError';
  }
}

export class IngestConfigMismatchError extends Error {
  constructor(running: { model: string; dims: number }, indexed: { model: string; dims: number }) {
    super(
      `Running embed config (${running.model}, ${running.dims}d) does not match the last ingest ` +
        `(${indexed.model}, ${indexed.dims}d). Re-run ingest with --force before querying.`,
    );
    this.name = 'IngestConfigMismatchError';
  }
}

interface IngestCompletedPayload {
  embed_model: string;
  dims: number;
  corpus_hash: string;
}

function isIngestCompletedPayload(value: unknown): value is IngestCompletedPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).embed_model === 'string' &&
    typeof (value as Record<string, unknown>).dims === 'number'
  );
}

/** A query vector scored against an incompatible embedding space produces meaningless similarity. */
async function assertEmbeddingSpaceMatches(): Promise<void> {
  const db = getDb();
  const [latest] = await db
    .select({ payload: askEvents.payload })
    .from(askEvents)
    .where(eq(askEvents.event, 'ingest_completed'))
    .orderBy(desc(askEvents.createdAt))
    .limit(1);

  if (!latest || !isIngestCompletedPayload(latest.payload)) throw new NoIngestRecordedError();

  const indexed = { model: latest.payload.embed_model, dims: latest.payload.dims };
  if (indexed.model !== EMBEDDING_MODEL || indexed.dims !== EMBEDDING_DIMENSIONS) {
    throw new IngestConfigMismatchError({ model: EMBEDDING_MODEL, dims: EMBEDDING_DIMENSIONS }, indexed);
  }
}

function buildEmbeddingInput({ question, previousQuestion }: RetrieveInput): string {
  return previousQuestion ? `${previousQuestion} ${question}` : question;
}

export async function retrieve(input: RetrieveInput): Promise<RetrievedChunk[]> {
  await assertEmbeddingSpaceMatches();

  const { embeddings } = await embedTexts([buildEmbeddingInput(input)]);
  const [queryVector] = embeddings;
  const distance = cosineDistance(chunks.embedding, queryVector);

  return getDb()
    .select({
      documentId: chunks.documentId,
      slug: documents.slug,
      title: documents.title,
      route: documents.route,
      ordinal: chunks.ordinal,
      heading: chunks.heading,
      content: chunks.content,
      similarity: sql<number>`1 - (${distance})`,
    })
    .from(chunks)
    .innerJoin(documents, eq(chunks.documentId, documents.id))
    .orderBy(distance)
    .limit(RETRIEVAL_TOP_K);
}
