// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.19;

import "@gnosis.pm/zodiac/contracts/core/Module.sol";
import "@gnosis.pm/safe-contracts/contracts/GnosisSafe.sol";
import {UltraVerifier} from "./Verifier.sol";

contract DarkSafe is Module {
    /// @notice the hash of the polynomial
    bytes32 public polynomialCommitment;
    UltraVerifier verifier = new UltraVerifier();

    error PROOF_VERIFICATION_FAILED();

    /// @dev emit the polynomial commitiment and the polynomial as an easy way to
    ///     decentralize the polynomial for later proof generation
    event SignersRotated(bytes32 indexed polynomialCommitment, bytes32[] polynomial);

    constructor(address _safe, bytes32 _polynomialCommitiment) {
        setUp(abi.encode(_safe, _polynomialCommitiment));
    }

    /// @dev a setup function to ensure factory friendly compatibility
    function setUp(bytes memory initializeParams) public override initializer {
        (address _safe, bytes32 _polynomialCommitiment) = abi.decode(initializeParams, (address, bytes32));

        __Ownable_init();
        setAvatar(_safe);
        setTarget(_safe);
        transferOwnership(_safe);

        polynomialCommitment = _polynomialCommitiment;
    }

    /// @dev updates polynomialCommitiment, thus changing the valid signer sets
    function updateSigners(bytes32 newCommitiment, bytes32[] memory polynomial) public onlyOwner {
        polynomialCommitment = newCommitiment;

        emit SignersRotated(newCommitiment, polynomial);
    }

    function _execute(address to, uint256 value, bytes calldata data, Enum.Operation operation, bytes memory proof)
        internal
        returns (bool success, bytes memory returnData)
    {
        GnosisSafe safe = GnosisSafe(payable(address(avatar)));
        bytes32 safeTxHash =
            safe.getTransactionHash(to, value, data, operation, 0, 0, 0, address(0), payable(0), safe.nonce());

        bytes32[] memory publicInputs = new bytes32[](2);
        publicInputs[0] = safeTxHash;
        publicInputs[1] = polynomialCommitment;

        if (verifier.verify(proof, publicInputs) == false) revert PROOF_VERIFICATION_FAILED();

        (success, returnData) = execAndReturnData(to, value, data, operation);
    }

    /// @notice execute a safe call on the `target` with `proof` data instead of the safe message
    /// @return success if the call succeeded
    /// @return returnData any return data from the callee
    function execAndReturnData(
        address to,
        uint256 value,
        bytes calldata data,
        Enum.Operation operation,
        bytes memory proof
    ) external returns (bool success, bytes memory returnData) {
        (success, returnData) = _execute(to, value, data, operation, proof);
    }

    /// @notice execute a safe call on the `target` with `proof` data instead of the safe message
    /// @return success if the call succeeded
    function exec(address to, uint256 value, bytes calldata data, Enum.Operation operation, bytes memory proof)
        external
        returns (bool success)
    {
        (success,) = _execute(to, value, data, operation, proof);
    }
}
