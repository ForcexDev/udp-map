import { FC, useState } from 'react';
import { Marker, Popup } from 'react-leaflet';
import { Post, User, Faculty } from '../../config/types';
import { CATEGORIES, APP_CONFIG } from '../../config/constants';
import { createMarkerIcon, createFacultyIcon, timeAgo } from '../../utils/mapUtils';
import { ThumbsUp, ThumbsDown, Pin, PinOff, Trash2, X, Image as ImageIcon } from 'lucide-react';
import { Lang, t, catLabel } from '../../i18n';

interface MapMarkerProps {
    post: Post;
    user: User;
    lang: Lang;
    userVote?: 'up' | 'down';
    onVote: (postId: string, type: 'up' | 'down') => void;
    onTogglePin: (postId: string) => void;
    onDelete: (postId: string) => void;
}

interface FacultyLabelProps {
    faculty: Faculty;
    onExplore: (faculty: Faculty) => void;
}

export const FacultyLabel: FC<FacultyLabelProps> = ({ faculty, onExplore }) => {
    return (
        <Marker
            position={faculty.coords}
            icon={createFacultyIcon(faculty.name, faculty.image)}
            eventHandlers={{ click: () => onExplore(faculty) }}
        />
    );
};

const MapMarker: FC<MapMarkerProps> = ({
    post,
    user,
    lang,
    userVote,
    onVote,
    onTogglePin,
    onDelete
}) => {
    const [isImageOpen, setIsImageOpen] = useState(false);
    const category = CATEGORIES.find(c => c.id === post.categoryId) || CATEGORIES[CATEGORIES.length - 1];
    const isGuest = user.role === 'guest';
    const isCreator = user.id === post.creatorId;

    const ageInDays = (Date.now() - post.createdAt) / (1000 * 60 * 60 * 24);
    const isOld = ageInDays >= APP_CONFIG.FADE_DAYS;
    const isHidden = post.votesDown >= APP_CONFIG.MAX_REPORTS;
    const opacity = post.isPinned ? 1 : (isOld || isHidden ? 0.35 : 1);

    const handleDelete = () => {
        if (window.confirm(t('markerDeleteConfirm', lang))) {
            onDelete(post.id);
        }
    };

    return (
        <>
            <Marker
                position={[post.lat, post.lng]}
                icon={createMarkerIcon(category.color, category.svgPath, opacity, post.isPinned)}
            >
                <Popup className="pro-popup">
                    <div className="flex flex-col" style={{ width: '280px' }}>
                        {/* Color Header Bar */}
                        <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${category.color}, ${category.color}80)` }}></div>

                        {/* Image */}
                        {post.image && (
                            <div className="w-full h-44 overflow-hidden bg-zinc-100 group relative cursor-pointer" onClick={() => setIsImageOpen(true)}>
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors z-10 flex items-center justify-center">
                                    <ImageIcon size={28} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
                                </div>
                                <img
                                    src={post.image}
                                    alt={post.title}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    loading="lazy"
                                />
                            </div>
                        )}

                        {/* Content */}
                        <div className="p-5">
                            {/* Meta Row */}
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${category.color}15` }}>
                                        <svg viewBox="0 0 24 24" width="14" height="14" fill={category.color}><path d={category.svgPath} /></svg>
                                    </div>
                                    <span className="text-[10px] font-extrabold uppercase text-zinc-500 tracking-wide">{catLabel(category, lang)}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-bold text-zinc-400">{timeAgo(post.createdAt)}</span>
                                    {post.isPinned && (
                                        <span className="text-[8px] bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-2 py-0.5 rounded-full font-black uppercase">{t('markerPinned', lang)}</span>
                                    )}
                                    {isOld && !post.isPinned && <span className="w-2 h-2 rounded-full bg-zinc-300"></span>}
                                    {isHidden && !post.isPinned && <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse"></span>}
                                </div>
                            </div>

                            {/* Title & Description */}
                            <h4 className="font-extrabold text-[15px] text-zinc-900 leading-snug mb-1.5 tracking-tight">{post.title}</h4>
                            {post.description && (
                                <p className="text-[11px] text-zinc-500 leading-relaxed mb-4 line-clamp-3 font-medium">{post.description}</p>
                            )}

                            {/* Footer Actions */}
                            <div className="flex items-center justify-between pt-3 border-t border-zinc-100/80">
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => !isGuest && onVote(post.id, 'up')}
                                        disabled={!!userVote || isGuest}
                                        title={isGuest ? t('markerGuestVote', lang) : ''}
                                        className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-extrabold transition-all ${isGuest
                                            ? 'text-zinc-300 cursor-not-allowed'
                                            : userVote === 'up'
                                                ? 'bg-emerald-50 text-emerald-600'
                                                : userVote
                                                    ? 'text-zinc-200 cursor-default'
                                                    : 'text-zinc-500 hover:bg-emerald-50 hover:text-emerald-600 active:scale-95'
                                            }`}
                                    >
                                        <ThumbsUp size={13} strokeWidth={2.5} />
                                        {post.votesUp}
                                    </button>

                                    <button
                                        onClick={() => !isGuest && onVote(post.id, 'down')}
                                        disabled={!!userVote || isGuest}
                                        title={isGuest ? t('markerGuestVote', lang) : ''}
                                        className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-extrabold transition-all ${isGuest
                                            ? 'text-zinc-300 cursor-not-allowed'
                                            : userVote === 'down'
                                                ? 'bg-red-50 text-red-500'
                                                : userVote
                                                    ? 'text-zinc-200 cursor-default'
                                                    : 'text-zinc-400 hover:bg-red-50 hover:text-red-500 active:scale-95'
                                            }`}
                                    >
                                        <ThumbsDown size={13} strokeWidth={2.5} />
                                        {post.votesDown}
                                    </button>
                                </div>

                                <div className="flex items-center gap-2">
                                    {/* Admin controls */}
                                    {user.isAdmin && (
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => onTogglePin(post.id)}
                                                className={`p-1.5 rounded-lg transition-all ${post.isPinned ? 'bg-yellow-100 text-yellow-600' : 'bg-zinc-50 text-zinc-400 hover:bg-yellow-50 hover:text-yellow-600'}`}
                                                title={post.isPinned ? t('markerUnpin', lang) : t('markerPin', lang)}
                                            >
                                                {post.isPinned ? <PinOff size={13} /> : <Pin size={13} />}
                                            </button>
                                            <button
                                                onClick={handleDelete}
                                                className="p-1.5 bg-red-50 text-red-400 rounded-lg hover:bg-red-100 hover:text-red-500 transition-all"
                                                title={t('markerDelete', lang)}
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    )}

                                    {/* Creator delete button (non-admin) */}
                                    {isCreator && !user.isAdmin && (
                                        <button
                                            onClick={handleDelete}
                                            className="p-1.5 bg-red-50 text-red-400 rounded-lg hover:bg-red-100 hover:text-red-500 transition-all"
                                            title={t('markerDelete', lang)}
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    )}

                                    <span className="text-[9px] font-extrabold text-zinc-300 ml-1">@{post.creatorName.split(' ')[0]}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </Popup>
            </Marker>

            {isImageOpen && post.image && (
                <div
                    className="fixed inset-0 z-[4000] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsImageOpen(false);
                    }}
                >
                    <button
                        className="absolute top-6 right-6 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-all backdrop-blur-md"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsImageOpen(false);
                        }}
                    >
                        <X size={28} />
                    </button>
                    <img
                        src={post.image}
                        alt="Zoomed"
                        className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </>
    );
};

export default MapMarker;
