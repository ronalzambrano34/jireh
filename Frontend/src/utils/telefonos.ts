export type CountryPhoneCode = {
  code: string;
  flag: string;
  label: string;
  localDigits: number;
};

export const PHONE_CODES_CONFIG_KEY = 'codigos_pais_telefono_activos';
export const PHONE_CODES_STORAGE_KEY = 'jireh.phoneCodes.active';
export const PHONE_CODES_CHANGED_EVENT = 'jireh:phone-codes-changed';
export const DEFAULT_ACTIVE_PHONE_CODES = ['+53', '+55', '+598'];

export const COUNTRY_PHONE_CODES: CountryPhoneCode[] = [
  { code: '+53', flag: '🇨🇺', label: 'Cuba', localDigits: 8 },
  { code: '+55', flag: '🇧🇷', label: 'Brasil', localDigits: 10 },
  { code: '+598', flag: '🇺🇾', label: 'Uruguay', localDigits: 8 },
  { code: '+1', flag: '🇺🇸', label: 'EE.UU.', localDigits: 10 },
  { code: '+34', flag: '🇪🇸', label: 'España', localDigits: 9 },
  { code: '+54', flag: '🇦🇷', label: 'Argentina', localDigits: 10 },
  { code: '+56', flag: '🇨🇱', label: 'Chile', localDigits: 9 },
  { code: '+57', flag: '🇨🇴', label: 'Colombia', localDigits: 10 },
  { code: '+58', flag: '🇻🇪', label: 'Venezuela', localDigits: 10 },
  { code: '+51', flag: '🇵🇪', label: 'Peru', localDigits: 9 },
  { code: '+52', flag: '🇲🇽', label: 'Mexico', localDigits: 10 },
  { code: '+593', flag: '🇪🇨', label: 'Ecuador', localDigits: 9 },
  { code: '+595', flag: '🇵🇾', label: 'Paraguay', localDigits: 9 },
  { code: '+591', flag: '🇧🇴', label: 'Bolivia', localDigits: 8 },
  { code: '+507', flag: '🇵🇦', label: 'Panama', localDigits: 8 },
  { code: '+506', flag: '🇨🇷', label: 'Costa Rica', localDigits: 8 },
  { code: '+505', flag: '🇳🇮', label: 'Nicaragua', localDigits: 8 },
  { code: '+504', flag: '🇭🇳', label: 'Honduras', localDigits: 8 },
  { code: '+503', flag: '🇸🇻', label: 'El Salvador', localDigits: 8 },
  { code: '+502', flag: '🇬🇹', label: 'Guatemala', localDigits: 8 },
  { code: '+501', flag: '🇧🇿', label: 'Belice', localDigits: 7 },
  { code: '+509', flag: '🇭🇹', label: 'Haiti', localDigits: 8 },
  { code: '+1809', flag: '🇩🇴', label: 'Rep. Dominicana', localDigits: 7 },
  { code: '+1787', flag: '🇵🇷', label: 'Puerto Rico', localDigits: 7 },
  { code: '+1242', flag: '🇧🇸', label: 'Bahamas', localDigits: 7 },
  { code: '+1246', flag: '🇧🇧', label: 'Barbados', localDigits: 7 },
  { code: '+1876', flag: '🇯🇲', label: 'Jamaica', localDigits: 7 },
  { code: '+1868', flag: '🇹🇹', label: 'Trinidad y Tobago', localDigits: 7 },
  { code: '+44', flag: '🇬🇧', label: 'Reino Unido', localDigits: 10 },
  { code: '+33', flag: '🇫🇷', label: 'Francia', localDigits: 9 },
  { code: '+49', flag: '🇩🇪', label: 'Alemania', localDigits: 10 },
  { code: '+39', flag: '🇮🇹', label: 'Italia', localDigits: 10 },
  { code: '+351', flag: '🇵🇹', label: 'Portugal', localDigits: 9 },
  { code: '+31', flag: '🇳🇱', label: 'Paises Bajos', localDigits: 9 },
  { code: '+32', flag: '🇧🇪', label: 'Belgica', localDigits: 9 },
  { code: '+41', flag: '🇨🇭', label: 'Suiza', localDigits: 9 },
  { code: '+46', flag: '🇸🇪', label: 'Suecia', localDigits: 9 },
  { code: '+47', flag: '🇳🇴', label: 'Noruega', localDigits: 8 },
  { code: '+45', flag: '🇩🇰', label: 'Dinamarca', localDigits: 8 },
  { code: '+358', flag: '🇫🇮', label: 'Finlandia', localDigits: 9 },
  { code: '+353', flag: '🇮🇪', label: 'Irlanda', localDigits: 9 },
  { code: '+43', flag: '🇦🇹', label: 'Austria', localDigits: 10 },
  { code: '+30', flag: '🇬🇷', label: 'Grecia', localDigits: 10 },
  { code: '+48', flag: '🇵🇱', label: 'Polonia', localDigits: 9 },
  { code: '+420', flag: '🇨🇿', label: 'Chequia', localDigits: 9 },
  { code: '+36', flag: '🇭🇺', label: 'Hungria', localDigits: 9 },
  { code: '+40', flag: '🇷🇴', label: 'Rumania', localDigits: 9 },
  { code: '+359', flag: '🇧🇬', label: 'Bulgaria', localDigits: 9 },
  { code: '+385', flag: '🇭🇷', label: 'Croacia', localDigits: 9 },
  { code: '+381', flag: '🇷🇸', label: 'Serbia', localDigits: 9 },
  { code: '+386', flag: '🇸🇮', label: 'Eslovenia', localDigits: 8 },
  { code: '+421', flag: '🇸🇰', label: 'Eslovaquia', localDigits: 9 },
  { code: '+380', flag: '🇺🇦', label: 'Ucrania', localDigits: 9 },
  { code: '+7', flag: '🇷🇺', label: 'Rusia/Kazajistan', localDigits: 10 },
  { code: '+90', flag: '🇹🇷', label: 'Turquia', localDigits: 10 },
  { code: '+212', flag: '🇲🇦', label: 'Marruecos', localDigits: 9 },
  { code: '+213', flag: '🇩🇿', label: 'Argelia', localDigits: 9 },
  { code: '+216', flag: '🇹🇳', label: 'Tunez', localDigits: 8 },
  { code: '+20', flag: '🇪🇬', label: 'Egipto', localDigits: 10 },
  { code: '+27', flag: '🇿🇦', label: 'Sudafrica', localDigits: 9 },
  { code: '+234', flag: '🇳🇬', label: 'Nigeria', localDigits: 10 },
  { code: '+254', flag: '🇰🇪', label: 'Kenia', localDigits: 9 },
  { code: '+233', flag: '🇬🇭', label: 'Ghana', localDigits: 9 },
  { code: '+251', flag: '🇪🇹', label: 'Etiopia', localDigits: 9 },
  { code: '+971', flag: '🇦🇪', label: 'Emiratos Arabes', localDigits: 9 },
  { code: '+966', flag: '🇸🇦', label: 'Arabia Saudita', localDigits: 9 },
  { code: '+972', flag: '🇮🇱', label: 'Israel', localDigits: 9 },
  { code: '+974', flag: '🇶🇦', label: 'Qatar', localDigits: 8 },
  { code: '+965', flag: '🇰🇼', label: 'Kuwait', localDigits: 8 },
  { code: '+973', flag: '🇧🇭', label: 'Bahrein', localDigits: 8 },
  { code: '+968', flag: '🇴🇲', label: 'Oman', localDigits: 8 },
  { code: '+962', flag: '🇯🇴', label: 'Jordania', localDigits: 9 },
  { code: '+961', flag: '🇱🇧', label: 'Libano', localDigits: 8 },
  { code: '+91', flag: '🇮🇳', label: 'India', localDigits: 10 },
  { code: '+92', flag: '🇵🇰', label: 'Pakistan', localDigits: 10 },
  { code: '+880', flag: '🇧🇩', label: 'Bangladesh', localDigits: 10 },
  { code: '+94', flag: '🇱🇰', label: 'Sri Lanka', localDigits: 9 },
  { code: '+977', flag: '🇳🇵', label: 'Nepal', localDigits: 10 },
  { code: '+86', flag: '🇨🇳', label: 'China', localDigits: 11 },
  { code: '+81', flag: '🇯🇵', label: 'Japon', localDigits: 10 },
  { code: '+82', flag: '🇰🇷', label: 'Corea del Sur', localDigits: 10 },
  { code: '+852', flag: '🇭🇰', label: 'Hong Kong', localDigits: 8 },
  { code: '+853', flag: '🇲🇴', label: 'Macao', localDigits: 8 },
  { code: '+886', flag: '🇹🇼', label: 'Taiwan', localDigits: 9 },
  { code: '+65', flag: '🇸🇬', label: 'Singapur', localDigits: 8 },
  { code: '+60', flag: '🇲🇾', label: 'Malasia', localDigits: 9 },
  { code: '+66', flag: '🇹🇭', label: 'Tailandia', localDigits: 9 },
  { code: '+84', flag: '🇻🇳', label: 'Vietnam', localDigits: 9 },
  { code: '+62', flag: '🇮🇩', label: 'Indonesia', localDigits: 10 },
  { code: '+63', flag: '🇵🇭', label: 'Filipinas', localDigits: 10 },
  { code: '+855', flag: '🇰🇭', label: 'Camboya', localDigits: 9 },
  { code: '+856', flag: '🇱🇦', label: 'Laos', localDigits: 9 },
  { code: '+95', flag: '🇲🇲', label: 'Myanmar', localDigits: 9 },
  { code: '+61', flag: '🇦🇺', label: 'Australia', localDigits: 9 },
  { code: '+64', flag: '🇳🇿', label: 'Nueva Zelanda', localDigits: 9 },
  { code: '+675', flag: '🇵🇬', label: 'Papua Nueva Guinea', localDigits: 8 },
  { code: '+679', flag: '🇫🇯', label: 'Fiyi', localDigits: 7 },
  { code: '+93', flag: '🇦🇫', label: 'Afganistan', localDigits: 9 },
  { code: '+355', flag: '🇦🇱', label: 'Albania', localDigits: 9 },
  { code: '+376', flag: '🇦🇩', label: 'Andorra', localDigits: 6 },
  { code: '+244', flag: '🇦🇴', label: 'Angola', localDigits: 9 },
  { code: '+1264', flag: '🇦🇮', label: 'Anguila', localDigits: 7 },
  { code: '+1268', flag: '🇦🇬', label: 'Antigua y Barbuda', localDigits: 7 },
  { code: '+374', flag: '🇦🇲', label: 'Armenia', localDigits: 8 },
  { code: '+297', flag: '🇦🇼', label: 'Aruba', localDigits: 7 },
  { code: '+994', flag: '🇦🇿', label: 'Azerbaiyan', localDigits: 9 },
  { code: '+375', flag: '🇧🇾', label: 'Bielorrusia', localDigits: 9 },
  { code: '+229', flag: '🇧🇯', label: 'Benin', localDigits: 8 },
  { code: '+1441', flag: '🇧🇲', label: 'Bermudas', localDigits: 7 },
  { code: '+975', flag: '🇧🇹', label: 'Butan', localDigits: 8 },
  { code: '+387', flag: '🇧🇦', label: 'Bosnia y Herzegovina', localDigits: 8 },
  { code: '+267', flag: '🇧🇼', label: 'Botsuana', localDigits: 8 },
  { code: '+673', flag: '🇧🇳', label: 'Brunei', localDigits: 7 },
  { code: '+226', flag: '🇧🇫', label: 'Burkina Faso', localDigits: 8 },
  { code: '+257', flag: '🇧🇮', label: 'Burundi', localDigits: 8 },
  { code: '+238', flag: '🇨🇻', label: 'Cabo Verde', localDigits: 7 },
  { code: '+237', flag: '🇨🇲', label: 'Camerun', localDigits: 9 },
  { code: '+236', flag: '🇨🇫', label: 'Rep. Centroafricana', localDigits: 8 },
  { code: '+235', flag: '🇹🇩', label: 'Chad', localDigits: 8 },
  { code: '+269', flag: '🇰🇲', label: 'Comoras', localDigits: 7 },
  { code: '+242', flag: '🇨🇬', label: 'Congo', localDigits: 9 },
  { code: '+243', flag: '🇨🇩', label: 'Rep. Democratica del Congo', localDigits: 9 },
  { code: '+682', flag: '🇨🇰', label: 'Islas Cook', localDigits: 5 },
  { code: '+357', flag: '🇨🇾', label: 'Chipre', localDigits: 8 },
  { code: '+253', flag: '🇩🇯', label: 'Yibuti', localDigits: 8 },
  { code: '+1767', flag: '🇩🇲', label: 'Dominica', localDigits: 7 },
  { code: '+240', flag: '🇬🇶', label: 'Guinea Ecuatorial', localDigits: 9 },
  { code: '+291', flag: '🇪🇷', label: 'Eritrea', localDigits: 7 },
  { code: '+372', flag: '🇪🇪', label: 'Estonia', localDigits: 8 },
  { code: '+500', flag: '🇫🇰', label: 'Islas Malvinas', localDigits: 5 },
  { code: '+298', flag: '🇫🇴', label: 'Islas Feroe', localDigits: 6 },
  { code: '+594', flag: '🇬🇫', label: 'Guayana Francesa', localDigits: 9 },
  { code: '+689', flag: '🇵🇫', label: 'Polinesia Francesa', localDigits: 8 },
  { code: '+241', flag: '🇬🇦', label: 'Gabon', localDigits: 8 },
  { code: '+220', flag: '🇬🇲', label: 'Gambia', localDigits: 7 },
  { code: '+995', flag: '🇬🇪', label: 'Georgia', localDigits: 9 },
  { code: '+350', flag: '🇬🇮', label: 'Gibraltar', localDigits: 8 },
  { code: '+299', flag: '🇬🇱', label: 'Groenlandia', localDigits: 6 },
  { code: '+1473', flag: '🇬🇩', label: 'Granada', localDigits: 7 },
  { code: '+590', flag: '🇬🇵', label: 'Guadalupe/San Martin', localDigits: 9 },
  { code: '+224', flag: '🇬🇳', label: 'Guinea', localDigits: 9 },
  { code: '+245', flag: '🇬🇼', label: 'Guinea-Bisau', localDigits: 7 },
  { code: '+592', flag: '🇬🇾', label: 'Guyana', localDigits: 7 },
  { code: '+354', flag: '🇮🇸', label: 'Islandia', localDigits: 7 },
  { code: '+98', flag: '🇮🇷', label: 'Iran', localDigits: 10 },
  { code: '+964', flag: '🇮🇶', label: 'Irak', localDigits: 10 },
  { code: '+225', flag: '🇨🇮', label: 'Costa de Marfil', localDigits: 10 },
  { code: '+996', flag: '🇰🇬', label: 'Kirguistan', localDigits: 9 },
  { code: '+371', flag: '🇱🇻', label: 'Letonia', localDigits: 8 },
  { code: '+266', flag: '🇱🇸', label: 'Lesoto', localDigits: 8 },
  { code: '+231', flag: '🇱🇷', label: 'Liberia', localDigits: 8 },
  { code: '+218', flag: '🇱🇾', label: 'Libia', localDigits: 9 },
  { code: '+423', flag: '🇱🇮', label: 'Liechtenstein', localDigits: 7 },
  { code: '+370', flag: '🇱🇹', label: 'Lituania', localDigits: 8 },
  { code: '+352', flag: '🇱🇺', label: 'Luxemburgo', localDigits: 9 },
  { code: '+389', flag: '🇲🇰', label: 'Macedonia del Norte', localDigits: 8 },
  { code: '+261', flag: '🇲🇬', label: 'Madagascar', localDigits: 9 },
  { code: '+265', flag: '🇲🇼', label: 'Malaui', localDigits: 9 },
  { code: '+960', flag: '🇲🇻', label: 'Maldivas', localDigits: 7 },
  { code: '+223', flag: '🇲🇱', label: 'Mali', localDigits: 8 },
  { code: '+356', flag: '🇲🇹', label: 'Malta', localDigits: 8 },
  { code: '+692', flag: '🇲🇭', label: 'Islas Marshall', localDigits: 7 },
  { code: '+596', flag: '🇲🇶', label: 'Martinica', localDigits: 9 },
  { code: '+222', flag: '🇲🇷', label: 'Mauritania', localDigits: 8 },
  { code: '+230', flag: '🇲🇺', label: 'Mauricio', localDigits: 8 },
  { code: '+262', flag: '🇷🇪', label: 'Reunion/Mayotte', localDigits: 9 },
  { code: '+691', flag: '🇫🇲', label: 'Micronesia', localDigits: 7 },
  { code: '+373', flag: '🇲🇩', label: 'Moldavia', localDigits: 8 },
  { code: '+377', flag: '🇲🇨', label: 'Monaco', localDigits: 8 },
  { code: '+976', flag: '🇲🇳', label: 'Mongolia', localDigits: 8 },
  { code: '+382', flag: '🇲🇪', label: 'Montenegro', localDigits: 8 },
  { code: '+1664', flag: '🇲🇸', label: 'Montserrat', localDigits: 7 },
  { code: '+258', flag: '🇲🇿', label: 'Mozambique', localDigits: 9 },
  { code: '+264', flag: '🇳🇦', label: 'Namibia', localDigits: 9 },
  { code: '+674', flag: '🇳🇷', label: 'Nauru', localDigits: 7 },
  { code: '+687', flag: '🇳🇨', label: 'Nueva Caledonia', localDigits: 6 },
  { code: '+227', flag: '🇳🇪', label: 'Niger', localDigits: 8 },
  { code: '+683', flag: '🇳🇺', label: 'Niue', localDigits: 4 },
  { code: '+850', flag: '🇰🇵', label: 'Corea del Norte', localDigits: 10 },
  { code: '+1670', flag: '🇲🇵', label: 'Islas Marianas del Norte', localDigits: 7 },
  { code: '+680', flag: '🇵🇼', label: 'Palaos', localDigits: 7 },
  { code: '+970', flag: '🇵🇸', label: 'Palestina', localDigits: 9 },
  { code: '+250', flag: '🇷🇼', label: 'Ruanda', localDigits: 9 },
  { code: '+290', flag: '🇸🇭', label: 'Santa Elena', localDigits: 5 },
  { code: '+1869', flag: '🇰🇳', label: 'San Cristobal y Nieves', localDigits: 7 },
  { code: '+1758', flag: '🇱🇨', label: 'Santa Lucia', localDigits: 7 },
  { code: '+508', flag: '🇵🇲', label: 'San Pedro y Miquelon', localDigits: 6 },
  { code: '+1784', flag: '🇻🇨', label: 'San Vicente y Granadinas', localDigits: 7 },
  { code: '+685', flag: '🇼🇸', label: 'Samoa', localDigits: 7 },
  { code: '+378', flag: '🇸🇲', label: 'San Marino', localDigits: 10 },
  { code: '+239', flag: '🇸🇹', label: 'Santo Tome y Principe', localDigits: 7 },
  { code: '+221', flag: '🇸🇳', label: 'Senegal', localDigits: 9 },
  { code: '+248', flag: '🇸🇨', label: 'Seychelles', localDigits: 7 },
  { code: '+232', flag: '🇸🇱', label: 'Sierra Leona', localDigits: 8 },
  { code: '+677', flag: '🇸🇧', label: 'Islas Salomon', localDigits: 7 },
  { code: '+252', flag: '🇸🇴', label: 'Somalia', localDigits: 8 },
  { code: '+211', flag: '🇸🇸', label: 'Sudan del Sur', localDigits: 9 },
  { code: '+249', flag: '🇸🇩', label: 'Sudan', localDigits: 9 },
  { code: '+597', flag: '🇸🇷', label: 'Surinam', localDigits: 7 },
  { code: '+268', flag: '🇸🇿', label: 'Esuatini', localDigits: 8 },
  { code: '+992', flag: '🇹🇯', label: 'Tayikistan', localDigits: 9 },
  { code: '+255', flag: '🇹🇿', label: 'Tanzania', localDigits: 9 },
  { code: '+228', flag: '🇹🇬', label: 'Togo', localDigits: 8 },
  { code: '+690', flag: '🇹🇰', label: 'Tokelau', localDigits: 4 },
  { code: '+676', flag: '🇹🇴', label: 'Tonga', localDigits: 5 },
  { code: '+993', flag: '🇹🇲', label: 'Turkmenistan', localDigits: 8 },
  { code: '+1649', flag: '🇹🇨', label: 'Islas Turcas y Caicos', localDigits: 7 },
  { code: '+688', flag: '🇹🇻', label: 'Tuvalu', localDigits: 5 },
  { code: '+256', flag: '🇺🇬', label: 'Uganda', localDigits: 9 },
  { code: '+998', flag: '🇺🇿', label: 'Uzbekistan', localDigits: 9 },
  { code: '+678', flag: '🇻🇺', label: 'Vanuatu', localDigits: 7 },
  { code: '+379', flag: '🇻🇦', label: 'Ciudad del Vaticano', localDigits: 8 },
  { code: '+967', flag: '🇾🇪', label: 'Yemen', localDigits: 9 },
  { code: '+260', flag: '🇿🇲', label: 'Zambia', localDigits: 9 },
  { code: '+263', flag: '🇿🇼', label: 'Zimbabue', localDigits: 9 },
];

