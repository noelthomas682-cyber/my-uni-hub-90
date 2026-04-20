import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL'),
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
)

function parseICS(icsText: string) {
  const events: any[] = []
  const lines = icsText.replace(/\r\n /g, '').replace(/\r\n\t/g, '').split(/\r\n|\n|\r/)

  let current: any = null
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = {}
    } else if (line === 'END:VEVENT' && current) {
      events.push(current)
      current = null
    } else if (current) {
      const colonIdx = line.indexOf(':')
      if (colonIdx === -1) continue
      const key = line.substring(0, colonIdx).split(';')[0].toUpperCase()
      const value = line.substring(colonIdx + 1)
      if (key === 'SUMMARY') current.title = value
      if (key === 'DESCRIPTION') current.description = value.replace(/\\n/g, '\n').replace(/\\,/g, ',')
      if (key === 'LOCATION') current.location = value
      if (key === 'UID') current.uid = value
      if (key === 'DTSTART') current.start = parseICSDate(value)
      if (key === 'DTEND') current.end = parseICSDate(value)
      if (key === 'DUE') current.due = parseICSDate(value)
      if (key === 'CATEGORIES') current.categories = value
    }
  }
  return events
}

function parseICSDate(value: string): string | null {
  try {
    // Handle date-only format: 20240101
    if (value.length === 8) {
      return new Date(
        parseInt(value.substr(0, 4)),
        parseInt(value.substr(4, 2)) - 1,
        parseInt(value.substr(6, 2))
      ).toISOString()
    }
    // Handle datetime format: 20240101T120000Z or 20240101T120000
    const clean = value.replace('Z', '').replace(/T/, 'T')
    const y = parseInt(clean.substr(0, 4))
    const mo = parseInt(clean.substr(4, 2)) - 1
    const d = parseInt(clean.substr(6, 2))
    const h = parseInt(clean.substr(9, 2)) || 0
    const mi = parseInt(clean.substr(11, 2)) || 0
    const s = parseInt(clean.substr(13, 2)) || 0
    const date = value.endsWith('Z')
      ? new Date(Date.UTC(y, mo, d, h, mi, s))
      : new Date(y, mo, d, h, mi, s)
    return date.toISOString()
  } catch {
    return null
  }
}

function isAssignment(event: any): boolean {
  const title = (event.title || '').toLowerCase()
  const cats = (event.categories || '').toLowerCase()
  const keywords = ['assignment', 'submission', 'deadline', 'due', 'coursework', 'essay', 'report', 'quiz', 'exam', 'test']
  return keywords.some(k => title.includes(k) || cats.includes(k))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const { url, userId } = body

    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing userId' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Validate URL
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid URL' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Fetch the ICS content
    const resp = await fetch(url, {
      headers: { 'Accept': 'text/calendar, text/plain, */*' },
      redirect: 'follow',
    })

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: 'Failed to fetch calendar: ' + resp.status + ' ' + resp.statusText }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const icsText = await resp.text()

    if (!icsText.includes('BEGIN:VCALENDAR')) {
      return new Response(JSON.stringify({ error: 'The URL did not return a valid calendar file. Make sure you copied the correct calendar subscription link.' }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const events = parseICS(icsText)
    let eventsCount = 0
    let tasksCount = 0

    for (const event of events) {
      if (!event.title) continue

      if (isAssignment(event)) {
        // Save as task
        await supabase.from('tasks').upsert({
          user_id: userId,
          title: event.title,
          due_date: event.due || event.end || null,
          description: event.description || null,
          source: 'ics',
          external_id: event.uid || null,
          completed: false,
          priority: 'medium',
        }, { onConflict: 'user_id,external_id' })
        tasksCount++
      } else {
        // Save as calendar event
        await supabase.from('calendar_events').upsert({
          user_id: userId,
          title: event.title,
          start_time: event.start || null,
          end_time: event.end || null,
          location: event.location || null,
          description: event.description || null,
          source: 'ics',
          external_id: event.uid || null,
          color: '#6366f1',
        }, { onConflict: 'user_id,external_id' })
        eventsCount++
      }
    }

    // Save/update lms_connection record
    await supabase.from('lms_connections').upsert({
      user_id: userId,
      lms_type: 'ics',
      lms_name: 'Calendar Sync',
      provider: 'ics',
      base_url: parsed.origin,
      instance_url: url,
      university_name: parsed.hostname,
      auth_method: 'none',
      is_connected: true,
      is_active: true,
      last_synced_at: new Date().toISOString(),
      events_count: eventsCount,
      tasks_count: tasksCount,
      sync_error: null,
    }, { onConflict: 'user_id' })

    return new Response(JSON.stringify({ success: true, events: eventsCount, tasks: tasksCount, total: events.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})