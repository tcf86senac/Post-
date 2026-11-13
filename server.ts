import express from 'express';
import http from 'http';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Increase payload limit for photos, audio and documents
app.use(express.json({ limit: '25mb' }));

function createGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Chave GEMINI_API_KEY não configurada no ambiente.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'Post+',
    version: '2.6.0',
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

// POST+ VOICE: Transcribe voice message and generate title + clean note content via AI
app.post('/api/voice/analyze', async (req, res) => {
  try {
    const { audioBase64, mimeType = 'audio/webm' } = req.body;

    if (!audioBase64) {
      return res.status(400).json({ error: 'Nenhum áudio foi enviado.' });
    }

    const ai = createGeminiClient();

    // Strip data URL prefix and codec parameters from mimeType
    const cleanBase64 = String(audioBase64).replace(/^data:[^;]+;base64,/, '');
    const cleanMimeType = String(mimeType).split(';')[0].trim() || 'audio/webm';

    const promptText = `Você é o assistente do aplicativo Post+.
Ouça com atenção o áudio enviado (em português do Brasil), transcreva a mensagem falada com máxima fidelidade e crie um título curto e claro para a nota adesiva.

Regras:
1. Mantenha 100% do sentido, números, datas, nomes e informações faladas sem inventar dados.
2. Corrija apenas pontuação e formatação para ficar limpo e legível em uma nota do Post+.
3. Gere um título direto e conciso (máximo 45 caracteres) que resuma a nota.
4. Se o áudio estiver mudo ou sem nenhuma fala audível, defina speechDetected = false.`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: cleanMimeType,
                data: cleanBase64,
              },
            },
            { text: promptText },
          ],
        },
      ],
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            speechDetected: {
              type: Type.BOOLEAN,
              description: 'true se houver fala audível no áudio; false se for apenas silêncio ou ruído.',
            },
            title: {
              type: Type.STRING,
              description: 'Título curto e claro para a nota adesiva (máx 45 caracteres).',
            },
            content: {
              type: Type.STRING,
              description: 'Texto da mensagem transcrita e pontuada de forma clara e fiel.',
            },
          },
          required: ['speechDetected', 'title', 'content'],
        },
      },
    });

    const rawText = (response.text ?? '{}').trim();
    let parsed: { speechDetected?: boolean; title?: string; content?: string } = {};
    try {
      const cleanedJson = rawText
        .replace(/```(?:json)?/gi, '')
        .replace(/```/g, '')
        .trim();
      parsed = JSON.parse(cleanedJson);
    } catch {
      parsed = {
        speechDetected: Boolean(rawText),
        title: 'Nota por Voz',
        content: rawText,
      };
    }

    if (parsed.speechDetected === false || !parsed.content?.trim()) {
      return res.status(422).json({
        error: 'Não foi possível identificar fala no áudio gravado. Tente falar mais próximo do microfone.',
      });
    }

    const finalContent = parsed.content.trim();
    const fallbackTitle = finalContent.split(/\s+/).slice(0, 5).join(' ');
    const finalTitle =
      parsed.title?.trim() ||
      (fallbackTitle.length > 42 ? fallbackTitle.slice(0, 42) + '...' : fallbackTitle) ||
      'Nota por Voz';

    return res.json({
      success: true,
      data: {
        title: finalTitle,
        content: finalContent,
      },
    });
  } catch (error: any) {
    console.error('Erro no Post+ Voz (Gemini API):', error);
    return res.status(500).json({
      error: 'Falha ao transcrever o áudio com a IA.',
      details: error?.message || String(error),
    });
  }
});

