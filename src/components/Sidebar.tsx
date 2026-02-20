
import { useState, FC } from 'react';
import { CATEGORIES, CAMPUSES } from '../config/constants';
import { CategoryId, ChatMessage, User, Faculty } from '../config/types';
import { X, Send, MessageSquare, MapPin, LogOut, Globe } from 'lucide-react';
import { catLabel, facName } from '../i18n';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  user: User;
  activeFaculty: Faculty;
  chatMessages: ChatMessage[];
  onSendMessage: (text: string) => void;
  activeCategories: CategoryId[];
  onToggleCategory: (id: CategoryId) => void;
  currentCampusId: string;
  onCampusChange: (id: string) => void;
  lang: 'es' | 'en';
  onToggleLang: () => void;
}

const t = {
  es: {
    settings: 'Ajustes',
    community: 'Comunidad',
    campus: 'Sede Universitaria',
    categories: 'Categorías Activas',
    language: 'Idioma',
    logout: 'Cerrar Sesión',
    startChat: 'Empieza la charla',
    messagePlaceholder: (name: string) => `Mensaje en ${name}...`,
    guest: 'Invitado',
    spanish: 'Español',
    english: 'English',
  },
  en: {
    settings: 'Settings',
    community: 'Community',
    campus: 'Campus',
    categories: 'Active Categories',
    language: 'Language',
    logout: 'Log Out',
    startChat: 'Start chatting',
    messagePlaceholder: (name: string) => `Message in ${name}...`,
    guest: 'Guest',
    spanish: 'Español',
    english: 'English',
  }
};

