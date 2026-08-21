/* Kimlik gorseli isleme
   -------------------------------------------------------------------
   1) Otomatik kirpma  : fotograftaki bos kenarlar atilir, kart cerceveye oturur.
   2) MRZ okuma        : kimligin makine okunabilir bandindan ad, soyad,
                         dogum tarihi, cinsiyet ve numara cikarilir.

   MRZ motoru (tesseract.js) YALNIZCA kullanici dugmeye bastiginda,
   sayfa acilisini yavaslatmayacak sekilde indirilir. Okunan degerler
   ancak ICAC kontrol haneleri dogrulandiginda forma yazilir; yanlis
   veriyle form doldurmaktansa hic doldurmamak yeglenir.                  */

(function (global) {
  'use strict';
  const app = global.KayitApp = global.KayitApp || {};

  /* =============================================================
     1. BOLUM — otomatik kirpma
     Kenar enerjisi (gradyan) satir/sutun toplamlari cikarilir; enerjinin
     %96'sini iceren en dar pencere kartin siniri kabul edilir.
     ============================================================= */

  const ANALIZ_EN = 260;
  const GURULTU_ESIGI = 14;
  const PAY_ORANI = 0.025;

  function griVeri(canvas, en) {
    const oran = en / canvas.width;
    const boy = Math.max(1, Math.round(canvas.height * oran));
    const yardimci = document.createElement('canvas');
    yardimci.width = en;
    yardimci.height = boy;
    const ctx = yardimci.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(canvas, 0, 0, en, boy);
    const ham = ctx.getImageData(0, 0, en, boy).data;
    const gri = new Float32Array(en * boy);
    for (let i = 0, p = 0; i < ham.length; i += 4, p += 1) {
      gri[p] = 0.299 * ham[i] + 0.587 * ham[i + 1] + 0.114 * ham[i + 2];
    }
    return { gri: gri, en: en, boy: boy };
  }

  function kenarEnerjisi(veri) {
    const gri = veri.gri;
    const en = veri.en;
    const boy = veri.boy;
    const sutun = new Float32Array(en);
    const satir = new Float32Array(boy);
    for (let y = 1; y < boy - 1; y += 1) {
      for (let x = 1; x < en - 1; x += 1) {
        const i = y * en + x;
        const enerji = Math.abs(gri[i + 1] - gri[i - 1]) + Math.abs(gri[i + en] - gri[i - en]);
        if (enerji < GURULTU_ESIGI) continue;
        sutun[x] += enerji;
        satir[y] += enerji;
      }
    }
    return { sutun: sutun, satir: satir };
  }

  function yumusat(dizi, yaricap) {
    const sonuc = new Float32Array(dizi.length);
    for (let i = 0; i < dizi.length; i += 1) {
      let toplam = 0;
      let adet = 0;
      for (let k = -yaricap; k <= yaricap; k += 1) {
        const j = i + k;
        if (j < 0 || j >= dizi.length) continue;
        toplam += dizi[j];
        adet += 1;
      }
      sonuc[i] = toplam / adet;
    }
    return sonuc;
  }

  function enerjiSiniri(dizi, pay) {
    let toplam = 0;
    for (let i = 0; i < dizi.length; i += 1) toplam += dizi[i];
    if (toplam <= 0) return null;
    const esik = toplam * pay;
    let birikim = 0;
    let bas = 0;
    let son = dizi.length - 1;
    for (let i = 0; i < dizi.length; i += 1) {
      birikim += dizi[i];
      if (birikim >= esik) { bas = i; break; }
    }
    birikim = 0;
    for (let i = dizi.length - 1; i >= 0; i -= 1) {
      birikim += dizi[i];
      if (birikim >= esik) { son = i; break; }
    }
    return son > bas ? [bas, son] : null;
  }

  /* Kirpilmis yeni canvas dondurur; guvenli davranamazsa aynisini verir. */
  app.kartKirp = function (canvas) {
    try {
      if (!canvas || canvas.width < 200 || canvas.height < 120) return canvas;
      const veri = griVeri(canvas, Math.min(ANALIZ_EN, canvas.width));
      const enerji = kenarEnerjisi(veri);
      const yatay = enerjiSiniri(yumusat(enerji.sutun, 2), 0.02);
      const dikey = enerjiSiniri(yumusat(enerji.satir, 2), 0.02);
      if (!yatay || !dikey) return canvas;

      const olcek = canvas.width / veri.en;
      let x = yatay[0] * olcek;
      let g = (yatay[1] - yatay[0] + 1) * olcek;
      let y = dikey[0] * olcek;
      let b = (dikey[1] - dikey[0] + 1) * olcek;

      const payX = g * PAY_ORANI;
      const payY = b * PAY_ORANI;
      x = Math.max(0, x - payX);
      y = Math.max(0, y - payY);
      g = Math.min(canvas.width - x, g + payX * 2);
      b = Math.min(canvas.height - y, b + payY * 2);

      const oranG = g / canvas.width;
      const oranB = b / canvas.height;
      if (oranG < 0.3 || oranB < 0.25) return canvas;          // fazla agresif, guvenme
      if (oranG > 0.95 && oranB > 0.95) return canvas;         // kirpilacak kenar yok

      const hedef = document.createElement('canvas');
      hedef.width = Math.max(1, Math.round(g));
      hedef.height = Math.max(1, Math.round(b));
      const ctx = hedef.getContext('2d', { alpha: false });
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, hedef.width, hedef.height);
      ctx.drawImage(canvas, Math.round(x), Math.round(y), hedef.width, hedef.height,
        0, 0, hedef.width, hedef.height);
      return hedef;
    } catch (_) {
      return canvas;
    }
  };

  /* =============================================================
     2. BOLUM — MRZ cozumlemesi (ICAO 9303: TD1 3x30, TD3 2x44)
     ============================================================= */

  const MRZ_KARAKTER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<';
  const AGIRLIK = [7, 3, 1];
  const HARF_RAKAM = { O: '0', Q: '0', D: '0', I: '1', L: '1', Z: '2', S: '5', B: '8', G: '6' };

  function kontrolHanesi(metin) {
    let toplam = 0;
    for (let i = 0; i < metin.length; i += 1) {
      const c = metin.charAt(i);
      let d;
      if (c === '<') d = 0;
      else if (c >= '0' && c <= '9') d = c.charCodeAt(0) - 48;
      else if (c >= 'A' && c <= 'Z') d = c.charCodeAt(0) - 55;
      else return '';
      toplam += d * AGIRLIK[i % 3];
    }
    return String(toplam % 10);
  }

  /* Sayisal olmasi gereken alanlarda tipik OCR karismalarini duzeltir. */
  function sayisallastir(metin) {
    let sonuc = '';
    for (let i = 0; i < metin.length; i += 1) {
      const c = metin.charAt(i);
      sonuc += (c >= '0' && c <= '9') || c === '<' ? c : (HARF_RAKAM[c] || c);
    }
    return sonuc;
  }

  function mrzSatirlari(metin) {
    return String(metin || '')
      .toUpperCase()
      .split(/\r?\n/)
      .map(function (s) { return s.replace(/[^A-Z0-9<]/g, ''); })
      .filter(function (s) { return s.length >= 26; });
  }

  /* Tarih: YYMMDD -> YYYY-MM-DD. Yuzyil, gelecege dusmeyecek sekilde secilir. */
  function tarihCevir(yymmdd) {
    if (!/^\d{6}$/.test(yymmdd)) return '';
    const yy = Number(yymmdd.slice(0, 2));
    const ay = Number(yymmdd.slice(2, 4));
    const gun = Number(yymmdd.slice(4, 6));
    if (ay < 1 || ay > 12 || gun < 1 || gun > 31) return '';
    const buYil = new Date().getFullYear();
    let yil = 2000 + yy;
    if (yil > buYil) yil = 1900 + yy;
    const iki = function (n) { return (n < 10 ? '0' : '') + n; };
    return yil + '-' + iki(ay) + '-' + iki(gun);
  }

  /* Belcika rijksregisternummer: 11 hane, son iki hane 97 tumleyeni. */
  function rijksregisterGecerliMi(onbir) {
    if (!/^\d{11}$/.test(onbir)) return false;
    const govde = onbir.slice(0, 9);
    const kontrol = Number(onbir.slice(9, 11));
    const eski = 97 - (Number(govde) % 97);
    const yeni = 97 - (Number('2' + govde) % 97);
    return kontrol === eski || kontrol === yeni;
  }

  function rijksregisterBicimle(onbir) {
    return onbir.slice(0, 2) + '.' + onbir.slice(2, 4) + '.' + onbir.slice(4, 6)
      + '-' + onbir.slice(6, 9) + '.' + onbir.slice(9, 11);
  }

  function adAyir(satir) {
    const temiz = String(satir || '').replace(/<+$/, '');
    const parcalar = temiz.split('<<');
    const soyad = (parcalar[0] || '').replace(/</g, ' ').replace(/\s+/g, ' ').trim();
    const adlar = (parcalar.slice(1).join(' ') || '').replace(/</g, ' ').replace(/\s+/g, ' ').trim();
    return { soyad: soyad, adlar: adlar };
  }

  /* Ad yazimi: MRZ tumu buyuk harf ve aksansizdir. Soyad resmi belgelerdeki
     gibi buyuk kalir, adlar bas harfi buyuk yazilir; Turkce harfleri veli
     duzeltsin diye alan vurgulanir. */
  function adBicimle(metin) {
    return metin.split(' ').map(function (k) {
      return k ? k.charAt(0) + k.slice(1).toLowerCase() : k;
    }).join(' ');
  }

  function td1Ayristir(satirlar) {
    const l1 = (satirlar[0] + '<<<<<').slice(0, 30);
    const l2 = (satirlar[1] + '<<<<<').slice(0, 30);
    const l3 = (satirlar[2] + '<<<<<').slice(0, 30);
    if (l3.indexOf('<<') < 0) return null;

    const dogum = sayisallastir(l2.slice(0, 6));
    if (kontrolHanesi(dogum) !== sayisallastir(l2.slice(6, 7))) return null;   // zorunlu kapi

    const dogumTarihi = tarihCevir(dogum);
    if (!dogumTarihi) return null;

    const ad = adAyir(l3);
    if (!ad.soyad) return null;

    const cinsiyetHarfi = l2.charAt(7);
    const belgeNo = l1.slice(5, 14).replace(/</g, '');
    const belgeGecerli = kontrolHanesi(l1.slice(5, 14)) === sayisallastir(l1.slice(14, 15));
    const opsiyonel = sayisallastir(l1.slice(15, 30)).replace(/</g, '');
    const rrn = opsiyonel.slice(0, 11);

    let kimlikNo = '';
    if (rijksregisterGecerliMi(rrn)) kimlikNo = rijksregisterBicimle(rrn);
    else if (belgeGecerli && belgeNo) kimlikNo = belgeNo;

    return {
      bicim: 'TD1',
      soyad: ad.soyad,
      adlar: adBicimle(ad.adlar),
      dogumTarihi: dogumTarihi,
      cinsiyet: cinsiyetHarfi === 'F' ? 'female' : (cinsiyetHarfi === 'M' ? 'male' : ''),
      kimlikNo: kimlikNo,
      uyruk: l2.slice(15, 18).replace(/</g, '')
    };
  }

  function td3Ayristir(satirlar) {
    const l1 = (satirlar[0] + '<<<<<').slice(0, 44);
    const l2 = (satirlar[1] + '<<<<<').slice(0, 44);
    if (l1.indexOf('<<') < 0) return null;

    const dogum = sayisallastir(l2.slice(13, 19));
    if (kontrolHanesi(dogum) !== sayisallastir(l2.slice(19, 20))) return null;
    const dogumTarihi = tarihCevir(dogum);
    if (!dogumTarihi) return null;

    const ad = adAyir(l1.slice(5));
    if (!ad.soyad) return null;

    const belgeNo = l2.slice(0, 9).replace(/</g, '');
    const belgeGecerli = kontrolHanesi(l2.slice(0, 9)) === sayisallastir(l2.slice(9, 10));
    const cinsiyetHarfi = l2.charAt(20);

    return {
      bicim: 'TD3',
      soyad: ad.soyad,
      adlar: adBicimle(ad.adlar),
      dogumTarihi: dogumTarihi,
      cinsiyet: cinsiyetHarfi === 'F' ? 'female' : (cinsiyetHarfi === 'M' ? 'male' : ''),
      kimlikNo: belgeGecerli ? belgeNo : '',
      uyruk: l2.slice(10, 13).replace(/</g, '')
    };
  }

  function mrzAyristir(metin) {
    const satirlar = mrzSatirlari(metin);
    const ucluk = satirlar.filter(function (s) { return s.length >= 28 && s.length <= 32; });
    for (let i = 0; i + 3 <= ucluk.length; i += 1) {
      const sonuc = td1Ayristir(ucluk.slice(i, i + 3));
      if (sonuc) return sonuc;
    }
    const ikilik = satirlar.filter(function (s) { return s.length >= 42 && s.length <= 46; });
    for (let i = 0; i + 2 <= ikilik.length; i += 1) {
      const sonuc = td3Ayristir(ikilik.slice(i, i + 2));
      if (sonuc) return sonuc;
    }
    return null;
  }

  /* =============================================================
     3. BOLUM — goruntu hazirligi ve OCR motoru
     ============================================================= */

  const OCR_EN = 1700;

  function dataUrlCanvas(dataUrl) {
    return new Promise(function (cozum, ret) {
      const gorsel = new Image();
      gorsel.onload = function () {
        const canvas = document.createElement('canvas');
        canvas.width = gorsel.naturalWidth;
        canvas.height = gorsel.naturalHeight;
        canvas.getContext('2d', { alpha: false }).drawImage(gorsel, 0, 0);
        cozum(canvas);
      };
      gorsel.onerror = function () { ret(new Error('gorsel-cozulemedi')); };
      gorsel.src = dataUrl;
    });
  }

  /* Secilen bandi buyutup gri tona indirir ve kontrasti gerdirir. */
  function ocrHazirla(canvas, altOran) {
    const kaynakY = Math.round(canvas.height * (1 - altOran));
    const kaynakB = canvas.height - kaynakY;
    const olcek = OCR_EN / canvas.width;
    const hedef = document.createElement('canvas');
    hedef.width = OCR_EN;
    hedef.height = Math.max(1, Math.round(kaynakB * olcek));
    const ctx = hedef.getContext('2d', { alpha: false, willReadFrequently: true });
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, kaynakY, canvas.width, kaynakB, 0, 0, hedef.width, hedef.height);

    const goruntu = ctx.getImageData(0, 0, hedef.width, hedef.height);
    const veri = goruntu.data;
    const histogram = new Uint32Array(256);
    for (let i = 0; i < veri.length; i += 4) {
      const g = (0.299 * veri[i] + 0.587 * veri[i + 1] + 0.114 * veri[i + 2]) | 0;
      veri[i] = veri[i + 1] = veri[i + 2] = g;
      histogram[g] += 1;
    }
    const piksel = veri.length / 4;
    const altSinir = Math.round(piksel * 0.02);
    const ustSinir = Math.round(piksel * 0.98);
    let birikim = 0;
    let dusuk = 0;
    let yuksek = 255;
    for (let g = 0; g < 256; g += 1) {
      birikim += histogram[g];
      if (birikim >= altSinir) { dusuk = g; break; }
    }
    birikim = 0;
    for (let g = 255; g >= 0; g -= 1) {
      birikim += histogram[g];
      if (birikim >= piksel - ustSinir) { yuksek = g; break; }
    }
    const aralik = Math.max(1, yuksek - dusuk);
    for (let i = 0; i < veri.length; i += 4) {
      const g = Math.max(0, Math.min(255, Math.round((veri[i] - dusuk) * 255 / aralik)));
      veri[i] = veri[i + 1] = veri[i + 2] = g;
    }
    ctx.putImageData(goruntu, 0, 0);
    return hedef;
  }

  function betikYukle(kaynak) {
    return new Promise(function (cozum, ret) {
      const etiket = document.createElement('script');
      etiket.src = kaynak;
      etiket.async = true;
      etiket.onload = function () { cozum(); };
      etiket.onerror = function () { ret(new Error('motor-yuklenemedi')); };
      document.head.append(etiket);
    });
  }

  let isci = null;
  let isciSozu = null;

  function isciAl(ilerleme) {
    if (isci) return Promise.resolve(isci);
    if (isciSozu) return isciSozu;
    isciSozu = (async function () {
      if (!global.Tesseract) await betikYukle('vendor/tesseract/tesseract.min.js');
      const yeni = await global.Tesseract.createWorker('eng', 1, {
        workerPath: 'vendor/tesseract/worker.min.js',
        corePath: 'vendor/tesseract/core',
        langPath: 'vendor/tesseract',
        gzip: true,
        logger: function (m) { if (ilerleme) ilerleme(m); }
      });
      await yeni.setParameters({
        tessedit_char_whitelist: MRZ_KARAKTER,
        tessedit_pageseg_mode: '6',
        preserve_interword_spaces: '0'
      });
      isci = yeni;
      return yeni;
    })();
    isciSozu.catch(function () { isciSozu = null; });
    return isciSozu;
  }

  app.mrz = {
    ayristir: mrzAyristir,
    kontrolHanesi: kontrolHanesi,

    /* Verilen gorsellerde MRZ arar. Once kimligin alt bandi, bulunamazsa
       gorselin tamami denenir. Hicbiri dogrulanmazsa null doner. */
    oku: async function (dataUrlListesi, ilerleme) {
      const gorseller = (dataUrlListesi || []).filter(Boolean);
      if (!gorseller.length) return null;
      const motor = await isciAl(ilerleme);
      for (let i = 0; i < gorseller.length; i += 1) {
        const canvas = await dataUrlCanvas(gorseller[i]);
        const bantlar = [0.4, 0.55, 1];
        for (let b = 0; b < bantlar.length; b += 1) {
          const hazir = ocrHazirla(canvas, bantlar[b]);
          const cikti = await motor.recognize(hazir);
          const sonuc = mrzAyristir(cikti && cikti.data ? cikti.data.text : '');
          if (sonuc) return sonuc;
        }
      }
      return null;
    },

    kapat: async function () {
      if (isci) { try { await isci.terminate(); } catch (_) { /* yok say */ } }
      isci = null;
      isciSozu = null;
    }
  };
}(window));
