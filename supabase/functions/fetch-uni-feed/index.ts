import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL'),
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
)

function parseRSS(xml: string, domain: string, source: string) {
  const items: any[] = []
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g)

  for (const match of itemMatches) {
    const item = match[1]

    const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1]
      || item.match(/<title>(.*?)<\/title>/)?.[1]
      || 'Untitled'

    const description = item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1]
      || item.match(/<description>([\s\S]*?)<\/description>/)?.[1]
      || null

    const link = item.match(/<link>(.*?)<\/link>/)?.[1]
      || item.match(/<link href="(.*?)"/)?.[1]
      || null

    const guid = item.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1]
      || link
      || title

    const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]
      || item.match(/<dc:date>(.*?)<\/dc:date>/)?.[1]
      || null

    const imageUrl = item.match(/<media:content[^>]*url="([^"]*)"[^>]*\/>/)?.[1]
      || item.match(/<enclosure[^>]*url="([^"]*)"[^>]*\/>/)?.[1]
      || null

    // Strip HTML from description
    const cleanDescription = description
      ? description.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim().substring(0, 300)
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
      return new Response(JSON.stringify({ error: 'University not found', domain }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const results = { news: 0, events: 0, errors: [] as string[] }

    // Fetch news feed
    if (uni.news_feed_url) {
      try {
        const res = await fetch(uni.news_feed_url, {
          headers: { 'Accept': 'application/rss+xml, application/xml, text/xml, */*' },
          signal: AbortSignal.timeout(8000),
        })
        if (res.ok) {
          const xml = await res.text()
          const items = parseRSS(xml, domain, 'news')
          for (const item of items) {
            if (!item.guid) continue
            await supabase.from('announcements').upsert(item, { onConflict: 'university_domain,guid' })
            results.news++
          }
        }
      } catch (e: any) {
        results.errors.push('news: ' + e.message)
      }
    }

    // Fetch events feed
    if (uni.events_feed_url) {
      try {
        const res = await fetch(uni.events_feed_url, {
          headers: { 'Accept': 'application/rss+xml, application/xml, text/xml, */*' },
          signal: AbortSignal.timeout(8000),
        })
        if (res.ok) {
          const xml = await res.text()
          const items = parseRSS(xml, domain, 'events')
          for (const item of items) {
            if (!item.guid) continue
            await supabase.from('announcements').upsert(item, { onConflict: 'university_domain,guid' })
            results.events++
          }
        }
      } catch (e: any) {
        results.errors.push('events: ' + e.message)
      }
    }

    return new Response(JSON.stringify({ success: true, university: uni.name, ...results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})