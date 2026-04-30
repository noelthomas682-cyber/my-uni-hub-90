// supabase/functions/_shared/lms-registry.ts
//
// PURPOSE: Detection logic for university email systems and LMS platforms.
// This file contains ONLY detection functions and URL probe patterns.
// University data (names, domains, LMS URLs) lives exclusively in the
// university_registry table in Supabase — not here.
//
// HOW IT FITS TOGETHER:
//   1. detect-lms/index.ts calls these functions
//   2. Results are written back to university_registry in Supabase
//   3. Onboarding reads from university_registry to show correct links
//   4. Admin page manages university_registry rows directly
//
// TO ADD A UNIVERSITY: insert a row in university_registry — no code changes needed.

// ─── Types ────────────────────────────────────────────────────────────────────

export type LmsType     = 'canvas' | 'moodle' | 'blackboard' | 'd2l' | 'unknown'
export type EmailSystem = 'microsoft' | 'google' | 'unknown'
export type CalendarType = 'outlook' | 'google' | 'unknown'
export type Country     = 'UK' | 'US' | 'CA' | 'AU' | 'NZ' | 'EU' | 'OTHER'

export interface DetectionResult {
  // Email and calendar system — always linked (Google account = Google Calendar)
  email_system:     EmailSystem
  calendar_type:    CalendarType

  // LMS system and the confirmed URL for that university's specific instance
  lms_type:         LmsType
  lms_instance_url: string | null

  // Country derived from domain TLD — used to prioritise probe order
  country:          Country

  // Which method produced this result
  source: 'registry' | 'probe' | 'manual' | 'unknown'
}

// ─── Domain helpers ───────────────────────────────────────────────────────────

// Extracts domain from an email address.
// e.g. "student@essex.ac.uk" → "essex.ac.uk"
export function extractDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase().trim() || ''
}

// Determines country from domain TLD.
// Used by getProbesByCountry() to prioritise LMS probe order —
// UK → Moodle first, US → Canvas first, CA → D2L first, etc.
export function getCountryFromDomain(domain: string): Country {
  if (domain.endsWith('.ac.uk'))  return 'UK'
  if (domain.endsWith('.edu.au')) return 'AU'
  if (domain.endsWith('.ac.nz'))  return 'NZ'
  if (domain.endsWith('.ca'))     return 'CA'
  if (domain.endsWith('.edu'))    return 'US'
  if (
    domain.endsWith('.de') || domain.endsWith('.fr') ||
    domain.endsWith('.nl') || domain.endsWith('.es') ||
    domain.endsWith('.it') || domain.endsWith('.se') ||
    domain.endsWith('.dk') || domain.endsWith('.fi') ||
    domain.endsWith('.no') || domain.endsWith('.be') ||
    domain.endsWith('.ch') || domain.endsWith('.at')
  ) return 'EU'
  return 'OTHER'
}

// ─── Email system detection ───────────────────────────────────────────────────

// Checks if a domain uses Microsoft 365 by querying Microsoft's
// OpenID Connect tenant discovery endpoint.
// A valid response with "issuer" containing "microsoftonline" = Microsoft tenant confirmed.
// Ref: https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-protocols-oidc
export async function detectMicrosoft(domain: string): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4000)
    const res = await fetch(
      `https://login.microsoftonline.com/${domain}/v2.0/.well-known/openid-configuration`,
      { signal: controller.signal }
    )
    clearTimeout(timeout)
    if (!res.ok) return false
    const json = await res.json()
    return typeof json.issuer === 'string' && json.issuer.includes('microsoftonline')
  } catch {
    return false
  }
}

// Checks if a domain uses Google Workspace by inspecting MX DNS records.
// Google Workspace domains route email through Google's mail servers,
// so MX records containing "google.com" or "googlemail.com" = Google Workspace confirmed.
// Uses Google's public DNS-over-HTTPS API for the lookup.
export async function detectGoogle(domain: string): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4000)
    const res = await fetch(
      `https://dns.google/resolve?name=${domain}&type=MX`,
      { signal: controller.signal }
    )
    clearTimeout(timeout)
    if (!res.ok) return false
    const json = await res.json()
    const answers = json?.Answer || []
    return answers.some((a: any) =>
      typeof a.data === 'string' &&
      (a.data.includes('google.com') || a.data.includes('googlemail.com'))
    )
  } catch {
    return false
  }
}

// Runs Microsoft and Google detection in parallel for speed.
// Returns email_system and calendar_type together — they are always linked:
//   Microsoft → Outlook calendar instructions shown in onboarding
//   Google    → Google Calendar instructions shown in onboarding
export async function detectEmailSystem(domain: string): Promise<{
  email_system:  EmailSystem
  calendar_type: CalendarType
}> {
  const [isMicrosoft, isGoogle] = await Promise.all([
    detectMicrosoft(domain),
    detectGoogle(domain),
  ])
  if (isMicrosoft) return { email_system: 'microsoft', calendar_type: 'outlook' }
  if (isGoogle)    return { email_system: 'google',    calendar_type: 'google'  }
  return                  { email_system: 'unknown',   calendar_type: 'unknown' }
}

// ─── LMS probe patterns ───────────────────────────────────────────────────────
//
// Each probe is a function that takes a domain and returns a URL to check.
// If the URL responds with a non-404 status, that LMS is confirmed at that URL.
// Patterns ordered by global prevalence within each LMS type.
//
// These patterns are used by detectLms() below.
// detect-lms/index.ts → detectLms() → these probes → confirmed LMS URL

