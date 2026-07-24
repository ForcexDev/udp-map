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
    <div className="px-[22px] pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-[17px] font-display font-bold text-neutral-900 dark:text-profile-text m-0">
            {t('profile.leaderboard', 'Ranking')}
          </h2>
          <p className="text-xs text-neutral-500 dark:text-profile-faint mt-0.5 mb-0">
            {t('profile.leaderboardDesc', 'Estudiantes más activos por Karma')}
          </p>
        </div>

        <CustomSelect
          options={[
            { value: 'all', label: t('profile.globalLeaderboard', 'Clasificación Global') },
            ...FACULTIES.filter(f => f.id !== 'deportes' && f.id !== 'dti' && f.id !== 'biblioteca').map((f) => ({
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
          <div className="w-6 h-6 border-2 border-[#D41F2D] dark:border-profile-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-[14px] border border-neutral-200 dark:border-profile-line bg-white dark:bg-profile-bg">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-profile-line bg-neutral-50/50 dark:bg-[#161719] text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
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
                  rank === 3 ? 'text-amber-700' : 'text-neutral-400 dark:text-profile-faint'

                return (
                  <tr
                    key={profile.id}
                    className={`border-b border-neutral-100 dark:border-profile-line last:border-0 transition-colors text-sm ${
                      isMe
                        ? 'bg-red-50/50 dark:bg-red-950/20 font-bold'
                        : 'hover:bg-neutral-50/60 dark:hover:bg-[#161719]'
                    }`}
                  >
                    <td className={`px-4 py-3.5 text-center font-bold font-mono text-sm ${medalClass}`}>
                      {rank}
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => onViewProfile(profile.id)}
                        className="flex items-center gap-2.5 text-left hover:underline bg-transparent border-none p-0 cursor-pointer text-neutral-900 dark:text-profile-text"
                      >
                        <UserAvatar name={profile.name} src={profile.avatar_url} className="w-7 h-7 text-[26px]" />
                        <span className="truncate max-w-[140px] sm:max-w-none">
                          {profile.name || 'Estudiante UDP'}
                        </span>
                        {isMe && (
                          <span className="text-[10px] bg-red-100 dark:bg-red-950 text-[#D41F2D] dark:text-profile-accent font-mono px-1 rounded-md uppercase">
                            Tú
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3.5 text-right pr-6 font-mono font-bold text-amber-500 dark:text-profile-gold">
                      {profile.karma}
                    </td>
                  </tr>
                )
              })}
              {(!data || data.length === 0) && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-xs text-neutral-400 italic">
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
