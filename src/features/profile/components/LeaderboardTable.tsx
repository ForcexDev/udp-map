import { useTranslation } from 'react-i18next'
import { CustomSelect } from '@/shared/ui/CustomSelect'
import { UserAvatar } from '@/shared/ui/UserAvatar'
import { FACULTIES } from '@/shared/data/campusData'
import type { Profile } from '@/shared/types/database'

interface LeaderboardTableProps {
  data: Profile[] | undefined
  currentUserId: string
  loading: boolean
  faculty: string
  onFacultyChange: (val: string) => void
  onViewProfile: (id: string) => void
}

export function LeaderboardTable({ data, currentUserId, loading, faculty, onFacultyChange, onViewProfile }: LeaderboardTableProps) {
  const { t, i18n } = useTranslation()

  return (
    <div className="px-5 pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-[11px] font-black text-neutral-400 uppercase tracking-widest m-0">
            {t('profile.leaderboard', 'Clasificación')}
          </h2>
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mt-1 mb-0">
            {t('profile.leaderboardDesc', 'Estudiantes más activos por Karma')}
          </p>
        </div>

        <CustomSelect
          options={[
            { value: 'all', label: t('profile.globalLeaderboard', 'Global') },
            ...FACULTIES.filter((f) => f.id !== 'deportes' && f.id !== 'dti' && f.id !== 'biblioteca').map((f) => ({
              value: f.id,
              label: i18n.language === 'en' ? f.name_en : f.name,
            })),
          ]}
          value={faculty}
          onChange={(val) => onFacultyChange(val)}
          className="w-full sm:w-auto min-w-[200px]"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-[#D41F2D] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40 text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                <th className="px-4 py-3 text-center w-10">#</th>
                <th className="px-4 py-3">{t('profile.user', 'Usuario')}</th>
                <th className="px-4 py-3 text-right pr-6">{t('profile.karma', 'Karma')}</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((profile, idx) => {
                const isMe = profile.id === currentUserId
                const rank = idx + 1
                const medalClass =
                  rank === 1 ? 'text-amber-400' :
                  rank === 2 ? 'text-neutral-400' :
                  rank === 3 ? 'text-amber-700' : 'text-neutral-400'

                return (
                  <tr
                    key={profile.id}
                    className={`border-b border-neutral-100 dark:border-neutral-800 last:border-0 transition-colors text-sm ${
                      isMe
                        ? 'bg-red-50/60 dark:bg-red-950/20'
                        : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/40'
                    }`}
                  >
                    <td className={`px-4 py-3.5 text-center text-sm font-black ${medalClass}`}>
                      {rank}
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => onViewProfile(profile.id)}
                        className="flex items-center gap-2.5 text-left bg-transparent border-none p-0 cursor-pointer text-neutral-900 dark:text-white font-bold hover:underline"
                      >
                        <UserAvatar name={profile.name} src={profile.avatar_url} className="w-7 h-7 text-[26px]" />
                        <span className="truncate max-w-[140px] sm:max-w-none">
                          {profile.name || 'Estudiante UDP'}
                        </span>
                        {isMe && (
                          <span className="text-[9px] bg-red-100 dark:bg-red-950/60 text-[#D41F2D] dark:text-red-400 font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                            Tú
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3.5 text-right pr-6 font-black text-amber-500 dark:text-amber-400">
                      {profile.karma}
                    </td>
                  </tr>
                )
              })}
              {(!data || data.length === 0) && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-xs font-medium text-neutral-400">
                    {t('profile.leaderboardEmpty', 'No hay usuarios registrados en esta clasificación.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
