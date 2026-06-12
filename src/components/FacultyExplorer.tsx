import { FC, useMemo, useState } from 'react';
import { Post, User, Faculty } from '../config/types';
import { CATEGORIES, APP_CONFIG } from '../config/constants';
import { timeAgo } from '../utils/mapUtils';
import { X, MapPin, ThumbsUp, ThumbsDown, Pin, Image as ImageIcon, GraduationCap, LogIn } from 'lucide-react';
import { Lang, t, catLabel, facName } from '../i18n';

interface FacultyExplorerProps {
    faculty: Faculty;
    posts: Post[];
    user: User;
    lang: Lang;
    userVotes: Record<string, 'up' | 'down'>;
    onVote: (postId: string, type: 'up' | 'down') => void;
    onClose: () => void;
    isAnonymous?: boolean;
    onLogin?: () => void;
}

const FacultyExplorer: FC<FacultyExplorerProps> = ({
    faculty,
    posts,
    user,
    lang,
    userVotes,
    onVote,
    onClose,
    isAnonymous = false,
    onLogin
}) => {
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const facultyPosts = useMemo(() => {
        return posts.filter(p => p.facultyId === faculty.id);
    }, [posts, faculty.id]);

    const careers = faculty.careers ?? [];

    return (
        <div className="fixed inset-0 z-[2500] flex flex-col bg-white antialiased">
            {/* HEADER — Faculty banner */}
            <div className="relative h-48 sm:h-56 shrink-0 overflow-hidden">
                {faculty.image ? (
                    <img
                        src={faculty.image.replace('w=200&h=200', 'w=800&h=400')}
                        alt={facName(faculty, lang)}
                        className="absolute inset-0 w-full h-full object-cover"
                    />
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-[#D41F2D] to-[#8B1520]"></div>
                )}
                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10"></div>

                {/* Top Actions */}
                <div className="absolute top-0 left-0 right-0 p-5 flex items-center justify-between">
                    <button
                        onClick={onClose}
                        className="w-11 h-11 bg-black/30 backdrop-blur-xl rounded-2xl flex items-center justify-center text-white border border-white/10 active:scale-90 transition-transform"
                    >
                        <X size={22} strokeWidth={2.5} />
                    </button>
                    <div className="px-4 py-2 bg-black/30 backdrop-blur-xl rounded-xl border border-white/10">
                        {isAnonymous ? (
                            <span className="text-[11px] font-extrabold text-white/90">
                                {careers.length} {t('explorerCareers', lang)}
                            </span>
                        ) : (
                            <span className="text-[11px] font-extrabold text-white/90">
                                {facultyPosts.length} {t('explorerReports', lang)}
                            </span>
                        )}
                    </div>
                </div>

                {/* Faculty Info */}
                <div className="absolute bottom-0 left-0 right-0 p-6">
                    <div className="flex items-end gap-4">
                        {faculty.image && (
                            <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-white/30 shadow-xl shrink-0">
                                <img src={faculty.image} alt="" className="w-full h-full object-cover" />
                            </div>
                        )}
                        <div>
                            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-none mb-1">
                                {facName(faculty, lang)}
                            </h2>
                            <p className="text-[11px] font-bold text-white/60 uppercase tracking-widest">
                                {isAnonymous ? t('explorerCareers', lang) : t('explorerExplore', lang)}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* CONTENT */}
            <div className="flex-1 overflow-y-auto bg-zinc-50 p-4 sm:p-6">

                {/* ── ANONYMOUS: Show careers list ── */}
                {isAnonymous ? (
                    <div className="flex flex-col gap-4">
                        {/* Careers list */}
                        {careers.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <div className="w-16 h-16 rounded-3xl bg-white flex items-center justify-center text-zinc-200 mb-4 shadow-sm">
                                    <GraduationCap size={28} />
                                </div>
                                <p className="text-sm text-zinc-400 font-medium">{facName(faculty, lang)}</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {careers.map((career, i) => (
                                    <div
                                        key={i}
                                        className="bg-white rounded-2xl px-5 py-4 border border-zinc-100 shadow-sm flex items-center gap-4"
                                    >
                                        <div className="w-9 h-9 bg-[#D41F2D]/8 rounded-xl flex items-center justify-center shrink-0">
                                            <GraduationCap size={18} className="text-[#D41F2D]" strokeWidth={2} />
                                        </div>
                                        <span className="text-[14px] font-bold text-zinc-900 leading-tight">
                                            {lang === 'en' ? career.nameEn : career.name}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Login CTA card */}
                        <div className="mt-4 bg-gradient-to-br from-zinc-900 to-zinc-950 rounded-3xl p-6 border border-zinc-800">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-[#D41F2D] rounded-xl flex items-center justify-center">
                                    <MapPin size={18} className="text-white" strokeWidth={2.5} />
                                </div>
                                <div>
                                    <p className="text-white font-black text-[14px] leading-tight">{t('explorerCareersDesc', lang)}</p>
                                </div>
                            </div>
                            <button
                                onClick={onLogin}
                                className="w-full h-13 bg-white text-zinc-900 font-black rounded-2xl flex items-center justify-center gap-3 py-3.5 active:scale-[0.98] transition-transform"
                            >
                                <LogIn size={18} strokeWidth={2.5} />
                                {t('explorerLoginCta', lang)}
                            </button>
                        </div>
                    </div>
                ) : (
                    /* ── LOGGED IN: Show posts ── */
                    facultyPosts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center py-20">
                            <div className="w-20 h-20 rounded-3xl bg-white flex items-center justify-center text-zinc-200 mb-6 shadow-sm">
                                <MapPin size={36} />
                            </div>
                            <h3 className="text-lg font-black text-zinc-900 tracking-tight mb-2">{t('explorerEmpty', lang)}</h3>
                            <p className="text-sm text-zinc-400 font-medium max-w-[280px]">
                                {t('explorerBeFirst', lang)} {facName(faculty, lang)}. {t('explorerCloseHint', lang)}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                            {facultyPosts.map(post => {
                                const cat = CATEGORIES.find(c => c.id === post.categoryId) || CATEGORIES[CATEGORIES.length - 1];
                                const userVote = userVotes[post.id];
                                const ageInDays = (Date.now() - post.createdAt) / (1000 * 60 * 60 * 24);
                                const isOld = ageInDays >= APP_CONFIG.FADE_DAYS;
                                const isGuest = user.role === 'guest';

                                return (
                                    <div
                                        key={post.id}
                                        className="bg-white rounded-2xl overflow-hidden border border-zinc-100 shadow-sm transition-all active:scale-[0.98]"
                                        style={{ opacity: post.isPinned ? 1 : (isOld ? 0.6 : 1) }}
                                    >
                                        {post.image ? (
                                            <div className="w-full h-28 sm:h-32 overflow-hidden bg-zinc-100 group relative cursor-pointer" onClick={() => setSelectedImage(post.image)}>
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors z-10 flex items-center justify-center">
                                                    <ImageIcon size={24} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
                                                </div>
                                                <img
                                                    src={post.image}
                                                    alt={post.title}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                    loading="lazy"
                                                />
                                            </div>
                                        ) : (
                                            <div
                                                className="w-full h-16 flex items-center justify-center"
                                                style={{ background: `linear-gradient(135deg, ${cat.color}15, ${cat.color}08)` }}
                                            >
                                                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/80 shadow-sm">
                                                    <svg viewBox="0 0 24 24" width="20" height="20" fill={cat.color}><path d={cat.svgPath} /></svg>
                                                </div>
                                            </div>
                                        )}

                                        <div className="p-3 sm:p-3.5">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <div className="flex items-center gap-1">
                                                    <div className="w-4 h-4 rounded flex items-center justify-center" style={{ backgroundColor: `${cat.color}18` }}>
                                                        <svg viewBox="0 0 24 24" width="10" height="10" fill={cat.color}><path d={cat.svgPath} /></svg>
                                                    </div>
                                                    <span className="text-[8px] font-extrabold uppercase text-zinc-400 tracking-wide">{catLabel(cat, lang)}</span>
                                                </div>
                                                <span className="text-[8px] font-bold text-zinc-300">{timeAgo(post.createdAt)}</span>
                                            </div>

                                            <h4 className="text-[12px] sm:text-[13px] font-extrabold text-zinc-900 leading-tight mb-1 tracking-tight line-clamp-2">{post.title}</h4>

                                            {post.description && (
                                                <p className="text-[10px] text-zinc-400 leading-snug line-clamp-2 mb-2 font-medium">{post.description}</p>
                                            )}

                                            <div className="flex items-center justify-between pt-2 border-t border-zinc-50">
                                                <div className="flex gap-0.5">
                                                    <button
                                                        onClick={() => !isGuest && onVote(post.id, 'up')}
                                                        disabled={!!userVote || isGuest}
                                                        title={isGuest ? t('markerGuestVote', lang) : ''}
                                                        className={`flex items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-extrabold transition-all ${isGuest ? 'text-zinc-300 cursor-not-allowed' : userVote === 'up' ? 'bg-emerald-50 text-emerald-600' : userVote ? 'text-zinc-200 cursor-default' : 'text-zinc-500 hover:bg-emerald-50 hover:text-emerald-600 active:scale-95'}`}
                                                    >
                                                        <ThumbsUp size={10} strokeWidth={2.5} />
                                                        {post.votesUp}
                                                    </button>
                                                    <button
                                                        onClick={() => !isGuest && onVote(post.id, 'down')}
                                                        disabled={!!userVote || isGuest}
                                                        title={isGuest ? t('markerGuestVote', lang) : ''}
                                                        className={`flex items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-extrabold transition-all ${isGuest ? 'text-zinc-300 cursor-not-allowed' : userVote === 'down' ? 'bg-red-50 text-red-500' : userVote ? 'text-zinc-200 cursor-default' : 'text-zinc-500 hover:bg-red-50 hover:text-red-500 active:scale-95'}`}
                                                    >
                                                        <ThumbsDown size={10} strokeWidth={2.5} />
                                                        {post.votesDown}
                                                    </button>
                                                </div>

                                                <div className="flex items-center gap-1">
                                                    {post.isPinned && (
                                                        <div className="w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center">
                                                            <Pin size={7} className="text-white" />
                                                        </div>
                                                    )}
                                                    <span className="text-[8px] font-bold text-zinc-300">@{post.creatorName.split(' ')[0]}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )
                )}
            </div>

            {/* FULLSCREEN IMAGE MODAL */}
            {selectedImage && (
                <div
                    className="fixed inset-0 z-[3000] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setSelectedImage(null)}
                >
                    <button
                        className="absolute top-6 right-6 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-all backdrop-blur-md"
                        onClick={() => setSelectedImage(null)}
                    >
                        <X size={28} />
                    </button>
                    <img
                        src={selectedImage}
                        alt="Zoomed"
                        className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
};

export default FacultyExplorer;
