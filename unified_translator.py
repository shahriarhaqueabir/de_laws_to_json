"""
Unified AI Translation Module

Provides a single, unified translation endpoint that uses:
1. Translation cache (for instant responses)
2. Legal dictionary (for terminology hints) - IN-MEMORY
3. Ollama LLM (for final translation)

All translation requests flow through this unified system.
"""

import json
import logging
import os
import re
import threading
import time
import socket
import urllib.request
import urllib.error
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any

# Try to import yaml for config loading
try:
    import yaml
    YAML_AVAILABLE = True
except ImportError:
    YAML_AVAILABLE = False

from logging_config import get_ai_logger, get_dictionary_logger

# Import guardrails
try:
    from ai_guardrails import (
        validate_ai_response,
        inject_disclaimer,
        extract_citations,
        verify_citation,
    )
    GUARDRAILS_AVAILABLE = True
except ImportError:
    GUARDRAILS_AVAILABLE = False

# Import version tracking
try:
    from version_tracking import (
        get_version_tracker,
        prepare_law_context,
    )
    VERSION_TRACKING_AVAILABLE = True
except ImportError as e:
    ai_logger.debug(f"Version tracking not available: {e}")
    VERSION_TRACKING_AVAILABLE = False

ai_logger = get_ai_logger()
dictionary_logger = get_dictionary_logger()

# Configuration
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434/api/generate")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.2")
OLLAMA_TIMEOUT = int(os.environ.get("OLLAMA_TIMEOUT", "120"))
OLLAMA_MAX_RETRIES = int(os.environ.get("OLLAMA_MAX_RETRIES", "3"))
OLLAMA_RETRY_BACKOFF = float(os.environ.get("OLLAMA_RETRY_BACKOFF", "1.0"))

# Cache configuration
AI_TRANSLATION_FILE = "./ai_translations.json"
TRANSLATION_SAVE_INTERVAL = int(os.environ.get("TRANSLATION_SAVE_INTERVAL", "30"))

# Thread-safe cache
_translation_cache: Dict[str, str] = {}
_translation_lock = threading.Lock()
_translation_dirty = False


