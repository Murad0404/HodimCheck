# HodimCheck — admin paneldan avtomatik jadval

Sayt: https://hodim-check.vercel.app

## Qanday ishlaydi?

Admin → Telegram bo‘limida bot tokeni, qabul qiluvchi chat, cron-job.org API kaliti va keldi/ketdi vaqtlarini kiritasiz. Saqlash tugmasi cron-job.org’da kompaniya uchun ikkita kunlik vazifa yaratadi. Keyingi saqlashlar shu vazifalarni yangilaydi. Vaqt Toshkent (Asia/Tashkent) bo‘yicha hisoblanadi. So‘rov har daqiqa emas, faqat tanlangan ikki vaqtda yuboriladi — 30 kunda odatda 60 ta so‘rov, har bir kompaniya uchun.

Bir xil soatdagi ikki hisobot ham ikkita alohida vazifa. Testlar va qo‘lda qayta ishga tushirishlar qo‘shimcha so‘rov hisoblanadi. Tarmoq yoki xizmat kechikishi mumkin; vaqtning mutlaq aniqligi kafolatlanmaydi.

## Birinchi ulash

1. https://console.cron-job.org/signup orqali akkaunt oching va emailingizni tasdiqlang.
2. Settings bo‘limida API kalitini yarating. Bu kalitni chatga yoki Gitga yubormang.
3. Yangilangan proektni Vercelga deploy qiling. Quyidagi server sozlamalarini oldin tekshiring.
4. https://hodim-check.vercel.app/admin → Telegram bo‘limini oching.
5. BotFather bergan Telegram tokenini, Chat ID ni, cron-job.org API kalitini va sayt manzilini kiriting. Manzil oldindan https://hodim-check.vercel.app qilib to‘ldirilgan.
6. Ikkita vaqtni tanlang, avtomatik yuborishni yoqing va saqlang. “Jadval ulangan” holatini kuting.
7. “Sinov xabari” tugmasi bilan botning chatga yozish huquqini tekshiring. Bu haqiqiy Telegram xabari yuboradi, lekin jadvalni majburan ishga tushirmaydi.
8. cron-job.org panelida ikkita HodimCheck vazifasi va ularning keyingi bajarilish vaqtini tekshiring.

Keyinchalik vaqtlarni faqat HodimCheck admin panelida o‘zgartiring. cron-job.org’dagi vazifalarni qo‘lda o‘zgartirsangiz, navbatdagi admin saqlashi ularni qayta moslashtiradi. API kalitini almashtirish bir xil cron-job.org akkauntida qo‘llanadi. Boshqa akkauntga o‘tayotganda eski akkauntdagi HodimCheck vazifalarini o‘chirib qo‘ying; dastur eski akkauntga yangi kalit bilan kira olmaydi.

## Vercel sozlamalari — Gitga kiritilmaydi

Mavjud MongoDB ulanishi saqlanadi. Kalitlar hostingning Environment Variables bo‘limida bo‘ladi:

- `MONGODB_URI`: avval ishlayotgan bazaning mavjud ulanishi. Ma’lumotlarni ko‘chirish yoki o‘chirish talab qilinmaydi.
- `JWT_SECRET`: autentifikatsiya uchun majburiy. Oldingi koddagi hammaga ma’lum zaxira kalit olib tashlangan. Agar hostingda hali bu qiymat bo‘lmasa, sozlamasdan deploy qilmang. Kalit almashtirilsa foydalanuvchilar qayta kiradi.
- `TELEGRAM_ENCRYPTION_KEY`: 32 tasodifiy baytning 64 belgili hex ko‘rinishi. `openssl rand -hex 32` bilan yaratilishi mumkin. Bot va cron API kalitlari shu server kaliti bilan shifrlanadi. Uni keyinchalik o‘zgartirmang; almashtirsangiz saqlangan kalitlarni qayta kiritish kerak.

Telegram bot tokeni ham, cron-job.org API kaliti ham admin paneldan kiritiladi. Ular MongoDB’da AES-256-GCM bilan shifrlanib saqlanadi va API javobida qaytarilmaydi. Har bir kompaniyaning cron chaqiruvi uchun maxfiy kalit avtomatik yaratiladi. Bu yangi oqim uchun `CRON_SECRET`ni qo‘lda yaratish kerak emas.

`vercel.json`dagi har daqiqalik Vercel cron olib tashlangan. Shu sabab bu jadval Hobby deployini to‘smaydi. Eski global `/api/cron/telegram` oqimi faqat oldin o‘rnatilgan `CRON_SECRET` bilan ishlaydi; yangi avtomatik jadvallar kompaniya va hisobot turiga cheklangan so‘rovdan foydalanadi.

## Ulanishdagi xatolar

Jadval saqlanmasa, sozlamalar va kiritilgan kalitlar saqlanadi, lekin avtomatik yuborish o‘chiriladi. Sabab panelda ko‘rsatiladi. Xatoni bartaraf etib, avtomatik yuborishni yoqing va qayta saqlang. Tugallanmagan saqlashdan qolgan vazifa qayta topiladi; ko‘r-ko‘rona nusxa yaratilmaydi.

cron-job.org boshqaruv API limiti odatda kuniga 100 so‘rov. Bu jadval yaratish/yangilash so‘rovlari uchun; kunlik hisobot chaqiruvlari boshqa oqim. Oddiy yangilash 3 ta API so‘rovi, birinchi ulash odatda 5 ta. Ko‘p marta ketma-ket saqlamang. Bir akkauntda ko‘p kompaniya bo‘lsa bu limit ular orasida umumiy.

Xizmat yoki Telegram ishlamasa, cron-job.org tarixini va admin panelidagi xatoni tekshiring. Har daqiqalik tekshiruv yo‘q, shu sabab shu kunning o‘zida cron-job.org’dan vazifani qo‘lda qayta ishga tushirish mumkin. Avtomatik qisqa oraliqli qayta urinish qo‘shilmagan.

## Hisobot mazmuni

Hisobot bugunning 00:00 va tanlangan vaqt oralig‘idagi (`timestamp < cutoff`) keldi yoki ketdi qaydlarini yuboradi. Bir xodim bir necha marta kirib-chiqsa barcha qaydlari ko‘rsatiladi. Bo‘sh kun “qayd yo‘q” xabarini beradi. Uzun hisobot bir nechta xabarga bo‘linadi.

Kompaniya/kun/hisobot turi MongoDBdagi noyob kalit bilan takrorlardan himoyalangan. Telegram xabarni qabul qilib, javob yoki MongoDB tasdig‘i yo‘qolsa, qayta urinishda bitta bo‘lak takrorlanishi mumkin. O‘tgan kun hisobotlari avtomatik qayta yuborilmaydi. Sozlama saqlangan vaqtdan oldingi bugungi hisobot ham yuborilmaydi.

Manbalar: https://docs.cron-job.org/rest-api.html va https://core.telegram.org/bots/api
