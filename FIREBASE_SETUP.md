# Inoraxium · Google girişi ve sayfa izinleri

## Önce kaynak gizliliği

Mevcut `CptShape/inoraxium` deposu PUBLIC ve bütün Markdown/görselleri içeriyor. Web sitesindeki izinler GitHub'daki kaynak dosyaları gizlemez. Gizli içerik kullanmadan önce GitHub → Settings → General → Danger Zone → Change visibility ile depoyu PRIVATE yap.

GitHub Pages'in private depodan yayın yapması kişisel hesapta GitHub Pro gerektirir. Böyle bir planın yoksa private depoyu koruyup aşağıdaki Firebase Hosting seçeneğini kullan. Önceden public olarak yayınlanan/kopyalanan içerikler sonradan geri alınamaz; eski Pages sürümünü ve eski Actions artifact'larını da kaldır. Public ve private sürümleri aynı anda yayınlama.

## 1. Firebase ve Google

1. [Firebase Console](https://console.firebase.google.com/) → **Add project**. Bir proje oluştur (örnek: `inoraxium-atlas`). Google Analytics bu özellik için gerekmez.
2. **Project settings → General → Your apps → Web (`</>`)** ile web uygulaması ekle. Hosting'i bu aşamada seçmek zorunda değilsin. `firebaseConfig` içindeki değerleri kaydet.
3. **Build → Authentication → Get started → Sign-in method → Google → Enable**. Projeye ad ve destek e-postası girip kaydet. Ayrı Google OAuth istemcisi veya Google API anahtarı oluşturman gerekmiyor; Firebase Google sağlayıcısı bunu yönetir. Ayrı bir Google Cloud projen varsa onu Firebase'e ekleyebilirsin.
4. **Authentication → Settings → Authorized domains** listesine `cptshape.github.io`, `localhost`, `127.0.0.1` ekle. Alan adı gir; `https://` veya `/inoraxium/` ekleme. Özel domain kullanırsan onu da ekle.
5. **Firestore Database → Create database → Standard edition → Production mode**, `(default)` veritabanı. Avrupa bölgesi seçebilirsin; Storage ile yakın bölge kullan.
6. **Storage → Get started** ile bucket oluştur. Cloud Storage için **Blaze / faturalandırma hesabı gerekir**. Bütçe uyarısı kur; bütçe uyarısı harcamayı durduran bir limit değildir. Bucket adını Console'dan aynen kopyala (`...firebasestorage.app` veya mevcut projelerde `...appspot.com`).

## 2. Yerel bağlantı

Bu projenin kökünde `.env` hazır, değerler boş. `.env.example` örnektir. Web uygulamasındaki değerlerle `.env` dosyasını doldur:

```dotenv
VITE_FIREBASE_API_KEY=Console-degeri
VITE_FIREBASE_AUTH_DOMAIN=PROJE_ID.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=PROJE_ID
VITE_FIREBASE_STORAGE_BUCKET=BUCKET_ADI
VITE_FIREBASE_APP_ID=Console-degeri

FIREBASE_PROJECT_ID=PROJE_ID
FIREBASE_STORAGE_BUCKET=BUCKET_ADI
GOOGLE_APPLICATION_CREDENTIALS=C:/secure/inoraxium-service-account.json
```

`VITE_` değerleri tarayıcı yapılandırmasıdır, yönetici yetkisi vermez. Admin JSON anahtarını asla `VITE_` değişkenine, depoya, web klasörüne veya sohbete koyma.

```powershell
cd C:\Dev\FRP\Chronicler\inoraxium
npm ci
npx firebase login
npx firebase use --add
```

Kendi Firebase projenin ID'sini seç. Mevcut `firebase.json` dosyasını koru; `firebase init` ile üzerine yazma.

## 3. Güvenlik kuralları ve CORS

```powershell
npx firebase deploy --only firestore,storage
```

Bu komut `firestore.rules`, indeksler ve `storage.rules` dosyalarını yükler. Storage kurallarının Firestore'a erişmesi için CLI bir hizmetler arası erişim izni isterse etkinleştir. Kurallar yayınlanmadan veri yükleme.

Görseller Firebase Storage SDK üzerinden yetki kontrolüyle indirilir; herkese açık download-token URL'si kullanılmaz. Tarayıcının bu indirmeleri yapabilmesi için [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) kur ve kendi hesabınla:

```powershell
gcloud auth login
gcloud storage buckets update gs://BUCKET_ADI --cors-file=storage.cors.json
```

Özel domain veya Firebase Hosting kullanıyorsan `storage.cors.json` dosyasındaki origin listesine `https://PROJE_ID.web.app` ve/veya kendi tam origin'ini ekle. Bucket'ı public yapma ve tüm kullanıcılara Storage IAM okuma izni verme.

## 4. İçerikleri Firebase'e yükle

**Project settings → Service accounts → Firebase Admin SDK → Generate new private key**. JSON'u depo dışında, örneğin `C:\secure\inoraxium-service-account.json` olarak sakla. `.env` içindeki `GOOGLE_APPLICATION_CREDENTIALS` bu dosyaya işaret etsin. Anahtar yalnızca bilgisayarındaki senkronizasyon komutunda kullanılır. Kurumsal ortamda bunun yerine Application Default Credentials / Workload Identity tercih edilebilir.

```powershell
npm run firebase:sync
```

Komut Markdown/canvas verilerini Firestore'a, sayfa kapsamlı medya kopyalarını Storage'a yükler. **Her yeni sayfa `dm` olarak başlar.** Yeniden yükleme mevcut izinleri korur. Silinen sayfaların veritabanı kayıtları kaldırılır; eski medya nesnelerine de erişim kapanır. Eski medya fiziksel olarak bucket'ta kalabilir; depolama temizliğini ayrıca yapabilirsin. Aynı sayfa başka klasöre taşınırsa yeni sayfa sayılır ve DM olarak başlar.

`npm run build` artık sadece uygulama kabuğunu üretir; Markdown/görseller `dist` içine girmez. `.private-build` yerel içerik hazırlama alanıdır ve Git dışında kalır.

## 5. İlk DM'yi tanımla

1. `.env` doluyken `npm run dev` çalıştır, terminaldeki adresi aç ve **Google ile giriş** yap. Henüz DM olmadığın için içerik boş olması normaldir.
2. Firebase Console → **Authentication → Users** → kendi hesabının **UID** değerini kopyala.
3. **Firestore Database → Data → Start collection**: koleksiyon `roles`, belge ID'si **kendi UID'n**, alan `dm`, türü **boolean**, değeri **true**. E-posta yerine UID kullan. `users` belgesine `dm` ekleme.
4. DM rolü canlı algılanır. Gerekirse sayfayı yenile. DM bütün sayfaları görebilir ve her sayfanın başlığında **Erişim: DM** düğmesi çıkar.

DM atama istemciden yapılamaz. İkinci bir DM gerekiyorsa onun UID'si için de Console'da `roles/{UID}` belgesi oluştur. DM rolünü kaldırmak için bu belgeyi kaldır veya `dm: false` yap.

## 6. Günlük kullanım

- **DM**: yalnızca DM'ler görür (varsayılan).
- **Public**: Google girişi yapmayanlar dahil herkes görür.
- **Seçili kullanıcılar**: işaretlediğin kayıtlı kullanıcılar ve DM'ler görür.
- Oyuncunun listede görünmesi için siteye **bir kez Google ile giriş yapmış olması** gerekir. Sadece e-posta yazmak izin vermez; izin Firebase UID'sine bağlanır.
- Public bir sayfanın gizli sayfaya link vermesi o sayfayı açmaz. Gizli gömülü sayfa/canvas kartı da açılmaz. Arama/menü/harita yalnızca erişilebilir sayfalardan oluşur.
- İzin değişiklikleri canlı dinlenir; açık görünüm, arama ve medya yeniden yetkilendirilir. Birisinin önceden okuduğu veya kaydettiği bilgiyi geri almak mümkün değildir.
- Bir sayfaya yüklenen görsel de o sayfanın iznini izler. Aynı görseli bir Public sayfada kullanırsan o kopya herkese açılmış olur.

İçerik güncellemek için Chronicler'da kaydet ve `npm run firebase:sync` çalıştır. İzin değiştirmek için tekrar build/push yapmana gerek yoktur. Arayüz kodu değişiklikleri için normal Git gönderimini kullan.

## 7A. GitHub Pages ile yayın

Private repo + uygun GitHub planı kullanıyorsan:

1. GitHub → **Settings → Secrets and variables → Actions → Variables** içinde şu beş repository variable'ını ekle: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_APP_ID`. Değerler `.env` ile aynı olacak.
2. **Settings → Pages → Source: GitHub Actions**.
3. **Actions → Publish Inoraxium Atlas → Run workflow**.
4. Site `https://cptshape.github.io/inoraxium/` altında çalışır. Firebase Authorized domains ve Storage CORS origin'i `cptshape.github.io` olmalı.

GitHub'a **Admin SDK JSON / service account** eklenmez. Workflow kullanıcı içeriklerini yüklemez; sadece kabuğu derler, test eder ve yayınlar. Kurulum tamamlanana kadar site güvenli biçimde boş görünür.

## 7B. Firebase Hosting ile yayın (alternatif)

GitHub Free kullanıyorsan kaynak depoyu private tutup:

```powershell
npm run build
npx firebase deploy --only hosting
```

Adres `https://PROJE_ID.web.app` olur. Authentication Authorized domains ve Storage CORS'a bu domain'i ekle. `firebase.json` Hosting yapılandırması hazır. Firebase Hosting de yalnızca kabuğu yayınlar; sayfa izinlerini yine Firestore/Storage kuralları uygular.

## Test ve sorun giderme

```powershell
npm test
npm run test:rules
npm run build
```

Kurallar testi Java 21 gerektirir; emulator gerçek bulut hesabına bağlanmadan misafir, seçili oyuncu, başka oyuncu, DM, doğrudan dosya erişimi ve izin iptalini doğrular.

- `auth/unauthorized-domain`: Authentication Authorized domains.
- `permission-denied`: kuralları yayınla, DM belgesinin UID ve boolean türünü kontrol et.
- `failed-precondition` / indeks bağlantısı: Firestore indekslerinin oluşturulmasını bekle, gerekirse `npx firebase deploy --only firestore:indexes`.
- `storage/unauthorized` veya CORS: Storage kuralları, Firestore hizmet erişim izni ve CORS origin listesi.
- Giriş ekranı yerine “Firebase bağlantısı henüz yapılandırılmadı”: beş `VITE_` değişkenini kontrol et; yerelde dev sunucusunu yeniden başlat, yayında yeniden build et.

Resmî kaynaklar: [Google ile giriş](https://firebase.google.com/docs/auth/web/google-signin), [sorgu güvenlik kuralları](https://firebase.google.com/docs/firestore/security/rules-query), [korumalı Storage indirmeleri ve CORS](https://firebase.google.com/docs/storage/web/download-files), [Admin SDK kurulumu](https://firebase.google.com/docs/admin/setup), [Storage Blaze koşulu](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024), [GitHub Pages planları](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site).
