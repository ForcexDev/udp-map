
import { useState, useMemo, useRef, useCallback, FC } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CAMPUSES, CATEGORIES, FACULTIES } from '../config/constants';
import { Post, User, CategoryId, Faculty } from '../config/types';
import Login from '../components/Login';
import Sidebar from '../components/Sidebar';
import AddPostModal from '../components/AddPostModal';
import MapView from '../components/Map/MapView';
import FacultyExplorer from '../components/FacultyExplorer';
import Onboarding from '../components/Onboarding';
import Toast from '../components/Toast';
import { auditPost, getGeminiAdvice } from '../services/geminiService';
import { createPost, sendChatMessage } from '../services/supabaseService';
import { useUserSession } from '../hooks/useUserSession';
import { usePosts } from '../hooks/usePosts';
import { detectLang, t } from '../i18n';
import { Cpu } from 'lucide-react';

const App: FC = () => {
  const { user, login, logout } = useUserSession();
  const {
    posts,
    chatMessages,
    userVotes,
    handleVote,
    handleTogglePin,
    handleDeletePost,
    lastNewPostTitle
  } = usePosts();

  const [currentCampusId, setCurrentCampusId] = useState(CAMPUSES[0].id);
  const [activeFacultyId, setActiveFacultyId] = useState<string>('global');
  const [activeCategories, setActiveCategories] = useState<CategoryId[]>(CATEGORIES.map(c => c.id));
  const [showAddModal, setShowAddModal] = useState(false);
  const [pendingCoords, setPendingCoords] = useState<{ lat: number, lng: number } | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [isPlacingMode, setIsPlacingMode] = useState(false);
  const [explorerFaculty, setExplorerFaculty] = useState<Faculty | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('udp_onboarding_done'));
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [lang, setLang] = useState(() => detectLang());

  const toggleLang = useCallback(() => {
    setLang(prev => {
      const next = prev === 'es' ? 'en' : 'es';
      localStorage.setItem('udp_lang', next);
      return next;
    });
  }, []);

  const handleLogout = useCallback(() => {
    logout();
    localStorage.removeItem('udp_onboarding_done');
  }, [logout]);

  const mapRef = useRef<L.Map | null>(null);

  // Show toast when a new post appears via realtime
  const lastNotifiedRef = useRef<string | null>(null);
  if (lastNewPostTitle && lastNewPostTitle !== lastNotifiedRef.current) {
    lastNotifiedRef.current = lastNewPostTitle;
    // Schedule toast outside render
    setTimeout(() => setToastMessage(`${t('toastNewPin', lang)} "${lastNewPostTitle}" — ${t('toastGoVote', lang)}`), 0);
  }

  const currentCampus = useMemo(() => CAMPUSES.find(c => c.id === currentCampusId) || CAMPUSES[0], [currentCampusId]);
  const campusFaculties = useMemo(() => FACULTIES.filter(f => f.campusId === currentCampusId || f.id === 'global'), [currentCampusId]);

  const filteredPosts = useMemo(() => {
    return posts.filter(p => activeCategories.includes(p.categoryId) && (activeFacultyId === 'global' || p.facultyId === activeFacultyId));
  }, [posts, activeCategories, activeFacultyId]);

  const locateUser = useCallback(() => {
    navigator.geolocation.getCurrentPosition((pos) => {
      const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
      setUserLocation(coords);
      mapRef.current?.flyTo(coords, 18);
    }, () => {
      alert(t('permDenied', lang));
    });
  }, []);

  const handleFacultySelect = useCallback((fac: Faculty) => {
    setActiveFacultyId(fac.id);
    if (fac.coords && fac.coords[0] !== 0) {
      mapRef.current?.flyTo(fac.coords, 18);
    }
  }, []);

  const startPlacing = useCallback(() => setIsPlacingMode(true), []);
  const cancelPlacement = useCallback(() => setIsPlacingMode(false), []);

  const confirmPlacement = useCallback(() => {
    if (mapRef.current) {
      const center = mapRef.current.getCenter();
      setPendingCoords({ lat: center.lat, lng: center.lng });
      setIsPlacingMode(false);
      setShowAddModal(true);
    }
  }, []);



  const handleTogglePinWrapped = useCallback((postId: string) => handleTogglePin(postId, !!user?.isAdmin), [handleTogglePin, user]);

  const handleSendMessage = useCallback(async (text: string) => {
    if (!text.trim() || !user) return;
    const msg = {
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      text,
      timestamp: Date.now(),
      facultyId: activeFacultyId
    };
    await sendChatMessage(msg);

    if (text.toLowerCase().match(/(bot|ayuda|donde)/)) {
      const advice = await getGeminiAdvice(text);
      const botMsg = {
        userId: 'bot',
        userName: 'UDP Bot',
        text: advice,
        timestamp: Date.now(),
        facultyId: activeFacultyId
      };
      await sendChatMessage(botMsg);
    }
  }, [user, activeFacultyId]);

  const handleToggleCategory = useCallback((id: CategoryId) => {
    setActiveCategories(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  const handleSubmitPost = useCallback(async (data: any) => {
    setIsAuditing(true);
    try {
      const result = await auditPost(data.title, data.description);
      if (!result.isSafe) { alert(`IA UDP: ${result.reason}`); return; }
      const { error } = await createPost(data);
      if (error) throw error;
      setShowAddModal(false);
      setPendingCoords(null);
    } catch (err: any) {
      console.error("Error base de datos:", err);
      alert(`${t('errSave', lang)} ${err.message || t('errConnection', lang)}`);
    } finally { setIsAuditing(false); }
  }, []);

  if (!user) return <Login onLogin={login} lang={lang} />;
  if (showOnboarding) return <Onboarding onComplete={() => setShowOnboarding(false)} lang={lang} />;

  return (
    <div className="w-full h-full relative overflow-hidden bg-white select-none antialiased">
      {/* Toast Notifications */}
      {toastMessage && (
        <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
      )}

      <MapView
        user={user}
        lang={lang}
        filteredPosts={filteredPosts}
        userVotes={userVotes}
        currentCampus={currentCampus}
        campusFaculties={campusFaculties}
        activeFacultyId={activeFacultyId}
        isPlacingMode={isPlacingMode}
        userLocation={userLocation}
        mapRef={mapRef}
        onVote={handleVote}
        onTogglePin={handleTogglePinWrapped}
        onDelete={handleDeletePost}
        onSidebarOpen={() => setIsSidebarOpen(true)}
        onFacultySelect={handleFacultySelect}
        onLocateUser={locateUser}
        onStartPlacing={startPlacing}
        onCancelPlacement={cancelPlacement}
        onConfirmPlacement={confirmPlacement}
        onExploreFaculty={(fac) => setExplorerFaculty(fac)}
      />

      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onLogout={handleLogout}
        user={user}
        activeFaculty={campusFaculties.find(f => f.id === activeFacultyId) || campusFaculties[0]}
        chatMessages={chatMessages.filter(m => m.facultyId === activeFacultyId)}
        onSendMessage={handleSendMessage}
        activeCategories={activeCategories}
        onToggleCategory={handleToggleCategory}
        currentCampusId={currentCampusId}
        onCampusChange={setCurrentCampusId}
        lang={lang}
        onToggleLang={toggleLang}
      />

      {showAddModal && pendingCoords && (
        <AddPostModal
          user={user}
          coords={pendingCoords}
          facultyId={activeFacultyId}
          lang={lang}
          onClose={() => {
            setShowAddModal(false);
            setPendingCoords(null);
          }}
          onSubmit={handleSubmitPost}
        />
      )}

      {isAuditing && (
        <div className="fixed inset-0 z-[4000] bg-white/95 backdrop-blur-3xl flex items-center justify-center">
          <div className="flex flex-col items-center gap-10 max-w-xs w-full px-6">
            <div className="relative flex items-center justify-center">
              <div className="w-24 h-24 rounded-full border-[2px] border-zinc-100 flex items-center justify-center relative overflow-hidden">
                <Cpu size={32} className="text-[#D41F2D] animate-pulse" />
                <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-[#D41F2D]/20 to-transparent border-b border-[#D41F2D]/30 animate-scan"></div>
              </div>
            </div>
            <div className="flex flex-col items-center text-center gap-2">
              <span className="text-xl font-black text-zinc-900 tracking-tight">{t('auditTitle', lang)}</span>
              <p className="text-[11px] text-zinc-400 font-extrabold uppercase tracking-[0.2em]">{t('auditDesc', lang)}</p>
            </div>
          </div>
        </div>
      )}

      {explorerFaculty && (
        <FacultyExplorer
          faculty={explorerFaculty}
          posts={posts}
          user={user}
          lang={lang}
          userVotes={userVotes}
          onVote={handleVote}
          onClose={() => setExplorerFaculty(null)}
        />
      )}
    </div>
  );
};

export default App;
