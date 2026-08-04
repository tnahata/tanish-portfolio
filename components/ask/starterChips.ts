/** Route-aware starter prompts, computed client side. The server never receives page context. */

const HOME_CHIPS = [
  "Give me Tanish's 30 second story",
  'What broke while building ESMON?',
  'How does Noiseless work end to end?',
];

const ESMON_CHIPS = [
  'What broke while building ESMON?',
  'Why did offline-first shape the whole architecture?',
  "Give me Tanish's 30 second story",
];

const HYBRID_FIT_CHIPS = [
  'How does HybridFit model totally different sports in one schema?',
  "What cut HybridFit's query load by over 99%?",
  'Why build HybridFit instead of using an existing app?',
];

const NOISELESS_CHIPS = [
  'How does Noiseless work end to end?',
  'Why does Noiseless wait for human approval before publishing?',
  'What was the hardest part of building Noiseless?',
];

const ROUTE_CHIPS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['/projects/esmon', ESMON_CHIPS],
  ['/projects/hybrid-fit', HYBRID_FIT_CHIPS],
  ['/projects/discovery-agent', NOISELESS_CHIPS],
];

/** Picks the starter chip set for a pathname. Falls back to the home defaults everywhere else. */
export function getStarterChips(pathname: string): readonly string[] {
  const match = ROUTE_CHIPS.find(([prefix]) => pathname.startsWith(prefix));
  return match ? match[1] : HOME_CHIPS;
}