// POST+ LENS: Image Recognition & Intelligent Note Extractor
app.post('/api/lens/analyze', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', userPrompt } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Nenhuma imagem foi enviada.' });
    }

    const ai = createGeminiClient();

    // Clean base64 string if it contains prefix
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');

    const promptText = `
Você é o assistente inteligente Post+ Lens do aplicativo "Post+".
Sua tarefa é analisar a imagem enviada (que pode ser uma anotação feita à mão em papel, caderno, bilhete adesivo, guardanapo ou lousa; ou uma foto de um documento, recibo, produto, placa de rua, cartaz de evento ou qualquer objeto do cotidiano) e transformá-la em uma anotação clara para fixar no mural.

Instruções cruciais:
1. Reconheça caligrafia humana (letra cursiva ou de forma) com máxima precisão em português do Brasil.
2. Se houver partes rasuradas ou ilegíveis, NÃO invente dados. Sinalize em "confidenceNotes" o que ficou com dúvida.
3. Se for uma foto de um objeto, recibo, placa ou evento, extraia as informações mais importantes (preços, datas, endereços, instruções).
4. Identifique se o conteúdo contém data ou horário de compromisso/evento (ex: "segunda às 14h", "dia 15", "médico amanhã").
5. Sugira uma categoria apropriada ("principal", "trabalho" ou "familia") e uma cor de nota ("yellow", "lime", "green", "teal", "blue", "indigo", "purple", "pink", "red", "coral", "orange" ou "cream").

${userPrompt ? `Instrução adicional do usuário: "${userPrompt}"` : ''}

Responda ESTRITAMENTE em formato JSON puro, sem markdown delimitador, com o seguinte schema:
{
  "title": "Título conciso e claro (máx 45 caracteres)",
  "previewText": "Resumo rápido de 1 a 2 frases para o cartão no mural",
  "fullContent": "Conteúdo completo transcrito ou estruturado em tópicos limpos",
  "suggestedCategory": "principal" | "trabalho" | "familia",
  "suggestedColor": "yellow" | "lime" | "green" | "teal" | "blue" | "indigo" | "purple" | "pink" | "red" | "coral" | "orange" | "cream",
  "hasSchedule": true | false,
  "scheduledDate": "YYYY-MM-DD ou vazio se não houver data",
  "scheduledTime": "HH:MM ou vazio se não houver hora",
  "confidenceNotes": "Observações sobre legibilidade ou detalhes extras"
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: [
        {
          role: 'user',
          parts: [
            { text: promptText },
            {
              inlineData: {
                data: cleanBase64,
                mimeType,
              },
            },
          ],
        },
      ],
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    const responseText = response.text || '';

    // Parse JSON safely
    let parsedData;
    try {
      // Remove any markdown ```json ... ``` wrapper if present
      const cleanedJson = responseText
        .replace(/```(?:json)?/gi, '')
        .replace(/```/g, '')
        .trim();
      parsedData = JSON.parse(cleanedJson);
    } catch {
      // Fallback structure if parsing failed
      parsedData = {
        title: 'Nova Anotação (Post+ Lens)',
        previewText: responseText.slice(0, 80) + '...',
        fullContent: responseText,
        suggestedCategory: 'principal',
        suggestedColor: 'yellow',
        hasSchedule: false,
        confidenceNotes: 'Texto gerado pela IA',
      };
    }

    return res.json({
      success: true,
      data: parsedData,
    });
  } catch (error: any) {
    console.error('Erro no Post+ Lens (Gemini API):', error);
    return res.status(500).json({
      error: 'Falha ao processar a imagem com a IA.',
      details: error?.message || String(error),
    });
  }
});

// GOOGLE CALENDAR HELPER API
app.post('/api/calendar/generate-event', (req, res) => {
  try {
    const { title, description, date, time, durationMinutes = 60 } = req.body;

    if (!title || !date) {
      return res.status(400).json({ error: 'Título e data são obrigatórios.' });
    }

    const eventTime = time || '09:00';
    const startDateTime = new Date(`${date}T${eventTime}:00`);
    const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60000);

    const formatGoogleDate = (d: Date) => {
      return d.toISOString().replace(/-|:|\.\d\d\d/g, '');
    };

    const startFormatted = formatGoogleDate(startDateTime);
    const endFormatted = formatGoogleDate(endDateTime);

    const encodedTitle = encodeURIComponent(title);
    const encodedDetails = encodeURIComponent(description || `Lembrete agendado via Post+`);
    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodedTitle}&dates=${startFormatted}/${endFormatted}&details=${encodedDetails}&sf=true&output=xml`;

    // Also build standard iCalendar (ICS) format
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Post+//Lembretes e Murais//PT-BR',
      'BEGIN:VEVENT',
      `SUMMARY:${title}`,
      `DESCRIPTION:${(description || '').replace(/\n/g, '\\n')}`,
      `DTSTART:${startFormatted}`,
      `DTEND:${endFormatted}`,
      'STATUS:CONFIRMED',
      'BEGIN:VALARM',
      'TRIGGER:-PT15M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Lembrete Post+',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    return res.json({
      success: true,
      googleCalendarUrl,
      icsContent,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// MULTI-SOURCE MARKETPLACE CAPTURE, AI TREATMENT & CURATION PIPELINE
// Supported sources: Mercado Livre, Shopee, TikTok, Amazon + External Webhooks
// ============================================================================

type MarketplaceSource = 'mercadolivre' | 'shopee' | 'tiktok' | 'amazon' | 'manual';

interface RawCapturedProduct {
  sourcePlatform: MarketplaceSource;
  sourceMethod: string;
  rawTitle: string;
  rawPrice?: string;
  rawUrl: string;
  rawContext?: string;
}

const VALID_NOTE_COLORS = [
  'yellow',
  'lime',
  'green',
  'teal',
  'blue',
  'indigo',
  'purple',
  'pink',
  'red',
  'coral',
  'orange',
  'cream',
] as const;

const PLATFORM_META: Record<
  MarketplaceSource,
  { label: string; sponsorName: string; ctaLabel: string; searchDomain: string }
> = {
  mercadolivre: {
    label: 'Mercado Livre',
    sponsorName: 'Mercado Livre',
    ctaLabel: 'Ver no Mercado Livre',
    searchDomain: 'mercadolivre.com.br',
  },
  shopee: {
    label: 'Shopee',
    sponsorName: 'Shopee Brasil',
    ctaLabel: 'Ver na Shopee',
    searchDomain: 'shopee.com.br',
  },
  tiktok: {
    label: 'TikTok Shop',
    sponsorName: 'TikTok Viral',
    ctaLabel: 'Ver no TikTok',
    searchDomain: 'tiktok.com',
  },
  amazon: {
    label: 'Amazon Brasil',
    sponsorName: 'Amazon Ofertas',
    ctaLabel: 'Ver na Amazon',
    searchDomain: 'amazon.com.br',
  },
  manual: {
    label: 'Link Direto',
    sponsorName: 'Destaque Post+',
    ctaLabel: 'Acessar Oferta',
    searchDomain: '',
  },
};

function getSourcesStatus() {
  const mlToken = Boolean(process.env.MERCADOLIVRE_ACCESS_TOKEN);
  const shopeePartner = Boolean(
    process.env.SHOPEE_AFFILIATE_APP_ID && process.env.SHOPEE_AFFILIATE_SECRET
  );
  const amazonPartner = Boolean(
    process.env.AMAZON_PAAPI_ACCESS_KEY &&
      process.env.AMAZON_PAAPI_SECRET_KEY &&
      process.env.AMAZON_PARTNER_TAG
  );
  const tiktokPartner = Boolean(
    process.env.TIKTOK_SHOP_APP_KEY && process.env.TIKTOK_SHOP_APP_SECRET
  );
  const geminiReady = Boolean(process.env.GEMINI_API_KEY);

  return {
    geminiReady,
    webhookProtected: Boolean(process.env.PROMO_INGEST_WEBHOOK_SECRET),
    sources: {
      mercadolivre: {
        id: 'mercadolivre',
        name: 'Mercado Livre',
        partnerApiConfigured: mlToken,
        liveDiscoveryAvailable: true,
        modeLabel: mlToken
          ? 'API Oficial + Tendências MLB'
          : 'API Pública Tendências MLB + Busca Web',
      },
      shopee: {
        id: 'shopee',
        name: 'Shopee',
        partnerApiConfigured: shopeePartner,
        liveDiscoveryAvailable: shopeePartner || geminiReady,
        modeLabel: shopeePartner
          ? 'Shopee Affiliate Open API (GraphQL)'
          : 'Busca Web em Tempo Real + Webhook/n8n',
      },
      tiktok: {
        id: 'tiktok',
        name: 'TikTok Shop',
        partnerApiConfigured: tiktokPartner,
        liveDiscoveryAvailable: tiktokPartner || geminiReady,
        modeLabel: tiktokPartner
          ? 'TikTok Shop Affiliate API'
          : 'Busca de Virais + Webhook/n8n',
      },
      amazon: {
        id: 'amazon',
        name: 'Amazon',
        partnerApiConfigured: amazonPartner,
        liveDiscoveryAvailable: amazonPartner || geminiReady,
        modeLabel: amazonPartner
          ? 'Amazon PA-API 5.0 (Creators)'
          : 'Busca Mais Vendidos Amazon BR + Webhook/n8n',
      },
    },
  };
}

async function fetchMercadoLivreTrends(categoryHint?: string): Promise<RawCapturedProduct[]> {
  const results: RawCapturedProduct[] = [];
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': 'PostPlusApp/2.6',
  };
  if (process.env.MERCADOLIVRE_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${process.env.MERCADOLIVRE_ACCESS_TOKEN}`;
  }

  try {
    let keywords: string[] = [];
    if (categoryHint?.trim()) {
      keywords = [categoryHint.trim()];
    } else {
      const trendsRes = await fetch('https://api.mercadolibre.com/trends/MLB', {
        headers,
        signal: AbortSignal.timeout(5000),
      });
      if (trendsRes.ok) {
        const trendsData = (await trendsRes.json()) as Array<{ keyword?: string; url?: string }>;
        keywords = trendsData
          .map((t) => t.keyword?.trim())
          .filter((k): k is string => Boolean(k))
          .slice(0, 3);
      }
    }

    for (const kw of keywords.slice(0, 3)) {
      const searchUrl = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(kw)}&limit=2`;
      const searchRes = await fetch(searchUrl, {
        headers,
        signal: AbortSignal.timeout(5000),
      });
      if (!searchRes.ok) continue;
      const searchJson = (await searchRes.json()) as {
        results?: Array<{
          title?: string;
          price?: number;
          currency_id?: string;
          permalink?: string;
          sold_quantity?: number;
        }>;
      };
      const firstItem = searchJson.results?.[0];
      if (firstItem?.title && firstItem?.permalink) {
        results.push({
          sourcePlatform: 'mercadolivre',
          sourceMethod: 'ml_trends_api',
          rawTitle: firstItem.title,
          rawPrice:
            typeof firstItem.price === 'number'
              ? `R$ ${firstItem.price.toFixed(2).replace('.', ',')}`
              : '',
          rawUrl: firstItem.permalink,
          rawContext: `Tendência real MLB para termo "${kw}"`,
        });
      }
    }
  } catch (err) {
    console.warn('[Post+] Mercado Livre direct API fallback to search grounding:', err);
  }

  return results;
}

async function fetchShopeeAffiliateProducts(categoryHint?: string): Promise<RawCapturedProduct[]> {
  const appId = process.env.SHOPEE_AFFILIATE_APP_ID;
  const secret = process.env.SHOPEE_AFFILIATE_SECRET;
  if (!appId || !secret) return [];

  try {
    const keyword = categoryHint?.trim() || 'mais vendidos brasil';
    const query = `query { productOfferV2(keyword: "${keyword.replace(/"/g, '')}", listType: 0, sortType: 2, page: 1, limit: 3) { nodes { productName priceMin offerLink productLink sales } } }`;
    const payload = JSON.stringify({ query });
    const timestamp = Math.floor(Date.now() / 1000);
    const factor = `${appId}${timestamp}${payload}${secret}`;
    const signature = crypto.createHash('sha256').update(factor).digest('hex');

    const res = await fetch('https://open-api.affiliate.shopee.com.br/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`,
      },
      body: payload,
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) return [];
    const data = (await res.json()) as {
      data?: {
        productOfferV2?: {
          nodes?: Array<{
            productName?: string;
            priceMin?: string | number;
            offerLink?: string;
            productLink?: string;
            sales?: number;
          }>;
        };
      };
    };

    const nodes = data?.data?.productOfferV2?.nodes || [];
    return nodes
      .filter((n) => n.productName && (n.offerLink || n.productLink))
      .slice(0, 2)
      .map((n) => ({
        sourcePlatform: 'shopee' as const,
        sourceMethod: 'shopee_affiliate_api',
        rawTitle: String(n.productName),
        rawPrice: n.priceMin ? `R$ ${String(n.priceMin).replace('.', ',')}` : '',
        rawUrl: String(n.offerLink || n.productLink),
        rawContext: n.sales ? `Em alta na Shopee (${n.sales} vendas)` : 'Em alta na Shopee',
      }));
  } catch (err) {
    console.warn('[Post+] Shopee Partner API fallback:', err);
    return [];
  }
}

