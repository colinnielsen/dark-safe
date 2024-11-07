// // SPDX-License-Identifier: UNLICENSED
// pragma solidity 0.8.27;

// import {LibClone} from "solady/utils/LibClone.sol";

// import {DarkSafeVerifier} from "../Verifier.sol";
// import {DarkSafe} from "../DarkSafe.sol";

// contract DarkSafeFactory {
//     DarkSafeVerifier public immutable verifier;
//     DarkSafe public immutable singleton;

//     constructor(DarkSafeVerifier _verifier) {
//         verifier = _verifier;
//         singleton = new DarkSafe({_safe: address(0x01), _polynomialCommitiment: bytes32(0), _verifier: verifier});
//     }

//     function create(address _safe, bytes32 _polynomialHash) external returns (DarkSafe) {
//         DarkSafe darkSafe = DarkSafe(
//             LibClone.cloneDeterministic(address(singleton), keccak256(abi.encode(_safe, _polynomialHash)))
//         );

//         return darkSafe;
//     }
// }
