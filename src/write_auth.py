content = open('/Users/noelthomas/Desktop/my-uni-hub-90/supabase/functions/microsoft-auth/index.ts', 'w')
content.write("""import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL'),
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const clientId = Deno.env.get('MICROSOFT_CLIENT_ID')
  const tenantId = Deno.env.get('MICROSOFT_TENANT_ID')
  const clientSecret = Deno.env.get('MICROSOFT_CLIENT_SECRET')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const redirectUri = supabaseUrl + '/functions/v1/microsoft-auth/callback'

  const url = new URL(req.url)
  const isCallback = url.pathname.endsWith('/callback')

  if (!isCallback) {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

    const state = btoa(JSON.stringify({ userId: user.id, ts: Date.now() }))
    const scopes = 'User.Read Calendars.Read Tasks.Read offline_access'

    const authUrl = new URL('https://login.microsoftonline.com/' + tenantId + '/oauth2/v2.0/authorize')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('scope', scopes)
    authUrl.searchParams.set('state', state)
    authUrl.searchParams.set('prompt', 'select_account')

    return new Response(JSON.stringify({ authUrl: authUrl.toString() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  if (!code || !state) return new Response('Missing code or state', { status: 400 })

  let userId
  try {
    const decoded = JSON.parse(atob(state))
    userId = decoded.userId
  } catch {
    return new Response('Invalid state', { status: 400 })
  }

  const tokenRes = await fetch('https://login.microsoftonline.com/' + tenantId + '/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    const err = await tokenRes.text()
    return new Response('Token exchange failed: ' + err, { status: 500 })
  }

  const tokens = await tokenRes.json()

  const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: 'Bearer ' + tokens.access_token }
  })
  const msProfile = await profileRes.json()

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
  const domain = (msProfile.mail || msProfile.userPrincipalName || '').split('@')[1] || ''

  await supabase.from('lms_connections').upsert({
    user_id: userId,
    lms_type: 'microsoft',
    lms_name: 'Microsoft 365',
    provider: 'microsoft',
    base_url: 'https://graph.microsoft.com',
    instance_url: 'https://graph.microsoft.com',
    university_name: msProfile.companyName || domain || 'University',
    email_domain: domain,
    auth_method: 'oauth2',
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || null,
    token_expires_at: expiresAt,
    is_connected: true,
    is_active: true,
    sync_error: null,
    detected_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  await supabase.functions.invoke('microsoft-sync', {
    body: { userId: userId, accessToken: tokens.access_token }
  })

  const html = '<html><body><script>if(window.opener){window.opener.location.href=\\'http://localhost:8080/lms-settings?connected=true\\';window.close();}else{window.location.href=\\'http://localhost:8080/lms-settings?connected=true\\';}<\\/script><p>Connected! Redirecting...</p></body></html>'

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html' }
  })
})
""")
content.close()
print('Done')