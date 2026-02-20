import { useState, FC } from 'react';
import { MapPin, MessageSquare, ThumbsUp, ChevronRight, X } from 'lucide-react';
import { Lang, t } from '../i18n';

interface OnboardingProps {
    onComplete: () => void;
    lang: Lang;
}

const getSlides = (lang: Lang) => [
    {
        icon: MapPin,
        title: t('onboard1Title', lang),
        desc: t('onboard1Desc', lang),
        color: '#D41F2D',
        bg: 'from-red-500/20 to-orange-500/10'
    },
    {
        icon: ChevronRight,
        title: t('onboard2Title', lang),
        desc: t('onboard2Desc', lang),
        color: '#10B981',
        bg: 'from-emerald-500/20 to-teal-500/10'
    },
    {
        icon: ThumbsUp,
        title: t('onboard3Title', lang),
        desc: t('onboard3Desc', lang),
        color: '#3B82F6',
        bg: 'from-blue-500/20 to-indigo-500/10'
    },
    {
        icon: MessageSquare,
        title: t('onboard4Title', lang),
        desc: t('onboard4Desc', lang),
        color: '#8B5CF6',
        bg: 'from-purple-500/20 to-pink-500/10'
    }
];

const Onboarding: FC<OnboardingProps> = ({ onComplete, lang }) => {
    const [current, setCurrent] = useState(0);
    const [exiting, setExiting] = useState(false);
    const slides = getSlides(lang);

    const finish = () => {
        setExiting(true);
        setTimeout(() => {
            localStorage.setItem('udp_onboarding_done', '1');
            onComplete();
        }, 400);
    };

    const next = () => {
        if (current < slides.length - 1) setCurrent(c => c + 1);
        else finish();
    };

    const slide = slides[current];
    const Icon = slide.icon;

    return (
        <div className={`fixed inset-0 z-[10000] bg-[#050505] flex flex-col items-center justify-center px-8 transition-opacity duration-500 ${exiting ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
            {/* Skip button */}
            <button
                onClick={finish}
                className="absolute top-8 right-8 text-zinc-600 text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors flex items-center gap-2"
            >
                {t('onboardSkip', lang)} <X size={14} />
            </button>

            {/* Icon */}
            <div className={`w-28 h-28 rounded-[36px] bg-gradient-to-br ${slide.bg} flex items-center justify-center mb-12 border border-white/5 shadow-2xl transition-all duration-500`}>
                <Icon size={48} style={{ color: slide.color }} strokeWidth={2} />
            </div>

            {/* Title */}
            <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tighter mb-4 text-center leading-tight transition-all duration-300" key={`t-${current}`}>
                {slide.title}
            </h2>

            {/* Description */}
            <p className="text-zinc-400 text-base leading-relaxed max-w-[340px] text-center font-medium mb-16" key={`d-${current}`}>
                {slide.desc}
            </p>

            {/* Dots */}
            <div className="flex gap-2 mb-10">
                {slides.map((_, i) => (
                    <div
                        key={i}
                        className={`h-1.5 rounded-full transition-all duration-500 ${i === current ? 'w-8 bg-white' : 'w-1.5 bg-zinc-700'
                            }`}
                    />
                ))}
            </div>

            {/* Next Button */}
            <button
                onClick={next}
                className="w-full max-w-[320px] h-16 rounded-[22px] font-black text-lg transition-all duration-300 active:scale-95 flex items-center justify-center gap-3 shadow-[0_20px_50px_-15px]"
                style={{
                    backgroundColor: slide.color,
                    color: 'white',
                    boxShadow: `0 20px 50px -15px ${slide.color}60`
                }}
            >
                {current < slides.length - 1 ? t('onboardNext', lang) : t('onboardStart', lang)}
                <ChevronRight size={22} strokeWidth={3} />
            </button>
        </div>
    );
};

export default Onboarding;
