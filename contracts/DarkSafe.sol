// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.27;

import {Module, Enum as ZodiacEnum} from "zodiac/core/Module.sol";
import {Safe, Enum as SafeEnum} from "safe-contracts/Safe.sol";
import {DarkSafeVerifier} from "./Verifier.sol";

contract DarkSafe is Module {
    /// @notice the hash of the polynomial
    bytes32 public polynomialHash;
    DarkSafeVerifier public immutable verifier;
    bool public isMasterCopy;

    error PROOF_VERIFICATION_FAILED();
    error CANNOT_SETUP_MASTER_COPY();

    /// @dev emit the polynomial hash and the polynomial as an easy way to
    ///     decentralize the polynomial for later proof generation
    event SignersRotated(bytes32 indexed polynomialHash, bytes32[] polynomial);

    constructor(
        address _safe,
        bytes32 _polynomialHash,
        bytes32[] memory _polynomial,
        DarkSafeVerifier _verifier
    ) {
        setUp(abi.encode(_safe, _polynomialHash, _polynomial));
        verifier = _verifier;
        isMasterCopy = true;
    }

    /// @dev a setup function to ensure factory friendly compatibility
    function setUp(bytes memory initializeParams) public override initializer {
        if (isMasterCopy) revert CANNOT_SETUP_MASTER_COPY();
        (address _safe, bytes32 _polynomialHash, bytes32[] memory _polynomial) =
            abi.decode(initializeParams, (address, bytes32, bytes32[]));

        __Ownable_init();
        setAvatar(_safe);
        setTarget(_safe);
        transferOwnership(_safe);

        _updateSigners(_polynomialHash, _polynomial);
    }

    /// @dev updates polynomialHash, thus changing the valid signer sets
    function _updateSigners(bytes32 newHash, bytes32[] memory polynomial) internal {
        polynomialHash = newHash;

        emit SignersRotated(newHash, polynomial);
    }

    function updateSigners(bytes32 newHash, bytes32[] memory polynomial) external onlyOwner {
        _updateSigners(newHash, polynomial);
    }

    function _execute(address to, uint256 value, bytes calldata data, SafeEnum.Operation operation, bytes memory proof)
        internal
        returns (bool success, bytes memory returnData)
    {
        Safe safe = Safe(payable(address(avatar)));
        bytes32 safeTxHash =
            safe.getTransactionHash(to, value, data, operation, 0, 0, 0, address(0), payable(0), safe.nonce());

        bytes32[] memory publicInputs = new bytes32[](2);
        publicInputs[0] = safeTxHash;
        publicInputs[1] = polynomialHash;

        if (verifier.verify(proof, publicInputs) == false) revert PROOF_VERIFICATION_FAILED();

        (success, returnData) = execAndReturnData(to, value, data, ZodiacEnum.Operation(uint8(operation)));
    }

    /// @notice execute a safe call on the `target` with `proof` data instead of the safe message
    /// @return success if the call succeeded
    /// @return returnData any return data from the callee
    function execAndReturnData(
        address to,
        uint256 value,
        bytes calldata data,
        SafeEnum.Operation operation,
        bytes memory proof
    ) external returns (bool success, bytes memory returnData) {
        (success, returnData) = _execute(to, value, data, operation, proof);
    }

    /// @notice execute a safe call on the `target` with `proof` data instead of the safe message
    /// @return success if the call succeeded
    function exec(address to, uint256 value, bytes calldata data, SafeEnum.Operation operation, bytes memory proof)
        external
        returns (bool success)
    {
        (success,) = _execute(to, value, data, operation, proof);
    }
}
