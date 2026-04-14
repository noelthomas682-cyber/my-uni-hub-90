// supabase/functions/d2l-import/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { normaliseD2lCalendarEvent, normaliseD2lAssignment, inferPriority, inferTaskType, extractCourseCode } from '../_shared/lms-normaliser.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

async function d2lFetch(baseUrl: string, token: string, path: string): Promise<any> {
  const res = await fetch(`${baseUrl}${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
  if (!res.ok) { if (res.status === 401) throw new Error('D2L token expired'); return null }
  return res.json()
}

async function d2lFetchPaged(baseUrl: string, token: string, path: string): Promise<any[]> {
  const all: any[] = []; let bookmark: string | null = null
  while (true) {
    const url = bookmark ? `${path}${path.includes('?') ? '&' : '?'}bookmark=${bookmark}` : path
    const data = await d2lFetch(baseUrl, token, url)
    if (!data) break
    const items = data.Items || data.Objects || (Array.isArray(data) ? data : [])
    all.push(...items)
    bookmark = data.PagingInfo?.Bookmark || null
    if (!bookmark || !data.PagingInfo?.HasMoreItems) break
  }
  return all
}

async function detectD2lVersions(baseUrl: string, token: string): Promise<{ lp: string; le: string }> {
  for (const lpVer of ['1.50', '1.47', '1.43', '1.40', '1.38', '1.35', '1.28']) {
    const data = await d2lFetch(baseUrl, token, `/d2l/api/lp/${lpVer}/users/whoami`)
    if (data?.Identifier) {
      for (const leVer of ['1.75', '1.70', '1.65', '1.60', '1.55', '1.50']) {
        const leCheck = await d2lFetch(baseUrl, token, `/d2l/api/le/${leVer}/calendar/events/myEvents/?orgUnitIdsCSV=6606`)
        if (leCheck !== null) return { lp: lpVer, le: leVer }
      }
      return { lp: lpVer, le: '1.60' }
    }
  }
  return { lp: '1.38', le: '1.60' }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

  const { data: conn } = await supabase.from('lms_connections').select('*').eq('user_id', user.id).eq('lms_type', 'd2l').single()
  if (!conn?.access_token) return new Response(JSON.stringify({ error: 'D2L not connected' }), { status: 400, headers: corsHeaders })

  const baseUrl = conn.base_url || conn.instance_url
  const token = conn.access_token
  const source = `d2l:${new URL(baseUrl).hostname}`

  try {
    const stats = { events: 0, tasks: 0, courses: 0 }
    const { lp, le } = await detectD2lVersions(baseUrl, token)

    const enrollments = await d2lFetchPaged(baseUrl, token, `/d2l/api/lp/${lp}/enrollments/myenrollments/?orgUnitTypeId=3`)
    if (!enrollments.length) return new Response(JSON.stringify({ ...stats, message: 'No courses found' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const courses = enrollments.map((e: any) => ({ id: e.OrgUnit?.Id || e.OrgUnitId, name: e.OrgUnit?.Name || 'Unknown', code: e.OrgUnit?.Code || null })).filter((c: any) => c.id)
    stats.courses = courses.length
    const courseIds = courses.map((c: any) => c.id)

    const startDate = new Date().toISOString()
    const endDate = new Date(Date.now() + 180 * 86400000).toISOString()
    const calData = await d2lFetch(baseUrl, token, `/d2l/api/le/${le}/calendar/events/myEvents/?orgUnitIdsCSV=${courseIds.join(',')}&startDateTime=${startDate}&endDateTime=${endDate}`)

    const allEvents: any[] = []
    if (calData?.Items) { for (const e of calData.Items) allEvents.push(normaliseD2lCalendarEvent(e, source)) }

    const allAssignments: any[] = []
    for (const course of courses) {
      const courseName = course.name
      const courseCode = course.code || extractCourseCode(course.name)

      const dropboxFolders = await d2lFetchPaged(baseUrl, token, `/d2l/api/le/${le}/${course.id}/dropbox/folders/`).catch(() => [])
      for (const folder of dropboxFolders) {
        if (!folder.DueDate) continue
        allAssignments.push(normaliseD2lAssignment({ ...folder, OrgUnitId: course.id }, courseName, source))
      }

      const quizData = await d2lFetch(baseUrl, token, `/d2l/api/le/${le}/${course.id}/quizzes/`).catch(() => null)
      const quizzes = quizData?.Objects || quizData?.Items || []
      for (const q of quizzes) {
        if (!q.EndDate) continue
        allAssignments.push({
          external_id: `d2l_quiz_${q.QuizId}`, title: q.Name || 'Quiz', due_date: q.EndDate,
          assignment_type: 'quiz', priority: inferPriority(q.EndDate),
          course_code: courseCode, course_name: courseName,
          description: q.Description?.Text?.slice(0, 300) || null,
          source, is_complete: false,
          metadata: { d2l_quiz_id: q.QuizId, d2l_org_unit_id: course.id, time_limit_minutes: q.TimeLimit?.IsEnforced ? q.TimeLimit?.Minutes : null },
        })
      }
    }

    if (allAssignments.length > 0) {
      const { error } = await supabase.from('assignments').upsert(allAssignments.map(t => ({ ...t, user_id: user.id })), { onConflict: 'user_id,external_id' })
      if (error) console.error('[d2l] assignment error:', error.message)
      else stats.tasks = allAssignments.length
    }

    if (allEvents.length > 0) {
      const { error } = await supabase.from('calendar_events').upsert(allEvents.map(e => ({ ...e, user_id: user.id })), { onConflict: 'user_id,external_id' })
      if (error) console.error('[d2l] event error:', error.message)
      else stats.events = allEvents.length
    }

    await supabase.from('lms_connections').update({
      last_synced_at: new Date().toISOString(), courses_count: stats.courses, tasks_count: stats.tasks, events_count: stats.events,
    }).eq('user_id', user.id).eq('lms_type', 'd2l')

    return new Response(JSON.stringify({ success: true, ...stats }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err: any) {
    console.error('[d2l-import]', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
