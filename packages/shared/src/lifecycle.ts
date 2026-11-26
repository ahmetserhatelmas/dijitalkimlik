import type { ChainStatus, LicenseStatus, Party, PaymentStatus } from "./domain";

const TRANSITIONS: Record<LicenseStatus, readonly LicenseStatus[]> = {
  draft: ["pending_consent", "rejected", "cancelled"],
  pending_consent: ["approved", "rejected", "cancelled"],
  approved: ["signed", "cancelled"],
  signed: ["payment_pending", "recording", "cancelled"],
  payment_pending: ["recording", "cancelled", "refund_pending"],
  recording: ["active", "recording_failed"],
  recording_failed: ["recording", "cancelled"],
  active: ["expired", "disputed", "suspended", "refund_pending"],
  rejected: [],
  cancelled: [],
  expired: ["disputed"],
  refund_pending: ["refunded", "disputed"],
  refunded: [],
  disputed: ["active", "suspended", "cancelled"],
  suspended: ["active", "cancelled"],
};

export function canTransition(from: LicenseStatus, to: LicenseStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export type ActivationInput = {
  consents: { party: Party }[];
  signatures: { party: Party; agreementHash: string }[];
  expectedHash: string;
  paymentStatus: PaymentStatus | null;
  paymentRequired: boolean;
  chainStatus: ChainStatus | null;
  chainRequired: boolean;
};

export function activationBlockers(input: ActivationInput): string[] {
  const blockers: string[] = [];
  if (!input.consents.some((item) => item.party === "licensor")) blockers.push("Licensor consent is missing.");
  if (!input.consents.some((item) => item.party === "licensee")) blockers.push("Licensee consent is missing.");
  if (!input.signatures.some((item) => item.party === "licensor" && item.agreementHash === input.expectedHash)) {
    blockers.push("Licensor signature for this agreement hash is missing.");
  }
  if (!input.signatures.some((item) => item.party === "licensee" && item.agreementHash === input.expectedHash)) {
    blockers.push("Licensee signature for this agreement hash is missing.");
  }
  if (input.paymentRequired && input.paymentStatus !== "succeeded" && input.paymentStatus !== "not_required") {
    blockers.push("Payment has not been confirmed by the server.");
  }
  if (input.chainRequired && input.chainStatus !== "confirmed") {
    blockers.push("The blockchain record is not confirmed.");
  }
  return blockers;
}

export function readyForRecording(input: Omit<ActivationInput, "chainStatus" | "chainRequired">): string[] {
  return activationBlockers({ ...input, chainStatus: "confirmed", chainRequired: false }).filter(
    (item) => !item.includes("blockchain"),
  );
}
