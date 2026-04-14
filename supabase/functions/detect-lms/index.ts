// supabase/functions/detect-lms/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { detectLmsFromEmail, extractDomain, PROBE_PATTERNS, LmsInfo, LmsType } from '../_shared/lms-registry.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

async function probeUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    const res = await fetch(url, { method: 'GET', signal: controller.signal, headers: { 'Accept': 'application/json' } })
    clearTimeout(timeout)
    return res.status !== 404 && res.status !== 0
  } catch { return false }
}

async function probeForLms(domain: string): Promise<LmsInfo | null> {
  const probes = PROBE_PATTERNS.map(async (pattern) => {
    const url = pattern(domain)
    const reachable = await probeUrl(url)
    if (!reachable) return null

    let type: LmsType = 'unknown'
    let baseUrl = ''
    let authMethod: 'oauth2' | 'token' = 'oauth2'

    if (url.includes('/api/v1/')) { type = 'canvas'; baseUrl = url.split('/api/v1')[0]; authMethod = 'oauth2' }
    else if (url.includes('/webservice/rest/')) { type = 'moodle'; baseUrl = url.split('/webservice')[0]; authMethod = 'token' }
    else if (url.includes('/learn/api/')) { type = 'blackboard'; baseUrl = url.split('/learn/api')[0]; authMethod = 'oauth2' }
    else if (url.includes('/d2l/api/')) { type = 'd2l'; baseUrl = url.split('/d2l/api')[0]; authMethod = 'oauth2' }

    if (type === 'unknown') return null
    return { type, baseUrl, name: type.charAt(0).toUpperCase() + type.slice(1), authMethod } as LmsInfo
  })

  const results = await Promise.all(probes)
  return results.find(r => r !== null) || null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

  const { email } = await req.json()
  if (!email || !email.includes('@')) {
    return new Response(JSON.stringify({ error: 'Invalid email' }), { status: 400, headers: corsHeaders })
  }

  const domain = extractDomain(email)

  // Step 1: Registry lookup
  const fromRegistry = detectLmsFromEmail(email)
  if (fromRegistry) {
    await supabase.from('lms_connections').upsert({
      user_id: user.id,
      email_domain: domain,
      lms_type: fromRegistry.type,
      base_url: fromRegistry.baseUrl,
      lms_name: fromRegistry.name,
      auth_method: fromRegistry.authMethod,
      provider: fromRegistry.type,
      instance_url: fromRegistry.baseUrl,
      university_name: fromRegistry.name,
      detected_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    return new Response(JSON.stringify({
      found: true, domain,
      lms: fromRegistry,
      source: 'registry',
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  // Step 2: HTTP probe
  const probed = await probeForLms(domain)
  if (probed) {
    await supabase.from('lms_connections').upsert({
      user_id: user.id,
      email_domain: domain,
      lms_type: probed.type,
      base_url: probed.baseUrl,
      lms_name: probed.name,
      auth_method: probed.authMethod,
      provider: probed.type,
      instance_url: probed.baseUrl,
      university_name: probed.name,
      detected_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    return new Response(JSON.stringify({
      found: true, lms: probed, source: 'probe',
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  // Step 3: Unknown
  return new Response(JSON.stringify({
    found: false, domain,
    message: 'Could not automatically detect your university\'s LMS. Please enter your LMS URL manually or use ICS file import.',
  }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
