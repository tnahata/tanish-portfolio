import { createHash } from 'node:crypto';
import { MarkdownNodeParser } from '@llamaindex/core/node-parser';
import { Document, MetadataMode } from '@llamaindex/core/schema';

const HEADER_METADATA_PREFIX = 'Header_';
const HEADING_BREADCRUMB_SEPARATOR = ' > ';

export interface Chunk {
  ordinal: number;
  heading: string | null;
  content: string;
}

function headerLevels(metadata: Record<string, unknown>): number[] {
  return Object.keys(metadata)
    .filter((key) => key.startsWith(HEADER_METADATA_PREFIX))
    .map((key) => Number(key.slice(HEADER_METADATA_PREFIX.length)))
    .sort((a, b) => a - b);
}

function headingBreadcrumb(metadata: Record<string, unknown>): string | null {
  const titles = headerLevels(metadata).map((level) => metadata[`${HEADER_METADATA_PREFIX}${level}`]);
  return titles.length > 0 ? titles.join(HEADING_BREADCRUMB_SEPARATOR) : null;
}

/** MarkdownNodeParser strips the leading `#`s from a section's own heading line; restore them. */
function restoreHeadingMarkup(text: string, metadata: Record<string, unknown>): string {
  const levels = headerLevels(metadata);
  const ownLevel = levels.at(-1);
  if (ownLevel === undefined) return text;

  const [headingLine, ...bodyLines] = text.split('\n');
  return [`${'#'.repeat(ownLevel)} ${headingLine}`, ...bodyLines].join('\n');
}

/** One chunk per `##` section, detected structurally so a heading-shaped line inside a fenced
 *  code block is never split on. See docs/ask-agent/01-corpus.md. */
export function chunkDocument(content: string): Chunk[] {
  const parser = new MarkdownNodeParser();
  const document = new Document({ text: content });
  const nodes = parser.getNodesFromDocuments([document]);

  return nodes
    .map((node) => ({ text: node.getContent(MetadataMode.NONE).trim(), metadata: node.metadata as Record<string, unknown> }))
    .filter((section) => section.text.length > 0)
    .map((section, ordinal) => ({
      ordinal,
      heading: headingBreadcrumb(section.metadata),
      content: restoreHeadingMarkup(section.text, section.metadata),
    }));
}

export function hashContent(content: string): string {
  return createHash('sha256').update(content.trim()).digest('hex');
}
