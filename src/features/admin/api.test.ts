import { describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/lib/supabase', () => ({ supabase: null }))

const { fetchDashboardStats, fetchAdminUsers, adminSetUserRole } = await import('./api')

describe('admin api — modo demo (sin supabase)', () => {
  it('fetchDashboardStats reporta suscriptores push y conteo de usuarios', async () => {
    const stats = await fetchDashboardStats()
    expect(stats.pushSubscribers).toBe(3)
    expect(stats.totalUsers).toBe(4)
    expect(stats.roleCounts.admin).toBe(1)
  })

  it('fetchAdminUsers filtra por rol y búsqueda', async () => {
    const students = await fetchAdminUsers({ role: 'student' })
    expect(students.every((u) => u.role === 'student')).toBe(true)

    const bySearch = await fetchAdminUsers({ search: 'valdes' })
    expect(bySearch.length).toBeGreaterThan(0)
  })

  it('adminSetUserRole actualiza el rol del usuario mock', async () => {
    await adminSetUserRole('demo-student', 'moderator')
    const users = await fetchAdminUsers()
    const target = users.find((u) => u.id === 'demo-student')
    expect(target?.role).toBe('moderator')
  })
})
