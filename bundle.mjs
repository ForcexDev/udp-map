// scripts/gen_seed_full.ts
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// src/shared/data/facultyPerimeters.ts
var ENGINEERING_PERIMETER = {
  type: "Polygon",
  coordinates: [
    [
      [-70.6615718, -33.4525797],
      [-70.6614965, -33.452564],
      [-70.6613632, -33.4525355],
      [-70.661329, -33.4525282],
      [-70.6611799, -33.452497],
      [-70.6607075, -33.4524018],
      [-70.6606108, -33.4523819],
      [-70.6605349, -33.4527535],
      [-70.6606443, -33.4527745],
      [-70.661092, -33.452862],
      [-70.6610461, -33.4530498],
      [-70.6614801, -33.4531345],
      [-70.6615096, -33.4529593],
      [-70.6615424, -33.4527626],
      [-70.6615718, -33.4525797]
    ]
  ]
};
var BIBLIOTECA_PERIMETER = {
  type: "Polygon",
  coordinates: [
    [
      [-70.6617524, -33.4511991],
      [-70.6617027, -33.4514876],
      [-70.6614392, -33.4514596],
      [-70.6611724, -33.4514263],
      [-70.6611883, -33.4513286],
      [-70.6608072, -33.4512795],
      [-70.6608272, -33.4511741],
      [-70.6612107, -33.451225],
      [-70.6612256, -33.4511297],
      [-70.6617524, -33.4511991]
    ]
  ]
};
var CIENCIAS_SOCIALES_PERIMETER = {
  type: "Polygon",
  coordinates: [
    [
      [-70.6612107, -33.451225],
      [-70.6608272, -33.4511741],
      [-70.6608437, -33.4510797],
      [-70.6612256, -33.4511297],
      [-70.6612107, -33.451225]
    ]
  ]
};
var PSICOLOGIA_PERIMETER = {
  type: "Polygon",
  coordinates: [
    [
      [-70.6625259, -33.4509769],
      [-70.6619878, -33.4508662],
      [-70.6620683, -33.4503521],
      [-70.6626388, -33.4504068],
      [-70.6625258, -33.4509769]
    ]
  ]
};
var COMUNICACION_PERIMETER = {
  type: "Polygon",
  coordinates: [
    [
      [-70.6618979, -33.4500208],
      [-70.6618377, -33.4503372],
      [-70.6617932, -33.4503328],
      [-70.6616583, -33.4503195],
      [-70.661344, -33.4502884],
      [-70.6612149, -33.4502757],
      [-70.6612297, -33.4501733],
      [-70.6614232, -33.4501955],
      [-70.6614478, -33.4499814],
      [-70.6618591, -33.450018],
      [-70.6618979, -33.4500208]
    ]
  ]
};
var AULARIO_PERIMETER = {
  type: "Polygon",
  coordinates: [
    [
      [-70.6606097, -33.4509824],
      [-70.6605834, -33.4510969],
      [-70.6601225, -33.4510213],
      [-70.6601479, -33.4509103],
      [-70.6606088, -33.4509831]
    ]
  ]
};
var COMERCIO_PERIMETER = {
  type: "Polygon",
  coordinates: [
    [
      [-70.6606104, -33.4509786],
      [-70.6606413, -33.4508397],
      [-70.660196, -33.4507652],
      [-70.6601523, -33.4509041],
      [-70.6606097, -33.4509785]
    ]
  ]
};
var SALUD_PERIMETER = {
  type: "Polygon",
  coordinates: [
    [
      [-70.6607551, -33.4502214],
      [-70.6604027, -33.4501413],
      [-70.660448, -33.4499622],
      [-70.6603207, -33.4499389],
      [-70.6603782, -33.4497016],
      [-70.6600502, -33.4496288],
      [-70.6598111, -33.4504645],
      [-70.6601217, -33.4505271],
      [-70.6601758, -33.4503452],
      [-70.6605859, -33.4504281],
      [-70.6606156, -33.4503393],
      [-70.6607307, -33.4503655],
      [-70.6607551, -33.4502214]
    ]
  ]
};
var FILOSOFIA_PERIMETER = {
  type: "Polygon",
  coordinates: [
    [
      [-70.6604498, -33.4499617],
      [-70.6604041, -33.4501411],
      [-70.6607577, -33.4502168],
      [-70.6607928, -33.4500354],
      [-70.6604498, -33.4499617]
    ]
  ]
};
var EDUCACION_PERIMETER = {
  type: "Polygon",
  coordinates: [
    [
      [-70.661917, -33.4497927],
      [-70.6618967, -33.4499705],
      [-70.6614767, -33.4499313],
      [-70.6615101, -33.4497151],
      [-70.661917, -33.4497927]
    ]
  ]
};
var DEPORTES_PERIMETER = {
  type: "Polygon",
  coordinates: [
    [
      [-70.6600011, -33.451545],
      [-70.6600705, -33.451201],
      [-70.6595486, -33.4511041],
      [-70.6594465, -33.4514434],
      [-70.6599981, -33.4515484],
      [-70.6600011, -33.451545]
    ]
  ]
};
var DTI_PERIMETER = {
  type: "Polygon",
  coordinates: [
    [
      [-70.6596758, -33.4507993],
      [-70.6597937, -33.4508217],
      [-70.6598018, -33.4507937],
      [-70.6599276, -33.4508182],
      [-70.6598668, -33.4510417],
      [-70.6600982, -33.4510858],
      [-70.6600844, -33.451143],
      [-70.6600774, -33.4511715],
      [-70.6600741, -33.4511858],
      [-70.6600722, -33.451193],
      [-70.6600701, -33.4512022],
      [-70.6596611, -33.4511249],
      [-70.6596787, -33.4510606],
      [-70.6596069, -33.4510466],
      [-70.6596758, -33.4507993]
    ]
  ]
};
var MEDICINA_PERIMETER = {
  type: "Polygon",
  coordinates: [
    [
      [-70.6615492, -33.4486101],
      [-70.6615162, -33.448796],
      [-70.6612569, -33.4487625],
      [-70.6612899, -33.4485745],
      [-70.6615492, -33.4486101]
    ]
  ]
};
var HUECHURABA_PERIMETER = {
  type: "Polygon",
  coordinates: [
    [
      [-70.6128535, -33.3943754],
      [-70.6136567, -33.393674],
      [-70.6129, -33.3916369],
      [-70.6118879, -33.3918857],
      [-70.611865, -33.3928583],
      [-70.6118726, -33.3930592],
      [-70.6119834, -33.3932696],
      [-70.6121744, -33.3935056],
      [-70.6125448, -33.3939903],
      [-70.6128045, -33.394408],
      [-70.6128535, -33.3943754]
    ]
  ]
};
var DERECHO_PERIMETER = {
  type: "Polygon",
  coordinates: [
    [
      [-70.6681863, -33.4505432],
      [-70.6681332, -33.4505282],
      [-70.668073, -33.4505105],
      [-70.6681595, -33.4500784],
      [-70.6688408, -33.4502376],
      [-70.6688235, -33.4503417],
      [-70.6687416, -33.4506516],
      [-70.6681863, -33.4505432]
    ]
  ]
};
var ARQUITECTURA_PERIMETER = {
  type: "Polygon",
  coordinates: [
    [
      [-70.6670801, -33.4496681],
      [-70.6671163, -33.4494033],
      [-70.6673897, -33.4494504],
      [-70.6674262, -33.4493056],
      [-70.6673925, -33.449301],
      [-70.6674205, -33.4491518],
      [-70.6670258, -33.4491292],
      [-70.6670152, -33.4491989],
      [-70.6668807, -33.4491955],
      [-70.6667702, -33.4495942],
      [-70.6670801, -33.4496681]
    ]
  ]
};
var FACULTY_PERIMETERS = {
  ingenieria: ENGINEERING_PERIMETER,
  biblioteca: BIBLIOTECA_PERIMETER,
  "ciencias-sociales": CIENCIAS_SOCIALES_PERIMETER,
  psicologia: PSICOLOGIA_PERIMETER,
  comunicacion: COMUNICACION_PERIMETER,
  aulario: AULARIO_PERIMETER,
  comercio: COMERCIO_PERIMETER,
  salud: SALUD_PERIMETER,
  filosofia: FILOSOFIA_PERIMETER,
  educacion: EDUCACION_PERIMETER,
  deportes: DEPORTES_PERIMETER,
  dti: DTI_PERIMETER,
  medicina: MEDICINA_PERIMETER,
  derecho: DERECHO_PERIMETER,
  arquitectura: ARQUITECTURA_PERIMETER,
  economia: HUECHURABA_PERIMETER
};

