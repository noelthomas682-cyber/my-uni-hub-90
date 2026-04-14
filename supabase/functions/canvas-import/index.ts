// supabase/functions/canvas-import/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { normaliseCanvasAssignment, normaliseCanvasCalendarEvent, extractCourseCode } from '../_shared/lms-normaliser.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

async function canvasFetch(baseUrl: string, token: string, path: string): Promise<any[]> {
  const results: any[] = []
  let url: string | null = `${baseUrl}/api/v1${path}`
  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
    if (!res.ok) { console.error(`[canvas] ${path} → ${res.status}`); break }
    const data = await res.json()
    if (Array.isArray(data)) results.push(...data)
    const link = res.headers.get('Link') || ''
    const next = link.match(/<([^>]+)>;\s*rel="next"/)
    url = next ? next[1] : null
  }
  return results
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

  const { data: conn } = await supabase.from('lms_connections').select('*')
    .eq('user_id', user.id).eq('lms_type', 'canvas').single()
  if (!conn || !conn.access_token) {
    return new Response(JSON.stringify({ error: 'Canvas not connected' }), { status: 400, headers: corsHeaders })
  }

  const baseUrl = conn.base_url || conn.instance_url
  const token = conn.access_token
  const source = `canvas:${new URL(baseUrl).hostname}`

  try {
    const stats = { events: 0, tasks: 0, courses: 0 }

    const courses = await canvasFetch(baseUrl, token, '/courses?enrollment_state=active&include[]=course_code&include[]=term&per_page=50')
    stats.courses = courses.length
    if (courses.length === 0) {
      return new Response(JSON.stringify({ ...stats, message: 'No active courses found' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const courseMap: Record<number, { name: string; code: string | null }> = {}
    for (const c of courses) { courseMap[c.id] = { name: c.name || c.course_code || 'Unknown', code: c.course_code || extractCourseCode(c.name || '') } }

    const allAssignments: any[] = []
    for (const course of courses) {
      const assignments = await canvasFetch(baseUrl, token, `/courses/${course.id}/assignments?include[]=submission&per_page=100`)
      const quizzes = await canvasFetch(baseUrl, token, `/courses/${course.id}/quizzes?per_page=100`)
      const courseInfo = courseMap[course.id]

      for (const a of assignments) {
        if (!a.due_at && !a.lock_at) continue
        allAssignments.push(normaliseCanvasAssignment(a, courseInfo.name, courseInfo.code, source))
      }

      for (const q of quizzes) {
        if (!q.due_at && !q.lock_at) continue
        allAssignments.push({
          external_id: `canvas_quiz_${q.id}`, title: q.title || 'Quiz',
          due_date: q.due_at || q.lock_at, assignment_type: 'quiz',
          priority: q.due_at && (new Date(q.due_at).getTime() - Date.now()) < 3 * 86400000 ? 'high' : 'medium',
          course_code: courseInfo.code, course_name: courseInfo.name,
          description: q.description ? q.description.replace(/<[^>]+>/g, '').slice(0, 300) : null,
          submission_url: `${baseUrl}/courses/${course.id}/quizzes/${q.id}`,
          points_possible: q.points_possible || null, source, is_complete: false,
          metadata: { canvas_quiz_id: q.id, canvas_course_id: course.id, time_limit_minutes: q.time_limit, question_count: q.question_count },
        })
      }
    }

    const courseIds = courses.map((c: any) => `course_${c.id}`)
    const start = new Date().toISOString()
    const end = new Date(Date.now() + 180 * 86400000).toISOString()
    const contextCodes = courseIds.join('&context_codes[]=')

    const calendarEvents = await canvasFetch(baseUrl, token, `/calendar_events?type=event&context_codes[]=${contextCodes}&start_date=${start}&end_date=${end}&per_page=200`)
    const calendarAssignments = await canvasFetch(baseUrl, token, `/calendar_events?type=assignment&context_codes[]=${contextCodes}&start_date=${start}&end_date=${end}&per_page=200`)
    const allEvents = [...calendarEvents.map(e => normaliseCanvasCalendarEvent(e, source)), ...calendarAssignments.map(e => normaliseCanvasCalendarEvent(e, source))]

    if (allAssignments.length > 0) {
      const { error } = await supabase.from('assignments').upsert(allAssignments.map(t => ({ ...t, user_id: user.id })), { onConflict: 'user_id,external_id' })
      if (error) console.error('[canvas] assignment error:', error.message)
      else stats.tasks = allAssignments.length
    }

    if (allEvents.length > 0) {
      const { error } = await supabase.from('calendar_events').upsert(allEvents.map(e => ({ ...e, user_id: user.id })), { onConflict: 'user_id,external_id' })
      if (error) console.error('[canvas] event error:', error.message)
      else stats.events = allEvents.length
    }

    await supabase.from('lms_connections').update({
      last_synced_at: new Date().toISOString(), courses_count: stats.courses, tasks_count: stats.tasks, events_count: stats.events,
    }).eq('user_id', user.id).eq('lms_type', 'canvas')

    return new Response(JSON.stringify({ success: true, ...stats }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err: any) {
    console.error('[canvas-import]', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
