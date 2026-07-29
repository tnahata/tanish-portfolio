import type { HistoryPair } from './prompt';
import { estimateTokens } from './tokens';
import { fetchRecentTurns, type StoredTurn } from './turns';
import { refusalCopyFor, type AskRefusalOutcome } from './refusals';

/** Assembles conversation history for a turn: `previousQuestion` plus `HistoryPair[]` under a
 *  token budget. Full conversation, not a fixed pair count; see docs/ask-agent/05-runtime.md. */

/** docs/ask-agent/05-runtime.md: "Budget: 15k tokens of history." */
const HISTORY_TOKEN_BUDGET = 15_000;

const REFUSAL_OUTCOMES: readonly AskRefusalOutcome[] = [
  'refused_no_grounding',
  'refused_off_task',
  'refused_unanswerable',
];

function isAskRefusalOutcome(outcome: string): outcome is AskRefusalOutcome {
  return (REFUSAL_OUTCOMES as readonly string[]).includes(outcome);
}

/** Refused turns are kept as their refusal copy (`HistoryPair` has no separate refusal slot), so
 *  a follow-up like "why can't you answer that?" replays what the user actually saw. */
function historyAnswerFor(turn: StoredTurn): string {
  if (turn.outcome === 'answered') {
    // A stored `answered` row with a null answer means the 90-day retention job nulled it.
    return turn.answer ?? '';
  }
  if (isAskRefusalOutcome(turn.outcome)) {
    return refusalCopyFor(turn.outcome, turn.question).message;
  }
  // An outcome this module doesn't have copy for yet (an abuse-control refusal, or a future
  // value): fall back to a generic line rather than throwing and taking down a healthy turn.
  return "He didn't answer that one. Ask again if you would like to try a different angle.";
}

function toHistoryPairs(turns: readonly StoredTurn[]): HistoryPair[] {
  return turns.map((turn) => ({ question: turn.question, answer: historyAnswerFor(turn) }));
}

/** Evicts oldest pairs first until the remainder fits `budgetTokens`. Always keeps at least the
 *  most recent pair, even over budget, rather than dropping the most relevant context. */
function applyTokenBudget(pairs: readonly HistoryPair[], budgetTokens: number): HistoryPair[] {
  const kept: HistoryPair[] = [];
  let totalTokens = 0;
  for (let i = pairs.length - 1; i >= 0; i--) {
    const pair = pairs[i];
    const pairTokens = estimateTokens(pair.question) + estimateTokens(pair.answer);
    if (kept.length > 0 && totalTokens + pairTokens > budgetTokens) break;
    kept.push(pair);
    totalTokens += pairTokens;
  }
  return kept.reverse();
}

/** The prior turn's question, for lib/ask/retrieve.ts's query rewrite, only when that turn was
 *  `answered`: a follow-up to a refusal is a new question, not evidence to fold in. */
function previousQuestionFrom(turns: readonly StoredTurn[]): string | null {
  const last = turns[turns.length - 1];
  return last && last.outcome === 'answered' ? last.question : null;
}

export interface ConversationHistory {
  previousQuestion: string | null;
  history: HistoryPair[];
}

/** Fetches and assembles everything `askOnce()` needs about the conversation so far, for
 *  `conversationId`. The single entry point app/api/ask/route.ts calls. */
export async function loadConversationHistory(conversationId: string): Promise<ConversationHistory> {
  const turns = await fetchRecentTurns(conversationId);
  return {
    previousQuestion: previousQuestionFrom(turns),
    history: applyTokenBudget(toHistoryPairs(turns), HISTORY_TOKEN_BUDGET),
  };
}