async function discoverTrendsWithSearchGrounding(
  ai: GoogleGenAI,
  platforms: MarketplaceSource[],
  categoryHint?: string,
  audienceHint?: {
    gender?: string;
    ageMin?: number;
    ageMax?: number;
    location?: string;
    interests?: string[];
  }
): Promise<RawCapturedProduct[]> {
  if (platforms.length === 0) return [];

  const platformNames = platforms.map((p) => PLATFORM_META[p].label).join(', ');
  const audienceParts: string[] = [];
  if (audienceHint?.gender && audienceHint.gender !== 'all') {
    audienceParts.push(`gênero ${audienceHint.gender}`);
  }
  if (
    typeof audienceHint?.ageMin === 'number' &&
    typeof audienceHint?.ageMax === 'number' &&
    (audienceHint.ageMin > 0 || audienceHint.ageMax < 99)
  ) {
    audienceParts.push(`idade entre ${audienceHint.ageMin} e ${audienceHint.ageMax} anos`);
  }
  if (audienceHint?.location && audienceHint.location !== 'Brasil (Todos)') {
    audienceParts.push(`região ${audienceHint.location}`);
  }
  if (Array.isArray(audienceHint?.interests) && audienceHint.interests.length > 0) {
    audienceParts.push(`interesses combinados: ${audienceHint.interests.slice(0, 8).join(', ')}`);
  }

  const prompt = `Pesquise no Google produtos reais que estão em alta de vendas e tendência no Brasil agora nos seguintes marketplaces: ${platformNames}.
${categoryHint ? `Foco de categoria/assunto: "${categoryHint}".` : 'Foco: itens populares de casa, beleza, tecnologia, organização, moda ou bem-estar.'}
${audienceParts.length > 0 ? `Perfil prioritário dos usuários: ${audienceParts.join(', ')}.` : ''}

Para cada plataforma solicitada (${platformNames}), liste 1 a 2 produtos reais em destaque com:
- Plataforma exata (${platforms.join(' | ')})
- Nome real do produto
- Faixa de preço em R$ se encontrada
- Link oficial/direto encontrado na busca (ou URL da página de busca/mais vendidos da plataforma)
- Motivo pelo qual está em alta e com quais interesses/gênero/faixa etária faz mais sentido.`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });

  const groundingChunks =
    response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const groundedLinks = groundingChunks
    .map((chunk: any) => ({
      uri: chunk?.web?.uri ? String(chunk.web.uri) : '',
      title: chunk?.web?.title ? String(chunk.web.title) : '',
    }))
    .filter((l) => l.uri.startsWith('http'));

  const groundingSummary = groundedLinks
    .slice(0, 12)
    .map((l, idx) => `${idx + 1}. ${l.title} => ${l.uri}`)
    .join('\n');

  const textSummary = response.text || '';

  return platforms.map((platform) => {
    const meta = PLATFORM_META[platform];
    const matchedLink = groundedLinks.find((l) =>
      l.uri.toLowerCase().includes(meta.searchDomain)
    );
    return {
      sourcePlatform: platform,
      sourceMethod: 'gemini_search_grounding',
      rawTitle: `Tendências ${meta.label}${categoryHint ? ` (${categoryHint})` : ''}`,
      rawUrl:
        matchedLink?.uri ||
        `https://www.${meta.searchDomain}`,
      rawContext: `${textSummary}\n\nLinks verificados na busca:\n${groundingSummary}`.slice(
        0,
        3500
      ),
    };
  });
}

