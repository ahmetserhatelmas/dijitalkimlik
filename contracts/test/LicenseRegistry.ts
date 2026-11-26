import { expect } from "chai";
import { ethers } from "hardhat";

const HASH = ethers.id("agreement");
const RULES = ethers.id("rules");
const ASSET = ethers.id("asset");
const PROJECT = ethers.id("project");

describe("LicenseRegistry", () => {
  async function deploy() {
    const [owner, recorder, stranger] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("LicenseRegistry");
    const registry = await factory.deploy(recorder.address);
    return { registry, owner, recorder, stranger };
  }

  it("lets only the recorder create a record", async () => {
    const { registry, recorder, stranger } = await deploy();
    const licenseId = ethers.id("license-1");
    await expect(
      registry.connect(stranger).recordLicense(licenseId, HASH, RULES, ASSET, PROJECT),
    ).to.be.revertedWithCustomError(registry, "NotRecorder");

    await expect(registry.connect(recorder).recordLicense(licenseId, HASH, RULES, ASSET, PROJECT))
      .to.emit(registry, "LicenseRecorded");
    expect(await registry.verify(licenseId, HASH)).to.equal(true);
    expect(await registry.verify(licenseId, ethers.id("other"))).to.equal(false);
  });

  it("rejects duplicate license ids, empty hashes, and paused recording", async () => {
    const { registry, owner, recorder } = await deploy();
    const licenseId = ethers.id("license-2");
    await registry.connect(recorder).recordLicense(licenseId, HASH, RULES, ASSET, PROJECT);
    await expect(
      registry.connect(recorder).recordLicense(licenseId, HASH, RULES, ASSET, PROJECT),
    ).to.be.revertedWithCustomError(registry, "DuplicateLicense");
    await expect(
      registry.connect(recorder).recordLicense(ethers.ZeroHash, HASH, RULES, ASSET, PROJECT),
    ).to.be.revertedWithCustomError(registry, "EmptyHash");

    await registry.connect(owner).setPaused(true);
    await expect(
      registry.connect(recorder).recordLicense(ethers.id("license-3"), HASH, RULES, ASSET, PROJECT),
    ).to.be.revertedWithCustomError(registry, "IsPaused");
  });

  it("restricts recorder rotation, ownership, and the successor pointer to the owner", async () => {
    const { registry, owner, recorder, stranger } = await deploy();
    await expect(registry.connect(stranger).setRecorder(stranger.address)).to.be.revertedWithCustomError(registry, "NotOwner");
    await expect(registry.connect(stranger).setSuccessor(stranger.address)).to.be.revertedWithCustomError(registry, "NotOwner");
    await registry.connect(owner).setRecorder(stranger.address);
    expect(await registry.recorder()).to.equal(stranger.address);
    await registry.connect(owner).setSuccessor(recorder.address);
    expect(await registry.successor()).to.equal(recorder.address);
    await registry.connect(owner).transferOwnership(stranger.address);
    expect(await registry.owner()).to.equal(stranger.address);
  });
});
