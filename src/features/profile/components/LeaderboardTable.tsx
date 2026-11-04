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

export function LeaderboardTable({
  data,
  currentUserId,
  loading,
  faculty,
  onFacultyChange,
  onViewProfile,
}: LeaderboardTableProps) {
  const { t, i18n } = useTranslation()

  return (
    <div className="px-5 pb-6">
      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="m-0 text-xs font-bold text-stone-500 dark:text-stone-400">
            {t('profile.leaderboard', 'Clasificación')}
          </h2>
          <p className="mt-1 mb-0 text-xs font-medium text-stone-500 dark:text-stone-400">
            {t('profile.leaderboardDesc', 'Estudiantes más activos por Karma')}
          </p>
        </div>

        <CustomSelect
          options={[
            { value: 'all', label: t('profile.globalLeaderboard', 'Global') },
            ...FACULTIES.filter(
              (f) => f.id !== 'deportes' && f.id !== 'dti' && f.id !== 'biblioteca',
            ).map((f) => ({
              value: f.id,
              label: i18n.language === 'en' ? f.name_en : f.name,
            })),
          ]}
          value={faculty}
          onChange={(val) => onFacultyChange(val)}
          className="w-full sm:w-auto sm:min-w-[200px]"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#C22B38] border-t-transparent dark:border-[#D93846]" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#E6E0D5] bg-white shadow-xs dark:border-white/[0.07] dark:bg-[#1E222D]">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[#E5DEC9] bg-[#FAF8F5] text-xs font-semibold text-stone-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-stone-400">
                <th className="w-10 px-4 py-3 text-center">#</th>
                <th className="px-4 py-3">{t('profile.user', 'Usuario')}</th>
                <th className="px-4 py-3 pr-6 text-right">{t('profile.karma', 'Karma')}</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((profile, idx) => {
                const isMe = profile.id === currentUserId
                const rank = idx + 1
                const medalClass =
                  rank === 1
                    ? 'text-amber-500 dark:text-amber-400'
                    : rank === 2
                      ? 'text-stone-400 dark:text-stone-300'
                      : rank === 3
                        ? 'text-amber-700 dark:text-amber-600'
                        : 'text-stone-400 dark:text-stone-500'

                return (
                  <tr
                    key={profile.id}
                    className={`border-b border-[#E5DEC9]/60 text-xs transition-colors last:border-0 dark:border-white/[0.05] ${
                      isMe
                        ? 'bg-[#FBECEB]/60 dark:bg-[#D93846]/10'
                        : 'hover:bg-[#FAF8F5] dark:hover:bg-white/[0.04]'
                    }`}
                  >
                    <td
                      className={`px-4 py-3.5 text-center text-xs font-bold tabular-nums ${medalClass}`}
                    >
                      {rank}
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => onViewProfile(profile.id)}
                        className="flex cursor-pointer items-center gap-2.5 border-none bg-transparent p-0 text-left text-xs font-semibold text-stone-900 hover:underline dark:text-stone-100"
                      >
                        <UserAvatar
                          name={profile.name}
                          src={profile.avatar_url}
                          className="h-7 w-7 text-[26px]"
                        />
                        <span className="max-w-[140px] truncate sm:max-w-none">
                          {profile.name || 'Estudiante UDP'}
                        </span>
                        {isMe && (
                          <span className="rounded-xl border border-[#F2D0CE] bg-[#FBECEB] px-2 py-0.5 text-xs font-semibold text-[#B02330] dark:border-[#D93846]/30 dark:bg-[#D93846]/15 dark:text-rose-300">
                            Tú
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3.5 pr-6 text-right text-xs font-bold tabular-nums text-amber-600 dark:text-amber-400">
                      {profile.karma}
                    </td>
                  </tr>
                )
              })}
              {(!data || data.length === 0) && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-8 text-center text-xs font-medium text-stone-400 dark:text-stone-500"
                  >
                    {t(
                      'profile.leaderboardEmpty',
                      'No hay usuarios registrados en esta clasificación.',
                    )}
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