async function treatProductsToCurationDrafts(
  ai: GoogleGenAI,
  rawItems: RawCapturedProduct[],
  audienceHint?: {
    gender?: string;
    ageMin?: number;
    ageMax?: number;
    location?: string;
    interests?: string[];
  }
) {
  const prompt = `Você é o motor de tratamento e curadoria de anúncios humanistas do aplicativo Post+ (Brasil).
Receba os dados capturados de marketplaces abaixo e gere rascunhos prontos para a curadoria manual do administrador Thiago.

DADOS CAPTURADOS:
${JSON.stringify(rawItems, null, 2)}

${
  audienceHint
    ? `PREFERÊNCIA / DICA DE SEGMENTAÇÃO E INTERESSES DO ADMIN: ${JSON.stringify(audienceHint)}`
    : ''
}

REGRAS OBRIGATÓRIAS:
1. Cada item deve gerar 1 rascunho em português do Brasil claro, acolhedor e nada agressivo (modelo Post+ em 2 cliques: 1º texto corrido curto no rodapé, 2º Cartão/Nota do Post+ detalhada ao clicar).
2. Classifique EXPLICITAMENTE o público-alvo e os interesses para que o Thiago possa validar antes de publicar:
   - targetGender: deve ser EXATAMENTE um destes valores: "all" | "Feminino" | "Masculino" | "Não-binário". Use "Feminino" ou "Masculino" quando o produto for claramente voltado a esse público, ou "all" quando for unissex/geral.
   - targetAgeMin e targetAgeMax: números inteiros entre 18 e 85 (ou 0 e 99 se for para todas as idades).
   - targetLocation: "Brasil (Todos)" ou estado/cidade específica se fizer sentido.
   - targetInterests: lista de 3 a 8 interesses gerais e subtemas relacionados ao produto (ex: ["Música", "Tecnologia", "Fones Bluetooth e Caixas de Som"]).
   - curationRationale: frase objetiva explicando PARA QUAL PERFIL E CONJUNTO DE INTERESSES VAI (homem/mulher/idade/gostos) e POR QUE condiz com o produto.
3. Use sempre URLs reais presentes nos dados ou URLs de busca/produto legítimas da plataforma correspondente (Shopee, TikTok, Amazon, Mercado Livre). Nunca invente parâmetros falsos de rastreamento.
4. noteColor deve ser uma das cores: ${VALID_NOTE_COLORS.join(', ')}.`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          campaigns: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                sourcePlatform: {
                  type: Type.STRING,
                  description: 'mercadolivre | shopee | tiktok | amazon | manual',
                },
                sourceMethod: { type: Type.STRING },
                tickerText: {
                  type: Type.STRING,
                  description: 'Texto corrido curto para o letreiro inferior (máx 150 chars)',
                },
                title: {
                  type: Type.STRING,
                  description: 'Título amigável dentro da Nota do Post+ (máx 80 chars)',
                },
                description: {
                  type: Type.STRING,
                  description: 'Descrição acolhedora e honesta do produto dentro da Nota do Post+',
                },
                sponsorName: { type: Type.STRING },
                priceLabel: { type: Type.STRING },
                ctaLabel: { type: Type.STRING },
                targetUrl: { type: Type.STRING },
                noteColor: { type: Type.STRING },
                targetGender: {
                  type: Type.STRING,
                  description: 'all | Feminino | Masculino | Não-binário',
                },
                targetAgeMin: { type: Type.NUMBER },
                targetAgeMax: { type: Type.NUMBER },
                targetLocation: { type: Type.STRING },
                targetInterests: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '3 a 8 interesses gerais ou subtemas relacionados ao produto.',
                },
                curationRationale: {
                  type: Type.STRING,
                  description: 'Explicação clara para o admin sobre por que o produto combina com esse perfil e interesses.',
                },
              },
              required: [
                'sourcePlatform',
                'tickerText',
                'title',
                'description',
                'sponsorName',
                'ctaLabel',
                'targetUrl',
                'noteColor',
                'targetGender',
                'targetAgeMin',
                'targetAgeMax',
                'targetLocation',
                'targetInterests',
                'curationRationale',
              ],
            },
          },
        },
        required: ['campaigns'],
      },
    },
  });

  const rawJson = (response.text ?? '{"campaigns":[]}').trim();
  const cleaned = rawJson.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleaned) as { campaigns?: Array<Record<string, any>> };

  return (parsed.campaigns || []).map((c, idx) => {
    const plat: MarketplaceSource = ['mercadolivre', 'shopee', 'tiktok', 'amazon', 'manual'].includes(
      String(c.sourcePlatform)
    )
      ? (String(c.sourcePlatform) as MarketplaceSource)
      : 'manual';
    const meta = PLATFORM_META[plat];
    const gender = ['all', 'Feminino', 'Masculino', 'Não-binário'].includes(
      String(c.targetGender)
    )
      ? String(c.targetGender)
      : 'all';
    const ageMin = Math.max(0, Math.min(120, Math.round(Number(c.targetAgeMin) || 0)));
    const ageMax = Math.max(ageMin, Math.min(120, Math.round(Number(c.targetAgeMax) || 99)));
    const noteColor = VALID_NOTE_COLORS.includes(String(c.noteColor) as any)
      ? String(c.noteColor)
      : 'yellow';
    const safeUrl =
      typeof c.targetUrl === 'string' && /^https?:\/\//i.test(c.targetUrl.trim())
        ? c.targetUrl.trim()
        : rawItems[idx]?.rawUrl || `https://www.${meta.searchDomain || 'mercadolivre.com.br'}`;

    const rawInterestTags = Array.isArray(c.targetInterests)
      ? c.targetInterests
          .map((t: unknown) => String(t || '').trim().slice(0, 60))
          .filter(Boolean)
      : [];
    const fallbackHintTags = Array.isArray(audienceHint?.interests)
      ? audienceHint.interests.map((t) => String(t).trim().slice(0, 60)).filter(Boolean)
      : [];
    const mergedInterests = Array.from(new Set([...rawInterestTags, ...fallbackHintTags])).slice(
      0,
      12
    );

    return {
      id: `camp_${plat}_${Date.now()}_${idx}`,
      sourcePlatform: plat,
      status: 'pending_curation' as const,
      isActive: false,
      tickerText: String(c.tickerText || c.title || 'Achado em alta no Post+').slice(0, 240),
      title: String(c.title || 'Produto em Alta').slice(0, 120),
      description: String(c.description || '').slice(0, 1200),
      sponsorName: String(c.sponsorName || meta.sponsorName).slice(0, 80),
      priceLabel: String(c.priceLabel || '').slice(0, 40),
      ctaLabel: String(c.ctaLabel || meta.ctaLabel).slice(0, 60),
      targetUrl: safeUrl.slice(0, 800),
      noteColor,
      targetGender: gender,
      targetAgeMin: ageMin,
      targetAgeMax: ageMax,
      targetLocation: String(c.targetLocation || 'Brasil (Todos)').slice(0, 120),
      targetInterests: mergedInterests,
      curationRationale: String(c.curationRationale || '').slice(0, 600),
      sourceMethod: String(c.sourceMethod || rawItems[idx]?.sourceMethod || 'gemini_treatment').slice(
        0,
        60
      ),
    };
  });
}

