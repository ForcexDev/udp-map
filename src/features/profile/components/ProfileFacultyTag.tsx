import { Home } from 'lucide-react'

interface ProfileFacultyTagProps {
  career: string | null | undefined
  facultyName: string | null | undefined
}

export function ProfileFacultyTag({ career, facultyName }: ProfileFacultyTagProps) {
  if (!career && !facultyName) return null

  return (
    <div className="flex items-start gap-2 mt-3 mx-5 text-[12.5px] font-medium text-neutral-500 dark:text-neutral-400">
      <Home size={13} className="opacity-60 shrink-0 mt-0.5" />
      <span>{[career, facultyName].filter(Boolean).join(' · ')}</span>
    </div>
  )
}
