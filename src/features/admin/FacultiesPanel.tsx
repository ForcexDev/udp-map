import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, ImageOff, PenTool, Shapes } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Faculty } from '@/shared/types/database'
import { fetchFaculties, upsertFaculty } from '@/shared/data/facultiesApi'
import { publishFaculties } from '@/shared/data/facultyStore'
import { FACULTIES_QUERY_KEY } from '@/shared/data/useFaculties'
import { CAMPUSES } from '@/shared/data/campusData'
import { useUIStore } from '@/shared/stores/uiStore'
import { Dialog } from '@/shared/ui/Dialog'
import { CustomSelect } from '@/shared/ui/CustomSelect'
import { AdminEmpty, AdminError, AdminLoading, AdminScreen } from './AdminScreen'

// ─────────────────────────────────────────────────────────────────────────────
// Los datos de una facultad.
//
// Existían solo dentro de `/admin/mapeo`, que es una herramienta de trazado y
// exige un computador. Corregir una tilde en el nombre de una facultad obligaba
// a sentarse delante de un escritorio y abrir el editor de polígonos. Aquí están
// los datos, y nada más que los datos.
//
// ⚠️ `upsertFaculty` recibe el registro ENTERO, `polygon`, `lat` y `lng`
// incluidos. Este formulario NO los expone y los reenvía tal cual venían de la
// base. Mandar `polygon: null` borraría el perímetro, y los perímetros viven
// SOLO en la base: no hay copia en el repositorio de la que recuperarlos. Ya se
// perdieron una vez (ver CLAUDE.md). El centroide tampoco se toca aquí: sale
// del perímetro y lo recalcula el editor.
// ─────────────────────────────────────────────────────────────────────────────

const CAMPUS_OPTIONS = CAMPUSES.map((c) => ({ value: c.id, label: c.name }))