// Endpoint 1: Sources & API integration readiness status
app.get('/api/promos/sources-status', (req, res) => {
  return res.json({
    success: true,
    ...getSourcesStatus(),
  });
});

// Endpoint 2: Capture trending products across Mercado Livre, Shopee, TikTok, Amazon
app.post('/api/promos/capture-trends', async (req, res) => {
  try {
    const {
      platforms = ['mercadolivre', 'shopee', 'tiktok', 'amazon'],
      categoryHint = '',
      audienceHint,
    } = req.body || {};

    const validPlatforms: MarketplaceSource[] = (Array.isArray(platforms) ? platforms : [])
      .filter((p): p is MarketplaceSource =>
        ['mercadolivre', 'shopee', 'tiktok', 'amazon'].includes(String(p))
      );

    if (validPlatforms.length === 0) {
      return res.status(400).json({ error: 'Selecione pelo menos uma plataforma (Shopee, TikTok, Amazon ou Mercado Livre).' });
    }

    const ai = createGeminiClient();
    const capturedRaw: RawCapturedProduct[] = [];
    const fallbackPlatforms: MarketplaceSource[] = [];

    if (validPlatforms.includes('mercadolivre')) {
      const mlItems = await fetchMercadoLivreTrends(categoryHint);
      if (mlItems.length > 0) {
        capturedRaw.push(...mlItems);
      } else {
        fallbackPlatforms.push('mercadolivre');
      }
    }

    if (validPlatforms.includes('shopee')) {
      const shopeeItems = await fetchShopeeAffiliateProducts(categoryHint);
      if (shopeeItems.length > 0) {
        capturedRaw.push(...shopeeItems);
      } else {
        fallbackPlatforms.push('shopee');
      }
    }

    if (validPlatforms.includes('tiktok')) {
      fallbackPlatforms.push('tiktok');
    }

    if (validPlatforms.includes('amazon')) {
      fallbackPlatforms.push('amazon');
    }

    if (fallbackPlatforms.length > 0) {
      const groundedItems = await discoverTrendsWithSearchGrounding(
        ai,
        fallbackPlatforms,
        categoryHint,
        audienceHint
      );
      capturedRaw.push(...groundedItems);
    }

    const drafts = await treatProductsToCurationDrafts(ai, capturedRaw, audienceHint);

    return res.json({
      success: true,
      drafts,
      sourcesStatus: getSourcesStatus(),
    });
  } catch (error: any) {
    console.error('[Post+] Erro na captura de tendências:', error);
    return res.status(500).json({
      error: 'Falha ao captar e tratar tendências dos marketplaces.',
      details: error?.message || String(error),
    });
  }
});

