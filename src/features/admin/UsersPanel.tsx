import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, UserRound } from 'lucide-react'
import type { Role, Profile } from '@/shared/types/database'
import { fetchAdminUsers, adminSetUserRole } from './api'
import { useUIStore } from '@/shared/stores/uiStore'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { CustomSelect } from '@/shared/ui/CustomSelect'
import { UserAvatar } from '@/shared/ui/UserAvatar'
import { FilterPills } from '@/shared/ui/FilterPills'
import { AdminEmpty, AdminLoading, AdminScreen } from './AdminScreen'

const ROLE_OPTIONS: readonly { value: Role | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'student', label: 'Estudiantes' },
  { value: 'moderator', label: 'Moderadores' },
  { value: 'admin', label: 'Admins' },
]

/** Las tres a las que se puede mover a alguien. `guest` no es un rol que se
 *  asigne: es no tener sesión. */
const ASSIGNABLE = [
  { value: 'student', label: 'Estudiante' },
  { value: 'moderator', label: 'Moderador' },
  { value: 'admin', label: 'Administrador' },
]

const ROLE_LABEL: Record<Role, string> = {
  guest: 'Invitado',
  student: 'Estudiante',
  moderator: 'Moderador',
  admin: 'Administrador',
}

/** Mismos colores que el perfil público (`features/profile/utils.ts`), para que
 *  un moderador se vea igual aquí que en su ficha. */
const ROLE_TONE: Record<Role, string> = {
  guest: 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400',
  student: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
  moderator: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-500',
  admin: 'bg-red-50 text-[#D41F2D] dark:bg-red-950/40 dark:text-red-400',
}

export function UsersPanel() {
  const queryClient = useQueryClient()
  const showToast = useUIStore((s) => s.showToast)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all')
  const [pendingChange, setPendingChange] = useState<{ user: Profile; nextRole: Role } | null>(null)

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin', 'users', search, roleFilter],
    queryFn: () => fetchAdminUsers({ search, role: roleFilter }),
  })

  const roleMutation = useMutation({
    mutationFn: ({ userId, newRole }: { userId: string; newRole: Role }) =>
      adminSetUserRole(userId, newRole),
    onSuccess: () => {
      showToast('Rol actualizado.')
      void queryClient.invalidateQueries({ queryKey: ['admin'] })
      setPendingChange(null)
    },
    onError: (err) => showToast(err instanceof Error ? err.message : 'No se pudo cambiar el rol.'),
  })

  return (
    <AdminScreen
      title="Usuarios"
      description="Quién está registrado y qué rol tiene cada uno."
    >
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o correo…"
            className="h-11 w-full rounded-full border border-neutral-200 bg-white pl-10 pr-4 text-xs font-semibold text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-[#D41F2D] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
          />
        </div>
        <FilterPills
          label="Filtrar usuarios por rol"
          options={ROLE_OPTIONS}
          value={roleFilter}
          onChange={setRoleFilter}
        />
      </div>

      {isLoading ? (
        <AdminLoading />
      ) : users.length === 0 ? (
        <AdminEmpty
          icon={<UserRound size={40} strokeWidth={1.5} className="text-neutral-300 dark:text-neutral-700" />}
          title="Nadie coincide"
          hint="Prueba con otro nombre o quita el filtro de rol."
        />
      ) : (
        <>
          {/* Tarjetas hasta `lg:`. Antes solo había una tabla de seis columnas
              dentro de un `overflow-x-auto`: en el teléfono era scroll lateral
              a ciegas, con el nombre y el selector de rol en extremos opuestos.
              Es el mismo esqueleto de tarjeta que `EventCard`.

              El corte es `lg` y no `md` porque se probó: a 768 px la tabla no
              cabe y la última columna —el selector de rol— quedaba recortada
              por el `overflow` de la tarjeta, o sea inalcanzable. */}
          <div className="flex flex-col gap-3 lg:hidden">
            {users.map((u) => (
              <article
                key={u.id}
                className="flex flex-col gap-3 rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
              >
                <div className="flex items-start gap-3">
                  <UserAvatar name={u.name} src={u.avatar_url} className="h-10 w-10 text-[40px]" />
                  <div className="min-w-0 flex-1">
                    <h3 className="m-0 truncate text-[15px] font-extrabold leading-snug text-neutral-900 dark:text-white">
                      {u.name || 'Sin nombre'}
                    </h3>
                    <p className="m-0 truncate text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      {u.email}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${ROLE_TONE[u.role]}`}
                  >
                    {ROLE_LABEL[u.role]}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  <span className="capitalize">{u.faculty_id || 'Sin facultad'}</span>
                  <span className="text-neutral-300 dark:text-neutral-700">·</span>
                  <span>
                    <strong className="font-bold text-amber-500">{u.karma}</strong> de karma
                  </span>
                </div>

                <div className="border-t border-neutral-100 pt-3 dark:border-neutral-800">
                  <CustomSelect
                    options={ASSIGNABLE}
                    value={u.role}
                    onChange={(next) =>
                      setPendingChange({ user: u, nextRole: next as Role })
                    }
                  />
                </div>
              </article>
            ))}
          </div>

          {/* `overflow-x-auto` y no `hidden`: si en algún ancho la tabla no
              cupiera, se desplaza en vez de recortar la columna de acciones. */}
          <div className="hidden overflow-x-auto rounded-3xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900 lg:block">
            <table className="w-full min-w-[52rem] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/50 text-[10px] font-black uppercase tracking-wider text-neutral-400 dark:border-neutral-800 dark:bg-neutral-800/40">
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Correo</th>
                  <th className="px-4 py-3">Facultad</th>
                  <th className="px-4 py-3">Karma</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3 text-right">Cambiar a</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className="transition-colors hover:bg-neutral-50/60 dark:hover:bg-neutral-800/30"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <UserAvatar name={u.name} src={u.avatar_url} className="h-7 w-7 text-[28px]" />
                        <span className="font-bold text-neutral-900 dark:text-white">
                          {u.name || 'Sin nombre'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-neutral-500 dark:text-neutral-400">
                      {u.email}
                    </td>
                    <td className="px-4 py-3 capitalize text-neutral-600 dark:text-neutral-300">
                      {u.faculty_id || '—'}
                    </td>
                    <td className="px-4 py-3 font-bold text-amber-500">{u.karma}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${ROLE_TONE[u.role]}`}
                      >
                        {ROLE_LABEL[u.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="ml-auto w-40">
                        <CustomSelect
                          options={ASSIGNABLE}
                          value={u.role}
                          onChange={(next) =>
                            setPendingChange({ user: u, nextRole: next as Role })
                          }
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {pendingChange && (
        <ConfirmDialog
          open={Boolean(pendingChange)}
          onOpenChange={(open) => !open && setPendingChange(null)}
          title="Cambiar el rol"
          description={`${pendingChange.user.name || pendingChange.user.email} pasará a ser ${ROLE_LABEL[pendingChange.nextRole].toLowerCase()}.`}
          confirmText="Cambiar"
          onConfirm={() =>
            roleMutation.mutate({
              userId: pendingChange.user.id,
              newRole: pendingChange.nextRole,
            })
          }
        />
      )}
    </AdminScreen>
  )
}
