import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GraduationCap, MapPin, UserRound } from 'lucide-react'
import { useAuthStore } from '@/features/auth/authStore'
import { useUIStore } from '@/shared/stores/uiStore'
import { Dialog } from '@/shared/ui/Dialog'
import { Button } from '@/shared/ui/Button'
import { CustomSelect } from '@/shared/ui/CustomSelect'
import { CAREERS, academicFaculties } from '@/shared/data/campusData'
import { useFaculties } from '@/shared/data/facultyStore'

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

  const faculties = useFaculties()
  const selectableFaculties = useMemo(() => academicFaculties(faculties), [faculties])

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
    'w-full p-3 rounded-2xl bg-[#FAF8F5] dark:bg-[#151820] border border-[#E6E0D5] dark:border-white/[0.07] text-sm font-semibold text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:border-[#C22B38] dark:focus:border-[#D93846] focus:bg-white dark:focus:bg-[#1E222D] transition-all shadow-sm'

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('profile.editProfile')}
      description={t('profile.editProfileDesc')}
      contentClassName="!bg-white dark:!bg-[#1E222D] sm:max-w-md shadow-2xl rounded-3xl border border-[#E6E0D5] dark:border-white/[0.07] overflow-x-hidden max-w-full overscroll-x-none touch-pan-y"
    >
      <div className="flex flex-col gap-5 py-2 overflow-x-hidden max-w-full overscroll-x-none touch-pan-y">
        {/* Nombre */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <UserRound size={16} className="text-[#C22B38] dark:text-[#D93846]" />
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
          <label className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <MapPin size={16} className="text-[#C22B38] dark:text-[#D93846]" />
            {t('auth.faculty', 'Facultad')}
          </label>
          <CustomSelect
            options={selectableFaculties.map((f) => ({
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
          <label className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <GraduationCap size={16} className="text-[#C22B38] dark:text-[#D93846]" />
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

      <div className="mt-6 flex gap-2 pt-3 border-t border-[#E6E0D5] dark:border-white/[0.07]">
        <Button variant="secondary" onClick={() => onOpenChange(false)} className="flex-1 rounded-2xl">
          {t('common.cancel')}
        </Button>
        <Button onClick={handleSave} disabled={!canSave || loading} className="flex-1 bg-[#C22B38] hover:bg-[#a8242f] dark:bg-[#D93846] dark:hover:bg-[#c22b38] text-white rounded-2xl">
          {loading ? t('common.saving', 'Guardando...') : t('common.save', 'Guardar')}
        </Button>
      </div>
    </Dialog>
  )
}
