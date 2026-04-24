import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// RSS parser for universities that have RSS feeds
function parseRSS(xml: string, domain: string, source: string) {
  const items: any[] = []
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g)
  for (const match of itemMatches) {
    const item = match[1]
    const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1]
      || item.match(/<title>(.*?)<\/title>/)?.[1] || 'Untitled'
    const description = item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1]
      || item.match(/<description>([\s\S]*?)<\/description>/)?.[1] || null
    const link = item.match(/<link>(.*?)<\/link>/)?.[1] || null
    const guid = item.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1] || link || title
    const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || null
    const imageUrl = item.match(/<media:content[^>]*url="([^"]*)"[^>]*\/>/)?.[1]
      || item.match(/<enclosure[^>]*url="([^"]*)"[^>]*\/>/)?.[1] || null
    const cleanDescription = description
      ? description.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim().substring(0, 300)
      : null
    items.push({
      university_domain: domain,
      title: title.trim(),
      description: cleanDescription,
      url: link,
      image_url: imageUrl,
      published_at: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      source,
      source_label: source === 'news' ? 'News' : 'Events',
      guid: guid?.trim(),
    })
  }
  return items
}

// AI parser using Claude API for universities without RSS
async function parseWithAI(html: string, domain: string, source: string, baseUrl: string): Promise<any[]> {
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY not set')

  // Truncate HTML to avoid token limits
  const truncatedHtml = html.substring(0, 15000)

  const prompt = source === 'news'
    ? `Extract all news articles from this HTML. Return ONLY a JSON array with no markdown, no explanation. Each item must have: title (string), description (string, max 200 chars, plain text), url (full URL string or null), published_at (ISO date string or null). Base URL for relative links: ${baseUrl}\n\nHTML:\n${truncatedHtml}`
    : `Extract all upcoming events from this HTML. Return ONLY a JSON array with no markdown, no explanation. Each item must have: title (string), description (string, max 200 chars, plain text), url (full URL string or null), published_at (ISO date string or null, use event date), location (string or null). Base URL for relative links: ${baseUrl}\n\nHTML:\n${truncatedHtml}`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) throw new Error('Claude API error: ' + response.status)
  const data = await response.json()
  const text = data.content?.[0]?.text || '[]'

  let parsed: any[] = []
  try {
    const clean = text.replace(/```json|```/g, '').trim()
    parsed = JSON.parse(clean)
    if (!Array.isArray(parsed)) parsed = []
  } catch {
    parsed = []
  }

  return parsed.map((item: any, i: number) => ({
    university_domain: domain,
    title: item.title || 'Untitled',
    description: item.description || null,
    url: item.url || null,
    image_url: null,
    published_at: item.published_at ? new Date(item.published_at).toISOString() : new Date().toISOString(),
    source,
    source_label: source === 'news' ? 'News' : 'Events',
    guid: `${domain}-${source}-${i}-${item.title?.substring(0, 30) || i}`,
  }))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json().catch(() => ({}))
    const { domain } = body

    if (!domain) {
      return new Response(JSON.stringify({ error: 'Missing domain' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Look up university in registry
    const { data: uni } = await supabase
      .from('university_registry')
      .select('*')
      .eq('domain', domain)
      .maybeSingle()

    if (!uni) {
      return new Response(JSON.stringify({ error: 'University not supported yet', domain }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const results = { news: 0, events: 0, errors: [] as string[] }
    const useAI = uni.use_ai_parser === true

    // --- FETCH NEWS ---
    const newsUrl = uni.news_url || uni.news_feed_url
    if (newsUrl) {
      try {
        const res = await fetch(newsUrl, {
          headers: { 'Accept': 'text/html,application/xhtml+xml,application/xml,*/*', 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(10000),
        })
        if (res.ok) {
          const text = await res.text()
          let items: any[] = []
          if (useAI) {
            items = await parseWithAI(text, domain, 'news', newsUrl)
          } else {
            items = parseRSS(text, domain, 'news')
          }
          for (const item of items) {
            if (!item.title) continue
            await supabase.from('announcements').upsert(item, { onConflict: 'university_domain,guid' })
            results.news++
          }
        }
      } catch (e: any) {
        results.errors.push('news: ' + e.message)
      }
    }

    // --- FETCH EVENTS ---
    const eventsUrl = uni.events_url || uni.events_feed_url
    if (eventsUrl) {
      try {
        const res = await fetch(eventsUrl, {
          headers: { 'Accept': 'text/html,application/xhtml+xml,application/xml,*/*', 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(10000),
        })
        if (res.ok) {
          const text = await res.text()
          let items: any[] = []
          if (useAI) {
            items = await parseWithAI(text, domain, 'events', eventsUrl)
          } else {
            items = parseRSS(text, domain, 'events')
          }
          for (const item of items) {
            if (!item.title) continue
            await supabase.from('announcements').upsert(item, { onConflict: 'university_domain,guid' })
            results.events++
          }
        }
      } catch (e: any) {
        results.errors.push('events: ' + e.message)
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      university: uni.name, 
      parser: useAI ? 'ai' : 'rss',
      ...results 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})