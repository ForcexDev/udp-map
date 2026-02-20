import { FC, useEffect, useState } from 'react';
import { MapPin, X } from 'lucide-react';

interface ToastProps {
    message: string;
    onDismiss: () => void;
}

const Toast: FC<ToastProps> = ({ message, onDismiss }) => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        requestAnimationFrame(() => setVisible(true));
        const timer = setTimeout(() => {
            setVisible(false);
            setTimeout(onDismiss, 400);
        }, 4500);
        return () => clearTimeout(timer);
    }, [onDismiss]);

    return (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[5000] transition-all duration-400 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
            }`}>
            <div className="flex items-center gap-3 px-5 py-3.5 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] max-w-[360px]">
                <div className="w-8 h-8 bg-[#D41F2D] rounded-xl flex items-center justify-center shrink-0">
                    <MapPin size={16} className="text-white" />
                </div>
                <p className="text-[12px] font-bold text-white leading-tight flex-1">{message}</p>
                <button onClick={() => { setVisible(false); setTimeout(onDismiss, 400); }} className="text-zinc-500 hover:text-white transition-colors shrink-0">
                    <X size={14} />
                </button>
            </div>
        </div>
    );
};

export default Toast;
