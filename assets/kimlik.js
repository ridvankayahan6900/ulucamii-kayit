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
     Kart, dokulu bir masada bile ayirt edilebilsin diye kenar enerjisi
     yerine RENK ILE AYIRMA kullanilir: once zemin rengi kestirilir, ondan
     yeterince ayrilan pikseller on plan sayilir, en buyuk bagli bilesen
     kart kabul edilir. Egiklik en kucuk alanli dikdortgenden okunur ve
     kirparken duzeltilir. Sonuc, kimlik kartinin gercek oranina (ID-1)
     oturtulur; boylece belgedeki kimlik kutusunu tam doldurur.
     ============================================================= */

  const ANALIZ_EN = 320;          // cozumleme cozunurlugu
  const ID1_ORANI = 85.6 / 54;    // 1,5852 — ID-1 kart orani
  /* Disa emniyet payi. Dusuk kontrastta (beyaz kart, beyaz masa) maske kartin
     kenarini birkac piksel iceriden kesebiliyor; bu pay onu telafi eder.
     Biraz masa gorunmesi, kimligin bir kosesinin kesilmesinden yeglenir. */
  const EMNIYET_PAYI = 0.022;

  /* Son kirpmanin kunyesi — denetim ve arayuz icin disari acilir. */
  app.kartKirpSon = null;

  function analizVerisi(canvas, en) {
    const oran = en / canvas.width;
    const boy = Math.max(1, Math.round(canvas.height * oran));
    const yardimci = document.createElement('canvas');
    yardimci.width = en;
    yardimci.height = boy;
    const ctx = yardimci.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(canvas, 0, 0, en, boy);
    return { rgb: ctx.getImageData(0, 0, en, boy).data, en: en, boy: boy };
  }

  function ortanca(dizi) {
    const s = Array.prototype.slice.call(dizi).sort(function (a, b) { return a - b; });
    return s.length ? s[s.length >> 1] : 0;
  }

  /* Zemin rengi: dort kenar seridinden ortanca. Kart nadiren kenara dayanir,
     dolayisiyla serit neredeyse her zaman masayi gorur. */
  function zeminKestir(veri) {
    const en = veri.en;
    const boy = veri.boy;
    const serit = Math.max(2, Math.round(Math.min(en, boy) * 0.07));
    const r = [];
    const g = [];
    const b = [];
    const al = function (x, y) {
      const i = (y * en + x) * 4;
      r.push(veri.rgb[i]); g.push(veri.rgb[i + 1]); b.push(veri.rgb[i + 2]);
    };
    for (let y = 0; y < boy; y += 2) {
      for (let x = 0; x < serit; x += 2) { al(x, y); al(en - 1 - x, y); }
    }
    for (let x = 0; x < en; x += 2) {
      for (let y = 0; y < serit; y += 2) { al(x, y); al(x, boy - 1 - y); }
    }
    const zemin = [ortanca(r), ortanca(g), ortanca(b)];
    // ortalama mutlak sapma: dokulu masada esik kendiliginden yukselir
    let toplam = 0;
    for (let i = 0; i < r.length; i += 1) {
      toplam += Math.abs(r[i] - zemin[0]) + Math.abs(g[i] - zemin[1]) + Math.abs(b[i] - zemin[2]);
    }
    return { zemin: zemin, sapma: r.length ? toplam / (r.length * 3) : 0 };
  }

  function renkUzakligi(rgb, i, renk) {
    const dr = rgb[i] - renk[0];
    const dg = rgb[i + 1] - renk[1];
    const db = rgb[i + 2] - renk[2];
    // yesile agirlikli, goze yakin basit bir uzaklik
    return Math.sqrt(2 * dr * dr + 4 * dg * dg + 3 * db * db) / 3;
  }

  function maskeCikar(veri, kestirim) {
    const esik = Math.max(16, Math.min(60, kestirim.sapma * 2.6 + 10));
    const n = veri.en * veri.boy;
    const maske = new Uint8Array(n);
    for (let p = 0; p < n; p += 1) {
      if (renkUzakligi(veri.rgb, p * 4, kestirim.zemin) > esik) maske[p] = 1;
    }
    return maske;
  }

  /* Kare cekirdekli genisletme/asindirma (ayrilabilir, iki gecis). */
  function morfoloji(maske, en, boy, yaricap, genislet) {
    const ara = new Uint8Array(en * boy);
    const sonuc = new Uint8Array(en * boy);
    const bos = genislet ? 0 : 1;
    for (let y = 0; y < boy; y += 1) {
      for (let x = 0; x < en; x += 1) {
        let deger = bos;
        for (let k = -yaricap; k <= yaricap; k += 1) {
          const xx = x + k;
          if (xx < 0 || xx >= en) continue;
          const v = maske[y * en + xx];
          if (genislet ? v : !v) { deger = genislet ? 1 : 0; break; }
        }
        ara[y * en + x] = deger;
      }
    }
    for (let y = 0; y < boy; y += 1) {
      for (let x = 0; x < en; x += 1) {
        let deger = bos;
        for (let k = -yaricap; k <= yaricap; k += 1) {
          const yy = y + k;
          if (yy < 0 || yy >= boy) continue;
          const v = ara[yy * en + x];
          if (genislet ? v : !v) { deger = genislet ? 1 : 0; break; }
        }
        sonuc[y * en + x] = deger;
      }
    }
    return sonuc;
  }

  /* En buyuk 4-komsulu bagli bileseni dondurur (yigin tabanli, ozyineleme yok). */
  function enBuyukBilesen(maske, en, boy) {
    const etiket = new Int32Array(en * boy).fill(-1);
    const yigin = new Int32Array(en * boy);
    let enIyi = null;
    let enIyiAdet = 0;
    let sira = 0;
    for (let bas = 0; bas < maske.length; bas += 1) {
      if (!maske[bas] || etiket[bas] >= 0) continue;
      let ucu = 0;
      yigin[ucu++] = bas;
      etiket[bas] = sira;
      let adet = 0;
      const kendi = [];
      while (ucu > 0) {
        const p = yigin[--ucu];
        adet += 1;
        kendi.push(p);
        const x = p % en;
        const y = (p / en) | 0;
        if (x > 0 && maske[p - 1] && etiket[p - 1] < 0) { etiket[p - 1] = sira; yigin[ucu++] = p - 1; }
        if (x < en - 1 && maske[p + 1] && etiket[p + 1] < 0) { etiket[p + 1] = sira; yigin[ucu++] = p + 1; }
        if (y > 0 && maske[p - en] && etiket[p - en] < 0) { etiket[p - en] = sira; yigin[ucu++] = p - en; }
        if (y < boy - 1 && maske[p + en] && etiket[p + en] < 0) { etiket[p + en] = sira; yigin[ucu++] = p + en; }
      }
      if (adet > enIyiAdet) { enIyiAdet = adet; enIyi = kendi; }
      sira += 1;
    }
    return { pikseller: enIyi, adet: enIyiAdet };
  }

  /* Konveks kabuk icin her satirin yalniz en sol ve en sag pikseli yeter. */
  function uctakiNoktalar(pikseller, en) {
    const sol = new Map();
    const sag = new Map();
    for (let i = 0; i < pikseller.length; i += 1) {
      const p = pikseller[i];
      const x = p % en;
      const y = (p / en) | 0;
      if (!sol.has(y) || x < sol.get(y)) sol.set(y, x);
      if (!sag.has(y) || x > sag.get(y)) sag.set(y, x);
    }
    const noktalar = [];
    sol.forEach(function (x, y) { noktalar.push([x, y]); });
    sag.forEach(function (x, y) { noktalar.push([x, y]); });
    return noktalar;
  }

  function konveksKabuk(noktalar) {
    if (noktalar.length < 3) return noktalar.slice();
    const p = noktalar.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    const capraz = function (o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); };
    const alt = [];
    for (let i = 0; i < p.length; i += 1) {
      while (alt.length >= 2 && capraz(alt[alt.length - 2], alt[alt.length - 1], p[i]) <= 0) alt.pop();
      alt.push(p[i]);
    }
    const ust = [];
    for (let i = p.length - 1; i >= 0; i -= 1) {
      while (ust.length >= 2 && capraz(ust[ust.length - 2], ust[ust.length - 1], p[i]) <= 0) ust.pop();
      ust.push(p[i]);
    }
    alt.pop(); ust.pop();
    return alt.concat(ust);
  }

  /* Donen kaliperler: her kabuk kenari icin dondurulmus sinir kutusu, en kucugu alinir. */
  function enKucukDikdortgen(kabuk) {
    if (kabuk.length < 3) return null;
    let enIyi = null;
    for (let i = 0; i < kabuk.length; i += 1) {
      const a = kabuk[i];
      const b = kabuk[(i + 1) % kabuk.length];
      const aci = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const c = Math.cos(-aci);
      const s = Math.sin(-aci);
      let enAzX = Infinity, enCokX = -Infinity, enAzY = Infinity, enCokY = -Infinity;
      for (let j = 0; j < kabuk.length; j += 1) {
        const x = kabuk[j][0] * c - kabuk[j][1] * s;
        const y = kabuk[j][0] * s + kabuk[j][1] * c;
        if (x < enAzX) enAzX = x;
        if (x > enCokX) enCokX = x;
        if (y < enAzY) enAzY = y;
        if (y > enCokY) enCokY = y;
      }
      const g = enCokX - enAzX;
      const b2 = enCokY - enAzY;
      const alan = g * b2;
      if (!enIyi || alan < enIyi.alan) {
        const mx = (enAzX + enCokX) / 2;
        const my = (enAzY + enCokY) / 2;
        enIyi = {
          alan: alan, g: g, b: b2, aci: aci,
          merkez: [mx * c + my * s, -mx * s + my * c]   // ters donusum
        };
      }
    }
    return enIyi;
  }

  /* Kartin kendi rengini kullanarak kutuyu disa dogru buyutur: kartin basilmamis
     beyaz kenari maskeye girmemis olabilir, onu geri kazanir. */
  function kartaGoreBuyut(veri, kutu, kartRenk, zeminRenk) {
    const en = veri.en;
    const boy = veri.boy;
    const enCokAdim = Math.round(Math.max(en, boy) * 0.06);
    const kartMi = function (i) {
      return renkUzakligi(veri.rgb, i, kartRenk) < renkUzakligi(veri.rgb, i, zeminRenk);
    };
    const satirKartMi = function (y, x0, x1) {
      let sayac = 0, toplam = 0;
      for (let x = x0; x <= x1; x += 1) { toplam += 1; if (kartMi((y * en + x) * 4)) sayac += 1; }
      return toplam > 0 && sayac / toplam >= 0.55;
    };
    const sutunKartMi = function (x, y0, y1) {
      let sayac = 0, toplam = 0;
      for (let y = y0; y <= y1; y += 1) { toplam += 1; if (kartMi((y * en + x) * 4)) sayac += 1; }
      return toplam > 0 && sayac / toplam >= 0.55;
    };
    let [x0, y0, x1, y1] = kutu;
    for (let k = 0; k < enCokAdim && y0 > 0 && satirKartMi(y0 - 1, x0, x1); k += 1) y0 -= 1;
    for (let k = 0; k < enCokAdim && y1 < boy - 1 && satirKartMi(y1 + 1, x0, x1); k += 1) y1 += 1;
    for (let k = 0; k < enCokAdim && x0 > 0 && sutunKartMi(x0 - 1, y0, y1); k += 1) x0 -= 1;
    for (let k = 0; k < enCokAdim && x1 < en - 1 && sutunKartMi(x1 + 1, y0, y1); k += 1) x1 += 1;
    return [x0, y0, x1, y1];
  }

  function medyanRenk(veri, kutu) {
    const en = veri.en;
    const r = [], g = [], b = [];
    for (let y = kutu[1]; y <= kutu[3]; y += 2) {
      for (let x = kutu[0]; x <= kutu[2]; x += 2) {
        const i = (y * en + x) * 4;
        r.push(veri.rgb[i]); g.push(veri.rgb[i + 1]); b.push(veri.rgb[i + 2]);
      }
    }
    return [ortanca(r), ortanca(g), ortanca(b)];
  }

  /* Kirpilmis yeni canvas dondurur; guvenli davranamazsa aynisini verir. */
  app.kartKirp = function (canvas) {
    app.kartKirpSon = null;
    try {
      if (!canvas || canvas.width < 240 || canvas.height < 160) return canvas;

      const analizEn = Math.min(ANALIZ_EN, canvas.width);
      const veri = analizVerisi(canvas, analizEn);
      const kestirim = zeminKestir(veri);

      let maske = maskeCikar(veri, kestirim);
      const yaricap = Math.max(1, Math.round(analizEn * 0.012));
      maske = morfoloji(maske, veri.en, veri.boy, yaricap, true);      // kapama: genislet
      maske = morfoloji(maske, veri.en, veri.boy, yaricap, false);     //         + asindir
      maske = morfoloji(maske, veri.en, veri.boy, 1, false);           // acma: benekleri at
      maske = morfoloji(maske, veri.en, veri.boy, 1, true);

      const bilesen = enBuyukBilesen(maske, veri.en, veri.boy);
      if (!bilesen.pikseller || bilesen.adet < veri.en * veri.boy * 0.03) return canvas;

      // eksene paralel sinir kutusu
      let x0 = veri.en, y0 = veri.boy, x1 = 0, y1 = 0;
      for (let i = 0; i < bilesen.pikseller.length; i += 1) {
        const p = bilesen.pikseller[i];
        const x = p % veri.en;
        const y = (p / veri.en) | 0;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }

      // kartin kendi rengiyle disa dogru buyut (basilmamis beyaz kenar)
      const kartRenk = medyanRenk(veri, [x0, y0, x1, y1]);
      const buyutulmus = kartaGoreBuyut(veri, [x0, y0, x1, y1], kartRenk, kestirim.zemin);
      x0 = buyutulmus[0]; y0 = buyutulmus[1]; x1 = buyutulmus[2]; y1 = buyutulmus[3];

      // egiklik: en kucuk alanli dikdortgenden
      const kabuk = konveksKabuk(uctakiNoktalar(bilesen.pikseller, veri.en));
      const enKucuk = enKucukDikdortgen(kabuk);
      const tani = { kabukN: kabuk.length, hamAci: enKucuk ? Number((enKucuk.aci * 180 / Math.PI).toFixed(2)) : null,
                     dikG: enKucuk ? Math.round(enKucuk.g) : null, dikB: enKucuk ? Math.round(enKucuk.b) : null, red: '' };
      let aci = 0;
      if (enKucuk) {
        let a = enKucuk.aci;
        while (a > Math.PI / 4) a -= Math.PI / 2;
        while (a < -Math.PI / 4) a += Math.PI / 2;
        if (Math.abs(a) > 0.026 && Math.abs(a) < 0.27) aci = a;   // 1,5° – 15,5°
      }

      const olcek = canvas.width / veri.en;
      let merkezX = ((x0 + x1) / 2 + 0.5) * olcek;
      let merkezY = ((y0 + y1) / 2 + 0.5) * olcek;
      let g = (x1 - x0 + 1) * olcek;
      let b = (y1 - y0 + 1) * olcek;

      // egiklik duzeltilecekse dikdortgenin gercek olculerini kullan
      if (aci !== 0 && enKucuk) {
        const eg = Math.max(enKucuk.g, enKucuk.b) * olcek;
        const kg = Math.min(enKucuk.g, enKucuk.b) * olcek;
        // dondurulmus kutu eksene paralel kutudan buyuk olmamali
        tani.eg = Math.round(eg); tani.kg = Math.round(kg); tani.aabbG = Math.round(g); tani.aabbB = Math.round(b);
        if (eg <= g * 1.02 && kg <= b * 1.02) {
          g = eg;
          b = kg;
          merkezX = (enKucuk.merkez[0] + 0.5) * olcek;
          merkezY = (enKucuk.merkez[1] + 0.5) * olcek;
        } else {
          tani.red = 'dikdortgen aabb den buyuk';
          aci = 0;
        }
      } else if (!aci) {
        tani.red = tani.red || 'aci kapisi';
      }

      /* Emniyet payi guvene gore ayarlanir. Kartin rengi masanin renginden ne
         kadar az ayriliyorsa maske o kadar iceriden kesiyor demektir; boyle
         durumda payi buyutup kartin kenarini kurtariyoruz. */
      const ayrim = renkUzakligi([kartRenk[0], kartRenk[1], kartRenk[2], 255], 0, kestirim.zemin);
      const belirsizlik = Math.max(0, Math.min(1, (50 - ayrim) / 50));
      const pay = EMNIYET_PAYI * (1 + belirsizlik);
      tani.ayrim = Math.round(ayrim);
      tani.pay = Number(pay.toFixed(3));
      g *= 1 + pay * 2;
      b *= 1 + pay * 2;

      // --- guvenlik kapilari ---
      const alanOrani = (g * b) / (canvas.width * canvas.height);
      if (alanOrani < 0.05 || alanOrani > 0.99) return canvas;
      const oran = g / b;
      if (oran < 1.15 || oran > 2.4) return canvas;               // karta benzemiyor

      // ID-1 oranina oturt: makul yakinliktaysa kisa kenari acarak tam orana getir
      if (Math.abs(oran - ID1_ORANI) / ID1_ORANI <= 0.22) {
        if (oran < ID1_ORANI) g = b * ID1_ORANI;
        else b = g / ID1_ORANI;
      }

      // cerceve disina tasmasin (egiklik yoksa kirp, varsa bos alan beyaz kalir)
      if (aci === 0) {
        const yeniG = Math.min(g, canvas.width);
        const yeniB = Math.min(b, canvas.height);
        merkezX = Math.min(canvas.width - yeniG / 2, Math.max(yeniG / 2, merkezX));
        merkezY = Math.min(canvas.height - yeniB / 2, Math.max(yeniB / 2, merkezY));
        g = yeniG;
        b = yeniB;
      }

      const hedef = document.createElement('canvas');
      hedef.width = Math.max(1, Math.round(g));
      hedef.height = Math.max(1, Math.round(b));
      const ctx = hedef.getContext('2d', { alpha: false });
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, hedef.width, hedef.height);
      ctx.imageSmoothingQuality = 'high';
      ctx.translate(hedef.width / 2, hedef.height / 2);
      if (aci !== 0) ctx.rotate(-aci);
      ctx.drawImage(canvas, -merkezX, -merkezY);

      app.kartKirpSon = {
        x: Math.round(merkezX - g / 2), y: Math.round(merkezY - b / 2),
        g: Math.round(g), b: Math.round(b),
        aci: Number((aci * 180 / Math.PI).toFixed(2)),
        oran: Number((hedef.width / hedef.height).toFixed(3)),
        tani: tani
      };
      return hedef;
    } catch (_) {
      app.kartKirpSon = null;
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
