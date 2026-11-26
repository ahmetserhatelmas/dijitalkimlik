export type ChainWrite = {
  licenseId: string;
  agreementHashHex: string;
  ruleSnapshotHashHex: string;
  assetReferenceHex: string;
  projectReferenceHex: string;
};

export type ChainReceipt = {
  txHash: string;
  chainId: number;
  contractAddress: string;
};

export interface ChainClient {
  readonly configured: boolean;
  recordLicense(input: ChainWrite): Promise<ChainReceipt>;
  verify(input: { licenseId: string; agreementHashHex: string }): Promise<boolean | null>;
}

export class UnconfiguredChainClient implements ChainClient {
  readonly configured = false;

  async recordLicense(): Promise<ChainReceipt> {
    throw new Error("Blockchain signer is not configured.");
  }

  async verify(): Promise<null> {
    return null;
  }
}
