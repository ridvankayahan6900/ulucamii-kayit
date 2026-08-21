---
name: "Marche Ulu Camii Kurs Kayıt"
description: "Resmî belge ciddiyetini mobil kayıt rahatlığıyla birleştiren sakin arayüz sistemi."
colors:
  pine-primary: "#1F4E4E"
  gold-accent: "#B08D57"
  ink: "#22201D"
  muted: "#6B6560"
  line: "#D9D2C7"
  paper: "#FAF8F5"
  surface: "#FFFFFF"
  error: "#9F2F2A"
  success: "#266343"
  focus: "#196F9C"
typography:
  display:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "clamp(1.86rem, 7vw, 2.7rem)"
    fontWeight: 700
    lineHeight: 1.14
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "clamp(1.72rem, 7vw, 2.35rem)"
    fontWeight: 700
    lineHeight: 1.14
    letterSpacing: "-0.025em"
  body:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 750
    lineHeight: 1.2
rounded:
  sm: "8px"
  control: "10px"
  md: "14px"
  lg: "22px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "18px"
  lg: "30px"
components:
  button-primary:
    backgroundColor: "{colors.pine-primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "10px 17px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.pine-primary}"
    rounded: "{rounded.control}"
    padding: "10px 17px"
    height: "44px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "11px 12px"
    height: "48px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "16px 18px"
---

# Design System: Marche Ulu Camii Kurs Kayıt

## Overview

**Creative North Star: "Sessiz Kayıt Masası"**

Arayüz, resmî bir kayıt masasının düzenini küçük bir telefon ekranına taşır: açık görevler, okunaklı belge yüzeyleri ve yalnızca işlem sırasını anlatan işaretler. Kurumsal kimlik logo, koyu çam yeşili çerçeve ve ölçülü altın vurguyla görünür; süs, içeriğin veya gizlilik mesajının önüne geçmez.

Yoğun resmî metinler çevresinde ferah boşluk bırakılır. Her ekran tek bir ana işi taşır; kullanıcı önce bağlamı, sonra alanları, en son sabit alt gezinmeyi görür. Koyu tema aynı hiyerarşiyi düşük ışıkta korur.

**Key Characteristics:**

- Resmî belge düzeni ve sakin kurumsal ton
- Tek görevli, mobil öncelikli adımlar
- Çam yeşili ana eylem ve ölçülü altın ilerleme vurgusu
- İnce çizgiler, yumuşak yüzey ayrımı ve görünür odak durumu
- Açık ve koyu temada aynı bilgi hiyerarşisi

## Colors

Palet sıcak kâğıt nötrleri üzerinde koyu çam yeşili kurumsal çerçeve ve az kullanılan altın yönlendirme işaretlerinden oluşur.

### Primary

- **Koyu Çam:** Ana eylem, üst çubuk, önemli başlık ve mahremiyet yüzeyidir (`pine-primary`).

### Secondary

- **Ölçülü Altın:** İlerleme çizgisi, ince ayırıcı ve kontrollü vurgu rengidir (`gold-accent`).

### Neutral

- **Mürekkep:** Birincil metin rengidir (`ink`).
- **Sessiz Taş:** Açıklama ve ikincil bilgi rengidir (`muted`).
- **Sıcak Çizgi:** Alan, kart ve bölüm sınırlarını kurar (`line`).
- **Kâğıt:** Sayfanın sıcak nötr zeminidir (`paper`).
- **Temiz Yüzey:** Form, kart ve kontrol yüzeyidir (`surface`).

### Named Rules

**The Çam Yeşili Hiyerarşisi Rule.** Çam yeşili yön ve güven verir; altın yalnızca ilerleme, ince vurgu ve sınır görevinde kalır.

**The Semantic State Rule.** Hata, başarı ve odak renkleri yalnızca kendi durumlarında kullanılır; dekoratif vurguya dönüştürülmez.

## Typography

**Display Font:** Yerel sistem sans-serif yığını  
**Body Font:** Aynı yerel sistem sans-serif yığını  
**Label Font:** Aynı yerel sistem sans-serif yığını

**Character:** Haricî font yüklemeden çalışan, Belçika Türkçesi ve Fransızca karakterleri güvenilir biçimde gösteren temiz bir belge sesi. Karakter; ağırlık, ölçü ve boşlukla kurulur.

### Hierarchy

- **Display** (700, akışkan 1,86–2,7 rem, 1,14): Karşılama başlığı.
- **Headline** (700, akışkan 1,72–2,35 rem, 1,14): Her kayıt adımının tek ana başlığı.
- **Title** (700, yaklaşık 1–1,15 rem): Kart, sözleşme ve alt bölüm başlıkları.
- **Body** (400, 1 rem, 1,55): Açıklamalar ve form içeriği; uzun metinler en fazla 68 karakter ölçüsünde tutulur.
- **Label** (750, 0,9 rem): Alan adları ve kısa işlem metinleri.

### Named Rules

**The Tek Başlık Rule.** Her adımda yalnızca bir belirgin H1 bulunur; kurs yılı başlığın altında sakin metadata olarak yer alır, üstünde kaş başlık kullanılmaz.

## Layout

Uygulama mobilde ekranı doldurur; 1040 pikselden geniş görünümde 1040 piksellik dış kabuk içinde belge gibi çerçevelenir. Form adımları en fazla 760 piksel genişliğindedir. Yatay iç boşluk 18–42 piksel, dikey adım başlangıcı 28–58 piksel arasında akışkandır.

