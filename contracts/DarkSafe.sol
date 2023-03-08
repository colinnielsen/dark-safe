// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.15;

import "@gnosis.pm/zodiac/contracts/core/Module.sol";
import "@gnosis.pm/safe-contracts/contracts/GnosisSafe.sol";

contract UltraPlonkVerifier {
    /// @notice stub
    function verify(bytes memory) public pure returns (bool) {
        return true;
    }
}

contract DarkSafe is Module, UltraPlonkVerifier {
    bytes32 public merkleRoot;

    error PROOF_VERIFICATION_FAILED();

    constructor(address _safe) {
        bytes memory initParams = abi.encode(_safe);
        setUp(initParams);
    }

    function setUp(bytes memory initializeParams) public override initializer {
        __Ownable_init();
        address _safe = abi.decode(initializeParams, (address));

        setAvatar(_safe);
        setTarget(_safe);
        transferOwnership(_safe);
    }

    function execute(
        bytes memory proof,
        address to,
        uint256 value,
        bytes calldata data,
        Enum.Operation operation
    ) external returns (bytes memory returnData) {
        GnosisSafe safe = GnosisSafe(payable(address(avatar)));
        bytes32 safeTxHash = safe.getTransactionHash(
            to,
            value,
            data,
            operation,
            0,
            0,
            0,
            address(0),
            payable(0),
            safe.nonce()
        );

        if (
            !verify(
                abi.encodePacked(
                    abi.encodePacked(merkleRoot, safeTxHash),
                    proof
                )
            )
        ) revert PROOF_VERIFICATION_FAILED();

        (, returnData) = execAndReturnData(to, value, data, operation);
    }
}
