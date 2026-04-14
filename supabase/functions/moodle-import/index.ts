// supabase/functions/moodle-import/index.ts
// Imports from Moodle LMS using Web Services REST API.
// Writes to `assignments` and `calendar_events` tables.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { normaliseMoodleAssignment, normaliseMoodleCalendarEvent, extractCourseCode } from '../_shared/lms-normaliser.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

async function moodleCall(baseUrl: string, token: string, wsfunction: string, params: Record<string, any> = {}): Promise<any> {
  const flatParams: Record<string, string> = { wstoken: token, wsfunction, moodlewsrestformat: 'json' }
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) { v.forEach((item, i) => { flatParams[`${k}[${i}]`] = String(item) }) }
    else { flatParams[k] = String(v) }
  }
  const res = await fetch(`${baseUrl}/webservice/rest/server.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(flatParams),
  })
  if (!res.ok) throw new Error(`Moodle HTTP error: ${res.status}`)
  const data = await res.json()
  if (data?.exception) throw new Error(`${data.message || 'Moodle error'} [${data.errorcode}]`)
  return data
}

async function getMoodleToken(baseUrl: string, username: string, password: string): Promise<{ token: string }> {
  const clean = baseUrl.replace(/\/$/, '')
  const res = await fetch(`${clean}/login/token.php?` + new URLSearchParams({
    username: username.trim(), password, service: 'moodle_mobile_app',
  }), { method: 'POST' })

  let data: any
  try { data = await res.json() } catch { throw new Error('Moodle did not respond — check the URL is correct') }

  if (data?.token) return { token: data.token }

  if (data?.errorcode === 'ssoauthloginonly') {
    throw new Error('SSO_ONLY: Your university has disabled direct login. Please use browser login or ICS file import instead.')
  }
  if (data?.errorcode === 'invalidlogin') {
    throw new Error('Incorrect username or password. Use your full university email and password.')
  }
  if (data?.error) throw new Error(data.error)
  throw new Error('No token returned')
}

async function getMoodleUserId(baseUrl: string, token: string): Promise<number | null> {
  try { const info = await moodleCall(baseUrl, token, 'core_webservice_get_site_info'); return info?.userid || null }
  catch { return null }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

  const body = await req.json()
  let baseUrl: string, token: string, userId: number | null = null

  // First-time connection
  if (body.username && body.password && body.baseUrl) {
    baseUrl = body.baseUrl.replace(/\/$/, '')
    try {
      const result = await getMoodleToken(baseUrl, body.username, body.password)
      token = result.token
    } catch (err: any) {
      const isSsoOnly = err.message.startsWith('SSO_ONLY:')
      return new Response(JSON.stringify({
        error: err.message, errorCode: isSsoOnly ? 'SSO_ONLY' : 'LOGIN_FAILED',
      }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    userId = await getMoodleUserId(baseUrl, token)

    await supabase.from('lms_connections').upsert({
      user_id: user.id, lms_type: 'moodle', base_url: baseUrl, lms_name: body.lmsName || 'Moodle',
      email_domain: body.username.includes('@') ? body.username.split('@')[1] : null,
      auth_method: 'token', access_token: token, is_connected: true, is_active: true,
      sync_error: null, provider: 'moodle', instance_url: baseUrl, university_name: body.lmsName || 'Moodle',
      metadata: { moodle_user_id: userId },
    }, { onConflict: 'user_id' })
  } else {
    // Re-sync with stored token
    const { data: conn } = await supabase.from('lms_connections').select('*')
      .eq('user_id', user.id).eq('lms_type', 'moodle').single()
    if (!conn?.access_token) {
      return new Response(JSON.stringify({ error: 'Moodle not connected' }), { status: 400, headers: corsHeaders })
    }
    baseUrl = conn.base_url || conn.instance_url
    token = conn.access_token
    userId = conn.metadata?.moodle_user_id || null
  }

  // Import data
  try {
    const stats = { events: 0, tasks: 0, courses: 0 }
    const source = `moodle:${new URL(baseUrl).hostname}`

    let courses: any[] = []
    try {
      courses = await moodleCall(baseUrl, token, 'core_enrol_get_users_courses', { userid: userId || 0, returnusercount: 0 })
      if (!Array.isArray(courses)) courses = []
    } catch (err: any) {
      await supabase.from('lms_connections').update({ sync_error: err.message, is_connected: false })
        .eq('user_id', user.id).eq('lms_type', 'moodle')
      return new Response(JSON.stringify({ error: 'Session expired — please reconnect', errorCode: 'TOKEN_EXPIRED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (courses.length === 0) {
      return new Response(JSON.stringify({ success: true, ...stats, message: 'No enrolled courses found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    stats.courses = courses.length
    const courseIds = courses.map((c: any) => c.id)
    const courseMap: Record<number, { name: string; shortname: string }> = {}
    courses.forEach((c: any) => { courseMap[c.id] = { name: c.fullname || c.shortname || 'Unknown', shortname: c.shortname || '' } })

    const allAssignments: any[] = []

    // Assignments
    try {
      const assignData = await moodleCall(baseUrl, token, 'mod_assign_get_assignments', { courseids: courseIds, includenotenrolledcourses: 1 })
      if (assignData?.courses) {
        for (const course of assignData.courses) {
          const courseName = courseMap[course.id]?.name || course.fullname || 'Unknown'
          for (const a of (course.assignments || [])) {
            allAssignments.push(normaliseMoodleAssignment(a, courseName, source))
          }
        }
      }
    } catch (e) { console.error('[moodle] assignments error:', e) }

    // Quizzes
    try {
      const quizData = await moodleCall(baseUrl, token, 'mod_quiz_get_quizzes_by_courses', { courseids: courseIds })
      if (quizData?.quizzes) {
        for (const q of quizData.quizzes) {
          const courseName = courseMap[q.course]?.name || 'Unknown'
          const closeDate = q.timeclose ? new Date(q.timeclose * 1000).toISOString() : null
          if (!closeDate) continue
          allAssignments.push({
            external_id: `moodle_quiz_${q.id}`,
            title: q.name || 'Quiz',
            due_date: closeDate,
            assignment_type: 'quiz',
            priority: closeDate && (new Date(closeDate).getTime() - Date.now()) < 3 * 86400000 ? 'high' : 'medium',
            course_code: extractCourseCode(courseName),
            course_name: courseName,
            description: q.intro ? q.intro.replace(/<[^>]+>/g, '').slice(0, 300) : null,
            source, is_complete: false,
            metadata: { moodle_quiz_id: q.id, moodle_course_id: q.course, time_limit: q.timelimit },
          })
        }
      }
    } catch (e) { console.error('[moodle] quizzes error:', e) }

    // Calendar events
    const allEvents: any[] = []
    try {
      const now = Math.floor(Date.now() / 1000)
      const calData = await moodleCall(baseUrl, token, 'core_calendar_get_calendar_events', {
        options: { userevents: 1, siteevents: 1, timestart: now, timeend: now + 180 * 86400 },
        events: { courseids: courseIds },
      })
      if (calData?.events) {
        for (const e of calData.events) {
          allEvents.push(normaliseMoodleCalendarEvent(e, source))
        }
      }
    } catch (e) { console.error('[moodle] calendar error:', e) }

    // Upsert to DB (assignments table, not tasks)
    if (allAssignments.length > 0) {
      const forDb = allAssignments.map(t => ({ ...t, user_id: user.id }))
      const { error } = await supabase.from('assignments').upsert(forDb, { onConflict: 'user_id,external_id' })
      if (error) console.error('[moodle] assignment upsert error:', error.message)
      else stats.tasks = allAssignments.length
    }

    if (allEvents.length > 0) {
      const forDb = allEvents.map(e => ({ ...e, user_id: user.id }))
      const { error } = await supabase.from('calendar_events').upsert(forDb, { onConflict: 'user_id,external_id' })
      if (error) console.error('[moodle] event upsert error:', error.message)
      else stats.events = allEvents.length
    }

    // Update sync status
    await supabase.from('lms_connections').update({
      last_synced_at: new Date().toISOString(), sync_error: null, is_connected: true,
      courses_count: stats.courses, tasks_count: stats.tasks, events_count: stats.events,
    }).eq('user_id', user.id).eq('lms_type', 'moodle')

    return new Response(JSON.stringify({ success: true, ...stats }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err: any) {
    console.error('[moodle-import]', err)
    return new Response(JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
