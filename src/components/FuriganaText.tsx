import type { ReactNode } from 'react';

interface FuriganaTextProps {
  text: string;
  className?: string;
  reading?: string;
  word?: string;
}

const furiganaPattern = /([\p{Script=Han}々〆ヶ]+)\[([^\]]+)\]/gu;

export function FuriganaText({ text, className, reading, word }: FuriganaTextProps) {
  const normalizedReading = reading?.trim();
  const hasReading = Boolean(normalizedReading && normalizedReading !== '—');

  if (hasReading && !word) {
    return <span className={className}><ruby>{text}<rt>{normalizedReading}</rt></ruby></span>;
  }

  const content: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const pattern = hasReading && word
    ? new RegExp(`${furiganaPattern.source}|(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gu')
    : new RegExp(furiganaPattern.source, 'gu');

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      content.push(text.slice(lastIndex, match.index));
    }
    const matchedWord = match[3];
    content.push(matchedWord
      ? <ruby key={`${match.index}-${matchedWord}`}>{matchedWord}<rt>{normalizedReading}</rt></ruby>
      : <ruby key={`${match.index}-${match[1]}`}>{match[1]}<rt>{match[2]}</rt></ruby>);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    content.push(text.slice(lastIndex));
  }

  return <span className={className}>{content}</span>;
}