export function FacultiesPanel() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const showToast = useUIStore((s) => s.showToast)
  const [editing, setEditing] = useState<Faculty | null>(null)

  const { data: faculties = [], isLoading, error } = useQuery({
    queryKey: FACULTIES_QUERY_KEY,
    queryFn: fetchFaculties,
  })

  const save = useMutation({
    mutationFn: (values: Faculty) =>
      upsertFaculty({
        id: values.id,
        name: values.name,
        name_en: values.name_en,
        campus_id: values.campus_id,
        image: values.image,
        // Los tres que este formulario no edita y tiene que devolver intactos.
        lat: values.lat,
        lng: values.lng,
        polygon: values.polygon,
      }),
    onSuccess: async () => {
      showToast('Facultad actualizada.')
      setEditing(null)
      // El catálogo vive además en una caché de módulo que leen los ~26
      // archivos que hacen `FACULTIES.find(...)`. Sin republicarlo, el mapa
      // seguiría enseñando el nombre viejo hasta recargar.
      const rows = await queryClient.fetchQuery({
        queryKey: FACULTIES_QUERY_KEY,
        queryFn: fetchFaculties,
      })
      publishFaculties(rows)
    },
    onError: (err) =>
      showToast(err instanceof Error ? err.message : 'No se pudo guardar la facultad.'),
  })

  const campusName = (id: string) => CAMPUSES.find((c) => c.id === id)?.name ?? id

  return (
    <AdminScreen
      title={t('admin.sections.faculties')}
      description={t('admin.sections.facultiesHint')}
    >
      {isLoading ? (
        <AdminLoading />
      ) : error ? (
        <AdminError message={t('admin.facultiesFailed')} />
      ) : faculties.length === 0 ? (
        <AdminEmpty
          icon={<Building2 size={40} strokeWidth={1.5} className="text-neutral-300 dark:text-neutral-700" />}
          title={t('admin.noFaculties')}
          hint={t('admin.noFacultiesHint')}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {faculties.map((faculty) => (
            <button
              key={faculty.id}
              type="button"
              onClick={() => setEditing(faculty)}
              className="group flex flex-col gap-3 rounded-3xl border border-neutral-200 bg-white p-4 text-left shadow-sm transition-all hover:shadow-md active:scale-[0.99] dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div className="flex items-start gap-3">
                {faculty.image ? (
                  <img
                    src={faculty.image}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-2xl object-cover"
                  />
                ) : (
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-neutral-100 text-neutral-300 dark:bg-neutral-800 dark:text-neutral-600">
                    <ImageOff size={20} />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-extrabold leading-snug text-neutral-900 transition-colors group-hover:text-[#D41F2D] dark:text-white">
                    {faculty.name}
                  </span>
                  <span className="mt-0.5 block truncate text-xs font-medium text-neutral-400">
                    {faculty.name_en}
                  </span>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-neutral-100 pt-3 text-[11px] font-medium text-neutral-400 dark:border-neutral-800">
                <span>{campusName(faculty.campus_id)}</span>
                <span className="text-neutral-300 dark:text-neutral-700">·</span>
                {/* Que un perímetro esté sin trazar es un dato, no un fallo:
                    significa que esa facultad no captura pines ni se puede
                    mapear por dentro. */}
                <span
                  className={`flex items-center gap-1 ${
                    faculty.polygon ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-500'
                  }`}
                >
                  <Shapes size={11} />
                  {faculty.polygon ? 'Con perímetro' : 'Sin trazar'}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      <FacultyDialog
        faculty={editing}
        saving={save.isPending}
        onClose={() => setEditing(null)}
        onSave={(values) => save.mutate(values)}
      />
    </AdminScreen>
  )
}

interface FacultyDialogProps {
  faculty: Faculty | null
  saving: boolean
  onClose: () => void
  onSave: (values: Faculty) => void
}

function FacultyDialog({ faculty, saving, onClose, onSave }: FacultyDialogProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<Faculty | null>(null)
  // El borrador se siembra con la facultad que se acaba de abrir. `key` en el
  // Dialog fuerza el remontaje, que es más simple que sincronizar con efectos.
  const values = draft ?? faculty

  if (!faculty || !values) return null

  return (
    <Dialog
      key={faculty.id}
      open
      onOpenChange={(open) => {
        if (!open) {
          setDraft(null)
          onClose()
        }
      }}
      title={faculty.name}
      description={t('admin.facultyEditHint')}
      contentClassName="!bg-white dark:!bg-neutral-900"
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          onSave(values)
        }}
      >
        <Field label={t('admin.fieldName')}>
          <input
            value={values.name}
            onChange={(e) => setDraft({ ...values, name: e.target.value })}
            required
            className={INPUT}
          />
        </Field>

        <Field label={t('admin.fieldNameEn')}>
          <input
            value={values.name_en}
            onChange={(e) => setDraft({ ...values, name_en: e.target.value })}
            required
            className={INPUT}
          />
        </Field>

        <Field label={t('admin.fieldCampus')}>
          <CustomSelect
            options={CAMPUS_OPTIONS}
            value={values.campus_id}
            onChange={(next) => setDraft({ ...values, campus_id: next })}
          />
        </Field>

        <Field label={t('admin.fieldImage')}>
          <input
            value={values.image ?? ''}
            onChange={(e) => setDraft({ ...values, image: e.target.value.trim() || null })}
            placeholder="https://…"
            className={INPUT}
          />
        </Field>

        <div className="flex items-center gap-2 rounded-xl bg-neutral-50 p-3 text-[11px] font-medium leading-snug text-neutral-500 dark:bg-neutral-800/50 dark:text-neutral-400">
          <PenTool size={14} className="shrink-0 text-neutral-400" />
          <span>
            ¿Hay que corregir el contorno?{' '}
            <Link
              to="/admin/mapeo"
              className="font-bold text-[#D41F2D] underline decoration-[#D41F2D]/30 underline-offset-2"
            >
              Editor de mapeo
            </Link>
          </span>
        </div>

        <div className="flex justify-end gap-2 border-t border-neutral-100 pt-3 dark:border-neutral-800">
          <button
            type="button"
            onClick={() => {
              setDraft(null)
              onClose()
            }}
            className="rounded-full px-5 py-2.5 text-xs font-bold text-neutral-500 transition-all hover:bg-neutral-100 active:scale-95 dark:hover:bg-neutral-800"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-[#D41F2D] px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition-all hover:bg-[#b11a25] active:scale-95 disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

const INPUT =
  'h-11 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 text-sm font-semibold text-neutral-900 outline-none transition-colors placeholder:font-medium placeholder:text-neutral-400 focus:border-[#D41F2D] focus:bg-white dark:border-neutral-700/80 dark:bg-neutral-800/60 dark:text-white dark:focus:bg-neutral-900'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-neutral-400">
        {label}
      </span>
      {children}
    </label>
  )
}