const knownCodes = new Set(COUNTRY_PHONE_CODES.map((item) => item.code));

export function normalizarCodigosPaisActivos(codes?: string[] | null) {
  const normalizados = Array.from(new Set((codes ?? []).filter((code) => knownCodes.has(code))));
  return normalizados.length ? normalizados : [...DEFAULT_ACTIVE_PHONE_CODES];
}

export function codigosPaisActivosDesdeValor(value?: string | null) {
  if (!value) return [...DEFAULT_ACTIVE_PHONE_CODES];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return normalizarCodigosPaisActivos(parsed.filter((item): item is string => typeof item === 'string'));
  } catch {
    return normalizarCodigosPaisActivos(value.split(',').map((item) => item.trim()));
  }
  return [...DEFAULT_ACTIVE_PHONE_CODES];
}

export function leerCodigosPaisActivosLocal() {
  if (typeof localStorage === 'undefined') return [...DEFAULT_ACTIVE_PHONE_CODES];
  return codigosPaisActivosDesdeValor(localStorage.getItem(PHONE_CODES_STORAGE_KEY));
}

export function guardarCodigosPaisActivosLocal(codes: string[]) {
  const normalizados = normalizarCodigosPaisActivos(codes);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(PHONE_CODES_STORAGE_KEY, JSON.stringify(normalizados));
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PHONE_CODES_CHANGED_EVENT, { detail: { codes: normalizados } }));
  }
  return normalizados;
}

