# Inoraxium · Firebase kurulumu (Storage gerektirmez)

## Seçilen model

Sayfa metinleri ve canvas verileri Authentication + Firestore ile korunur. Her yeni sayfa DM'ye özeldir. Görseller/medya ise GitHub Pages'te uzun hash isimleriyle yayınlanır: **linki bilen herkes giriş yapmadan açabilir.** Kaynak dosya adları URL'de bulunmaz ve public medya indeksi üretilmez. Ancak bu erişim kontrolü değildir: linkler ağ kayıtlarından, tarayıcı geçmişinden veya paylaşım yoluyla bulunabilir. Aynı dosyaya sahip biri hash'i hesaplayabilir. Sayfa iznini kaldırmak, görselin linkini kapatmaz.

Firebase Storage, bucket, CORS veya Blaze yükseltmesi GEREKMEZ. Authentication/Firestore'un Spark kotalarıyla başlanabilir. Kaynak Markdown ve orijinal görsellerin bulunduğu GitHub deposunu private tut. Private depodan GitHub Pages yayını uygun GitHub planı gerektirir; bu Firebase planından bağımsızdır. GitHub Free için aşağıdaki Firebase Hosting alternatifi kullanılabilir.

## 1. Firebase ve Google

1. [Firebase Console](https://console.firebase.google.com/) → Add project. Spark planında kalabilirsin; Analytics gerekmez.
2. Project settings → General → Your apps → Web (`</>`) uygulaması ekle. `firebaseConfig` değerlerini kaydet.
3. Authentication → Get started → Sign-in method → Google → Enable. Destek e-postasını seçip kaydet. Ayrı Google Cloud OAuth istemcisi gerekmez.
4. Authentication → Settings → Authorized domains listesine `cptshape.github.io`, `localhost`, `127.0.0.1` ekle. Protokol veya `/inoraxium/` ekleme. Özel domain/Hosting kullanırsan onu da ekle.
5. Firestore Database → Create database → **Standard edition**, ID **(default)**, **Production mode**. Bir Avrupa bölgesi seçebilirsin.
6. **Storage oluşturma; faturalandırma hesabı bağlamana gerek yok.**

## 2. .env ve kurallar

Kökteki `.env` dosyasını web uygulaması config'iyle doldur:

```dotenv
VITE_FIREBASE_API_KEY=Console-degeri
VITE_FIREBASE_AUTH_DOMAIN=PROJE_ID.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=PROJE_ID
VITE_FIREBASE_APP_ID=Console-degeri
FIREBASE_PROJECT_ID=PROJE_ID
GOOGLE_APPLICATION_CREDENTIALS=C:/secure/inoraxium-service-account.json
```

Eski `VITE_FIREBASE_STORAGE_BUCKET` ve `FIREBASE_STORAGE_BUCKET` alanları artık kullanılmıyor; silebilirsin. Admin anahtarına VITE öneki verme ve anahtarı Git'e veya sohbete koyma.

```powershell
cd C:\Dev\FRP\Chronicler\inoraxium
npm ci
npx firebase login
npx firebase use --add
npx firebase deploy --only firestore
```

Kendi proje ID'ni seç. Mevcut dosyaların üstüne `firebase init` çalıştırma. Bu komut kuralları/indeksleri yükler; indekslerin hazır olması birkaç dakika sürebilir.

## 3. İçerik aktarımı

Project settings → Service accounts → Firebase Admin SDK → Generate new private key. JSON'u depo dışında `C:\secure\inoraxium-service-account.json` gibi bir yere kaydet. `.env` içindeki dosya yolu bunu göstermeli. Anahtar yalnızca yerel aktarım komutunda kullanılır.

```powershell
npm run firebase:sync
```

Yeni sayfalar `dm` olarak eklenir, mevcut sayfaların izinleri korunur. Taşınan sayfa yeni sayfa sayılır. Silinen sayfaların Firestore kayıtları kaldırılır. Komut Storage'a dosya yüklemez; Pages'te yayınlanacak medya URL'lerini Firestore'a kaydeder.

**Önceki Storage sürümünden geçiyorsan sync komutunu bir kez tekrar çalıştır ve güncel Pages build'ini yayınla.** Böylece eski `page-media/...` başvuruları yeni `media/...` URL'leriyle değişir. Eski ve yeni sürüm karışırsa görseller 404 verebilir.

## 4. İlk DM

1. `npm run dev` çalıştır ve gösterilen adreste Google ile giriş yap. Henüz DM değilsen boş görünüm normaldir.
2. Authentication → Users → kendi hesabının UID değerini kopyala.
3. Firestore Data'da `roles` koleksiyonu oluştur. Belge ID'si **kendi UID'n**; `dm` alanı **boolean**, değeri **true** olsun.
4. Rol canlı algılanır, gerekirse yenile. Sayfalarda **Erişim: DM** düğmesi çıkar.

DM rolü istemciden atanamaz. Başka DM eklemek için onun UID'siyle Console'da aynı işlemi yap. Oyuncular ilk Google girişlerinden sonra kullanıcı seçim listesinde görünür.

## 5. Kullanım ve güncelleme

- DM: yalnızca DM'ler (varsayılan).
- Public: giriş yapmayanlar dahil herkes.
- Seçili kullanıcılar: seçilen kayıtlı kullanıcılar ve DM'ler.
- Gizli sayfalar arama, menü, gömme ve bağlantı haritasında açılmaz. İzin değişiklikleri canlı uygulanır.
- Medya dosyaları public linktir; sayfa izniyle indirmeleri engellenmez.

İçerik/görsel değişiklikleri için:

```powershell
npm run firebase:sync
git add .
git commit -m "Update world notes"
git push
```

Medya build sırasında üretilir. Sadece izin değişikliğinde sync/build/push gerekmez. Dev sunucusu açıkken kaynak medya değiştirirsen sunucuyu yeniden başlat.

## 6A. GitHub Pages

1. Settings → Secrets and variables → Actions → Variables: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` alanlarını ekle (dört adet).
2. Settings → Pages → Source: GitHub Actions.
3. Actions → Publish Inoraxium Atlas → Run workflow.
4. Adres: `https://cptshape.github.io/inoraxium/`.

Admin SDK JSON anahtarını GitHub'a koyma. İçerikler yerelde sync ile Firestore'a aktarılır. Workflow uygulama kabuğunu ve public medyayı yayınlar; Markdown/canvas belgeleri `dist` içine girmez. Derleme denetimi bunu kontrol eder.

## 6B. Firebase Hosting alternatifi

```powershell
npm run build
npx firebase deploy --only hosting
```

Adres `https://PROJE_ID.web.app` olur. Domain'i Authentication Authorized domains listesine ekle. Hosting yapılandırması hazırdır; Storage kullanmaz. Hosting'deki medya da linki bilen herkese açıktır.

## Test ve sorun giderme

```powershell
npm test
npm run test:rules
npm run build
```

Kurallar testi Java 21 ile yalnızca Firestore emulator'ünü çalıştırır. Misafir/oyuncu/DM erişimi, yetki yükseltme girişimi ve izin iptali denenir. Gerçek Google girişini kurulum sonrası kendi hesabınla test et.

- `auth/unauthorized-domain`: Authorized domains.
- `permission-denied`: Firestore kuralları ve doğru UID'deki boolean DM rolü.
- İndeks hatası: `npx firebase deploy --only firestore:indexes`; indeksin hazır olmasını bekle.
- Görsel 404: güncel sync ve Pages build'i birlikte yayınlanmış mı kontrol et.
- Bağlantı yapılandırılmadı: dört VITE alanını doldur, dev sunucusunu yeniden başlat/yayını yeniden derle.

Kaynaklar: [Google girişi](https://firebase.google.com/docs/auth/web/google-signin), [Firestore kuralları](https://firebase.google.com/docs/firestore/security/rules-query), [Firebase fiyatlandırması](https://firebase.google.com/pricing/), [GitHub Pages planları](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site).
