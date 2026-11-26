import { ethers } from "hardhat";

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("No deployer account. Start the local chain and pass a funded signer.");
  const factory = await ethers.getContractFactory("LicenseRegistry");
  const contract = await factory.deploy(deployer.address);
  await contract.waitForDeployment();
  console.log(`LicenseRegistry ${await contract.getAddress()}`);
  console.log(`recorder ${deployer.address}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
