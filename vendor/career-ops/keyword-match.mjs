// Extracted pure matcher from upstream keyword-match.mjs. Node CLI and file I/O removed.
// MIT © 2026 Santiago Fernández de Valderrama; see LICENSE and PROVENANCE.md.
/**
 * Small, deliberately conservative map of interchangeable ATS surface forms.
 * Each inner array is one equivalence group; matching is bidirectional.
 */
export const SYNONYMS = [
  ['javascript', 'js'],
  ['typescript', 'ts'],
  ['kubernetes', 'k8s'],
  ['machine learning', 'ml'],
  ['ci/cd', 'cicd'],
  ['infrastructure as code', 'iac'],
  ['natural language processing', 'nlp'],
  ['large language model', 'large language models', 'llm'],
  ['amazon web services', 'aws'],
  ['google cloud platform', 'gcp'],
  ['postgresql', 'postgres'],
];

/**
 * Lowercase and collapse internal runs of whitespace to single spaces.
 *
 * @param {string} s - Raw text.
 * @returns {string} Normalized text.
 */
export function normalizeText(s) {
  return String(s).toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Count boundary-delimited occurrences of `term` in `text`, case-insensitively.
 * A boundary means the term is not flanked by an alphanumeric character, so
 * "java" does not match inside "javascript" yet "c++", "ci/cd" and "node.js"
 * still match around their symbols.
 *
 * @param {string} term - Surface form to find.
 * @param {string} text - Haystack.
 * @returns {number} Occurrence count.
 */
export function countOccurrences(term, text) {
  const t = normalizeText(term);
  if (!t) return 0;
  const hay = normalizeText(text);
  const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, 'g');
  const matches = hay.match(re);
  return matches ? matches.length : 0;
}

/**
 * Conservative singular/plural variants of a term. An "s" is never stripped
 * from a token of three characters or fewer (aws -> aw, k8s -> k8, js -> j are
 * meaningless), and one is appended only from three characters up: that is
 * where the acronyms a CV pluralizes sit (llm -> llms, api -> apis, gpu ->
 * gpus), while a two-letter "+s" is often another word (it -> its, hr -> hrs).
 * It only ever ADDS a candidate form; boundary-aware counting keeps these from
 * creating false positives (the "kubernete" form never hits "kubernetes").
 *
 * @param {string} term - Keyword or synonym.
 * @returns {string[]} Distinct candidate forms.
 */
export function variantForms(term) {
  const t = normalizeText(term);
  const forms = new Set([t]);
  if (t.length < 3) return [...forms];
  if (!t.endsWith('s')) forms.add(t + 's');
  else if (t.length > 3) forms.add(t.slice(0, -1));
  return [...forms];
}

/**
 * All surface forms to search for a keyword: its own plural variants plus the
 * variants of every member of any synonym group one of those forms belongs to,
 * so `LLMs` reaches the group that `LLM` is in.
 *
 * @param {string} keyword - JD keyword.
 * @returns {string[]} Distinct surface forms.
 */
export function expandTerms(keyword) {
  const k = normalizeText(keyword);
  const forms = variantForms(k);
  const terms = new Set(forms);
  for (const group of SYNONYMS) {
    if (!forms.some((form) => group.includes(form))) continue;
    for (const member of group) {
      if (member === k) continue;
      for (const v of variantForms(member)) terms.add(v);
    }
  }
  return [...terms];
}

/**
 * Total boundary-aware occurrences of a keyword across all its surface forms.
 *
 * @param {string} keyword - JD keyword.
 * @param {string} text - CV text.
 * @returns {number} Occurrence count.
 */
export function keywordCount(keyword, text) {
  let total = 0;
  for (const term of expandTerms(keyword)) total += countOccurrences(term, text);
  return total;
}

/**
 * Core coverage analysis. Pure: no I/O. `thin` is a SUBSET of `present`
 * (keywords mentioned exactly once); coverage counts thin keywords as present.
 *
 * @param {string[]} keywords - JD keywords (order preserved, case-insensitively de-duped).
 * @param {string} cvText - Raw CV text to scan.
 * @returns {{total:number, presentCount:number, coveragePct:number,
 *            present:string[], thin:string[], missing:string[]}}
 */
export function analyzeCoverage(keywords, cvText) {
  const seen = new Set();
  const cleaned = [];
  for (const raw of keywords || []) {
    const k = String(raw).trim();
    if (!k) continue;
    const key = normalizeText(k);
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push(k);
  }

  const present = [];
  const thin = [];
  const missing = [];
  for (const k of cleaned) {
    const count = keywordCount(k, cvText || '');
    if (count === 0) {
      missing.push(k);
    } else {
      present.push(k);
      if (count === 1) thin.push(k);
    }
  }

  const total = cleaned.length;
  const presentCount = present.length;
  const coveragePct = total === 0 ? 0 : Math.round((presentCount / total) * 100);
  return { total, presentCount, coveragePct, present, thin, missing };
}


