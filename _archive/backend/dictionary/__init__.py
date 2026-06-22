"""
German-English Legal Dictionary Package

This package provides dictionary lookup functionality for German→English
legal translation.

Usage:
    from dictionary.legal_dict import LegalDictionary, get_legal_dictionary
    from dictionary.compound_words import CompoundDecomposer, decompose
"""

from dictionary.legal_dict import (
    LegalDictionary,
    get_legal_dictionary,
    translate,
    translate_phrase,
)

from dictionary.compound_words import (
    CompoundDecomposer,
    get_decomposer,
    decompose,
    translate_compound,
)

__all__ = [
    # LegalDictionary
    'LegalDictionary',
    'get_legal_dictionary',
    'translate',
    'translate_phrase',
    
    # CompoundDecomposer
    'CompoundDecomposer',
    'get_decomposer',
    'decompose',
    'translate_compound',
]
