import { describe, expect, it } from 'vitest';
import {
  AskSearchArgsError,
  computeSummary,
  excerptFor,
  formatResultLine,
  parseArgs,
  type SearchResultRow,
} from '../../scripts/search';

/** Pure-logic tests for scripts/search.ts: argument parsing, the excerpt/format helpers, and the
 *  threshold-tuning summary. `runSearch`/`printIndexSummary`/`main` (I/O-shaped) are untested here. */

describe('parseArgs', () => {
  it('throws AskSearchArgsError with a usage line when no question is given', () => {
    expect(() => parseArgs([])).toThrow(AskSearchArgsError);
    expect(() => parseArgs([])).toThrow(/Usage: npm run ask:search/);
  });

  it('parses a single question with the default limit', () => {
    const args = parseArgs(['What is ESMON?']);
    expect(args).toEqual({ questions: ['What is ESMON?'], limit: 8 });
  });

  it('parses multiple questions as separate arguments, preserving order', () => {
    const args = parseArgs(['question one', 'question two', 'question three']);
    expect(args.questions).toEqual(['question one', 'question two', 'question three']);
  });

  it('accepts --limit and applies it', () => {
    const args = parseArgs(['a question', '--limit', '3']);
    expect(args).toEqual({ questions: ['a question'], limit: 3 });
  });

  it('accepts --limit before the question', () => {
    const args = parseArgs(['--limit', '5', 'a question']);
    expect(args).toEqual({ questions: ['a question'], limit: 5 });
  });

  it('accepts --limit between two questions without treating it as a question', () => {
    const args = parseArgs(['question one', '--limit', '2', 'question two']);
    expect(args.questions).toEqual(['question one', 'question two']);
    expect(args.limit).toBe(2);
  });

  it('throws when --limit has no value', () => {
    expect(() => parseArgs(['a question', '--limit'])).toThrow(AskSearchArgsError);
    expect(() => parseArgs(['a question', '--limit'])).toThrow(/--limit requires a positive integer/);
  });

  it('throws when --limit is not a positive integer', () => {
    expect(() => parseArgs(['a question', '--limit', '0'])).toThrow(AskSearchArgsError);
    expect(() => parseArgs(['a question', '--limit', '-1'])).toThrow(AskSearchArgsError);
    expect(() => parseArgs(['a question', '--limit', 'abc'])).toThrow(AskSearchArgsError);
    expect(() => parseArgs(['a question', '--limit', '2.5'])).toThrow(AskSearchArgsError);
  });

  it('throws the usage error when only --limit is given and no question follows', () => {
    // --limit N is consumed as a flag, leaving zero questions, which is the same error as no
    // arguments at all.
    expect(() => parseArgs(['--limit', '3'])).toThrow(/Usage: npm run ask:search/);
  });
});

describe('excerptFor', () => {
  it('returns short content unchanged', () => {
    expect(excerptFor('short content')).toBe('short content');
  });

  it('collapses newlines and runs of whitespace into single spaces', () => {
    expect(excerptFor('line one\nline two\n\n  line three')).toBe('line one line two line three');
  });

  it('truncates to about 100 characters and marks truncation', () => {
    const long = 'x'.repeat(150);
    const result = excerptFor(long);
    expect(result.endsWith('...')).toBe(true);
    expect(result.length).toBeLessThan(long.length);
    expect(result.length).toBeLessThanOrEqual(103); // 100 chars + '...'
  });

  it('trims leading and trailing whitespace before measuring length', () => {
    expect(excerptFor('   padded content   ')).toBe('padded content');
  });
});

describe('formatResultLine', () => {
  const baseRow: SearchResultRow = {
    slug: 'esmon-overview',
    heading: 'Overview',
    content: 'ESMON parses raw binary journey data into filterable reports.',
    similarity: 0.84213,
  };

  it('prints similarity to 4 decimal places, the slug, heading, and an excerpt', () => {
    const line = formatResultLine(1, baseRow);
    expect(line).toContain('0.8421');
    expect(line).toContain('esmon-overview');
    expect(line).toContain('Overview');
    expect(line).toContain('ESMON parses raw binary journey data into filterable reports.');
  });

  it('uses a placeholder when heading is null', () => {
    const line = formatResultLine(1, { ...baseRow, heading: null });
    expect(line).toContain('(no heading)');
  });
});

describe('computeSummary', () => {
  function row(slug: string, similarity: number): SearchResultRow {
    return { slug, heading: null, content: '', similarity };
  }

  it('returns zeros for an empty result set', () => {
    expect(computeSummary([])).toEqual({
      topScore: 0,
      distinctDocumentsInTop3: 0,
      distinctDocumentsInResults: 0,
    });
  });

  it('reports the top score as the first result (results are assumed pre-ranked)', () => {
    const results = [row('a', 0.9), row('b', 0.5)];
    expect(computeSummary(results).topScore).toBe(0.9);
  });

  it('counts distinct documents in the top 3, ignoring duplicates from the same document', () => {
    const results = [row('a', 0.9), row('a', 0.85), row('b', 0.8), row('c', 0.1)];
    const summary = computeSummary(results);
    expect(summary.distinctDocumentsInTop3).toBe(2); // a, b (a appears twice)
    expect(summary.distinctDocumentsInResults).toBe(3); // a, b, c
  });

  it('does not let a result set shorter than 3 overcount distinct documents in the top 3', () => {
    const results = [row('a', 0.9), row('b', 0.8)];
    const summary = computeSummary(results);
    expect(summary.distinctDocumentsInTop3).toBe(2);
    expect(summary.distinctDocumentsInResults).toBe(2);
  });
});
