// src/lib/i18n/tr.ts — Turkish UI Strings

export const TR: Record<string, string> = {
  "search.loading": "Arama Yapılıyor...",
  "search.results_count": "{n} Kanun Alındı",
  "search.empty":
    "Kanun bulunamadı arama parametrelerine uygun kriterlere göre.",
  "search.error": "Arama sonuçlarını çekme sırasında hata oluştu.",
  "search.placeholder": "Almanya Kanunlarını Ara...",
  "search.no_results": "Sonuç bulunamadı",
  "search.awaiting": "Sorumuzunu Bekliyor...",
  "search.init": "Arama Ortamını Başlatılıyor...",

  "laws.loading": "Kanun Çözümleniyor...",
  "laws.not_found": "Bulunamadı ya da yüklenemedi.",
  "laws.norms_empty":
    "Hukuk Kuralları şu anda neural hatayı indexleme sırasında bulunmuyor.",

  "guidance.loading": "Durumu Tespit Ediliyor...",
  "guidance.title": "Hukuk Rehberlik",
  "guidance.describe": "Situasyonunuzu Açıklayın",
  "guidance.analyze": "Tespit Et",
  "guidance.history": "Tarih",
  "common.error": "İşlem Hatası",

  "nav.sign_in": "Giriş Yap",
  "nav.sign_out": "Çıkış Yap",
  "nav.search": "Arama",
  "nav.guidance": "Rehberlik",
  "nav.bookmarks": "Yer İmleri",
  "nav.chat": "Sohbet",
  "nav.settings": "Ayarlar",
  "nav.laws": "Kanunlar",
  "nav.api_docs": "API Belgeleri",

  "footer.tagline": "Sub lege libertas",
  "footer.copyright":
    "© 2026 Almanya Kanun Deposu — Hukuki Intellijen Deposu",

  "auth.title": "Hoş Geldiniz",
  "auth.email": "E-posta",
  "auth.password": "Şifre",
  "auth.sign_in_button": "Giriş Yap",
  "auth.sign_up_button": "Hesap Oluştur",
  "auth.no_account": "Hesabınız yok mu?",
  "auth.has_account": "Zaten bir hesabınız var mı?",
  "auth.error_prefix": "Hata",

  "chat.title": "Hukuk Danışmanı",
  "chat.placeholder": "Situasyonunuzu açıklayın...",
  "chat.send": "Gönder",
  "chat.settings": "Ayarlar",
  "chat.local_offline": "Yerel Node Kapalı",
  "chat.startup_hint":
    "Yerel Ollama ve brokeri başlatın, tamamen yerel AI modunu etkinleştirmek için.",
  "chat.mode_basic": "Temel",
  "chat.mode_browser": "Tarayıcı",
  "chat.mode_cloud": "Bulut",
  "chat.mode_local": "Yerel",

  "bookmarks.title": "İmlerim",
  "bookmarks.empty": "Henüz im yok",
  "bookmarks.new_folder": "Yeni Klasör",
  "bookmarks.delete_folder": "Klasör Sil",

  "settings.title": "Ayarlar",
  "settings.api_key": "API Anahtarı",
  "settings.save": "Kaydet",
  "settings.remove": "Sil",
  "settings.provider": "Hukuki Sağlayıcısı",
  "settings.model": "Model",

  "onboarding.banner_text":
    "2 dakika içinde AI danışmanınızı ve dilini ayarlayın",
  "onboarding.start": "Kurulumu Başlat",
  "onboarding.dismiss": "Sonra",
  "onboarding.welcome_title": "Hoş Geldiniz Almanya Kanun Deposuna",
  "onboarding.select_language":
    "Arabirim Dili Seç",
  "onboarding.continue": "Devam Et",
  "onboarding.step_language": "Dil",
  "onboarding.step_mode": "AI Modu",
  "onboarding.step_setup": "Yapılandırma",
  "onboarding.step_features": "Özellikler",
  "onboarding.step_complete": "Tamamlandı",
  "onboarding.api_key_q":
    "OpenAI ya da Anthropic için bir API anahtarınız var mı?",
  "onboarding.yes": "Evet",
  "onboarding.no": "Hayır",
  "onboarding.browser_q":
    "Kanunu tarayıcıda tamamen çalışmasını istiyor musunuz?",
  "onboarding.ollama_q": "Ollama yazılımınız var mı?",
  "onboarding.recommend_cloud":
    "Bulut AI — en iyi kalite, sizin kendi anahtarınızla",
  "onboarding.recommend_browser":
    "Tarayıcı AI — tamamen gizli, tarayıcıda çalışır (~1GB indirme)",
  "onboarding.recommend_local": "Yerel AI — yerel, Ollama kullanır",
  "onboarding.recommend_basic": "Temel Arama — hukuki, doğrudan kanun arama",
  "onboarding.feature_title": "Neler Yapabilirsiniz",
  "onboarding.feature_search": "6000'den fazla kanunu elinde",
  "onboarding.feature_chat": "Hukuki danışmanı",
  "onboarding.feature_guidance": "Situasyonunuz için sonuç yolları",
  "onboarding.feature_translation": "Kanunlarınızı dilinize çevirme",
  "onboarding.feature_bookmarks": "Kanunları kaydet ve sırala",
  "onboarding.complete_title": "Tamamlandı",
  "onboarding.complete_desc":
    "Preferanslarınız kaydedildi. Almanya kanunlarına başlayın.",
  "onboarding.start_app": "Uygulamayı Başlat",
  "onboarding.restart": "Yeniden Başlat",
  "onboarding.resume": "Devam Edin",
  "onboarding.view_guide": "Kurulum Kılavuzunu Gör",
  "onboarding.completed_on":
    "Zaman: {date} tarihinde kurulumu tamamladınız.",
  "onboarding.back": "Geri",
  "onboarding.skip_config": "Yapılandırmayı Atla",
  "onboarding.welcome_desc":
    "AI destekli arama, çeviri ve 9 dilde hukuki rehberlik ile 6.000'den fazla Alman federal kanununa açılan kapınız.",
  "onboarding.mode_select_title": "AI Modunuzu Seçin",
  "onboarding.mode_select_desc":
    "Alman kanunlarıyla nasıl etkileşime geçmek istediğinizi seçin. Bunu istediğiniz zaman Ayarlar'dan değiştirebilirsiniz.",
  "onboarding.config_title": "{mode} Yapılandır",
  "onboarding.config_desc":
    "Başlamadan önce {mode} bağlantınızı kurun.",
  "onboarding.config_cloud":
    "OpenAI, Anthropic veya uyumlu API anahtarınızı girin. Anahtarınız şifrelenir ve sunucumuzda güvenle saklanır.",
  "onboarding.config_local":
    "Makinenizdeki Ollama'ya bağlanın. Broker aşağıdaki URL'de veya Ollama doğrudan 11434 portunda çalışır.",
  "onboarding.config_browser":
    "Tarayıcı AI, bir Qwen3-0.6B modelini (~570MB indirme) tamamen tarayıcınızda Web Workers aracılığıyla çalıştırır. Tamamen gizli — verileriniz makinenizden çıkmaz.",
  "onboarding.config_basic":
    "Kurulum gerekmez. 6.000'den fazla kanunu arayın ve alıntıları doğrudan okuyun. Çeviriler, Tarayıcı AI ile aynı tarayıcı modelini kullanır.",
  "onboarding.api_key_placeholder": "sk-...",
  "onboarding.paste": "Yapıştır",
  "onboarding.test_connection": "Bağlantıyı Test Et",
  "onboarding.cloud_key_note":
    "Anahtar şifrelenir ve sunucuda saklanır. Üçüncü taraflara asla iletilmez.",
  "onboarding.local_broker_label": "Broker URL'si",
  "onboarding.local_model_label": "Model",
  "onboarding.local_status_checking": "Kontrol ediliyor...",
  "onboarding.local_status_connected": "Bağlı",
  "onboarding.local_status_offline":
    "Çevrimdışı — Ollama'nın çalıştığından emin olun",
  "onboarding.summary_title": "Kurulum Özetiniz",
  "onboarding.summary_desc":
    "Alman kanunlarını keşfetmeye hazırsınız. İşte yapılandırmanız.",
  "onboarding.mode_local": "Yerel AI",
  "onboarding.mode_cloud": "Bulut AI",
  "onboarding.mode_browser": "Tarayıcı AI",
  "onboarding.mode_basic": "Temel Arama",
  "onboarding.mode_local_detail":
    "İki model: tam hukuki analiz için 'german-legal' (6.6GB) ve hızlı çeviriler için 'qwen2.5:1.5b-translate' (1GB). Tamamen çevrimdışı.",
  "onboarding.mode_cloud_detail":
    "Kendi API anahtarınızı getirin (OpenAI, Anthropic). En iyi kalite ve en hızlı yanıtlar. Faturalandırmayı siz kontrol edersiniz.",
  "onboarding.mode_browser_detail":
    "Qwen3-0.6B'yi tarayıcınızda çalıştırır (~570MB indirme). Tamamen gizli — hiçbir veri makinenizden çıkmaz. 9 dilin tamamı.",
  "onboarding.mode_basic_detail":
    "6.000'den fazla kanunu arayın ve alıntıları doğrudan okuyun. AI üretimi yok — sonuçları siz yorumlarsınız. Her zaman kullanılabilir, kurulum gerektirmez.",

  "gate.sign_in": "Giriş Yapma İçin Oturum Açın",
  "gate.api_key":
    "Ayarlar'da API anahtarı ayarlayın bu özellik için kullanılabilmesi için.",
  "gate.ai_mode":
    "Ayarlar'da AI modunu açın bu özellik için etkinleştirilmesi için.",
  "gate.broker": "Yerel brokeri başlatma, yerel AI'yi etkinleştirmek için.",

  "home.tagline": "Bundesrepublik Deutschland",
  "home.title": "Kanun Deposu",
  "home.subtitle":
    "6.000'den fazla Alman federal kanununun kapsamlı bir arşivi.",
  "home.categories": "Kategoriler",
  "home.mode_basic": "Temel Arama",
  "home.mode_basic_desc":
    "6.000'den fazla kanunda arama yapın ve özetleri doğrudan okuyun. Yapay zeka yok — sonuçları siz yorumlarsınız.",
  "home.mode_browser": "Tarayıcı Yapay Zekası",
  "home.mode_browser_desc":
    "Yapay zeka, Qwen3 aracılığıyla tamamen tarayıcınızda çalışır. Tamamen gizli, sunucu çağrısı yok. ~1GB indirme.",
  "home.mode_cloud": "Bulut Yapay Zekası",
  "home.mode_cloud_desc":
    "Kendi OpenAI/Anthropic anahtarınızı getirin. En iyi kalite, en hızlı yanıt. Faturalandırmayı siz kontrol edersiniz.",
  "home.mode_local": "Yerel Yapay Zeka",
  "home.mode_local_desc":
    "Yerel broker aracılığıyla makinenizdeki Ollama'ya bağlanın. Tamamen çevrimdışı, ağınızdan hiçbir veri çıkmaz.",
  "home.get_started": "Başlayın",

  /* ── Search Bar strings ── */
  "search_bar.mode_search": "Kanun Arama",
  "search_bar.mode_analyze": "AI Analizi",

  /* ── Guidance page strings ── */
  "guidance.page_title": "Hukuki Rehberlik",
  "guidance.page_subtitle": "Durumunuzu Yönetin",
  "guidance.folder_label": "Dava Klasörü (İsteğe Bağlı)",
  "guidance.loading_folder": "Yükleniyor...",
  "guidance.no_folder": "Seçilen Klasör Yok",
  "guidance.situation_label": "Durumunuzu Açıklayın",
  "guidance.situation_placeholder":
    "Hukuki durumunuzu ayrıntılı olarak açıklayın. İlgili gerçekleri, tarihleri, ilgili tarafları ve daha önce yaptığınız işlemleri ekleyin. Almanca, İngilizce, Türkçe, Arapça, Fransızca, İspanyolca, Lehçe, Ukraynaca veya Rusça dahil herhangi bir dilde yazabilirsiniz.",
  "guidance.situation_hint":
    "AI, Alman federal kanunlarını yer imleriniz ve klasör bağlamınızla çapraz referans alır.",
  "guidance.analyzing": "Durumunuz Analiz Ediliyor...",
  "guidance.submit": "Rehberlik Al",
  "guidance.error_title": "Rehberlik Oluşturma Başarısız",
  "guidance.error_retry": "Tekrar Dene",
  "guidance.empty_title": "Hukuki Rehberlik",
  "guidance.empty_desc":
    "Yukarıda durumunuzu açıklayın; AI, 6.000'den fazla Alman federal kanununu analiz edecek, yer imleriniz ve dava klasörlerinizle çapraz referans yapacak ve risk değerlendirmesi, maliyet tahminleri ve adım adım yapılacaklarla birlikte 3-5 somut sonuç yolu döndürecektir.",
  "guidance.empty_feature_risk": "Risk Rozetleri",
  "guidance.empty_feature_cost": "Maliyet Tahminleri",
  "guidance.empty_feature_laws": "Atıf Yapılan Kanunlar",
  "guidance.empty_feature_docs": "Belge Oluşturma",
  "guidance.success_hint":
    "Bunlar Alman hukukuna göre olası ilerleme yollarıdır. Her yolun farklı riskleri, maliyetleri ve zaman çizelgeleri vardır. Bir yolu genişletmek ve adım adım talimatları görmek için tıklayın. Herhangi bir seçeneğe bağlı değilsiniz — bu sadece seçeneklerinizi anlamanıza yardımcı olmak içindir.",
  "guidance.your_paths": "Olası İlerleme Yollarınız",
  "guidance.cost_breakdown": "Maliyet Dökümü",
  "guidance.paths_shown": "{n}/5 yol gösteriliyor",
  "guidance.est_cost": "Tahmini Maliyet",
  "guidance.cost_court_fees": "Mahkeme Ücretleri (GKG)",
  "guidance.cost_lawyer_fees": "Avukatlık Ücretleri (RVG)",
  "guidance.cost_total_risk": "Toplam Risk (kaybederseniz)",
  "guidance.cost_basis":
    "{n} € Streitwert üzerinden hesaplanmıştır (RVG/GKG basitleştirilmiş hesaplama). Gerçek maliyetler değişebilir.",
  "guidance.cited_laws": "Kullanılan İlgili Kanunlar",
  "guidance.cited_click": "Bir kanuna tıklayarak tam metnini okuyun",
  "guidance.gen_doc": "Taslak Belge Oluştur",
  "guidance.gen_doc_progress": "Belge Oluşturuluyor...",
  "guidance.gen_doc_disclaimer":
    "Bu, durumunuza göre hazırlanmış bir taslaktır. Resmi olarak kullanmadan önce bir avukata (Rechtsanwalt) inceletin.",
  "guidance.detailed_analysis": "Detaylı Analiz",
  "guidance.step_plan": "Adım Adım Plan",
  "guidance.quick_tip": "Hızlı İpucu",
  "guidance.risk_hint": "Nedeni: {reason}",
  "guidance.remember":
    "Bu rehberlik yalnızca bilgilendirme amaçlıdır. Spesifik hukuki tavsiye için lisanslı bir Alman avukatına (Rechtsanwalt) danışın.",
  "guidance.save_archives": "İlgili kanunları Arşivinize kaydedin",
  "guidance.gen_doc_require_folder":
    "Belge oluşturmak için önce bir dava klasörü oluşturun.",
  "guidance.gen_doc_require_folder_desc":
    "Yukarıdaki açılır menüden bir klasör seçin veya oluşturun, ardından tekrar deneyin.",

  /* ── Risk / probability / timeline labels ── */
  "guidance.risk_low": "Muhtemelen Olumlu — Düşük Risk",
  "guidance.risk_medium": "Belirsiz — Orta Risk",
  "guidance.risk_high": "Önemli Engeller — Yüksek Risk",
  "guidance.risk_hint_low":
    "Bu yolun sizin için iyi sonuçlanma şansı yüksek. Kanun sizden yana ve maliyetler yönetilebilir.",
  "guidance.risk_hint_medium":
    "Bu yol her iki tarafa da gidebilir. Hesaplanmış bir risk olarak düşünün — her iki tarafta da iyi argümanlar var. Bir avukat gerçek şansınızı değerlendirmenize yardımcı olabilir.",
  "guidance.risk_hint_high":
    "Bu yol zorlu bir mücadele. Kanun veya gerçekler kazanmayı zorlaştırıyor. Bu yola girmeden önce profesyonel hukuki tavsiye alın.",
  "guidance.prob_very_promising": "Çok Umut Verici",
  "guidance.prob_promising": "Umut Verici",
  "guidance.prob_uncertain": "Belirsiz",
  "guidance.prob_difficult": "Zor",
  "guidance.prob_very_difficult": "Çok Zor",
  "guidance.timeline_2_6_weeks":
    "Bu oldukça hızlı. Alman hukukunda, mahkeme dışı adımlar genellikle bu hızda ilerler.",
  "guidance.timeline_3_12_months":
    "Mahkeme davaları Almanya'da zaman alır. Endişelenmeyin — çoğu dava duruşmadan önce sonuçlanır.",
  "guidance.timeline_1_4_weeks":
    "Bu çok hızlı. Mahkemeler yalnızca acil durumlar (Eilverfahren) için hızlı hareket eder.",
  "guidance.timeline_fallback":
    "Alman hukuki süreçlerinde zaman çizelgeleri değişir. Bir avukat size özel durumunuz için daha kesin bir tahmin verebilir.",

  /* ── Guidance history page strings ── */
  "guidance_history.title": "Rehberlik Geçmişi",
  "guidance_history.subtitle": "Vaka Analizi",
  "guidance_history.count": "{n} Oturum",
  "guidance_history.sign_in_title": "Giriş Gerekli",
  "guidance_history.sign_in_desc":
    "Rehberlik geçmişinizi görüntülemek için giriş yapın. Oturumlar, giriş yaparken vaka analizi çalıştırdığınızda otomatik olarak kaydedilir.",
  "guidance_history.sign_in_btn": "Giriş Yap",
  "guidance_history.loading": "Oturumlar Yükleniyor",
  "guidance_history.empty_title": "Henüz Rehberlik Oturumu Yok",
  "guidance_history.empty_desc":
    "Hukuki durumunuzu açıklayın ve AI 3-5 olası sonuç yolu oluşturacaktır. Giriş yaptığınızda oturumlar otomatik olarak kaydedilir.",
  "guidance_history.empty_cta": "Bir Durumu Analiz Et",
  "guidance_history.delete": "Oturumu Sil",
  "guidance_history.deleting": "Siliniyor...",
  "guidance_history.previous": "Önceki",
  "guidance_history.next": "Sonraki",
  "guidance_history.page_info": "Sayfa {current} / {total}",
  "guidance_history.untitled": "İsimsiz Oturum",
  "guidance_history.incident": "Olay: {date}",
  "guidance_history.path": "Yol {n}: {title}",
  "guidance_history.confirm_delete":
    "Bu rehberlik oturumunu ve tüm sonuç yollarını silmek istediğinize emin misiniz?",

  /* ── Chat page strings ── */
  "chat.limitation_basic":
    "Temel Arama — kanunları arar ve ilgili alıntıları gösterir. AI analizi yok.",
  "chat.limitation_browser":
    "Tarayıcı AI — ilk kullanımda ~1GB model indirir. Tamamen gizli.",
  "chat.limitation_cloud":
    "Bulut AI — kendi API anahtarınızı kullanır. Sağlayıcınız tarafından faturalandırılırsınız.",
  "chat.limitation_local":
    "Yerel AI — yalnızca broker.py ve Ollama makinenizde çalışırken kullanılabilir.",
  "chat.conversations": "Konuşmalar",
  "chat.new_conversation": "Yeni Konuşma",
  "chat.type_message": "Hukuki sorunuzu yazın...",
  "chat.config_hint":
    "Bu özelliği kullanmak için lütfen AI ayarlarınızı yapılandırın.",

  /* ── Folder modal strings ── */
  "folder.title": "Yeni Dava Klasörü",
  "folder.edit_title": "Dava Klasörünü Düzenle",
  "folder.name_label": "Klasör Adı",
  "folder.name_placeholder": "Örn: Haksız Fesih Davası",
  "folder.desc_label": "Açıklama",
  "folder.desc_placeholder": "Vakanın kısa açıklaması",
  "folder.category_label": "Kategori",
  "folder.status_label": "Durum",
  "folder.incident_date": "Olay Tarihi",
  "folder.incident_hint": "AI bu tarihten itibaren son tarihleri hesaplar",
  "folder.deadline_date": "Son Tarih",
  "folder.deadline_hint": "AI bu son tarih yaklaştığında uyarır",
  "folder.dispute_value": "Uyuşmazlık Değeri (Streitwert) — EUR",
  "folder.dispute_hint": "Maliyet tahmini için kullanılır (RVG/GKG)",
  "folder.opposing_party": "Karşı Taraf",
  "folder.opposing_hint":
    "AI belirli korumaları kontrol eder (KSchG, BDSG, vb.)",
  "folder.opposing_placeholder": "Örn: İşveren, Ev Sahibi",
  "folder.court_name": "Mahkeme Adı",
  "folder.court_placeholder": "Örn: Arbeitsgericht Berlin",
  "folder.case_number": "Dava Numarası (Aktenzeichen)",
  "folder.case_placeholder": "Örn: 5 Ca 1234/24",
  "folder.notes_label": "Notlar (AI Bağlamı)",
  "folder.notes_placeholder":
    "Vakanız hakkında ek bağlam ekleyin. AI, rehberlik oluştururken bunu okur.",
  "folder.notes_hint":
    "Serbest metin bağlamı — AI, rehberlik yolları oluştururken bunu okur",
  "folder.cancel": "İptal",
  "folder.save": "Klasörü Kaydet",
  "folder.saving": "Kaydediliyor...",
  "folder.name_required": "Klasör adı gereklidir.",
  "folder.save_error": "Klasör kaydedilemedi",
  "folder.basic_info": "Temel Bilgiler",
  "folder.timeline_value": "Zaman Çizelgesi ve Değer",
  "folder.parties_court": "Taraflar ve Mahkeme",

  /* ── Norm viewer strings ── */
  "norm.section": "Bölüm {id}",
  "norm.translating_browser": "Tarayıcı AI ile çevriliyor…",
  "norm.translating_cloud": "Bulut AI ile çevriliyor…",
  "norm.translating_local": "Yerel AI ile çevriliyor…",
  "norm.translating": "Çevriliyor…",
  "norm.german_original": "Almanca Orijinal",
  "norm.translation_unavailable":
    "Çeviri mevcut değil — Ayarlar'da AI yapılandırın",
  "norm.translated_to": "{lang} diline çevrildi",
  "norm.show_translation": "Çeviriyi Göster",
  "norm.show_german": "Orijinal Almancayı Göster",
  "norm.analyzing": "Kanun Analiz Ediliyor...",
  "norm.translate": "{lang} diline çevir",
  "norm.gate_translate":
    "Kanunları çevirmek için Ayarlar'da bir AI moduna geçin",
  "norm.translation_official": "Resmi Çeviri",
  "norm.translation_ai": "AI Çevirisi",
  "norm.content_summary": "Özet",
  "norm.content_context": "Bağlam",
  "norm.content_steps": "Adımlar",
  "norm.disclaimer":
    "Kasa İstihbaratı — Ön Bağlayıcı Olmayan Rapor",

  /* ── Law detail page strings ── */
  "law_detail.back": "Geri",
  "law_detail.key_badge": "{key}",
  "law_detail.status": "Durum",
  "law_detail.authority": "Yetki",
  "law_detail.modified": "Değiştirilme",
  "law_detail.density": "Yoğunluk",
  "law_detail.sections": "{n} Bölüm",
  "law_detail.framework": "Yasal Çerçeve",
  "law_detail.save": "Kaydet",
  "law_detail.saved": "Kaydedildi",
  "law_detail.save_anon":
    "Yer işareti yerel olarak kaydedildi. Cihazlar arasında senkronize etmek için giriş yapın.",
  "law_detail.archive_entry": "Arşiv girişi kaldırıldı",
  "law_detail.loading": "Kanun Çözülüyor...",
};
