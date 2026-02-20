export type Lang = 'es' | 'en';

export function detectLang(): Lang {
    const saved = localStorage.getItem('udp_lang');
    if (saved === 'es' || saved === 'en') return saved;
    const nav = navigator.language?.toLowerCase() || '';
    return nav.startsWith('es') ? 'es' : 'en';
}

const translations = {
    // ── Login ──
    loginSubtitle: { es: 'La plataforma colaborativa para la comunidad', en: 'The collaborative platform for the' },
    loginUniversity: { es: 'Universidad Diego Portales', en: 'Universidad Diego Portales' },
    loginButton: { es: 'Continuar con Google', en: 'Continue with Google' },
    loginFooter: { es: 'Cualquier correo puede acceder • UDP tiene acceso completo', en: 'Any email can access • UDP gets full access' },
    loginError: { es: 'Error de acceso', en: 'Access error' },
    loginGoogleError: { es: 'Error al conectar con Google. Reintenta.', en: 'Error connecting to Google. Retry.' },
    loginGoogleFail: { es: 'No se pudo iniciar sesión con Google.', en: 'Could not sign in with Google.' },
    profileTitle: { es: 'Tu Identidad', en: 'Your Identity' },
    profileSubtitle: { es: 'Personaliza tu perfil udp', en: 'Customize your UDP profile' },
    profileAlias: { es: 'Alias en el mapa', en: 'Map alias' },
    profilePlaceholder: { es: 'Escribe tu alias...', en: 'Enter your alias...' },
    profileCreating: { es: 'Creando Perfil...', en: 'Creating Profile...' },
    profileStart: { es: 'Comienza a explorar', en: 'Start exploring' },
    guestBadge: { es: 'Modo Invitado — Solo ver y chatear', en: 'Guest Mode — View and chat only' },
    adminBadge: { es: 'Administrador', en: 'Administrator' },

    // ── Onboarding ──
    onboardSkip: { es: 'Saltar', en: 'Skip' },
    onboardNext: { es: 'Siguiente', en: 'Next' },
    onboardStart: { es: 'Comenzar', en: 'Get Started' },
    onboard1Title: { es: 'Explora tu campus', en: 'Explore your campus' },
    onboard1Desc: { es: 'Descubre salas libres, puntos de comida, mesas de ping pong y más. Todo reportado por estudiantes como tú.', en: 'Discover free rooms, food spots, ping pong tables and more. All reported by students like you.' },
    onboard2Title: { es: 'Reporta lo que encuentres', en: 'Report what you find' },
    onboard2Desc: { es: 'Usa el botón + para fijar un pin. Elige categoría, agrega foto y comparte con la comunidad UDP.', en: 'Use the + button to place a pin. Choose a category, add a photo and share with the UDP community.' },
    onboard3Title: { es: 'Vota y mejora', en: 'Vote and improve' },
    onboard3Desc: { es: 'Vota los reportes útiles para que se destaquen. Los reportes con muchos downvotes desaparecen.', en: 'Upvote useful reports so they stand out. Reports with many downvotes fade away.' },
    onboard4Title: { es: 'Conecta con tu gente', en: 'Connect with your people' },
    onboard4Desc: { es: 'Chatea en tiempo real con compañeros de tu facultad. Pregunta por un aula o comparte tips.', en: 'Chat in real time with classmates from your faculty. Ask about a room or share tips.' },

    // ── MapHUD ──
    hudAdmin: { es: 'Admin', en: 'Admin' },
    hudGuest: { es: 'Invitado', en: 'Guest' },
    hudCampus: { es: 'Campus', en: 'Campus' },
    hudChooseLocation: { es: 'Elegir Ubicación', en: 'Choose Location' },
    hudMoveMap: { es: 'Mueve el mapa para posicionar', en: 'Move the map to position' },
    hudCancel: { es: 'Cancelar', en: 'Cancel' },
    hudConfirm: { es: 'Confirmar', en: 'Confirm' },

    // ── MapMarker ──
    markerPinned: { es: '✓ Fijo', en: '✓ Pinned' },
    markerGuestVote: { es: 'Inicia con correo UDP para votar', en: 'Sign in with UDP email to vote' },
    markerUnpin: { es: 'Quitar pin', en: 'Unpin' },
    markerPin: { es: 'Fijar pin', en: 'Pin' },
    markerDelete: { es: 'Eliminar', en: 'Delete' },
    markerDeleteConfirm: { es: '¿Seguro que quieres eliminar este reporte?', en: 'Are you sure you want to delete this report?' },

    // ── AddPostModal ──
    addTitle: { es: 'Nuevo Reporte', en: 'New Report' },
    addMainInfo: { es: 'Información principal', en: 'Main information' },
    addTitlePlaceholder: { es: '¿Qué has encontrado?', en: 'What did you find?' },
    addPhoto: { es: 'Evidencia visual (Opcional)', en: 'Visual evidence (Optional)' },
    addCapture: { es: 'Capturar Foto', en: 'Capture Photo' },
    addCategory: { es: 'Elegir categoría', en: 'Choose category' },
    addNotes: { es: 'Notas adicionales', en: 'Additional notes' },
    addNotesPlaceholder: { es: 'Ej: Quinto piso, al lado de la biblioteca...', en: 'E.g.: Fifth floor, next to the library...' },
    addSubmit: { es: 'Confirmar Reporte', en: 'Confirm Report' },
    addUploadError: { es: 'Error al subir la imagen. Reintenta.', en: 'Error uploading image. Retry.' },

    // ── Sidebar ──
    sideSettings: { es: 'Ajustes', en: 'Settings' },
    sideCommunity: { es: 'Comunidad', en: 'Community' },
    sideCampus: { es: 'Sede Universitaria', en: 'Campus' },
    sideCategories: { es: 'Categorías Activas', en: 'Active Categories' },
    sideLanguage: { es: 'Idioma', en: 'Language' },
    sideLogout: { es: 'Cerrar Sesión', en: 'Log Out' },
    sideStartChat: { es: 'Empieza la charla', en: 'Start chatting' },
    sideGuest: { es: 'Invitado', en: 'Guest' },
    sideSpanish: { es: 'Español', en: 'Español' },
    sideEnglish: { es: 'English', en: 'English' },
    sideMsgPlaceholder: { es: 'Mensaje en', en: 'Message in' },

    // ── FacultyExplorer ──
    explorerReports: { es: 'reportes', en: 'reports' },
    explorerExplore: { es: 'UDP Campus • Explora los reportes', en: 'UDP Campus • Explore the reports' },
    explorerEmpty: { es: 'Sin reportes aún', en: 'No reports yet' },
    explorerBeFirst: { es: 'Sé el primero en reportar algo en', en: 'Be the first to report something in' },
    explorerCloseHint: { es: 'Cierra y usa el botón + en el mapa.', en: 'Close and use the + button on the map.' },

    // ── App / Toast / Audit ──
    toastNewPin: { es: '📍 Nuevo pin:', en: '📍 New pin:' },
    toastGoVote: { es: '¡Ve a votarlo!', en: 'Go vote on it!' },
    auditTitle: { es: 'Auditando reporte', en: 'Auditing report' },
    auditDesc: { es: 'Escaneando contenido con IA...', en: 'Scanning content with AI...' },
    permDenied: { es: 'Permiso denegado.', en: 'Permission denied.' },
    errSave: { es: 'Error al guardar:', en: 'Error saving:' },
    errConnection: { es: 'Verifica tu conexión a Supabase', en: 'Check your Supabase connection' },

    // ── timeAgo (mapUtils) ──
    timeNow: { es: 'ahora', en: 'now' },
    timeAgoPrefix: { es: 'hace', en: '' },
    timeAgoSuffix: { es: '', en: 'ago' },
} as const;

export type TKey = keyof typeof translations;

export function t(key: TKey, lang: Lang): string {
    return translations[key]?.[lang] ?? translations[key]?.['es'] ?? key;
}

/** Get translated category label */
export function catLabel(cat: { label: string; labelEn: string }, lang: Lang): string {
    return lang === 'en' ? cat.labelEn : cat.label;
}

/** Get translated faculty name */
export function facName(fac: { name: string; nameEn: string }, lang: Lang): string {
    return lang === 'en' ? fac.nameEn : fac.name;
}

export default translations;
