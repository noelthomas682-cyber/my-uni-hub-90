import ICAL from 'ical.js';
import type { CalendarEvent, Assignment } from '@/lib/types';

interface ParsedICSData {
  events: Omit<CalendarEvent, 'id' | 'created_at'>[];
  assignments: Omit<Assignment, 'id' | 'created_at'>[];
}

/**
 * Parse an ICS file and extract calendar events and assignments.
 * Assignments are detected by keywords in the summary or by VTODO components.
 */
export function parseICSFile(icsContent: string, userId: string): ParsedICSData {
  const jcal = ICAL.parse(icsContent);
  const comp = new ICAL.Component(jcal);
  const events: ParsedICSData['events'] = [];
  const assignments: ParsedICSData['assignments'] = [];

  // Process VEVENT components
  const vevents = comp.getAllSubcomponents('vevent');
  for (const vevent of vevents) {
    const event = new ICAL.Event(vevent);
    const summary = event.summary || 'Untitled Event';
    const description = event.description || '';
    const location = event.location || '';
    const startDate = event.startDate?.toJSDate();
    const endDate = event.endDate?.toJSDate();
    const uid = vevent.getFirstPropertyValue('uid') as string;

    if (!startDate) continue;

    // Detect if this is an assignment/quiz/exam based on keywords
    const assignmentType = detectAssignmentTypeFromText(summary, description);

    if (assignmentType) {
      assignments.push({
        user_id: userId,
        title: summary,
        description: description?.substring(0, 500) || undefined,
        course_name: extractCourseName(summary, description),
        course_code: extractCourseCode(summary, description),
        due_date: (endDate || startDate).toISOString(),
        assignment_type: assignmentType as Assignment['assignment_type'],
        priority: assignmentType === 'exam' ? 'high' : 'medium',
        is_complete: false,
        source: 'manual',
        external_id: uid || undefined,
      });
    } else {
      events.push({
        user_id: userId,
        title: summary,
        start_time: startDate.toISOString(),
        end_time: (endDate || new Date(startDate.getTime() + 3600000)).toISOString(),
        location: location || undefined,
        event_type: detectEventType(summary),
        course_code: extractCourseCode(summary, description),
        course_name: extractCourseName(summary, description),
        is_recurring: !!vevent.getFirstPropertyValue('rrule'),
        source: 'manual',
        external_id: uid || undefined,
      });
    }
  }

  // Process VTODO components (assignments/tasks)
  const vtodos = comp.getAllSubcomponents('vtodo');
  for (const vtodo of vtodos) {
    const summary = vtodo.getFirstPropertyValue('summary') as string || 'Untitled Task';
    const description = vtodo.getFirstPropertyValue('description') as string || '';
    const due = vtodo.getFirstPropertyValue('due');
    const uid = vtodo.getFirstPropertyValue('uid') as string;

    if (!due) continue;

    const dueDate = due instanceof ICAL.Time ? due.toJSDate() : new Date(due as string);
    const aType = detectAssignmentTypeFromText(summary, description) || 'assignment';

    assignments.push({
      user_id: userId,
      title: summary,
      description: description?.substring(0, 500) || undefined,
      course_name: extractCourseName(summary, description),
      course_code: extractCourseCode(summary, description),
      due_date: dueDate.toISOString(),
      assignment_type: aType as Assignment['assignment_type'],
      priority: aType === 'exam' ? 'high' : 'medium',
      is_complete: false,
      source: 'manual',
      external_id: uid || undefined,
    });
  }

  return { events, assignments };
}

function detectAssignmentTypeFromText(title: string, description: string): string | null {
  const text = `${title} ${description}`.toLowerCase();
  if (text.includes('exam') || text.includes('midterm') || text.includes('final exam')) return 'exam';
  if (text.includes('quiz') || text.includes('test')) return 'quiz';
  if (text.includes('assignment') || text.includes('homework') || text.includes('hw ') || text.includes('due')) return 'assignment';
  if (text.includes('discussion') || text.includes('forum')) return 'discussion';
  if (text.includes('project') || text.includes('presentation')) return 'project';
  return null;
}

function detectEventType(title: string): CalendarEvent['event_type'] {
  const t = title.toLowerCase();
  if (t.includes('lecture') || t.includes('lec ')) return 'lecture';
  if (t.includes('seminar') || t.includes('sem ')) return 'seminar';
  if (t.includes('lab ') || t.includes('laboratory')) return 'lab';
  if (t.includes('tutorial') || t.includes('tut ')) return 'tutorial';
  if (t.includes('exam')) return 'exam';
  return 'class';
}

function extractCourseCode(title: string, description: string): string | undefined {
  // Match patterns like "CS 101", "MATH-200", "ENG101", "BIO 3301"
  const pattern = /\b([A-Z]{2,5})\s*[-]?\s*(\d{3,4}[A-Z]?)\b/;
  const match = title.match(pattern) || description.match(pattern);
  return match ? `${match[1]} ${match[2]}` : undefined;
}

function extractCourseName(title: string, description: string): string | undefined {
  // Try to extract course name from title — usually the part before a dash or colon
  const separators = [' - ', ': ', ' | '];
  for (const sep of separators) {
    if (title.includes(sep)) {
      return title.split(sep)[0].trim();
    }
  }
  return undefined;
}
