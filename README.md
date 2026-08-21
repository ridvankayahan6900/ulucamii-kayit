# Marche Ulu Camii çevrimdışı kurs kayıt uygulaması

Marche-en-Famenne Ulu Camii'nin 2026-2027 Kur'an-ı Kerim ve Temel Dinî Bilgiler Kursu için hazırlanmış, Türkçe-Fransızca ve mobil öncelikli kayıt uygulamasıdır. Uygulama derleme gerektirmez; bu klasör doğrudan GitHub Pages üzerinden yayımlanabilir veya `index.html` dosyası `file://` ile açılabilir.

## Gizlilik mimarisi

Bu uygulama reşit olmayan öğrencilerin kimlik ve sağlık bilgilerini işler. Bu nedenle veri akışı bilinçli olarak yalnızca tarayıcı içinde tutulur:

- Backend, veritabanı, analytics, çerez ve üçüncü taraf form hizmeti yoktur.
- Çalışma zamanında dış ağ isteği yapılmaz; JavaScript kitaplıkları ve Unicode font yerel `vendor/` klasöründedir.
- Kimlik ve öğrenci fotoğrafları cihazda yönü düzeltilerek en uzun kenarı 1600 piksel olacak biçimde JPEG 0,8 kalitesinde sıkıştırılır.
- Yarım kayıt aynı cihazın `localStorage` alanında taslak olarak saklanır. Depolama kotası dolarsa metin taslağı korunur, büyük görseller yalnızca açık oturumda tutulur.
- PDF yalnızca kullanıcının açıkça “PDF oluştur” komutuyla cihaz içinde üretilir; paylaşım veya indirme ayrıca kullanıcı eylemi gerektirir.
- “Taslağı sil” komutu kayıt taslağını, görüntüleri ve imzayı bu tarayıcıdan kaldırır.

`file://` kullanımında dahi PDF üretiminin çalışması için DejaVu Sans fontunun yerel TTF sürümüne ek olarak aynı fontun yerel Base64 betiği bulunur. Hiçbir font veya kod CDN'den alınmaz.

## Yapılandırma

Kurum bilgileri `index.html` dosyasının en üstündeki tek `CAMI` nesnesindedir. Telefon ve e-posta henüz bilinmediği için bilerek boş bırakılmıştır. Yayımlamadan önce yalnızca bu iki alan doldurulmalıdır; dosyadaki yorumlar ilgili satırları işaretler.

## Dosya yapısı

```text
kayit/
├── index.html
├── README.md
├── DESIGN.md
├── assets/
│   ├── app.js
│   ├── data.js
│   ├── i18n.js
│   ├── logo.svg
│   ├── pdf.js
│   ├── signature.js
│   └── styles.css
├── vendor/
│   ├── DejaVuSans.base64.js
│   ├── DejaVuSans.ttf
│   ├── fontkit.umd.min.js
│   ├── pdf-lib.min.js
│   └── THIRD_PARTY_NOTICES.txt
└── .impeccable/
    └── design.json
```

Üretim klasöründe npm, paket yöneticisi veya derleme adımı yoktur. Yerel kontrol için `index.html` çift tıklanabilir. GitHub Pages'te bu klasör belge kökü olarak sunulmalıdır.

## Okul listesinin kaynakları

Liste yalnızca resmî belediye/öğretim sayfalarında veya kurumların resmî sitelerinde doğrulanabilen adlardan kurulmuştur. Doğrulanamayan yerleşimlerde tahminî okul adı eklemek yerine listenin sonundaki “Diğer / Autre” seçeneği kullanılır.

- Marche-en-Famenne belediyesi: [Service Enseignement](https://www.marche.be/administration/les-services-communaux/service-enseignement-780/), [resmî okul ağı](https://ecolescommunales.marche.be/) ve [öğretim rehberi](https://bottin.marche.be/categorie/enseignement)
- Enseignement Libre Marchois: [Institut Sainte-Julie](https://saintejulie.enseignementlibremarche.be/), [Institut Saint-Martin](https://ism.enseignementlibremarche.be/), [Institut Saint-Roch](https://isr.enseignementlibremarche.be/) ve [Institut Notre-Dame](https://ind.enseignementlibremarche.be/)
- Athénée Royal Marche-Barvaux-Bomal: [ARMBB resmî sitesi](https://www.armbb.be/)
- Durbuy belediyesi: [Écoles communales](https://www.durbuy.be/ecoles-communales/)
- Hotton belediyesi: [École communale de Hampteau](https://www.hotton.be/hotton/information/ecole-communale-hampteau)
- Nassogne belediyesi: [resmî okul rehberi](https://www.nassogne.be/fr/annuaire/ecoles-de-la-lhomme-ecole-communale-de-bande?u=7a841bd75d1740fa83ff16ec713b2fed)
- Rendeux belediyesi: [enseignement communal](https://www.rendeux.be/ma-commune/enseignement/ecole-communale-1/agendas/calendrier-scolaire-officel)
- Somme-Leuze belediyesi: [dört resmî okul yerleşkesi](https://www.sommeleuze.be/vivre-a-somme-leuze/enseignement-1/4-implantations)
- Tenneville/Champlon: [École de Champlon-Tenneville](https://ecolechamplontenneville.wordpress.com/)

## Yerel bağımlılıklar

- `pdf-lib` 1.17.1 — MIT
- `@pdf-lib/fontkit` 1.1.1 — MIT
- DejaVu Sans 2.37 — Bitstream Vera/DejaVu lisansı

Ayrıntılar `vendor/THIRD_PARTY_NOTICES.txt` dosyasındadır.

## Doğrulama

Test araçları üretim klasörünün dışında, `../kayit-qa/` altında tutulur. Bunlar yalnızca kalite kontrol içindir; uygulamayı yayımlamak veya çalıştırmak için gerekli değildir.

```powershell
cd ..\kayit-qa
npm ci
node --test static.test.js
node e2e.mjs
```

Uçtan uca test; altı ekran genişliği, açık/koyu tema, sekiz adım, taşma, dokunma hedefleri, form yazı boyutları, çeviri kapsamı, görüntü sıkıştırma, sözleşme kilidi, imza, üç sayfalık PDF, Unicode metin geri okuma, sıfır dış istek ve `file://` PDF üretimini denetler. Test verileri tamamen sentetiktir.
