const fs = require('fs');

try {
  const uzRaw = JSON.parse(fs.readFileSync('src/constants/district_uz_lang.json', 'utf8'));
  const ruRaw = JSON.parse(fs.readFileSync('src/constants/district_ru_lang.json', 'utf8'));

  // Generate DISTRICTS dict for TS
  let tsContent = 'export const DISTRICTS: Record<string, { value: string, label: string }[]> = {\n';
  for (const [region, districts] of Object.entries(uzRaw.districts)) {
    tsContent += `  '${region}': [\n`;
    for (const [distKey, ] of Object.entries(districts)) {
      tsContent += `    { value: '${distKey}', label: 'districts.${distKey}' },\n`;
    }
    tsContent += `  ],\n`;
  }
  tsContent += '};\n';
  fs.writeFileSync('generated_districts.ts', tsContent);

  // Generate objects for uz.json
  const uzLocales = JSON.parse(fs.readFileSync('src/i18n/locales/uz.json', 'utf8'));
  uzLocales.regions = uzRaw.regions;
  const allUzDistricts = {};
  for (const [region, districts] of Object.entries(uzRaw.districts)) {
    for (const [distKey, name] of Object.entries(districts)) {
      allUzDistricts[distKey] = name;
    }
  }
  uzLocales.districts = allUzDistricts;
  uzLocales.form.district = 'Tuman / Shahar';
  uzLocales.form.districtPlaceholder = 'Tuman yoki shaharni tanlang';
  uzLocales.form.supportedFormats = 'PNG · JPG · WEBP · HEIC';
  uzLocales.form.validation.districtRequired = 'Tuman yoki shahar tanlanishi shart';
  fs.writeFileSync('src/i18n/locales/uz.json', JSON.stringify(uzLocales, null, 2));

  // Generate objects for ru.json
  const ruLocales = JSON.parse(fs.readFileSync('src/i18n/locales/ru.json', 'utf8'));
  ruLocales.regions = ruRaw.regions;
  const allRuDistricts = {};
  for (const [region, districts] of Object.entries(ruRaw.districts)) {
    for (const [distKey, name] of Object.entries(districts)) {
      allRuDistricts[distKey] = name;
    }
  }
  ruLocales.districts = allRuDistricts;
  ruLocales.form.district = 'Район / Город';
  ruLocales.form.districtPlaceholder = 'Выберите район или город';
  ruLocales.form.supportedFormats = 'PNG · JPG · WEBP · HEIC';
  ruLocales.form.validation.districtRequired = 'Необходимо выбрать район или город';
  fs.writeFileSync('src/i18n/locales/ru.json', JSON.stringify(ruLocales, null, 2));

  console.log('Script execution completed successfully.');
} catch (e) {
  console.error('Error during execution:', e);
}
