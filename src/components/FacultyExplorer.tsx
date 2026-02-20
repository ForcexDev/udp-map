import { FC, useMemo } from 'react';
import { Post, User, Faculty } from '../config/types';
import { CATEGORIES, APP_CONFIG } from '../config/constants';
import { timeAgo } from '../utils/mapUtils';
import { X, MapPin, ThumbsUp, ThumbsDown, Pin, Clock, Image as ImageIcon } from 'lucide-react';
import { Lang, t, catLabel, facName } from '../i18n';

interface FacultyExplorerProps {
    faculty: Faculty;
    posts: Post[];
    user: User;
    lang: Lang;
    userVotes: Record<string, 'up' | 'down'>;
    onVote: (postId: string, type: 'up' | 'down') => void;
    onClose: () => void;
}

const FacultyExplorer: FC<FacultyExplorerProps> = ({
    faculty,
    posts,
    user,
    lang,
    userVotes,
    onVote,
    onClose
}) => {
    const facultyPosts = useMemo(() => {
        return posts.filter(p => p.facultyId === faculty.id);
    }, [posts, faculty.id]);

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
                        <span className="text-[11px] font-extrabold text-white/90">{facultyPosts.length} {t('explorerReports', lang)}</span>
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
                                {t('explorerExplore', lang)}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* CONTENT — 2 column grid */}
            <div className="flex-1 overflow-y-auto bg-zinc-50 p-4 sm:p-6">
                {facultyPosts.length === 0 ? (
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
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                        {facultyPosts.map(post => {
                            const cat = CATEGORIES.find(c => c.id === post.categoryId) || CATEGORIES[CATEGORIES.length - 1];
                            const userVote = userVotes[post.id];
                            const ageInDays = (Date.now() - post.createdAt) / (1000 * 60 * 60 * 24);
                            const isOld = ageInDays >= APP_CONFIG.FADE_DAYS;

                            return (
                                <div
                                    key={post.id}
                                    className="bg-white rounded-2xl overflow-hidden border border-zinc-100 shadow-sm transition-all active:scale-[0.98]"
                                    style={{ opacity: post.isPinned ? 1 : (isOld ? 0.6 : 1) }}
                                >
                                    {/* Post Image or Category Banner */}
                                    {post.image ? (
                                        <div className="w-full h-28 sm:h-32 overflow-hidden bg-zinc-100">
                                            <img
                                                src={post.image}
                                                alt={post.title}
                                                className="w-full h-full object-cover"
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

                                    {/* Post Content */}
                                    <div className="p-3 sm:p-3.5">
                                        {/* Category + Time */}
                                        <div className="flex items-center justify-between mb-1.5">
                                            <div className="flex items-center gap-1">
                                                <div
                                                    className="w-4 h-4 rounded flex items-center justify-center"
                                                    style={{ backgroundColor: `${cat.color}18` }}
                                                >
                                                    <svg viewBox="0 0 24 24" width="10" height="10" fill={cat.color}><path d={cat.svgPath} /></svg>
                                                </div>
                                                <span className="text-[8px] font-extrabold uppercase text-zinc-400 tracking-wide">{catLabel(cat, lang)}</span>
                                            </div>
                                            <span className="text-[8px] font-bold text-zinc-300">{timeAgo(post.createdAt)}</span>
                                        </div>

                                        {/* Title */}
                                        <h4 className="text-[12px] sm:text-[13px] font-extrabold text-zinc-900 leading-tight mb-1 tracking-tight line-clamp-2">{post.title}</h4>

                                        {/* Description */}
                                        {post.description && (
                                            <p className="text-[10px] text-zinc-400 leading-snug line-clamp-2 mb-2 font-medium">{post.description}</p>
                                        )}

                                        {/* Footer */}
                                        <div className="flex items-center justify-between pt-2 border-t border-zinc-50">
                                            <div className="flex gap-0.5">
                                                <button
                                                    onClick={() => onVote(post.id, 'up')}
                                                    disabled={!!userVote}
                                                    className={`flex items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-extrabold transition-all ${userVote === 'up'
                                                        ? 'bg-emerald-50 text-emerald-600'
                                                        : userVote ? 'text-zinc-200' : 'text-zinc-500 active:bg-emerald-50 active:text-emerald-600'
                                                        }`}
                                                >
                                                    <ThumbsUp size={10} strokeWidth={2.5} />
                                                    {post.votesUp}
                                                </button>
                                                <button
                                                    onClick={() => onVote(post.id, 'down')}
                                                    disabled={!!userVote}
                                                    className={`flex items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-extrabold transition-all ${userVote === 'down'
                                                        ? 'bg-red-50 text-red-500'
                                                        : userVote ? 'text-zinc-200' : 'text-zinc-400 active:bg-red-50 active:text-red-500'
                                                        }`}
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
                )}
            </div>
        </div>
    );
};

export default FacultyExplorer;
