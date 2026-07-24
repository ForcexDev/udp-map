import { Home } from 'lucide-react'

interface ProfileFacultyTagProps {
  career: string | null | undefined
  facultyName: string | null | undefined
}

export function ProfileFacultyTag({ career, facultyName }: ProfileFacultyTagProps) {
  if (!career && !facultyName) return null

  return (
    <div className="flex items-center gap-2 mt-3.5 mx-[22px] text-[12.5px] text-neutral-500 dark:text-profile-muted">
      <Home size={13} className="opacity-60 shrink-0" />
      {[career, facultyName].filter(Boolean).join(' · ')}
    </div>
  )
}
