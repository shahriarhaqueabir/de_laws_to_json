# False Friends and Legal Terminology Mapping

## Table of Contents

1. [False Friends Table](#false-friends-table)
2. [One-Shot Translation Examples](#one-shot-translation-examples)
3. [High-Stakes Term Mappings](#high-stakes-term-mappings)
4. [Usage Guidelines](#usage-guidelines)

---

## False Friends Table

### Critical Translation Distinctions

These terms are frequently mistranslated. AI must use the correct translation.

| German Term | Common Mistranslation | Correct Translation | Explanation |
|-------------|----------------------|---------------------|-------------|
| **Besitz** | Ownership | Possession | Actual physical control of an object, not legal title |
| **Eigentum** | Possession | Ownership | Legal title/right to property, not necessarily physical control |
| **Anwalt** | Attorney (US) | Lawyer/Rechtsanwalt | German qualified attorney, different from US attorney |
| **Kündigung** | Termination | Notice of Termination | Requires form and notice period, not instant effect |
| **Frist** | Deadline | Period/Time Limit | Can be weeks/months, not just a specific date |
| **Anspruch** | Claim (lawsuit) | Entitlement/Right | Legal right to demand something, not necessarily a lawsuit |
| **Forderung** | Demand | Claim/Debt | Creditor's right to payment, not an aggressive demand |
| **Urteil** | Verdict | Judgment | Court decision in civil cases; verdict is for criminal |
| **Beschluss** | Resolution | Court Order | Procedural court decision, not a corporate resolution |
| **Klage** | Lawsuit | Statement of Claim | Initial pleading, not the entire lawsuit |
| **Mahnung** | Warning | Formal Demand | Required for default (Verzug), not just a warning |
| **Abmahnung** | Reprimand | Cease & Desist Warning | Pre-termination warning with legal consequences |
| **Gewährleistung** | Warranty | Statutory Warranty | Automatic under BGB, not a voluntary warranty |
| **Garantie** | Guarantee | Voluntary Guarantee | Manufacturer's voluntary promise, not statutory |
| **Bußgeld** | Fine | Administrative Fine | Under OWiG, not a criminal penalty |
| **Strafe** | Penalty | Criminal Punishment | Under StGB, criminal only, not administrative |
| **Vorsatz** | Intent | Direct Intent | Intentional act with knowledge and will |
| **Fahrlässigkeit** | Negligence | Negligence | Careless but not intentional; simpler negligence |
| **Grundstück** | Property | Land/Real Estate | Specifically land, not buildings (Gebäude) |
| **Immobilie** | Real Estate | Property/Immovable | Includes buildings and land together |
| **Miete** | Rent | Rent/Lease | Can mean both the payment and the contract |
| **Pacht** | Lease | Leasehold | Lease including fruits/profits from property |
| **Darlehen** | Loan | Loan (civil) | Civil law loan under BGB, not commercial |
| **Kredit** | Credit | Credit/Loan | Commercial bank loan, not civil law Darlehen |
| **Schaden** | Damage | Damage/Harm | General term for loss or injury |
| **Schadensersatz** | Damages | Compensation | Monetary compensation for damage |
| **Haftung** | Liability | Liability | Legal responsibility for damages |
| **Haftpflicht** | Liability Insurance | Liability Insurance | Specifically insurance for liability |
| **Verzug** | Delay | Default | Legal default after deadline + Mahnung |
| **Leistungsstörung** | Performance Issue | Breach of Contract | Disturbance in contract performance |
| **Widerruf** | Revocation | Right of Withdrawal | Consumer's statutory cancellation right |
| **Rücktritt** | Withdrawal | Rescission | Contract cancellation for breach |
| **Anfechtung** | Challenge | Avoidance | Challenging validity of legal act |
| **Vollmacht** | Power | Power of Attorney | Authorization to act for another |
| **Vertretung** | Representation | Agency/Legal Representation | Acting on behalf of another |
| **Geschäftsfähigkeit** | Capacity | Legal Capacity | Ability to enter legal transactions |
| **Deliktfähigkeit** | Tort Capacity | Tort Liability Capacity | Capacity for tort liability |
| **Rechtswidrigkeit** | Illegality | Unlawfulness | Objective violation of law |
| **Schuld** | Guilt/Debt | Fault/Debt | Can mean moral guilt or financial debt |
| **Zumutbarkeit** | Reasonability | Reasonableness (Expectability) | What can reasonably be expected |
| **Billigkeit** | Fairness | Equity | Equitable considerations in law |

---

## One-Shot Translation Examples

### Example 1: Possession vs. Ownership

**User Query:** "I have Besitz but not Eigentum of the apartment"

✅ **Correct Response:**
```
You have possession (tatsächliche Sachherrschaft) but not ownership 
(Rechtstitel) of the apartment. This commonly occurs in:

- Rental agreements (Mietvertrag) - tenant has Besitz, landlord has Eigentum
- Lease agreements (Pachtvertrag) - similar arrangement
- Pledge agreements (Pfandrecht) - creditor has Besitz as security

Under BGB §854, Besitz is the actual control over a thing. Under BGB §903, 
Eigentum is the full legal right to dispose of the thing.

⚖️ This information does not constitute legal advice.
```

❌ **Wrong Response:**
```
You have ownership but not possession of the apartment.
```
(This reverses the meanings entirely!)

---

### Example 2: Termination Nuances

**User Query:** "My landlord issued a Kündigung"

✅ **Correct Response:**
```
Your landlord issued a notice of termination (Kündigung). This is NOT 
immediate eviction. Key points:

1. **Form Required**: Kündigung must be in writing (schriftform, BGB §568)
2. **Notice Period**: Typically 3 months for landlord (BGB §573c)
3. **Reason Required**: Landlord must have legitimate interest (berechtigtes Interesse)
4. **Not Immediate**: You can stay during the notice period

Related terms:
- Kündigungsfrist = notice period
- fristlose Kündigung = immediate termination (only for serious cause)
- Räumungsklage = eviction lawsuit (separate legal step)

⚖️ This information does not constitute legal advice. Consult a Rechtsanwalt for your case.
```

❌ **Wrong Response:**
```
Your landlord terminated your lease. You must leave immediately.
```
(Incorrectly implies instant effect!)

---

### Example 3: Fine vs. Punishment

**User Query:** "I got a Bußgeld for speeding"

✅ **Correct Response:**
```
You received an administrative fine (Bußgeld) under the Administrative 
Offenses Act (OWiG - Ordnungswidrigkeitengesetz).

Key points:
- **Not Criminal**: Bußgeld is NOT a criminal conviction (Strafe)
- **No Criminal Record**: Does not appear in Führungszeugnis
- **Typical Amount**: Speeding violations range from €15-€700+
- **Points**: May add points in Flensburg (Fahreignungsregister)
- **License**: Serious cases may trigger driving ban (Fahrverbot)

Contrast with:
- Strafe = Criminal punishment under StGB
- Verwarnung = Warning (smaller violations, €5-€35)

⚖️ This information does not constitute legal advice.
```

❌ **Wrong Response:**
```
You got a penalty/strafe for speeding. This is a criminal offense.
```
(Incorrectly categorizes as criminal!)

---

### Example 4: Warranty vs. Guarantee

**User Query:** "The product is defective. Do I have Garantie?"

✅ **Correct Response:**
```
You likely have Gewährleistung (statutory warranty), not Garantie.

**Gewährleistung (Statutory Warranty)**:
- Automatic under BGB §437
- 2 years for new goods, 1 year for used
- Seller must fix or replace
- Free of charge
- Cannot be excluded for consumers

**Garantie (Voluntary Guarantee)**:
- Manufacturer's voluntary promise
- Terms set by manufacturer
- May have fees or restrictions
- In addition to Gewährleistung, not replacement

Your rights under Gewährleistung:
1. Nacherfüllung (repair/replacement)
2. Rücktritt (refund) or Minderung (price reduction)
3. Schadensersatz (damages) in some cases

⚖️ This information does not constitute legal advice.
```

❌ **Wrong Response:**
```
You have a warranty. Check if the guarantee covers this defect.
```
(Confuses the two distinct concepts!)

---

### Example 5: Claim vs. Lawsuit

**User Query:** "I have an Anspruch to the money"

✅ **Correct Response:**
```
You have an Anspruch (legal entitlement/claim) to the money.

**Anspruch** means:
- You have a legal right to demand payment
- Based on contract, law, or other legal basis
- Does NOT mean you've filed a lawsuit yet

To enforce your Anspruch:
1. Send Mahnung (formal demand) - puts debtor in Verzug (default)
2. If no payment, file Klage (statement of claim) in court
3. Court issues Urteil (judgment)
4. Enforce through Zwangsvollstreckung (enforcement proceedings)

Legal basis examples:
- Contract claim: BGB §280 (breach of contract)
- Unjust enrichment: BGB §812
- Tort claim: BGB §823

⚖️ This information does not constitute legal advice.
```

❌ **Wrong Response:**
```
You should file a claim/lawsuit for the money.
```
(Confuses the right with the legal action!)

---

### Example 6: Default vs. Delay

**User Query:** "The payment is late. Is this Verzug?"

✅ **Correct Response:**
```
Late payment may constitute Verzug (default), but requirements must be met:

**Requirements for Verzug (BGB §286)**:
1. Fälligkeit - Payment was due
2. Mahnung - Creditor sent formal demand (unless calendar-fixed)
3. Schuldnerverzug - Debtor failed to pay after demand
4. No valid excuse for non-payment

**Consequences of Verzug**:
- Verzugszinsen (default interest): 5% above base rate (consumers)
- Schadensersatz (damages) for delay
- Creditor can sue for performance
- In contracts: may lead to Kündigung (termination)

**Not Yet Verzug?**
- If no Mahnung sent: Send formal demand first
- If payment just late: Wait for Mahnung period (typically 7-14 days)

⚖️ This information does not constitute legal advice.
```

❌ **Wrong Response:**
```
Yes, this is delay. You can sue immediately.
```
(Misses the Mahnung requirement!)

---

## High-Stakes Term Mappings

### Criminal Law Terms

| German | Correct English | Wrong English | Notes |
|--------|-----------------|---------------|-------|
| Mord | Murder | Homicide | Specific intent killing |
| Totschlag | Manslaughter | Murder | Intentional but not Mord |
| Körperverletzung | Assault/Bodily Harm | Battery | §223 StGB |
| Diebstahl | Theft | Larceny | §242 StGB |
| Betrug | Fraud | Scam | §263 StGB |
| Urkundenfälschung | Forgery | Document fraud | §267 StGB |
| Hehlerei | Handling Stolen Goods | Fencing | §259 StGB |
| Nötigung | Coercion | Duress | §240 StGB |
| Erpressung | Extortion | Blackmail | §253 StGB |
| Hausfriedensbruch | Trespassing | Burglary | §123 StGB |

---

### Civil Procedure Terms

| German | Correct English | Wrong English | Notes |
|--------|-----------------|---------------|-------|
| Klage | Statement of Claim | Lawsuit | Initial pleading |
| Klageerwiderung | Statement of Defense | Answer | Defendant's response |
| Beweisaufnahme | Taking of Evidence | Discovery | Not US-style discovery |
| Urteil | Judgment | Verdict | Civil court decision |
| Vollstreckung | Enforcement | Execution | Enforcing judgment |
| Arrest | Preliminary Attachment | Arrest | Civil, not criminal |
| Einstweilige Verfügung | Preliminary Injunction | TRO | Interim relief |

---

### Contract Law Terms

| German | Correct English | Wrong English | Notes |
|--------|-----------------|---------------|-------|
| Werkvertrag | Contract for Work | Service Contract | §631 BGB |
| Dienstvertrag | Service Contract | Employment | §611 BGB |
| Kaufvertrag | Sales Contract | Purchase | §433 BGB |
| Mietvertrag | Rental/Lease Contract | Lease | §535 BGB |
| Darlehensvertrag | Loan Contract | Credit Agreement | §488 BGB |
| Bürgschaft | Surety/Guaranty | Guarantee | §765 BGB |
| Pfandrecht | Pledge/Lien | Mortgage | Security interest |

---

### Family Law Terms

| German | Correct English | Wrong English | Notes |
|--------|-----------------|---------------|-------|
| Sorgerecht | Custody/Parental Responsibility | Guardianship | §1626 BGB |
| Umgangsrecht | Contact/Visitation | Visitation | §1684 BGB |
| Unterhalt | Maintenance/Support | Alimony only | Can be child or spousal |
| Zugewinngemeinschaft | Community of Accrued Gains | Community Property | Default marital regime |
| Versorgungsausgleich | Pension Equalization | Alimony | Division of pensions |
| Ehevertrag | Prenuptial Agreement | Marriage Contract | §1408 BGB |

---

## Usage Guidelines

### For AI Responses

1. **Always use correct translations** from this table
2. **Include German term in parentheses** on first use
3. **Explain the distinction** if confusion is likely
4. **Never use the "Wrong English" column** terms for German concepts

### For Translation Prompts

```yaml
translation_rules:
  - always_check_false_friends: true
  - include_german_original: true
  - explain_if_ambiguous: true
  - use_table_mapping: mandatory
```

### For Quality Assurance

```python
FALSE_FRIEND_CHECKS = {
    "Besitz": "possession",  # NOT ownership
    "Eigentum": "ownership",  # NOT possession
    "Kündigung": "notice of termination",  # NOT just "termination"
    "Bußgeld": "administrative fine",  # NOT "criminal fine"
    "Gewährleistung": "statutory warranty",  # NOT "guarantee"
    "Anspruch": "entitlement",  # NOT necessarily "lawsuit"
}

def validate_translation(german: str, english: str) -> bool:
    """Validate translation against false friends table."""
    if german in FALSE_FRIEND_CHECKS:
        correct = FALSE_FRIEND_CHECKS[german]
        if correct not in english.lower():
            return False
    return True
```

---

## Document Information

**Document Version:** 1.0  
**Last Updated:** 2026-02-25  
**Maintained By:** German Law Vault Development Team  
**Review Schedule:** Quarterly  
**Priority:** Critical - These distinctions are legally significant
