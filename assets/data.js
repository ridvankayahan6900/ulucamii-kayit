(function () {
  'use strict';

  const app = window.KayitApp = window.KayitApp || {};

  app.declaration = {
    tr: "Yukarıdaki bilgiler tarafımdan doldurulmuş olup, velisi olduğum öğrencinin Kurumunuzun belirlediği kurallar çerçevesinde 'Kur'an-ı Kerim ve Temel Dini Bilgiler Kursu'na kaydının yapılmasını arz ederim. Ayrıca öğrencinin kurs kurallarına uyacağını ve veli olarak üzerime düşen sorumluluklarımı yerine getireceğimi beyan ederim.",
    fr: "Je certifie avoir rempli moi-même les informations ci-dessus et demande l’inscription de l’élève dont je suis le représentant légal au « Cours de Coran et de connaissances religieuses fondamentales », dans le respect des règles fixées par votre établissement. Je déclare également que l’élève respectera le règlement du cours et que j’assumerai les responsabilités qui m’incombent en tant que représentant légal."
  };

  app.contract = {
    tr: {
      title: 'KURS-VELİ SÖZLEŞMESİ',
      student: {
        title: 'ÖĞRENCİNİN SORUMLULUKLARI',
        intro: 'Kurslarımızda eğitim gören öğrencilerin; dini, milli, ahlaki ve insani değerleri benimseyen; ailesini, vatanını ve milletini seven, insan hak ve hukukuna saygılı; sorumluluk duygusuna sahip bireyler olarak yetişmesi hedeflenmektedir.',
        lead: 'Bu doğrultuda öğrencilerin sorumlulukları şunlardır;',
        items: [
          'Cami ve kurs kurallarına uymak,',
          'Kursa ve derslere düzenli olarak devam etmek, derslere zamanında gelmek,',
          'Kursunu ve kurs eşyasını kendi öz malı gibi korumak, zarar verdiklerinde tazmin etmek,',
          'Doğru sözlü, dürüst, erdemli ve çalışkan olmak; din, dil, ırk ve cinsiyet ayrımı yapmamak,',
          'Zararlı, bölücü, yıkıcı, siyasi ve ideolojik amaçlı faaliyetlere katılmamak, bunlarla ilgili amblem, afiş, rozet, yayın ve benzerlerini taşımamak ve bulundurmamak, bilişim ve iletişim araçlarını böyle amaçlar için kullanmamak,',
          'Yöneticilere, öğreticilere, görevlilere, arkadaşlarına ve çevresindeki diğer kişilere karşı saygılı ve nazik davranmak; kaba söz ve davranışlarda bulunmamak, değerbilirlik, hoşgörü, sabır, özgürlük, adalet ve dayanışmadan yana davranış göstermek, küçükleri ve yaşlıları korumak, engelliler ile yardıma muhtaç durumda olanlara yardımcı olmak,',
          'Sağlığa zararlı ve bağımlılık yapan maddeler ile her çeşit kumar oyunlarından ve bu tür oyunların oynandığı ortamlardan uzak durmak.',
          'Cami ve kursta yararlanılan alanların tertipli, düzenli ve temiz kullanmak,',
          'Cami ve kursta düzenlenen etkinliklere imkânlar ölçüsünde katılmak,'
        ]
      },
      guardian: {
        title: 'VELİNİN SORUMLULUKLARI',
        items: [
          'Öğrencinin kursa, zamanında, öğrenmeye hazır, kılık-kıyafet kurallarına uygun bir şekilde gelmesini sağlamak,',
          'Kursun duyuru ve yayınlarını takip etmek,',
          'Kurs yönetimi ile iletişim halinde olmak ve veli toplantılarına katılmak,',
          'Kurs tarafından düzenlenen sosyal etkinliklere destek vermek ve katılmak,',
          'İhtiyaç duyduğunda öğrencinin ödevlerine katkı sağlamak, gerekli yardımda bulunmak ve destek vermek,',
          'Öğrencinin derslerine, okumaya ve araştırmaya daha fazla zaman ayırması için televizyon seyretme ve oyun oynama saatlerini düzenlemek.',
          'Öğrencinin kursta yaptıkları ve öğrendikleri hakkında öğrenci ile günün değerlendirmesini yapmak,',
          'Öğrencinin uyku ve dinlenme saatlerine dikkat etmek,',
          'Kursun düzenleyeceği aile eğitim seminerlerine katılmak,',
          'Öğrencinin, kurs kurallarına uyması için gerekli önlemleri almak,',
          'Öğrencinin ruhsal ve fiziksel durumundaki değişmeler hakkında kursa zamanında bilgi vermek.'
        ]
      },
      classroom: {
        title: 'SINIF İÇİ KURALLAR',
        items: [
          'Derslere zamanında gelmek ve zamanında girmek,',
          'Ders başlamadan, hazırlıklarını tamamlamış olarak hocasını beklemek,',
          'Ders bitiminde hocasının izni ile teneffüse çıkmak,',
          'Derse girerken ders kitap ve materyallerini yanında bulundurmak,',
          'Ders işlenirken dersini takip etmek ve derse katılım sağlamak,',
          'Derste söz alarak konuşmak,',
          'Sınıfta ders dışında herhangi bir şey ile ilgilenmemek,',
          'Hocasından izin almadan sınıftan dışarı çıkmamak,',
          'Sınıfını temiz ve düzenli tutmak,',
          'Derste düzgün ve derli toplu oturmak ve izinsiz ayakta dolaşmamak,',
          'Sınıfın huzurunu bozacak, dersin işlenmesine mani olacak hal ve hareketlerde bulunmamak,',
          'Diğer öğrencileri rahatsız etmemek ve onlarla uyum içinde olmak,',
          'Hocalarına karşı saygılı olmak,',
          'Sınıf öğreticileri bu kuralların dışında kendi sınıfları için öğrencileri ile başka kurallar da oluşturabileceklerdir.'
        ]
      },
      closing: 'Kurs yöneticisi, yukarıdaki kurallar ile bunlara uyulmaması durumunda karşılaşabilecekleri disiplin işlemleri hakkında öğrencileri ve velilerini mevcut iletişim araçlarından birini kullanarak bilgilendirir.'
    },
    fr: {
      title: 'CONTRAT COURS–PARENT',
      student: {
        title: 'RESPONSABILITÉS DE L’ÉLÈVE',
        intro: 'Notre objectif est que les élèves suivant nos cours deviennent des personnes qui adoptent les valeurs religieuses, nationales, morales et humaines, qui aiment leur famille, leur patrie et leur nation, qui respectent les droits humains et le droit, et qui possèdent le sens des responsabilités.',
        lead: 'Dans cette perspective, les responsabilités des élèves sont les suivantes :',
        items: [
          'Respecter les règles de la mosquée et du cours ;',
          'Suivre régulièrement le cours et les leçons et arriver à l’heure ;',
          'Préserver le cours et son matériel comme ses propres biens et indemniser les dommages causés ;',
          'Être sincère, honnête, vertueux et travailleur ; ne pratiquer aucune discrimination fondée sur la religion, la langue, l’origine ou le sexe ;',
          'Ne pas participer à des activités nuisibles, séparatistes, destructrices, politiques ou idéologiques ; ne pas porter ni conserver d’emblèmes, d’affiches, de badges, de publications ou d’objets similaires qui s’y rapportent et ne pas utiliser les moyens informatiques et de communication à de telles fins ;',
          'Se comporter avec respect et courtoisie envers les responsables, les enseignants, le personnel, les camarades et toute autre personne de son entourage ; ne pas tenir de propos ni adopter de comportements grossiers ; agir en faveur de la reconnaissance d’autrui, de la tolérance, de la patience, de la liberté, de la justice et de la solidarité ; protéger les plus jeunes et les personnes âgées et aider les personnes handicapées ou dans le besoin ;',
          'Se tenir à l’écart des substances nocives pour la santé et créant une dépendance, de toute forme de jeux d’argent ainsi que des lieux où ils sont pratiqués.',
          'Utiliser de manière ordonnée, soignée et propre les espaces de la mosquée et du cours mis à disposition ;',
          'Participer, dans la mesure de ses possibilités, aux activités organisées à la mosquée et au cours.'
        ]
      },
      guardian: {
        title: 'RESPONSABILITÉS DU PARENT OU REPRÉSENTANT LÉGAL',
        items: [
          'Veiller à ce que l’élève arrive au cours à l’heure, prêt à apprendre et dans une tenue conforme aux règles ;',
          'Suivre les annonces et publications du cours ;',
          'Rester en contact avec la direction du cours et participer aux réunions de parents ;',
          'Soutenir les activités sociales organisées par le cours et y participer ;',
          'Lorsque cela est nécessaire, contribuer aux devoirs de l’élève, lui apporter l’aide nécessaire et le soutenir ;',
          'Organiser les heures de télévision et de jeux afin que l’élève consacre davantage de temps à ses leçons, à la lecture et à la recherche.',
          'Faire avec l’élève le bilan de sa journée sur ce qu’il a fait et appris au cours ;',
          'Veiller aux heures de sommeil et de repos de l’élève ;',
          'Participer aux séminaires de formation familiale organisés par le cours ;',
          'Prendre les mesures nécessaires pour que l’élève respecte les règles du cours ;',
          'Informer le cours en temps utile de tout changement dans l’état psychologique ou physique de l’élève.'
        ]
      },
      classroom: {
        title: 'RÈGLES DE LA CLASSE',
        items: [
          'Arriver aux leçons et entrer en classe à l’heure ;',
          'Avant le début de la leçon, avoir terminé ses préparatifs et attendre son enseignant ;',
          'À la fin de la leçon, ne sortir en récréation qu’avec l’autorisation de l’enseignant ;',
          'Avoir avec soi les livres et le matériel nécessaires en entrant en classe ;',
          'Suivre la leçon et y participer pendant son déroulement ;',
          'Demander la parole avant de parler ;',
          'Ne s’occuper d’aucune autre chose pendant la leçon ;',
          'Ne pas sortir de la classe sans l’autorisation de l’enseignant ;',
          'Maintenir la classe propre et ordonnée ;',
          'S’asseoir correctement et de manière ordonnée et ne pas circuler debout sans autorisation ;',
          'Ne pas adopter d’attitudes ou de comportements troublant la tranquillité de la classe ou empêchant le bon déroulement de la leçon ;',
          'Ne pas déranger les autres élèves et vivre en harmonie avec eux ;',
          'Être respectueux envers les enseignants ;',
          'En plus de ces règles, les enseignants pourront établir avec leurs élèves d’autres règles propres à leur classe.'
        ]
      },
      closing: 'Le responsable du cours informe les élèves et leurs parents, au moyen de l’un des outils de communication disponibles, des règles ci-dessus et des mesures disciplinaires auxquelles ils peuvent être confrontés en cas de non-respect.'
    }
  };

  // Kaynaklar: Ville de Marche-en-Famenne ve ecolescommunales.marche.be;
  // ELMA; ARMBB; Durbuy, Hotton, Rendeux, Nassogne, Somme-Leuze ve
  // Tenneville belediye/eğitim sayfaları. Doğrulanmayan yerleşim okulları eklenmedi.
  app.schools = {
    fundamental: [
      'ARMBB – Section fondamentale (Barvaux-sur-Ourthe)',
      'ARMBB – Section fondamentale (Bomal-sur-Ourthe)',
      'ARMBB – Section fondamentale (Marche-en-Famenne)',
      'École communale de Ambly (Nassogne)',
      'École communale de Aye',
      'École communale de Bande (Nassogne)',
      'École communale de Barvaux-sur-Ourthe (Durbuy)',
      'École communale de Bomal-sur-Ourthe (Durbuy)',
      'École communale de Borlon (Durbuy)',
      'École communale de Champlon (Tenneville)',
      'École communale de Forrières (Nassogne)',
      'École communale de Grune (Nassogne)',
      'École communale de Hampteau (Hotton)',
      'École communale de Hargimont',
      'École communale de Heyd (Durbuy)',
      'École communale de Hollogne',
      'École communale de Hotton',
      'École communale de Humain',
      'École communale de Izier (Durbuy)',
      'École communale de Nassogne',
      'École communale de On',
      'École communale de Petithan (Durbuy)',
      'École communale de Rendeux',
      'École communale de Somme-Leuze – implantation de Bonsin',
      'École communale de Somme-Leuze – implantation de Heure',
      'École communale de Somme-Leuze – implantation de Noiseux',
      'École communale de Somme-Leuze – implantation de Somme-Leuze',
      'École communale de Tenneville',
      'École communale de Tohogne (Durbuy)',
      'École communale de Waha',
      'École Enrico Macias (Hotton)',
      'École fondamentale libre de Bourdon (Hotton)',
      'École fondamentale libre de Nassogne',
      'École fondamentale libre de On',
      'École fondamentale libre Hotton-Melreux – implantation de Hotton',
      'École fondamentale libre Hotton-Melreux – implantation de Melreux',
      'École libre « La P’tite École » (Rendeux)',
      'École libre Saint-Antoine (Marloie)',
      'École libre Saint-Martin (Marche-en-Famenne)',
      'École libre Saint-Remacle (Aye)',
      'Institut médico-pédagogique de Marloie – primaire spécialisé',
      'Institut Notre-Dame – fondamental (Marche-en-Famenne)'
    ],
    secondary: [
      'ARMBB – enseignement secondaire (Bomal-sur-Ourthe)',
      'ARMBB – enseignement secondaire (Marche-en-Famenne)',
      'CEFA – Marche-en-Famenne',
      'Institut d’enseignement spécialisé de Marloie',
      'Institut du Sacré-Cœur (Barvaux-sur-Ourthe)',
      'Institut Saint-Laurent (Marche-en-Famenne)',
      'Institut Saint-Roch (Marche-en-Famenne)',
      'Institut Sainte-Julie (Marche-en-Famenne)'
    ]
  };
}());
