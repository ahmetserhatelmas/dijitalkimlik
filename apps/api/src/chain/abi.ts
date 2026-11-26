export const licenseRegistryAbi = [
  "function recordLicense(bytes32 licenseId, bytes32 agreementHash, bytes32 ruleSnapshotHash, bytes32 assetReference, bytes32 projectReference)",
  "function verify(bytes32 licenseId, bytes32 agreementHash) view returns (bool)",
  "function exists(bytes32) view returns (bool)",
  "event LicenseRecorded(bytes32 indexed licenseId, bytes32 agreementHash, bytes32 ruleSnapshotHash, bytes32 assetReference, bytes32 projectReference, address recorder)",
] as const;
