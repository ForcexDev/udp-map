import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import type { Role, Profile } from '@/shared/types/database'
import { fetchAdminUsers, adminSetUserRole } from './api'
import { useUIStore } from '@/shared/stores/uiStore'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { UserAvatar } from '@/shared/ui/UserAvatar'
import { FilterPills } from '@/shared/ui/FilterPills'

const ROLE_OPTIONS: readonly { value: Role | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'student', label: 'Student' },
  { value: 'moderator', label: 'Moderator' },
  { value: 'admin', label: 'Admin' },
]

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
    mutationFn: ({ userId, newRole }: { userId: string; newRole: Role }) => adminSetUserRole(userId, newRole),
    onSuccess: () => {
      showToast('Rol de usuario actualizado exitosamente.')
      void queryClient.invalidateQueries({ queryKey: ['admin'] })
      setPendingChange(null)
    },
    onError: (err) => showToast(err instanceof Error ? err.message : 'Error al actualizar el rol.'),
  })

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o correo UDP…"
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder:text-neutral-400 outline-none focus:border-[#D41F2D]"
          />
        </div>

        {/* Role Filters */}
        <FilterPills
          label="Filtrar usuarios por rol"
          options={ROLE_OPTIONS}
          value={roleFilter}
          onChange={setRoleFilter}
          className="w-full sm:w-auto"
        />
      </div>

      {/* Users Table */}
      {isLoading ? (
        <div className="py-12 text-center text-xs font-bold text-neutral-400">Cargando lista de usuarios…</div>
      ) : users.length === 0 ? (
        <div className="py-12 text-center text-xs font-bold text-neutral-400 rounded-2xl border border-dashed border-neutral-200 dark:border-neutral-800">
          No se encontraron usuarios con ese criterio.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40 text-neutral-400 font-extrabold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Usuario</th>
                <th className="py-3 px-4">Correo UDP</th>
                <th className="py-3 px-4">Facultad</th>
                <th className="py-3 px-4">Karma</th>
                <th className="py-3 px-4">Rol Actual</th>
                <th className="py-3 px-4 text-right">Acciones de Rol</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/30 transition-colors">
                  <td className="py-3 px-4 font-bold text-neutral-900 dark:text-white flex items-center gap-2.5">
                    <UserAvatar name={u.name} src={u.avatar_url} className="w-7 h-7 text-[28px]" />
                    <span>{u.name || 'Sin nombre'}</span>
                  </td>
                  <td className="py-3 px-4 text-neutral-500 dark:text-neutral-400 font-mono">{u.email}</td>
                  <td className="py-3 px-4 text-neutral-600 dark:text-neutral-300 capitalize">{u.faculty_id || '—'}</td>
                  <td className="py-3 px-4 font-bold text-amber-500">{u.karma}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      u.role === 'admin' ? 'bg-red-100 text-[#D41F2D] dark:bg-red-950/50' :
                      u.role === 'moderator' ? 'bg-blue-100 text-blue-600 dark:bg-blue-950/50' :
                      'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <select
                      value={u.role}
                      onChange={(e) => setPendingChange({ user: u, nextRole: e.target.value as Role })}
                      className="text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-lg px-2 py-1 font-semibold border-0 outline-none cursor-pointer"
                    >
                      <option value="student">Estudiante</option>
                      <option value="moderator">Moderador</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirmation Dialog */}
      {pendingChange && (
        <ConfirmDialog
          open={Boolean(pendingChange)}
          onOpenChange={(open) => !open && setPendingChange(null)}
          title="Confirmar cambio de rol"
          description={`¿Estás seguro de cambiar el rol de ${pendingChange.user.name || pendingChange.user.email} a "${pendingChange.nextRole.toUpperCase()}"?`}
          onConfirm={() => roleMutation.mutate({ userId: pendingChange.user.id, newRole: pendingChange.nextRole })}
        />
      )}
    </div>
  )
}
