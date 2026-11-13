export interface TextToken {
  type: 'text' | 'link';
  text: string;
  url?: string;
}

export interface DetectedLink {
  id: string;
  title: string;
  url: string;
  rawMatch: string;
}

/**
 * Generates a clean, readable hyperlink title from any URL.
 */
export const suggestTitleForUrl = (rawUrl: string): string => {
  try {
    const normalized = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
    const parsed = new URL(normalized);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();

    if (host.includes('drive.google.com')) return 'Pasta / Arquivo Google Drive';
    if (host.includes('docs.google.com')) {
      if (parsed.pathname.includes('spreadsheets')) return 'Planilha Google Sheets';
      if (parsed.pathname.includes('presentation')) return 'Apresentação Google Slides';
      return 'Documento Google Docs';
    }
    if (host.includes('calendar.google.com')) return 'Evento Google Agenda';
    if (host.includes('meet.google.com')) return 'Reunião Google Meet';
    if (host.includes('youtube.com') || host.includes('youtu.be')) return 'Vídeo YouTube';
    if (host.includes('whatsapp.com') || host.includes('wa.me')) return 'Conversa WhatsApp';
    if (host.includes('instagram.com')) return 'Post Instagram';
    if (host.includes('mercadolivre.com')) return 'Produto Mercado Livre';
    if (host.includes('amazon.')) return 'Produto Amazon';
    if (host.includes('maps.google.') || host.includes('maps.app.goo.gl')) return 'Localização Google Maps';
    if (host.includes('github.com')) return 'Repositório GitHub';

    const domainName = host.split('.')[0];
    const capitalized = domainName.charAt(0).toUpperCase() + domainName.slice(1);

    // Try extracting a readable slug from path if short and clean
    const segments = parsed.pathname
      .split('/')
      .filter((s) => s && s.length > 2 && s.length < 30 && !/^[a-f0-9-]{12,}$/i.test(s));

    if (segments.length > 0) {
      const lastSlug = decodeURIComponent(segments[segments.length - 1])
        .replace(/[-_]+/g, ' ')
        .replace(/\.[a-z0-9]{2,4}$/i, '')
        .trim();
      if (lastSlug.length >= 3 && lastSlug.length <= 28) {
        return `${capitalized}: ${lastSlug.charAt(0).toUpperCase() + lastSlug.slice(1)}`;
      }
    }

    return `Link ${capitalized}`;
  } catch {
    return 'Abrir Link';
  }
};

/**
 * Automatically turns any raw URLs in content into Markdown titled hyperlinks: [Title](url)
 * Preserves existing [Title](url) links untouched.
 */
export const convertRawUrlsToTitledLinks = (content: string): string => {
  if (!content) return content;

  // Match either existing markdown link [title](url) OR standalone raw URL
  const tokenRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>"')]+|www\.[^\s<>"')]+)/gi;

  return content.replace(tokenRegex, (match, mdTitle, mdUrl, rawUrl) => {
    if (mdTitle && mdUrl) {
      return match; // Already formatted as [Title](url)
    }
    if (rawUrl) {
      // Avoid trailing punctuation inside URL
      let cleanUrl = rawUrl;
      let trailing = '';
      const punctMatch = cleanUrl.match(/([.,!?;:]+)$/);
      if (punctMatch) {
        trailing = punctMatch[1];
        cleanUrl = cleanUrl.slice(0, -trailing.length);
      }
      const fullUrl = cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`;
      const title = suggestTitleForUrl(fullUrl);
      return `[${title}](${fullUrl})${trailing}`;
    }
    return match;
  });
};

/**
 * Extracts all titled links ([title](url)) and raw URLs from text for editing.
 */
export const extractLinksFromContent = (content: string): DetectedLink[] => {
  if (!content) return [];
  const regex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>"')]+|www\.[^\s<>"')]+)/gi;
  const links: DetectedLink[] = [];
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = regex.exec(content)) !== null) {
    if (match[1] && match[2]) {
      links.push({
        id: `link-${index++}`,
        title: match[1],
        url: match[2],
        rawMatch: match[0],
      });
    } else if (match[3]) {
      const cleanUrl = match[3].replace(/[.,!?;:]+$/, '');
      const fullUrl = cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`;
      links.push({
        id: `link-${index++}`,
        title: suggestTitleForUrl(fullUrl),
        url: fullUrl,
        rawMatch: cleanUrl,
      });
    }
  }

  return links;
};

/**
 * Updates a link's displayed title inside the note content.
 */
export const updateLinkTitleInContent = (
  content: string,
  targetUrl: string,
  newTitle: string
): string => {
  const safeTitle = newTitle.trim() || suggestTitleForUrl(targetUrl);
  const regex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>"')]+|www\.[^\s<>"')]+)/gi;

  return content.replace(regex, (match, mdTitle, mdUrl, rawUrl) => {
    if (mdTitle && mdUrl && mdUrl === targetUrl) {
      return `[${safeTitle}](${mdUrl})`;
    }
    if (rawUrl) {
      const cleanUrl = rawUrl.replace(/[.,!?;:]+$/, '');
      const fullUrl = cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`;
      if (fullUrl === targetUrl) {
        return `[${safeTitle}](${fullUrl})`;
      }
    }
    return match;
  });
};

/**
 * Tokenizes note content into plain text and clickable titled links.
 */
export const parseNoteTextTokens = (content: string): TextToken[] => {
  if (!content) return [];

  const regex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>"')]+|www\.[^\s<>"')]+)/gi;
  const tokens: TextToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        type: 'text',
        text: content.slice(lastIndex, match.index),
      });
    }

    if (match[1] && match[2]) {
      tokens.push({
        type: 'link',
        text: match[1],
        url: match[2],
      });
    } else if (match[3]) {
      let cleanUrl = match[3];
      let trailing = '';
      const punctMatch = cleanUrl.match(/([.,!?;:]+)$/);
      if (punctMatch) {
        trailing = punctMatch[1];
        cleanUrl = cleanUrl.slice(0, -trailing.length);
      }
      const fullUrl = cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`;
      tokens.push({
        type: 'link',
        text: suggestTitleForUrl(fullUrl),
        url: fullUrl,
      });
      if (trailing) {
        tokens.push({ type: 'text', text: trailing });
      }
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    tokens.push({
      type: 'text',
      text: content.slice(lastIndex),
    });
  }

  return tokens;
};

/**
 * Builds a clean plain-text preview string where URLs are replaced by their titles
 * so truncation never slices inside a raw URL.
 */
export const buildReadablePreview = (content: string, maxLength = 120): string => {
  if (!content) return '';
  const tokens = parseNoteTextTokens(content);
  const combined = tokens.map((t) => t.text).join('');
  if (combined.length <= maxLength) return combined;
  return combined.slice(0, maxLength).trimEnd() + '...';
};