class UnifiedTranslator:
    """
    Unified AI-powered translator with dictionary assistance.
    
    Flow:
    1. Check cache (instant)
    2. Extract dictionary hints (fast)
    3. Call Ollama with context (accurate)
    4. Cache result (persistent)
    
    Uses in-memory dictionary for fast lookups without database locking.
    """

    def __init__(self, legal_dict=None):
        # Use in-memory dictionary by default for fast lookups
        if legal_dict is None:
            try:
                from dictionary.memory_dict import get_memory_legal_dictionary
                self.legal_dict = get_memory_legal_dictionary()
                ai_logger.info("Using in-memory legal dictionary")
            except Exception as e:
                ai_logger.warning(f"Could not load in-memory dictionary: {e}")
                self.legal_dict = None
        else:
            self.legal_dict = legal_dict
            
        self._load_cache()
        self._start_background_saver()
        self._system_prompt_cache = None  # Cache loaded system prompt

    def _load_system_prompt(self) -> str:
        """
        Load system prompt from configuration file.
        
        Returns:
            System prompt string
        """
        # Return cached version if available
        if self._system_prompt_cache:
            return self._system_prompt_cache
        
        config_paths = [
            os.path.join(os.path.dirname(__file__), "Documentation and AI Instructions", "AI_CONFIG", "system_prompt.yaml"),
            os.path.join(os.path.dirname(os.path.dirname(__file__)), "Documentation and AI Instructions", "AI_CONFIG", "system_prompt.yaml"),
        ]
        
        for config_path in config_paths:
            try:
                if os.path.exists(config_path):
                    with open(config_path, 'r', encoding='utf-8') as f:
                        config = yaml.safe_load(f)
                    
                    # Build system prompt from config
                    system = config.get('system', {})
                    principles = config.get('principles', {})
                    prohibited = config.get('prohibited_actions', [])
                    
                    prompt_parts = [
                        system.get('identity', ''),
                        "\n\nRESPONSE PRINCIPLES:",
                    ]
                    
                    for name, settings in principles.items():
                        if settings.get('enabled'):
                            prompt_parts.append(f"- {settings.get('description', name)}")
                    
                    prompt_parts.append("\n\nPROHIBITED ACTIONS:")
                    for action in prohibited:
                        prompt_parts.append(f"- {action.get('description', action.get('action'))}")
                    
                    prompt_parts.append("\n\n⚠️ CRITICAL RULES:")
                    prompt_parts.append("1. ONLY cite paragraphs from the provided context")
                    prompt_parts.append("2. Verify every paragraph number before citing")
                    prompt_parts.append("3. If context is empty, say 'No relevant laws found'")
                    prompt_parts.append("4. Check LAST_UPDATED dates and warn if law is older than 2 years")
                    prompt_parts.append("5. Include legal disclaimer at the end")
                    prompt_parts.append("6. Do NOT request names, addresses, or case numbers")
                    
                    self._system_prompt_cache = "\n".join(prompt_parts)
                    ai_logger.info(f"Loaded system prompt from config: {config_path}")
                    return self._system_prompt_cache
            
            except Exception as e:
                ai_logger.debug(f"Could not load system prompt config from {config_path}: {e}")
                continue
        
        # Fallback to default
        return self._get_default_system_prompt()

    def _get_default_system_prompt(self) -> str:
        """Fallback system prompt if config file unavailable."""
        return """You are the German Law Vault AI Assistant, a specialized legal information system for German federal laws.

⚠️ CRITICAL RULES:
1. ONLY cite paragraphs from the provided context
2. Verify every paragraph number before citing
3. If context is empty, say 'No relevant laws found'
4. Check LAST_UPDATED dates and warn if law is older than 2 years
5. Include legal disclaimer at the end
6. Do NOT request names, addresses, or case numbers

RESPONSE PRINCIPLES:
- Accuracy: Only cite paragraphs from provided context
- Clarity: Use simple language, explain legal terms
- Brevity: Be concise, under 300 words for explanations
- Safety: Include disclaimers, protect PII
- Transparency: Acknowledge uncertainty, suggest verification

⚖️ This information does not constitute legal advice."""
    
    def _load_cache(self):
        """Load translation cache from disk."""
        if os.path.exists(AI_TRANSLATION_FILE):
            try:
                with open(AI_TRANSLATION_FILE, "r", encoding="utf-8") as f:
                    global _translation_cache
                    _translation_cache = json.load(f)
                ai_logger.info(f"Loaded {len(_translation_cache)} AI translations from cache")
            except Exception as e:
                ai_logger.warning(f"Could not load AI translation cache: {e}")
        else:
            ai_logger.info("No existing translation cache found")
    
    def _start_background_saver(self):
        """Start background thread to periodically save cache."""
        def save_loop():
            while True:
                time.sleep(TRANSLATION_SAVE_INTERVAL)
                self._save_cache()
        
        thread = threading.Thread(target=save_loop, daemon=True)
        thread.start()
        ai_logger.info("Background translation cache saver started")
    
    def _save_cache(self):
        """Save translation cache to disk atomically."""
        global _translation_dirty, _translation_cache
        
        with _translation_lock:
            if not _translation_dirty:
                return
            
            try:
                # Atomic write
                import tempfile
                fd, temp_path = tempfile.mkstemp(
                    dir=os.path.dirname(os.path.abspath(AI_TRANSLATION_FILE)) or ".",
                    suffix=".tmp"
                )
                with os.fdopen(fd, "w", encoding="utf-8") as fh:
                    json.dump(_translation_cache, fh, ensure_ascii=False, indent=2)
                
                os.replace(temp_path, AI_TRANSLATION_FILE)
                _translation_dirty = False
                ai_logger.info(f"Saved {len(_translation_cache)} translations to cache")
            except Exception as e:
                ai_logger.warning(f"Could not save translation cache: {e}")
    
    def translate(self, text: str, is_title: bool = False) -> Tuple[str, bool]:
        """
        Translate German text to English using AI with dictionary assistance.
        
        Args:
            text: German text to translate
            is_title: Whether this is a law title (affects prompt)
        
        Returns:
            Tuple of (translation, is_from_cache)
        """
        if not text or not text.strip():
            return ("", True)
        
        # 1. Check cache first (fastest path)
        with _translation_lock:
            if text in _translation_cache:
                ai_logger.info(f"Cache hit: '{text[:50]}...'")
                return (_translation_cache[text], True)
        
        # 2. Extract dictionary hints for AI assistance
        hints = self._extract_dictionary_hints(text, is_title)
        
        # 3. Build prompt with context
        prompt = self._build_prompt(text, is_title, hints)
        
        # 4. Call Ollama
        translation = self._call_ollama(prompt)
        
        if not translation:
            ai_logger.warning(f"Ollama returned empty translation for: {text[:50]}")
            translation = text  # Fallback: return original
        
        # 5. Cache the result
        with _translation_lock:
            _translation_cache[text] = translation
            _translation_dirty = True
        
        ai_logger.info(f"Translated: '{text[:50]}...' -> '{translation[:50]}...'")
        return (translation, False)
    
    def _extract_dictionary_hints(self, text: str, is_title: bool) -> Dict:
        """
        Extract dictionary hints to assist AI translation.
        
        Returns dict with:
        - key_terms: {german: english} mappings
        - legal_terms: identified legal terminology
        - abbreviations: expanded abbreviations
        """
        hints = {
            "key_terms": {},
            "legal_terms": [],
            "abbreviations": {}
        }
        
        if not self.legal_dict:
            return hints
        
        try:
            # For short texts, try full-text lookup
            if len(text) < 150:
                results = self.legal_dict.get_translations(text, limit=3)
                if results:
                    for res in results:
                        hints["key_terms"][text] = res.get("english", text)
                        if res.get("source") == "legal_priority":
                            hints["legal_terms"].append(text)
            
            # Extract individual words for longer texts
            words = re.findall(r"\b[\wäöüÄÖÜß]{4,}\b", text, flags=re.UNICODE)
            for word in set(words[:15]):  # Limit to prevent overload
                try:
                    results = self.legal_dict.get_translations(word, limit=1)
                    if results:
                        hints["key_terms"][word] = results[0].get("english", word)
                        if results[0].get("source") == "legal_priority":
                            hints["legal_terms"].append(word)
                except Exception:
                    pass
            
            # Check for common abbreviations
            abbreviations = ["BGB", "GG", "StGB", "ZPO", "VwGO", "OWiG", "SGB", "HGB"]
            text_upper = text.upper()
            for abbrev in abbreviations:
                if abbrev in text_upper:
                    expanded = self._expand_abbreviation(abbrev)
                    if expanded:
                        hints["abbreviations"][abbrev] = expanded
            
        except Exception as e:
            dictionary_logger.debug(f"Dictionary hint extraction failed: {e}")
        
        return hints
    
    def _expand_abbreviation(self, abbrev: str) -> Optional[str]:
        """Expand common legal abbreviations."""
        abbrev_map = {
            "BGB": "Bürgerliches Gesetzbuch (Civil Code)",
            "GG": "Grundgesetz (Basic Law/Constitution)",
            "StGB": "Strafgesetzbuch (Criminal Code)",
            "ZPO": "Zivilprozessordnung (Code of Civil Procedure)",
            "VwGO": "Verwaltungsgerichtsordnung (Administrative Court Rules)",
            "OWiG": "Ordnungswidrigkeitengesetz (Administrative Offenses Act)",
            "SGB": "Sozialgesetzbuch (Social Code)",
            "HGB": "Handelsgesetzbuch (Commercial Code)",
            "Abs.": "Absatz (Paragraph/Section)",
            "S.": "Satz (Sentence)",
            "Nr.": "Nummer (Number)",
            "Art.": "Artikel (Article)",
        }
        return abbrev_map.get(abbrev)
    
    def _build_prompt(self, text: str, is_title: bool, hints: Dict) -> str:
        """
        Build translation prompt with dictionary context.
        
        The AI receives:
        1. System role (legal translator expert)
        2. Dictionary hints (verified terminology)
        3. The text to translate
        4. Output format instructions
        """
        # Build hints section
        hints_text = ""
        if hints["key_terms"]:
            hints_text += "\nVerified German-English terms from legal dictionary:\n"
            for de, en in hints["key_terms"].items():
                hints_text += f"  • {de} → {en}\n"
        
        if hints["legal_terms"]:
            hints_text += "\nThese are established legal terms - use standard translations:\n"
            hints_text += f"  {', '.join(hints['legal_terms'][:5])}\n"
        
        if hints["abbreviations"]:
            hints_text += "\nAbbreviation expansions:\n"
            for abbrev, expanded in hints["abbreviations"].items():
                hints_text += f"  • {abbrev} = {expanded}\n"
        
        # Build prompt based on text type
        if is_title:
            system_prompt = (
                "You are an expert German-to-English legal translator specializing in German federal law.\n"
                "Translate law titles and legal abbreviations into professional, standard English.\n"
                "Use official terminology where available.\n"
                "Return ONLY the translation, no explanations."
            )
            user_prompt = (
                f"{hints_text}\n"
                f"Translate this German law title:\n"
                f"German: {text}\n"
                f"English:"
            )
        else:
            system_prompt = (
                "You are an expert German-to-English legal translator.\n"
                "Translate German legal text into accurate, professional English.\n"
                "Maintain formal legal register and precise terminology.\n"
                "Preserve paragraph structure and formatting.\n"
                "Use the provided dictionary hints for verified terms.\n"
                "Return ONLY the translation, no explanations."
            )
            user_prompt = (
                f"{hints_text}\n"
                f"Translate this German legal text:\n"
                f"German: {text}\n\n"
                f"English Legal Translation:"
            )
        
        return f"{system_prompt}\n\n{user_prompt}"
    
    def _call_ollama(self, prompt: str) -> Optional[str]:
        """
        Call Ollama API with retry logic.
        
        Returns translated text or None on failure.
        """
        payload = {
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.3,  # Lower temperature for consistency
                "top_p": 0.9,
            }
        }
        
        last_error = None
        for attempt in range(1, OLLAMA_MAX_RETRIES + 1):
            try:
                req = urllib.request.Request(
                    OLLAMA_URL,
                    data=json.dumps(payload).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                )
                resp = urllib.request.urlopen(req, timeout=OLLAMA_TIMEOUT)
                result = json.loads(resp.read().decode("utf-8"))
                translation = result.get("response", "").strip()
                
                # Clean up quotes
                if translation.startswith('"') and translation.endswith('"'):
                    translation = translation[1:-1]
                
                ai_logger.info(f"Ollama translation successful (attempt {attempt})")
                return translation
                
            except (urllib.error.URLError, socket.timeout, ConnectionError) as e:
                last_error = e
                ai_logger.warning(f"Ollama request failed (attempt {attempt}/{OLLAMA_MAX_RETRIES}): {e}")
                if attempt < OLLAMA_MAX_RETRIES:
                    sleep_time = OLLAMA_RETRY_BACKOFF * (2 ** (attempt - 1))
                    time.sleep(sleep_time)
                    
            except Exception as e:
                ai_logger.exception(f"Unexpected error calling Ollama: {e}")
                last_error = e
                break
        
        ai_logger.error(f"Ollama translation failed after {OLLAMA_MAX_RETRIES} attempts")
        return None
    
    def get_cache_stats(self) -> Dict:
        """Get translation cache statistics."""
        return {
            "cache_size": len(_translation_cache),
            "file": AI_TRANSLATION_FILE,
            "dirty": _translation_dirty,
        }
    
    def clear_cache(self):
        """Clear the translation cache."""
        global _translation_cache, _translation_dirty
        with _translation_lock:
            _translation_cache = {}
            _translation_dirty = True
        ai_logger.info("Translation cache cleared")
    
    def prewarm_cache(self, terms: List[str], max_workers: int = 4):
        """
        Pre-translate a list of terms to warm the cache.
        
        Args:
            terms: List of German terms to translate
            max_workers: Maximum concurrent translations
        """
        from concurrent.futures import ThreadPoolExecutor, as_completed
        
        terms_to_translate = [t for t in terms if t not in _translation_cache]
        ai_logger.info(f"Pre-warming cache for {len(terms_to_translate)} terms")
        
        successful = 0
        failed = 0
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {
                executor.submit(self.translate, term, is_title=True): term
                for term in terms_to_translate
            }
            
            for future in as_completed(futures):
                term = futures[future]
                try:
                    translation, _ = future.result()
                    if translation and translation != term:
                        successful += 1
                    else:
                        failed += 1
                except Exception as e:
                    ai_logger.warning(f"Failed to pre-translate '{term}': {e}")
                    failed += 1
        
        ai_logger.info(f"Cache pre-warm complete: {successful} successful, {failed} failed")
        self._save_cache()
    
    def stream_ollama(self, prompt: str):
        """
        Stream translation from Ollama API.
        
        Yields text chunks as they arrive.
        """
        payload = {
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": True,
        }
        
        try:
            req = urllib.request.Request(
                OLLAMA_URL,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
            )
            resp = urllib.request.urlopen(req, timeout=OLLAMA_TIMEOUT)
            
            for line in resp:
                if line:
                    try:
                        chunk = json.loads(line)
                        if "response" in chunk:
                            yield chunk["response"]
                    except Exception:
                        continue
                        
        except Exception as e:
            ai_logger.error(f"Ollama stream error: {e}")
            yield f"\n\n[Ollama Connection Error: {str(e)}]"
    
    def call_ollama_json(self, prompt: str, format: str = "json") -> Optional[Dict]:
        """
        Call Ollama API with JSON format requirement.
        
        Args:
            prompt: The prompt to send
            format: Response format (default: "json")
        
        Returns:
            Parsed JSON response or None on failure
        """
        payload = {
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False,
            "format": format,
        }
        
        last_error = None
        for attempt in range(1, OLLAMA_MAX_RETRIES + 1):
            try:
                req = urllib.request.Request(
                    OLLAMA_URL,
                    data=json.dumps(payload).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                )
                resp = urllib.request.urlopen(req, timeout=OLLAMA_TIMEOUT)
                result = json.loads(resp.read().decode("utf-8"))
                response_text = result.get("response", "").strip()
                
                ai_logger.info(f"Ollama JSON response successful (attempt {attempt})")
                
                # Parse the JSON response
                try:
                    return json.loads(response_text)
                except json.JSONDecodeError:
                    ai_logger.warning(f"Ollama returned invalid JSON: {response_text[:200]}")
                    return None
                    
            except (urllib.error.URLError, socket.timeout, ConnectionError) as e:
                last_error = e
                ai_logger.warning(f"Ollama JSON request failed (attempt {attempt}/{OLLAMA_MAX_RETRIES}): {e}")
                if attempt < OLLAMA_MAX_RETRIES:
                    sleep_time = OLLAMA_RETRY_BACKOFF * (2 ** (attempt - 1))
                    time.sleep(sleep_time)
                    
            except Exception as e:
                ai_logger.exception(f"Unexpected error calling Ollama JSON: {e}")
                last_error = e
                break
        
        ai_logger.error(f"Ollama JSON request failed after {OLLAMA_MAX_RETRIES} attempts")
        return None

    def explain_law_with_context(
        self,
        law_result: Dict[str, Any],
        user_query: str,
        language: str = "en"
    ) -> str:
        """
        Explain a law paragraph with full guardrail enforcement.
        
        This is the primary method for AI law explanations. It:
        1. Builds prompt with version metadata
        2. Calls Ollama with system prompt
        3. Validates response for hallucinations
        4. Injects version warnings
        5. Adds legal disclaimer
        
        Args:
            law_result: Law result dictionary with metadata
            user_query: User's question about the law
            language: Response language ('en' or 'de')
        
        Returns:
            Explained text with all guardrails applied
        """
        # Get version tracker if available
        tracker = None
        if VERSION_TRACKING_AVAILABLE:
            try:
                tracker = get_version_tracker()
            except Exception as e:
                ai_logger.warning(f"Could not get version tracker: {e}")
        
        # Prepare context with metadata
        if tracker:
            context = prepare_law_context(law_result)
        else:
            # Fallback: manual context preparation
            meta = law_result.get('meta', {})
            context = {
                "law_name": law_result.get("law_id", "unknown").upper(),
                "paragraph": law_result.get("paragraph", ""),
                "paragraph_text": law_result.get("content", ""),
                "last_updated": meta.get("last_changed", "unknown"),
                "status": meta.get("status", "in_force"),
            }
        
        # Build prompt with all required elements
        prompt = self._build_law_explanation_prompt(
            context=context,
            user_query=user_query,
            language=language
        )
        
        # Get system prompt
        system_prompt = self._load_system_prompt()
        
        # Combine system prompt with user prompt
        full_prompt = f"{system_prompt}\n\n{prompt}"
        
        # Call Ollama
        ai_response = self._call_ollama(full_prompt)
        
        if not ai_response:
            ai_logger.warning(f"Ollama returned empty explanation for: {user_query[:50]}")
            ai_response = "AI explanation is currently unavailable. Please try again later."
            return inject_disclaimer(ai_response, "explanation") if GUARDRAILS_AVAILABLE else ai_response
        
        # Validate response with guardrails
        if GUARDRAILS_AVAILABLE:
            law_context = [law_result]  # Context for citation verification
            result = validate_ai_response(ai_response, law_context, user_query)
            ai_response = result.sanitized_response
            
            # Log validation results
            if result.warnings:
                ai_logger.warning(f"Guardrail warnings: {result.warnings}")
            if result.errors:
                ai_logger.error(f"Guardrail errors: {result.errors}")
        
        # Inject version warning if tracker available
        if tracker and VERSION_TRACKING_AVAILABLE:
            try:
                ai_response = tracker.inject_version_warning(ai_response, law_result)
            except Exception as e:
                ai_logger.debug(f"Could not inject version warning: {e}")
        
        # Ensure disclaimer is present
        if GUARDRAILS_AVAILABLE:
            ai_response = inject_disclaimer(ai_response, "explanation")
        elif "⚖️" not in ai_response and "legal advice" not in ai_response.lower():
            ai_response += "\n\n⚖️ This information does not constitute legal advice."
        
        return ai_response

    def _build_law_explanation_prompt(
        self,
        context: Dict[str, Any],
        user_query: str,
        language: str
    ) -> str:
        """
        Build prompt for law explanation with all required elements.
        
        Args:
            context: Prepared law context with metadata
            user_query: User's question
            language: Response language
        
        Returns:
            Formatted prompt string
        """
        # Check law age for version awareness
        version_note = ""
        if context.get('last_updated') != 'unknown':
            try:
                change_date = datetime.fromisoformat(context['last_updated'])
                age_years = (datetime.now() - change_date).days / 365.25
                if age_years > 2:
                    version_note = f"\n\n⚠️ IMPORTANT: This law version is from {context['last_updated']} ({age_years:.1f} years old). Mention in your response that amendments may have occurred."
                elif age_years > 1:
                    version_note = f"\n\nℹ️ Note: This law version is from {context['last_updated']}. You may mention this."
            except (ValueError, TypeError):
                pass
        
        # Check if law is repealed
        status_note = ""
        if context.get('status') == 'repealed':
            repealed_date = context.get('repealed_date', 'unknown date')
            status_note = f"\n\n⚠️ CRITICAL: This law is NO LONGER IN FORCE. It was repealed on {repealed_date}. Make this very clear in your response."
        
        prompt_template = f"""You are explaining a German law paragraph to a user.

LAW: {context['law_name']}
PARAGRAPH: {context['paragraph']}
CONTENT: {context['paragraph_text']}
LAST_UPDATED: {context['last_updated']}
STATUS: {context['status']}

USER QUESTION: {user_query}

Respond in {"English" if language == "en" else "German"}.

⚠️ CRITICAL RULES:
1. ONLY explain the paragraph provided above - do NOT invent or cite other paragraphs
2. If the paragraph number in your response doesn't match the input, STOP
3. Use simple, non-technical language where possible
4. Explain legal terms when they appear
5. Provide practical examples if relevant
6. Do NOT provide legal advice - only information
7. Keep response under 300 words{version_note}{status_note}

Begin your explanation:"""
        
        return prompt_template


