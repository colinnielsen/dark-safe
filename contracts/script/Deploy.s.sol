// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.19;

import {Script} from "forge-std/Script.sol";
import {ModuleProxyFactory} from "zodiac/factory/ModuleProxyFactory.sol";

import {DarkSafeVerifier} from "../Verifier.sol";
import {DarkSafe} from "../DarkSafe.sol";

contract DeployScript is Script {
    function run()
        public
        returns (DarkSafeVerifier verifier, DarkSafe darkSafeSingleton, ModuleProxyFactory moduleProxyFactory)
    {
        vm.startBroadcast();

        // Deploy Verifier
        verifier = new DarkSafeVerifier();

        bytes32[] memory polynomial = new bytes32[](0);

        // Deploy DarkSafe singleton
        darkSafeSingleton = new DarkSafe({
            _safe: address(0x01),
            _polynomialHash: bytes32(0),
            _polynomial: polynomial,
            _verifier: verifier
        });

        // Deploy ModuleProxyFactory
        moduleProxyFactory = new ModuleProxyFactory();

        vm.stopBroadcast();
    }
}
