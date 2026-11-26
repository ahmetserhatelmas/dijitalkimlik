import { Contract, JsonRpcProvider, Wallet } from "ethers";
import { licenseRegistryAbi } from "./abi.js";
import type { ChainClient, ChainReceipt, ChainWrite } from "./types.js";

export class EthersChainClient implements ChainClient {
  readonly configured = true;
  private readonly wallet: Wallet;
  private readonly contract: Contract;

  constructor(
    rpcUrl: string,
    private readonly chainId: number,
    contractAddress: string,
    privateKey: string,
  ) {
    const provider = new JsonRpcProvider(rpcUrl, chainId);
    this.wallet = new Wallet(privateKey, provider);
    this.contract = new Contract(contractAddress, licenseRegistryAbi, this.wallet);
  }

  async recordLicense(input: ChainWrite): Promise<ChainReceipt> {
    const tx = await this.contract.recordLicense?.(
      input.licenseId,
      input.agreementHashHex,
      input.ruleSnapshotHashHex,
      input.assetReferenceHex,
      input.projectReferenceHex,
    );
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error("The blockchain transaction was not confirmed.");
    return { txHash: receipt.hash, chainId: this.chainId, contractAddress: await this.contract.getAddress() };
  }

  async verify(input: { licenseId: string; agreementHashHex: string }): Promise<boolean> {
    return Boolean(await this.contract.verify?.(input.licenseId, input.agreementHashHex));
  }
}

export class MemoryChainClient implements ChainClient {
  readonly configured = true;
  readonly records = new Map<string, string>();
  failNext = false;
  chainId = 31337;
  contractAddress = "0x0000000000000000000000000000000000000abc";

  async recordLicense(input: ChainWrite): Promise<ChainReceipt> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("Simulated blockchain failure.");
    }
    if (this.records.has(input.licenseId)) throw new Error("Duplicate license.");
    this.records.set(input.licenseId, input.agreementHashHex.toLowerCase());
    return { txHash: `0x${crypto.randomUUID().replaceAll("-", "").padEnd(64, "0").slice(0, 64)}`, chainId: this.chainId, contractAddress: this.contractAddress };
  }

  async verify(input: { licenseId: string; agreementHashHex: string }): Promise<boolean> {
    return this.records.get(input.licenseId) === input.agreementHashHex.toLowerCase();
  }
}
