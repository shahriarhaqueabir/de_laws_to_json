import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerClient } from '../../../lib/supabase';
import { searchNorms } from '../../../lib/qdrant';
import { generateChatResponse } from '../../../lib/chat';
import type { ChatMode, CloudProvider, CitedLaw } from '../../../lib/types';

const BROKER_URL =
  process.env.NEXT_PUBLIC_BROKER_URL || 'http://localhost:9000';

export async function POST(req: NextRequest) {
  try {
    const {
      message,
      conversationId,
      mode: rawMode,
      provider,
      apiKey,
      model,
      customEndpoint,
    } = await req.json();

    const mode: ChatMode = rawMode || 'basic';
    const cookieStore = await cookies();
    const supabase = getServerClient(cookieStore);
    const { data: { user } } = await supabase.auth.getUser();

    // 1. Search Qdrant for relevant norms (always)
    const norms = await searchNorms(message, undefined, 5);
    const contextStr = norms
      .map((n) => `[${n.law_key} ${n.norm_id}] ${n.content.slice(0, 500)}`)
      .join('\n\n');
    const citedLaws: CitedLaw[] = norms.map((n) => ({
      law_key: n.law_key,
      norm_id: n.norm_id,
      law_title: n.law_title,
    }));

    // 2. Generate response based on mode
    let response: string;
    let brokerAvailable: boolean | null = null;

    switch (mode) {
      case 'local': {
        // Mode 1: Local Ollama via broker
        try {
          const brokerRes = await fetch(`${BROKER_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, context: contextStr, conversationId }),
            signal: AbortSignal.timeout(120000),
          });

          if (brokerRes.ok) {
            const data = await brokerRes.json();
            response = data.response;
            brokerAvailable = true;
          } else {
            throw new Error('Broker returned error');
          }
        } catch {
          response =
            `I found ${norms.length} relevant paragraphs, but your local AI broker is offline.\n\n` +
            `To use Local AI mode, start the broker:\n` +
            `\`\`\`bash\ncd broker && python broker.py\n\`\`\`\n\n` +
            `Or switch to another chat mode in Settings.\n\n` +
            `**Relevant laws found:**\n` +
            citedLaws.map((l) => `- **${l.law_key}** ${l.norm_id} — ${l.law_title}`).join('\n');
          brokerAvailable = false;
        }
        break;
      }

      case 'cloud': {
        // Mode 2: BYO API Key
        if (!apiKey) {
          response =
            `No API key configured. Please add your API key in **Settings → Cloud AI**.\n\n` +
            `**Relevant laws found:**\n` +
            citedLaws.map((l) => `- **${l.law_key}** ${l.norm_id} — ${l.law_title}`).join('\n');
          brokerAvailable = null;
          break;
        }
        try {
          response = await generateChatResponse({
            provider: (provider as CloudProvider) || 'openai',
            apiKey,
            model: model || 'gpt-4o-mini',
            customEndpoint: customEndpoint || '',
            question: message,
            norms: citedLaws,
            context: contextStr,
          });
          brokerAvailable = null;
        } catch (err: any) {
          response =
            `Cloud AI call failed: ${err.message}\n\n` +
            `Check your API key and provider settings.\n\n` +
            `**Relevant laws found:**\n` +
            citedLaws.map((l) => `- **${l.law_key}** ${l.norm_id} — ${l.law_title}`).join('\n');
          brokerAvailable = null;
        }
        break;
      }

      case 'browser':
      case 'basic': {
        // Mode 3 & 4: No server-side AI
        // For Browser AI mode, the client will run Transformers.js
        // For Basic mode, just show search results
        response =
          `**Relevant laws found (${norms.length} paragraphs):**\n\n` +
          norms
            .map(
              (n, i) =>
                `**${i + 1}. ${n.law_key} ${n.norm_id}** — ${n.law_title}\n` +
                `> ${n.content.slice(0, 300)}...`
            )
            .join('\n\n');
        brokerAvailable = null;
        break;
      }

      default:
        response = 'Unknown chat mode selected. Please check your settings.';
    }

    // 3. Save to Supabase if we have a conversation
    if (conversationId && user) {
      await supabase.from('messages').insert([
        { conversation_id: conversationId, role: 'user', content: message },
        {
          conversation_id: conversationId,
          role: 'assistant',
          content: response,
          cited_laws: JSON.stringify(citedLaws),
        },
      ]);
    }

    return NextResponse.json({
      response,
      citedLaws,
      brokerAvailable,
      mode,
      provider: mode === 'cloud' ? provider : undefined,
    });
  } catch (err: any) {
    console.error('Chat API Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
