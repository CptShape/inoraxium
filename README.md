# Inoraxium · Evrenin Atlası

Chronicler vault'unu GitHub Pages üzerinde gezilebilen, salt okunur bir atlasa dönüştürür. İçerik doğrudan bu depodaki Markdown, canvas ve görsel dosyalarından üretilir. Chronicler dosyaları yeniden biçimlendirilmez.

## GitHub Pages'i açmak

1. GitHub deposunda **Settings → Pages** bölümünü aç.
2. **Build and deployment → Source → GitHub Actions** seç.
3. **Actions → Publish Inoraxium Atlas → Run workflow → main → Run workflow** seç. İlk yüklemeden kalan başarısız bir çalıştırma varsa **Re-run all jobs** da kullanılabilir.
4. Yayın tamamlanınca site adresi **Settings → Pages** ve workflow'un `github-pages` ortamında görünür. Bu depo için beklenen adres: **https://cptshape.github.io/inoraxium/**.

Pages açılmadan workflow siteyi üretip test eder; yayınlama adımı atlanır. Ayarı yaptıktan sonra workflow'u yeniden çalıştırman yeterli.

## İçerik güncellemek

Chronicler'da her zamanki gibi sayfaları düzenle ve kaydet. Ardından bu klasörde:

```powershell
git add .
git commit -m "Update world notes"
git push
```

`main` dalına her gönderim siteyi yeniden üretir ve yayınlar. Web sitesinden düzenleme yapılamaz. Yer imleri, son ziyaretler ve renk tercihi ziyaretçinin kendi tarayıcısında tutulur.

## Yerelde çalıştırmak

Node.js 22.12+ gerekir.

```powershell
npm ci
npm run dev
```

Terminalin gösterdiği yerel adrese git. Markdown, canvas ve görsellerdeki değişiklikler otomatik yüklenir.

```powershell
npm test
npm run build
npm run preview
npm run audit:links
```

`audit:links` kaynak vault içinde bulunmayan sayfa/görsel başvurularını listeler. Yayın bunlar için içerik uydurmaz; sitede sayfanın henüz bulunmadığı belirtilir.

**`.env` veya API anahtarı gerekmez.** Site tamamen statiktir, giriş sistemi ve sunucu bağımlılığı yoktur. `.gitignore` yerel `.env` dosyalarını, bağımlılıkları, derleme çıktılarını ve Chronicler önbelleklerini dışarıda tutar. Görsel üretim kayıtları da yayın içeriği olmadıkları için Git dışında kalır.

## Desteklenen içerik

- GFM Markdown: başlıklar, tablolar, listeler, kod blokları, dipnotlar ve temizlenmiş HTML.
- `[[Sayfa]]`, `[[Sayfa|Görünen isim]]`, `[[Sayfa#Başlık]]`, `[[#Başlık]]`.
- Aynı isimli dosyalarda bulunduğu klasöre en yakın eşleşme; tam vault yolu ile kesin hedef seçimi. Büyük/küçük harf farkı ve boşluklar çözülür.
- `![[görsel.png]]`, `![[görsel.png|300]]`, standart Markdown görselleri, sayfa ve başlık gömmeleri. Döngüsel gömmelerde derinlik sınırlanır.
- YAML bilgi kutuları, birden fazla görsel ve sekmeleri, etiketler, geri bağlantılar, okuma süresi, büyütülebilen görseller ve link önizlemeleri.
- `||gizli metin||`: tıklayarak aç/kapat.
- `.canvas` / JSON Canvas 1.0: Markdown kartları, görseller, sayfa kartları, dış bağlantılar, gruplar, renkler, yönlü ve etiketli oklar. Kaydırma, yakınlaştırma, dokunmatik sürükleme ve pinch. Klavye: `+`, `-`, `0`, yön tuşları.
- Metin içinde arama (`Ctrl+K` / `⌘K`), koleksiyon/etiket filtreleri, yer imleri, son ziyaretler ve gezilebilir bağlantı haritası.
- Mobil düzen, koyu/açık tema ve sistemin azaltılmış hareket tercihi.

## Kapsam

Bu, Chronicler'ın salt okunur dosya görüntüleyicisidir; uygulamanın birebir kopyası değildir. Chronicler'a özel eklentiler, `.map`, `.timeline`, özel takvimler, uygulama temaları/CSS snippet'leri ve işletim sistemindeki vault dışı dosyalar bu sürümde yorumlanmaz. Güncel vault'ta bu özel sayfa tipleri bulunmuyor; canvas desteği test fixture'larıyla doğrulanır. Özel font, tema veya yeni bir sayfa türü gerektiğinde web tarafına ayrıca destek eklenmelidir.

## Düzen

```text
*.md, Mythology/, Deadly Sins/, ...   Chronicler kaynak içeriği
images/                             Kaynak görseller
_system/                            Chronicler şablonları (siteye alınmaz)
_site/site.config.json              Başlık, koleksiyonlar ve öne çıkan sayfalar
_site/src/                          Arayüz, Markdown ve canvas görüntüleyicisi
_site/lib/                          İçerik ve bağlantı çözümleme
_site/scripts/                      Vault derleyicisi ve bağlantı denetimi
_site/tests/                        İçerik, güvenli render ve canvas testleri
.github/workflows/pages.yml         Otomatik GitHub Pages yayını
```

`_site` uygulama dosyalarını vault içeriğinden ayırır. Siteye `.git`, `_system`, önbellekler, README veya uygulama kaynak kodu sayfa olarak alınmaz. Görseller web için türetilen WebP kopyaları ve küçük önizlemelerle sunulur; kaynak dosyalar Git deposunda korunur. URL'ler hash tabanlıdır: bir sayfanın bağlantısını doğrudan açmak veya yenilemek GitHub Pages üzerinde 404 üretmez. Alt dizin ve özel alan adı için asset yolları görecelidir.
