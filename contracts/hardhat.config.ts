import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    hardhat: {},
    localhost: { url: "http://127.0.0.1:8545" },
    baseSepolia: { url: process.env.BASE_SEPOLIA_RPC_URL || "", accounts: process.env.BLOCKCHAIN_SIGNER_PRIVATE_KEY ? [process.env.BLOCKCHAIN_SIGNER_PRIVATE_KEY] : [] },
    polygonAmoy: { url: process.env.POLYGON_AMOY_RPC_URL || "", accounts: process.env.BLOCKCHAIN_SIGNER_PRIVATE_KEY ? [process.env.BLOCKCHAIN_SIGNER_PRIVATE_KEY] : [] },
  },
};

export default config;