Alanlar geniş ekranda iki sütun, 620 piksel ve altında tek sütundur. 390 piksel ve altında ders bilgi tablosu ile çok seçenekli kontroller de tek sütuna iner. Üst ilerleme şeridi ve alt gezinme görünür kalır; içerik onların arkasında kayabilir.

**The Belge Ölçüsü Rule.** Uzun form ve sözleşme metni 760 pikseli aşmaz; geniş masaüstü boşluğu içeriği yaymak için kullanılmaz.

## Elevation & Depth

Sistem çoğunlukla çizgi ve ton farkıyla katman kurar. Gölge yalnızca uygulama kabuğu, ana eylem, karşılama bilgi yüzeyi ve geçici bildirim gibi gerçekten öne çıkan katmanlarda kullanılır; gölgeler yumuşak, aşağı yönlü ve düşük kontrastlıdır.

### Shadow Vocabulary

- **Kabuk gölgesi** (`0 16px 38px rgba(39, 31, 23, 0.11)`): Geniş ekranda uygulamayı arka zeminden ayırır.
- **Ana eylem gölgesi** (`0 8px 20px rgba(31, 78, 78, 0.18)`): Birincil düğmenin dokunulabilirliğini belirtir.
- **Bilgi yüzeyi gölgesi** (`0 10px 26px rgba(46, 35, 25, 0.07)`): Karşılama bilgi tablosunda hafif belge katmanı oluşturur.

**The Yumuşak Katman Rule.** Sıfır bulanıklıklı sert gölge kullanılmaz; düz yüzeyler önce ton ve bir piksellik çizgiyle ayrılır.

## Shapes

Alanlar 8 piksel, düğmeler 10 piksel, standart kartlar 14 piksel, kapanış ve PDF panelleri 22 piksel yarıçap kullanır. Tam yuvarlak form yalnızca ilerleme çubuğu ve küçük durum etiketlerine ayrılır. Sınırlar tek pikseldir; kesik sınır yalnızca imza ve yükleme gibi doğrudan etkileşim yüzeylerinde kullanılır.

## Components

### Buttons

- **Shape:** Ölçülü yuvarlak köşe (10 piksel), en az 44 piksel yükseklik.
- **Primary:** Beyaz metin, koyu çam yüzey, 10×17 piksel iç boşluk; sabit alt çubukta ana ilerleme eylemidir.
- **Hover / Focus:** Hover durumunda bir piksel yükselir ve çam tonu koyulaşır; klavye odağı üç piksellik mavi halka kullanır.
- **Secondary / Quiet:** İkincil düğme beyaz yüzey ve sıcak çizgi; sessiz eylem şeffaf yüzey ve altı çizili metindir.

### Cards / Containers

- **Corner Style:** Standart kartlarda 14 piksel.
- **Background:** Temiz yüzey; belge kâğıdında yumuşak nötr yüzey.
- **Shadow Strategy:** Varsayılan kartlar gölgesizdir; yalnızca karşılama ve mahremiyet yüzeyi hafif yükselir.
- **Border:** Bir piksellik sıcak çizgi.
- **Internal Padding:** Çoğunlukla 16×18 piksel; uzun metin yüzeylerinde daha geniş akışkan boşluk.

### Inputs / Fields

- **Style:** En az 48 piksel yükseklik, 16 piksel metin, beyaz yüzey, sıcak çizgi ve 8 piksel köşe.
- **Focus:** Çam sınır ve yarı saydam üç piksellik odak halkası.
- **Error / Disabled:** Hata yüzeyi açık kırmızı, sınır ve açıklama koyu kırmızıdır; devre dışı kontroller opaklığı düşürür ancak yerini korur.

### Navigation

Üstte kurum kimliği ve dil anahtarı, altında yapışkan adım adı/sayacı ve beş piksellik altın ilerleme çizgisi bulunur. Alttaki yapışkan gezinme, “Geri” ve bağlama göre adlandırılmış ana eylemi güvenli alan boşluklarıyla taşır.

### Signature Surface

İmza önizlemesi büyük, kesik altın sınırla çevrili boş bir belge alanıdır. Tam ekran modda üst sağdaki “Tamam” birincil eylemdir; soluk iki dilli yönlendirme çizimin arkasında kalır, alt araç çubuğu geri alma ve temizlemeyi taşır.

## Do's and Don'ts

### Do:

- **Do** her ekranda bir ana işi ve bir belirgin ilerleme eylemini koru.
- **Do** bilgi yoğunluğunu ince çizgiler, 14 piksel kart köşeleri ve geniş bölüm aralıklarıyla düzenle.
- **Do** en az 44 piksel dokunma hedefi, 16 piksel form metni ve görünür odak halkasını koru.
- **Do** koyu temada semantik renk rollerini ve aynı okuma sırasını sürdür.

### Don't:

- **Don't** kurs yılını veya başka metni ana başlığın üstünde kaş başlık olarak kullanma.
- **Don't** altını geniş yüzeylere, dekoratif gradyan metne veya anlamsız süse dönüştürme.
- **Don't** kartları iç içe yığma; yeni bir kart ancak ayrı bir belge veya işlem bölgesi gerçekten gerektiğinde eklenir.
- **Don't** emoji ya da Unicode glifi ikon yerine kullanma; mevcut çizilmiş SVG diliyle devam et.
