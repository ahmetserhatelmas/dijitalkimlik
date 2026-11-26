export type AppConfig = {
  nodeEnv: string;
  port: number;
  apiPublicUrl: string;
  webPublicUrl: string;
  corsOrigins: string[];
  allowDevAuth: boolean;
  devJwtSecret: string;
  devLoginPassword: string;
  seedDemoData: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  supabaseJwtSecret: string;
  databaseUrl: string;
  storageProvider: "memory" | "supabase";
  storageRoot: string;
  buckets: { originals: string; previews: string; evidence: string };
  paymentProvider: "sandbox" | "iyzico";
  paymentWebhookSecret: string;
  allowSandboxInProduction: boolean;
  iyzicoApiKey: string;
  iyzicoSecretKey: string;
  iyzicoBaseUrl: string;
  iyzicoCallbackUrl: string;
  blockchainRpcUrl: string;
  blockchainChainId: number;
  blockchainContractAddress: string;
  blockchainSignerPrivateKey: string;
  dataFile: string;
};

function stringValue(env: NodeJS.ProcessEnv, key: string, fallback = ""): string {
  return env[key]?.trim() || fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = stringValue(env, "NODE_ENV", "development");
  const paymentProvider = stringValue(env, "PAYMENT_PROVIDER", "sandbox") === "iyzico" ? "iyzico" : "sandbox";
  const storageProvider = stringValue(env, "STORAGE_PROVIDER", "memory") === "supabase" ? "supabase" : "memory";
  const config: AppConfig = {
    nodeEnv,
    port: Number(stringValue(env, "API_PORT", "4000")),
    apiPublicUrl: stringValue(env, "API_PUBLIC_URL", "http://localhost:4000").replace(/\/$/, ""),
    webPublicUrl: stringValue(env, "WEB_PUBLIC_URL", "http://localhost:3000").replace(/\/$/, ""),
    corsOrigins: stringValue(env, "CORS_ORIGINS", "http://localhost:3000,http://localhost:8081")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    allowDevAuth: stringValue(env, "ALLOW_DEV_AUTH", nodeEnv === "production" ? "false" : "true") === "true",
    devJwtSecret: stringValue(env, "DEV_JWT_SECRET", "dev-only-secret-change-me"),
    devLoginPassword: stringValue(env, "DEV_LOGIN_PASSWORD", "dev-only-password"),
    seedDemoData: stringValue(env, "SEED_DEMO_DATA", "false") === "true",
    supabaseUrl: stringValue(env, "SUPABASE_URL"),
    supabaseAnonKey: stringValue(env, "SUPABASE_ANON_KEY"),
    supabaseServiceRoleKey: stringValue(env, "SUPABASE_SERVICE_ROLE_KEY"),
    supabaseJwtSecret: stringValue(env, "SUPABASE_JWT_SECRET"),
    databaseUrl: stringValue(env, "DATABASE_URL"),
    storageProvider,
    storageRoot: stringValue(env, "STORAGE_ROOT", "data/storage"),
    buckets: {
      originals: stringValue(env, "SUPABASE_STORAGE_BUCKET_ORIGINALS", "face-originals"),
      previews: stringValue(env, "SUPABASE_STORAGE_BUCKET_PREVIEWS", "face-previews"),
      evidence: stringValue(env, "SUPABASE_STORAGE_BUCKET_EVIDENCE", "evidence"),
    },
    paymentProvider,
    paymentWebhookSecret: stringValue(env, "PAYMENT_WEBHOOK_SECRET", "dev-webhook-secret"),
    allowSandboxInProduction: stringValue(env, "ALLOW_SANDBOX_IN_PRODUCTION", "false") === "true",
    iyzicoApiKey: stringValue(env, "IYZICO_API_KEY"),
    iyzicoSecretKey: stringValue(env, "IYZICO_SECRET_KEY"),
    iyzicoBaseUrl: stringValue(env, "IYZICO_BASE_URL", "https://sandbox-api.iyzipay.com").replace(/\/$/, ""),
    iyzicoCallbackUrl: stringValue(env, "IYZICO_CALLBACK_URL"),
    blockchainRpcUrl: stringValue(env, "BLOCKCHAIN_RPC_URL"),
    blockchainChainId: Number(stringValue(env, "BLOCKCHAIN_CHAIN_ID", "31337")),
    blockchainContractAddress: stringValue(env, "BLOCKCHAIN_CONTRACT_ADDRESS"),
    blockchainSignerPrivateKey: stringValue(env, "BLOCKCHAIN_SIGNER_PRIVATE_KEY"),
    dataFile: stringValue(env, "DATA_FILE", "data/dev-store.json"),
  };

  if (nodeEnv === "production" && config.allowDevAuth) {
    throw new Error("ALLOW_DEV_AUTH must be false in production.");
  }
  if (nodeEnv === "production" && config.paymentProvider === "sandbox" && !config.allowSandboxInProduction) {
    throw new Error("Sandbox payments are disabled in production. Configure iyzico or explicitly allow the sandbox.");
  }
  if (config.storageProvider === "supabase" && (!config.supabaseUrl || !config.supabaseServiceRoleKey)) {
    throw new Error("Supabase Storage requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  if (!config.allowDevAuth && (!config.supabaseUrl || !config.supabaseAnonKey || !config.supabaseServiceRoleKey)) {
    throw new Error("Supabase Auth requires SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.");
  }
  if (config.paymentProvider === "iyzico" && (!config.iyzicoApiKey || !config.iyzicoSecretKey)) {
    throw new Error("PAYMENT_PROVIDER=iyzico requires IYZICO_API_KEY and IYZICO_SECRET_KEY.");
  }
  return config;
}
