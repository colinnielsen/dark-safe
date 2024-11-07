// // SPDX-License-Identifier: MIT
// pragma solidity 0.8.27;

// import "safe-tools/SafeTestTools.sol";
// import "forge-std/Test.sol";

// import {DeployScript} from "../script/Deploy.s.sol";
// import {DarkSafeVerifier} from "../Verifier.sol";
// import {DarkSafe} from "../DarkSafe.sol";
// import {DarkSafeFactory} from "../utils/DarkSafeFactory.sol";

// contract DarkSafeTest is Test, SafeTestTools {
//     using SafeTestLib for SafeInstance;

//     address private alice = address(0xA11c3);
//     DarkSafeFactory private darkSafeFactory;
//     DarkSafeVerifier private verifier;

//     function setUp() public {
//         (darkSafeFactory, verifier) = (new DeployScript()).run();
//     }

//     function test() public {
//         uint256[] memory ownerPKs = new uint256[](1);
//         ownerPKs[0] = 12345;

//         SafeInstance memory safeInstance = _setupSafe({
//             ownerPKs: ownerPKs,
//             threshold: 1,
//             initialBalance: 1 ether,
//             advancedParams: AdvancedSafeInitParams({
//                 includeFallbackHandler: true,
//                 initData: "",
//                 saltNonce: 0,
//                 setupModulesCall_to: address(0),
//                 setupModulesCall_data: "",
//                 refundAmount: 0,
//                 refundToken: address(0),
//                 refundReceiver: payable(address(0))
//             })
//         });

//         DarkSafe darkSafeMo

//         safeInstance.execTransaction({to: alice, value: 0.5 ether, data: ""});

//         assertEq(alice.balance, 0.5 ether);
//     }
// }
