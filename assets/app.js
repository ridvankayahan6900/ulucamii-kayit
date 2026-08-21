(function () {
  'use strict';

  const app = window.KayitApp = window.KayitApp || {};
  const DRAFT_KEY = 'uluCamiiKayitDraft:v1';
  const LANGUAGE_KEY = 'uluCamiiKayitLanguage';
  const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
  const MAX_IMAGE_EDGE = 1600;
  const JPEG_QUALITY = .8;
  let saveTimer = null;
  let toastTimer = null;
  let warnedAboutStorage = false;

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }

  function storageSet(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (_) {
      return false;
    }
  }

  function localDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function defaultState() {
    return {
      version: 1,
      currentStep: 1,
      fields: { declarationDate: localDate() },
      images: { identityFront: '', identityBack: '', studentPhoto: '' },
      contractRead: false,
      contractAccepted: false,
      signatureData: '',
      signatureStrokes: []
    };
  }

  function readDraft() {
    const raw = storageGet(DRAFT_KEY);
    if (!raw) return { state: defaultState(), restored: false };
    try {
      const stored = JSON.parse(raw);
      if (!stored || stored.version !== 1) return { state: defaultState(), restored: false };
      const base = defaultState();
      return {
        restored: true,
        state: {
          ...base,
          ...stored,
          fields: { ...base.fields, ...(stored.fields || {}) },
          images: { ...base.images, ...(stored.images || {}) },
          signatureStrokes: Array.isArray(stored.signatureStrokes) ? stored.signatureStrokes : []
        }
      };
    } catch (_) {
      return { state: defaultState(), restored: false };
    }
  }

  const draft = readDraft();
  app.state = draft.state;
  app.lang = storageGet(LANGUAGE_KEY) === 'fr' ? 'fr' : 'tr';
  app.lastPdf = null;

  app.showToast = function (message) {
    const toast = document.getElementById('toast');
    document.getElementById('toastText').textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 4200);
  };

  function draftPayload(includeImages) {
    return {
      version: 1,
      currentStep: Math.max(1, Math.min(7, app.state.currentStep || 1)),
      fields: app.state.fields,
      images: includeImages ? app.state.images : { identityFront: '', identityBack: '', studentPhoto: '' },
      contractRead: app.state.contractRead,
      contractAccepted: app.state.contractAccepted,
      signatureData: includeImages ? app.state.signatureData : '',
      signatureStrokes: includeImages ? app.state.signatureStrokes : []
    };
  }

  app.saveDraft = function () {
    clearTimeout(saveTimer);
    const full = JSON.stringify(draftPayload(true));
    if (storageSet(DRAFT_KEY, full)) return true;
    const textOnly = JSON.stringify(draftPayload(false));
    const saved = storageSet(DRAFT_KEY, textOnly);
    if (!warnedAboutStorage) {
      warnedAboutStorage = true;
      app.showToast(app.t('draftStorageWarning'));
    }
    return saved;
  };

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(app.saveDraft, 280);
  }

  function translatePage() {
    document.documentElement.lang = app.lang;
    document.title = `${app.t('courseTitle')} · ${app.t('appTitle')}`;
    document.querySelectorAll('[data-i18n]').forEach((element) => {
      element.textContent = app.t(element.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
      element.placeholder = app.t(element.dataset.i18nPlaceholder);
    });
    document.querySelectorAll('[data-i18n-aria]').forEach((element) => {
      element.setAttribute('aria-label', app.t(element.dataset.i18nAria));
    });
    document.querySelectorAll('[data-i18n-alt]').forEach((element) => {
      element.alt = app.t(element.dataset.i18nAlt);
    });
    document.querySelectorAll('[data-language]').forEach((button) => {
      const selected = button.dataset.language === app.lang;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    document.getElementById('declarationText').textContent = app.declaration[app.lang];
    renderSchools();
    renderContract();
    updateProgress();
    updateDeclaration();
    updateImageUI();
    if (app.state.currentStep === 7) renderSummary();
    if (app.signature && app.signature.refreshLanguage) app.signature.refreshLanguage();
  }

  app.setLanguage = function (language) {
    if (!['tr', 'fr'].includes(language)) return;
    app.lang = language;
    storageSet(LANGUAGE_KEY, language);
    translatePage();
  };

  function renderSchools() {
    const select = document.getElementById('school');
    const selected = select.value || app.state.fields.school || '';
    select.replaceChildren();
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = app.t('selectOne');
    select.append(placeholder);

    /* Once Marche-en-Famenne okullari, sonra cevre belediyeler. */
    [['schoolsMarche', 'marche'], ['schoolsAround', 'cevre']].forEach(([anahtar, grup]) => {
      const okullar = (app.schools || []).filter((okul) => okul.grup === grup);
      if (!okullar.length) return;
      const group = document.createElement('optgroup');
      group.label = app.t(anahtar);
      okullar.forEach((okul) => {
        const option = document.createElement('option');
        option.value = okul.ad;
        option.textContent = okul.ad;
        option.dataset.tur = okul.tur;
        group.append(option);
      });
      select.append(group);
    });

    const other = document.createElement('option');
    other.value = '__other__';
    other.textContent = `${app.t('otherSchool')} / Autre`;
    other.dataset.tur = 'hepsi';
    select.append(other);
    select.value = [...select.options].some((option) => option.value === selected) ? selected : '';
    renderClassLevels();
  }

  /* Secili okulun kademesi: fondamental | secondaire | hepsi | '' */
  function okulTuru() {
    const select = document.getElementById('school');
    if (!select) return '';
    const secenek = select.selectedOptions && select.selectedOptions[0];
    if (!secenek || !secenek.value) return '';
    return secenek.dataset.tur || 'hepsi';
  }

  /* Sinif listesi okulun kademesine gore doldurulur; deger Fransizca
     resmi karsiligidir (ornek: 4e primaire) — okula ibraz edilebilsin diye. */
  function renderClassLevels() {
    const select = document.getElementById('classLevel');
    if (!select || select.tagName !== 'SELECT') return;
    const tur = okulTuru();
    const secili = select.value || app.state.fields.classLevel || '';
    select.replaceChildren();
    if (!tur) {
      const uyari = document.createElement('option');
      uyari.value = '';
      uyari.textContent = app.t('selectSchoolFirst');
      select.append(uyari);
      select.disabled = true;
      return;
    }
    select.disabled = false;
    const bos = document.createElement('option');
    bos.value = '';
    bos.textContent = app.t('selectOne');
    select.append(bos);
    const kademeler = tur === 'hepsi' ? ['fondamental', 'secondaire'] : [tur];
    kademeler.forEach((kademe) => {
      const liste = (app.classLevels && app.classLevels[kademe]) || [];
      if (!liste.length) return;
      const cokKademe = kademeler.length > 1;
      const hedef = cokKademe ? document.createElement('optgroup') : select;
      if (cokKademe) hedef.label = app.t(kademe === 'fondamental' ? 'schoolLevelFondamental' : 'schoolLevelSecondaire');
      liste.forEach((sinif) => {
        const option = document.createElement('option');
        option.value = sinif.fr;
        option.textContent = app.lang === 'fr' ? sinif.fr : `${sinif.tr} (${sinif.fr})`;
        hedef.append(option);
      });
      if (cokKademe) select.append(hedef);
    });
    select.value = [...select.options].some((option) => option.value === secili) ? secili : '';
    app.state.fields.classLevel = select.value;
  }

  function renderContract() {
    const content = document.getElementById('contractContent');
    const contract = app.contract[app.lang];
    content.replaceChildren();
    const title = document.createElement('h2');
    title.textContent = contract.title;
    content.append(title);

    const studentTitle = document.createElement('h3');
    studentTitle.textContent = contract.student.title;
    content.append(studentTitle);
    const intro = document.createElement('p');
    intro.textContent = contract.student.intro;
    content.append(intro);
    const lead = document.createElement('p');
    lead.textContent = contract.student.lead;
    content.append(lead);
    content.append(makeList(contract.student.items));

    const guardianTitle = document.createElement('h3');
    guardianTitle.textContent = contract.guardian.title;
    content.append(guardianTitle, makeList(contract.guardian.items));

    const classroomTitle = document.createElement('h3');
    classroomTitle.textContent = contract.classroom.title;
    content.append(classroomTitle, makeList(contract.classroom.items));

    const closing = document.createElement('p');
    closing.className = 'contract-closing';
    closing.textContent = contract.closing;
    content.append(closing);
    requestAnimationFrame(updateContractScroll);
  }

  function makeList(items) {
    const list = document.createElement('ol');
    items.forEach((item) => {
      const listItem = document.createElement('li');
      listItem.textContent = item;
      list.append(listItem);
    });
    return list;
  }

  function enableContractAcceptance() {
    app.state.contractRead = true;
    const checkbox = document.getElementById('contractAccepted');
    checkbox.disabled = false;
    document.getElementById('contractCheckLabel').classList.remove('is-disabled');
    const status = document.getElementById('contractScrollStatus');
    status.classList.add('is-complete');
    status.lastElementChild.textContent = app.t('contractReached');
    scheduleSave();
  }

  function updateContractScroll() {
    const reader = document.getElementById('contractReader');
    const reached = reader.scrollHeight - reader.scrollTop - reader.clientHeight <= 12;
    if (app.state.contractRead || reached) enableContractAcceptance();
    else {
      const status = document.getElementById('contractScrollStatus');
      status.classList.remove('is-complete');
      status.lastElementChild.textContent = app.t('contractScrollHint');
    }
  }

  function restoreFields() {
    const form = document.getElementById('registrationForm');
    [...form.elements].forEach((element) => {
      if (!element.name || element.type === 'file') return;
      if (element.name === 'contractAccepted') {
        element.checked = Boolean(app.state.contractAccepted);
        return;
      }
      const saved = app.state.fields[element.name];
      if (saved === undefined || saved === null) return;
      if (element.type === 'radio') element.checked = element.value === saved;
      else if (element.type === 'checkbox') element.checked = Boolean(saved);
      else element.value = saved;
    });
    document.getElementById('birthDate').max = localDate();
    if (app.state.contractRead) enableContractAcceptance();
    updateConditionalFields();
  }

  function syncElement(element) {
    if (!element.name || element.type === 'file') return;
    if (element.name === 'contractAccepted') {
      app.state.contractAccepted = element.checked;
      return;
    }
    if (element.type === 'radio') {
      if (element.checked) app.state.fields[element.name] = element.value;
    } else if (element.type === 'checkbox') {
      app.state.fields[element.name] = element.checked;
    } else {
      app.state.fields[element.name] = element.value;
    }
  }

  function bindFormState() {
    const form = document.getElementById('registrationForm');
    ['input', 'change'].forEach((eventName) => {
      form.addEventListener(eventName, (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return;
        syncElement(target);
        clearElementError(target);
        updateConditionalFields();
        updateDeclaration();
        scheduleSave();
      });
    });
  }

  function updateConditionalFields() {
    const schoolOther = app.state.fields.school === '__other__';
    toggleConditional('otherSchoolField', 'otherSchoolName', schoolOther);
    renderClassLevels();
    toggleConditional('disabilityDetailField', 'disabilityDetail', app.state.fields.disability === 'exists');
    const illnessExists = app.state.fields.illness === 'exists';
    toggleConditional('illnessDetailFields', 'illnessDetail', illnessExists);
    toggleConditional('previousLevelField', 'previousLevel', app.state.fields.previousCourse === 'yes');
  }

  function toggleConditional(containerId, inputId, visible) {
    const container = document.getElementById(containerId);
    const input = document.getElementById(inputId);
    container.hidden = !visible;
    if (input) input.required = visible;
    if (!visible && input) clearElementError(input);
  }

  function clearElementError(element) {
    element.removeAttribute('aria-invalid');
    const error = element.id ? document.getElementById(`${element.id}Error`) : document.getElementById(`${element.name}Error`);
    if (error) error.textContent = '';
    if (element.type === 'radio') {
      document.querySelectorAll(`input[name="${CSS.escape(element.name)}"]`).forEach((radio) => radio.removeAttribute('aria-invalid'));
    }
  }

  function errorFor(element, messageKey) {
    element.setAttribute('aria-invalid', 'true');
    const error = document.getElementById(`${element.id}Error`);
    if (error) error.textContent = app.t(messageKey);
    return element;
  }

  function groupError(name, messageKey) {
    const radios = [...document.querySelectorAll(`input[name="${CSS.escape(name)}"]`)];
    radios.forEach((radio) => {
      radio.setAttribute('aria-invalid', 'true');
      radio.setAttribute('aria-describedby', `${name}Error`);
    });
    const error = document.getElementById(`${name}Error`);
    if (error) error.textContent = app.t(messageKey);
    return radios[0];
  }

  function clearStepErrors(step) {
    const section = document.querySelector(`[data-step="${step}"]`);
    section.querySelectorAll('[aria-invalid="true"]').forEach((element) => element.removeAttribute('aria-invalid'));
    section.querySelectorAll('.field-error').forEach((element) => { element.textContent = ''; });
  }

  function required(id, invalid) {
    const element = document.getElementById(id);
    if (!String(element.value || '').trim()) invalid.push(errorFor(element, 'requiredError'));
  }

  function validEmail(id, requiredValue, invalid) {
    const element = document.getElementById(id);
    const value = element.value.trim();
    if (!value && requiredValue) invalid.push(errorFor(element, 'requiredError'));
    else if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value)) invalid.push(errorFor(element, 'emailError'));
  }

  /* --- ulke kodlu telefon ---------------------------------------
     Numara ulusal bicimde tutulur (bas sifir yok), ulke kodu ayri
     alanda durur. Gruplama yalnizca gorunumdur; gonderimde E.164. */
  const TEL_ULKE = {
    '32':  { min: 8,  max: 9,  grup: (d) => (d.charAt(0) === '4' ? [3, 2, 2, 2] : ('239'.indexOf(d.charAt(0)) >= 0 ? [1, 3, 2, 2] : [2, 2, 2, 2])) },
    '90':  { min: 10, max: 10, grup: () => [3, 3, 2, 2] },
    '33':  { min: 9,  max: 9,  grup: () => [1, 2, 2, 2, 2] },
    '31':  { min: 9,  max: 9,  grup: () => [1, 4, 4] },
    '49':  { min: 6,  max: 11, grup: () => [4, 4, 4, 4] },
    '352': { min: 6,  max: 9,  grup: () => [3, 3, 3] },
    '44':  { min: 9,  max: 10, grup: () => [4, 3, 3] },
    '39':  { min: 9,  max: 10, grup: () => [3, 3, 4] },
    '34':  { min: 9,  max: 9,  grup: () => [3, 3, 3] },
    '212': { min: 9,  max: 9,  grup: () => [3, 3, 3] }
  };
  const TEL_ALANLARI = ['studentPhone', 'emergencyPhone', 'homePhone', 'guardianPhone'];

  function telAyar(kod) {
    return TEL_ULKE[String(kod || '32')] || { min: 7, max: 13, grup: () => [3, 3, 3, 3] };
  }

  function telBicimle(ham, kod) {
    let rakam = String(ham || '').replace(/\D/g, '');
    while (rakam.charAt(0) === '0') rakam = rakam.slice(1);
    const ayar = telAyar(kod);
    rakam = rakam.slice(0, ayar.max);
    const parcalar = [];
    let i = 0;
    (ayar.grup(rakam) || []).forEach((uzunluk) => {
      if (i >= rakam.length) return;
      parcalar.push(rakam.slice(i, i + uzunluk));
      i += uzunluk;
    });
    if (i < rakam.length) parcalar.push(rakam.slice(i));
    return parcalar.join(' ');
  }

  function telefonlariBagla() {
    TEL_ALANLARI.forEach((id) => {
      const girdi = document.getElementById(id);
      const kod = document.getElementById(`${id}CC`);
      if (!girdi || !kod) return;
      const uygula = (kullaniciEylemi) => {
        const ham = String(girdi.value || '');
        const imlec = girdi.selectionStart === null ? ham.length : girdi.selectionStart;
        const oncekiRakam = (ham.slice(0, imlec).match(/\d/g) || []).length;
        // Ulke kodu duruma YALNIZCA kullanici eylemiyle yazilir. Baglama aninda
        // yazilsaydi, hemen ardindan calisan taslak geri yukleme kayitli kodu
        // DOM varsayilaniyla ezilmis bulurdu.
        if (kullaniciEylemi) app.state.fields[`${id}CC`] = kod.value;
        const bicimli = telBicimle(ham, kod.value);
        if (bicimli === ham) return;
        girdi.value = bicimli;
        app.state.fields[id] = bicimli;
        let say = 0;
        let poz = oncekiRakam === 0 ? 0 : bicimli.length;
        if (oncekiRakam > 0) {
          for (let i = 0; i < bicimli.length; i += 1) {
            if (/\d/.test(bicimli.charAt(i))) say += 1;
            if (say === oncekiRakam) { poz = i + 1; break; }
          }
        }
        try { girdi.setSelectionRange(poz, poz); } catch (_) { /* desteklenmiyor */ }
      };
      girdi.addEventListener('input', () => uygula(true));
      kod.addEventListener('change', () => uygula(true));
      uygula(false);
    });
  }

  /* Ulke kodunun tek dogru kaynagi ekrandaki acilir listedir; durum yalnizca
     yedektir. Boylece veli ne goruyorsa belgeye de o gider. */
  function telUlkeKodu(id) {
    const kod = document.getElementById(`${id}CC`);
    if (kod && kod.value) return kod.value;
    return String(app.state.fields[`${id}CC`] || '32');
  }

  /* Belgede/ozette gosterim: +32 471 79 46 82 */
  app.telGosterim = function (id) {
    const ulusal = String(app.state.fields[id] || '').trim();
    if (!ulusal) return '';
    return `+${telUlkeKodu(id)} ${ulusal}`;
  };

  /* Gonderimde: +32471794682 */
  app.telE164 = function (id) {
    const rakam = String(app.state.fields[id] || '').replace(/\D/g, '');
    if (!rakam) return '';
    return `+${telUlkeKodu(id)}${rakam}`;
  };

  /* Adres: Rue Example 14 bte 3, 6900 Marche-en-Famenne */
  app.adresMetni = function (f) {
    const alanlar = f || app.state.fields;
    const sokak = [alanlar.streetName, alanlar.houseNumber].filter(Boolean).join(' ').trim();
    const kutu = String(alanlar.boxNumber || '').trim();
    const satir = kutu ? `${sokak} bte ${kutu}` : sokak;
    const yerlesim = [alanlar.postalCode, alanlar.city].filter(Boolean).join(' ').trim();
    return [satir, yerlesim].filter(Boolean).join(', ');
  };

  function validPhone(id, requiredValue, invalid) {
    const element = document.getElementById(id);
    const kod = document.getElementById(`${id}CC`);
    const value = element.value.trim();
    const digits = value.replace(/\D/g, '');
    const ayar = telAyar(kod && kod.value);
    if (!value && requiredValue) invalid.push(errorFor(element, 'requiredError'));
    else if (value && digits.length < ayar.min) invalid.push(errorFor(element, 'phoneTooShort'));
    else if (value && digits.length > ayar.max) invalid.push(errorFor(element, 'phoneTooLong'));
  }

  app.validateStep = function (step) {
    clearStepErrors(step);
    const invalid = [];
    if (step === 2) {
      ['studentSurname', 'studentName', 'birthPlace', 'birthDate', 'gender', 'identityNumber'].forEach((id) => required(id, invalid));
      const birthDate = document.getElementById('birthDate');
      if (birthDate.value && birthDate.value > localDate()) invalid.push(errorFor(birthDate, 'futureBirthError'));
      const identity = document.getElementById('identityNumber');
      if (identity.value && (identity.value.replace(/[\s.-]/g, '').length < 6 || !/^[\p{L}\p{N}\s.-]+$/u.test(identity.value))) invalid.push(errorFor(identity, 'identityError'));
      validPhone('studentPhone', false, invalid);
      validEmail('studentEmail', false, invalid);
    }
    if (step === 3) {
      ['school', 'classLevel', 'emergencyName', 'emergencyPhone'].forEach((id) => required(id, invalid));
      validPhone('emergencyPhone', true, invalid);
      if (app.state.fields.school === '__other__' && !document.getElementById('otherSchoolName').value.trim()) invalid.push(errorFor(document.getElementById('otherSchoolName'), 'schoolOtherError'));
      ['disability', 'illness', 'previousCourse', 'mediaConsent'].forEach((name) => {
        if (!document.querySelector(`input[name="${name}"]:checked`)) invalid.push(groupError(name, 'requiredError'));
      });
      if (app.state.fields.disability === 'exists' && !document.getElementById('disabilityDetail').value.trim()) invalid.push(errorFor(document.getElementById('disabilityDetail'), 'conditionalError'));
      if (app.state.fields.illness === 'exists' && !document.getElementById('illnessDetail').value.trim()) invalid.push(errorFor(document.getElementById('illnessDetail'), 'conditionalError'));
      if (app.state.fields.previousCourse === 'yes' && !document.getElementById('previousLevel').value.trim()) invalid.push(errorFor(document.getElementById('previousLevel'), 'requiredError'));
    }
    if (step === 4) {
      ['relationship', 'guardianName', 'occupation', 'guardianPhone', 'guardianEmail', 'streetName', 'houseNumber', 'postalCode', 'city'].forEach((id) => required(id, invalid));
      validPhone('homePhone', false, invalid);
      validPhone('guardianPhone', true, invalid);
      validEmail('guardianEmail', true, invalid);
    }
    if (step === 5 && (!app.state.contractRead || !document.getElementById('contractAccepted').checked)) {
      document.getElementById('contractAcceptedError').textContent = app.t('contractRequired');
      invalid.push(document.getElementById('contractAccepted'));
    }
    if (step === 6) {
      required('declarationDate', invalid);
      if (app.signature.isEmpty()) {
        document.getElementById('signatureError').textContent = app.t('signatureRequired');
        invalid.push(document.getElementById('signatureTrigger'));
      }
    }
    if (invalid.length) {
      app.showToast(app.t('pleaseCheck'));
      const first = invalid[0];
      first.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
      first.focus({ preventScroll: true });
      return false;
    }
    app.saveDraft();
    return true;
  };

  function updateProgress() {
    const step = app.state.currentStep || 0;
    const panel = document.getElementById('progressPanel');
    panel.hidden = step === 0;
    if (step === 0) return;
    document.getElementById('stepName').textContent = app.t(`step${step}Name`);
    document.getElementById('stepCount').textContent = app.t('stepOf', { current: step, total: 7 });
    const track = panel.querySelector('[role="progressbar"]');
    track.setAttribute('aria-valuenow', String(step));
    document.getElementById('progressFill').style.setProperty('--progress-scale', String(step / 7));
  }

  function updateNavigation() {
    const step = app.state.currentStep;
    const nav = document.getElementById('formNavigation');
    nav.hidden = step === 0;
    document.getElementById('backButton').hidden = step === 0;
    const next = document.getElementById('nextButton');
    next.hidden = step === 7;
    next.textContent = app.t(step === 6 ? 'review' : 'continue');
  }

  app.goToStep = function (step, options) {
    const settings = { force: false, focus: true, ...(options || {}) };
    const target = Math.max(0, Math.min(7, Number(step)));
    document.querySelectorAll('.step[data-step]').forEach((section) => {
      const active = Number(section.dataset.step) === target;
      section.hidden = !active;
      section.classList.toggle('is-active', active);
    });
    app.state.currentStep = target;
    updateProgress();
    updateNavigation();
    if (target === 5) requestAnimationFrame(updateContractScroll);
    if (target === 6) updateDeclaration();
    if (target === 7) renderSummary();
    if (target > 0) scheduleSave();
    window.scrollTo({ top: 0, behavior: 'auto' });
    if (settings.focus) {
      const heading = document.querySelector(`.step[data-step="${target}"] h1`);
      if (heading) {
        heading.setAttribute('tabindex', '-1');
        requestAnimationFrame(() => heading.focus({ preventScroll: true }));
      }
    }
  };

  function updateDeclaration() {
    const guardian = app.state.fields.guardianName || '—';
    document.getElementById('declarationSigner').textContent = guardian;
    document.getElementById('declarationText').textContent = app.declaration[app.lang];
  }

  function formattedDate(value) {
    if (!value) return app.t('notProvided');
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(app.lang === 'fr' ? 'fr-BE' : 'tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
  }

  function translatedChoice(name, value) {
    const maps = {
      gender: { female: 'female', male: 'male', other: 'otherGender' },
      relationship: { father: 'father', mother: 'mother', guardian: 'legalGuardian' },
      yesNo: { yes: 'yes', no: 'no' }
    };
    return maps[name] && maps[name][value] ? app.t(maps[name][value]) : (value || app.t('notProvided'));
  }

  function summarySection(titleKey, step, rows, warnings) {
    const section = document.createElement('section');
    section.className = 'summary-section';
    const header = document.createElement('header');
    const title = document.createElement('h2');
    title.textContent = app.t(titleKey);
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'button button-quiet';
    edit.textContent = app.t('edit');
    edit.addEventListener('click', () => app.goToStep(step));
    header.append(title, edit);
    const list = document.createElement('dl');
    rows.forEach(([label, value]) => {
      const term = document.createElement('dt');
      term.textContent = label;
      const description = document.createElement('dd');
      description.textContent = value || app.t('notProvided');
      list.append(term, description);
    });
    section.append(header, list);
    (warnings || []).filter(Boolean).forEach((warning) => {
      const note = document.createElement('p');
      note.className = 'summary-warning';
      note.textContent = warning;
      section.append(note);
    });
    return section;
  }

  function renderSummary() {
    const fields = app.state.fields;
    const list = document.getElementById('summaryList');
    const school = fields.school === '__other__' ? fields.otherSchoolName : fields.school;
    const address = app.adresMetni(fields);
    const identityRows = [
      [app.t('identityFront'), app.state.images.identityFront ? app.t('identityFrontAdded') : app.t('notProvided')],
      [app.t('identityBack'), app.state.images.identityBack ? app.t('identityBackAdded') : app.t('notProvided')],
      [app.t('studentPhoto'), app.state.images.studentPhoto ? app.t('imageReady') : app.t('notProvided')]
    ];
    const identityWarnings = [
      !app.state.images.identityFront && !app.state.images.identityBack ? app.t('identityMissing') : '',
      !app.state.images.studentPhoto ? app.t('studentPhotoMissing') : ''
    ];
    const studentRows = [
      [app.t('surname'), fields.studentSurname],
      [app.t('givenName'), fields.studentName],
      [app.t('birthPlace'), fields.birthPlace],
      [app.t('birthDate'), formattedDate(fields.birthDate)],
      [app.t('gender'), translatedChoice('gender', fields.gender)],
      [app.t('identityNumber'), fields.identityNumber],
      [app.t('studentPhone'), app.telGosterim('studentPhone')],
      [app.t('studentEmail'), fields.studentEmail]
    ];
    const healthRows = [
      [app.t('school'), school],
      [app.t('classLevel'), fields.classLevel],
      [app.t('disability'), fields.disability === 'exists' ? fields.disabilityDetail : app.t('noDisability')],
      [app.t('illness'), fields.illness === 'exists' ? fields.illnessDetail : app.t('noIllness')],
      [app.t('medicine'), fields.medicine],
      [app.t('emergencyName'), fields.emergencyName],
      [app.t('emergencyPhone'), app.telGosterim('emergencyPhone')],
      [app.t('previousCourse'), translatedChoice('yesNo', fields.previousCourse)],
      [app.t('previousLevel'), fields.previousCourse === 'yes' ? fields.previousLevel : '—'],
      [app.t('mediaConsent'), fields.mediaConsent === 'yes' ? app.t('mediaPermissionYes') : app.t('mediaPermissionNo')]
    ];
    const guardianRows = [
      [app.t('relationship'), translatedChoice('relationship', fields.relationship)],
      [app.t('guardianName'), fields.guardianName],
      [app.t('occupation'), fields.occupation],
      [app.t('homePhone'), app.telGosterim('homePhone')],
      [app.t('mobilePhone'), app.telGosterim('guardianPhone')],
      [app.t('email'), fields.guardianEmail],
      [app.t('address'), address]
    ];
    const consentRows = [
      [app.t('contractTitle'), app.state.contractAccepted ? app.t('contractAccepted') : app.t('notProvided')],
      [app.t('date'), formattedDate(fields.declarationDate)],
      [app.t('signature'), app.state.signatureData ? app.t('signatureAdded') : app.t('notProvided')],
      [app.t('mediaConsent'), fields.mediaConsent === 'yes' ? app.t('mediaPermissionYes') : app.t('mediaPermissionNo')]
    ];
    list.replaceChildren(
      summarySection('summaryIdentity', 1, identityRows, identityWarnings),
      summarySection('summaryStudent', 2, studentRows),
      summarySection('summarySchoolHealth', 3, healthRows),
      summarySection('summaryGuardian', 4, guardianRows),
      summarySection('summaryConsents', 5, consentRows)
    );
  }

  function bitmapFallback(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => resolve({ source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => URL.revokeObjectURL(url) });
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image decode')); };
      image.src = url;
    });
  }

  async function decodeImage(file) {
    if ('createImageBitmap' in window) {
      try {
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
        return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
      } catch (_) {
        try {
          const bitmap = await createImageBitmap(file);
          return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
        } catch (_) { /* Safari fallback below */ }
      }
    }
    return bitmapFallback(file);
  }

  function canvasToDataUrl(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) { reject(new Error('canvas encode')); return; }
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      }, 'image/jpeg', JPEG_QUALITY);
    });
  }

  app.processImage = async function (file, secenek) {
    if (!file || !file.type.startsWith('image/')) throw new Error('invalid-image');
    if (file.size > MAX_IMAGE_BYTES) throw new Error('too-large');
    const decoded = await decodeImage(file);
    try {
      const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(decoded.width, decoded.height));
      const width = Math.max(1, Math.round(decoded.width * scale));
      const height = Math.max(1, Math.round(decoded.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { alpha: false });
      context.fillStyle = '#fff';
      context.fillRect(0, 0, width, height);
      context.drawImage(decoded.source, 0, 0, width, height);
      // Kimlik/kart gorsellerinde bos kenarlar otomatik atilir.
      const son = secenek && secenek.kart && typeof app.kartKirp === 'function'
        ? app.kartKirp(canvas)
        : canvas;
      const dataUrl = await canvasToDataUrl(son);
      const sonEn = son.width;
      const sonBoy = son.height;
      if (son !== canvas) { son.width = 1; son.height = 1; }
      canvas.width = 1;
      canvas.height = 1;
      return { dataUrl, width: sonEn, height: sonBoy };
    } finally {
      decoded.close();
    }
  };

  function setUploadStatus(key, statusKey, ready) {
    const panel = document.querySelector(`[data-upload="${key}"]`);
    if (!panel) return;
    const status = panel.querySelector('[data-upload-status]');
    if (status) {
      status.textContent = app.t(statusKey);
      status.classList.toggle('is-ready', Boolean(ready));
    }
  }

  async function handleImageInput(input) {
    const file = input.files && input.files[0];
    const key = input.dataset.imageInput;
    if (!file) return;
    setUploadStatus(key, 'imageProcessing', false);
    try {
      const kart = key === 'identityFront' || key === 'identityBack';
      const result = await app.processImage(file, { kart });
      app.state.images[key] = result.dataUrl;
      updateImageUI();
      app.saveDraft();
    } catch (error) {
      app.showToast(app.t(error.message === 'too-large' ? 'imageTooLarge' : 'imageInvalid'));
      setUploadStatus(key, 'notAdded', false);
    } finally {
      input.value = '';
    }
  }

  function updateImageUI() {
    const mrzDugme = document.getElementById('mrzOkuButonu');
    if (mrzDugme) mrzDugme.disabled = !(app.state.images.identityBack || app.state.images.identityFront);
    Object.keys(app.state.images).forEach((key) => {
      const panel = document.querySelector(`[data-upload="${key}"]`);
      if (!panel) return;
      const dataUrl = app.state.images[key];
      const preview = panel.querySelector('[data-preview]');
      const container = panel.querySelector('[data-preview-container]');
      const remove = panel.querySelector(`[data-remove-image="${key}"]`);
      const empty = panel.querySelector('[data-empty-photo]');
      if (preview) {
        preview.hidden = !dataUrl;
        if (dataUrl) preview.src = dataUrl;
        else preview.removeAttribute('src');
      }
      if (container && key !== 'studentPhoto') container.hidden = !dataUrl;
      if (remove) remove.hidden = !dataUrl;
      if (empty) empty.hidden = Boolean(dataUrl);
      panel.querySelectorAll('[data-camera-label]').forEach((label) => {
        label.dataset.i18n = dataUrl ? 'retake' : 'camera';
        label.textContent = app.t(label.dataset.i18n);
      });
      panel.querySelectorAll('[data-gallery-label]').forEach((label) => {
        label.dataset.i18n = dataUrl ? 'replaceImage' : 'gallery';
        label.textContent = app.t(label.dataset.i18n);
      });
      panel.querySelectorAll('[data-photo-label]').forEach((label) => {
        label.dataset.i18n = dataUrl ? 'replaceImage' : 'addPhoto';
        label.textContent = app.t(label.dataset.i18n);
      });
      setUploadStatus(key, dataUrl ? 'imageReady' : 'notAdded', Boolean(dataUrl));
    });
  }

  function bindImages() {
    document.querySelectorAll('[data-image-input]').forEach((input) => input.addEventListener('change', () => handleImageInput(input)));
    document.querySelectorAll('[data-remove-image]').forEach((button) => {
      button.addEventListener('click', () => {
        app.state.images[button.dataset.removeImage] = '';
        updateImageUI();
        app.saveDraft();
      });
    });
  }


  /* ---------------------------------------------------------------
     Kayit gonderimi - Google Apps Script Web App
     Basit istek (text/plain) kullanilir; Apps Script OPTIONS on
     kontrolunu karsilamadigi icin ozel baslik veya application/json
     kullanilamaz. 302 yonlendirmesi redirect:'follow' ile izlenir.
  ----------------------------------------------------------------*/
  function gonderimAdresi() {
    return app.adresMetni(app.state.fields);
  }

  function gonderimSaglikNotu() {
    const f = app.state.fields;
    const parcalar = [];
    if (f.disability === 'exists' && f.disabilityDetail) parcalar.push('Engel: ' + f.disabilityDetail);
    if (f.illness === 'exists' && f.illnessDetail) parcalar.push('Hastalik: ' + f.illnessDetail);
    if (f.medicine) parcalar.push('Ilac: ' + f.medicine);
    if (f.emergencyName || app.telE164('emergencyPhone')) parcalar.push('Acil: ' + [f.emergencyName, app.telGosterim('emergencyPhone')].filter(Boolean).join(' '));
    return parcalar.join(' | ');
  }

  function gonderimGovdesi(base64) {
    const f = app.state.fields;
    const okul = f.school === '__other__' ? (f.otherSchoolName || 'Diger') : (f.school || '');
    return {
      sir: (window.GONDERIM && window.GONDERIM.ortakSir) || '',
      pdfBase64: base64,
      ogrenci: {
        ad: f.studentName || '', soyad: f.studentSurname || '',
        dogumTarihi: f.birthDate || '', cinsiyet: f.gender || '',
        kimlikNo: f.identityNumber || '', okul: okul, sinif: f.classLevel || '',
        cep: app.telE164('studentPhone'), eposta: (f.studentEmail || '').trim()
      },
      veli: {
        yakinlik: f.relationship || '', adSoyad: f.guardianName || '',
        cep: app.telE164('guardianPhone'), eposta: (f.guardianEmail || '').trim(), adres: gonderimAdresi()
      },
      saglikNotu: gonderimSaglikNotu(),
      goruntuIzni: f.mediaConsent === 'yes' || f.mediaConsent === true,
      guncellenenRef: guncellenenRefAl()
    };
  }

  /* Veli bilgisini sonradan duzeltmek isterse: eski referans numarasi.
     Bos birakilirsa yeni kayit acilir. Bicim: UC-2026-0001 (veya -R2). */
  function guncellenenRefAl() {
    const alan = document.getElementById('updateRef');
    if (!alan) return '';
    const deger = String(alan.value || '').toUpperCase().replace(/\s+/g, '');
    return /^UC-\d{4}-\d{4}(-R\d+)?$/.test(deger) ? deger : '';
  }

  function guncellenenRefGecerliMi() {
    const alan = document.getElementById('updateRef');
    if (!alan) return true;
    const ham = String(alan.value || '').trim();
    return ham === '' || guncellenenRefAl() !== '';
  }

  function base64Cevir(bytes) {
    let ikili = '';
    const parca = 0x8000;
    for (let i = 0; i < bytes.length; i += parca) {
      ikili += String.fromCharCode.apply(null, bytes.subarray(i, i + parca));
    }
    return btoa(ikili);
  }

  async function submitRegistration() {
    if (!app.lastPdf) return;
    const ayar = window.GONDERIM || {};
    if (!ayar.ucNokta) return;
    const dugme = document.getElementById('submitButton');
    const hata = document.getElementById('submitError');
    hata.textContent = '';
    dugme.disabled = true;
    dugme.setAttribute('aria-busy', 'true');
    dugme.textContent = app.t('submitting');
    let basarili = false;
    if (!guncellenenRefGecerliMi()) {
      hata.textContent = app.t('updateRefInvalid');
      dugme.disabled = false;
      dugme.removeAttribute('aria-busy');
      dugme.textContent = app.t('submitRegistration');
      document.getElementById('updateRefBox').open = true;
      document.getElementById('updateRef').focus();
      return;
    }
    try {
      const govde = gonderimGovdesi(base64Cevir(app.lastPdf.bytes));
      const metin = JSON.stringify(govde);
      if (metin.length > 9 * 1024 * 1024) throw new Error('cok-buyuk');
      const cevap = await fetch(ayar.ucNokta, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: metin,
        redirect: 'follow'
      });
      const sonuc = JSON.parse(await cevap.text());
      if (!sonuc.ok) throw new Error(sonuc.hata || 'sunucu-hatasi');
      basarili = true;
      app.state.submittedRef = sonuc.ref;
      if (typeof app.saveDraft === 'function') app.saveDraft();
      tesekkurGoster(sonuc.ref, sonuc.guncelleme);
    } catch (error) {
      console.error(error);
      const kod = String(error.message || '');
      hata.textContent = kod === 'cok-buyuk' ? app.t('submitTooBig')
        : kod === 'yetkisiz' ? app.t('submitUnauthorized')
        : app.t('submitFailed');
      document.getElementById('shareFallback').hidden = false;
      dugme.textContent = app.t('submitRetry');
    } finally {
      dugme.disabled = false;
      dugme.removeAttribute('aria-busy');
      if (!basarili && dugme.textContent === app.t('submitting')) dugme.textContent = app.t('submitRegistration');
    }
  }

  /* --- kimlikten otomatik doldurma ------------------------------
     Yalnizca ICAO kontrol haneleri dogrulanan degerler yazilir. */
  function mrzAlanlariUygula(veri) {
    const eslesme = {
      studentSurname: veri.soyad,
      studentName: veri.adlar,
      birthDate: veri.dogumTarihi,
      gender: veri.cinsiyet,
      identityNumber: veri.kimlikNo
    };
    let sayac = 0;
    Object.keys(eslesme).forEach((id) => {
      const deger = eslesme[id];
      if (!deger) return;
      const alan = document.getElementById(id);
      if (!alan) return;
      if (alan.tagName === 'SELECT' && ![...alan.options].some((o) => o.value === deger)) return;
      alan.value = deger;
      app.state.fields[id] = deger;
      clearElementError(alan);
      alan.classList.add('oto-dolu');
      sayac += 1;
    });
    if (sayac) {
      updateDeclaration();
      app.saveDraft();
    }
    return sayac;
  }

  async function mrzDoldur() {
    const dugme = document.getElementById('mrzOkuButonu');
    const durum = document.getElementById('mrzDurum');
    if (!dugme || !app.mrz) return;
    dugme.disabled = true;
    dugme.setAttribute('aria-busy', 'true');
    durum.classList.remove('mrz-basarisiz');
    durum.textContent = app.t('mrzLoading');
    try {
      const veri = await app.mrz.oku(
        [app.state.images.identityBack, app.state.images.identityFront],
        (olay) => {
          if (!olay || typeof olay.progress !== 'number') return;
          const yuzde = Math.round(olay.progress * 100);
          durum.textContent = `${app.t('mrzLoading')} %${yuzde}`;
        }
      );
      if (!veri) {
        durum.textContent = app.t('mrzFailed');
        durum.classList.add('mrz-basarisiz');
        return;
      }
      const sayac = mrzAlanlariUygula(veri);
      if (!sayac) {
        durum.textContent = app.t('mrzFailed');
        durum.classList.add('mrz-basarisiz');
        return;
      }
      durum.textContent = `${app.t('mrzDone')} (${sayac})`;
      app.showToast(app.t('mrzToast'));
    } catch (hata) {
      console.error(hata);
      durum.textContent = app.t('mrzError');
      durum.classList.add('mrz-basarisiz');
    } finally {
      dugme.removeAttribute('aria-busy');
      updateImageUI();
    }
  }

  /* Tum adimlarin yerine gecen tek kapanis ekrani. */
  function tesekkurGoster(ref, guncelleme) {
    const ekran = document.getElementById('tesekkurEkrani');
    if (!ekran) return;
    document.querySelectorAll('.step[data-step]').forEach((bolum) => { bolum.hidden = true; });
    const panel = document.getElementById('progressPanel');
    if (panel) panel.hidden = true;
    const gezinme = document.getElementById('formNavigation');
    if (gezinme) gezinme.hidden = true;
    const referans = document.getElementById('refNumber');
    if (referans) referans.textContent = ref || '';
    const baslik = document.getElementById('tesekkurBaslik');
    if (baslik) baslik.textContent = guncelleme ? app.t('tesekkurBaslikGuncelleme') : app.t('tesekkurBaslik');
    ekran.hidden = false;
    ekran.setAttribute('tabindex', '-1');
    try { ekran.focus({ preventScroll: true }); } catch (_) { /* eski tarayici */ }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function downloadPdf() {
    if (!app.lastPdf) return;
    const url = URL.createObjectURL(app.lastPdf.blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = app.lastPdf.filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    app.showToast(app.t('pdfDownloaded'));
  }

  async function sharePdf() {
    if (!app.lastPdf) return;
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [app.lastPdf.file] })) {
      try {
        await navigator.share({ files: [app.lastPdf.file], title: app.t('pdfDocumentTitle'), text: `${CAMI.name} · ${app.t('courseYear')}` });
      } catch (error) {
        if (error.name !== 'AbortError') app.showToast(app.t('shareUnsupported'));
      }
    } else {
      document.getElementById('shareFallback').hidden = false;
      downloadPdf();
    }
  }

  async function generatePdf() {
    const button = document.getElementById('createPdfButton');
    const error = document.getElementById('pdfError');
    error.textContent = '';
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = app.t('creatingPdf');
    try {
      app.lastPdf = await app.createPdf();
      document.getElementById('pdfActions').hidden = false;
      const canShare = navigator.share && navigator.canShare && navigator.canShare({ files: [app.lastPdf.file] });
      document.getElementById('sharePdfButton').hidden = !canShare;
      document.getElementById('shareFallback').hidden = Boolean(canShare);
      const subject = encodeURIComponent(`${CAMI.name} – ${app.t('pdfDocumentTitle')}`);
      const body = encodeURIComponent(`${app.t('emailAttachNote')}\n\n${CAMI.name}\n${CAMI.address}`);
      document.getElementById('emailPdfLink').href = `mailto:${CAMI.email}?subject=${subject}&body=${body}`;
      const gonderimVar = Boolean(window.GONDERIM && window.GONDERIM.ucNokta);
      if (app.state.submittedRef) {
        const refAlan = document.getElementById('updateRef');
        if (refAlan && !refAlan.value) refAlan.value = app.state.submittedRef;
        const kutu = document.getElementById('updateRefBox');
        if (kutu) kutu.open = true;
      }
      document.getElementById('submitBlock').hidden = !gonderimVar;
      document.getElementById('pdfActions').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (pdfError) {
      console.error(pdfError);
      error.textContent = app.t('pdfError');
    } finally {
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.textContent = app.t('createPdf');
    }
  }

  function bindActions() {
    document.querySelectorAll('[data-language]').forEach((button) => button.addEventListener('click', () => app.setLanguage(button.dataset.language)));
    document.getElementById('startButton').addEventListener('click', () => app.goToStep(Math.max(1, Math.min(7, draft.restored ? app.state.currentStep : 1))));
    document.getElementById('backButton').addEventListener('click', () => app.goToStep(app.state.currentStep - 1));
    document.getElementById('nextButton').addEventListener('click', () => {
      const step = app.state.currentStep;
      if (app.validateStep(step)) app.goToStep(step + 1);
    });
    document.getElementById('homeLink').addEventListener('click', (event) => { event.preventDefault(); app.goToStep(0); });
    document.getElementById('contractReader').addEventListener('scroll', updateContractScroll, { passive: true });
    document.getElementById('toastClose').addEventListener('click', () => { document.getElementById('toast').hidden = true; });
    document.getElementById('createPdfButton').addEventListener('click', generatePdf);
    document.getElementById('downloadPdfButton').addEventListener('click', downloadPdf);
    telefonlariBagla();
    const mrzDugme = document.getElementById('mrzOkuButonu');
    if (mrzDugme) mrzDugme.addEventListener('click', mrzDoldur);
    const tesekkurIndir = document.getElementById('tesekkurIndir');
    if (tesekkurIndir) tesekkurIndir.addEventListener('click', downloadPdf);
    const tesekkurYeni = document.getElementById('tesekkurYeni');
    if (tesekkurYeni) tesekkurYeni.addEventListener('click', () => {
      if (!window.confirm(app.t('yeniKayitOnay'))) return;
      try { localStorage.removeItem(DRAFT_KEY); } catch (_) { /* storage unavailable */ }
      window.location.reload();
    });
    document.getElementById('submitButton').addEventListener('click', submitRegistration);
    document.getElementById('sharePdfButton').addEventListener('click', sharePdf);
    document.getElementById('deleteDraftButton').addEventListener('click', () => {
      if (!window.confirm(app.t('deleteDraftConfirm'))) return;
      try { localStorage.removeItem(DRAFT_KEY); } catch (_) { /* storage unavailable */ }
      app.state = defaultState();
      app.showToast(app.t('draftDeleted'));
      setTimeout(() => window.location.reload(), 350);
    });
  }

  function init() {
    bindActions();
    bindFormState();
    bindImages();
    restoreFields();
    translatePage();
    app.signature.init();
    updateImageUI();
    updateDeclaration();
    app.goToStep(0, { force: true, focus: false });
    if (draft.restored) setTimeout(() => app.showToast(app.t('draftRestored')), 300);
    app.ready = true;
    document.dispatchEvent(new CustomEvent('kayit:ready'));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
}());