export function codigosPaisDisponibles(activeCodes: string[], extraCodes: string[] = []) {
  const visibles = new Set([...normalizarCodigosPaisActivos(activeCodes), ...extraCodes.filter((code) => knownCodes.has(code))]);
  return COUNTRY_PHONE_CODES.filter((item) => visibles.has(item.code));
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, '');
}

function codeDigits(code: string) {
  return digitsOnly(code);
}

function findCodeByDigits(digits: string) {
  return [...COUNTRY_PHONE_CODES]
    .sort((a, b) => b.code.length - a.code.length)
    .find((item) => (
      digits.startsWith(codeDigits(item.code))
      && digits.length - codeDigits(item.code).length >= item.localDigits
    ));
}

function stripRepeatedCode(digits: string, code: string) {
  const prefix = codeDigits(code);
  return digits.startsWith(prefix) ? digits.slice(prefix.length) : digits;
}

function normalizeLocalByCountry(code: string, local: string) {
  let next = local;

  if (code === '+55') {
    while (next.startsWith('0') && next.length > 10) {
      next = next.slice(1);
    }

    const ddd = next.slice(0, 2);
    const subscriber = next.slice(2);
    if (ddd.length === 2 && subscriber.length === 8 && /^[6-9]/.test(subscriber)) {
      next = `${ddd}9${subscriber}`;
    }
  }

  if (code === '+598' && next.length > 8) {
    next = next.slice(-8);
  }

  return next;
}

