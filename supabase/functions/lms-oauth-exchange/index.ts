// supabase/functions/lms-oauth-exchange/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

interface TokenExchangeParams {
  provider: 'canvas' | 'blackboard' | 'd2l'
  code: string
  codeVerifier?: string
  redirectUri: string
  baseUrl: string
  clientId: string
  lmsName?: string
  lmsType: string
}

async function exchangeCanvasToken(params: TokenExchangeParams, clientSecret: string) {
  const res = await fetch(`${params.baseUrl}/login/oauth2/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: params.clientId, client_secret: clientSecret, code: params.code,
      redirect_uri: params.redirectUri, grant_type: 'authorization_code',
      ...(params.codeVerifier ? { code_verifier: params.codeVerifier } : {}),
    }),
  })
  if (!res.ok) throw new Error(`Canvas token exchange failed: ${await res.text()}`)
  return res.json()
}

async function exchangeBlackboardToken(params: TokenExchangeParams, clientSecret: string) {
  const credentials = btoa(`${params.clientId}:${clientSecret}`)
  const res = await fetch(`${params.baseUrl}/learn/api/public/v1/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${credentials}` },
    body: new URLSearchParams({ code: params.code, redirect_uri: params.redirectUri, grant_type: 'authorization_code' }),
  })
  if (!res.ok) throw new Error(`Blackboard token exchange failed: ${await res.text()}`)
  return res.json()
}

async function exchangeD2lToken(params: TokenExchangeParams, clientSecret: string) {
  const res = await fetch(`${params.baseUrl}/d2l/auth/xapi/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: params.clientId, client_secret: clientSecret, code: params.code,
      redirect_uri: params.redirectUri, grant_type: 'authorization_code',
      ...(params.codeVerifier ? { code_verifier: params.codeVerifier } : {}),
    }),
  })
  if (!res.ok) throw new Error(`D2L token exchange failed: ${await res.text()}`)
  return res.json()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

  const params: TokenExchangeParams = await req.json()
  if (!params.code || !params.baseUrl || !params.provider) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: corsHeaders })
  }

  const clientSecret = Deno.env.get(`LMS_${params.provider.toUpperCase()}_CLIENT_SECRET`) || Deno.env.get('LMS_CLIENT_SECRET') || ''

  try {
    let tokens: any
    switch (params.provider) {
      case 'canvas': tokens = await exchangeCanvasToken(params, clientSecret); break
      case 'blackboard': tokens = await exchangeBlackboardToken(params, clientSecret); break
      case 'd2l': tokens = await exchangeD2lToken(params, clientSecret); break
      default: return new Response(JSON.stringify({ error: `Unknown provider: ${params.provider}` }), { status: 400, headers: corsHeaders })
    }

    const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null

    await supabase.from('lms_connections').upsert({
      user_id: user.id, lms_type: params.lmsType || params.provider,
      lms_name: params.lmsName || params.provider,
      base_url: params.baseUrl.replace(/\/$/, ''),
      instance_url: params.baseUrl.replace(/\/$/, ''),
      university_name: params.lmsName || params.provider,
      provider: params.provider, auth_method: 'oauth2',
      access_token: tokens.access_token, refresh_token: tokens.refresh_token || null,
      token_expires_at: expiresAt, is_connected: true, is_active: true, sync_error: null,
    }, { onConflict: 'user_id' })

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err: any) {
    console.error('[lms-oauth-exchange]', err)
    await supabase.from('lms_connections').update({ is_connected: false, sync_error: err.message }).eq('user_id', user.id)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
