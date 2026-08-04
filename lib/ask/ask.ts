import { CHAT_MODEL } from './config';
import { preFilter } from './filter';
import { generate } from './generate';
import { checkGate, claimTurn, completeTurn, loadHistory, lockTurn, logFreeTurn } from './log';
import type { Gated } from './log';
import { buildPrompt, ForgedDelimiterError } from './prompt';
import type { PromptParts } from './prompt';
import { refusalCopy } from './refusals';
import { grade, retrieve } from './retrieve';
import type { Identity, LockedReason, RetrievedChunk } from './types';

/** A turn that stopped before generating, with the copy the client should render. */
export interface RefusedTurn {
  kind: 'refused';
  reason: LockedReason;
  text: string;
}

export interface GatedTurn {
  kind: 'gated';
  gate: Gated;
}

/** A turn that cleared every gate and is ready to generate. */
export interface ReadyTurn {
  kind: 'ready';
  turnId: string;
  prompt: PromptParts;
  retrieved: RetrievedChunk[];
}

export type PreparedTurn = RefusedTurn | GatedTurn | ReadyTurn;

/** Logs a costless refusal and builds the turn the caller returns. */
async function refuseForFree(
  identity: Identity,
  question: string,
  reason: LockedReason,
  retrieved?: RetrievedChunk[],
): Promise<RefusedTurn> {
  await logFreeTurn({ identity, question, reason, retrieved });
  return { kind: 'refused', reason, text: refusalCopy(reason) };
}

/** Logs a gate hit so `sign_in_required` and `rate_limited` are queryable, not just enum values. */
async function gateForFree(
  identity: Identity,
  question: string,
  gate: Gated,
  retrieved?: RetrievedChunk[],
): Promise<GatedTurn> {
  await logFreeTurn({ identity, question, reason: gate.reason, retrieved });
  return { kind: 'gated', gate };
}

/**
 * Everything up to but not including the model call: pre-filter, gate, embed, retrieve, grade,
 * history, claim. Split from runTurn so the route can stream without owning generation.
 */
export async function prepareTurn(input: {
  question: string;
  identity: Identity;
}): Promise<PreparedTurn> {
  const { question, identity } = input;

  const preFilterReason = preFilter(question);
  if (preFilterReason) {
    return refuseForFree(identity, question, preFilterReason);
  }

  const gate = await checkGate(identity);
  if (gate) {
    return gateForFree(identity, question, gate);
  }

  const chunks = await retrieve(question);
  const grading = grade(chunks);
  if (grading.verdict !== 'strong') {
    return refuseForFree(identity, question, grading.reason, grading.chunks);
  }

  const claim = await claimTurn({ identity, question, model: CHAT_MODEL });
  if ('gated' in claim) {
    return gateForFree(identity, question, claim.gated, [...grading.grounding.chunks]);
  }

  const history = await loadHistory(identity);

  try {
    const prompt = buildPrompt({ question, grounding: grading.grounding, history });
    return { kind: 'ready', turnId: claim.turnId, prompt, retrieved: [...grading.grounding.chunks] };
  } catch (error) {
    if (error instanceof ForgedDelimiterError) {
      return { kind: 'refused', reason: 'injection', text: refusalCopy('injection') };
    }
    throw error;
  }
}

/**
 * Generates against a prepared turn and writes the outcome. Emits answer text, or resolves the
 * turn as `unanswerable` when the marker fires. `done` resolves once that write has committed, so
 * a caller that must close a resource (a pool, a serverless invocation) can await it instead of
 * racing a fire-and-forget write. `done` never rejects: a stream error or truncated finish is
 * already handled by leaving the row claimed with no answer and no locked reason, not by throwing.
 */
export function runTurn(turn: ReadyTurn): { stream: ReadableStream<string>; done: Promise<void> } {
  const { stream, outcome } = generate(turn.prompt);

  const done = outcome
    .then((result) => {
      if (result.unanswerable) {
        return lockTurn({ turnId: turn.turnId, reason: 'unanswerable', retrieved: turn.retrieved });
      }
      return completeTurn({ turnId: turn.turnId, answer: result.text, retrieved: turn.retrieved });
    })
    .catch(() => {});

  return { stream, done };
}