const Sidebar: FC<SidebarProps> = ({
  isOpen, onClose, onLogout, user, activeFaculty, chatMessages, onSendMessage,
  activeCategories, onToggleCategory, currentCampusId, onCampusChange, lang, onToggleLang
}) => {
  const [tab, setTab] = useState<'settings' | 'chat'>('settings');
  const [input, setInput] = useState('');
  const i = t[lang];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex justify-end">
      <div className="absolute inset-0 bg-black/10 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-sm h-full bg-white flex flex-col shadow-[0_0_80px_rgba(0,0,0,0.1)] animate-in slide-in-from-right duration-500 ease-out border-l border-zinc-100">

        <div className="p-8 pt-12">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#D41F2D] rounded-2xl flex items-center justify-center text-white shadow-xl shadow-red-500/20">
                <MapPin size={26} strokeWidth={2.5} />
              </div>
              <h2 className="text-2xl font-black text-zinc-900 tracking-tighter">UDP Map</h2>
            </div>
            <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-zinc-50 text-zinc-400 rounded-full hover:bg-zinc-100 active:scale-90 transition-all"><X size={20} /></button>
          </div>

          <div className="flex p-1.5 bg-zinc-50 rounded-2xl border border-zinc-100">
            {(['settings', 'chat'] as const).map(tKey => (
              <button
                key={tKey}
                onClick={() => setTab(tKey)}
                className={`flex-1 py-3 rounded-[14px] text-[10px] font-black tracking-[0.15em] transition-all uppercase ${tab === tKey ? 'bg-white text-zinc-900 shadow-sm border border-zinc-100' : 'text-zinc-400'}`}
              >
                {tKey === 'settings' ? i.settings : i.community}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-2 no-scrollbar">
          {tab === 'chat' ? (
            <div className="space-y-6">
              {chatMessages.length === 0 ? (
                <div className="py-24 text-center">
                  <div className="w-16 h-16 rounded-3xl bg-zinc-50 flex items-center justify-center text-zinc-200 mx-auto mb-6">
                    <MessageSquare size={32} />
                  </div>
                  <p className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em]">{i.startChat}</p>
                </div>
              ) : (
                chatMessages.map(m => (
                  <div key={m.id} className={`flex flex-col ${m.userId === user.id ? 'items-end' : 'items-start'}`}>
                    <span className="text-[9px] font-black text-zinc-300 mb-2 px-1 uppercase tracking-widest flex items-center gap-1.5">
                      {m.userName === 'UDP Bot' ? '⚡ UDP Bot' : m.userName}
                      {m.userRole === 'guest' && (
                        <span className="text-[7px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-md font-black normal-case tracking-wide">{i.guest}</span>
                      )}
                    </span>
                    <div className={`px-5 py-3.5 rounded-2xl text-sm font-semibold max-w-[90%] shadow-sm leading-relaxed ${m.userId === user.id
                      ? 'bg-[#D41F2D] text-white rounded-tr-none'
                      : m.userId === 'bot'
                        ? 'bg-zinc-900 text-white rounded-tl-none'
                        : 'bg-zinc-50 text-zinc-800 border border-zinc-100 rounded-tl-none'
                      }`}>
                      {m.text}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-10 pb-12">
              {/* Campus selector */}
              <section>
                <h4 className="text-[11px] font-black text-zinc-900 uppercase tracking-[0.2em] mb-5">{i.campus}</h4>
                <div className="space-y-3">
                  {CAMPUSES.map(c => (
                    <button
                      key={c.id}
                      onClick={() => onCampusChange(c.id)}
                      className={`w-full p-5 rounded-[22px] text-left font-black transition-all border ${currentCampusId === c.id
                        ? 'bg-white text-zinc-900 border-[#D41F2D] shadow-xl shadow-red-500/5 ring-1 ring-[#D41F2D]'
                        : 'bg-zinc-50/50 text-zinc-400 border-transparent hover:border-zinc-200'
                        }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </section>

              {/* Categories - 2 columns */}
              <section>
                <h4 className="text-[11px] font-black text-zinc-900 uppercase tracking-[0.2em] mb-5">{i.categories}</h4>
                <div className="grid grid-cols-2 gap-2.5">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => onToggleCategory(cat.id)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-[18px] transition-all border ${activeCategories.includes(cat.id)
                        ? 'bg-white border-zinc-200 shadow-md'
                        : 'opacity-35 grayscale border-transparent bg-zinc-50/50'
                        }`}
                    >
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center border border-zinc-100" style={{ backgroundColor: `${cat.color}08` }}>
                        <svg viewBox="0 0 24 24" width="20" height="20" fill={cat.color}><path d={cat.svgPath} /></svg>
                      </div>
                      <span className="text-[10px] font-black text-zinc-700 tracking-tight text-center leading-tight">{catLabel(cat, lang)}</span>
                    </button>
                  ))}
                </div>
              </section>

              {/* Language toggle */}
              <section>
                <h4 className="text-[11px] font-black text-zinc-900 uppercase tracking-[0.2em] mb-5">{i.language}</h4>
                <div className="flex p-1.5 bg-zinc-50 rounded-2xl border border-zinc-100">
                  <button
                    onClick={() => lang !== 'es' && onToggleLang()}
                    className={`flex-1 py-3 rounded-[14px] text-[11px] font-black tracking-wide transition-all flex items-center justify-center gap-2 ${lang === 'es' ? 'bg-white text-zinc-900 shadow-sm border border-zinc-100' : 'text-zinc-400'}`}
                  >
                    🇪🇸 {i.spanish}
                  </button>
                  <button
                    onClick={() => lang !== 'en' && onToggleLang()}
                    className={`flex-1 py-3 rounded-[14px] text-[11px] font-black tracking-wide transition-all flex items-center justify-center gap-2 ${lang === 'en' ? 'bg-white text-zinc-900 shadow-sm border border-zinc-100' : 'text-zinc-400'}`}
                  >
                    🇺🇸 {i.english}
                  </button>
                </div>
              </section>

              {/* Logout */}
              <section className="pt-4">
                <button
                  onClick={onLogout}
                  className="w-full p-5 rounded-[22px] bg-red-50 text-[#D41F2D] font-black flex items-center justify-center gap-3 border border-red-100 hover:bg-red-100 active:scale-[0.97] transition-all"
                >
                  <LogOut size={18} strokeWidth={2.5} />
                  {i.logout}
                </button>
              </section>
            </div>
          )}
        </div>

        {tab === 'chat' && (
          <div className="p-8 bg-white border-t border-zinc-100 mb-safe">
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (onSendMessage(input), setInput(''))}
                placeholder={i.messagePlaceholder(facName(activeFaculty, lang))}
                className="flex-1 bg-zinc-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-red-500/10 transition-all outline-none"
              />
              <button
                onClick={() => { onSendMessage(input); setInput(''); }}
                className="w-14 h-14 bg-[#D41F2D] text-white rounded-2xl flex items-center justify-center active:scale-90 transition-all shadow-xl shadow-red-500/20"
              >
                <Send size={22} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
