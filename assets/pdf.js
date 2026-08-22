/* Kayıt belgesi — resmî formların (EK-3 Öğrenci Kayıt Formu ve Kurs-Veli
   Sözleşmesi) düzeniyle birebir. Sayfa yapısı:
     1  Öğrenci Kayıt Formu  — çerçeveli tablo, fotoğraf kutusu, beyan, imza
     2+ Kurs-Veli Sözleşmesi — başlıklı bölümler, numaralı maddeler, son
        sayfada öğrenci/veli adı ve imza
     son Kimlik belgesi görüntüleri
   Yazı: Lora (Times'a yakın serif, OFL, Türkçe/Fransızca tam).             */
(function () {
  'use strict';

  const app = window.KayitApp = window.KayitApp || {};
  const PAGE_WIDTH = 595.28;
  const PAGE_HEIGHT = 841.89;
  const MARGIN = 56;                     // resmî belgedeki ~2 cm kenar
  const INNER = PAGE_WIDTH - MARGIN * 2;  // 483 pt

  function color(hex) {
    const v = hex.replace('#', '');
    return PDFLib.rgb(parseInt(v.slice(0, 2), 16) / 255, parseInt(v.slice(2, 4), 16) / 255, parseInt(v.slice(4, 6), 16) / 255);
  }
  const INK = color('#111111');
  const LINE = color('#222222');
  const MUTED = color('#555555');
  const WHITE = PDFLib.rgb(1, 1, 1);

  /* ------------------------------------------------------------ yükleme */
  async function loadBinary(relativePath) {
    // Gömülü kopya: file:// ile açılan yerel kopyada fetch çalışmaz.
    const gomulu = { 'vendor/Lora-Regular.ttf': 'LORA_REGULAR_BASE64', 'vendor/Lora-Bold.ttf': 'LORA_BOLD_BASE64' }[relativePath];
    if (gomulu && window[gomulu]) {
      const binary = atob(window[gomulu]);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return bytes;
    }
    const url = new URL(relativePath, document.baseURI).href;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return new Uint8Array(await response.arrayBuffer());
    } catch (fetchError) {
      if (location.protocol !== 'file:') throw fetchError;
      return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open('GET', url);
        request.responseType = 'arraybuffer';
        request.onload = () => {
          if (request.response && (request.status === 0 || (request.status >= 200 && request.status < 300))) resolve(new Uint8Array(request.response));
          else reject(fetchError);
        };
        request.onerror = () => reject(fetchError);
        request.send();
      });
    }
  }

  /* ------------------------------------------------------------ metin */
  function normalize(value) {
    return value === undefined || value === null || String(value).trim() === '' ? '' : String(value).trim();
  }

  function fitText(text, font, size, maxWidth) {
    const value = String(text || '');
    if (font.widthOfTextAtSize(value, size) <= maxWidth) return value;
    let result = value;
    while (result.length > 1 && font.widthOfTextAtSize(`${result}…`, size) > maxWidth) result = result.slice(0, -1);
    return `${result.trimEnd()}…`;
  }

  function wrapText(text, font, size, maxWidth) {
    const paragraphs = String(text || '').split(/\n/);
    const lines = [];
    paragraphs.forEach((paragraph, paragraphIndex) => {
      const words = paragraph.trim().split(/\s+/).filter(Boolean);
      let line = '';
      words.forEach((word) => {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
        else if (line) { lines.push(line); line = word; }
        else {
          let part = '';
          [...word].forEach((ch) => {
            const next = `${part}${ch}`;
            if (font.widthOfTextAtSize(next, size) > maxWidth && part) { lines.push(part); part = ch; }
            else part = next;
          });
          line = part;
        }
      });
      if (line) lines.push(line);
      if (paragraphIndex < paragraphs.length - 1) lines.push('');
    });
    return lines.length ? lines : [''];
  }

  /* İki yana yaslı satır: son satır ve tek kelimelik satırlar sola yaslı. */
  function drawJustified(page, line, font, size, x, y, width, isLast) {
    const words = line.split(' ').filter(Boolean);
    if (isLast || words.length < 2) { page.drawText(line, { x, y, size, font, color: INK }); return; }
    const textWidth = words.reduce((t, w) => t + font.widthOfTextAtSize(w, size), 0);
    const gap = (width - textWidth) / (words.length - 1);
    if (gap > size * 1.6) { page.drawText(line, { x, y, size, font, color: INK }); return; }
    let cx = x;
    words.forEach((w) => { page.drawText(w, { x: cx, y, size, font, color: INK }); cx += font.widthOfTextAtSize(w, size) + gap; });
  }

  function drawCentered(page, text, font, size, y, col) {
    const w = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (PAGE_WIDTH - w) / 2, y, size, font, color: col || INK });
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${d}/${m}/${date.getFullYear()}`;
  }

  function labelChoice(type, value) {
    const maps = {
      gender: { female: 'female', male: 'male' },
      relationship: { father: 'father', mother: 'mother', guardian: 'legalGuardian' },
      yesNo: { yes: 'yes', no: 'no' }
    };
    return maps[type] && maps[type][value] ? app.t(maps[type][value]) : normalize(value);
  }

  async function embedDataImage(document, dataUrl) {
    if (!dataUrl) return null;
    if (dataUrl.startsWith('data:image/png')) return document.embedPng(dataUrl);
    return document.embedJpg(dataUrl);
  }

  /* Görseli vesikalık oranında (3:4) ortadan kırpıp köşeleri yuvarlatır;
     şeffaf köşeli PNG döner. Hedef kutudan biraz büyük çözünürlükte. */
  async function yuvarlakVesikalik(document, dataUrl, genislikPt, yukseklikPt, yaricapPt) {
    if (!dataUrl) return null;
    const im = new Image();
    await new Promise((c, r) => { im.onload = c; im.onerror = r; im.src = dataUrl; });
    const olcek = 3;                                   // 3× punto → keskin baskı
    const W = Math.round(genislikPt * olcek), H = Math.round(yukseklikPt * olcek), R = yaricapPt * olcek;
    const cv = window.document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    // yuvarlak köşe maskesi
    ctx.beginPath();
    ctx.moveTo(R, 0); ctx.lineTo(W - R, 0); ctx.quadraticCurveTo(W, 0, W, R);
    ctx.lineTo(W, H - R); ctx.quadraticCurveTo(W, H, W - R, H);
    ctx.lineTo(R, H); ctx.quadraticCurveTo(0, H, 0, H - R);
    ctx.lineTo(0, R); ctx.quadraticCurveTo(0, 0, R, 0); ctx.closePath();
    ctx.clip();
    // kapla (cover): oran koru, ortadan kırp
    const k = Math.max(W / im.naturalWidth, H / im.naturalHeight);
    const dw = im.naturalWidth * k, dh = im.naturalHeight * k;
    ctx.drawImage(im, (W - dw) / 2, (H - dh) / 2, dw, dh);
    return document.embedPng(cv.toDataURL('image/png'));
  }

  function drawImageContained(page, image, x, y, width, height) {
    const scale = Math.min(width / image.width, height / image.height);
    const dw = image.width * scale;
    const dh = image.height * scale;
    page.drawImage(image, { x: x + (width - dw) / 2, y: y + (height - dh) / 2, width: dw, height: dh });
  }

  /* ------------------------------------------------------------ tablo hücreleri
     Resmî formdaki gibi: ince siyah çerçeve, "Etiket: değer" tek satırda;
     değer sığmazsa hücre büyür ve alt satırlara iner.                      */
  const CELL_H = 22;
  const CELL_PAD = 5;
  const LABEL_SIZE = 10;
  const VALUE_SIZE = 10;

  function cellLines(fonts, label, value, width) {
    const etiket = `${label}: `;
    const etiketW = fonts.regular.widthOfTextAtSize(etiket, LABEL_SIZE);
    const kalan = width - CELL_PAD * 2 - etiketW;
    const deger = normalize(value);
    if (!deger) return { etiket, satirlar: [''], yukseklik: CELL_H };
    if (fonts.bold.widthOfTextAtSize(deger, VALUE_SIZE) <= kalan) return { etiket, satirlar: [deger], yukseklik: CELL_H };
    // ilk satır etiketten sonra, kalan satırlar tam genişlikte
    const tum = wrapText(deger, fonts.bold, VALUE_SIZE, width - CELL_PAD * 2);
    // etiket satırı (15) + ilk değer satırı (13) + ek satırlar (12'şer) + taban payı (7)
    return { etiket, satirlar: tum, yukseklik: 15 + 13 + (tum.length - 1) * 12 + 7, ilkAyri: true };
  }

  /* Bir satırdaki hücreleri çizer; satır yüksekliği en yüksek hücreye göre. */
  function drawRow(page, fonts, y, cells) {
    const hazir = cells.map((c) => ({ ...c, ...cellLines(fonts, c.label, c.value, c.width) }));
    const h = Math.max(...hazir.map((c) => c.yukseklik));
    let x = MARGIN;
    hazir.forEach((c) => {
      page.drawRectangle({ x, y: y - h, width: c.width, height: h, borderColor: LINE, borderWidth: 0.8, color: WHITE });
      const baseY = y - 15;
      page.drawText(c.etiket, { x: x + CELL_PAD, y: baseY, size: LABEL_SIZE, font: fonts.regular, color: INK });
      const etiketW = fonts.regular.widthOfTextAtSize(c.etiket, LABEL_SIZE);
      if (c.ilkAyri) {
        c.satirlar.forEach((s, i) => page.drawText(s, { x: x + CELL_PAD, y: baseY - 13 - i * 12, size: VALUE_SIZE, font: fonts.bold, color: INK }));
      } else {
        page.drawText(c.satirlar[0], { x: x + CELL_PAD + etiketW, y: baseY, size: VALUE_SIZE, font: fonts.bold, color: INK });
      }
      x += c.width;
    });
    return y - h;
  }

  /* ------------------------------------------------------------ SAYFA 1: kayıt formu */
  async function drawRegistrationForm(document, fonts) {
    let page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const f = app.state.fields;
    const fr = app.lang === 'fr';

    // EK-3 ve antet — resmî belgeyle aynı
    page.drawText('EK-3', { x: PAGE_WIDTH - MARGIN - fonts.bold.widthOfTextAtSize('EK-3', 10), y: PAGE_HEIGHT - 48, size: 10, font: fonts.bold, color: INK });
    drawCentered(page, 'T.C.', fonts.bold, 11, PAGE_HEIGHT - 78);
    drawCentered(page, 'BRÜKSEL BÜYÜKELÇİLİĞİ', fonts.bold, 11, PAGE_HEIGHT - 94);
    drawCentered(page, 'Sosyal Hizmetler Müşavirliği', fonts.bold, 10, PAGE_HEIGHT - 109);

    // dış çerçeve başlangıcı
    const top = PAGE_HEIGHT - 124;
    let y = top;

    // başlık + fotoğraf hücresi
    const headH = 96;
    const photoW = 118;
    page.drawRectangle({ x: MARGIN, y: y - headH, width: INNER - photoW, height: headH, borderColor: LINE, borderWidth: 0.8, color: WHITE });
    page.drawRectangle({ x: MARGIN + INNER - photoW, y: y - headH, width: photoW, height: headH, borderColor: LINE, borderWidth: 0.8, color: WHITE });
    const baslik = fr ? 'FORMULAIRE D’INSCRIPTION' : 'ÖĞRENCİ KAYIT FORMU';
    const bw = fonts.bold.widthOfTextAtSize(baslik, 17);
    page.drawText(baslik, { x: MARGIN + (INNER - photoW - bw) / 2, y: y - headH / 2 - 6, size: 17, font: fonts.bold, color: INK });
    // vesikalık: 3:4 oranında, yuvarlak köşeli, kutunun içine ortalanmış
    const fH = headH - 14, fW = Math.round(fH * 3 / 4);
    const foto = await yuvarlakVesikalik(document, app.state.images.studentPhoto, fW, fH, 6);
    if (foto) page.drawImage(foto, { x: MARGIN + INNER - photoW + (photoW - fW) / 2, y: y - headH + 7, width: fW, height: fH });
    else {
      const ft = fr ? 'Photo' : 'Fotoğraf';
      page.drawText(ft, { x: MARGIN + INNER - photoW + (photoW - fonts.regular.widthOfTextAtSize(ft, 10)) / 2, y: y - headH / 2 - 4, size: 10, font: fonts.regular, color: INK });
    }
    y -= headH;

    const half = INNER / 2;
    const t = (k) => app.t(k);
    const okul = f.school === '__other__' ? f.otherSchoolName : f.school;
    const engel = f.disability === 'exists' ? f.disabilityDetail : (f.disability === 'none' ? t('none') : '');
    const hastalik = f.illness === 'exists' ? f.illnessDetail : (f.illness === 'none' ? t('none') : '');
    const adres = app.adresMetni(f);
    const veliEtiket = f.relationship === 'mother' ? (fr ? 'Nom de la mère' : 'Anne adı')
      : f.relationship === 'guardian' ? (fr ? 'Nom du représentant légal' : 'Vasi adı') : (fr ? 'Nom du père' : 'Baba adı');

    y = drawRow(page, fonts, y, [
      { label: fr ? 'Nom de l’élève' : 'Öğrencinin soyadı', value: f.studentSurname, width: half },
      { label: fr ? 'Prénom de l’élève' : 'Öğrencinin adı', value: f.studentName, width: half }]);
    y = drawRow(page, fonts, y, [
      { label: fr ? 'Lieu de naissance' : 'Doğum yeri', value: f.birthPlace, width: half },
      { label: fr ? 'Date de naissance' : 'Doğum tarihi', value: formatDate(f.birthDate), width: half }]);
    y = drawRow(page, fonts, y, [
      { label: fr ? 'Sexe' : 'Cinsiyeti', value: labelChoice('gender', f.gender), width: half },
      { label: fr ? 'N° d’identité' : 'Kimlik no', value: f.identityNumber, width: half }]);
    y = drawRow(page, fonts, y, [
      { label: fr ? 'Téléphone portable' : 'Cep telefonu', value: app.telGosterim('studentPhone'), width: half },
      { label: fr ? 'E-mail' : 'E-posta', value: f.studentEmail, width: half }]);
    y = drawRow(page, fonts, y, [{ label: fr ? 'Situation de handicap ?' : 'Engel (özür) durumu var mı?', value: engel, width: INNER }]);
    y = drawRow(page, fonts, y, [{ label: fr ? 'Maladie éventuelle ?' : 'Herhangi bir hastalığı var mı?', value: hastalik, width: INNER }]);
    if (f.medicine) y = drawRow(page, fonts, y, [{ label: fr ? 'Médicaments' : 'Kullandığı ilaç', value: f.medicine, width: INNER }]);
    y = drawRow(page, fonts, y, [
      { label: fr ? 'École fréquentée' : 'Okuduğu okul', value: okul, width: INNER - 120 },
      { label: fr ? 'Classe' : 'Sınıfı', value: f.classLevel, width: 120 }]);
    y = drawRow(page, fonts, y, [
      { label: veliEtiket, value: f.guardianName, width: half },
      { label: fr ? 'Profession' : 'Mesleği', value: f.occupation, width: half }]);
    y = drawRow(page, fonts, y, [
      { label: fr ? 'Téléphone fixe' : 'Ev telefonu', value: app.telGosterim('homePhone'), width: half },
      { label: fr ? 'Téléphone portable' : 'Cep telefonu', value: app.telGosterim('guardianPhone'), width: half }]);
    y = drawRow(page, fonts, y, [{ label: fr ? 'E-mail' : 'E-posta', value: f.guardianEmail, width: INNER }]);
    y = drawRow(page, fonts, y, [{ label: fr ? 'Adresse' : 'Ev adresi', value: adres, width: INNER }]);
    y = drawRow(page, fonts, y, [
      { label: fr ? 'Contact d’urgence' : 'Acil durumda aranacak', value: f.emergencyName, width: half },
      { label: fr ? 'Tél. d’urgence' : 'Acil durum telefonu', value: app.telGosterim('emergencyPhone'), width: half }]);
    y = drawRow(page, fonts, y, [
      { label: fr ? 'Cours de Coran précédent' : 'Daha önce kursa gitti mi', value: f.previousCourse === 'yes' ? (f.previousLevel ? `${t('yes')} — ${f.previousLevel}` : t('yes')) : t('no'), width: half },
      { label: fr ? 'Photos/vidéos' : 'Görüntü izni', value: f.mediaConsent === 'yes' ? t('mediaYes') : t('mediaNo'), width: half }]);

    // beyan bölümü (çerçevenin devamı)
    const beyanBaslik = fr ? 'À LA DIRECTION DU COURS — MOSQUÉE ULU CAMİİ DE MARCHE-EN-FAMENNE' : 'MARCHE-EN-FAMENNE ULU CAMİİ KURS YÖNETİCİLİĞİNE';
    const beyanSatirlar = wrapText(app.declaration[app.lang], fonts.regular, 10, INNER - 24);
    const imzaBlokH = 88;
    const beyanH = 26 + beyanSatirlar.length * 13 + 14 + imzaBlokH;
    /* Olağan kayıtta beyan aynı sayfada kalır. Uzun sağlık notları tabloyu
       büyüttüyse beyan+imza bloğu BÖLÜNMEZ; ikinci sayfada tamamı çizilir. */
    if (y - beyanH < 44) {
      page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
      const devam = fr ? 'Formulaire d’inscription (suite)' : 'Öğrenci Kayıt Formu (devam)';
      page.drawText(devam, { x: MARGIN, y: y - 4, size: 9, font: fonts.regular, color: MUTED });
      y -= 18;
    }
    const kalanUst = y;
    page.drawRectangle({ x: MARGIN, y: kalanUst - beyanH, width: INNER, height: beyanH, borderColor: LINE, borderWidth: 0.8, color: WHITE });
    drawCentered(page, fitText(beyanBaslik, fonts.bold, 10.5, INNER - 20), fonts.bold, 10.5, kalanUst - 22);
    let ty = kalanUst - 44;
    beyanSatirlar.forEach((s, i) => { drawJustified(page, s, fonts.regular, 10, MARGIN + 12, ty, INNER - 24, i === beyanSatirlar.length - 1); ty -= 13; });

    // tarih / veli adı / imza — resmî formdaki gibi sağ blokta
    const bx = MARGIN + INNER * 0.52;
    let by = kalanUst - beyanH + imzaBlokH - 12;
    page.drawText(`${fr ? 'Date' : 'Tarih'}:  ${formatDate(f.declarationDate)}`, { x: bx, y: by, size: 10, font: fonts.regular, color: INK });
    by -= 26;
    page.drawText(`${fr ? 'Nom et prénom du parent' : 'Velinin Adı ve Soyadı'}:`, { x: bx, y: by, size: 10, font: fonts.regular, color: INK });
    page.drawText(fitText(normalize(f.guardianName), fonts.bold, 10, INNER - (bx - MARGIN) - 8), { x: bx, y: by - 13, size: 10, font: fonts.bold, color: INK });
    by -= 38;
    page.drawText(`${fr ? 'Signature' : 'İmzası'}:`, { x: bx, y: by, size: 10, font: fonts.regular, color: INK });
    const imza = await embedDataImage(document, app.state.signatureData);
    if (imza) drawImageContained(page, imza, bx + 50, by - 14, 150, 40);
  }

  /* ------------------------------------------------------------ SÖZLEŞME */
  function contractWriter(document, fonts) {
    let page = null;
    let y = 0;
    const BODY = 10.5;
    const LH = 13.5;
    const addPage = () => { page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]); y = PAGE_HEIGHT - MARGIN; };
    const ensure = (h) => { if (!page || y - h < MARGIN + 20) addPage(); };
    const heading = (text, size, center, gapBefore, gapAfter) => {
      ensure(size + gapBefore + gapAfter + LH * 2);
      y -= gapBefore;
      if (center) drawCentered(page, text, fonts.bold, size, y);
      else page.drawText(text, { x: MARGIN, y, size, font: fonts.bold, color: INK });
      if (center) page.drawLine({ start: { x: (PAGE_WIDTH - fonts.bold.widthOfTextAtSize(text, size)) / 2, y: y - 2.5 }, end: { x: (PAGE_WIDTH + fonts.bold.widthOfTextAtSize(text, size)) / 2, y: y - 2.5 }, color: INK, thickness: 0.7 });
      y -= gapAfter;
    };
    const paragraph = (text, indent) => {
      const lines = wrapText(text, fonts.regular, BODY, INNER - (indent || 0));
      lines.forEach((line, i) => {
        ensure(LH);
        drawJustified(page, line, fonts.regular, BODY, MARGIN + (indent || 0), y, INNER - (indent || 0), i === lines.length - 1);
        y -= LH;
      });
    };
    const numbered = (items) => {
      items.forEach((item, index) => {
        const no = `${index + 1}.`;
        const hang = 26;
        const lines = wrapText(item, fonts.regular, BODY, INNER - hang - 6);
        ensure(LH * Math.min(lines.length, 2));
        page.drawText(no, { x: MARGIN + hang - 4 - fonts.regular.widthOfTextAtSize(no, BODY), y, size: BODY, font: fonts.regular, color: INK });
        lines.forEach((line, i) => {
          if (i > 0) ensure(LH);
          drawJustified(page, line, fonts.regular, BODY, MARGIN + hang, y, INNER - hang - 6, i === lines.length - 1);
          y -= LH;
        });
      });
    };
    return { addPage, ensure, heading, paragraph, numbered, getPage: () => page, getY: () => y, gap: (h) => { y -= h; } };
  }

  async function drawContract(document, fonts) {
    const c = app.contract[app.lang];
    const w = contractWriter(document, fonts);
    const fr = app.lang === 'fr';
    w.addPage();
    w.heading(c.title, 12, true, 0, 26);
    w.heading(c.student.title, 11, false, 0, 18);
    w.paragraph(c.student.intro);
    w.gap(8);
    w.paragraph(c.student.lead);
    w.gap(8);
    w.numbered(c.student.items);
    w.heading(c.guardian.title, 11, false, 16, 18);
    w.numbered(c.guardian.items);
    w.heading(c.classroom.title, 11, false, 16, 18);
    w.numbered(c.classroom.items);
    w.gap(12);
    w.paragraph(c.closing);

    // son sayfa imza bloğu — resmî belgedeki gibi sağa hizalı
    w.ensure(120);
    const page = w.getPage();
    const f = app.state.fields;
    const bx = MARGIN + INNER * 0.52;
    let y = w.getY() - 30;
    const ogrenci = `${f.studentName || ''} ${f.studentSurname || ''}`.trim();
    page.drawText(`${fr ? 'Nom et prénom de l’élève' : 'Öğrencinin adı soyadı'}:`, { x: bx, y, size: 10.5, font: fonts.regular, color: INK });
    page.drawText(fitText(ogrenci, fonts.bold, 10.5, INNER - (bx - MARGIN)), { x: bx, y: y - 13, size: 10.5, font: fonts.bold, color: INK });
    y -= 34;
    page.drawText(`${fr ? 'Nom et prénom du parent' : 'Velinin adı soyadı'}:`, { x: bx, y, size: 10.5, font: fonts.regular, color: INK });
    page.drawText(fitText(normalize(f.guardianName), fonts.bold, 10.5, INNER - (bx - MARGIN)), { x: bx, y: y - 13, size: 10.5, font: fonts.bold, color: INK });
    y -= 34;
    page.drawText(`${fr ? 'Signature' : 'İmza'}:`, { x: bx, y, size: 10.5, font: fonts.regular, color: INK });
    const imza = await embedDataImage(document, app.state.signatureData);
    if (imza) drawImageContained(page, imza, bx + 40, y - 16, 160, 44);
    y -= 52;
    page.drawText(app.t('pdfContractApproval', { date: formatDate(f.declarationDate) }), { x: MARGIN, y: Math.min(y, MARGIN + 28), size: 8, font: fonts.regular, color: MUTED });
  }

  /* ------------------------------------------------------------ KİMLİK SAYFASI */
  async function drawIdentityDocuments(document, fonts) {
    const page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const fr = app.lang === 'fr';
    drawCentered(page, fr ? 'PIÈCE D’IDENTITÉ' : 'KİMLİK BELGESİ GÖRÜNTÜLERİ', fonts.bold, 12, PAGE_HEIGHT - MARGIN - 4);
    const front = await embedDataImage(document, app.state.images.identityFront);
    const back = await embedDataImage(document, app.state.images.identityBack);
    const boxW = INNER;
    const boxH = 300;
    const boxes = [
      { title: app.t('identityFront'), image: front, y: PAGE_HEIGHT - MARGIN - 44 - boxH },
      { title: app.t('identityBack'), image: back, y: PAGE_HEIGHT - MARGIN - 44 - boxH - 36 - boxH }
    ];
    boxes.forEach((b) => {
      page.drawText(b.title, { x: MARGIN, y: b.y + boxH + 8, size: 10, font: fonts.regular, color: INK });
      page.drawRectangle({ x: MARGIN, y: b.y, width: boxW, height: boxH, borderColor: LINE, borderWidth: 0.8, color: WHITE });
      if (b.image) drawImageContained(page, b.image, MARGIN + 6, b.y + 6, boxW - 12, boxH - 12);
      else {
        const m = app.t('pdfNoIdentity');
        page.drawText(m, { x: MARGIN + (boxW - fonts.regular.widthOfTextAtSize(m, 10)) / 2, y: b.y + boxH / 2, size: 10, font: fonts.regular, color: MUTED });
      }
    });
  }

  function addPageFooters(document, fonts) {
    const pages = document.getPages();
    const kunye = `${app.state.submittedRef ? app.state.submittedRef + ' · ' : ''}${window.CAMI ? window.CAMI.legalName : ''}`;
    pages.forEach((page, index) => {
      const label = `${index + 1} / ${pages.length}`;
      page.drawText(label, { x: PAGE_WIDTH - MARGIN - fonts.regular.widthOfTextAtSize(label, 8), y: 28, size: 8, font: fonts.regular, color: MUTED });
      page.drawText(fitText(kunye, fonts.regular, 7.5, INNER - 60), { x: MARGIN, y: 28, size: 7.5, font: fonts.regular, color: MUTED });
    });
  }

  function safeFileName(value) {
    return String(value || 'Ogrenci').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/ı/g, 'i').replace(/İ/g, 'I').replace(/ş/g, 's').replace(/Ş/g, 'S').replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
      .replace(/ç/g, 'c').replace(/Ç/g, 'C').replace(/ö/g, 'o').replace(/Ö/g, 'O').replace(/ü/g, 'u').replace(/Ü/g, 'U')
      .replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 64);
  }

  app.createPdf = async function () {
    if (!window.PDFLib || !window.fontkit) throw new Error('PDF libraries are unavailable');
    const document = await PDFLib.PDFDocument.create();
    document.registerFontkit(window.fontkit);
    const [regBytes, boldBytes] = await Promise.all([loadBinary('vendor/Lora-Regular.ttf'), loadBinary('vendor/Lora-Bold.ttf')]);
    const fonts = {
      regular: await document.embedFont(regBytes, { subset: true }),
      bold: await document.embedFont(boldBytes, { subset: true })
    };
    const CAMI = window.CAMI || {};
    document.setTitle(`${app.t('pdfDocumentTitle')} – ${CAMI.name || ''}`);
    document.setAuthor(CAMI.legalName || '');
    document.setSubject(`${app.t('courseTitle')} ${CAMI.courseYear || ''}`);
    document.setCreator('Ulu Camii Kayıt Uygulaması');
    document.setCreationDate(new Date());
    document.setModificationDate(new Date());

    await drawRegistrationForm(document, fonts);
    await drawContract(document, fonts);
    await drawIdentityDocuments(document, fonts);
    addPageFooters(document, fonts);

    const bytes = await document.save({ useObjectStreams: false, addDefaultPage: false });
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const student = `${app.state.fields.studentSurname || ''}_${app.state.fields.studentName || ''}`;
    const filename = `UluCamii_Kayit_${safeFileName(student)}_${CAMI.courseYear || ''}.pdf`;
    let file;
    try { file = new File([blob], filename, { type: 'application/pdf', lastModified: Date.now() }); }
    catch (_) { file = blob; file.name = filename; }
    return { bytes, blob, file, filename };
  };
}());
