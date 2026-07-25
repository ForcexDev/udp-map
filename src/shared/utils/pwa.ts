export function shouldShowUpdate({ currentBuildId, serverBuildId, dismissedBuildId }: {
  currentBuildId: string
  serverBuildId: string | null
  dismissedBuildId: string | null
}): boolean {
  if (!serverBuildId || serverBuildId === currentBuildId) return false
  return serverBuildId !== dismissedBuildId
}

export function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as unknown as { standalone?: boolean }).standalone === true
}
