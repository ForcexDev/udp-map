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
      contentClassName="!bg-[#FAF8F5] dark:!bg-[#151820] sm:max-w-md border border-[#E5DEC9] dark:border-white/10 rounded-3xl premium-shadow"
    >
      <div className="flex flex-col gap-5 py-2">
        
        {/* Facultad */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
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
          <label className="text-sm font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
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

      <div className="mt-6 flex flex-col gap-2 pt-3 border-t border-[#E5DEC9] dark:border-white/10">
        <Button 
          onClick={handleSave} 
          disabled={!facultyId || (!career && availableCareers.length > 0) || loading}
          className="w-full bg-[#C22B38] hover:bg-[#A82430] dark:bg-[#D93846] dark:hover:bg-[#C22B38] text-white rounded-2xl py-3 text-sm font-semibold shadow-xs transition-opacity"
        >
          {loading ? t('common.saving', 'Guardando...') : t('common.save', 'Guardar y Continuar')}
        </Button>
      </div>
    </Dialog>
  )
}