export const CANVAS_PROBES = [
  // Instructure-hosted Canvas (most common — uni.instructure.com)
  (d: string) => `https://${d.split('.')[0]}.instructure.com/api/v1/accounts`,
  // Self-hosted Canvas
  (d: string) => `https://canvas.${d}/api/v1/accounts`,
  (d: string) => `https://learn.${d}/api/v1/accounts`,
]

export const MOODLE_PROBES = [
  // Standard Moodle webservice — returns site info JSON if Moodle is running
  (d: string) => `https://moodle.${d}/webservice/rest/server.php?wsfunction=core_webservice_get_site_info&moodlewsrestformat=json`,
  (d: string) => `https://learn.${d}/webservice/rest/server.php?wsfunction=core_webservice_get_site_info&moodlewsrestformat=json`,
  (d: string) => `https://vle.${d}/webservice/rest/server.php?wsfunction=core_webservice_get_site_info&moodlewsrestformat=json`,
  (d: string) => `https://elearn.${d}/webservice/rest/server.php?wsfunction=core_webservice_get_site_info&moodlewsrestformat=json`,
  (d: string) => `https://lms.${d}/webservice/rest/server.php?wsfunction=core_webservice_get_site_info&moodlewsrestformat=json`,
]

export const BLACKBOARD_PROBES = [
  // Blackboard hosted (uni.blackboard.com)
  (d: string) => `https://${d.split('.')[0]}.blackboard.com/learn/api/public/v1/system/version`,
  // Self-hosted Blackboard
  (d: string) => `https://blackboard.${d}/learn/api/public/v1/system/version`,
  (d: string) => `https://bb.${d}/learn/api/public/v1/system/version`,
]

export const D2L_PROBES = [
  // D2L Brightspace hosted (uni.brightspace.com — most common)
  (d: string) => `https://${d.split('.')[0]}.brightspace.com/d2l/api/lp/1.38/users/whoami`,
  // Self-hosted D2L
  (d: string) => `https://d2l.${d}/d2l/api/lp/1.38/users/whoami`,
  (d: string) => `https://brightspace.${d}/d2l/api/lp/1.38/users/whoami`,
]

// Returns LMS probe sets in country-priority order.
// Checking the most likely LMS first reduces average detection time.
// Priority based on LMS market share data per country.
export function getProbesByCountry(country: Country): Array<{
  type:   LmsType
  probes: Array<(d: string) => string>
}> {
  const sets = {
    canvas:     { type: 'canvas'     as LmsType, probes: CANVAS_PROBES     },
    moodle:     { type: 'moodle'     as LmsType, probes: MOODLE_PROBES     },
    blackboard: { type: 'blackboard' as LmsType, probes: BLACKBOARD_PROBES },
    d2l:        { type: 'd2l'        as LmsType, probes: D2L_PROBES        },
  }

  // LMS priority order per country — most common first
  const order: Record<Country, LmsType[]> = {
    UK:    ['moodle', 'blackboard', 'canvas', 'd2l'],
    US:    ['canvas', 'blackboard', 'd2l',    'moodle'],
    CA:    ['d2l',    'canvas',     'moodle', 'blackboard'],
    AU:    ['canvas', 'moodle',     'blackboard', 'd2l'],
    NZ:    ['moodle', 'canvas',     'blackboard', 'd2l'],
    EU:    ['moodle', 'canvas',     'blackboard', 'd2l'],
    OTHER: ['moodle', 'canvas',     'blackboard', 'd2l'],
  }

  return order[country].map(type => sets[type])
}

// ─── LMS detection ────────────────────────────────────────────────────────────

// Probes a single URL — returns true if it responds (not 404, not timeout).
// 3 second timeout prevents slow university servers from blocking detection.
async function probeUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'Accept': 'application/json, text/html' },
    })
    clearTimeout(timeout)
    return res.status !== 404 && res.status !== 0
  } catch {
    return false
  }
}

// Strips the API path from a confirmed probe URL to get the base instance URL.
// e.g. "https://moodle.essex.ac.uk/webservice/rest/..." → "https://moodle.essex.ac.uk"
// This base URL is stored in university_registry.lms_instance_url
// and used in onboarding to build the direct link for the student.
function extractBaseUrl(url: string, type: LmsType): string {
  const splitPoints: Record<LmsType, string> = {
    canvas:     '/api/v1',
    moodle:     '/webservice',
    blackboard: '/learn/api',
    d2l:        '/d2l/api',
    unknown:    '/',
  }
  const split = splitPoints[type]
  return split ? url.split(split)[0] : url
}

// Main LMS detection function.
// Checks LMS types in country-priority order (sequentially).
// Within each LMS type, all URL patterns are checked in parallel.
// Stops and returns as soon as any pattern for any LMS type responds.
//
// Called by: detect-lms/index.ts
// Writes result to: university_registry via detect-lms/index.ts
export async function detectLms(domain: string, country: Country): Promise<{
  lms_type:         LmsType
  lms_instance_url: string
} | null> {
  const probeSets = getProbesByCountry(country)

  for (const { type, probes } of probeSets) {
    // Check all URL patterns for this LMS type in parallel
    const results = await Promise.all(
      probes.map(async (pattern) => {
        const url = pattern(domain)
        const found = await probeUrl(url)
        return found ? { url, type } : null
      })
    )

    const match = results.find(r => r !== null)
    if (match) {
      return {
        lms_type:         match.type,
        lms_instance_url: extractBaseUrl(match.url, match.type),
      }
    }
  }

  // No LMS found across all patterns
  return null
}