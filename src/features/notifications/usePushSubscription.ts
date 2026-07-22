import { useEffect, useState } from 'react'
import { deletePushSubscription, registerPushSubscription } from './api'

export type PushState = 'unsupported' | 'idle' | 'subscribed' | 'denied' | 'loading' | 'error'

function pushErrorMessage(cause: unknown): string {
  const technicalMessage = cause instanceof Error ? cause.message : String(cause)
  const errorName = cause instanceof DOMException ? cause.name : ''

  if (Notification.permission === 'denied' || errorName === 'NotAllowedError') {
    return 'Las notificaciones están bloqueadas para este sitio. Permítelas desde el candado de la barra de direcciones y vuelve a intentar.'
  }

  if (
    errorName === 'AbortError'
    || /registration failed|push service error|push service|service unavailable/i.test(technicalMessage)
  ) {
    return 'El navegador no pudo conectarse a su servicio de notificaciones. Revisa los permisos de Windows y del sitio, y prueba sin VPN, bloqueadores o modo privado.'
  }

  if (/applicationserverkey|vapid|invalid.*key/i.test(technicalMessage)) {
    return 'La configuración de Web Push de la aplicación no es válida. Contacta al administrador.'
  }

  return 'No pudimos activar las notificaciones en este dispositivo. Revisa los permisos del navegador y vuelve a intentar.'
}

function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - value.length % 4) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const output = new Uint8Array(new ArrayBuffer(raw.length))
  for (let index = 0; index < raw.length; index += 1) output[index] = raw.charCodeAt(index)
  return output
}

export function usePushSubscription(enabled: boolean) {
  const supported = typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
  const [state, setState] = useState<PushState>(supported ? 'idle' : 'unsupported')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supported || !enabled) return
    let active = true
    void navigator.serviceWorker.ready.then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        if (!active) return
        if (Notification.permission === 'denied') setState('denied')
        else setState(subscription ? 'subscribed' : 'idle')
      })
      .catch((cause: unknown) => {
        if (!active) return
        console.error('[web-push] No se pudo consultar la suscripción del dispositivo:', cause)
        setError(pushErrorMessage(cause))
        setState('error')
      })
    return () => { active = false }
  }, [enabled, supported])

  const subscribe = async () => {
    const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
    if (!supported) return
    if (!publicKey) {
      setError('Falta configurar VITE_VAPID_PUBLIC_KEY.')
      setState('error')
      return
    }

    setState('loading')
    setError(null)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState('denied')
        return
      }
      const registration = await navigator.serviceWorker.ready
      const current = await registration.pushManager.getSubscription()
      const subscription = current ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })
      await registerPushSubscription(subscription)
      setState('subscribed')
    } catch (cause) {
      console.error('[web-push] No se pudo registrar el dispositivo:', cause)
      setError(pushErrorMessage(cause))
      setState(Notification.permission === 'denied' ? 'denied' : 'error')
    }
  }

  const unsubscribe = async () => {
    if (!supported) return
    setState('loading')
    setError(null)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await deletePushSubscription(subscription.endpoint)
        await subscription.unsubscribe()
      }
      setState('idle')
    } catch (cause) {
      console.error('[web-push] No se pudo desactivar el dispositivo:', cause)
      setError(pushErrorMessage(cause))
      setState('error')
    }
  }

  return { state, error, subscribe, unsubscribe }
}
