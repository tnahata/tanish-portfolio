import type { UIDataTypes, UIMessage, UIMessageStreamWriter } from 'ai';
import { randomUUID } from 'crypto';
import { askOnce, type AskOnceResult } from './ask';
import type { GroundingVerdict } from './ground';
import type { HistoryPair } from './prompt';
import { refusalCopyFor, type AskRefusalOutcome } from './refusals';
import { insertTurn, type TurnLogEntry } from './turns';

/** Orchestrates one turn: glass-box data parts, then the answer or refusal, then the turn log.
 *  Disconnect safety and part ordering are argued in docs/ask-agent/05-runtime.md. */

export interface AskStatusData {
  label: string;
}

export interface AskSourceData {
  slug: string;
  title: string;
  route: string | null;
  score: number;
  excerpt: string;
}

export interface AskVerdictData {
  grounding: GroundingVerdict;
  topScore: number;
  verbatim: boolean;
}

export interface AskRefusalData {
  outcome: AskRefusalOutcome;
  message: string;
  offerCapture: boolean;
}

export interface AskDataParts extends UIDataTypes {
  status: AskStatusData;
  source: AskSourceData;
  verdict: AskVerdictData;
  refusal: AskRefusalData;
}

export type AskUIMessage = UIMessage<unknown, AskDataParts>;

const STATUS_PART_ID = 'status';
const VERDICT_PART_ID = 'verdict';
const REFUSAL_PART_ID = 'refusal';
const ANSWER_TEXT_PART_ID = 'answer';

export interface RunAskTurnParams {
  writer: UIMessageStreamWriter<AskUIMessage>;
  signal: AbortSignal;
  question: string;
  previousQuestion: string | null;
  history: HistoryPair[];
  conversationId: string;
  sessionId: string;
  corpusHash: string;
}

/** Writes sources then verdict, in that fixed order, ahead of any answer text. Kept as its own
 *  function so the ordering is something a test can assert on directly. */
function writeRetrievalTrace(writer: UIMessageStreamWriter<AskUIMessage>, result: AskOnceResult): void {
  for (const [index, source] of result.retrieved.entries()) {
    writer.write({ type: 'data-source', id: `source-${index}`, data: source });
  }
  writer.write({
    type: 'data-verdict',
    id: VERDICT_PART_ID,
    data: { grounding: result.grounding, topScore: result.topScore, verbatim: result.verbatim },
  });
}

/** Writes the complete answer as one text-start/delta/end triple: generation is not streamed
 *  token-by-token at this layer. */
function writeAnswer(writer: UIMessageStreamWriter<AskUIMessage>, answer: string): void {
  writer.write({ type: 'text-start', id: ANSWER_TEXT_PART_ID });
  writer.write({ type: 'text-delta', id: ANSWER_TEXT_PART_ID, delta: answer });
  writer.write({ type: 'text-end', id: ANSWER_TEXT_PART_ID });
}

function writeRefusal(
  writer: UIMessageStreamWriter<AskUIMessage>,
  outcome: AskRefusalOutcome,
  question: string
): void {
  const copy = refusalCopyFor(outcome, question);
  writer.write({
    type: 'data-refusal',
    id: REFUSAL_PART_ID,
    data: { outcome, message: copy.message, offerCapture: copy.offerCapture },
  });
}

function assertNeverOutcome(outcome: never): never {
  throw new Error(`Unhandled ask outcome: ${JSON.stringify(outcome)}`);
}

/** Writes the answer or refusal for `result`, after the retrieval trace. Exhaustively switches
 *  over `AskOutcome` so a future outcome is a compile error here, not a silent no-op. */
function writeOutcome(writer: UIMessageStreamWriter<AskUIMessage>, result: AskOnceResult, question: string): void {
  switch (result.outcome) {
    case 'answered': {
      if (result.answer === null) {
        // askOnce() never returns this combination; throw to surface a contract violation.
        throw new Error('askOnce() returned outcome "answered" with a null answer.');
      }
      writeAnswer(writer, result.answer);
      return;
    }
    case 'refused_no_grounding':
    case 'refused_off_task':
    case 'refused_unanswerable':
      writeRefusal(writer, result.outcome, question);
      return;
    default:
      return assertNeverOutcome(result.outcome);
  }
}

function buildTurnLogEntry(params: {
  id: string;
  conversationId: string;
  sessionId: string;
  question: string;
  corpusHash: string;
  result: AskOnceResult;
}): TurnLogEntry {
  const { id, conversationId, sessionId, question, corpusHash, result } = params;
  return {
    id,
    conversationId,
    sessionId,
    question,
    answer: result.answer,
    outcome: result.outcome,
    grounding: result.grounding,
    topScore: result.topScore,
    retrieved: result.retrieved,
    askVersion: result.askVersion,
    corpusHash,
    latencyMs: result.latencyMs,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    embedTokens: result.embedTokens,
    costUsd: result.costUsd,
  };
}

/** Runs one turn: status part before any await, then `askOnce()`, then the trace and answer or
 *  refusal, then the log. See docs/ask-agent/05-runtime.md's Disconnect safety note. */
export async function runAskTurn(params: RunAskTurnParams): Promise<void> {
  const { writer, signal, question, previousQuestion, history, conversationId, sessionId, corpusHash } = params;
  const turnId = randomUUID();

  writer.write({
    type: 'data-status',
    id: STATUS_PART_ID,
    data: { label: 'searching corpus' },
    transient: true,
  });

  let result: AskOnceResult;
  try {
    result = await askOnce({ question, previousQuestion, history });
  } catch (err) {
    // No graded outcome was reached, so there is nothing valid for turns.outcome: no row is
    // written here, unlike the disconnect path below where askOnce() did produce a result.
    console.error(`ask turn ${turnId} failed before producing a result:`, err);
    if (!signal.aborted) {
      writer.write({
        type: 'data-refusal',
        id: REFUSAL_PART_ID,
        data: {
          outcome: 'refused_no_grounding',
          message: 'Something went wrong answering that. Try asking again in a moment.',
          offerCapture: false,
        },
      });
    }
    return;
  }

  if (signal.aborted) {
    await insertTurn(buildTurnLogEntry({ id: turnId, conversationId, sessionId, question, corpusHash, result }));
    return;
  }

  try {
    writeRetrievalTrace(writer, result);
    writeOutcome(writer, result, question);
  } finally {
    await insertTurn(buildTurnLogEntry({ id: turnId, conversationId, sessionId, question, corpusHash, result }));
  }
}
