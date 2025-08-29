/**
 * Advanced fuzzy search implementation with scoring and highlighting
 */

export interface FuzzySearchResult {
  matches: boolean;
  score: number;
  highlightRanges?: Array<{ start: number; end: number }>;
}

export interface FuzzySearchOptions {
  caseSensitive?: boolean;
  includeScore?: boolean;
  includeMatches?: boolean;
  threshold?: number; // Minimum score to be considered a match (0-1)
  distance?: number; // Maximum distance between characters
  ignoreLocation?: boolean;
  ignoreFieldNorm?: boolean;
}

/**
 * Performs fuzzy search on a single string
 */
export function fuzzySearch(
  text: string,
  pattern: string,
  options: FuzzySearchOptions = {}
): FuzzySearchResult {
  const {
    caseSensitive = false,
    includeMatches = false,
    threshold = 0.3,
    distance = 100,
  } = options;

  if (!pattern) {
    return { matches: true, score: 1 };
  }

  const textToSearch = caseSensitive ? text : text.toLowerCase();
  const patternToSearch = caseSensitive ? pattern : pattern.toLowerCase();

  // Exact match
  if (textToSearch === patternToSearch) {
    return {
      matches: true,
      score: 1,
      highlightRanges: includeMatches ? [{ start: 0, end: text.length }] : undefined,
    };
  }

  // Substring match
  const substringIndex = textToSearch.indexOf(patternToSearch);
  if (substringIndex !== -1) {
    const score = 0.9 - (substringIndex / textToSearch.length) * 0.1;
    return {
      matches: true,
      score,
      highlightRanges: includeMatches
        ? [{ start: substringIndex, end: substringIndex + patternToSearch.length }]
        : undefined,
    };
  }

  // Fuzzy matching with Levenshtein-like algorithm
  const result = advancedFuzzyMatch(textToSearch, patternToSearch, distance, includeMatches);
  
  if (result.score >= threshold) {
    return {
      matches: true,
      score: result.score,
      highlightRanges: result.highlightRanges,
    };
  }

  return { matches: false, score: 0 };
}

/**
 * Advanced fuzzy matching algorithm
 */
function advancedFuzzyMatch(
  text: string,
  pattern: string,
  maxDistance: number,
  includeMatches: boolean
): { score: number; highlightRanges?: Array<{ start: number; end: number }> } {
  const textLen = text.length;
  const patternLen = pattern.length;

  if (patternLen === 0) return { score: 1 };
  if (textLen === 0) return { score: 0 };

  let score = 0;
  let patternIndex = 0;
  let consecutiveMatches = 0;
  let lastMatchIndex = -1;
  const matchedIndices: number[] = [];

  for (let textIndex = 0; textIndex < textLen && patternIndex < patternLen; textIndex++) {
    if (text[textIndex] === pattern[patternIndex]) {
      matchedIndices.push(textIndex);
      patternIndex++;

      // Bonus for consecutive matches
      if (textIndex === lastMatchIndex + 1) {
        consecutiveMatches++;
        score += 2 + consecutiveMatches;
      } else {
        consecutiveMatches = 0;
        score += 1;
      }

      // Bonus for matches at word boundaries
      if (textIndex === 0 || isWordBoundary(text, textIndex)) {
        score += 3;
      }

      // Bonus for matches at the beginning
      if (textIndex < patternLen) {
        score += 2;
      }

      lastMatchIndex = textIndex;
    }
  }

  // Check if all pattern characters were matched
  if (patternIndex !== patternLen) {
    return { score: 0 };
  }

  // Normalize score based on text length and pattern length
  const maxPossibleScore = patternLen * 6; // Maximum possible score per character
  const normalizedScore = Math.min(score / maxPossibleScore, 1);

  // Apply penalties
  const lengthPenalty = Math.abs(textLen - patternLen) / Math.max(textLen, patternLen);
  const distancePenalty = calculateDistancePenalty(matchedIndices, maxDistance);
  
  const finalScore = Math.max(0, normalizedScore - lengthPenalty * 0.2 - distancePenalty * 0.1);

  let highlightRanges: Array<{ start: number; end: number }> | undefined;
  if (includeMatches && matchedIndices.length > 0) {
    highlightRanges = createHighlightRanges(matchedIndices);
  }

  return { score: finalScore, highlightRanges };
}

