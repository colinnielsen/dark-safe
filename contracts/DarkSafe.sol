// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.19;

import "@gnosis.pm/zodiac/contracts/core/Module.sol";
import "@gnosis.pm/safe-contracts/contracts/GnosisSafe.sol";

contract UltraPlonkVerifier {
    /// @notice stub
    function verify(bytes memory) public pure returns (bool) {
        return true;
    }
}

contract DarkSafe is Module, UltraPlonkVerifier {
    /// @notice the hash of the polynomial 
    bytes32 public polynomialCommitment;

    error PROOF_VERIFICATION_FAILED();

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

    function _execute(address to, uint256 value, bytes calldata data, Enum.Operation operation, bytes memory proof)
        internal
        returns (bool success, bytes memory returnData)
    {
        GnosisSafe safe = GnosisSafe(payable(address(avatar)));
        bytes32 safeTxHash =
            safe.getTransactionHash(to, value, data, operation, 0, 0, 0, address(0), payable(0), safe.nonce());

        if (!verify(abi.encodePacked(abi.encodePacked(safeTxHash, polynomialCommitment), proof))) {
            revert PROOF_VERIFICATION_FAILED();
        }

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

    function rotateSigners(bytes32 newCommitiment) public onlyOwner {
        polynomialCommitment = newCommitiment;
    }
}