// Endpoint 3: External ingestion & normalization (Manual paste OR n8n / Make / Zapier webhook)
app.post('/api/promos/normalize-external', async (req, res) => {
  try {
    const webhookSecret = process.env.PROMO_INGEST_WEBHOOK_SECRET;
    if (webhookSecret && req.body?.isExternalWebhook === true) {
      const provided = req.headers['x-webhook-secret'];
      if (provided !== webhookSecret) {
        return res.status(401).json({ error: 'Webhook secret inválido.' });
      }
    }

    const { rawTextOrUrl, sourcePlatform = 'manual', items, audienceHint } = req.body || {};
    const ai = createGeminiClient();

    const rawItems: RawCapturedProduct[] = [];
    if (Array.isArray(items) && items.length > 0) {
      items.slice(0, 10).forEach((item: any) => {
        const plat: MarketplaceSource = [
          'mercadolivre',
          'shopee',
          'tiktok',
          'amazon',
          'manual',
        ].includes(String(item.sourcePlatform))
          ? item.sourcePlatform
          : 'manual';
        rawItems.push({
          sourcePlatform: plat,
          sourceMethod: 'webhook_import',
          rawTitle: String(item.title || item.name || item.rawText || 'Produto importado'),
          rawPrice: item.price ? String(item.price) : '',
          rawUrl: String(item.url || item.link || ''),
          rawContext: item.description ? String(item.description) : undefined,
        });
      });
    } else if (typeof rawTextOrUrl === 'string' && rawTextOrUrl.trim()) {
      const plat: MarketplaceSource = [
        'mercadolivre',
        'shopee',
        'tiktok',
        'amazon',
        'manual',
      ].includes(String(sourcePlatform))
        ? sourcePlatform
        : 'manual';
      const urlMatch = rawTextOrUrl.match(/https?:\/\/[^\s]+/i);
      rawItems.push({
        sourcePlatform: plat,
        sourceMethod: 'manual_or_webhook_paste',
        rawTitle: rawTextOrUrl.trim().slice(0, 300),
        rawUrl: urlMatch ? urlMatch[0] : '',
        rawContext: rawTextOrUrl.trim(),
      });
    } else {
      return res.status(400).json({ error: 'Envie um link, descrição do produto ou lista items.' });
    }

    const drafts = await treatProductsToCurationDrafts(ai, rawItems, audienceHint);
    return res.json({
      success: true,
      drafts,
    });
  } catch (error: any) {
    console.error('[Post+] Erro ao normalizar produto externo:', error);
    return res.status(500).json({
      error: 'Falha ao tratar produto externo com IA.',
      details: error?.message || String(error),
    });
  }
});

