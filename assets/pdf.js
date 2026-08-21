(function () {
  'use strict';

  const app = window.KayitApp = window.KayitApp || {};
  const PAGE_WIDTH = 595.28;
  const PAGE_HEIGHT = 841.89;
  const MARGIN = 38;

  function color(hex) {
    const value = hex.replace('#', '');
    return PDFLib.rgb(
      Number.parseInt(value.slice(0, 2), 16) / 255,
      Number.parseInt(value.slice(2, 4), 16) / 255,
      Number.parseInt(value.slice(4, 6), 16) / 255
    );
  }

  const COLORS = {
    pine: color('#1F4E4E'),
    pineDark: color('#173F3F'),
    gold: color('#B08D57'),
    ink: color('#22201D'),
    muted: color('#6B6560'),
    line: color('#D9D2C7'),
    paper: color('#FAF8F5'),
    white: PDFLib.rgb(1, 1, 1)
  };

  async function loadBinary(relativePath) {
    if (relativePath === 'vendor/DejaVuSans.ttf' && window.DEJAVU_SANS_BASE64) {
      const binary = atob(window.DEJAVU_SANS_BASE64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
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

  function normalize(value) {
    return value === undefined || value === null || String(value).trim() === '' ? app.t('notProvided') : String(value).trim();
  }

  function fitText(text, font, size, maxWidth) {
    const value = normalize(text);
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
        if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
          line = candidate;
        } else if (line) {
          lines.push(line);
          line = word;
        } else {
          let part = '';
          [...word].forEach((character) => {
            const next = `${part}${character}`;
            if (font.widthOfTextAtSize(next, size) > maxWidth && part) {
              lines.push(part);
              part = character;
            } else part = next;
          });
          line = part;
        }
      });
      if (line) lines.push(line);
      if (paragraphIndex < paragraphs.length - 1) lines.push('');
    });
    return lines.length ? lines : [''];
  }

  function drawCentered(page, text, font, size, y, maxWidth, textColor) {
    const value = fitText(text, font, size, maxWidth);
    const width = font.widthOfTextAtSize(value, size);
    page.drawText(value, { x: (PAGE_WIDTH - width) / 2, y, size, font, color: textColor || COLORS.ink });
  }

  function drawSectionHeader(page, title, font, y) {
    page.drawRectangle({ x: MARGIN, y: y - 18, width: PAGE_WIDTH - MARGIN * 2, height: 18, color: COLORS.pine });
    page.drawText(title, { x: MARGIN + 8, y: y - 13, size: 8.4, font, color: COLORS.white });
    return y - 18;
  }

  function drawCell(page, font, x, top, width, height, label, value) {
    page.drawRectangle({ x, y: top - height, width, height, color: COLORS.white, borderColor: COLORS.line, borderWidth: .55 });
    page.drawText(fitText(label, font, 6.2, width - 10), { x: x + 5, y: top - 8, size: 6.2, font, color: COLORS.muted });
    page.drawText(fitText(value, font, 8.1, width - 10), { x: x + 5, y: top - 19, size: 8.1, font, color: COLORS.ink });
  }

  function drawPair(page, font, y, left, right, height) {
    const gap = 5;
    const width = (PAGE_WIDTH - MARGIN * 2 - gap) / 2;
    const rowHeight = height || 24;
    drawCell(page, font, MARGIN, y, width, rowHeight, left[0], left[1]);
    drawCell(page, font, MARGIN + width + gap, y, width, rowHeight, right[0], right[1]);
    return y - rowHeight;
  }

  function labelChoice(type, value) {
    const maps = {
      gender: { female: 'female', male: 'male', other: 'otherGender' },
      relationship: { father: 'father', mother: 'mother', guardian: 'legalGuardian' },
      yesNo: { yes: 'yes', no: 'no' }
    };
    return maps[type] && maps[type][value] ? app.t(maps[type][value]) : normalize(value);
  }

  function formatDate(value) {
    if (!value) return app.t('notProvided');
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(app.lang === 'fr' ? 'fr-BE' : 'tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
  }

  async function embedDataImage(document, dataUrl) {
    if (!dataUrl) return null;
    if (dataUrl.startsWith('data:image/png')) return document.embedPng(dataUrl);
    return document.embedJpg(dataUrl);
  }

  function drawImageContained(page, image, x, y, width, height) {
    const scale = Math.min(width / image.width, height / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    page.drawImage(image, { x: x + (width - drawWidth) / 2, y: y + (height - drawHeight) / 2, width: drawWidth, height: drawHeight });
  }

  async function drawRegistrationForm(document, font) {
    const page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const fields = app.state.fields;
    page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: COLORS.paper });
    page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 12, width: PAGE_WIDTH, height: 12, color: COLORS.pine });
    page.drawLine({ start: { x: MARGIN, y: 690 }, end: { x: PAGE_WIDTH - MARGIN, y: 690 }, color: COLORS.gold, thickness: 1.2 });

    const photoX = PAGE_WIDTH - MARGIN - 80;
    const photoY = 704;
    page.drawRectangle({ x: photoX, y: photoY, width: 80, height: 104, color: COLORS.white, borderColor: COLORS.line, borderWidth: .8 });
    const studentPhoto = await embedDataImage(document, app.state.images.studentPhoto);
    if (studentPhoto) drawImageContained(page, studentPhoto, photoX + 3, photoY + 3, 74, 98);
    else drawCenteredInBox(page, app.t('studentPhoto'), font, 6.4, photoX, photoY, 80, 104, COLORS.muted);

    const headerCenter = (MARGIN + photoX - 12) / 2;
    const headerLines = [
      [app.t('pdfFormHeader1'), 8.5],
      [app.t('pdfFormHeader2'), 11.2],
      [app.t('pdfFormHeader3'), 8.5],
      [app.t('pdfFormHeader4'), 13.2]
    ];
    let headerY = 795;
    headerLines.forEach(([text, size]) => {
      const width = font.widthOfTextAtSize(text, size);
      page.drawText(text, { x: Math.max(MARGIN, headerCenter - width / 2), y: headerY, size, font, color: COLORS.ink });
      headerY -= size + 6;
    });
    page.drawText(`${CAMI.name} · ${CAMI.kbo}`, { x: MARGIN, y: 704, size: 6.8, font, color: COLORS.muted });

    const school = fields.school === '__other__' ? fields.otherSchoolName : fields.school;
    const address = app.adresMetni(fields);
    let y = 680;
    y = drawSectionHeader(page, app.lang === 'fr' ? 'INFORMATIONS SUR L’ÉLÈVE' : 'ÖĞRENCİ BİLGİLERİ', font, y);
    y = drawPair(page, font, y, [app.t('surname'), fields.studentSurname], [app.t('givenName'), fields.studentName]);
    y = drawPair(page, font, y, [app.t('birthPlace'), fields.birthPlace], [app.t('birthDate'), formatDate(fields.birthDate)]);
    y = drawPair(page, font, y, [app.t('gender'), labelChoice('gender', fields.gender)], [app.t('identityNumber'), fields.identityNumber]);
    y = drawPair(page, font, y, [app.t('studentPhone'), app.telGosterim('studentPhone')], [app.t('studentEmail'), fields.studentEmail]);
    y = drawPair(page, font, y, [app.t('school'), school], [app.t('classLevel'), fields.classLevel]);
    y = drawPair(page, font, y, [app.t('disability'), fields.disability === 'exists' ? fields.disabilityDetail : app.t('none')], [app.t('illness'), fields.illness === 'exists' ? fields.illnessDetail : app.t('none')]);
    y = drawPair(page, font, y, [app.t('medicine'), fields.medicine], [app.t('emergencyName'), fields.emergencyName]);
    y = drawPair(page, font, y, [app.t('emergencyPhone'), app.telGosterim('emergencyPhone')], [app.t('previousCourse'), labelChoice('yesNo', fields.previousCourse)]);
    y = drawPair(page, font, y, [app.t('previousLevel'), fields.previousLevel], [app.t('mediaConsent'), fields.mediaConsent === 'yes' ? app.t('mediaYes') : app.t('mediaNo')]);

    y -= 7;
    y = drawSectionHeader(page, app.lang === 'fr' ? 'INFORMATIONS SUR LE PARENT' : 'VELİ BİLGİLERİ', font, y);
    y = drawPair(page, font, y, [app.t('relationship'), labelChoice('relationship', fields.relationship)], [app.t('guardianName'), fields.guardianName]);
    y = drawPair(page, font, y, [app.t('occupation'), fields.occupation], [app.t('homePhone'), app.telGosterim('homePhone')]);
    y = drawPair(page, font, y, [app.t('mobilePhone'), app.telGosterim('guardianPhone')], [app.t('email'), fields.guardianEmail]);
    y = drawPair(page, font, y, [app.t('address'), address], [app.t('courseYear'), CAMI.courseYear]);

    y -= 7;
    y = drawSectionHeader(page, app.lang === 'fr' ? 'DÉCLARATION' : 'BEYAN', font, y);
    const declarationLines = wrapText(app.declaration[app.lang], font, 7.25, PAGE_WIDTH - MARGIN * 2 - 12);
    declarationLines.forEach((line) => {
      page.drawText(line, { x: MARGIN + 6, y: y - 10, size: 7.25, font, color: COLORS.ink });
      y -= 9.3;
    });
    y -= 4;
    y = drawPair(page, font, y, [app.t('date'), formatDate(fields.declarationDate)], [app.t('signer'), fields.guardianName], 23);
    const signature = await embedDataImage(document, app.state.signatureData);
    page.drawRectangle({ x: MARGIN, y: y - 47, width: PAGE_WIDTH - MARGIN * 2, height: 47, color: COLORS.white, borderColor: COLORS.line, borderWidth: .55 });
    page.drawText(app.t('signature'), { x: MARGIN + 5, y: y - 9, size: 6.2, font, color: COLORS.muted });
    if (signature) drawImageContained(page, signature, MARGIN + 140, y - 44, 235, 38);
    page.drawText('Unicode doğrulama: ğ ş ı İ ç ö ü · Français : é è ç à', { x: MARGIN, y: 20, size: 5.7, font, color: COLORS.muted });
  }

  function drawCenteredInBox(page, text, font, size, x, y, width, height, textColor) {
    const value = fitText(text, font, size, width - 10);
    const textWidth = font.widthOfTextAtSize(value, size);
    page.drawText(value, { x: x + (width - textWidth) / 2, y: y + (height - size) / 2, size, font, color: textColor });
  }

  function contractWriter(document, font) {
    let page;
    let y;
    let pageIndex = 0;
    const addPage = () => {
      page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      pageIndex += 1;
      page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: COLORS.paper });
      page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 10, width: PAGE_WIDTH, height: 10, color: COLORS.pine });
      page.drawText(`${CAMI.name} · ${app.t('contractTitle')}`, { x: MARGIN, y: PAGE_HEIGHT - 28, size: 6.5, font, color: COLORS.muted });
      y = PAGE_HEIGHT - 50;
      return page;
    };
    const ensure = (height) => {
      if (!page || y - height < 46) addPage();
    };
    const paragraph = (text, options) => {
      const settings = { size: 7.55, indent: 0, gap: 4, color: COLORS.ink, ...options };
      const lines = wrapText(text, font, settings.size, PAGE_WIDTH - MARGIN * 2 - settings.indent);
      const lineHeight = settings.size * 1.32;
      ensure(lines.length * lineHeight + settings.gap);
      lines.forEach((line) => {
        page.drawText(line, { x: MARGIN + settings.indent, y, size: settings.size, font, color: settings.color });
        y -= lineHeight;
      });
      y -= settings.gap;
    };
    const heading = (text, level) => {
      const size = level === 1 ? 13 : 9;
      const gap = level === 1 ? 10 : 5;
      ensure(size + gap + 8);
      if (level === 1) {
        drawCentered(page, text, font, size, y, PAGE_WIDTH - MARGIN * 2, COLORS.pineDark);
        y -= size + gap;
        page.drawLine({ start: { x: MARGIN + 90, y }, end: { x: PAGE_WIDTH - MARGIN - 90, y }, color: COLORS.gold, thickness: 1 });
        y -= 9;
      } else {
        page.drawText(text, { x: MARGIN, y, size, font, color: COLORS.pineDark });
        y -= size + gap;
      }
    };
    return { addPage, ensure, paragraph, heading, getPage: () => page, getY: () => y, setY: (value) => { y = value; }, getPageIndex: () => pageIndex };
  }

  async function drawContract(document, font) {
    const contract = app.contract[app.lang];
    const writer = contractWriter(document, font);
    writer.addPage();
    writer.heading(contract.title, 1);
    writer.heading(contract.student.title, 2);
    writer.paragraph(contract.student.intro);
    writer.paragraph(contract.student.lead);
    contract.student.items.forEach((item, index) => writer.paragraph(`${index + 1}. ${item}`, { indent: 10, size: 7.35, gap: 2 }));
    writer.heading(contract.guardian.title, 2);
    contract.guardian.items.forEach((item, index) => writer.paragraph(`${index + 1}. ${item}`, { indent: 10, size: 7.35, gap: 2 }));
    writer.heading(contract.classroom.title, 2);
    contract.classroom.items.forEach((item, index) => writer.paragraph(`${index + 1}. ${item}`, { indent: 10, size: 7.35, gap: 2 }));
    writer.paragraph(contract.closing, { size: 7.45, gap: 6 });

    const approval = app.t('pdfContractApproval', { date: formatDate(app.state.fields.declarationDate) });
    writer.ensure(104);
    let page = writer.getPage();
    let y = writer.getY();
    page.drawRectangle({ x: MARGIN, y: y - 96, width: PAGE_WIDTH - MARGIN * 2, height: 96, color: COLORS.white, borderColor: COLORS.line, borderWidth: .7 });
    page.drawText(approval, { x: MARGIN + 12, y: y - 20, size: 8.2, font, color: COLORS.ink });
    page.drawText(`${app.t('signer')}: ${normalize(app.state.fields.guardianName)}`, { x: MARGIN + 12, y: y - 39, size: 8.2, font, color: COLORS.ink });
    const signature = await embedDataImage(document, app.state.signatureData);
    if (signature) drawImageContained(page, signature, MARGIN + 250, y - 86, 220, 62);
  }

  async function drawIdentityDocuments(document, font) {
    const page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: COLORS.paper });
    page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 10, width: PAGE_WIDTH, height: 10, color: COLORS.pine });
    drawCentered(page, app.t('pdfIdentityDocuments'), font, 14, PAGE_HEIGHT - 52, PAGE_WIDTH - MARGIN * 2, COLORS.pineDark);
    page.drawLine({ start: { x: MARGIN + 90, y: PAGE_HEIGHT - 67 }, end: { x: PAGE_WIDTH - MARGIN - 90, y: PAGE_HEIGHT - 67 }, color: COLORS.gold, thickness: 1 });
    const front = await embedDataImage(document, app.state.images.identityFront);
    const back = await embedDataImage(document, app.state.images.identityBack);
    const boxWidth = PAGE_WIDTH - MARGIN * 2;
    const boxHeight = 315;
    const boxes = [
      { title: app.t('identityFront'), image: front, y: 435 },
      { title: app.t('identityBack'), image: back, y: 93 }
    ];
    boxes.forEach((box) => {
      page.drawText(box.title, { x: MARGIN, y: box.y + boxHeight + 9, size: 8.5, font, color: COLORS.muted });
      page.drawRectangle({ x: MARGIN, y: box.y, width: boxWidth, height: boxHeight, color: COLORS.white, borderColor: COLORS.line, borderWidth: .7 });
      if (box.image) drawImageContained(page, box.image, MARGIN + 8, box.y + 8, boxWidth - 16, boxHeight - 16);
      else drawCenteredInBox(page, app.t('pdfNoIdentity'), font, 9, MARGIN, box.y, boxWidth, boxHeight, COLORS.muted);
    });
  }

  function addPageFooters(document, font) {
    const pages = document.getPages();
    pages.forEach((page, index) => {
      const label = `${index + 1} / ${pages.length}`;
      page.drawText(label, { x: PAGE_WIDTH - MARGIN - font.widthOfTextAtSize(label, 6), y: 20, size: 6, font, color: COLORS.muted });
      if (index > 0) page.drawText(app.t('generatedLocally'), { x: MARGIN, y: 20, size: 5.7, font, color: COLORS.muted });
    });
  }

  function safeFileName(value) {
    return String(value || 'Ogrenci')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ı/g, 'i')
      .replace(/İ/g, 'I')
      .replace(/ş/g, 's')
      .replace(/Ş/g, 'S')
      .replace(/ğ/g, 'g')
      .replace(/Ğ/g, 'G')
      .replace(/ç/g, 'c')
      .replace(/Ç/g, 'C')
      .replace(/ö/g, 'o')
      .replace(/Ö/g, 'O')
      .replace(/ü/g, 'u')
      .replace(/Ü/g, 'U')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 64);
  }

  app.createPdf = async function () {
    if (!window.PDFLib || !window.fontkit) throw new Error('PDF libraries are unavailable');
    const document = await PDFLib.PDFDocument.create();
    document.registerFontkit(window.fontkit);
    const fontBytes = await loadBinary('vendor/DejaVuSans.ttf');
    const font = await document.embedFont(fontBytes, { subset: true });
    document.setTitle(`${app.t('pdfDocumentTitle')} – ${CAMI.name}`);
    document.setAuthor(CAMI.legalName);
    document.setSubject(`${app.t('courseTitle')} ${CAMI.courseYear}`);
    document.setCreator('Çevrimdışı Ulu Camii Kayıt Uygulaması');
    document.setProducer('pdf-lib 1.17.1 + @pdf-lib/fontkit 1.1.1');
    document.setCreationDate(new Date());
    document.setModificationDate(new Date());

    await drawRegistrationForm(document, font);
    await drawContract(document, font);
    await drawIdentityDocuments(document, font);
    addPageFooters(document, font);

    const bytes = await document.save({ useObjectStreams: false, addDefaultPage: false });
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const student = `${app.state.fields.studentSurname || ''}_${app.state.fields.studentName || ''}`;
    const filename = `UluCamii_Kayit_${safeFileName(student)}_${CAMI.courseYear}.pdf`;
    let file;
    try { file = new File([blob], filename, { type: 'application/pdf', lastModified: Date.now() }); }
    catch (_) { file = blob; file.name = filename; }
    return { bytes, blob, file, filename };
  };
}());
