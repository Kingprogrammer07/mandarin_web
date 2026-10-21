# TASK: Astatka — rasmni ilova ichidagi kamera bilan olish

## Objective
1. Astatka rasmlari (rasm olish / qayta olish / bittasini almashtirish) iOS va Android'da galereya o'rniga AddCargoForm'dagi kabi ilova ichidagi kamerani ochsin.
2. Hali tasdiqlanmagan (astatkada saqlanmagan) yuk oynasida ham rasm olish bo'lsin: rasmlar qurilmada turadi, yuk tasdiqlanganda o'sha yukka saqlanadi.

## Implementation Plan
- [x] `src/lib/camera.ts`: MultiPhotoUpload'dagi sof yordamchilar (zoom/torch, o'lchamlar) + kadrni JPEG faylga olish, xato matni
- [x] MultiPhotoUpload shu yordamchilarni import qilsin (xulq o'zgarmaydi)
- [x] `useCameraStream` hook: oqimni ochish/yopish, tayyorlik, chiroq, zoom, rasmga olish
- [x] `CameraCapture` dialog (Radix, to'liq ekran): bitta yoki bir nechta rasm, galereya zaxira yo'li
- [x] Rasm kamerasi ochiq paytda shtrix-kod skaneri to'xtasin (bitta kamera)
- [x] BagOwnPhotos: fayl inputlari o'rniga CameraCapture
- [x] `useAstatkaPendingPhotos`: tasdiqlanmagan qator rasmlari xotirada, tasdiqlangach yuklash
- [x] `BagPendingPhotos` bo'limi + WorkRowSheet/BagSheet/WorkPanel/sahifa ulanishi
- [x] Testlar (vitest), lint, tsc, build
- [x] Commit + push main

## Walkthrough / Architecture
`CameraCapture` — ichma-ich Radix dialog (PhotoViewer kabi), `useCameraStream` getUserMedia oqimini boshqaradi. Saqlangan yuk: `BagOwnPhotos` kameradan kelgan fayllarni mavjud `replaceAstatkaPackagePhotos` bilan yuboradi. Tasdiqlanmagan yuk: `useAstatkaPendingPhotos` (sahifa darajasida) qator id bo'yicha fayllarni ushlaydi; qator `confirmed` bo'lib shu astatkadagi paket id paydo bo'lganda fayllarni yuklaydi (paketda rasm bo'lmasa bitta so'rov, bo'lsa oxiriga birma-bir qo'shadi), so'ng `replacePackage` va rasm keshini yangilaydi.