/**
 * Check if a position is at a word boundary
 */
function isWordBoundary(text: string, index: number): boolean {
  if (index === 0) return true;
  const prevChar = text[index - 1];
  return /[\s\-_.]/.test(prevChar);
}

/**
 * Calculate penalty based on distance between matches
 */
function calculateDistancePenalty(matchedIndices: number[], maxDistance: number): number {
  if (matchedIndices.length <= 1) return 0;

  let totalDistance = 0;
  for (let i = 1; i < matchedIndices.length; i++) {
    const distance = matchedIndices[i] - matchedIndices[i - 1] - 1;
    totalDistance += Math.max(0, distance - 1); // Allow for 1 character gap without penalty
  }

  return Math.min(totalDistance / (maxDistance * matchedIndices.length), 1);
}

/**
 * Create highlight ranges from matched indices
 */
function createHighlightRanges(matchedIndices: number[]): Array<{ start: number; end: number }> {
  if (matchedIndices.length === 0) return [];

  const ranges: Array<{ start: number; end: number }> = [];
  let rangeStart = matchedIndices[0];
  let rangeEnd = matchedIndices[0] + 1;

  for (let i = 1; i < matchedIndices.length; i++) {
    const currentIndex = matchedIndices[i];
    
    // If the current index is consecutive or very close, extend the range
    if (currentIndex <= rangeEnd + 2) {
      rangeEnd = currentIndex + 1;
    } else {
      // Start a new range
      ranges.push({ start: rangeStart, end: rangeEnd });
      rangeStart = currentIndex;
      rangeEnd = currentIndex + 1;
    }
  }

  // Add the last range
  ranges.push({ start: rangeStart, end: rangeEnd });

  return ranges;
}

/**
 * Search through an array of objects using fuzzy search
 */
export function fuzzySearchArray<T>(
  items: T[],
  pattern: string,
  keyExtractor: (item: T) => string | string[],
  options: FuzzySearchOptions = {}
): Array<{ item: T; score: number; matches?: FuzzySearchResult[] }> {
  if (!pattern) {
    return items.map(item => ({ item, score: 1 }));
  }

  const results = items
    .map(item => {
      const keys = keyExtractor(item);
      const keysArray = Array.isArray(keys) ? keys : [keys];
      
      let bestScore = 0;
      const matches: FuzzySearchResult[] = [];

      keysArray.forEach(key => {
        const result = fuzzySearch(key, pattern, options);
        if (result.matches) {
          bestScore = Math.max(bestScore, result.score);
          if (options.includeMatches) {
            matches.push(result);
          }
        }
      });

      return {
        item,
        score: bestScore,
        matches: options.includeMatches ? matches : undefined,
      };
    })
    .filter(result => result.score > (options.threshold || 0.3))
    .sort((a, b) => b.score - a.score);

  return results;
}

/**
 * Highlight matched text in a string
 */
export function highlightMatches(
  text: string,
  ranges: Array<{ start: number; end: number }>,
  highlightClass = 'highlight'
): string {
  if (!ranges || ranges.length === 0) return text;

  let result = '';
  let lastIndex = 0;

  ranges.forEach(range => {
    // Add text before the match
    result += text.slice(lastIndex, range.start);
    
    // Add highlighted match
    result += `<span class="${highlightClass}">${text.slice(range.start, range.end)}</span>`;
    
    lastIndex = range.end;
  });

  // Add remaining text
  result += text.slice(lastIndex);

  return result;
}
