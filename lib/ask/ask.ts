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
    return { kind: 'gated', gate };
  }

  const chunks = await retrieve(question);
  const grading = grade(chunks);
  if (grading.verdict !== 'strong') {
    return refuseForFree(identity, question, grading.reason, grading.chunks);
  }

  const claim = await claimTurn({ identity, question, model: CHAT_MODEL });
  if ('gated' in claim) {
    return { kind: 'gated', gate: claim.gated };
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
 * turn as `unanswerable` when the marker fires. A generation that errors or finishes truncated
 * writes neither: the claimed row stays with no answer and no locked reason, which is
 * distinguishable from every resolved outcome and is what an operator query watches for.
 */
export function runTurn(turn: ReadyTurn): ReadableStream<string> {
  const { stream, outcome } = generate(turn.prompt);

  outcome
    .then((result) => {
      if (result.unanswerable) {
        return lockTurn({ turnId: turn.turnId, reason: 'unanswerable', retrieved: turn.retrieved });
      }
      return completeTurn({ turnId: turn.turnId, answer: result.text, retrieved: turn.retrieved });
    })
    .catch(() => {
      // A stream error or truncated finish. Nothing to write: an unfinished answer must never
      // look like a real one, so the row stays claimed with no answer and no locked reason.
    });

  return stream;
}