// Endpoint 4: Generate 50 personalized related sub-topic cards from the user's 10 general interests
app.post('/api/interests/generate-subtopics', async (req, res) => {
  try {
    const { selectedInterests = [], age, gender } = req.body || {};
    const cleanInterests = Array.isArray(selectedInterests)
      ? selectedInterests.map((s: unknown) => String(s || '').trim()).filter(Boolean).slice(0, 12)
      : [];

    if (cleanInterests.length === 0) {
      return res.status(400).json({ error: 'Selecione seus interesses gerais primeiro.' });
    }

    const ai = createGeminiClient();
    const profileLine = [
      typeof age === 'number' && age > 0 ? `idade aproximada ${age} anos` : '',
      gender && gender !== 'Prefiro não declarar' ? `gênero ${gender}` : '',
    ]
      .filter(Boolean)
      .join(', ');

    const prompt = `Você é o motor de afinidades e interesses do aplicativo Post+ (Brasil).
Um usuário escolheu os seguintes ${cleanInterests.length} interesses gerais:
${cleanInterests.map((item, idx) => `${idx + 1}. ${item}`).join('\n')}
${profileLine ? `Contexto opcional de perfil: ${profileLine}.` : ''}

Gere EXATAMENTE 50 assuntos específicos e variados em português do Brasil fortemente relacionados às escolhas acima (cerca de 5 subtemas por interesse, incluindo cruzamentos inteligentes entre dois interesses quando fizer sentido).
Os subtemas devem representar gostos reais, hobbies, produtos, experiências e nichos que ajudem a entender que tipo de recomendação ou promoção agradaria essa pessoa sem ser invasivo.

Regras:
1. Cada item deve ter "label" curto e claro (2 a 5 palavras, máx 42 caracteres), "parentLabel" (um dos interesses escolhidos pelo usuário) e "emoji" (1 emoji representativo).
2. Não repita termos idênticos. Retorne exatamente 50 itens no array "subtopics".`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subtopics: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  parentLabel: { type: Type.STRING },
                  emoji: { type: Type.STRING },
                },
                required: ['label', 'parentLabel', 'emoji'],
              },
            },
          },
          required: ['subtopics'],
        },
      },
    });

    const rawText = (response.text ?? '{"subtopics":[]}').trim();
    const cleaned = rawText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned) as {
      subtopics?: Array<{ label?: string; parentLabel?: string; emoji?: string }>;
    };

    const seen = new Set<string>();
    const items = (parsed.subtopics || [])
      .map((s, idx) => ({
        id: `ai_sub_${Date.now()}_${idx}`,
        label: String(s.label || '').trim().slice(0, 56),
        parentId: String(s.parentLabel || cleanInterests[0]).toLowerCase(),
        parentLabel: String(s.parentLabel || cleanInterests[0]).trim().slice(0, 48),
        emoji: String(s.emoji || '✨').trim().slice(0, 4),
      }))
      .filter((item) => {
        if (!item.label) return false;
        const norm = item.label.toLowerCase();
        if (seen.has(norm)) return false;
        seen.add(norm);
        return true;
      })
      .slice(0, 50);

    return res.json({
      success: true,
      subtopics: items,
    });
  } catch (error: any) {
    console.warn('[Post+] Fallback para catálogo local de 50 subtemas:', error?.message || error);
    return res.status(500).json({
      error: 'Falha ao gerar subtemas personalizados via IA.',
    });
  }
});

// Start Express server and mount Vite in development
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  const httpServer = http.createServer(app);

  if (!isProd) {
    const disableHmr = process.env.DISABLE_HMR === 'true';
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: disableHmr ? false : { server: httpServer },
        ws: disableHmr ? false : { server: httpServer },
      },
      appType: 'spa',
    });

    if (disableHmr) {
      app.get('/@vite/client', async (_req, res, next) => {
        try {
          const transformed = await vite.transformRequest('/@vite/client');
          if (!transformed?.code) return next();
          const code = transformed.code.replace(
            'transport.connect(createHMRHandler(handleMessage));',
            '/* HMR disabled: WebSocket connection skipped */'
          );
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache');
          return res.send(code);
        } catch {
          return next();
        }
      });
    }

    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  httpServer.listen(PORT, () => {
    console.log(`[Post+] Servidor rodando na porta ${PORT}`);
  });
}

startServer();
