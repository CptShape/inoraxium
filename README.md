# Inoraxium · Evrenin Atlası

Google ile giriş, DM/Public/seçili kullanıcı erişimi ve linki bilenlere açık medya destekleyen Chronicler atlası.

**Kurulum: [FIREBASE_SETUP.md](FIREBASE_SETUP.md).** Firebase bağlanana kadar site boş görünür. Her yeni sayfa varsayılan olarak DM'ye özeldir. Public Git deposunda duran kaynak dosyaları web izinleriyle gizlenemez; kaynak depoyu private tut.

```powershell
npm ci
npm run dev
npm test
npm run test:rules
npm run build
npm run firebase:sync
```

`.env.example` bağlantı alanlarını gösterir. `.env` ve Admin SDK anahtarları Git'e alınmaz. `npm run build` uygulama kabuğunu ve hash isimli public medyayı üretir; özel vault çıktısı `.private-build` içinde kalır. Sayfalar ve medya Firebase'e yerel `firebase:sync` komutuyla aktarılır. İçerik güncellemesi mevcut erişim izinlerini korur.

GitHub Pages workflow'u dört `VITE_FIREBASE_*` repository variable'ını kullanır. Kuralları/indeksleri ayrıca `npx firebase deploy --only firestore` ile yayınla. Firebase Hosting alternatifi de hazır.

Markdown, bilgi kutuları, görsel sekmeleri, wiki bağlantıları, sayfa gömmeleri, JSON Canvas panoları, etiketler, arama, yer imleri ve bağlantı haritası desteklenir. Chronicler'ın özel `.map` / `.timeline` türleri bu sürümde desteklenmez. Kaynak içerik yeniden biçimlendirilmez.

Firebase Storage ve Blaze gerekmez. Sayfa metinleri Firestore kurallarıyla korunur; görseller linki bilen herkese açıktır. URL gizlemek erişim kontrolü değildir.
