export function parseConjugationRules(value: unknown): Record<string, string> {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      throw new Error('Conjugation Rules must be valid JSON.');
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Conjugation Rules must be a JSON object.');
  }
  if (Object.values(parsed).some((entry) => typeof entry !== 'string')) {
    throw new Error('Each conjugation rule value must be text.');
  }
  return parsed as Record<string, string>;
}