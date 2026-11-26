// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title LicenseRegistry
/// @notice Anchors privacy-preserving hashes of accepted likeness agreements.
///         It does not store photos, names, signatures, or agreement text.
///         A recorded hash is evidence that this payload was submitted by an
///         authorized recorder. It is not proof of identity, ownership, or
///         that a license is still active.
contract LicenseRegistry {
    struct Record {
        bytes32 agreementHash;
        bytes32 ruleSnapshotHash;
        bytes32 assetReference;
        bytes32 projectReference;
        uint64 recordedAt;
        address recorder;
    }

    address public owner;
    address public recorder;
    address public successor;
    bool public paused;
    uint256 public constant VERSION = 1;

    mapping(bytes32 => Record) private records;
    mapping(bytes32 => bool) public exists;

    event LicenseRecorded(
        bytes32 indexed licenseId,
        bytes32 agreementHash,
        bytes32 ruleSnapshotHash,
        bytes32 assetReference,
        bytes32 projectReference,
        address recorder
    );
    event RecorderChanged(address indexed previousRecorder, address indexed nextRecorder);
    event Paused(bool paused);
    event SuccessorSet(address indexed successor);
    event OwnershipTransferred(address indexed previousOwner, address indexed nextOwner);

    error NotOwner();
    error NotRecorder();
    error IsPaused();
    error DuplicateLicense();
    error EmptyHash();
    error ZeroAddress();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyRecorder() {
        if (msg.sender != recorder) revert NotRecorder();
        _;
    }

    constructor(address recorder_) {
        if (recorder_ == address(0)) revert ZeroAddress();
        owner = msg.sender;
        recorder = recorder_;
    }

    function transferOwnership(address nextOwner) external onlyOwner {
        if (nextOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, nextOwner);
        owner = nextOwner;
    }

    function setRecorder(address nextRecorder) external onlyOwner {
        if (nextRecorder == address(0)) revert ZeroAddress();
        emit RecorderChanged(recorder, nextRecorder);
        recorder = nextRecorder;
    }

    function setPaused(bool nextPaused) external onlyOwner {
        paused = nextPaused;
        emit Paused(nextPaused);
    }

    /// @notice Points verifiers at a replacement contract. Old records stay here.
    function setSuccessor(address nextSuccessor) external onlyOwner {
        successor = nextSuccessor;
        emit SuccessorSet(nextSuccessor);
    }

    function recordLicense(
        bytes32 licenseId,
        bytes32 agreementHash,
        bytes32 ruleSnapshotHash,
        bytes32 assetReference,
        bytes32 projectReference
    ) external onlyRecorder {
        if (paused) revert IsPaused();
        if (licenseId == bytes32(0) || agreementHash == bytes32(0)) revert EmptyHash();
        if (exists[licenseId]) revert DuplicateLicense();

        records[licenseId] = Record({
            agreementHash: agreementHash,
            ruleSnapshotHash: ruleSnapshotHash,
            assetReference: assetReference,
            projectReference: projectReference,
            recordedAt: uint64(block.timestamp),
            recorder: msg.sender
        });
        exists[licenseId] = true;

        emit LicenseRecorded(licenseId, agreementHash, ruleSnapshotHash, assetReference, projectReference, msg.sender);
    }

    function getRecord(bytes32 licenseId) external view returns (Record memory) {
        return records[licenseId];
    }

    function verify(bytes32 licenseId, bytes32 agreementHash) external view returns (bool) {
        return exists[licenseId] && records[licenseId].agreementHash == agreementHash;
    }
}
