// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import "safe-tools/SafeTestTools.sol";
import "forge-std/Test.sol";
import {DeployScript} from "../script/Deploy.s.sol";
import {DarkSafe} from "../DarkSafe.sol";
import {DarkSafeVerifier} from "../Verifier.sol";
import {ModuleProxyFactory} from "zodiac/factory/ModuleProxyFactory.sol";

contract DarkSafeTest is Test, SafeTestTools {
    using SafeTestLib for SafeInstance;

    address private alice = address(0xA11c3);
    DarkSafe private darkSafeSingleton;
    DarkSafeVerifier private verifier;
    ModuleProxyFactory private moduleProxyFactory;

    function setUp() public {
        (verifier, darkSafeSingleton, moduleProxyFactory) = (new DeployScript()).run();
    }

    function _readJSONInput(string memory _path) internal view returns (bytes memory) {
        string memory root = vm.projectRoot();
        string memory path = string.concat(root, "/contracts/inputs/", _path);
        string memory json = vm.readFile(path);
        bytes memory data = vm.parseJson(json);

        return data;
    }

    struct PolynomialJSON {
        bytes32[] polynomial;
        bytes32 polynomial_hash;
    }

    function _getPolynomialInput() internal view returns (PolynomialJSON memory) {
        bytes memory data = _readJSONInput("polynomial.json");
        return abi.decode(data, (PolynomialJSON));
    }

    function _loadProof() internal view returns (bytes memory proof) {
        return vm.parseBytes(vm.readFile("circuits/proofs/dark_safe.proof"));
    }

    function _setupDarkSafe(PolynomialJSON memory polynomialInput) internal returns (DarkSafe) {
        // setup the safe
        uint256[] memory ownerPKs = new uint256[](1);
        ownerPKs[0] = 12345;

        SafeInstance memory safeInstance = _setupSafe({
            ownerPKs: ownerPKs,
            threshold: 1,
            initialBalance: 1 ether,
            advancedParams: AdvancedSafeInitParams({
                includeFallbackHandler: true,
                initData: "",
                saltNonce: 100,
                setupModulesCall_to: address(0),
                setupModulesCall_data: "",
                refundAmount: 0,
                refundToken: address(0),
                refundReceiver: payable(address(0))
            })
        });

        // setup the dark safe module
        bytes memory darkSafeModuleSetupCall = abi.encodeWithSelector(
            DarkSafe.setUp.selector,
            abi.encode(safeInstance.safe, polynomialInput.polynomial_hash, polynomialInput.polynomial)
        );

        // expect the signers rotated event to be emitted
        vm.expectEmit(true, true, true, true);
        emit DarkSafe.SignersRotated(polynomialInput.polynomial_hash, polynomialInput.polynomial);

        // deploy a new module proxy off the master copy
        address darkSafeModule = moduleProxyFactory.deployModule({
            masterCopy: address(darkSafeSingleton),
            initializer: darkSafeModuleSetupCall,
            saltNonce: 0
        });

        // enable the module on the safe
        safeInstance.enableModule(darkSafeModule);

        return DarkSafe(darkSafeModule);
    }

    function test_e2e() public {
        // get the polynomial
        (PolynomialJSON memory polynomialInput) = _getPolynomialInput();

        // set up the safe
        DarkSafe darkSafe = _setupDarkSafe(polynomialInput);

        // check the polynomial hash was saved
        assertEq(darkSafe.polynomialHash(), polynomialInput.polynomial_hash);

        bytes memory proof = _loadProof();

        darkSafe.exec({to: address(0xA11c3), value: 1 ether, data: "", operation: Enum.Operation.Call, proof: proof});

        assertEq(address(0xA11c3).balance, 1 ether);
    }
}
