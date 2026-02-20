import { useState, useRef, FC } from 'react';
import { User, UserRole } from '../config/types';
import { ShieldCheck, Loader2, ArrowRight, User as UserIcon, Check, AlertCircle, Eye } from 'lucide-react';
import { ADMIN_EMAILS } from '../config/constants';
import { Lang, t } from '../i18n';

interface LoginProps {
  onLogin: () => void;
  lang: Lang;
  /** If true, show profile-setup step instead of initial login */
  showProfileSetup?: boolean;
  pendingEmail?: string;
  pendingName?: string;
  onCompleteProfile?: (name: string) => void;
}

const Login: FC<LoginProps> = ({ onLogin, lang, showProfileSetup, pendingEmail, pendingName, onCompleteProfile }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const connectLock = useRef(false);
  const [error, setError] = useState('');
  const [customName, setCustomName] = useState(pendingName || '');

  const getRole = (email: string): UserRole => {
    if (ADMIN_EMAILS.includes(email)) return 'admin';
    if (email.endsWith('@mail.udp.cl') || email.endsWith('@udp.cl')) return 'student';
    return 'guest';
  };

  const handleGoogleLogin = async () => {
    if (connectLock.current) return;
    connectLock.current = true;
    setIsConnecting(true);
    setError('');
    try {
      await onLogin();
      // We don't unlock here because onLogin redirects the page. Unlocking could cause a race condition before redirect.
    } catch (err) {
      console.error('Login Error:', err);
      setError(t('loginGoogleError', lang));
      setIsConnecting(false);
      connectLock.current = false;
    }
  };

  const handleFinishProfile = async () => {
    if (!customName.trim() || !onCompleteProfile || connectLock.current) return;
    connectLock.current = true;
    setIsConnecting(true);
    try {
      await onCompleteProfile(customName);
    } catch (err) {
      console.error("Error upserting profile:", err);
    } finally {
      setIsConnecting(false);
      connectLock.current = false;
    }
  };

  const role = pendingEmail ? getRole(pendingEmail) : null;

  const roleBadge = role === 'guest' ? (
    <div className="flex items-center gap-2 justify-center mt-6 px-4 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
      <Eye size={14} className="text-amber-500" />
      <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">{t('guestBadge', lang)}</span>
    </div>
  ) : role === 'admin' ? (
    <div className="flex items-center gap-2 justify-center mt-6 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
      <ShieldCheck size={14} className="text-emerald-500" />
      <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">{t('adminBadge', lang)}</span>
    </div>
  ) : null;

  // PROFILE SETUP STEP
  if (showProfileSetup) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#050505] overflow-hidden antialiased font-['Plus_Jakarta_Sans',sans-serif]">
        <div className="absolute top-0 left-0 w-full h-full opacity-40">
          <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] bg-[#D41F2D]/20 rounded-full blur-[120px] animate-pulse duration-[10s]" />
          <div className="absolute -bottom-[20%] -right-[10%] w-[70%] h-[70%] bg-white/5 rounded-full blur-[120px] animate-pulse duration-[15s]" />
        </div>

        <div className="relative w-full max-w-[440px] px-8 text-center">
          <div className="animate-in slide-in-from-bottom-12 duration-1000 ease-out p-4">
            <div className="w-28 h-28 bg-gradient-to-b from-zinc-800 to-zinc-950 rounded-[40px] flex items-center justify-center mb-10 mx-auto border border-white/10 shadow-3xl relative">
              <div className="absolute inset-0 bg-white/5 blur-xl rounded-full" />
              <UserIcon size={44} className="text-white relative z-10" />
            </div>

            <h2 className="text-4xl font-black text-white mb-3 tracking-tighter">{t('profileTitle', lang)}</h2>
            <p className="text-zinc-500 text-xs font-black uppercase tracking-[0.3em] mb-4">{t('profileSubtitle', lang)}</p>

            {roleBadge}

            <div className="space-y-8 mt-10">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] ml-2">{t('profileAlias', lang)}</label>
                <div className="relative group">
                  <input
                    autoFocus
                    value={customName}
                    onChange={e => setCustomName(e.target.value)}
                    placeholder={t('profilePlaceholder', lang)}
                    className="w-full h-16 bg-zinc-900/50 border-2 border-zinc-800/50 rounded-[22px] px-8 text-white font-black text-lg focus:border-[#D41F2D] focus:ring-4 focus:ring-[#D41F2D]/10 transition-all outline-none placeholder:text-zinc-700"
                  />
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 p-2 bg-zinc-800/50 rounded-xl">
                    <UserIcon size={18} className="text-zinc-500" />
                  </div>
                </div>
              </div>

              <button
                onClick={handleFinishProfile}
                disabled={isConnecting || !customName.trim()}
                className="group relative overflow-hidden w-full h-16 bg-[#D41F2D] text-white font-black rounded-[22px] flex items-center justify-center gap-3 shadow-[0_20px_40px_-10px_rgba(212,31,45,0.4)] hover:bg-[#b11a25] transition-all duration-300 active:scale-[0.97] disabled:opacity-50"
              >
                <div className="absolute inset-0 -translate-x-full group-hover:animate-shimmer pointer-events-none opacity-20">
                  <div className="w-1/2 h-full bg-gradient-to-r from-transparent via-white to-transparent skew-x-12" />
                </div>

                {isConnecting ? (
                  <Loader2 className="animate-spin" size={24} />
                ) : (
                  <Check size={24} strokeWidth={4} />
                )}
                <span className="text-lg">{isConnecting ? t('profileCreating', lang) : t('profileStart', lang)}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // INITIAL LOGIN STEP
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#050505] overflow-hidden antialiased font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Background Lighting Effects */}
      <div className="absolute top-0 left-0 w-full h-full opacity-40">
        <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] bg-[#D41F2D]/20 rounded-full blur-[120px] animate-pulse duration-[10s]" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[70%] h-[70%] bg-white/5 rounded-full blur-[120px] animate-pulse duration-[15s]" />
      </div>

      <div className="relative w-full max-w-[440px] px-8 text-center">
        <div className="animate-in fade-in zoom-in-95 duration-1000 slide-in-from-bottom-8">
          {/* Logo Section */}
          <div className="mb-12 relative inline-block group">
            <div className="absolute inset-0 bg-[#D41F2D] blur-3xl opacity-20 group-hover:opacity-40 transition-opacity duration-1000" />
            <div className="relative w-32 h-32 bg-gradient-to-br from-[#D41F2D] to-[#b11a25] rounded-[40px] flex items-center justify-center shadow-[0_25px_60px_-15px_rgba(212,31,45,0.6)] transform -rotate-2 border border-white/20 transition-all duration-500 group-hover:rotate-0 group-hover:scale-105">
              <span className="text-7xl font-black text-white tracking-tighter select-none">U</span>
            </div>
            <div className="absolute -bottom-4 -right-4 w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-2xl border-4 border-[#050505] transform rotate-3 group-hover:rotate-0 transition-transform duration-500">
              {isConnecting ? (
                <Loader2 className="animate-spin text-[#D41F2D]" size={28} />
              ) : (
                <ShieldCheck size={28} className="text-[#D41F2D]" />
              )}
            </div>
          </div>

          {/* Content Section */}
          <div className="space-y-4 mb-14">
            <h1 className="text-6xl font-black tracking-tighter text-white leading-none">
              UDP Map
            </h1>
            <p className="text-zinc-400 text-base leading-relaxed max-w-[320px] mx-auto font-medium">
              {t('loginSubtitle', lang)} <br />
              <span className="text-white font-extrabold uppercase tracking-widest text-xs mt-2 inline-block py-1 px-3 bg-white/5 rounded-full border border-white/10">
                {t('loginUniversity', lang)}
              </span>
            </p>
          </div>

          {/* Premium Login Button */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-white/20 blur opacity-0 group-hover:opacity-20 transition duration-500 rounded-[28px]" />
            <button
              onClick={handleGoogleLogin}
              disabled={isConnecting}
              className="relative overflow-hidden w-full h-16 bg-white text-zinc-900 font-black rounded-[20px] transition-all duration-300 flex items-center justify-center gap-4 shadow-[0_20px_50px_-20px_rgba(255,255,255,0.2)] active:scale-[0.97] disabled:opacity-70 group-hover:shadow-[0_25px_60px_-15px_rgba(255,255,255,0.25)]"
            >
              {/* Shimmer Effect */}
              <div className="absolute inset-0 -translate-x-full group-hover:animate-shimmer pointer-events-none">
                <div className="w-1/2 h-full bg-gradient-to-r from-transparent via-zinc-900/5 to-transparent skew-x-12" />
              </div>

              <div className="flex items-center gap-4 z-10">
                <div className="w-10 h-10 bg-transparent flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="24px" height="24px">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z" />
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    <path fill="none" d="M0 0h48v48H0z" />
                  </svg>
                </div>
                <span className="text-base tracking-tight font-extrabold">{t('loginButton', lang)}</span>
              </div>

              <ArrowRight
                size={20}
                strokeWidth={3}
                className="ml-2 opacity-30 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300 z-10"
              />
            </button>
          </div>

          <p className="text-[10px] text-zinc-600 font-bold mt-6">{t('loginFooter', lang)}</p>

          {error && (
            <div className="mt-10 p-5 bg-red-500/5 border border-red-500/20 rounded-[24px] flex items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="p-2 bg-red-500/20 rounded-xl">
                <AlertCircle size={20} className="text-red-500" />
              </div>
              <div className="text-left">
                <p className="text-[10px] font-black text-red-500/60 uppercase tracking-widest mb-0.5 text-red-500">{t('loginError', lang)}</p>
                <p className="text-xs font-bold text-red-200 leading-tight">{error}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
