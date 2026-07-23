import { Github, Linkedin, UsersRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Dialog } from '@/shared/ui/Dialog'
import { useUIStore } from '@/shared/stores/uiStore'

const TEAM = [
  {
    name: 'Ezequiel Morales',
    handle: 'ForcexDev',
    github: 'https://github.com/ForcexDev',
    linkedin: 'https://www.linkedin.com/in/ezequielleandromorales/',
  },
  {
    name: 'Gabriel Gonzalez',
    handle: 'nuggetnuclear',
    github: 'https://github.com/nuggetnuclear',
    linkedin: 'https://www.linkedin.com/in/gabrielgonzalezl/',
  },
  {
    name: 'Maximiliano Solorza',
    handle: 'maxxee1',
    github: 'https://github.com/maxxee1',
    linkedin: 'https://www.linkedin.com/in/maximilianosolorza/',
  },
] as const

export function AboutModal() {
  const { t } = useTranslation()
  const open = useUIStore((s) => s.aboutOpen)
  const close = useUIStore((s) => s.closeAbout)

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => !nextOpen && close()}
      title={t('about.title', 'Sobre nosotros')}
      description={t('about.description', 'Conoce al equipo detrás de UDP Map.')}
      contentClassName="!bg-white dark:!bg-neutral-900 sm:max-w-lg max-h-[85dvh] overflow-y-auto p-4 sm:p-6"
    >
      <div className="flex flex-col gap-3.5">
        <div className="flex items-start gap-3 rounded-2xl border border-neutral-100 bg-neutral-50 p-3.5 sm:p-4 dark:border-neutral-800 dark:bg-neutral-800/60">
          <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-[#D41F2D] text-white shadow-sm">
            <UsersRound size={19} />
          </div>
          <p className="text-xs sm:text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
            {t('about.body', 'UDP Map es una iniciativa creada para ayudar a la comunidad UDP a explorar sus campus, compartir información y mantenerse conectada.')}
          </p>
        </div>

        <div className="grid gap-2.5">
          {TEAM.map((member) => (
            <article
              key={member.handle}
              className="flex items-center justify-between gap-2.5 rounded-2xl border border-neutral-100 p-2.5 sm:p-3.5 dark:border-neutral-800 dark:bg-neutral-900/50"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
                <div className="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-[11px] sm:text-xs font-black text-[#D41F2D] dark:bg-red-950/40 dark:text-red-300">
                  {member.name.split(' ').map((part) => part[0]).join('')}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-xs sm:text-sm font-extrabold text-neutral-900 dark:text-white leading-tight">
                    {member.name}
                  </h3>
                  <p className="truncate text-[11px] sm:text-xs font-medium text-neutral-400 mt-0.5">
                    @{member.handle}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
                <a
                  href={member.github}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${member.name} en GitHub`}
                  className="rounded-full p-1.5 sm:p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white"
                >
                  <Github size={16} className="sm:w-[17px] sm:h-[17px]" />
                </a>
                <a
                  href={member.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${member.name} en LinkedIn`}
                  className="rounded-full p-1.5 sm:p-2 text-neutral-500 transition-colors hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/40 dark:hover:text-blue-300"
                >
                  <Linkedin size={16} className="sm:w-[17px] sm:h-[17px]" />
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </Dialog>
  )
}
