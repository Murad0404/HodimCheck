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
7. “Sinov xabari” tugmasi bilan botning chatga yozish huquqini tekshiring. Bu webhook va buyruqlarni ulaydi, haqiqiy Telegram xabari yuboradi, lekin jadvalni majburan ishga tushirmaydi. Yangi bot yoki qabul qiluvchi chat saqlanganda ham bitta tasdiqlash xabari yuboriladi.
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

Hisobot bugunning 00:00 va tanlangan vaqt oralig‘idagi (`timestamp < cutoff`) qaydlarni hisoblaydi. Toq son (1, 3, 5) — ishda; musbat juft son (2, 4, 6) — ketgan; nol — qayd yo‘q. UI va Telegram bir xil hisobdan foydalanadi. Kunlik hisobot jami, kelgan, ishda, ketgan, qaydsiz xodimlar va davomat foizini, so‘ng har bir xodimning holatini ko‘rsatadi. Uzun hisobot bir nechta xabarga bo‘linadi.

Kompaniya/kun/hisobot turi MongoDBdagi noyob kalit bilan takrorlardan himoyalangan. Telegram xabarni qabul qilib, javob yoki MongoDB tasdig‘i yo‘qolsa, qayta urinishda bitta bo‘lak takrorlanishi mumkin. O‘tgan kun hisobotlari avtomatik qayta yuborilmaydi. Sozlamani qayta saqlash bugungi yetib kelgan hisobotni endi bekor qilmaydi. Jadvalni qo‘lda qayta ishga tushirsangiz, bugunning yuborilmagan hisoboti olinadi.

Manbalar: https://docs.cron-job.org/rest-api.html va https://core.telegram.org/bots/api


## Bot buyruqlari va tekshiruv

Deploydan keyin Admin → Telegram → “Sinov xabari” ni bosing. Bu Telegram webhookini `/api/bot/:companyId` ga bog‘laydi, maxfiy headerni sozlaydi va buyruqlar menyusini yaratadi. So‘ng botga yangi `/start` xabarini yuboring. Bot xush kelibsiz xabari va chat ID bilan javob beradi. `/sinov` va oddiy `sinov` ham ishlaydi. Guruhda bot Privacy Mode sabab oddiy matnni ko‘rmasligi mumkin: `/sinov@bot_username` yoki `/hisobot@bot_username` dan foydalaning.

`/hisobot` faqat admin belgilagan qabul qiluvchi chat yoki guruhda davomatni ko‘rsatadi. Begona chatga xodimlar ma’lumoti berilmaydi. Shaxsiy chatda “Bugungi hisobot” va “Sinov” tugmalari paydo bo‘ladi. Webhook takror yuborilgan update_id bo‘yicha qayta xabar yubormaydi; tarmoq javobi yo‘qolishida Telegram yetkazib berishning aynan-bir-marta kafolati yo‘q.

“Ulanishni tekshirish” tugmasi webhook manzili, Telegramning yetkazib berish xatosi, cron-job.org vazifasining faol holati, oxirgi/keyingi bajarilishi va saytga oxirgi kelgan cron so‘rovini ko‘rsatadi. Telegram yoki cron so‘rovi 401/403 olsa, Vercel Production domenining Deployment Protection cheklovini tekshiring. Maxfiy kalitlarni skrinshotga qo‘shmang.

“Bugungi hisobotni yuborish” haqiqiy joriy statistikani yuboradi. U kunlik rejalangan hisobotning yuborilgan belgisini o‘zgartirmaydi, ya’ni keyinchalik jadvaldagi hisobot ham keladi.

## Dashboard

Menyudagi Dashboard’da sana, 7 kunlik ustunli grafika, kunlik doiraviy taqsimot va holat bo‘yicha filtrlanadigan xodimlar ro‘yxati bor. U faqat kompaniyaning MongoDB ma’lumotlaridan foydalanadi. Tarixiy grafikalar joriy xodimlar ro‘yxati asosida hisoblanadi; o‘chirilgan xodimlar kiritilmaydi. “Qayd yo‘q” ta’til yoki kasallik haqida xulosa bildirmaydi.

Xodimning shaxsiy sahifasida bugungi holat saqlanib ko‘rinadi. Kun chegarasi Toshkent vaqti bo‘yicha hisoblanadi. Bir vaqtda kelgan ikki skaner so‘rovi foydalanuvchi darajasidagi qulf bilan ketma-ketlashtiriladi; tasodifiy tez takroriy skanerlashlar 5 soniyalik himoyaga ega.
