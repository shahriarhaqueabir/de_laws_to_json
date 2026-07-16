// src/lib/i18n/es.ts — Spanish UI Strings

export const ES: Record<string, string> = {
  "search.loading": "Buscando...",
  "search.results_count": "{n} Leyes Encontradas",
  "search.empty":
    "No se encontraron leyes que coincidan con los parámetros de la búsqueda.",
  "search.error": "Error al recuperar los resultados de la búsqueda.",
  "search.placeholder": "Buscar leyes alemanas...",
  "search.no_results": "No hay resultados",
  "search.awaiting": "Esperando Información",
  "search.init": "Inicializando Entorno de Búsqueda...",
  "laws.loading": "Descifrándose Ley...",
  "laws.not_found": "Ley no encontrada o no se pudo cargar.",
  "laws.norms_empty":
    "Fragmentos de ley no están actualmente indexados en la memoria neural.",
  "guidance.loading": "Analizando Situación...",
  "guidance.title": "Orientación Legal",
  "guidance.describe": "Describe Tu Situación",
  "guidance.analyze": "Analizar",
  "guidance.no_folder": "No se ha seleccionado una carpeta",
  "guidance.history": "Historial",
  "common.error": "Error Operativo",
  "nav.sign_in": "Iniciar Sesión",
  "nav.sign_out": "Cerrar Sesión",
  "nav.search": "Buscar",
  "nav.guidance": "Orientación",
  "nav.bookmarks": "Marcadores",
  "nav.chat": "Asesor Legal",
  "nav.settings": "Ajustes",
  "nav.laws": "Leyes",
  "nav.api_docs": "Documentos de API",
  "footer.tagline": "Bajo la ley, la libertad",
  "footer.copyright":
    "© 2026 Bóveda Legal Alemana — Repositorio Oficial de Inteligencia Legal",
  "auth.title": "Bienvenido",
  "auth.email": "Correo electrónico",
  "auth.password": "Contraseña",
  "auth.sign_in_button": "Iniciar Sesión",
  "auth.sign_up_button": "Crear Cuenta",
  "auth.no_account": "No tienes una cuenta?",
  "auth.has_account": "Ya tienes una cuenta?",
  "auth.error_prefix": "Error",
  "chat.title": "Asesor Legal",
  "chat.placeholder": "Describe tu situación legal...",
  "chat.send": "Enviar",
  "chat.settings": "Ajustes",
  "chat.local_offline": "Nodo Local Sin Conexión",
  "chat.startup_hint":
    "Inicia tu Ollama y broker para habilitar el modo de AI completamente offline",
  "chat.mode_basic": "Básico",
  "chat.mode_browser": "Navegador",
  "chat.mode_cloud": "Nube",
  "chat.mode_local": "Local",
  "bookmarks.title": "Mis Marcadores",
  "bookmarks.empty": "No hay marcadores aún",
  "bookmarks.new_folder": "Nueva Carpeta",
  "bookmarks.delete_folder": "Eliminar Carpeta",
  "settings.title": "Ajustes",
  "settings.api_key": "Clave API",
  "settings.save": "Guardar",
  "settings.remove": "Quitar",
  "settings.provider": "Proveedor de AI",
  "settings.model": "Modelo",
  "onboarding.banner_text": "Configura tu asesor legal y idioma en 2 minutos",
  "onboarding.start": "Comenzar Configuración",
  "onboarding.dismiss": "Posponerlo",
  "onboarding.welcome_title": "Bienvenido a Bóveda Legal Alemana",
  "onboarding.select_language":
    "Selecciona tu idioma preferido para la interfaz",
  "onboarding.continue": "Continuar",
  "onboarding.step_language": "Idioma",
  "onboarding.step_mode": "Modo de AI",
  "onboarding.step_setup": "Configuración",
  "onboarding.step_features": "Características",
  "onboarding.step_complete": "Estás listo",
  "onboarding.api_key_q": "Tienes una clave API para OpenAI o Anthropic?",
  "onboarding.yes": "Sí",
  "onboarding.no": "No",
  "onboarding.browser_q":
    "¿Quieres que el AI funcione completamente en tu navegador?",
  "onboarding.ollama_q": "Tienes Ollama instalado en tu computadora?",
  "onboarding.recommend_cloud": "AI Nube — mejor calidad, trae tu propia clave",
  "onboarding.recommend_browser":
    "AI Navegador — totalmente privado, funciona en el navegador (~1GB de descarga)",
  "onboarding.recommend_local": "AI Local — sin conexión, utiliza tu Ollama",
  "onboarding.recommend_basic":
    "Búsqueda Básica — sin AI, búsqueda directa de leyes",
  "onboarding.feature_title": "Lo que puedes hacer",
  "onboarding.feature_search": "Buscar más de 6,000 leyes a tu alcance",
  "onboarding.feature_chat": "Asesor legal",
  "onboarding.feature_guidance": "Caminos posibles para tu situación",
  "onboarding.feature_translation": "Leyes traducidas a tu idioma",
  "onboarding.feature_bookmarks": "Guardar y organizar leyes",
  "onboarding.complete_title": "Estás listo",
  "onboarding.complete_desc":
    "Tus preferencias se han guardado. Empieza a explorar la ley alemana.",
  "onboarding.start_app": "Empezar a usar la app",
  "onboarding.restart": "Reiniciar Configuración",
  "onboarding.resume": "Continuar donde dejaste",
  "onboarding.view_guide": "Ver Guía de Configuración",
  "onboarding.completed_on": "Terminaste la configuración el {date}",
  "onboarding.back": "Atrás",
  "onboarding.skip_config": "Saltar configuración",
  "onboarding.welcome_desc":
    "Tu puerta de entrada a más de 6,000 leyes federales alemanas con búsqueda, traducción y orientación legal impulsadas por IA en 9 idiomas.",
  "onboarding.mode_select_title": "Elige tu Modo de AI",
  "onboarding.mode_select_desc":
    "Elige cómo quieres interactuar con la ley alemana. Puedes cambiarlo en cualquier momento en Ajustes.",
  "onboarding.config_title": "Configurar {mode}",
  "onboarding.config_desc":
    "Configura tu conexión {mode} antes de empezar.",
  "onboarding.config_cloud":
    "Ingresa tu clave API de OpenAI, Anthropic o compatible. Tu clave está encriptada y almacenada de forma segura en nuestro servidor.",
  "onboarding.config_local":
    "Conéctate a Ollama en tu máquina. El broker se ejecuta en la URL indicada, u Ollama directamente en el puerto 11434.",
  "onboarding.config_browser":
    "La IA del navegador ejecuta un modelo Qwen3-0.6B (~570MB de descarga) enteramente en tu navegador mediante Web Workers. Totalmente privado — ningún dato sale de tu máquina.",
  "onboarding.config_basic":
    "No se necesita configuración. Busca en más de 6,000 leyes y lee extractos directamente. Las traducciones usan el mismo modelo de navegador que la IA del Navegador.",
  "onboarding.api_key_placeholder": "sk-...",
  "onboarding.paste": "Pegar",
  "onboarding.test_connection": "Probar Conexión",
  "onboarding.cloud_key_note":
    "La clave está encriptada y almacenada en el servidor. Nunca se transmite a terceros.",
  "onboarding.local_broker_label": "URL del Broker",
  "onboarding.local_model_label": "Modelo",
  "onboarding.local_status_checking": "Verificando...",
  "onboarding.local_status_connected": "Conectado",
  "onboarding.local_status_offline":
    "Desconectado — asegúrate de que Ollama esté funcionando",
  "onboarding.summary_title": "Resumen de tu Configuración",
  "onboarding.summary_desc":
    "Estás listo para explorar la ley alemana. Aquí está tu configuración.",
  "onboarding.mode_local": "AI Local",
  "onboarding.mode_cloud": "AI Nube",
  "onboarding.mode_browser": "AI Navegador",
  "onboarding.mode_basic": "Búsqueda Básica",
  "onboarding.mode_local_detail":
    "Dos modelos: 'german-legal' (6.6GB) para análisis legal completo y 'qwen2.5:1.5b-translate' (1GB) para traducciones rápidas. Totalmente fuera de línea.",
  "onboarding.mode_cloud_detail":
    "Trae tu propia clave API (OpenAI, Anthropic). Mejor calidad y respuestas más rápidas. Tú controlas la facturación.",
  "onboarding.mode_browser_detail":
    "Ejecuta Qwen3-0.6B en tu navegador (~570MB de descarga). Totalmente privado — ningún dato sale de tu máquina. Los 9 idiomas.",
  "onboarding.mode_basic_detail":
    "Busca más de 6,000 leyes y lee extractos directamente. Sin generación de IA — tú interpretas los resultados. Siempre disponible, sin configuración.",

  "gate.sign_in": "Inicia sesión para usar esta característica",
  "gate.api_key":
    "Configura una clave API en Ajustes para usar esta característica",
  "gate.ai_mode":
    "Cambia a un modo de AI en Ajustes para habilitar esta característica",
  "gate.broker": "Inicia tu broker local para habilitar el AI Local",

  "home.tagline": "Bundesrepublik Deutschland",
  "home.title": "La Bóveda de Leyes",
  "home.subtitle":
    "Un repositorio completo de más de 6,000 leyes federales alemanas.",
  "home.categories": "Categorías",
  "home.mode_basic": "Búsqueda Básica",
  "home.mode_basic_desc":
    "Busca en más de 6,000 leyes y lee extractos directamente. Sin IA — tú interpretas los resultados.",
  "home.mode_browser": "IA del Navegador",
  "home.mode_browser_desc":
    "La IA se ejecuta completamente en tu navegador a través de Qwen3. Totalmente privado, sin llamadas al servidor. Descarga de ~1GB.",
  "home.mode_cloud": "IA en la Nube",
  "home.mode_cloud_desc":
    "Trae tu propia clave de OpenAI/Anthropic. Mejor calidad, respuesta más rápida. Tú controlas la facturación.",
  "home.mode_local": "IA Local",
  "home.mode_local_desc":
    "Conéctate a Ollama en tu máquina a través del broker local. Completamente offline, ningún dato sale de tu red.",
  "home.get_started": "Comenzar",

  /* ── Search Bar strings ── */
  "search_bar.mode_search": "Búsqueda de Leyes",
  "search_bar.mode_analyze": "Análisis con IA",

  /* ── Guidance page strings ── */
  "guidance.page_title": "Orientación Legal",
  "guidance.page_subtitle": "Navega tu Situación",
  "guidance.folder_label": "Carpeta de Caso (Opcional)",
  "guidance.loading_folder": "Cargando...",
  "guidance.situation_label": "Describe Tu Situación",
  "guidance.situation_placeholder":
    "Describe tu situación legal en detalle. Incluye hechos relevantes, fechas, partes involucradas y cualquier acción que ya hayas tomado. Puedes escribir en cualquier idioma — alemán, inglés, turco, árabe, francés, español, polaco, ucraniano o ruso.",
  "guidance.situation_hint":
    "La IA cruza referencias de las leyes federales alemanas con tus marcadores y el contexto de la carpeta.",
  "guidance.analyzing": "Analizando Tu Situación...",
  "guidance.submit": "Obtener Orientación",
  "guidance.error_title": "Error al Generar la Orientación",
  "guidance.error_retry": "Reintentar",
  "guidance.empty_title": "Orientación Legal",
  "guidance.empty_desc":
    "Describe tu situación arriba y la IA analizará todas las más de 6,000 leyes federales alemanas, las cruzará con tus marcadores y carpetas de caso, y devolverá de 3 a 5 caminos de solución concretos con evaluación de riesgos, estimaciones de costos y pasos siguientes detallados.",
  "guidance.empty_feature_risk": "Insignias de Riesgo",
  "guidance.empty_feature_cost": "Estimaciones de Costos",
  "guidance.empty_feature_laws": "Leyes Citadas",
  "guidance.empty_feature_docs": "Generación de Documentos",
  "guidance.success_hint":
    "Estos son posibles caminos a seguir según la ley alemana. Cada camino tiene diferentes riesgos, costos y plazos. Haz clic en un camino para expandirlo y ver instrucciones paso a paso. No estás obligado a ninguna opción — esto es solo para ayudarte a entender tus alternativas.",
  "guidance.your_paths": "Tus Posibles Caminos a Seguir",
  "guidance.cost_breakdown": "Desglose de Costos",
  "guidance.paths_shown": "{n} de 5 caminos mostrados",
  "guidance.est_cost": "Costo Est.",
  "guidance.cost_court_fees": "Costos Judiciales (GKG)",
  "guidance.cost_lawyer_fees": "Honorarios de Abogado (RVG)",
  "guidance.cost_total_risk": "Riesgo Total (si pierdes)",
  "guidance.cost_basis":
    "Basado en Streitwert de €{n} (cálculo simplificado RVG/GKG). Los costos reales pueden variar.",
  "guidance.cited_laws": "Leyes Relevantes Utilizadas",
  "guidance.cited_click": "Haz clic en una ley para leer su texto completo",
  "guidance.gen_doc": "Generar Borrador de Documento",
  "guidance.gen_doc_progress": "Generando Documento...",
  "guidance.gen_doc_disclaimer":
    "Este es un borrador basado en tu situación. Haz que un abogado (Rechtsanwalt) lo revise antes de usarlo oficialmente.",
  "guidance.detailed_analysis": "Análisis Detallado",
  "guidance.step_plan": "Plan Paso a Paso",
  "guidance.quick_tip": "Consejo Rápido",
  "guidance.risk_hint": "Por qué: {reason}",
  "guidance.remember":
    "Esta orientación es solo para fines informativos. Para asesoramiento legal específico, consulta a un abogado alemán colegiado (Rechtsanwalt).",
  "guidance.save_archives": "Guardar leyes relevantes en tu Archivo",
  "guidance.gen_doc_require_folder":
    "Crea primero una carpeta de caso para generar documentos.",
  "guidance.gen_doc_require_folder_desc":
    "Selecciona o crea una carpeta del menú desplegable de arriba, luego inténtalo de nuevo.",

  /* ── Risk / probability / timeline labels ── */
  "guidance.risk_low": "Probablemente Favorable — Riesgo Bajo",
  "guidance.risk_medium": "Incierto — Riesgo Moderado",
  "guidance.risk_high": "Obstáculos Significativos — Riesgo Alto",
  "guidance.risk_hint_low":
    "Este camino tiene buenas probabilidades de salir bien. La ley está de tu lado y los costos son manejables.",
  "guidance.risk_hint_medium":
    "Este camino podría ir en cualquier dirección. Piensa en ello como una apuesta calculada — hay buenos argumentos en ambos lados. Un abogado puede ayudarte a evaluar tus posibilidades reales.",
  "guidance.risk_hint_high":
    "Este camino es una cuesta arriba. La ley o los hechos dificultan ganar. Antes de seguir esta ruta, busca asesoramiento legal profesional para entender a qué te enfrentas.",
  "guidance.prob_very_promising": "Muy Prometedor",
  "guidance.prob_promising": "Prometedor",
  "guidance.prob_uncertain": "Incierto",
  "guidance.prob_difficult": "Difícil",
  "guidance.prob_very_difficult": "Muy Difícil",
  "guidance.timeline_2_6_weeks":
    "Esto es bastante rápido. En el derecho alemán, los pasos extrajudiciales suelen moverse a este ritmo.",
  "guidance.timeline_3_12_months":
    "Los casos judiciales toman tiempo en Alemania. No te preocupes — la mayoría de los casos se resuelven antes del juicio.",
  "guidance.timeline_1_4_weeks":
    "Esto es muy rápido. Los tribunales se mueven rápido solo para asuntos urgentes (Eilverfahren).",
  "guidance.timeline_fallback":
    "Los plazos en los procedimientos legales alemanes varían. Un abogado puede darte un estimado más preciso para tu caso específico.",

  /* ── Guidance history page strings ── */
  "guidance_history.title": "Historial de Orientación",
  "guidance_history.subtitle": "Análisis de Casos",
  "guidance_history.count": "{n} Sesiones",
  "guidance_history.sign_in_title": "Inicio de Sesión Requerido",
  "guidance_history.sign_in_desc":
    "Inicia sesión para ver tu historial de orientación. Las sesiones se guardan automáticamente cuando ejecutas un análisis de caso mientras has iniciado sesión.",
  "guidance_history.sign_in_btn": "Iniciar Sesión",
  "guidance_history.loading": "Cargando Sesiones",
  "guidance_history.empty_title": "Aún No Hay Sesiones de Orientación",
  "guidance_history.empty_desc":
    "Describe tu situación legal y la IA generará de 3 a 5 caminos de solución. Las sesiones se guardan automáticamente cuando has iniciado sesión.",
  "guidance_history.empty_cta": "Analizar una Situación",
  "guidance_history.delete": "Eliminar Sesión",
  "guidance_history.deleting": "Eliminando...",
  "guidance_history.previous": "Anterior",
  "guidance_history.next": "Siguiente",
  "guidance_history.page_info": "Página {current} de {total}",
  "guidance_history.untitled": "Sesión Sin Título",
  "guidance_history.incident": "Incidente: {date}",
  "guidance_history.path": "Camino {n}: {title}",
  "guidance_history.confirm_delete":
    "¿Eliminar esta sesión de orientación y todos sus caminos de solución?",

  /* ── Chat page strings ── */
  "chat.limitation_basic":
    "Búsqueda Básica — busca leyes y muestra extractos relevantes. Sin análisis de IA.",
  "chat.limitation_browser":
    "IA del Navegador — descarga un modelo de ~1GB en el primer uso. Totalmente privado.",
  "chat.limitation_cloud":
    "IA en la Nube — usa tu propia clave API. Tu proveedor te factura.",
  "chat.limitation_local":
    "IA Local — solo funciona cuando broker.py y Ollama están ejecutándose en tu máquina.",
  "chat.conversations": "Conversaciones",
  "chat.new_conversation": "Nueva Conversación",
  "chat.type_message": "Escribe tu pregunta legal...",
  "chat.config_hint":
    "Configura los ajustes de IA para usar esta función.",

  /* ── Folder modal strings ── */
  "folder.title": "Nueva Carpeta de Caso",
  "folder.edit_title": "Editar Carpeta de Caso",
  "folder.name_label": "Nombre de la Carpeta",
  "folder.name_placeholder": "ej., Caso de Despido Improcedente",
  "folder.desc_label": "Descripción",
  "folder.desc_placeholder": "Breve descripción del caso",
  "folder.category_label": "Categoría",
  "folder.status_label": "Estado",
  "folder.incident_date": "Fecha del Incidente",
  "folder.incident_hint": "La IA calcula los plazos a partir de esta fecha",
  "folder.deadline_date": "Fecha Límite",
  "folder.deadline_hint": "La IA advierte cuando esta fecha se acerca",
  "folder.dispute_value": "Valor del Litigio (Streitwert) — EUR",
  "folder.dispute_hint": "Se usa para la estimación de costos (RVG/GKG)",
  "folder.opposing_party": "Parte Contraria",
  "folder.opposing_hint":
    "La IA verifica protecciones específicas (KSchG, BDSG, etc.)",
  "folder.opposing_placeholder": "ej., Empleador, Arrendador",
  "folder.court_name": "Nombre del Tribunal",
  "folder.court_placeholder": "ej., Arbeitsgericht Berlín",
  "folder.case_number": "Número de Caso (Aktenzeichen)",
  "folder.case_placeholder": "ej., 5 Ca 1234/24",
  "folder.notes_label": "Notas (Contexto para la IA)",
  "folder.notes_placeholder":
    "Añade cualquier contexto adicional sobre tu caso. La IA lo lee al generar la orientación.",
  "folder.notes_hint":
    "Contexto de texto libre — la IA lo lee al generar los caminos de orientación",
  "folder.cancel": "Cancelar",
  "folder.save": "Guardar Carpeta",
  "folder.saving": "Guardando...",
  "folder.name_required": "El nombre de la carpeta es obligatorio.",
  "folder.save_error": "Error al guardar la carpeta",
  "folder.basic_info": "Información Básica",
  "folder.timeline_value": "Cronograma y Valor",
  "folder.parties_court": "Partes y Tribunal",

  /* ── Norm viewer strings ── */
  "norm.section": "Sección {id}",
  "norm.translating_browser": "Traduciendo mediante IA del navegador…",
  "norm.translating_cloud": "Traduciendo mediante IA en la nube…",
  "norm.translating_local": "Traduciendo mediante IA local…",
  "norm.translating": "Traduciendo…",
  "norm.german_original": "Original en Alemán",
  "norm.translation_unavailable":
    "Traducción no disponible — configura la IA en Ajustes",
  "norm.translated_to": "Traducido al {lang}",
  "norm.show_translation": "Mostrar Traducción",
  "norm.show_german": "Mostrar Alemán Original",
  "norm.analyzing": "Analizando Estatuto...",
  "norm.translate": "Traducir al {lang}",
  "norm.gate_translate":
    "Cambia a un modo de IA en Ajustes para traducir leyes",
  "norm.translation_official": "Traducción Oficial",
  "norm.translation_ai": "Traducción por IA",
  "norm.content_summary": "Resumen",
  "norm.content_context": "Contexto",
  "norm.content_steps": "Pasos",
  "norm.disclaimer":
    "Inteligencia de la Bóveda — Informe Preliminar No Vinculante",

  /* ── Law detail page strings ── */
  "law_detail.back": "Volver",
  "law_detail.key_badge": "{key}",
  "law_detail.status": "Estado",
  "law_detail.authority": "Autoridad",
  "law_detail.modified": "Modificado",
  "law_detail.density": "Densidad",
  "law_detail.sections": "{n} Secciones",
  "law_detail.framework": "Marco Legal",
  "law_detail.save": "Guardar",
  "law_detail.saved": "Guardado",
  "law_detail.save_anon":
    "Marcador guardado localmente. Inicia sesión para sincronizar entre dispositivos.",
  "law_detail.archive_entry": "Entrada de archivo eliminada",
  "law_detail.loading": "Descifrando Estatuto...",
};
