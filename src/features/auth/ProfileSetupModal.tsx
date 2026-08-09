import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { GraduationCap, MapPin } from 'lucide-react'
import { useAuthStore } from './authStore'
import { useUIStore } from '@/shared/stores/uiStore'
import { Dialog } from '@/shared/ui/Dialog'
import { Button } from '@/shared/ui/Button'
import { CustomSelect } from '@/shared/ui/CustomSelect'
import { CAREERS, academicFaculties } from '@/shared/data/campusData'
import { useFaculties } from '@/shared/data/facultyStore'

export function ProfileSetupModal() {
  const { t, i18n } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const updateProfile = useAuthStore((s) => s.updateProfile)
  const setCampusId = useUIStore((s) => s.setCampusId)

  // Show if logged in but faculty is missing
  const open = !!user && user.faculty_id === null

  const [facultyId, setFacultyId] = useState<string>('')
  const [career, setCareer] = useState<string>('')
  const [loading, setLoading] = useState(false)

  // Filter careers by selected faculty
  const availableCareers = useMemo(() => {
    if (!facultyId) return []
    return CAREERS.filter(c => c.faculty_id === facultyId)
  }, [facultyId])

  const faculties = useFaculties()
  const selectableFaculties = useMemo(() => academicFaculties(faculties), [faculties])

  const handleSave = async () => {
    if (!facultyId || (!career && availableCareers.length > 0)) return
    setLoading(true)
    try {
      await updateProfile(facultyId, career)
      
      // Update map campus
      const faculty = faculties.find(f => f.id === facultyId)
      if (faculty) {
        setCampusId(faculty.campus_id)
        // Fly map to faculty
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent('faculty-flyto', { detail: { lat: faculty.lat, lng: faculty.lng } })
          )
        }, 300)
      }
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <Dialog
      open={open}
      onOpenChange={() => {}} 
      hideClose={true} // Bloquear cerrado accidental (obligatorio)
      title={t('auth.setupProfile', 'Configura tu Perfil')}
      description={t('auth.setupProfileDesc', 'Cuéntanos de qué facultad eres para personalizar tu experiencia.')}
      contentClassName="!bg-white dark:!bg-neutral-900 sm:max-w-md shadow-2xl rounded-2xl"
    >
      <div className="flex flex-col gap-5 py-2">
        
        {/* Facultad */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <MapPin size={16} className="text-[#D41F2D]" />
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

      <div className="mt-6 flex flex-col gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
        <Button 
          onClick={handleSave} 
          disabled={!facultyId || (!career && availableCareers.length > 0) || loading}
          className="w-full bg-[#D41F2D] hover:bg-[#b11a25] text-white rounded-full py-2.5 font-bold uppercase tracking-wider text-xs"
        >
          {loading ? t('common.saving', 'Guardando...') : t('common.save', 'Guardar y Continuar')}
        </Button>
      </div>
    </Dialog>
  )
}