// src/shared/data/campusData.ts
var CAMPUSES = [
  { id: "ejercito", name: "Campus Centro", lat: -33.45129, lng: -70.66103 },
  { id: "republica", name: "Campus Rep\xFAblica", lat: -33.449695, lng: -70.667732 },
  { id: "huechuraba", name: "Campus Huechuraba", lat: -33.39337, lng: -70.61283 }
];
function squareAround(lat, lng, d = 45e-5) {
  return {
    type: "Polygon",
    coordinates: [
      [
        [lng - d, lat - d],
        [lng + d, lat - d],
        [lng + d, lat + d],
        [lng - d, lat + d],
        [lng - d, lat - d]
      ]
    ]
  };
}
var f = (id, name, name_en, campus_id, lat, lng, image = null) => ({
  id,
  name,
  name_en,
  campus_id,
  lat,
  lng,
  // Perímetro real si está trazado (hoy solo 'ingenieria'); si no, huella aproximada.
  polygon: FACULTY_PERIMETERS[id] ?? squareAround(lat, lng),
  image
});
var FACULTIES = [
  f("ingenieria", "Facultad de Ingenier\xEDa y Ciencias", "Faculty of Engineering and Sciences", "ejercito", -33.45276, -70.66105, "/fic.png"),
  f("medicina", "Facultad de Medicina", "Faculty of Medicine", "ejercito", -33.44864, -70.66134, "https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=200&h=200&fit=crop&q=60"),
  f("psicologia", "Facultad de Psicolog\xEDa", "Faculty of Psychology", "ejercito", -33.45066, -70.66232, "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=200&h=200&fit=crop&q=60"),
  f("salud", "Facultad de Salud y Odontolog\xEDa", "Faculty of Health and Dentistry", "ejercito", -33.4502132338048, -70.6603284462864, "https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=200&h=200&fit=crop&q=60"),
  f("derecho", "Facultad de Derecho", "Faculty of Law", "republica", -33.4502188787352, -70.6681844018121, "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=200&h=200&fit=crop&q=60"),
  f("postgrado-derecho", "Facultad de Postgrado Derecho UDP", "Postgraduate Law Faculty", "republica", -33.4500562754381, -70.6677788388334, "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=200&h=200&fit=crop&q=60"),
  f("arquitectura", "Facultad de Arquitectura, Arte y Dise\xF1o", "Faculty of Architecture, Art and Design", "republica", -33.4494756997435, -70.6669349979822, "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=200&h=200&fit=crop&q=60"),
  f("comunicacion", "Facultad de Comunicaci\xF3n y Letras", "Faculty of Communication and Letters", "ejercito", -33.4501, -70.66166, "https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=200&h=200&fit=crop&q=60"),
  f("ciencias-sociales", "Facultad de Ciencias Sociales e Historia", "Faculty of Social Sciences and History", "ejercito", -33.4511241180899, -70.6608646153093, "https://images.unsplash.com/photo-1531548731165-c6ae86ff6491?w=200&h=200&fit=crop&q=60"),
  f("educacion", "Facultad de Educaci\xF3n", "Faculty of Education", "ejercito", -33.44991, -70.66186, "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=200&h=200&fit=crop&q=60"),
  f("biblioteca", "Biblioteca Nicanor Parra", "Nicanor Parra Library", "ejercito", -33.4512852716982, -70.6617168264727, "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=200&h=200&fit=crop&q=60"),
  f("economia", "Facultad de Econom\xEDa y Empresa", "Faculty of Economics and Business", "huechuraba", -33.39337, -70.61283, "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=200&h=200&fit=crop&q=60"),
  f("aulario", "Aulario UDP", "UDP Classrooms", "ejercito", -33.451, -70.66037, "https://images.unsplash.com/photo-1577896851231-70ef18881754?w=200&h=200&fit=crop&q=60"),
  f("filosofia", "Instituto de Filosof\xEDa", "Institute of Philosophy", "ejercito", -33.45009, -70.6606, "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=200&h=200&fit=crop&q=60"),
  f("deportes", "UDP Centro de Deportes", "UDP Sports Center", "ejercito", -33.4513333530393, -70.6595911336277, "https://images.unsplash.com/photo-1517649763962-0c623066013b?w=200&h=200&fit=crop&q=60"),
  f("dti", "UDP Oficina DTI", "UDP IT Office (DTI)", "ejercito", -33.4509322062588, -70.6597607833481, "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=200&h=200&fit=crop&q=60"),
  f("comercio", "Facultad de Comercio", "Faculty of Commerce", "ejercito", -33.4508949239208, -70.6606009331726, "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=200&h=200&fit=crop&q=60")
];
var STATIC_FACULTY_IDS = new Set(FACULTIES.map((x) => x.id));
var CAREERS = [
  // Administración y Economía (ID: economia)
  { faculty_id: "economia", name: "Administraci\xF3n P\xFAblica", name_en: "Public Administration" },
  { faculty_id: "economia", name: "Bachillerato en Administraci\xF3n y Econom\xEDa", name_en: "Baccalaureate in Administration and Economics" },
  { faculty_id: "economia", name: "Contador Auditor - Contador P\xFAblico", name_en: "Auditing and Public Accounting" },
  { faculty_id: "economia", name: "Ingenier\xEDa Comercial", name_en: "Business Engineering" },
  { faculty_id: "economia", name: "Ingenier\xEDa en Control de Gesti\xF3n", name_en: "Management Control Engineering" },
  // Ciencias Sociales y Humanidades (ID: ciencias-sociales)
  { faculty_id: "ciencias-sociales", name: "Administraci\xF3n P\xFAblica", name_en: "Public Administration" },
  { faculty_id: "ciencias-sociales", name: "Antropolog\xEDa", name_en: "Anthropology" },
  { faculty_id: "ciencias-sociales", name: "Bachillerato en Ciencias Sociales y Humanidades", name_en: "Baccalaureate in Social Sciences and Humanities" },
  { faculty_id: "ciencias-sociales", name: "Ciencia Pol\xEDtica", name_en: "Political Science" },
  { faculty_id: "ciencias-sociales", name: "Licenciatura en Historia", name_en: "Bachelor in History" },
  { faculty_id: "ciencias-sociales", name: "Sociolog\xEDa", name_en: "Sociology" },
  // Arquitectura, Arte y Diseño (ID: arquitectura)
  { faculty_id: "arquitectura", name: "Arquitectura", name_en: "Architecture" },
  { faculty_id: "arquitectura", name: "Artes Visuales", name_en: "Visual Arts" },
  { faculty_id: "arquitectura", name: "Dise\xF1o", name_en: "Design" },
  // Comunicación y Letras (ID: comunicacion)
  { faculty_id: "comunicacion", name: "Cine de Animaci\xF3n", name_en: "Animation Cinema" },
  { faculty_id: "comunicacion", name: "Cine y Realizaci\xF3n Audiovisual", name_en: "Cinema and Audiovisual Production" },
  { faculty_id: "comunicacion", name: "Literatura Creativa", name_en: "Creative Literature" },
  { faculty_id: "comunicacion", name: "Periodismo", name_en: "Journalism" },
  { faculty_id: "comunicacion", name: "Publicidad", name_en: "Advertising" },
  // Derecho (ID: derecho)
  { faculty_id: "derecho", name: "Derecho", name_en: "Law" },
  // Salud y Odontología (ID: salud)
  { faculty_id: "salud", name: "Enfermer\xEDa", name_en: "Nursing" },
  { faculty_id: "salud", name: "Kinesiolog\xEDa", name_en: "Kinesiology" },
  { faculty_id: "salud", name: "Obstetricia y Neonatolog\xEDa", name_en: "Obstetrics and Neonatology" },
  { faculty_id: "salud", name: "Odontolog\xEDa", name_en: "Dentistry" },
  { faculty_id: "salud", name: "Tecnolog\xEDa M\xE9dica", name_en: "Medical Technology" },
  // Ingeniería y Ciencias (ID: ingenieria)
  { faculty_id: "ingenieria", name: "Ingenier\xEDa Civil en Ciencia de Datos e Inteligencia Artificial", name_en: "Data Science and AI Engineering" },
  { faculty_id: "ingenieria", name: "Ingenier\xEDa Civil en Inform\xE1tica y Telecomunicaciones", name_en: "IT and Telecommunications Engineering" },
  { faculty_id: "ingenieria", name: "Ingenier\xEDa Civil en Obras Civiles", name_en: "Civil Engineering" },
  { faculty_id: "ingenieria", name: "Ingenier\xEDa Civil Industrial", name_en: "Industrial Engineering" },
  { faculty_id: "ingenieria", name: "Ingenier\xEDa Civil Plan Com\xFAn", name_en: "Common Core Engineering" },
  // Medicina (ID: medicina)
  { faculty_id: "medicina", name: "Medicina", name_en: "Medicine" },
  // Educación (ID: educacion)
  { faculty_id: "educacion", name: "Pedagog\xEDa en Educaci\xF3n Diferencial con menci\xF3n en Desarrollo Cognitivo", name_en: "Special Education in Cognitive Development" },
  { faculty_id: "educacion", name: "Pedagog\xEDa en Educaci\xF3n General B\xE1sica", name_en: "Primary Education" },
  { faculty_id: "educacion", name: "Pedagog\xEDa en Educaci\xF3n Parvularia", name_en: "Early Childhood Education" },
  { faculty_id: "educacion", name: "Pedagog\xEDa en Historia y Ciencias Sociales", name_en: "History and Social Sciences Education" },
  { faculty_id: "educacion", name: "Pedagog\xEDa en Ingl\xE9s", name_en: "English Education" },
  { faculty_id: "educacion", name: "Pedagog\xEDa en Lengua Castellana y Comunicaci\xF3n", name_en: "Spanish Language and Communication Education" },
  { faculty_id: "educacion", name: "Pedagog\xEDa Media en Matem\xE1tica", name_en: "High School Mathematics Education" },
  // Psicología (ID: psicologia)
  { faculty_id: "psicologia", name: "Psicolog\xEDa", name_en: "Psychology" }
];
var CATEGORIES = [
  { id: "entrada", kind: "report", name: "Entrada", name_en: "Entrance", emoji: "\u{1F6AA}", color: "#D41F2D", svgPath: "M19 3h-4v2h4v14h-4v2h4c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM10.08 15.58 11.5 17l5-5-5-5-1.42 1.41L12.67 11H3v2h9.67l-2.59 2.58z", ttl_hours: null },
  // Infraestructura fija. Nacen con un mes de plazo —la ventana para que un
  // moderador las verifique— y al verificarse dejan de expirar. `sala` es la
  // sala como LUGAR, distinta de `sala-libre`, que es el aviso de que hay una
  // libre ahora mismo.
  { id: "sala", kind: "report", name: "Sala", name_en: "Room", emoji: "\u{1F6AA}", color: "#0EA5E9", svgPath: "M19 19V5c0-1.1-.9-2-2-2H7c-1.1 0-2 .9-2 2v14H3v2h18v-2h-2zm-4-6h-2v-2h2v2z", ttl_hours: 720 },
  // Ascensor y rampa son además la base del ruteo accesible: sin ellas, "cómo
  // llegar" en silla de ruedas solo sabe de veredas y deja a la persona en la
  // puerta de la escalera.
  { id: "ascensor", kind: "report", name: "Ascensor", name_en: "Elevator", emoji: "\u{1F6D7}", color: "#6366F1", svgPath: "M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm0 2v16h10V4H7zm5 2.5l3.5 4h-7l3.5-4zm0 11.5l-3.5-4h7l-3.5 4z", ttl_hours: 720 },
  { id: "rampa", kind: "report", name: "Rampa", name_en: "Ramp", emoji: "\u267F", color: "#0D9488", svgPath: "M9.08 5.88c.86-.08 1.53-.82 1.53-1.69C10.61 3.26 9.85 2.5 8.92 2.5s-1.69.76-1.69 1.69c0 .28.08.58.21.82l.6 8.49h6.22l2.55 5.97 3.35-1.31-.52-1.23-1.87.68-2.47-5.69-5.78.04-.08-1.08h4.18v-1.59h-4.34L9.08 5.88zM15.33 18.06c-1.05 2.07-3.24 3.44-5.59 3.44C6.31 21.5 3.5 18.69 3.5 15.25c0-2.42 1.46-4.66 3.65-5.65l.14 1.84c-1.29.81-2.09 2.28-2.09 3.82 0 2.5 2.04 4.53 4.53 4.53 2.28 0 4.23-1.75 4.5-4l1.1 2.27z", ttl_hours: 720 },
  // Estudio y Trabajo
  { id: "sala-libre", kind: "report", name: "Sala Libre", name_en: "Free Room", emoji: "\u{1F7E9}", color: "#10B981", svgPath: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z", ttl_hours: 6 },
  { id: "estudio", kind: "report", name: "Estudio", name_en: "Study", emoji: "\u{1F393}", color: "#3B82F6", svgPath: "M12 3L1 9l11 6 9-4.91V17h2V9L12 3z", ttl_hours: 12 },
  { id: "computacion", kind: "report", name: "Computaci\xF3n", name_en: "Computing", emoji: "\u{1F4BB}", color: "#06B6D4", svgPath: "M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z", ttl_hours: 12 },
  { id: "silencio", kind: "report", name: "Silencio", name_en: "Silence", emoji: "\u{1F3B5}", color: "#6366F1", svgPath: "M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z", ttl_hours: 12 },
  { id: "impresora", kind: "report", name: "Print", name_en: "Print", emoji: "\u{1F5A8}\uFE0F", color: "#EC4899", svgPath: "M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z", ttl_hours: 24 },
  { id: "enchufe", kind: "report", name: "Enchufe", name_en: "Outlet", emoji: "\u{1F50C}", color: "#2563eb", svgPath: "M7 7h10v3l-4 4v5h-2v-5l-4-4V7zm2-5h2v4H9V2zm4 0h2v4h-2V2z", ttl_hours: 12 },
  // Alimentación e Hidratación
  { id: "comida", kind: "report", name: "Comida", name_en: "Food", emoji: "\u{1F355}", color: "#F59E0B", svgPath: "M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z", ttl_hours: 12 },
  { id: "casino", kind: "report", name: "Casino", name_en: "Cafeteria", emoji: "\u{1F37D}\uFE0F", color: "#D41F2D", svgPath: "M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z", ttl_hours: 12 },
  { id: "food-truck", kind: "report", name: "Food truck", name_en: "Food truck", emoji: "\u{1F69A}", color: "#f97316", svgPath: "M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z", ttl_hours: 8 },
  { id: "microondas", kind: "report", name: "Microondas", name_en: "Microwave", emoji: "\u{1F371}", color: "#dc2626", svgPath: "M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1 .9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12zm-4-9h-2v2h2V9zm0 4h-2v2h2v-2zM6 8h8v8H6V8z", ttl_hours: 12 },
  { id: "agua", kind: "report", name: "Agua", name_en: "Water", emoji: "\u{1F4A7}", color: "#0ea5e9", svgPath: "M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2c0-3.32-2.67-7.25-8-11.8zM7.83 14c.37 0 .67.26.74.62.41 2.22 2.28 2.98 3.64 2.87.43-.02.79.32.79.75s-.35.79-.78.8c-2.02.05-4.64-1.25-5.17-4.11-.08-.42.23-.93.78-.93z", ttl_hours: 24 },
  // Infraestructura y Utilidades
  { id: "bano", kind: "report", name: "Ba\xF1o", name_en: "Restroom", emoji: "\u{1F6BB}", color: "#8B5CF6", svgPath: "M12 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm9 7h-6v13h-2v-6h-2v6H9V9H3V7h18v2z", ttl_hours: 24 },
  { id: "bicicletero", kind: "report", name: "Bicicletero", name_en: "Bike Rack", emoji: "\u{1F6B2}", color: "#059669", svgPath: "M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm5.8-10l2.4-2.4.8 .8c1.3 1.3 3 2.1 5.1 2.1V9c-1.5 0-2.7-.6-3.6-1.5l-1.9-1.9c-.5-.4-1-.6-1.6-.6s-1.1 .2-1.4 .6L7.8 8.4c-.4 .4-.6 .9-.6 1.4 0 .6 .2 1.1 .6 1.4L11 14v5h2v-6.2l-2.2-2.3zM19 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5z", ttl_hours: 24 },
  // Recreación
  { id: "ping-pong", kind: "report", name: "Ping Pong", name_en: "Ping Pong", emoji: "\u{1F3D3}", color: "#D41F2D", svgPath: "M 14.5 4 C 11.46 4 9 6.46 9 9.5 C 9 11.51 10.09 13.25 11.75 14.23 L 10 18.5 L 12 19 L 13.62 14.83 C 13.91 14.94 14.2 15 14.5 15 C 17.54 15 20 12.54 20 9.5 C 20 6.46 17.54 4 14.5 4 Z M 5.5 16 C 4.12 16 3 17.12 3 18.5 C 3 19.88 4.12 21 5.5 21 C 6.88 21 8 19.88 8 18.5 C 8 17.12 6.88 16 5.5 16 Z", ttl_hours: 12 },
  { id: "deporte", kind: "report", name: "Deporte", name_en: "Sports", emoji: "\u26BD", color: "#F97316", svgPath: "M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 19.86l-1.43-1.43L19.14 17l1.43-2.14z", ttl_hours: 12 },
  // Otros / Objetos
  { id: "objeto-perdido", kind: "report", name: "Objeto perdido", name_en: "Lost item", emoji: "\u{1F392}", color: "#8b5cf6", svgPath: "M17 1H7c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-2-2-2zm0 18H7V5h10v14zm-5-1c.83 0 1.5-.67 1.5-1.5S12.83 15 12 15s-1.5.67-1.5 1.5S11.17 18 12 18z", ttl_hours: 72 },
  { id: "objeto-encontrado", kind: "report", name: "Objeto encontrado", name_en: "Found item", emoji: "\u{1F9E2}", color: "#10b981", svgPath: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z", ttl_hours: 72 },
  { id: "easter-egg", kind: "report", name: "Easter Egg", name_en: "Easter Egg", emoji: "\u{1F95A}", color: "#a855f7", svgPath: "M12 2C8 2 5 6 5 12c0 5 3 10 7 10s7-5 7-10c0-6-3-10-7-10z", ttl_hours: null },
  { id: "otro", kind: "report", name: "Otro", name_en: "Other", emoji: "\u2728", color: "#ec4899", svgPath: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z", ttl_hours: 24 },
  // Categorías de eventos (Sprint 3, ya en la taxonomía)
  { id: "charla", kind: "event", name: "Charla", name_en: "Talk", emoji: "\u{1F3A4}", color: "#6366f1", svgPath: "M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z", ttl_hours: null },
  { id: "fiesta", kind: "event", name: "Fiesta", name_en: "Party", emoji: "\u{1F389}", color: "#d946ef", svgPath: "M12 6c1.11 0 2-.9 2-2 0-.38-.1-.73-.29-1.03L12 0l-1.71 2.97c-.19.3-.29.65-.29 1.03 0 1.1.9 2 2 2zm4.6 9.99l-1.07-1.07-1.08 1.07c-1.3 1.3-3.58 1.31-4.89 0l-1.07-1.07-1.09 1.07C6.75 16.64 5.88 17 4.96 17c-.73 0-1.4-.23-1.96-.61V21c0 .55.45 1 1 1h16c.55 0 1-.45 1-1v-4.61c-.56.38-1.23.61-1.96.61-.92 0-1.79-.36-2.44-1.01zM18 9h-5V7h-2v2H6c-1.66 0-3 1.34-3 3v1.54c0 1.08.88 1.96 1.96 1.96.52 0 1.02-.2 1.38-.57l2.14-2.13 2.13 2.13c.74.74 2.03.74 2.77 0l2.14-2.13 2.13 2.13c.37.37.86.57 1.38.57 1.08 0 1.96-.88 1.96-1.96V12c.01-1.66-1.33-3-2.99-3z", ttl_hours: null },
  { id: "deporte-evento", kind: "event", name: "Competencia", name_en: "Competition", emoji: "\u{1F3C6}", color: "#16a34a", svgPath: "M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z", ttl_hours: null },
  { id: "ayudantia", kind: "event", name: "Ayudant\xEDa", name_en: "Tutoring", emoji: "\u{1F9D1}\u200D\u{1F3EB}", color: "#0ea5e9", svgPath: "M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z", ttl_hours: null },
  { id: "feria", kind: "event", name: "Feria", name_en: "Fair", emoji: "\u{1F3AA}", color: "#eab308", svgPath: "M12 2 3 7v2h18V7l-9-5zm-7 9v9h4v-6h6v6h4v-9H5zm7 3h-2v3h2v-3z", ttl_hours: null }
];

// scripts/gen_seed_full.ts
var __dirname = path.dirname(fileURLToPath(import.meta.url));
var seedPath = path.join(__dirname, "../supabase/seed/seed.sql");
var sql = `-- \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
`;
sql += `-- Seed: campus, facultades (\u2192 place pins), carreras, categor\xEDas,
`;
sql += `-- plano indoor demo y lista de admins.
`;
sql += `-- \u26A0\uFE0F Sincronizado autom\xE1ticamente desde campusData.ts
`;
sql += `-- \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

`;
sql += `insert into campuses (id, name, lat, lng) values
`;
sql += CAMPUSES.map((c) => `  ('${c.id}', '${c.name}', ${c.lat}, ${c.lng})`).join(",\n");
sql += `
on conflict (id) do nothing;

`;
sql += `insert into faculties (id, name, name_en, campus_id, lat, lng, image) values
`;
sql += FACULTIES.map((f2) => `  ('${f2.id}', '${f2.name}', '${f2.name_en}', '${f2.campus_id}', ${f2.lat}, ${f2.lng}, ${f2.image ? `'${f2.image}'` : "null"})`).join(",\n");
sql += `
on conflict (id) do nothing;

`;
sql += `-- \u2500\u2500 Pol\xEDgonos reales (exportados de facultyPerimeters.ts) \u2500\u2500
`;
for (const f2 of FACULTIES) {
  const perimeter = FACULTY_PERIMETERS[f2.id];
  if (perimeter) {
    sql += `update faculties set polygon = '${JSON.stringify(perimeter)}'::jsonb where id = '${f2.id}';
`;
  }
}
sql += `
`;
sql += `insert into careers (faculty_id, name, name_en) values
`;
sql += CAREERS.map((c) => `  ('${c.faculty_id}', '${c.name}', '${c.name_en}')`).join(",\n");
sql += `;

`;
sql += `insert into categories (id, kind, name, name_en, color, svg_path, ttl_hours) values
`;
sql += CATEGORIES.map((c) => `  ('${c.id}', '${c.kind}', '${c.name}', '${c.name_en}', '${c.color}', '${c.svgPath}', ${c.ttl_hours === null ? "null" : c.ttl_hours})`).join(",\n");
sql += `
on conflict (id) do nothing;

`;
sql += `-- \u2500\u2500 Facultades como pines \`place\` permanentes \u2500\u2500
`;
sql += `insert into pins (type, title, faculty_id, lat, lng, is_permanent, is_official)
`;
sql += `select 'place', f.name, f.id, f.lat, f.lng, true, true
`;
sql += `from faculties f
`;
sql += `where not exists (
`;
sql += `  select 1 from pins p where p.type = 'place' and p.faculty_id = f.id
`;
sql += `);

`;
sql += `-- \u2500\u2500 Admins iniciales \u2500\u2500
`;
sql += `-- No van aqu\xED: son correos de personas reales y este archivo est\xE1 en el
`;
sql += `-- repositorio. Se insertan a mano tras un reset, y ANTES de que esas personas
`;
sql += `-- se registren, porque el rol admin se asigna en el alta y no despu\xE9s:
`;
sql += `--
`;
sql += `--   insert into admin_emails (email) values ('alguien@mail.udp.cl');
`;
sql += `--
`;
sql += `-- Ver el runbook en docs/DATABASE.md, secci\xF3n 10.
`;
fs.writeFileSync(seedPath, sql);
console.log("\u2705 seed.sql REGENERADO COMPLETAMENTE con toda la data de campusData.ts.");
