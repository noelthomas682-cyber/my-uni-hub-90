// supabase/functions/blackboard-import/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { normaliseBlackboardCourse, inferTaskType, inferPriority, stripHtml } from '../_shared/lms-normaliser.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

async function bbFetch(baseUrl: string, token: string, path: string): Promise<any> {
  const res = await fetch(`${baseUrl}${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
  if (!res.ok) { if (res.status === 401) throw new Error('Blackboard token expired'); return null }
  return res.json()
}

async function bbFetchPaged(baseUrl: string, token: string, path: string): Promise<any[]> {
  const all: any[] = []; let offset = 0; const limit = 100
  while (true) {
    const sep = path.includes('?') ? '&' : '?'
    const data = await bbFetch(baseUrl, token, `${path}${sep}limit=${limit}&offset=${offset}`)
    if (!data?.results?.length) break
    all.push(...data.results)
    if (!data.paging?.nextPage) break
    offset += limit
  }
  return all
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

  const { data: conn } = await supabase.from('lms_connections').select('*').eq('user_id', user.id).eq('lms_type', 'blackboard').single()
  if (!conn?.access_token) return new Response(JSON.stringify({ error: 'Blackboard not connected' }), { status: 400, headers: corsHeaders })

  const baseUrl = conn.base_url || conn.instance_url
  const token = conn.access_token
  const source = `blackboard:${new URL(baseUrl).hostname}`

  try {
    const stats = { events: 0, tasks: 0, courses: 0 }

    const me = await bbFetch(baseUrl, token, '/learn/api/public/v1/users/me')
    if (!me?.id) return new Response(JSON.stringify({ error: 'Could not fetch user' }), { status: 400, headers: corsHeaders })

    const enrollments = await bbFetchPaged(baseUrl, token, '/learn/api/public/v1/users/me/courses?expand=course')
    if (!enrollments.length) return new Response(JSON.stringify({ ...stats, message: 'No courses found' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const activeCourses = enrollments
      .filter((e: any) => e.courseRoleId === 'Student' && e.course?.availability?.available === 'Yes')
      .map((e: any) => normaliseBlackboardCourse(e.course))
    stats.courses = activeCourses.length

    const allAssignments: any[] = []
    for (const course of activeCourses) {
      const contents = await bbFetchPaged(baseUrl, token, `/learn/api/public/v1/courses/${course.id}/contents?fields=id,title,description,availability,contentHandler`)
      for (const item of contents) {
        const handler = item.contentHandler?.id || ''
        if (!handler.includes('assignment') && !handler.includes('assessment') && !handler.includes('test') && !handler.includes('quiz')) continue
        const dueDate = item.availability?.adaptive?.end || null
        if (!dueDate) continue
        allAssignments.push({
          external_id: `bb_content_${item.id}`, title: item.title || 'Untitled', due_date: dueDate,
          assignment_type: inferTaskType(item.title || '', handler), priority: inferPriority(dueDate),
          course_code: course.code, course_name: course.name,
          description: item.description?.text ? stripHtml(item.description.text).slice(0, 500) : null,
          submission_url: `${baseUrl}/webapps/blackboard/content/listContent.jsp?course_id=${course.id}`,
          source, is_complete: false, metadata: { bb_content_id: item.id, bb_course_id: course.id, content_handler: handler },
        })
      }

      const grades = await bbFetchPaged(baseUrl, token, `/learn/api/public/v2/courses/${course.id}/gradebook/columns`).catch(() => [])
      for (const col of grades) {
        if (!col.grading?.due) continue
        if (allAssignments.find(t => t.title === col.name)) continue
        allAssignments.push({
          external_id: `bb_grade_${col.id}`, title: col.name || 'Assessment', due_date: col.grading.due,
          assignment_type: inferTaskType(col.name || ''), priority: inferPriority(col.grading.due),
          course_code: course.code, course_name: course.name,
          points_possible: col.score?.possible || null, source, is_complete: false,
          metadata: { bb_column_id: col.id, bb_course_id: course.id },
        })
      }
    }

    if (allAssignments.length > 0) {
      const { error } = await supabase.from('assignments').upsert(allAssignments.map(t => ({ ...t, user_id: user.id })), { onConflict: 'user_id,external_id' })
      if (error) console.error('[blackboard] assignment error:', error.message)
      else stats.tasks = allAssignments.length
    }

    await supabase.from('lms_connections').update({
      last_synced_at: new Date().toISOString(), courses_count: stats.courses, tasks_count: stats.tasks,
    }).eq('user_id', user.id).eq('lms_type', 'blackboard')

    return new Response(JSON.stringify({ success: true, ...stats }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err: any) {
    console.error('[blackboard-import]', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
