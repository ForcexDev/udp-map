import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GraduationCap, MapPin, UserRound } from 'lucide-react'
import { useAuthStore } from '@/features/auth/authStore'
import { useUIStore } from '@/shared/stores/uiStore'
import { Dialog } from '@/shared/ui/Dialog'
import { Button } from '@/shared/ui/Button'
import { CustomSelect } from '@/shared/ui/CustomSelect'
import { FACULTIES, CAREERS } from '@/shared/data/campusData'

interface EditProfileModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditProfileModal({ open, onOpenChange }: EditProfileModalProps) {
  const { t, i18n } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const updateProfile = useAuthStore((s) => s.updateProfile)
  const showToast = useUIStore((s) => s.showToast)

  const [name, setName] = useState('')
  const [facultyId, setFacultyId] = useState('')
  const [career, setCareer] = useState('')
  const [loading, setLoading] = useState(false)

  // Precargar el formulario con los datos actuales cada vez que se abre.
  useEffect(() => {
    if (open && user) {
      const fid = user.faculty_id ?? ''
      const validCareer = CAREERS.some((c) => c.faculty_id === fid && c.name === user.career)
      setName(user.name)
      setFacultyId(fid)
      setCareer(validCareer && user.career ? user.career : '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const availableCareers = useMemo(() => {
    if (!facultyId) return []
    return CAREERS.filter((c) => c.faculty_id === facultyId)
  }, [facultyId])

  const academicFaculties = useMemo(() => {
    const validIds = new Set(CAREERS.map((c) => c.faculty_id))
    return FACULTIES.filter((f) => validIds.has(f.id))
  }, [])

  const canSave =
    name.trim().length >= 2 && !!facultyId && (!!career || availableCareers.length === 0)

  const handleSave = async () => {
    if (!canSave) return
    setLoading(true)
    try {
      await updateProfile(facultyId, career, name)
      showToast(t('profile.updated'))
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  const fieldClass =
    'w-full p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700/80 text-sm font-semibold focus:outline-none focus:border-[#D41F2D] focus:bg-white dark:focus:bg-neutral-900 transition-all shadow-sm'

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('profile.editProfile')}
      description={t('profile.editProfileDesc')}
      contentClassName="!bg-white dark:!bg-neutral-900 sm:max-w-md shadow-2xl rounded-2xl ultra-lock-h overflow-x-hidden max-w-full overscroll-x-none touch-pan-y"
    >
      <div className="flex flex-col gap-5 py-2 ultra-lock-h overflow-x-hidden max-w-full overscroll-x-none touch-pan-y">
        {/* Nombre */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <UserRound size={16} className="text-[#D41F2D]" />
            {t('profile.name')}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('profile.namePlaceholder')}
            maxLength={60}
            className={fieldClass}
          />
        </div>

        {/* Facultad */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <MapPin size={16} className="text-[#D41F2D]" />
            {t('auth.faculty', 'Facultad')}
          </label>
          <CustomSelect
            options={academicFaculties.map((f) => ({
              value: f.id,
              label: i18n.language === 'en' ? f.name_en : f.name,
            }))}
            value={facultyId}
            onChange={(val) => {
              setFacultyId(val)
              setCareer('')
            }}
            placeholder={t('auth.selectFaculty', 'Selecciona tu facultad')}
            className="w-full"
          />
        </div>

        {/* Carrera */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <GraduationCap size={16} className="text-[#D41F2D]" />
            {t('auth.career', 'Carrera')}
          </label>
          <CustomSelect
            options={availableCareers.map((c) => ({
              value: c.name,
              label: i18n.language === 'en' ? c.name_en : c.name,
            }))}
            value={career}
            onChange={(val) => setCareer(val)}
            placeholder={
              !facultyId
                ? t('auth.careerRequiresFaculty', 'Primero selecciona una facultad')
                : availableCareers.length === 0
                  ? t('auth.noCareers', 'No hay carreras registradas')
                  : t('auth.selectCareer', 'Selecciona tu carrera')
            }
            className="w-full"
          />
        </div>
      </div>

      <div className="mt-6 flex gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
        <Button variant="secondary" onClick={() => onOpenChange(false)} className="flex-1 rounded-full">
          {t('common.cancel')}
        </Button>
        <Button onClick={handleSave} disabled={!canSave || loading} className="flex-1 bg-[#D41F2D] hover:bg-[#b11a25] text-white rounded-full">
          {loading ? t('common.saving', 'Guardando...') : t('common.save', 'Guardar')}
        </Button>
      </div>
    </Dialog>
  )
}
