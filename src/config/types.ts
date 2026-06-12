
export type CategoryId = 'pingpong' | 'sala-disponible' | 'sala-estudio' | 'sala-computacion' | 'baño' | 'comida' | 'tranquilo' | 'impresora' | 'casino' | 'deporte' | 'custom';

export interface Category {
  id: CategoryId;
  label: string;
  labelEn: string;
  color: string;
  svgPath: string;
}

export type UserRole = 'guest' | 'student' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  role: UserRole;
}

export interface Post {
  id: string;
  title: string;
  description: string;
  categoryId: CategoryId;
  lat: number;
  lng: number;
  creatorId: string;
  creatorName: string;
  createdAt: number;
  image?: string;
  votesUp: number;
  votesDown: number;
  reports: number;
  facultyId?: string;
  isPinned?: boolean; // Nueva propiedad para pines fijos por admin
}

export interface Campus {
  id: string;
  name: string;
  coords: [number, number];
}

export interface Career {
  name: string;
  nameEn: string;
}

export interface Faculty {
  id: string;
  name: string;
  nameEn: string;
  coords: [number, number];
  campusId: string;
  image?: string;
  polygon?: [number, number][];
  careers?: Career[];
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  userRole?: UserRole;
  text: string;
  timestamp: number;
  facultyId: string;
}
