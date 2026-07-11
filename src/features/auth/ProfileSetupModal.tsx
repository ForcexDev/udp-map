import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { GraduationCap, MapPin } from 'lucide-react'
import { useAuthStore } from './authStore'
import { useUIStore } from '@/shared/stores/uiStore'
import { Dialog } from '@/shared/ui/Dialog'
import { Button } from '@/shared/ui/Button'
import { FACULTIES, CAREERS } from '@/shared/data/campusData'

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

  const handleSave = async () => {
    if (!facultyId || (!career && availableCareers.length > 0)) return
    setLoading(true)
    try {
      await updateProfile(facultyId, career)
      
      // Update map campus
      const faculty = FACULTIES.find(f => f.id === facultyId)
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
    >
      <div className="flex flex-col gap-5 py-2">
        
        {/* Facultad */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <MapPin size={16} className="text-[#D41F2D]" />
            {t('auth.faculty', 'Facultad')}
          </label>
          <select
            value={facultyId}
            onChange={(e) => {
              setFacultyId(e.target.value)
              setCareer('') // Reset career on faculty change
            }}
            className="w-full p-3 rounded-[14px] bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-sm font-medium focus:outline-none focus:border-[#D41F2D] transition-colors"
          >
            <option value="" disabled>{t('auth.selectFaculty', 'Selecciona tu facultad')}</option>
            {FACULTIES.map(f => (
              <option key={f.id} value={f.id}>
                {i18n.language === 'en' ? f.name_en : f.name}
              </option>
            ))}
          </select>
        </div>

        {/* Carrera */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <GraduationCap size={16} className="text-[#D41F2D]" />
            {t('auth.career', 'Carrera')}
          </label>
          <select
            value={career}
            onChange={(e) => setCareer(e.target.value)}
            disabled={!facultyId || availableCareers.length === 0}
            className="w-full p-3 rounded-[14px] bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-sm font-medium focus:outline-none focus:border-[#D41F2D] transition-colors disabled:opacity-50"
          >
            <option value="" disabled>
              {!facultyId 
                ? t('auth.careerRequiresFaculty', 'Primero selecciona una facultad')
                : availableCareers.length === 0 
                  ? t('auth.noCareers', 'No hay carreras registradas')
                  : t('auth.selectCareer', 'Selecciona tu carrera')
              }
            </option>
            {availableCareers.map(c => (
              <option key={c.name} value={c.name}>
                {i18n.language === 'en' ? c.name_en : c.name}
              </option>
            ))}
          </select>
        </div>

      </div>

      <div className="mt-6 flex flex-col gap-2">
        <Button 
          onClick={handleSave} 
          disabled={!facultyId || (!career && availableCareers.length > 0) || loading}
          className="w-full"
        >
          {loading ? t('common.saving', 'Guardando...') : t('common.save', 'Guardar y Continuar')}
        </Button>
      </div>
    </Dialog>
  )
}
