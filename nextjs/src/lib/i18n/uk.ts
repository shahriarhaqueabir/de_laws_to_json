// src/lib/i18n/uk.ts — Ukrainian UI Strings

export const UK: Record<string, string> = {
  "search.loading": "Шукаємо...",
  "search.results_count": "{n} закони Отримано",
  "search.empty":
    "Не знайдено жодного закону, який відповідав параметрам пошуку.",
  "search.error": "Помилка при отриманні результатів пошуку.",
  "search.placeholder": "Шукати німецькі закони...",
  "search.no_results": "Результати не знайдені",
  "search.awaiting": "Очікуємо вказівки",
  "search.init": "Ініціалізація середовища пошуку...",
  "laws.loading": "Дешифрування закону...",
  "laws.not_found": "Закон не знайдений або не вдалося його завантажити.",
  "laws.norms_empty": "Фрагменти законів не індексовані в нейронній пам'яті.",
  "guidance.loading": "Аналізуємо ситуацію...",
  "guidance.title": "Юридична консультація",
  "guidance.describe": "Опишіть свою ситуацію",
  "guidance.analyze": "Аналізувати",
  "guidance.no_folder": "Не вибрано папки",
  "guidance.history": "Історія",
  "common.error": "Помилка роботи",
  "nav.sign_in": "Увійти",
  "nav.sign_out": "Вийти",
  "nav.search": "Пошук",
  "nav.guidance": "Консультація",
  "nav.bookmarks": "Збереження",
  "nav.chat": "Рада",
  "nav.settings": "Налаштування",
  "nav.laws": "Закони",
  "nav.api_docs": "Документація API",
  "footer.tagline": "Під законом — свобода",
  "footer.copyright":
    "© 2026 Німецький Законний Ваулт — Офіційний Репозиторій Юридичної Інтелектуальної Бази",
  "auth.title": "Вітаємо",
  "auth.email": "Електронна пошта",
  "auth.password": "Пароль",
  "auth.sign_in_button": "Увійти",
  "auth.sign_up_button": "Створити обліковий запис",
  "auth.no_account": "Не маєте облікового запису?",
  "auth.has_account": "Маєте вже обліковий запис?",
  "auth.error_prefix": "Помилка",
  "chat.title": "Юридична Рада",
  "chat.placeholder": "Опишіть свою ситуацію...",
  "chat.send": "Відправити",
  "chat.settings": "Налаштування",
  "chat.local_offline": "Локальна Оффлайн-нода",
  "chat.startup_hint":
    "Запустіть свій локальний Ollama і брукер, щоб увімкнути повністю оффлайн режим штучного інтелекту",
  "chat.mode_basic": "Базовий",
  "chat.mode_browser": "Веб-браузер",
  "chat.mode_cloud": "Хмара",
  "chat.mode_local": "Локальний",
  "bookmarks.title": "Мій Збереження",
  "bookmarks.empty": "Немає збережень ще",
  "bookmarks.new_folder": "Нова папка",
  "bookmarks.delete_folder": "Видалити папку",
  "settings.title": "Налаштування",
  "settings.api_key": "Ключ API",
  "settings.save": "Зберегти",
  "settings.remove": "Видалити",
  "settings.provider": "Провайдер штучного інтелекту",
  "settings.model": "Модель",
  "onboarding.banner_text":
    "Налаштуйте свій штучний юрист і мову інтерфейсу за 2 хвилини",
  "onboarding.start": "Почати налаштування",
  "onboarding.dismiss": "Можливо пізніше",
  "onboarding.welcome_title": "Вітаємо у Німецькому Законному Ваулті",
  "onboarding.select_language": "Оберіть свою улюблену мову інтерфейсу",
  "onboarding.continue": "Продовжити",
  "onboarding.step_language": "Мова",
  "onboarding.step_mode": "Режим штучного інтелекту",
  "onboarding.step_setup": "Налаштування",
  "onboarding.step_features": "Особливості",
  "onboarding.step_complete": "Ви всі налаштовані",
  "onboarding.api_key_q": "Маєте ліцензію API для OpenAI або Anthropic?",
  "onboarding.yes": "Так",
  "onboarding.no": "Ні",
  "onboarding.browser_q":
    "Хочете, щоб штучний інтелект працював повністю у вашому браузері?",
  "onboarding.ollama_q": "Маєте встановлений Ollama на своєму комп'ютері?",
  "onboarding.recommend_cloud":
    "Хмарний штучний інтелект — найкраща якість, приведіть свій ключ",
  "onboarding.recommend_browser":
    "Веб-браузерний штучний інтелект — повністю приватний, працює в браузері (~1GB завантаження)",
  "onboarding.recommend_local":
    "Локальний штучний інтелект — оффлайн, використовує ваш локальний Ollama",
  "onboarding.recommend_basic":
    "Базовий пошук — без штучного інтелекту, безпосередній пошук законів",
  "onboarding.feature_title": "Що ви можете зробити",
  "onboarding.feature_search":
    "Пошук 6,000+ німецьких законів на вашому пальці",
  "onboarding.feature_chat": "Юридичний радник",
  "onboarding.feature_guidance": "Шляхи вирішення для вашої ситуації",
  "onboarding.feature_translation": "Закони перекладені вашою мовою",
  "onboarding.feature_bookmarks": "Збереження і організація законів",
  "onboarding.complete_title": "Ви всі налаштовані",
  "onboarding.complete_desc":
    "Ваші налаштування збережені. Почайте експлуатацію німецького закону.",
  "onboarding.start_app": "Почати використовувати програму",
  "onboarding.restart": "Повторити налаштування",
  "onboarding.resume": "Продовжити, де ви залишилися",
  "onboarding.view_guide": "Подивитись навчальний посібник",
  "onboarding.completed_on": "Ви налаштували програму {date}",
  "onboarding.back": "Назад",
  "onboarding.skip_config": "Пропустити налаштування",
  "onboarding.welcome_desc":
    "Ваш шлюз до понад 6000 німецьких федеральних законів із пошуком на основі ШІ, перекладом та юридичними консультаціями 9 мовами.",
  "onboarding.mode_select_title": "Виберіть режим ШІ",
  "onboarding.mode_select_desc":
    "Оберіть, як ви хочете взаємодіяти з німецьким законодавством. Це можна змінити в будь-який час у Налаштуваннях.",
  "onboarding.config_title": "Налаштувати {mode}",
  "onboarding.config_desc":
    "Налаштуйте підключення {mode} перед початком роботи.",
  "onboarding.config_cloud":
    "Введіть ключ API OpenAI, Anthropic або сумісний. Ваш ключ шифрується та безпечно зберігається на нашому сервері.",
  "onboarding.config_local":
    "Підключіться до Ollama на вашому комп'ютері. Брокер працює за URL нижче, або Ollama безпосередньо на порту 11434.",
  "onboarding.config_browser":
    "Браузерний ШІ запускає модель Qwen3-0.6B (~570MB завантаження) повністю у вашому браузері через Web Workers. Повністю приватно — жодні дані не покидають ваш пристрій.",
  "onboarding.config_basic":
    "Налаштування не потрібне. Шукайте всі 6000+ законів і читайте уривки безпосередньо. Переклади використовують ту ж браузерну модель, що й Браузерний ШІ.",
  "onboarding.api_key_placeholder": "sk-...",
  "onboarding.paste": "Вставити",
  "onboarding.test_connection": "Перевірити з'єднання",
  "onboarding.cloud_key_note":
    "Ключ шифрується і зберігається на сервері. Ніколи не передається третім особам.",
  "onboarding.local_broker_label": "URL брокера",
  "onboarding.local_model_label": "Модель",
  "onboarding.local_status_checking": "Перевірка...",
  "onboarding.local_status_connected": "Підключено",
  "onboarding.local_status_offline":
    "Офлайн — переконайтеся, що Ollama запущено",
  "onboarding.summary_title": "Підсумок налаштувань",
  "onboarding.summary_desc":
    "Ви готові досліджувати німецьке законодавство. Ось ваша конфігурація.",
  "onboarding.mode_local": "Локальний ШІ",
  "onboarding.mode_cloud": "Хмарний ШІ",
  "onboarding.mode_browser": "Браузерний ШІ",
  "onboarding.mode_basic": "Базовий пошук",
  "onboarding.mode_local_detail":
    "Дві моделі: 'german-legal' (6.6GB) для повного юридичного аналізу та 'qwen2.5:1.5b-translate' (1GB) для швидких перекладів. Повністю офлайн.",
  "onboarding.mode_cloud_detail":
    "Використовуйте власний ключ API (OpenAI, Anthropic). Найкраща якість і найшвидші відповіді. Ви контролюєте оплату.",
  "onboarding.mode_browser_detail":
    "Запускає Qwen3-0.6B у вашому браузері (~570MB завантаження). Повністю приватно — жодні дані не покидають ваш пристрій. Всі 9 мов.",
  "onboarding.mode_basic_detail":
    "Шукайте 6000+ законів і читайте уривки безпосередньо. Без генерації ШІ — ви інтерпретуєте результати. Завжди доступно, без налаштувань.",
  "gate.sign_in": "Увійти, щоб використовувати цю функцію",
  "gate.api_key":
    "Налаштуйте ключ API в налаштуваннях, щоб використовувати цю функцію",
  "gate.ai_mode":
    "Перевірте режим штучного інтелекту в налаштуваннях, щоб увімкнути цю функцію",
  "gate.broker":
    "Запустіть свій локальний брукер, щоб увімкнути оффлайн режим штучного інтелекту",

  "home.tagline": "Bundesrepublik Deutschland",
  "home.title": "Сховище Законів",
  "home.subtitle": "Комплексний репозиторій понад 6000 федеральних законів Німеччини.",
  "home.categories": "Категорії",
  "home.mode_basic": "Базовий Пошук",
  "home.mode_basic_desc":
    "Шукайте серед 6000+ законів і читайте уривки напряму. Без ШІ — ви самі інтерпретуєте результати.",
  "home.mode_browser": "ШІ в Браузері",
  "home.mode_browser_desc":
    "ШІ працює повністю у вашому браузері через Qwen3. Повна приватність, жодних серверних викликів. Завантаження ~1 ГБ.",
  "home.mode_cloud": "Хмарний ШІ",
  "home.mode_cloud_desc":
    "Використовуйте свій власний ключ OpenAI/Anthropic. Найкраща якість, найшвидша відповідь. Ви самі контролюєте витрати.",
  "home.mode_local": "Локальний ШІ",
  "home.mode_local_desc":
    "Підключайтеся до Ollama на вашому комп'ютері через локальний брокер. Повністю офлайн, дані не покидають вашу мережу.",
  "home.get_started": "Почати",

  /* ── Search Bar strings ── */
  "search_bar.mode_search": "Пошук законів",
  "search_bar.mode_analyze": "Аналіз ШІ",

  /* ── Guidance page strings ── */
  "guidance.page_title": "Юридична консультація",
  "guidance.page_subtitle": "Розв'язання вашої ситуації",
  "guidance.folder_label": "Папка справи (необов'язково)",
  "guidance.loading_folder": "Завантаження...",
  "guidance.situation_label": "Опишіть свою ситуацію",
  "guidance.situation_placeholder":
    "Опишіть свою юридичну ситуацію детально. Включіть відповідні факти, дати, сторони та будь-які дії, які ви вже вжили. Ви можете писати будь-якою мовою — німецькою, англійською, турецькою, арабською, французькою, іспанською, польською, українською або російською.",
  "guidance.situation_hint":
    "ШІ звіряє німецькі федеральні закони з вашими закладками та контекстом папки.",
  "guidance.analyzing": "Аналізуємо вашу ситуацію...",
  "guidance.submit": "Отримати консультацію",
  "guidance.error_title": "Не вдалося створити консультацію",
  "guidance.error_retry": "Повторити",
  "guidance.empty_title": "Юридична консультація",
  "guidance.empty_desc":
    "Опишіть свою ситуацію вище, і ШІ проаналізує всі 6000+ німецьких федеральних законів, звірить їх із вашими закладками та папками справ, і поверне 3-5 конкретних шляхів вирішення з оцінкою ризиків, витрат та покроковими інструкціями.",
  "guidance.empty_feature_risk": "Індикатори ризику",
  "guidance.empty_feature_cost": "Оцінка витрат",
  "guidance.empty_feature_laws": "Посилання на закони",
  "guidance.empty_feature_docs": "Генерація документів",
  "guidance.success_hint":
    "Це можливі шляхи вирішення на основі німецького законодавства. Кожен шлях має різні ризики, витрати та терміни. Натисніть на шлях, щоб розгорнути його та побачити покрокові інструкції. Ви не обмежені жодним вибором — це лише для розуміння ваших можливостей.",
  "guidance.your_paths": "Можливі шляхи вирішення",
  "guidance.cost_breakdown": "Розрахунок витрат",
  "guidance.paths_shown": "Показано {n} з 5 шляхів",
  "guidance.est_cost": "Орієнтовна вартість",
  "guidance.cost_court_fees": "Судові збори (GKG)",
  "guidance.cost_lawyer_fees": "Гонорар адвоката (RVG)",
  "guidance.cost_total_risk": "Загальний ризик (у разі програшу)",
  "guidance.cost_basis":
    "Розрахунок на основі Streitwert у €{n} (спрощений розрахунок RVG/GKG). Фактичні витрати можуть відрізнятися.",
  "guidance.cited_laws": "Використані закони",
  "guidance.cited_click": "Натисніть на закон, щоб прочитати його повний текст",
  "guidance.gen_doc": "Створити проект документа",
  "guidance.gen_doc_progress": "Створення документа...",
  "guidance.gen_doc_disclaimer":
    "Це проект на основі вашої ситуації. Попросіть адвоката (Rechtsanwalt) перевірити його перед офіційним використанням.",
  "guidance.detailed_analysis": "Детальний аналіз",
  "guidance.step_plan": "Покроковий план",
  "guidance.quick_tip": "Швидка порада",
  "guidance.risk_hint": "Чому: {reason}",
  "guidance.remember":
    "Ця консультація призначена виключно для інформаційних цілей. Для отримання конкретної юридичної допомоги зверніться до ліцензованого німецького адвоката (Rechtsanwalt).",
  "guidance.save_archives": "Зберегти відповідні закони в архів",
  "guidance.gen_doc_require_folder":
    "Спочатку створіть папку справи, щоб згенерувати документи.",
  "guidance.gen_doc_require_folder_desc":
    "Виберіть або створіть папку зі списку вище, а потім спробуйте ще раз.",

  /* ── Risk / probability / timeline labels ── */
  "guidance.risk_low": "Ймовірно сприятливо — низький ризик",
  "guidance.risk_medium": "Невизначено — помірний ризик",
  "guidance.risk_high": "Значні перешкоди — високий ризик",
  "guidance.risk_hint_low":
    "Цей шлях має добрі шанси на успіх. Закон на вашому боці, а витрати є прийнятними.",
  "guidance.risk_hint_medium":
    "Цей шлях може піти як в один, так і в інший бік. Розглядайте це як прорахований ризик — є вагомі аргументи з обох сторін. Адвокат допоможе оцінити ваші реальні шанси.",
  "guidance.risk_hint_high":
    "Цей шлях буде важким. Закон або факти ускладнюють перемогу. Перш ніж обрати цей шлях, отримайте професійну юридичну консультацію, щоб зрозуміти, з чим ви стикаєтеся.",
  "guidance.prob_very_promising": "Дуже перспективно",
  "guidance.prob_promising": "Перспективно",
  "guidance.prob_uncertain": "Невизначено",
  "guidance.prob_difficult": "Складно",
  "guidance.prob_very_difficult": "Дуже складно",
  "guidance.timeline_2_6_weeks":
    "Це досить швидко. У німецькому праві позасудові зазвичай рухаються в такому темпі.",
  "guidance.timeline_3_12_months":
    "Судові справи в Німеччині потребують часу. Не хвилюйтеся — більшість справ вирішується до суду.",
  "guidance.timeline_1_4_weeks":
    "Це дуже швидко. Суди діють оперативно лише в термінових справах (Eilverfahren).",
  "guidance.timeline_fallback":
    "Терміни в німецькому судочинстві різняться. Адвокат може надати більш точну оцінку для вашої конкретної справи.",

  /* ── Guidance history page strings ── */
  "guidance_history.title": "Історія консультацій",
  "guidance_history.subtitle": "Аналіз справ",
  "guidance_history.count": "{n} сесій",
  "guidance_history.sign_in_title": "Необхідний вхід",
  "guidance_history.sign_in_desc":
    "Увійдіть, щоб переглянути історію консультацій. Сесії автоматично зберігаються, коли ви запускаєте аналіз справи ввійшовши в обліковий запис.",
  "guidance_history.sign_in_btn": "Увійти",
  "guidance_history.loading": "Завантаження сесій",
  "guidance_history.empty_title": "Ще не було сесій консультацій",
  "guidance_history.empty_desc":
    "Опишіть свою юридичну ситуацію, і ШІ створить 3-5 шляхів вирішення. Сесії автоматично зберігаються, коли ви ввійшли в обліковий запис.",
  "guidance_history.empty_cta": "Проаналізувати ситуацію",
  "guidance_history.delete": "Видалити сесію",
  "guidance_history.deleting": "Видалення...",
  "guidance_history.previous": "Попередня",
  "guidance_history.next": "Наступна",
  "guidance_history.page_info": "Сторінка {current} з {total}",
  "guidance_history.untitled": "Сесія без назви",
  "guidance_history.incident": "Інцидент: {date}",
  "guidance_history.path": "Шлях {n}: {title}",
  "guidance_history.confirm_delete":
    "Видалити цю сесію консультації та всі її шляхи вирішення?",

  /* ── Chat page strings ── */
  "chat.limitation_basic":
    "Базовий пошук — шукає закони та показує відповідні витяги. Без аналізу ШІ.",
  "chat.limitation_browser":
    "Браузерний ШІ — завантажує модель ~1GB при першому використанні. Повністю приватно.",
  "chat.limitation_cloud":
    "Хмарний ШІ — використовує ваш власний ключ API. Оплачуєте використання вашому провайдеру.",
  "chat.limitation_local":
    "Локальний ШІ — працює лише коли broker.py та Ollama запущені на вашому комп'ютері.",
  "chat.conversations": "Розмови",
  "chat.new_conversation": "Нова розмова",
  "chat.type_message": "Введіть ваше юридичне запитання...",
  "chat.config_hint":
    "Налаштуйте параметри ШІ, щоб використовувати цю функцію.",

  /* ── Folder modal strings ── */
  "folder.title": "Нова папка справи",
  "folder.edit_title": "Редагувати папку справи",
  "folder.name_label": "Назва папки",
  "folder.name_placeholder": "напр., Справа про незаконне звільнення",
  "folder.desc_label": "Опис",
  "folder.desc_placeholder": "Короткий опис справи",
  "folder.category_label": "Категорія",
  "folder.status_label": "Статус",
  "folder.incident_date": "Дата інциденту",
  "folder.incident_hint": "ШІ розраховує терміни від цієї дати",
  "folder.deadline_date": "Кінцевий термін",
  "folder.deadline_hint": "ШІ попереджає при наближенні цього терміну",
  "folder.dispute_value": "Сума спору (Streitwert) — EUR",
  "folder.dispute_hint": "Використовується для оцінки витрат (RVG/GKG)",
  "folder.opposing_party": "Протилежна сторона",
  "folder.opposing_hint": "ШІ перевіряє спеціальні захисти (KSchG, BDSG, тощо)",
  "folder.opposing_placeholder": "напр., Роботодавець, Орендодавець",
  "folder.court_name": "Назва суду",
  "folder.court_placeholder": "напр., Arbeitsgericht Berlin",
  "folder.case_number": "Номер справи (Aktenzeichen)",
  "folder.case_placeholder": "напр., 5 Ca 1234/24",
  "folder.notes_label": "Нотатки (контекст для ШІ)",
  "folder.notes_placeholder":
    "Додайте будь-який додатковий контекст про вашу справу. ШІ читає це під час створення консультацій.",
  "folder.notes_hint":
    "Текст вільної форми — ШІ читає це при створенні шляхів вирішення",
  "folder.cancel": "Скасувати",
  "folder.save": "Зберегти папку",
  "folder.saving": "Збереження...",
  "folder.name_required": "Назва папки обов'язкова.",
  "folder.save_error": "Не вдалося зберегти папку",
  "folder.basic_info": "Основна інформація",
  "folder.timeline_value": "Терміни та сума",
  "folder.parties_court": "Сторони та суд",

  /* ── Norm viewer strings ── */
  "norm.section": "Стаття {id}",
  "norm.translating_browser": "Переклад за допомогою браузерного ШІ…",
  "norm.translating_cloud": "Переклад за допомогою хмарного ШІ…",
  "norm.translating_local": "Переклад за допомогою локального ШІ…",
  "norm.translating": "Переклад…",
  "norm.german_original": "Німецький оригінал",
  "norm.translation_unavailable":
    "Переклад недоступний — налаштуйте ШІ в Налаштуваннях",
  "norm.translated_to": "Перекладено {lang}",
  "norm.show_translation": "Показати переклад",
  "norm.show_german": "Показати оригінал німецькою",
  "norm.analyzing": "Аналіз закону...",
  "norm.translate": "Перекласти {lang}",
  "norm.gate_translate": "Перейдіть до режиму ШІ в Налаштуваннях, щоб перекладати закони",
  "norm.translation_official": "Офіційний переклад",
  "norm.translation_ai": "Переклад ШІ",
  "norm.content_summary": "Підсумок",
  "norm.content_context": "Контекст",
  "norm.content_steps": "Кроки",
  "norm.disclaimer": "Vault Intelligence — Попередній необов'язковий звіт",

  /* ── Law detail page strings ── */
  "law_detail.back": "Назад",
  "law_detail.key_badge": "{key}",
  "law_detail.status": "Статус",
  "law_detail.authority": "Орган влади",
  "law_detail.modified": "Змінено",
  "law_detail.density": "Щільність",
  "law_detail.sections": "{n} статей",
  "law_detail.framework": "Нормативна база",
  "law_detail.save": "Зберегти",
  "law_detail.saved": "Збережено",
  "law_detail.save_anon":
    "Закладку збережено локально. Увійдіть для синхронізації між пристроями.",
  "law_detail.archive_entry": "Запис архіву видалено",
  "law_detail.loading": "Дешифрування закону...",
};
