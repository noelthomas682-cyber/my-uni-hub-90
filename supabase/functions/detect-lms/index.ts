// supabase/functions/detect-lms/index.ts
//
// PURPOSE: Main university detection Edge Function.
// Called during onboarding when a student signs up with their university email.
//
// FLOW:
//   1. Receive student's email address
//   2. Extract domain (e.g. "essex.ac.uk")
//   3. Check university_registry DB — if complete data exists, return it immediately
//   4. If data missing or incomplete — run detection:
//      a. Detect email system (Microsoft or Google) via tenant APIs
//      b. Detect LMS (Moodle/Canvas/Blackboard/D2L) via URL probing
//   5. Save results back to university_registry with is_active: false
//   6. Return full result to onboarding — which uses it to show correct links
//
// READS FROM:  university_registry (Supabase)
// WRITES TO:   university_registry (Supabase) — new/partial entries
// CALLED BY:   Onboarding.tsx — on student signup
// SHARED DEPS: _shared/lms-registry.ts — all detection logic lives there
//
// TO ADD A UNIVERSITY: insert a row in university_registry — no code changes here.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  extractDomain,
  getCountryFromDomain,
  detectEmailSystem,
  detectLms,
  type DetectionResult,
  type Country,
} from '../_shared/lms-registry.ts'

// ─── CORS headers ─────────────────────────────────────────────────────────────
// Required for all Supabase Edge Functions called from the browser.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Supabase client ──────────────────────────────────────────────────────────
// Uses service role key so we can write to university_registry
// without being blocked by RLS policies.

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// ─── Response helper ──────────────────────────────────────────────────────────

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {

  // Handle CORS preflight — required by browsers before making POST requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // ── Auth check ──────────────────────────────────────────────────────────────
  // Only authenticated users can trigger detection.
  // This prevents abuse of the Microsoft/Google tenant APIs.

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  )
  if (authError || !user) {
    return json({ error: 'Unauthorized' }, 401)
  }

  // ── Parse request ───────────────────────────────────────────────────────────

  const body = await req.json().catch(() => ({}))
  const { email } = body

  if (!email || !email.includes('@')) {
    return json({ error: 'Valid email required' }, 400)
  }

  const domain = extractDomain(email)
  if (!domain) {
    return json({ error: 'Could not extract domain from email' }, 400)
  }

  // Determine country from TLD — used to prioritise LMS probe order
  // e.g. essex.ac.uk → UK → Moodle checked first
  // e.g. stanford.edu → US → Canvas checked first
  const country = getCountryFromDomain(domain)

  // ── Step 1: Check university_registry DB ────────────────────────────────────
  // This is the single source of truth for all university data.
  // If we have complete data, return it immediately — no detection needed.
  // "Complete" means lms_type is not null/unknown AND lms_instance_url exists.

  const { data: existing } = await supabase
    .from('university_registry')
    .select('name, lms_type, lms_instance_url, email_system, calendar_type, country, is_active')
    .eq('domain', domain)
    .maybeSingle()

  const isComplete = (
    existing &&
    existing.lms_type &&
    existing.lms_type !== 'unknown' &&
    existing.lms_instance_url &&
    existing.email_system &&
    existing.email_system !== 'unknown'
  )

  if (isComplete) {
    // Registry has complete data — return immediately, no API calls needed.
    // This is the fast path for known universities (Essex, Oxford, MIT etc.)
    return json({
      found:            true,
      source:           'registry',
      domain,
      country:          existing.country || country,
      name:             existing.name,
      email_system:     existing.email_system,
      calendar_type:    existing.calendar_type,
      lms_type:         existing.lms_type,
      lms_instance_url: existing.lms_instance_url,
      is_active:        existing.is_active,
    })
  }

  // ── Step 2: Run detection ────────────────────────────────────────────────────
  // Registry either doesn't have this domain, or has incomplete data.
  // Run email system detection and LMS detection in parallel for speed.
  // Detection logic lives in _shared/lms-registry.ts.

  const [emailResult, lmsResult] = await Promise.all([
    // Detect Microsoft 365 or Google Workspace via tenant APIs
    // Returns: { email_system, calendar_type }
    detectEmailSystem(domain),

    // Detect LMS by probing common URL patterns in country-priority order
    // Returns: { lms_type, lms_instance_url } or null
    detectLms(domain, country as Country),
  ])

  const detectionResult: DetectionResult = {
    email_system:     emailResult.email_system,
    calendar_type:    emailResult.calendar_type,
    lms_type:         lmsResult?.lms_type         ?? 'unknown',
    lms_instance_url: lmsResult?.lms_instance_url ?? null,
    country,
    source:           lmsResult ? 'probe' : 'unknown',
  }

  // ── Step 3: Save to university_registry ─────────────────────────────────────
  // Write detection results back to the registry so the next student
  // from this university gets the fast path (Step 1) instead.
  //
  // is_active: false — you review and activate in /admin.
  // on conflict: update only the fields we detected — don't overwrite
  // anything that was already manually set in the registry.

  const upsertData: Record<string, unknown> = {
    domain,
    country,
    tld:           domain.split('.').slice(-2).join('.'),
    email_system:  detectionResult.email_system  !== 'unknown' ? detectionResult.email_system  : existing?.email_system  ?? 'unknown',
    calendar_type: detectionResult.calendar_type !== 'unknown' ? detectionResult.calendar_type : existing?.calendar_type ?? null,
    lms_type:      detectionResult.lms_type      !== 'unknown' ? detectionResult.lms_type      : existing?.lms_type      ?? 'unknown',
    is_active:     existing?.is_active ?? false,  // preserve existing activation status
  }

  // Only update lms_instance_url if we found one — don't overwrite existing
  if (detectionResult.lms_instance_url) {
    upsertData.lms_instance_url = detectionResult.lms_instance_url
  }

  await supabase
    .from('university_registry')
    .upsert(upsertData, { onConflict: 'domain' })

  // ── Step 4: Return result to onboarding ─────────────────────────────────────
  // Onboarding.tsx uses this to determine which instructions and links to show.
  // If lms_type is still 'unknown', onboarding shows the manual picker fallback.

  const found = detectionResult.lms_type !== 'unknown' || detectionResult.email_system !== 'unknown'

  return json({
    found,
    source:           detectionResult.source,
    domain,
    country,
    name:             existing?.name ?? null,
    email_system:     detectionResult.email_system,
    calendar_type:    detectionResult.calendar_type,
    lms_type:         detectionResult.lms_type,
    lms_instance_url: detectionResult.lms_instance_url,
    is_active:        existing?.is_active ?? false,
  })
})