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
      contentClassName="!bg-[#FAF8F5] dark:!bg-[#151820] border border-[#E5DEC9] dark:border-white/10 sm:max-w-lg max-h-[85dvh] overflow-y-auto p-4 sm:p-6 rounded-3xl premium-shadow"
    >
      <div className="flex flex-col gap-3.5">
        <div className="flex items-start gap-3 rounded-2xl border border-[#E6E0D5] bg-white p-3.5 sm:p-4 dark:border-white/[0.07] dark:bg-[#1E222D]">
          <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-2xl bg-[#C22B38] text-white shadow-xs dark:bg-[#D93846]">
            <UsersRound size={19} />
          </div>
          <p className="text-xs sm:text-sm leading-relaxed text-stone-600 dark:text-stone-300">
            {t('about.body', 'UDP Map es una iniciativa creada para ayudar a la comunidad UDP a explorar sus campus, compartir información y mantenerse conectada.')}
          </p>
        </div>

        <div className="grid gap-2.5">
          {TEAM.map((member) => (
            <article
              key={member.handle}
              className="flex items-center justify-between gap-2.5 rounded-2xl border border-[#E6E0D5] bg-white p-2.5 sm:p-3.5 dark:border-white/[0.07] dark:bg-[#1E222D]"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
                <div className="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-[#FBECEB] text-[11px] sm:text-xs font-bold text-[#B02330] dark:bg-[#D93846]/15 dark:text-rose-300">
                  {member.name.split(' ').map((part) => part[0]).join('')}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 leading-tight">
                    {member.name}
                  </h3>
                  <p className="truncate text-[11px] sm:text-xs font-normal text-stone-500 dark:text-stone-400 mt-0.5">
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
                  className="rounded-xl p-1.5 sm:p-2 text-stone-500 transition-colors hover:bg-[#EFECE4] hover:text-stone-900 dark:text-stone-400 dark:hover:bg-white/[0.08] dark:hover:text-stone-100"
                >
                  <Github size={16} className="sm:w-[17px] sm:h-[17px]" />
                </a>
                <a
                  href={member.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${member.name} en LinkedIn`}
                  className="rounded-xl p-1.5 sm:p-2 text-stone-500 transition-colors hover:bg-sky-50 hover:text-sky-600 dark:text-stone-400 dark:hover:bg-sky-950/40 dark:hover:text-sky-300"
                >
                  <Linkedin size={16} className="sm:w-[17px] sm:h-[17px]" />
                </a>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-2 text-center text-xs font-medium tabular-nums text-stone-400 dark:text-stone-500">
          UDP Map v{__APP_VERSION__}
        </div>
      </div>
    </Dialog>
  )
}
