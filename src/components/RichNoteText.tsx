import React from 'react';
import { ExternalLink } from 'lucide-react';
import { parseNoteTextTokens } from '../utils/linkUtils';

interface RichNoteTextProps {
  text: string;
  className?: string;
  style?: React.CSSProperties;
}

export const RichNoteText: React.FC<RichNoteTextProps> = ({
  text,
  className = '',
  style,
}) => {
  const tokens = parseNoteTextTokens(text);

  return (
    <span className={className} style={style}>
      {tokens.map((token, idx) => {
        if (token.type === 'link' && token.url) {
          return (
            <a
              key={`${idx}-${token.url}`}
              href={token.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title={`Abrir: ${token.url}`}
              className="inline-flex items-center gap-0.5 underline decoration-2 underline-offset-2 font-bold hover:opacity-75 transition-opacity break-words px-0.5 rounded bg-black/[0.04]"
              style={{ color: style?.color || '#0D3B66' }}
            >
              <span>{token.text}</span>
              <ExternalLink className="w-2.5 h-2.5 inline shrink-0 opacity-75" />
            </a>
          );
        }

        return <React.Fragment key={idx}>{token.text}</React.Fragment>;
      })}
    </span>
  );
};
