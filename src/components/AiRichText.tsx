import type { CSSProperties, ReactNode } from 'react';

interface AiRichTextProps {
  text: string;
  idPrefix?: string;
  style?: CSSProperties;
}

const paragraphStyle: CSSProperties = {
  margin: 0,
  fontSize: 'inherit',
  lineHeight: 1.6,
  color: 'inherit',
};

const headingStyle: CSSProperties = {
  margin: '12px 0 6px',
  fontSize: 13,
  fontWeight: 800,
  color: 'inherit',
  letterSpacing: '-0.01em',
};

const listStyle: CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  display: 'grid',
  gap: 6,
};

export function renderAiInlineMarkdown(text: string, keyPrefix = 'inline'): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    const bold = /^\*\*([^*]+)\*\*$/.exec(part);
    if (bold) {
      return (
        <strong key={`${keyPrefix}-b-${index}`} style={{ fontWeight: 700 }}>
          {bold[1]}
        </strong>
      );
    }
    return <span key={`${keyPrefix}-t-${index}`}>{part}</span>;
  });
}

export default function AiRichText({ text, idPrefix = 'ai', style }: AiRichTextProps) {
  const lines = text.split('\n');
  const blocks: ReactNode[] = [];
  let bulletItems: string[] = [];
  let orderedItems: string[] = [];

  const flushBullets = () => {
    if (bulletItems.length === 0) return;
    const items = [...bulletItems];
    blocks.push(
      <ul key={`${idPrefix}-ul-${blocks.length}`} style={listStyle}>
        {items.map((item, index) => (
          <li key={`${idPrefix}-li-${blocks.length}-${index}`} style={paragraphStyle}>
            {renderAiInlineMarkdown(item, `${idPrefix}-li-${blocks.length}-${index}`)}
          </li>
        ))}
      </ul>,
    );
    bulletItems = [];
  };

  const flushOrdered = () => {
    if (orderedItems.length === 0) return;
    const items = [...orderedItems];
    blocks.push(
      <ol key={`${idPrefix}-ol-${blocks.length}`} style={listStyle}>
        {items.map((item, index) => (
          <li key={`${idPrefix}-oli-${blocks.length}-${index}`} style={paragraphStyle}>
            {renderAiInlineMarkdown(item, `${idPrefix}-oli-${blocks.length}-${index}`)}
          </li>
        ))}
      </ol>,
    );
    orderedItems = [];
  };

  const flushLists = () => {
    flushBullets();
    flushOrdered();
  };

  lines.forEach((rawLine, index) => {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushLists();
      return;
    }

    const heading = trimmed.match(/^#{1,3}\s+(.+)$/);
    if (heading) {
      flushLists();
      blocks.push(
        <h4 key={`${idPrefix}-h-${index}`} style={{ ...headingStyle, marginTop: blocks.length ? 12 : 0 }}>
          {renderAiInlineMarkdown(heading[1], `${idPrefix}-h-${index}`)}
        </h4>,
      );
      return;
    }

    const bulletMatch = trimmed.match(/^[-*•]\s+(.*)$/);
    if (bulletMatch) {
      flushOrdered();
      bulletItems.push(bulletMatch[1]);
      return;
    }

    const orderedMatch = trimmed.match(/^\d+[.)]\s+(.*)$/);
    if (orderedMatch) {
      flushBullets();
      orderedItems.push(orderedMatch[1]);
      return;
    }

    flushLists();
    blocks.push(
      <p key={`${idPrefix}-p-${index}`} style={paragraphStyle}>
        {renderAiInlineMarkdown(trimmed, `${idPrefix}-p-${index}`)}
      </p>,
    );
  });

  flushLists();

  return (
    <div style={{ display: 'grid', gap: 8, ...style }}>
      {blocks.length > 0 ? blocks : <p style={paragraphStyle}>{text}</p>}
    </div>
  );
}
