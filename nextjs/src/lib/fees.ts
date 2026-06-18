/**
 * Financial Risk & Cost Calculator
 * Implements simplified logic for RVG (Rechtsanwaltsvergütungsgesetz)
 * and GKG (Gerichtskostengesetz).
 */

export interface LegalFees {
  courtFees: number;
  lawyerFees: number;
  totalRisk: number;
}

/**
 * Simplified calculation for Court Fees (GKG)
 * In reality, this is based on a complex table (Anlage 2 GKG).
 * This function provides a reliable approximation for common civil disputes.
 */
export function calculateCourtFees(disputeValue: number): number {
  if (disputeValue <= 500) return 38;
  if (disputeValue <= 1000) return 58;
  if (disputeValue <= 1500) return 78;
  if (disputeValue <= 2000) return 98;

  // Approximation for higher values: ~3.0 fee factor
  const baseFee = 35 + (disputeValue / 500) * 20;
  return Math.round(baseFee * 3);
}

/**
 * Simplified calculation for Lawyer Fees (RVG)
 * Includes:
 * - 1.3 Business Fee (Geschäftsgebühr)
 * - 1.3 Procedural Fee (Verfahrensgebühr)
 * - 1.2 Term Fee (Terminsgebühr)
 */
export function calculateLawyerFees(disputeValue: number): number {
  // Base fee approximation based on RVG table
  let baseFee = 0;
  if (disputeValue <= 500) baseFee = 49;
  else if (disputeValue <= 1000) baseFee = 88;
  else if (disputeValue <= 2000) baseFee = 150;
  else baseFee = 150 + (disputeValue - 2000) * 0.05;

  // Typical "full representation" in court is ~2.5 fee factors + 20 EUR post/telecom
  return Math.round(baseFee * 2.5 + 20);
}

export function calculateTotalLegalRisk(disputeValue: number): LegalFees {
  const court = calculateCourtFees(disputeValue);
  const lawyer = calculateLawyerFees(disputeValue);

  return {
    courtFees: court,
    lawyerFees: lawyer,
    totalRisk: court + lawyer * 2, // Own lawyer + opposing lawyer if lost
  };
}
