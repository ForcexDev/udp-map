
import { useState, useRef, FC, useMemo } from 'react';
import { CATEGORIES, FACULTIES } from '../config/constants';
import { CategoryId, User } from '../config/types';
import { X, ArrowRight, MapPin, Sparkles, Camera, Image as ImageIcon, Loader2, Trash2 } from 'lucide-react';
import { uploadImage } from '../services/supabaseService';
import { isPointInPolygon } from '../utils/mapUtils';
import { Lang, t, catLabel, facName } from '../i18n';

interface AddPostModalProps {
  user: User;
  coords: { lat: number, lng: number };
  facultyId: string;
  lang: Lang;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

const AddPostModal: FC<AddPostModalProps> = ({ user, coords, facultyId: initialFacultyId, lang, onClose, onSubmit }) => {
  const detectedFacultyId = useMemo(() => {
    const match = FACULTIES.find(f => f.polygon && isPointInPolygon(coords, f.polygon));
    if (match) return match.id;
    return initialFacultyId !== 'global' ? initialFacultyId : 'global';
  }, [coords, initialFacultyId]);

  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [cat, setCat] = useState<CategoryId>('custom');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const detectedFac = FACULTIES.find(f => f.id === detectedFacultyId);
  const detectedFacultyName = detectedFac ? facName(detectedFac, lang) : 'Campus Diego Portales';

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isUploading) return;

    setIsUploading(true);
    try {
      let imageUrl = '';
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      onSubmit({
        title,
        description: desc,
        categoryId: cat,
        lat: coords.lat,
        lng: coords.lng,
        facultyId: detectedFacultyId,
        creatorId: user.id,
        creatorName: user.name,
        createdAt: Date.now(),
        votesUp: 0,
        votesDown: 0,
        reports: 0,
        image: imageUrl
      });
    } catch (err) {
      console.error("Upload error:", err);
      alert(t('addUploadError', lang));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-md px-0 sm:px-4 antialiased">
      <form
        onSubmit={handleSubmit}
        className="w-full h-full sm:h-auto sm:max-h-[85vh] sm:max-w-[540px] bg-white rounded-t-[40px] sm:rounded-[32px] flex flex-col animate-modal-in shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)] relative overflow-hidden mx-auto"
      >
        <div className="px-8 pt-12 pb-6 border-b border-zinc-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={onClose}
              className="w-14 h-14 flex items-center justify-center bg-zinc-50 rounded-2xl text-zinc-900 active:scale-90 transition-all border border-zinc-100 shadow-sm"
            >
              <X size={26} strokeWidth={2.5} />
            </button>
            <div className="flex flex-col">
              <h3 className="text-2xl font-black text-zinc-900 tracking-tight leading-none mb-1">{t('addTitle', lang)}</h3>
              <p className="text-[11px] font-black text-[#D41F2D] uppercase tracking-[0.2em]">{detectedFacultyName}</p>
            </div>
          </div>
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center text-[#D41F2D]">
            <MapPin size={28} strokeWidth={2.5} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-10 space-y-12 bg-white no-scrollbar">

          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Sparkles size={18} className="text-[#D41F2D]" strokeWidth={2.5} />
              <label className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em]">{t('addMainInfo', lang)}</label>
            </div>
            <div className="space-y-2">
              <input
                autoFocus
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={t('addTitlePlaceholder', lang)}
                className="w-full text-3xl font-black text-zinc-900 placeholder:text-zinc-200 bg-transparent border-none outline-none focus:ring-0 p-0 tracking-tighter"
                autoComplete="off"
              />
              <div className="h-1 w-full bg-zinc-50 rounded-full overflow-hidden">
                <div className={`h-full bg-[#D41F2D] transition-all duration-1000 ease-out ${title.length > 0 ? 'w-full' : 'w-0'}`}></div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <label className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">{t('addPhoto', lang)}</label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-32 bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-3xl flex flex-col items-center justify-center gap-3 text-zinc-400 hover:border-[#D41F2D] hover:text-[#D41F2D] transition-all overflow-hidden relative"
              >
                {imagePreview ? (
                  <>
                    <img src={imagePreview} className="absolute inset-0 w-full h-full object-cover" alt="Preview" />
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px] opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Trash2 size={24} className="text-white" onClick={(e) => { e.stopPropagation(); removeImage(); }} />
                    </div>
                  </>
                ) : (
                  <>
                    <Camera size={32} strokeWidth={1.5} />
                    <span className="text-[10px] font-black uppercase tracking-widest">{t('addCapture', lang)}</span>
                  </>
                )}
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageChange}
                accept="image/*"
                capture="environment"
                className="hidden"
              />
            </div>
          </div>

          <div className="space-y-6">
            <label className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">{t('addCategory', lang)}</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {CATEGORIES.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCat(c.id)}
                  className={`flex flex-col items-center gap-3 p-5 rounded-[24px] border-2 transition-all ${cat === c.id
                    ? 'bg-red-50 border-[#D41F2D] shadow-lg shadow-red-500/10 scale-[1.02]'
                    : 'bg-zinc-50/50 border-transparent hover:border-zinc-100'
                    }`}
                >
                  <div
                    className={`w-11 h-11 rounded-[16px] flex items-center justify-center shrink-0 transition-all ${cat === c.id ? 'bg-[#D41F2D] text-white shadow-lg' : 'bg-white text-zinc-400 border border-zinc-100'
                      }`}
                  >
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d={c.svgPath} /></svg>
                  </div>
                  <span className={`text-[9px] font-black uppercase tracking-widest text-center leading-none ${cat === c.id ? 'text-[#D41F2D]' : 'text-zinc-500'}`}>
                    {catLabel(c, lang)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-6 pb-20">
            <label className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">{t('addNotes', lang)}</label>
            <textarea
              rows={3}
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder={t('addNotesPlaceholder', lang)}
              className="w-full bg-zinc-50/70 border border-zinc-100 rounded-3xl px-6 py-5 text-sm font-bold text-zinc-800 placeholder:text-zinc-300 outline-none focus:ring-4 focus:ring-red-500/5 transition-all resize-none shadow-sm"
            />
          </div>
        </div>

        <div className="p-8 bg-white border-t border-zinc-50 shrink-0 mb-safe">
          <button
            type="submit"
            disabled={!title.trim() || isUploading}
            className="w-full h-16 py-4 bg-[#D41F2D] text-white rounded-[20px] font-black uppercase text-xs tracking-[0.25em] shadow-[0_20px_40px_-10px_rgba(212,31,45,0.4)] transition-all active:scale-95 flex items-center justify-center gap-4 disabled:opacity-20 disabled:grayscale"
          >
            {isUploading ? <Loader2 size={22} className="animate-spin" /> : t('addSubmit', lang)}
            {!isUploading && <ArrowRight size={22} strokeWidth={3} />}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddPostModal;