export function normalizarTelefono(value: string, defaultCode = '+55', codeLocked = false) {
  const compact = value.trim();
  const digits = digitsOnly(compact);
  const hasExplicitInternationalCode = compact.startsWith('+') || digits.startsWith('00');
  const digitsWithoutInternationalPrefix = digits.startsWith('00') ? digits.slice(2) : digits;
  const detected = !codeLocked ? findCodeByDigits(digitsWithoutInternationalPrefix) : undefined;
  const selected = codeLocked ? defaultCode : detected?.code ?? defaultCode;
  const shouldStripCode = hasExplicitInternationalCode || (!codeLocked && Boolean(detected));
  const localDigits = shouldStripCode
    ? stripRepeatedCode(digitsWithoutInternationalPrefix, selected)
    : digitsWithoutInternationalPrefix;
  const local = normalizeLocalByCountry(selected, localDigits);

  return local ? `${selected}${local}` : selected;
}

export function separarTelefono(value: string, defaultCode = '+55', codeLocked = false) {
  const compact = value.trim();
  if (!compact) return { selected: defaultCode, local: '' };

  const detected = !codeLocked ? findCodeByDigits(digitsOnly(compact).startsWith('00') ? digitsOnly(compact).slice(2) : digitsOnly(compact)) : undefined;
  const selectedForSplit = codeLocked ? defaultCode : detected?.code ?? defaultCode;
  const normalized = compact.startsWith('+') || detected || codeLocked ? compact : `${selectedForSplit}${compact}`;
  const match = COUNTRY_PHONE_CODES.find((item) => normalized.startsWith(item.code));
  const selected = codeLocked ? defaultCode : match?.code ?? defaultCode;
  const local = match ? normalized.slice(match.code.length) : normalized.replace(/^\+/, '');

  const localDigits = digitsOnly(local);
  return {
    selected,
    local: selected === '+598'
      ? normalizeLocalByCountry(selected, localDigits)
      : localDigits,
  };
}

export function telefonoClienteCompleto(value?: string | null) {
  const digits = (value ?? '').replace(/\D/g, '');
  return digits.length >= 7;
}
