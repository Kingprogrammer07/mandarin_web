import { z } from 'zod';

// O'zbekistonda tug'ilgan fuqarolarning passport seriyalari
// Faqat mahalliy (native) fuqarolar uchun
const UZBEKISTAN_NATIVE_PASSPORT_SERIES = [
  'AA', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL', 'AM', 'AN', 'AB',
  'BC', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BK', 'BL', 'BM', 'BN', 'K', 'KA'
];

// PINFL validatsiyasi - birinchi raqam 3, 4, 5 yoki 6 bo'lishi kerak
const validatePINFL = (pinfl: string): boolean => {
  if (!/^\d{14}$/.test(pinfl)) return false;

  // Birinchi raqam 3, 4, 5 yoki 6 bo'lishi kerak
  const firstDigit = parseInt(pinfl[0]);
  return [3, 4, 5, 6].includes(firstDigit);
};

// O'zbekiston mahalliy fuqarolarining passport validatsiyasi
const validateUzbekistanPassport = (passport: string): boolean => {
  const regex = /^([A-Z]{2})(\d{7})$/;
  const match = passport.match(regex);

  if (!match) return false;

  const series = match[1];
  return UZBEKISTAN_NATIVE_PASSPORT_SERIES.includes(series);
};

// Formani validatsiya qilish sxemasi
export const formSchema = z.object({
  fullName: z
    .string()
    .min(1, 'form.validation.fullNameRequired')
    .min(9, 'form.validation.fullNameMin')
    .refine((val) => val.replace(/\s/g, '').length >= 9, {
      message: 'form.validation.fullNameMin',
    }),

  passportSeries: z
    .string()
    .min(1, 'form.validation.passportSeriesRequired')
    .regex(/^[A-Z]{2}\d{7}$/, 'form.validation.passportSeriesInvalid')
    .refine(validateUzbekistanPassport, {
      message: 'form.validation.passportSeriesUzbekistan',
    }),

  pinfl: z
    .string()
    .min(1, 'form.validation.pinflRequired')
    .regex(/^\d{14}$/, 'form.validation.pinflInvalid')
    .refine(validatePINFL, {
      message: 'form.validation.pinflInvalid',
    }),

  dateOfBirth: z
    .date({ error: () => ({ message: 'form.validation.dateOfBirthRequired' }) })
    .refine((date) => {
      const today = new Date();
      const age = today.getFullYear() - date.getFullYear();
      const monthDiff = today.getMonth() - date.getMonth();
      const dayDiff = today.getDate() - date.getDate();

      if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
        return age - 1 >= 16;
      }
      return age >= 16;
    }, 'form.validation.dateOfBirthAge'),

  region: z
    .string()
    .min(1, 'form.validation.regionRequired'),

  district: z
    .string()
    .min(1, 'form.validation.districtRequired'),

  address: z
    .string()
    .min(1, 'form.validation.addressRequired'),

  phoneNumber: z
    .string()
    .min(1, 'form.validation.phoneNumberRequired')
    .regex(/^\d{9}$/, 'form.validation.phoneNumberInvalid'),

  passportImages: z
    .array(z.instanceof(File))
    .min(1, 'form.validation.passportImagesRequired')
    .refine((files) => files.every((file) => file.type.startsWith('image/')), {
      message: 'form.validation.passportImagesType',
    }),
});

export type RegistrationFormData = z.infer<typeof formSchema>;

export const regions = [
  { value: 'toshkent_city', label: 'regions.tashkent_city' },
  { value: 'toshkent', label: 'regions.tashkent' },
  { value: 'samarkand', label: 'regions.samarkand' },
  { value: 'bukhara', label: 'regions.bukhara' },
  { value: 'andijan', label: 'regions.andijan' },
  { value: 'fergana', label: 'regions.fergana' },
  { value: 'namangan', label: 'regions.namangan' },
  { value: 'kashkadarya', label: 'regions.kashkadarya' },
  { value: 'surkhandarya', label: 'regions.surkhandarya' },
  { value: 'jizzakh', label: 'regions.jizzakh' },
  { value: 'sirdarya', label: 'regions.sirdarya' },
  { value: 'navoi', label: 'regions.navoi' },
  { value: 'khorezm', label: 'regions.khorezm' },
  { value: 'karakalpakstan', label: 'regions.karakalpakstan' },
];

