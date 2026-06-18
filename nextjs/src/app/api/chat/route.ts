import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerClient } from '@/lib/supabase';
import { searchNorms } from '@/lib/qdrant';

const BROKER_URL = process.env.NEXT_PUBLIC_BROKER_URL || 'http://localhost:9090';

export async function POST(req: NextRequest) {
  try {
    const { conversationId, message } = await req.json();
    const cookieStore = await cookies();
    const supabase = getServerClient(cookieStore);

    // 1. Verify user (optional for demo, but recommended)
    const { data: { user } } = await supabase.auth.getUser();

    // 2. Search relevant norms for context
    const norms = await searchNorms(message, undefined, 5);
    const context = norms.map((n) =>
      `[${n.law_key} ${n.norm_id}] ${n.content.slice(0, 500)}`
    ).join('\n\n');

    // 3. Try local broker
    try {
      const brokerRes = await fetch(`${BROKER_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          context,
          conversationId,
        }),
        signal: AbortSignal.timeout(120000), // Match Ollama timeout
      });

      if (brokerRes.ok) {
        const data = await brokerRes.json();

        // Save messages to Supabase if conversationId exists
        if (conversationId && user) {
          await supabase.from('messages').insert([
            { conversation_id: conversationId, role: 'user', content: message },
            {
              conversation_id: conversationId,
              role: 'assistant',
              content: data.response,
              cited_laws: norms.map(n => ({ key: n.law_key, norm: n.norm_id, title: n.law_title }))
            }
          ]);
        }

        return NextResponse.json({
          response: data.response,
          citedLaws: norms,
          brokerAvailable: true
        });
      }
    } catch (e) {
      console.error('Broker unreachable:', e);
    }

    // 4. Fallback if broker is down
    const fallback = `I found ${norms.length} relevant paragraphs, but the AI reasoning engine (local broker) is currently offline. Please ensure 'python broker.py' is running locally.`;

    return NextResponse.json({
      response: fallback,
      citedLaws: norms,
      brokerAvailable: false
    });

  } catch (err: any) {
    console.error('Chat API Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
