import type { RegionStatItem } from '@/api/services/stats';

// Maps every known region/district name to its province (viloyat).
// Toshkent city districts are grouped under "Toshkent shahri" separately
// from the surrounding "Toshkent viloyati".
const REGION_VILOYAT_MAP: Record<string, string> = {
  // ── Toshkent shahri ─────────────────────────────────────────
  'Chilonzor': 'Toshkent shahri',
  'Yunusobod': 'Toshkent shahri',
  'Olmazor': 'Toshkent shahri',
  'Yashnobod': 'Toshkent shahri',
  'Sergeli': 'Toshkent shahri',
  'Uchtepa': 'Toshkent shahri',
  'Mirobod': 'Toshkent shahri',
  'Mirzo Ulugbek': 'Toshkent shahri',
  'Yangihayot': 'Toshkent shahri',
  'Shayxontohur': 'Toshkent shahri',
  'Yakkasaroy': 'Toshkent shahri',
  'Bektemir': 'Toshkent shahri',

  // ── Toshkent viloyati ────────────────────────────────────────
  'Zangiota': 'Toshkent viloyati',
  'Qibray': 'Toshkent viloyati',
  'Angren': 'Toshkent viloyati',
  'Piskent': 'Toshkent viloyati',
  'Nurafshon': 'Toshkent viloyati',
  "Yangiyo'L Tumani": 'Toshkent viloyati',
  'Bekobod Shahri': 'Toshkent viloyati',
  'Bekobod Tumani': 'Toshkent viloyati',
  'Yuqori Chirchiq': 'Toshkent viloyati',
  'Chirchiq': 'Toshkent viloyati',
  'Olmaliq': 'Toshkent viloyati',
  'Bostanliq': 'Toshkent viloyati',
  'Parkent': 'Toshkent viloyati',
  'Oqqorgon': 'Toshkent viloyati',
  'Quyi Chirchiq': 'Toshkent viloyati',

  // ── Andijon viloyati ─────────────────────────────────────────
  'Andijon Shahri': 'Andijon viloyati',
  'Andijon Tumani': 'Andijon viloyati',
  'Izboskan': 'Andijon viloyati',
  'Paxtaobod': 'Andijon viloyati',
  'Baliqchi': 'Andijon viloyati',
  'Buloqboshi': 'Andijon viloyati',
  'Jalaquduq': 'Andijon viloyati',
  'Shahrixon': 'Andijon viloyati',
  'Xonobod': 'Andijon viloyati',
  'Marhamat': 'Andijon viloyati',

  // ── Farg'ona viloyati ────────────────────────────────────────
  "Farg'ona Shahri": "Farg'ona viloyati",
  'Rishton': "Farg'ona viloyati",
  'Oltiariq': "Farg'ona viloyati",
  'Beshariq': "Farg'ona viloyati",
  'Toshloq': "Farg'ona viloyati",
  'Buvayda': "Farg'ona viloyati",
  'Bagdod': "Farg'ona viloyati",
  'Uchkoprik': "Farg'ona viloyati",
  'Qoqon': "Farg'ona viloyati",
  'Quva': "Farg'ona viloyati",
  'Marg\'ilon': "Farg'ona viloyati",
  'Dang\'ara': "Farg'ona viloyati",

  // ── Namangan viloyati ────────────────────────────────────────
  'Namangan Shahri': 'Namangan viloyati',
  'Toraqorgon': 'Namangan viloyati',
  'Chortoq Tumani': 'Namangan viloyati',
  'Uchqorgon': 'Namangan viloyati',
  'Mingbuloq': 'Namangan viloyati',
  'Pop': 'Namangan viloyati',
  'Yangiqorgon': 'Namangan viloyati',
  'Kosonsoy Tumani': 'Namangan viloyati',
  'Uychi': 'Namangan viloyati',
  'Chust Tumani': 'Namangan viloyati',
  'Norin': 'Namangan viloyati',

  // ── Samarqand viloyati ───────────────────────────────────────
  'Samarqand Shahri': 'Samarqand viloyati',
  'Kattaqorgon Tumani': 'Samarqand viloyati',
  'Pastdargom': 'Samarqand viloyati',
  'Ishtixon': 'Samarqand viloyati',
  'Urgut': 'Samarqand viloyati',
  'Jomboy': 'Samarqand viloyati',
  'Bulungur': 'Samarqand viloyati',
  'Payariq': 'Samarqand viloyati',
  'Oqdaryo': 'Samarqand viloyati',
  'Paxtachi': 'Samarqand viloyati',
  'Narpay': 'Samarqand viloyati',

  // ── Buxoro viloyati ──────────────────────────────────────────
  'Buxoro Shahri': 'Buxoro viloyati',
  'Kogon Tumani': 'Buxoro viloyati',
  'Vobkent': 'Buxoro viloyati',
  'Romitan': 'Buxoro viloyati',
  'Qarovulbozor': 'Buxoro viloyati',
  'Olot': 'Buxoro viloyati',
  'Shofirkon': 'Buxoro viloyati',

  // ── Surxondaryo viloyati ─────────────────────────────────────
  'Termiz Shahri': 'Surxondaryo viloyati',
  'Boysun': 'Surxondaryo viloyati',
  'Shorchi': 'Surxondaryo viloyati',
  'Denov Tumani': 'Surxondaryo viloyati',
  'Oltinsoy': 'Surxondaryo viloyati',
  'Qumqorgon': 'Surxondaryo viloyati',
  'Sariosiyo': 'Surxondaryo viloyati',
  'Muzrabot': 'Surxondaryo viloyati',

  // ── Xorazm viloyati ──────────────────────────────────────────
  'Urganch Shahri': 'Xorazm viloyati',
  'Gurlan': 'Xorazm viloyati',
  'Hazorasp': 'Xorazm viloyati',
  'Qoshkopir': 'Xorazm viloyati',
  'Xiva': 'Xorazm viloyati',
  'Bog\'ot': 'Xorazm viloyati',

  // ── Navoiy viloyati ──────────────────────────────────────────
  'Karmana': 'Navoiy viloyati',
  'Zarafshon': 'Navoiy viloyati',
  'Xatirchi': 'Navoiy viloyati',
  'Navbahor': 'Navoiy viloyati',
  'Konimex': 'Navoiy viloyati',

  // ── Qashqadaryo viloyati ─────────────────────────────────────
  'Koson': 'Qashqadaryo viloyati',
  'Qarshi Shahri': 'Qashqadaryo viloyati',
  'Qamashi': 'Qashqadaryo viloyati',
  'Shahrisabz Shahri': 'Qashqadaryo viloyati',
  'Kitob': 'Qashqadaryo viloyati',
  'Muborak': 'Qashqadaryo viloyati',
  'Guzor': 'Qashqadaryo viloyati',

  // ── Jizzax viloyati ──────────────────────────────────────────
  'Jizzax Shahri': 'Jizzax viloyati',
  'Gallaorol Shahri': 'Jizzax viloyati',
  'Dostlik': 'Jizzax viloyati',
  'Paxtakor': 'Jizzax viloyati',
  'Arnasoy': 'Jizzax viloyati',
  'Zomin': 'Jizzax viloyati',
  'Ozbekiston': 'Jizzax viloyati',

  // ── Sirdaryo viloyati ────────────────────────────────────────
  'Boyovut': 'Sirdaryo viloyati',
  'Guliston': 'Sirdaryo viloyati',
  'Sardoba': 'Sirdaryo viloyati',
  'Xavast': 'Sirdaryo viloyati',

  // ── Qoraqalpog'iston Respublikasi ────────────────────────────
  'Nukus Shahri': "Qoraqalpog'iston",
  'Nukus Tumani': "Qoraqalpog'iston",
  'Amudaryo': "Qoraqalpog'iston",
  'Ellikqala': "Qoraqalpog'iston",
  'Qungirot': "Qoraqalpog'iston",
  'Chimboy': "Qoraqalpog'iston",
};

export interface ViloyatGroup {
  viloyat: string;
  total: number;
  districts: RegionStatItem[];
}

/**
 * Groups a flat list of client regions into viloyat (province) buckets,
 * sorted by total client count descending. Regions not found in the map
 * are placed in a catch-all "Boshqa" bucket.
 */
export function groupRegionsByViloyat(regions: RegionStatItem[]): ViloyatGroup[] {
  const buckets = new Map<string, RegionStatItem[]>();

  for (const region of regions) {
    const viloyat = REGION_VILOYAT_MAP[region.name] ?? 'Boshqa';
    const list = buckets.get(viloyat) ?? [];
    list.push(region);
    buckets.set(viloyat, list);
  }

  const groups: ViloyatGroup[] = [];
  for (const [viloyat, districts] of buckets.entries()) {
    groups.push({
      viloyat,
      total: districts.reduce((sum, d) => sum + d.count, 0),
      // Within each group, sort districts by count descending
      districts: [...districts].sort((a, b) => b.count - a.count),
    });
  }

  return groups.sort((a, b) => b.total - a.total);
}