# Singleton instance
_translator_instance: Optional[UnifiedTranslator] = None


def get_unified_translator(legal_dict=None) -> UnifiedTranslator:
    """Get or create the unified translator instance."""
    global _translator_instance
    if _translator_instance is None:
        _translator_instance = UnifiedTranslator(legal_dict)
    return _translator_instance


def translate_text(text: str, is_title: bool = False, legal_dict=None) -> Tuple[str, bool]:
    """
    Convenience function for quick translation.
    
    Returns:
        Tuple of (translation, is_from_cache)
    """
    translator = get_unified_translator(legal_dict)
    return translator.translate(text, is_title)


if __name__ == "__main__":
    # Test the unified translator
    import sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    
    from dictionary.memory_dict import get_memory_legal_dictionary
    
    print("Testing Unified AI Translator")
    print("=" * 50)
    
    legal_dict = get_memory_legal_dictionary()
    translator = get_unified_translator(legal_dict)
    
    test_texts = [
        ("Kündigung", True),
        ("BGB", True),
        ("Mieterhöhung", True),
        ("Der Vermieter kann das Mietverhältnis kündigen.", False),
    ]
    
    for text, is_title in test_texts:
        print(f"\nGerman: {text}")
        translation, from_cache = translator.translate(text, is_title)
        print(f"English: {translation}")
        print(f"Source: {'cache' if from_cache else 'AI'}")
    
    print("\n" + "=" * 50)
    print(f"Cache stats: {translator.get_cache_stats()}")
