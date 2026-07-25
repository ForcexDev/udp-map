/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_ORS_API_KEY?: string
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface Window {
  __deferredPwaPrompt?: BeforeInstallPromptEvent
}

declare const __APP_VERSION__: string
declare const __BUILD_ID__: string
