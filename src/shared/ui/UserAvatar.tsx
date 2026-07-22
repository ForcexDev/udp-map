import { useState } from 'react'

interface UserAvatarProps {
  name?: string | null
  src?: string | null
  className?: string
  onClick?: () => void
}

function initials(name?: string | null): string {
  const words = name?.trim().split(/\s+/).filter(Boolean) ?? []
  if (words.length === 0) return 'U'
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase()
}

export function UserAvatar({ name, src, className = '', onClick }: UserAvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const showImage = Boolean(src) && failedSrc !== src

  return (
    <div
      onClick={onClick}
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-200 ${onClick ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''} ${className}`}
      aria-label={name || 'Usuario'}
    >
      {showImage ? (
        <img
          src={src ?? undefined}
          alt={name || 'Usuario'}
          className="h-full w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailedSrc(src ?? null)}
        />
      ) : (
        <span className="text-[0.42em] font-black leading-none">{initials(name)}</span>
      )}
    </div>
  )
}
