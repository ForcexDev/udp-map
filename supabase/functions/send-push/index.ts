import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const cronSecret = Deno.env.get('CRON_SECRET')!
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!
const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:soporte@udp.cl'

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

interface DeliveryRow {
  id: string
  attempts: number
  notification: {
    id: string
    title: string
    body: string
    url: string
    type: string
    category: string
    payload: Record<string, unknown>
  }
  subscription: {
    id: string
    endpoint: string
    p256dh: string
    auth: string
  }
}

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3000',
  'https://udp-map.vercel.app',
]

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || ''
  const envOriginsStr = Deno.env.get('ALLOWED_ORIGINS') || ''
  const envOrigins = envOriginsStr ? envOriginsStr.split(',').map((o) => o.trim()) : []
  const allowedList = [...DEFAULT_ALLOWED_ORIGINS, ...envOrigins]

  const isAllowed = allowedList.includes(origin)
  const matchedOrigin = isAllowed ? origin : DEFAULT_ALLOWED_ORIGINS[0]

  return {
    'Access-Control-Allow-Origin': matchedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(req),
      'content-type': 'application/json; charset=utf-8',
    },
  })
}

async function isAuthorized(req: Request): Promise<boolean> {
  const providedSecret = req.headers.get('x-cron-secret')
  if (cronSecret && providedSecret === cronSecret) return true

  const authorization = req.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) return false

  const token = authorization.slice('Bearer '.length)
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return false

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  return profile?.role === 'admin'
}

Deno.serve(async (req) => {
  const headers = getCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405)
  if (!await isAuthorized(req)) return json(req, { error: 'Unauthorized' }, 401)

  const { data: remindersCreated, error: reminderError } = await supabase
    .rpc('enqueue_upcoming_event_notifications')

  if (reminderError) {
    console.error('Could not enqueue event reminders', reminderError)
  }

  const { data, error } = await supabase
    .from('notification_push_deliveries')
    .select(`
      id,
      attempts,
      notification:notifications!inner(id, title, body, url, type, category, payload),
      subscription:push_subscriptions!inner(id, endpoint, p256dh, auth)
    `)
    .eq('status', 'pending')
    .lte('next_attempt_at', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(100)

  if (error) return json(req, { error: error.message }, 500)

  let sent = 0
  let failed = 0
  let expired = 0

  for (const rawDelivery of data ?? []) {
    const delivery = rawDelivery as unknown as DeliveryRow
    const payload = JSON.stringify({
      notificationId: delivery.notification.id,
      title: delivery.notification.title,
      body: delivery.notification.body,
      url: delivery.notification.url,
      type: delivery.notification.type,
      category: delivery.notification.category,
      payload: delivery.notification.payload,
    })

    try {
      await webpush.sendNotification(
        {
          endpoint: delivery.subscription.endpoint,
          keys: {
            p256dh: delivery.subscription.p256dh,
            auth: delivery.subscription.auth,
          },
        },
        payload,
        { TTL: 60 * 60 * 24, urgency: 'normal' },
      )

      await supabase
        .from('notification_push_deliveries')
        .update({
          status: 'sent',
          attempts: delivery.attempts + 1,
          sent_at: new Date().toISOString(),
          last_error: null,
        })
        .eq('id', delivery.id)
      sent += 1
    } catch (pushError) {
      const statusCode = typeof pushError === 'object' && pushError !== null && 'statusCode' in pushError
        ? Number((pushError as { statusCode?: number }).statusCode)
        : 0
      const message = pushError instanceof Error ? pushError.message : String(pushError)

      if (statusCode === 404 || statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', delivery.subscription.id)
        expired += 1
        continue
      }

      const attempts = delivery.attempts + 1
      const terminal = attempts >= 5
      const retryAt = new Date(Date.now() + Math.min(60, 5 * (2 ** attempts)) * 60_000)
      await supabase
        .from('notification_push_deliveries')
        .update({
          status: terminal ? 'failed' : 'pending',
          attempts,
          next_attempt_at: retryAt.toISOString(),
          last_error: message.slice(0, 1000),
        })
        .eq('id', delivery.id)
      failed += 1
    }
  }

  return json(req, {
    remindersCreated: remindersCreated ?? 0,
    processed: data?.length ?? 0,
    sent,
    failed,
    expiredSubscriptions: expired,
    reminderError: reminderError?.message ?? null,
  })
})