export const DISTRICTS: Record<string, { value: string, label: string }[]> = {
  'toshkent_city': [
    { value: 'bektemir', label: 'districts.bektemir' },
    { value: 'chilonzor', label: 'districts.chilonzor' },
    { value: 'yakkasaroy', label: 'districts.yakkasaroy' },
    { value: 'mirobod', label: 'districts.mirobod' },
    { value: 'mirzo_ulugbek', label: 'districts.mirzo_ulugbek' },
    { value: 'olmazor', label: 'districts.olmazor' },
    { value: 'sergeli', label: 'districts.sergeli' },
    { value: 'shayxontohur', label: 'districts.shayxontohur' },
    { value: 'uchtepa', label: 'districts.uchtepa' },
    { value: 'yunusobod', label: 'districts.yunusobod' },
    { value: 'yashnobod', label: 'districts.yashnobod' },
    { value: 'yangihayot', label: 'districts.yangihayot' },
  ],
  'toshkent': [
    { value: 'bekobod_t', label: 'districts.bekobod_t' },
    { value: 'boka', label: 'districts.boka' },
    { value: 'bostonliq', label: 'districts.bostonliq' },
    { value: 'chinoz', label: 'districts.chinoz' },
    { value: 'qibray', label: 'districts.qibray' },
    { value: 'ohangaron_t', label: 'districts.ohangaron_t' },
    { value: 'oqqorgon', label: 'districts.oqqorgon' },
    { value: 'parkent', label: 'districts.parkent' },
    { value: 'piskent', label: 'districts.piskent' },
    { value: 'quyi_chirchiq', label: 'districts.quyi_chirchiq' },
    { value: 'orta_chirchiq', label: 'districts.orta_chirchiq' },
    { value: 'yuqori_chirchiq', label: 'districts.yuqori_chirchiq' },
    { value: 'zangiota', label: 'districts.zangiota' },
    { value: 'yangiyo\'l_t', label: 'districts.yangiyo\'l_t' },
    { value: 'angren', label: 'districts.angren' },
    { value: 'bekobod_s', label: 'districts.bekobod_s' },
    { value: 'chirchiq', label: 'districts.chirchiq' },
    { value: 'olmaliq', label: 'districts.olmaliq' },
    { value: 'ohangaron_s', label: 'districts.ohangaron_s' },
    { value: 'yangiyo\'l_s', label: 'districts.yangiyo\'l_s' },
    { value: 'nurafshon', label: 'districts.nurafshon' },
  ],
  'karakalpakstan': [
    { value: 'amudaryo', label: 'districts.amudaryo' },
    { value: 'beruniy_t', label: 'districts.beruniy_t' },
    { value: 'chimboy_t', label: 'districts.chimboy_t' },
    { value: 'ellikqala', label: 'districts.ellikqala' },
    { value: 'kegeyli', label: 'districts.kegeyli' },
    { value: 'moynoq_t', label: 'districts.moynoq_t' },
    { value: 'nukus_t', label: 'districts.nukus_t' },
    { value: 'qanlikol', label: 'districts.qanlikol' },
    { value: 'qongrot_t', label: 'districts.qongrot_t' },
    { value: 'qaraozak', label: 'districts.qaraozak' },
    { value: 'shumanay', label: 'districts.shumanay' },
    { value: 'taxtakopir', label: 'districts.taxtakopir' },
    { value: 'tortkol_t', label: 'districts.tortkol_t' },
    { value: 'xojayli_t', label: 'districts.xojayli_t' },
    { value: 'nukus_s', label: 'districts.nukus_s' },
    { value: 'beruniy_s', label: 'districts.beruniy_s' },
    { value: 'tortkol_s', label: 'districts.tortkol_s' },
    { value: 'xojayli_s', label: 'districts.xojayli_s' },
    { value: 'taxiatosh', label: 'districts.taxiatosh' },
    { value: 'qongrot_s', label: 'districts.qongrot_s' },
    { value: 'chimboy_s', label: 'districts.chimboy_s' },
    { value: 'moynoq_s', label: 'districts.moynoq_s' },
  ],
  'andijan': [
    { value: 'andijon_t', label: 'districts.andijon_t' },
    { value: 'asaka_t', label: 'districts.asaka_t' },
    { value: 'baliqchi', label: 'districts.baliqchi' },
    { value: 'boz', label: 'districts.boz' },
    { value: 'buloqboshi', label: 'districts.buloqboshi' },
    { value: 'izboskan', label: 'districts.izboskan' },
    { value: 'jalaquduq', label: 'districts.jalaquduq' },
    { value: 'marhamat', label: 'districts.marhamat' },
    { value: 'oltinkol', label: 'districts.oltinkol' },
    { value: 'paxtaobod', label: 'districts.paxtaobod' },
    { value: 'shahrixon_t', label: 'districts.shahrixon_t' },
    { value: 'ulugnar', label: 'districts.ulugnar' },
    { value: 'xojaobod', label: 'districts.xojaobod' },
    { value: 'qorgontepa', label: 'districts.qorgontepa' },
    { value: 'andijon_s', label: 'districts.andijon_s' },
    { value: 'asaka_s', label: 'districts.asaka_s' },
    { value: 'shahrixon_s', label: 'districts.shahrixon_s' },
    { value: 'xonobod', label: 'districts.xonobod' },
  ],
  'fergana': [
    { value: 'oltiariq', label: 'districts.oltiariq' },
    { value: 'bagdod', label: 'districts.bagdod' },
    { value: 'beshariq', label: 'districts.beshariq' },
    { value: 'buvayda', label: 'districts.buvayda' },
    { value: 'dangara', label: 'districts.dangara' },
    { value: 'fargona_t', label: 'districts.fargona_t' },
    { value: 'furqat', label: 'districts.furqat' },
    { value: 'ozbekiston', label: 'districts.ozbekiston' },
    { value: 'quva_t', label: 'districts.quva_t' },
    { value: 'rishton', label: 'districts.rishton' },
    { value: 'sox', label: 'districts.sox' },
    { value: 'toshloq', label: 'districts.toshloq' },
    { value: 'uchkoprik', label: 'districts.uchkoprik' },
    { value: 'yozyovon', label: 'districts.yozyovon' },
    { value: 'fargona_s', label: 'districts.fargona_s' },
    { value: 'qoqon', label: 'districts.qoqon' },
    { value: 'margilon', label: 'districts.margilon' },
    { value: 'quvasoy', label: 'districts.quvasoy' },
  ],
  'namangan': [
    { value: 'chortoq_t', label: 'districts.chortoq_t' },
    { value: 'chust_t', label: 'districts.chust_t' },
    { value: 'kosonsoy_t', label: 'districts.kosonsoy_t' },
    { value: 'mingbuloq', label: 'districts.mingbuloq' },
    { value: 'namangan_t', label: 'districts.namangan_t' },
    { value: 'norin', label: 'districts.norin' },
    { value: 'pop', label: 'districts.pop' },
    { value: 'toraqorgon', label: 'districts.toraqorgon' },
    { value: 'uchqorgon', label: 'districts.uchqorgon' },
    { value: 'uychi', label: 'districts.uychi' },
    { value: 'yangiqorgon', label: 'districts.yangiqorgon' },
    { value: 'namangan_s', label: 'districts.namangan_s' },
    { value: 'chust_s', label: 'districts.chust_s' },
    { value: 'chortoq_s', label: 'districts.chortoq_s' },
    { value: 'kosonsoy_s', label: 'districts.kosonsoy_s' },
  ],
  'samarkand': [
    { value: 'bulungur', label: 'districts.bulungur' },
    { value: 'ishtixon', label: 'districts.ishtixon' },
    { value: 'jomboy', label: 'districts.jomboy' },
    { value: 'kattaqorgon_t', label: 'districts.kattaqorgon_t' },
    { value: 'narpay', label: 'districts.narpay' },
    { value: 'nurobod', label: 'districts.nurobod' },
    { value: 'oqdaryo', label: 'districts.oqdaryo' },
    { value: 'paxtachi', label: 'districts.paxtachi' },
    { value: 'payariq', label: 'districts.payariq' },
    { value: 'pastdargom', label: 'districts.pastdargom' },
    { value: 'qoshrabot', label: 'districts.qoshrabot' },
    { value: 'samarqand_t', label: 'districts.samarqand_t' },
    { value: 'toyloq', label: 'districts.toyloq' },
    { value: 'urgut', label: 'districts.urgut' },
    { value: 'samarqand_s', label: 'districts.samarqand_s' },
    { value: 'kattaqorgon_s', label: 'districts.kattaqorgon_s' },
  ],
  'bukhara': [
    { value: 'buxoro_t', label: 'districts.buxoro_t' },
    { value: 'gijduvon', label: 'districts.gijduvon' },
    { value: 'jondor', label: 'districts.jondor' },
    { value: 'kogon_t', label: 'districts.kogon_t' },
    { value: 'olot', label: 'districts.olot' },
    { value: 'peshku', label: 'districts.peshku' },
    { value: 'qarakol', label: 'districts.qarakol' },
    { value: 'qarovulbozor', label: 'districts.qarovulbozor' },
    { value: 'romitan', label: 'districts.romitan' },
    { value: 'shofirkon', label: 'districts.shofirkon' },
    { value: 'vobkent', label: 'districts.vobkent' },
    { value: 'buxoro_s', label: 'districts.buxoro_s' },
    { value: 'kogon_s', label: 'districts.kogon_s' },
  ],
  'navoi': [
    { value: 'konimex', label: 'districts.konimex' },
    { value: 'karmana', label: 'districts.karmana' },
    { value: 'qiziltepa', label: 'districts.qiziltepa' },
    { value: 'navbahor', label: 'districts.navbahor' },
    { value: 'nurota', label: 'districts.nurota' },
    { value: 'tomdi', label: 'districts.tomdi' },
    { value: 'uchquduq', label: 'districts.uchquduq' },
    { value: 'xatirchi', label: 'districts.xatirchi' },
    { value: 'navoiy_s', label: 'districts.navoiy_s' },
    { value: 'zarafshon', label: 'districts.zarafshon' },
  ],
  'kashkadarya': [
    { value: 'dehqonobod', label: 'districts.dehqonobod' },
    { value: 'guzor', label: 'districts.guzor' },
    { value: 'kasbi', label: 'districts.kasbi' },
    { value: 'kitob', label: 'districts.kitob' },
    { value: 'koson', label: 'districts.koson' },
    { value: 'mirishkor', label: 'districts.mirishkor' },
    { value: 'muborak', label: 'districts.muborak' },
    { value: 'nishon', label: 'districts.nishon' },
    { value: 'qamashi', label: 'districts.qamashi' },
    { value: 'qarshi_t', label: 'districts.qarshi_t' },
    { value: 'shahrisabz_t', label: 'districts.shahrisabz_t' },
    { value: 'yakkabog', label: 'districts.yakkabog' },
    { value: 'chiroqchi', label: 'districts.chiroqchi' },
    { value: 'qarshi_s', label: 'districts.qarshi_s' },
    { value: 'shahrisabz_s', label: 'districts.shahrisabz_s' },
  ],
  'surkhandarya': [
    { value: 'angor', label: 'districts.angor' },
    { value: 'bandixon', label: 'districts.bandixon' },
    { value: 'boysun', label: 'districts.boysun' },
    { value: 'denov_t', label: 'districts.denov_t' },
    { value: 'jarqorgon', label: 'districts.jarqorgon' },
    { value: 'muzrabot', label: 'districts.muzrabot' },
    { value: 'oltinsoy', label: 'districts.oltinsoy' },
    { value: 'qiziriq', label: 'districts.qiziriq' },
    { value: 'qumqorgon', label: 'districts.qumqorgon' },
    { value: 'sariosiyo', label: 'districts.sariosiyo' },
    { value: 'sherobod', label: 'districts.sherobod' },
    { value: 'shorchi', label: 'districts.shorchi' },
    { value: 'termiz_t', label: 'districts.termiz_t' },
    { value: 'uzun', label: 'districts.uzun' },
    { value: 'termiz_s', label: 'districts.termiz_s' },
    { value: 'denov_s', label: 'districts.denov_s' },
  ],
  'jizzakh': [
    { value: 'arnasoy', label: 'districts.arnasoy' },
    { value: 'baxmal', label: 'districts.baxmal' },
    { value: 'dostlik', label: 'districts.dostlik' },
    { value: 'forish', label: 'districts.forish' },
    { value: 'gallaorol_t', label: 'districts.gallaorol_t' },
    { value: 'jizzax_t', label: 'districts.jizzax_t' },
    { value: 'mirzachol', label: 'districts.mirzachol' },
    { value: 'paxtakor', label: 'districts.paxtakor' },
    { value: 'yangiobod', label: 'districts.yangiobod' },
    { value: 'zafarobod', label: 'districts.zafarobod' },
    { value: 'zarbdor', label: 'districts.zarbdor' },
    { value: 'zomin', label: 'districts.zomin' },
    { value: 'jizzax_s', label: 'districts.jizzax_s' },
    { value: 'gallaorol_s', label: 'districts.gallaorol_s' },
  ],
  'sirdarya': [
    { value: 'boyovut', label: 'districts.boyovut' },
    { value: 'guliston_t', label: 'districts.guliston_t' },
    { value: 'mirzaobod', label: 'districts.mirzaobod' },
    { value: 'oqoltin', label: 'districts.oqoltin' },
    { value: 'sardoba', label: 'districts.sardoba' },
    { value: 'sayxunobod', label: 'districts.sayxunobod' },
    { value: 'sirdaryo_t', label: 'districts.sirdaryo_t' },
    { value: 'xovos', label: 'districts.xovos' },
    { value: 'guliston_s', label: 'districts.guliston_s' },
    { value: 'shirin', label: 'districts.shirin' },
    { value: 'yangiyer', label: 'districts.yangiyer' },
  ],
  'khorezm': [
    { value: 'bogot', label: 'districts.bogot' },
    { value: 'gurlan', label: 'districts.gurlan' },
    { value: 'hazorasp', label: 'districts.hazorasp' },
    { value: 'xiva_t', label: 'districts.xiva_t' },
    { value: 'qoshkopir', label: 'districts.qoshkopir' },
    { value: 'shovot', label: 'districts.shovot' },
    { value: 'urganch_t', label: 'districts.urganch_t' },
    { value: 'yangiariq', label: 'districts.yangiariq' },
    { value: 'yangibozor', label: 'districts.yangibozor' },
    { value: 'tuproqqala', label: 'districts.tuproqqala' },
    { value: 'xonqa', label: 'districts.xonqa' },
    { value: 'urganch_s', label: 'districts.urganch_s' },
    { value: 'xiva_s', label: 'districts.xiva_s' },
  ],
};
