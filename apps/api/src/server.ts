import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createApp } from "./app.js";
import { EthersChainClient } from "./chain/ethers.js";
import { UnconfiguredChainClient } from "./chain/types.js";
import { loadConfig } from "./config.js";
import { IyzicoPaymentProvider } from "./payments/iyzico.js";
import { SandboxPaymentProvider } from "./payments/sandbox.js";
import { createPgDatabase } from "./repos/pg.js";
import { MemoryRepository } from "./repos/memory.js";
import { PostgresRepository } from "./repos/postgres.js";
import { seedDemoCast } from "./demo-cast.js";
import { seedDemoData } from "./seed.js";
import { MemoryStorageService } from "./storage/memory.js";
import { SupabaseStorageService } from "./storage/supabase.js";

loadEnvFile();

const config = loadConfig();
const repo = config.databaseUrl ? new PostgresRepository(createPgDatabase(config.databaseUrl)) : new MemoryRepository(config.dataFile);
const storage = config.storageProvider === "supabase"
  ? new SupabaseStorageService(config.supabaseUrl, config.supabaseServiceRoleKey, config.buckets)
  : new MemoryStorageService(path.resolve(config.storageRoot), config.apiPublicUrl, config.devJwtSecret);
const payments = config.paymentProvider === "iyzico"
  ? new IyzicoPaymentProvider({
      apiKey: config.iyzicoApiKey,
      secretKey: config.iyzicoSecretKey,
      baseUrl: config.iyzicoBaseUrl,
      callbackUrl: config.iyzicoCallbackUrl,
    })
  : new SandboxPaymentProvider(config.paymentWebhookSecret, config.apiPublicUrl);
const chain = config.blockchainRpcUrl && config.blockchainContractAddress && config.blockchainSignerPrivateKey
  ? new EthersChainClient(config.blockchainRpcUrl, config.blockchainChainId, config.blockchainContractAddress, config.blockchainSignerPrivateKey)
  : new UnconfiguredChainClient();

const runtime = createApp({ config, repo, storage, payments, chain });

await seedDemoData({
  config,
  repo,
  accounts: runtime.accounts,
  assets: runtime.assets,
  rules: runtime.rules,
  licenses: runtime.licenses,
});
await seedDemoCast({
  config,
  repo,
  accounts: runtime.accounts,
  assets: runtime.assets,
  rules: runtime.rules,
});

runtime.app.listen(config.port, () => {
  console.log(`Suret API listening on ${config.apiPublicUrl}`);
  console.log(`Auth: ${config.allowDevAuth ? "development" : "supabase"} | Storage: ${storage.name} | Payments: ${payments.name} | Chain: ${chain.configured ? "configured" : "not configured"}`);
});

function loadEnvFile(): void {
  const candidates = [path.resolve(process.cwd(), ".env"), path.resolve(process.cwd(), "../../.env")];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator < 0) continue;
      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  }
}
