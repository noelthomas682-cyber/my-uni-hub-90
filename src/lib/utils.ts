import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// ─── Tailwind class merge ─────────────────────────────────────────────────────
// Used throughout the app to conditionally apply Tailwind classes.
// Merges clsx conditions with tailwind-merge to resolve conflicts.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── LMS title cleaner ────────────────────────────────────────────────────────
// Strips common LMS prefixes from assignment/task titles imported via ICS.
// Moodle, Canvas and Blackboard often prepend verbose labels like
// "Electronic Deadline: " or "Assignment: " to calendar event titles.
// This function removes those prefixes so titles display cleanly in the app.
//
// Used by: HomePage.tsx, PlanPage.tsx
// Source data: calendar_events and tasks tables (imported via fetch-ics)
export function cleanTitle(title: string): string {
  return title
    .replace(/^Electronic Deadline:\s*/i, '')
    .replace(/^Electronic Submission:\s*/i, '')
    .replace(/^Submission:\s*/i, '')
    .replace(/^Assignment:\s*/i, '')
    .replace(/^Quiz:\s*/i, '')
    .replace(/^Test:\s*/i, '')
    .replace(/^([A-Z0-9\-]+):\s*\1\s*[-–]\s*/i, '')
    .replace(/^[A-Z0-9\-]{4,}:\s*/i, '')
    .trim();
}