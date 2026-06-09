/**
 * Name normalization + variant matching for the marketing console.
 *
 * Two consumers:
 *   - Customer search ("Davis" → every Davis; "Alex" → Alexander/Alexandra…)
 *   - Exclusion matching (a listed name suppresses its variants too)
 *
 * Matching is deliberately generous and always human-in-the-loop — the UI shows
 * who matched so a broad rule can be reviewed before it's trusted.
 */

/** Fold diacritics, lowercase, strip punctuation, collapse whitespace.
 *  Accent-folding ensures "José" → "jose" so an excluded "Jose" still matches. */
export function normalizeName(s: string | null | undefined): string {
  return String(s || "")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "") // José → Jose, Müller → Muller
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function nameTokens(s: string | null | undefined): string[] {
  return normalizeName(s).split(" ").filter(Boolean);
}

// Common given-name nickname groups. Any token in a group expands to the whole
// group, so "alex" matches "alexander" and vice-versa. Surnames fall through to
// plain substring/prefix matching, which already covers "show all Davis".
const NICKNAME_GROUPS: string[][] = [
  ["alex", "alexander", "alexandra", "alexis", "alejandro", "alejandra", "sasha", "lex"],
  ["rob", "robert", "bob", "bobby", "robbie"],
  ["bill", "william", "will", "billy", "liam"],
  ["jim", "james", "jimmy", "jamie"],
  ["mike", "michael", "mick", "mikey"],
  ["dave", "david", "davey"],
  ["dan", "daniel", "danny"],
  ["chris", "christopher", "christophe", "christina", "christine", "kris"],
  ["nick", "nicholas", "nicolas", "nicole", "nico"],
  ["tom", "thomas", "tommy"],
  ["tony", "anthony", "antonio"],
  ["joe", "joseph", "joey"],
  ["john", "johnny", "jon", "jonathan", "jonathon"],
  ["matt", "matthew", "mathew"],
  ["steve", "stephen", "steven", "stevie"],
  ["ben", "benjamin", "benji"],
  ["sam", "samuel", "samantha", "sammy"],
  ["kate", "katherine", "kathryn", "katie", "kathy", "catherine"],
  ["liz", "elizabeth", "beth", "betty", "eliza", "lizzie"],
  ["peggy", "margaret", "maggie", "meg"],
  ["dick", "richard", "rick", "ricky", "rich"],
  ["ed", "edward", "eddie", "ted", "teddy"],
  ["fred", "frederick", "freddie"],
  ["greg", "gregory"],
  ["jeff", "jeffrey", "geoffrey"],
  ["ken", "kenneth", "kenny"],
  ["larry", "lawrence", "laurence"],
  ["pat", "patrick", "patricia", "patty", "trish"],
  ["ron", "ronald", "ronnie"],
  ["andy", "andrew", "drew"],
  ["charlie", "charles", "chuck", "charley"],
  ["frank", "francis", "francisco", "frankie"],
  ["gabe", "gabriel"],
  ["manny", "manuel", "emmanuel"],
  ["jose", "pepe"],
  ["abby", "abigail"],
  ["becca", "rebecca", "becky"],
  ["debbie", "deborah", "debra"],
  ["jen", "jennifer", "jenny"],
  ["jess", "jessica", "jessie"],
  ["sue", "susan", "susie", "suzanne"],
  ["vicky", "victoria", "vic"],
];

const VARIANT_INDEX: Map<string, Set<string>> = (() => {
  const idx = new Map<string, Set<string>>();
  for (const group of NICKNAME_GROUPS) {
    const set = new Set(group);
    for (const tok of group) {
      const existing = idx.get(tok);
      if (existing) for (const v of set) existing.add(v);
      else idx.set(tok, new Set(set));
    }
  }
  return idx;
})();

/** All known variants of a token (always includes the token itself). */
export function expandVariants(token: string): Set<string> {
  const t = normalizeName(token);
  const set = new Set<string>([t]);
  const grp = VARIANT_INDEX.get(t);
  if (grp) for (const v of grp) set.add(v);
  return set;
}

/**
 * Does `haystack` (a customer's name, optionally + email handle) match `query`?
 * - Multi-word query: ALL query tokens must hit (variant-aware).
 * - Single-word query: substring OR variant/prefix token hit (so "davis" finds
 *   the surname anywhere, "alex" finds Alexander).
 */
export function nameMatches(haystack: string, query: string, useVariants = true): boolean {
  const norm = normalizeName(haystack);
  if (!norm) return false;
  const words = new Set(norm.split(" ").filter(Boolean));
  const qTokens = nameTokens(query);
  if (!qTokens.length) return false;

  const tokenHit = (qt: string): boolean => {
    if (words.has(qt)) return true;
    if (useVariants) for (const v of expandVariants(qt)) if (words.has(v)) return true;
    if ([...words].some((w) => w.startsWith(qt))) return true; // prefix
    return norm.includes(qt); // substring (surnames)
  };

  if (qTokens.length === 1) return tokenHit(qTokens[0]);
  return qTokens.every(tokenHit);
}
