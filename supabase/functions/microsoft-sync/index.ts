import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const clientId = Deno.env.get('MICROSOFT_CLIENT_ID')!
  const tenantId = Deno.env.get('MICROSOFT_TENANT_ID')!
  const clientSecret = Deno.env.get('MICROSOFT_CLIENT_SECRET')!

  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: 'User.Read Calendars.Read Tasks.Read offline_access',
    }),
  })

  if (!res.ok) return null
  const data = await res.json()
  return data.access_token
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const body = await req.json().catch(() => ({}))
  let userId: string
  let accessToken: string

  if (body.userId && body.accessToken) {
    userId = body.userId
    accessToken = body.accessToken
  } else {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    userId = user.id

    const { data: conn } = await supabase.from('lms_connections')
      .select('access_token, refresh_token, token_expires_at')
      .eq('user_id', userId)
      .eq('lms_type', 'microsoft')
      .maybeSingle()

    if (!conn) return new Response(JSON.stringify({ error: 'No Microsoft connection found' }), { status: 404, headers: corsHeaders })

    const isExpired = conn.token_expires_at && new Date(conn.token_expires_at) < new Date()
    if (isExpired && conn.refresh_token) {
      const newToken = await refreshAccessToken(conn.refresh_token)
      if (!newToken) return new Response(JSON.stringify({ error: 'Token refresh failed' }), { status: 401, headers: corsHeaders })
      accessToken = newToken
      await supabase.from('lms_connections').update({ access_token: newToken }).eq('user_id', userId)
    } else {
      accessToken = conn.access_token
    }
  }

  try {
    const headers = { Authorization: `Bearer ${accessToken}` }

    const now = new Date().toISOString()
    const future = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()
    const calRes = await fetch(
      `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${now}&endDateTime=${future}&$top=100&$select=subject,start,end,location,bodyPreview`,
      { headers }
    )
    const calData = await calRes.json()
    const events = calData.value || []

    const taskListsRes = await fetch('https://graph.microsoft.com/v1.0/me/todo/lists', { headers })
    const taskListsData = await taskListsRes.json()
    const taskLists = taskListsData.value || []

    let allTasks: any[] = []
    for (const list of taskLists) {
      const tasksRes = await fetch(
        `https://graph.microsoft.com/v1.0/me/todo/lists/${list.id}/tasks?$filter=status ne 'completed'&$top=50`,
        { headers }
      )
      const tasksData = await tasksRes.json()
      allTasks = [...allTasks, ...(tasksData.value || []).map((t: any) => ({ ...t, listName: list.displayName }))]
    }

    let eventsCount = 0
    for (const event of events) {
      await supabase.from('calendar_events').upsert({
        user_id: userId,
        title: event.subject || 'Untitled',
        start_time: event.start?.dateTime ? new Date(event.start.dateTime).toISOString() : null,
        end_time: event.end?.dateTime ? new Date(event.end.dateTime).toISOString() : null,
        location: event.location?.displayName || null,
        description: event.bodyPreview || null,
        source: 'microsoft',
        external_id: event.id,
        color: '#0078d4',
      }, { onConflict: 'user_id,external_id' })
      eventsCount++
    }

    let tasksCount = 0
    for (const task of allTasks) {
      await supabase.from('tasks').upsert({
        user_id: userId,
        title: task.title || 'Untitled',
        due_date: task.dueDateTime?.dateTime ? new Date(task.dueDateTime.dateTime).toISOString() : null,
        completed: task.status === 'completed',
        source: 'microsoft',
        external_id: task.id,
        category: task.listName || 'General',
        priority: task.importance === 'high' ? 'high' : 'medium',
      }, { onConflict: 'user_id,external_id' })
      tasksCount++
    }

    await supabase.from('lms_connections').update({
      last_synced_at: new Date().toISOString(),
      events_count: eventsCount,
      tasks_count: tasksCount,
      sync_error: null,
    }).eq('user_id', userId).eq('lms_type', 'microsoft')

    return new Response(JSON.stringify({ success: true, events: eventsCount, tasks: tasksCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err: any) {
    await supabase.from('lms_connections').update({ sync_error: err.message }).eq('user_id', userId)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})
