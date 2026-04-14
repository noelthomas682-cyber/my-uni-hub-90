// supabase/functions/_shared/lms-normaliser.ts
// Normalises raw LMS data into Rute's unified schema.
// Edge functions write to `assignments` and `calendar_events` tables.

export function inferPriority(dueDate: string | null): 'high' | 'medium' | 'low' {
  if (!dueDate) return 'low'
  const daysUntil = (new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  if (daysUntil < 3) return 'high'
  if (daysUntil < 7) return 'medium'
  return 'low'
}

export function inferEventType(title: string): string {
  const t = title.toLowerCase()
  if (t.includes('exam') || t.includes('final') || t.includes('midterm')) return 'exam'
  if (t.includes('lecture') || t.includes(' lec') || t.includes('lec ')) return 'lecture'
  if (t.includes('lab') || t.includes('practical') || t.includes('workshop')) return 'lab'
  if (t.includes('seminar') || t.includes('tutorial') || t.includes(' tut')) return 'seminar'
  return 'class'
}

export function inferTaskType(title: string, submissionType?: string): string {
  const t = title.toLowerCase()
  const s = (submissionType || '').toLowerCase()
  if (t.includes('exam') || t.includes('final') || t.includes('midterm')) return 'exam'
  if (t.includes('quiz') || s.includes('quiz') || t.includes('test')) return 'quiz'
  if (t.includes('project') || t.includes('dissertation') || t.includes('thesis')) return 'project'
  if (t.includes('reading') || t.includes('chapter')) return 'reading'
  if (t.includes('essay') || t.includes('assignment') || t.includes('coursework')) return 'assignment'
  return 'assignment'
}

export function extractCourseCode(text: string): string | null {
  const m = (text || '').match(/\b([A-Z]{2,6}[-\s]?\d{2,4}[A-Z]?)\b/)
  return m ? m[1].replace(/[\s-]/, '') : null
}

export function stripHtml(html: string): string {
  return (html || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
}

export const LMS_COLOURS: Record<string, string> = {
  canvas:     '#e66000',
  moodle:     '#f98012',
  blackboard: '#2a2a2a',
  d2l:        '#d32d27',
}

// ─── Canvas normalisers ───────────────────────────────────────────────────────
export function normaliseCanvasAssignment(a: any, courseName: string, courseCode: string | null, source: string) {
  return {
    external_id: `canvas_asgn_${a.id}`,
    title: a.name || 'Untitled assignment',
    due_date: a.due_at || a.lock_at || new Date().toISOString(),
    assignment_type: inferTaskType(a.name || '', a.submission_types?.join(',') || ''),
    priority: inferPriority(a.due_at),
    course_code: courseCode || extractCourseCode(courseName),
    course_name: courseName,
    description: a.description ? stripHtml(a.description).slice(0, 500) : null,
    submission_url: a.html_url || null,
    points_possible: a.points_possible || null,
    source,
    is_complete: a.has_submitted_submissions || false,
    metadata: { canvas_assignment_id: a.id, canvas_course_id: a.course_id },
  }
}

export function normaliseCanvasCalendarEvent(e: any, source: string) {
  return {
    external_id: `canvas_evt_${e.id}`,
    title: e.title || 'Untitled event',
    start_time: e.start_at,
    end_time: e.end_at || e.start_at,
    location: e.location_name || null,
    event_type: inferEventType(e.title || ''),
    course_code: extractCourseCode(e.context_code || ''),
    course_name: null,
    is_recurring: false,
    source,
    colour: LMS_COLOURS.canvas,
    is_blocked: false,
    metadata: { canvas_event_id: e.id, context_code: e.context_code },
  }
}

// ─── Moodle normalisers ───────────────────────────────────────────────────────
export function normaliseMoodleAssignment(a: any, courseName: string, source: string) {
  const dueDate = a.duedate ? new Date(a.duedate * 1000).toISOString() : null
  return {
    external_id: `moodle_asgn_${a.id}`,
    title: a.name || 'Untitled',
    due_date: dueDate || new Date().toISOString(),
    assignment_type: inferTaskType(a.name || ''),
    priority: inferPriority(dueDate),
    course_code: extractCourseCode(courseName),
    course_name: courseName,
    description: a.intro ? stripHtml(a.intro).slice(0, 500) : null,
    submission_url: null,
    points_possible: null,
    source,
    is_complete: false,
    metadata: { moodle_assignment_id: a.id, moodle_course_id: a.course },
  }
}

export function normaliseMoodleCalendarEvent(e: any, source: string) {
  const start = new Date(e.timestart * 1000).toISOString()
  const end = new Date((e.timestart + (e.timeduration || 3600)) * 1000).toISOString()
  return {
    external_id: `moodle_evt_${e.id}`,
    title: e.name || 'Untitled',
    start_time: start,
    end_time: end,
    location: e.location || null,
    event_type: inferEventType(e.name || ''),
    course_code: extractCourseCode(e.coursename || ''),
    course_name: e.coursename || null,
    is_recurring: false,
    source,
    colour: LMS_COLOURS.moodle,
    is_blocked: false,
    metadata: { moodle_event_id: e.id, moodle_course_id: e.courseid },
  }
}

// ─── Blackboard normalisers ───────────────────────────────────────────────────
export function normaliseBlackboardCourse(c: any): { id: string; name: string; code: string | null } {
  return {
    id: c.id,
    name: c.name || c.displayName || 'Unknown course',
    code: c.courseId || extractCourseCode(c.name || ''),
  }
}

// ─── D2L normalisers ──────────────────────────────────────────────────────────
export function normaliseD2lCalendarEvent(e: any, source: string) {
  return {
    external_id: `d2l_evt_${e.EventId}`,
    title: e.Title || 'Untitled',
    start_time: e.StartDateTime,
    end_time: e.EndDateTime || e.StartDateTime,
    location: e.Location || null,
    event_type: inferEventType(e.Title || ''),
    course_code: extractCourseCode(e.OrgUnitName || ''),
    course_name: e.OrgUnitName || null,
    is_recurring: false,
    source,
    colour: LMS_COLOURS.d2l,
    is_blocked: false,
    metadata: { d2l_event_id: e.EventId, d2l_org_unit_id: e.OrgUnitId },
  }
}

export function normaliseD2lAssignment(a: any, courseName: string, source: string) {
  const dueDate = a.DueDate || null
  return {
    external_id: `d2l_asgn_${a.Id}`,
    title: a.Name || 'Untitled',
    due_date: dueDate || new Date().toISOString(),
    assignment_type: inferTaskType(a.Name || ''),
    priority: inferPriority(dueDate),
    course_code: extractCourseCode(courseName),
    course_name: courseName,
    description: a.Instructions?.Html ? stripHtml(a.Instructions.Html).slice(0, 500) : null,
    submission_url: null,
    points_possible: a.TotalPoints || null,
    source,
    is_complete: false,
    metadata: { d2l_dropbox_id: a.Id, d2l_org_unit_id: a.OrgUnitId },
  }
}
