/**
 * Word-count-based ad insertion engine for chapter reader pages.
 *
 * Given an array of paragraph strings, computes how many in-article ads should
 * appear and at which paragraph indices to insert them. All heavy work is
 * designed to be memoized by the caller so positions are only recomputed when
 * the chapter content changes.
 */

/** Minimum words a paragraph must have to be a valid ad-neighbour. */
const MIN_PARAGRAPH_WORDS = 40;

/** How many ads to show for a given total word count. */
export function adCountForWordCount(words: number): number {
  if (words < 1500) return 1;
  if (words <= 3000) return 2;
  if (words <= 5000) return 3;
  return 4;
}

function countWords(paragraph: string): number {
  const trimmed = paragraph.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export interface AdInsertionPlan {
  /** Total word count across all paragraphs. */
  wordCount: number;
  /** Number of ads to insert. */
  adCount: number;
  /** Paragraph indices after which an ad should be inserted (0-based). */
  insertAfter: number[];
}

/**
 * Compute an ad insertion plan for a list of paragraph strings.
 *
 * Rules enforced:
 *  - Never insert before the first paragraph or immediately after the title
 *    (the caller renders the title separately, so index 0 is the first body
 *    paragraph — we simply never return index 0).
 *  - Never insert immediately before the final paragraph.
 *  - Never insert between two consecutive short paragraphs (both < 40 words).
 *  - Never insert two ads at the same position (no consecutive ads).
 *  - Distribute ads as evenly as possible across the reading flow.
 */
export function computeAdInsertions(paragraphs: string[]): AdInsertionPlan {
  const wordCounts = paragraphs.map(countWords);
  const wordCount = wordCounts.reduce((a, b) => a + b, 0);
  const adCount = adCountForWordCount(wordCount);

  const n = paragraphs.length;
  const insertAfter: number[] = [];

  if (adCount === 0 || n < 4) {
    return { wordCount, adCount: 0, insertAfter };
  }

  // Candidate indices: after paragraph i (1-based insertion point i).
  // Forbidden: i < 1 (too close to title), i >= n - 1 (before final paragraph),
  // and positions where both neighbours are short.
  const candidates: number[] = [];
  for (let i = 1; i < n - 1; i++) {
    const prevShort = wordCounts[i - 1] < MIN_PARAGRAPH_WORDS;
    const selfShort = wordCounts[i] < MIN_PARAGRAPH_WORDS;
    if (prevShort && selfShort) continue;
    candidates.push(i);
  }

  if (candidates.length === 0) {
    // Fallback: use evenly spaced indices ignoring the short-paragraph rule.
    for (let i = 1; i < n - 1; i++) candidates.push(i);
    if (candidates.length === 0) return { wordCount, adCount: 0, insertAfter };
  }

  // Evenly distribute `adCount` positions across the candidate list.
  const step = candidates.length / (adCount + 1);
  const used = new Set<number>();

  for (let k = 1; k <= adCount; k++) {
    const desiredIdx = Math.round(k * step);
    const clamped = Math.max(0, Math.min(candidates.length - 1, desiredIdx));
    const pos = candidates[clamped];

    // Avoid duplicates and consecutive ad positions.
    if (!used.has(pos)) {
      used.add(pos);
      insertAfter.push(pos);
    }
  }

  insertAfter.sort((a, b) => a - b);
  return { wordCount, adCount: insertAfter.length, insertAfter };
}
