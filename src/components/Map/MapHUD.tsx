import { FC } from 'react';
import { User, Faculty } from '../../config/types';
import { MessageSquare, Navigation, Plus, MapPin, Check, ShieldAlert, LogIn } from 'lucide-react';
import { Lang, t, facName } from '../../i18n';

interface MapHUDProps {
    user: User;
    lang: Lang;
    currentCampus: { name: string };
    campusFaculties: Faculty[];
    activeFacultyId: string;
    isPlacingMode: boolean;
    isAnonymous?: boolean;
    onSidebarOpen: () => void;
    onFacultySelect: (fac: Faculty) => void;
    onLocateUser: () => void;
    onStartPlacing: () => void;
    onCancelPlacement: () => void;
    onConfirmPlacement: () => void;
    onLogin?: () => void;
}

const MapHUD: FC<MapHUDProps> = ({
    user,
    lang,
    currentCampus,
    campusFaculties,
    activeFacultyId,
    isPlacingMode,
    isAnonymous = false,
    onSidebarOpen,
    onFacultySelect,
    onLocateUser,
    onStartPlacing,
    onCancelPlacement,
    onConfirmPlacement,
    onLogin
}) => {
    return (
        <>
            {/* PLACEMENT RETICLE */}
            {isPlacingMode && (
                <div className="absolute inset-0 z-[500] pointer-events-none flex items-center justify-center">
                    <div className="relative flex flex-col items-center mb-10">
                        {/* Floating pin */}
                        <div className="reticle-float flex flex-col items-center">
                            <div className="w-12 h-12 bg-[#D41F2D] rounded-full flex items-center justify-center border-[3px] border-white shadow-[0_8px_32px_rgba(212,31,45,0.45)]">
                                <Plus size={24} className="text-white" strokeWidth={2.5} />
                            </div>
                            <div className="w-[3px] h-6 bg-gradient-to-b from-[#D41F2D] to-transparent rounded-full -mt-0.5"></div>
                        </div>
                        {/* Ground pulse ring */}
                        <div className="relative w-8 h-2 -mt-0.5">
                            <div className="absolute inset-0 bg-[#D41F2D] rounded-full opacity-20 blur-[3px]"></div>
                            <div className="absolute inset-[-4px] bg-[#D41F2D] rounded-full reticle-pulse-ring"></div>
                        </div>
                    </div>
                </div>
            )}

            {/* TOP HUD */}
            {!isPlacingMode && (
                <div className="absolute top-0 left-0 right-0 z-[1001] pointer-events-none p-4 sm:p-6 flex flex-col gap-3">
                    {/* Top Bar */}
                    <div className="flex items-center justify-between w-full pointer-events-auto">
                        <div className="glass-hud h-12 px-3.5 rounded-2xl premium-shadow flex items-center gap-2.5 border border-white/50">
                            <div className="w-8 h-8 rounded-xl bg-[#D41F2D] flex items-center justify-center font-black text-white shadow-lg shadow-red-500/25 text-sm">
                                {user.isAdmin ? <ShieldAlert size={16} /> : 'U'}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[8px] font-extrabold text-zinc-400 uppercase tracking-widest leading-none mb-0.5">
                                    {user.role === 'admin' ? t('hudAdmin', lang) : user.role === 'guest' ? t('hudGuest', lang) : t('hudCampus', lang)}
                                </span>
                                <span className="text-[12px] font-extrabold text-zinc-900 tracking-tight leading-none">{currentCampus.name}</span>
                            </div>
                        </div>

                        <button
                            onClick={isAnonymous ? onLogin : onSidebarOpen}
                            className={`w-12 h-12 rounded-2xl premium-shadow flex items-center justify-center border transition-transform active:scale-90 ${isAnonymous ? 'bg-[#D41F2D] border-red-700' : 'glass-hud border-white/50'}`}
                        >
                            {isAnonymous
                                ? <LogIn size={20} className="text-white" strokeWidth={2.5} />
                                : <MessageSquare size={20} className="text-zinc-700" strokeWidth={2.5} />
                            }
                        </button>
                    </div>

                    {/* Faculty Photo Cards */}
                    <div className="faculty-scroll pointer-events-auto px-0.5">
                        {campusFaculties.map(f => (
                            <button
                                key={f.id}
                                onClick={() => onFacultySelect(f)}
                                className={`faculty-card ${activeFacultyId === f.id ? 'active' : ''}`}
                                style={{ width: '100px', height: '72px' }}
                            >
                                {/* Background Image */}
                                {f.image ? (
                                    <img
                                        src={f.image}
                                        alt={facName(f, lang)}
                                        className="absolute inset-0 w-full h-full object-cover"
                                        loading="lazy"
                                    />
                                ) : (
                                    <div className="absolute inset-0 bg-gradient-to-br from-zinc-200 to-zinc-300"></div>
                                )}
                                {/* Overlay */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
                                {/* Label */}
                                <div className="absolute bottom-0 left-0 right-0 p-2">
                                    <span className="text-[9px] font-extrabold text-white leading-tight line-clamp-2 drop-shadow-lg">
                                        {facName(f, lang)}
                                    </span>
                                </div>
                                {/* Active Indicator */}
                                {activeFacultyId === f.id && (
                                    <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-[#D41F2D] rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                                        <Check size={10} className="text-white" strokeWidth={4} />
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div >
            )}

            {/* FABs */}
            {
                !isPlacingMode && (
                    <div className="absolute bottom-8 right-5 flex flex-col gap-3 z-[1001]">
                        <button
                            onClick={onLocateUser}
                            className="w-12 h-12 bg-white rounded-2xl premium-shadow flex items-center justify-center border border-zinc-100 transition-transform active:scale-90"
                        >
                            <Navigation size={22} className="text-zinc-800" strokeWidth={2.5} />
                        </button>

                        {user.role !== 'guest' && (
                            <button
                                onClick={onStartPlacing}
                                className="w-14 h-14 bg-[#D41F2D] text-white rounded-2xl red-shadow flex items-center justify-center transition-transform active:scale-90 border-[3px] border-white"
                            >
                                <Plus size={32} strokeWidth={3} />
                            </button>
                        )}
                    </div>
                )
            }

            {/* ANONYMOUS BOTTOM BANNER */}
            {isAnonymous && !isPlacingMode && (
                <div className="absolute bottom-8 left-5 right-5 z-[1001] pointer-events-auto">
                    <button
                        onClick={onLogin}
                        className="w-full glass-hud border border-white/50 rounded-[22px] premium-shadow px-5 py-4 flex items-center gap-4 active:scale-[0.98] transition-transform"
                    >
                        <div className="w-10 h-10 bg-[#D41F2D] rounded-xl flex items-center justify-center shrink-0">
                            <LogIn size={18} className="text-white" strokeWidth={2.5} />
                        </div>
                        <div className="flex flex-col items-start text-left">
                            <span className="text-[12px] font-black text-zinc-900 leading-tight">{t('anonBannerText', lang)}</span>
                            <span className="text-[10px] font-extrabold text-[#D41F2D] uppercase tracking-wider mt-0.5">{t('anonBannerBtn', lang)}</span>
                        </div>
                        <div className="ml-auto w-8 h-8 bg-zinc-100 rounded-xl flex items-center justify-center shrink-0">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" className="text-zinc-500">
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                        </div>
                    </button>
                </div>
            )}

            {/* PLACEMENT CONFIRMATION */}
            {
                isPlacingMode && (
                    <div className="absolute bottom-8 left-5 right-5 z-[1001] flex flex-col gap-4 animate-fade-up">
                        <div className="glass-hud p-6 rounded-[28px] border border-white/40 shadow-3xl flex flex-col gap-5">
                            <div className="flex items-center gap-3.5">
                                <div className="w-11 h-11 bg-red-50 rounded-xl flex items-center justify-center text-[#D41F2D]">
                                    <MapPin size={24} strokeWidth={2.5} />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-base font-black text-zinc-900 tracking-tight">{t('hudChooseLocation', lang)}</span>
                                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-[0.12em]">{t('hudMoveMap', lang)}</p>
                                </div>
                            </div>
                            <div className="flex gap-2.5">
                                <button
                                    onClick={onCancelPlacement}
                                    className="flex-1 h-14 bg-zinc-100/60 text-zinc-500 rounded-xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all"
                                >
                                    {t('hudCancel', lang)}
                                </button>
                                <button
                                    onClick={onConfirmPlacement}
                                    className="flex-[2] h-14 bg-[#D41F2D] text-white rounded-xl font-black uppercase text-[10px] tracking-[0.15em] red-shadow flex items-center justify-center gap-2 active:scale-95 transition-all"
                                >
                                    {t('hudConfirm', lang)} <Check size={18} strokeWidth={3} />
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </>
    );
};

export default MapHUD;
