const lowerCaseWords = new Set(['a', 'an', 'and', 'for', 'in', 'of', 'on', 'or', 'the', 'to']);

const specialWords: Record<string, string> = {
  dj: 'DJ',
  edm: 'EDM',
  idm: 'IDM',
  'r&b': 'R&B',
  uk: 'UK',
  us: 'US',
};

function formatPart(part: string, isFirstWord: boolean) {
  const normalized = part.toLocaleLowerCase('en-US');
  const special = specialWords[normalized];
  if (special) return special;
  if (!isFirstWord && lowerCaseWords.has(normalized)) return normalized;
  return normalized ? `${normalized[0].toLocaleUpperCase('en-US')}${normalized.slice(1)}` : normalized;
}

export function formatGenreName(name: string) {
  let wordIndex = 0;
  return name.trim().split(/(\s+)/).map((word) => {
    if (/^\s+$/.test(word)) return word;
    const isFirstWord = wordIndex === 0;
    wordIndex += 1;
    return word.split(/([/-])/).map((part, partIndex) => (
      part === '/' || part === '-'
        ? part
        : formatPart(part, isFirstWord && partIndex === 0)
    )).join('');
  }).join('');
}
