import {
  create_proof,
  setup_generic_prover_and_verifier,
  verify_proof,
} from "@noir-lang/barretenberg/dest/client_proofs";
import { acir_from_bytes } from "@noir-lang/noir_wasm";
import { ethers } from "ethers";
import fs, { readFileSync } from "fs";
import path from "path";

function path_to_uint8array(path: string) {
  let buffer = readFileSync(path);
  return new Uint8Array(buffer);
}

const hexToUint8Array = (hex: string) =>
  Uint8Array.from(Buffer.from(hex, "hex"));

const buildNargoOutputs = (
  publicKeyX: string, // these are all hex strings
  publicKeyY: string,
  signature: string,
  hashedMessage: string
) => {
  const abi = {
    publicKeyX: hexToUint8Array(publicKeyX),
    publicKeyY: hexToUint8Array(publicKeyY),
    signature: Uint8Array.from(
      Buffer.from(signature.slice(2).slice(0, 128), "hex")
    ),
    hashedMessage: hexToUint8Array(hashedMessage.slice(2)),
  };

  console.log("\x1b[35m%s\x1b[0m", "Writing to Prover/Verifier.toml: ");
  Object.entries(abi).forEach(([key, value]) => {
    console.log("\x1b[33m%s\x1b[0m", key, value.toString());
  });

  const proverToml = `publicKeyX = [${abi.publicKeyX}]\npublicKeyY = [${abi.publicKeyY}]\nsignature = [${abi.signature}]\nhashedMessage = [${abi.hashedMessage}]`;

  const verifierToml = `hashedMessage = [${abi.hashedMessage}]\nsetpub = []`;
  fs.writeFileSync("Prover.toml", proverToml);
  fs.writeFileSync("Verifier.toml", verifierToml);
};

const compileWithWasm = async (
  buildName: string,
  publicKeyX: string, // these are all hex strings
  publicKeyY: string,
  signature: string,
  hashedMessage: string
) => {
  let acir = acir_from_bytes(
    path_to_uint8array(
      path.resolve(__dirname, `../circuits/build/${buildName}.acir`)
    )
  );
  let [prover, verifier] = await setup_generic_prover_and_verifier(acir);

  console.log("Proof inputs:");
  const inputs = [
    "0x" + publicKeyX,
    "0x" + publicKeyY,
    signature.slice(0, -2), // slice off the V value
    hashedMessage,
  ];

  console.log(inputs);

  console.log("Creating proof...");
  const proof = await create_proof(prover, acir, inputs);
  console.log("Verifying proof...");
  const verified = await verify_proof(verifier, proof);

  console.log("Proof : ", proof.toString("hex"));
  console.log("Is the proof valid : ", verified);
};

async function main() {
  const useNargo = process.argv[2] === "Nargo";
  const build = process.argv[3];
  const message = process.argv.slice(4).join(" ");

  // hardhat wallet 0
  const wallet = new ethers.Wallet(
    "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
  );

  console.log("\x1b[34m%s\x1b[0m", "signing message 🖋: ", message);
  const signature = await wallet.signMessage(message); // get the signature of the message, this will be 130 bytes (r, s, and v)
  console.log("\x1b[34m%s\x1b[0m", "signature 📝: ", signature);

  const digest = ethers.utils.hashMessage(message); // this hash digest of the message as defined in EIP -

  // recoverPublicKey returns `0x{hex"4"}{pubKeyXCoord}{pubKeyYCoord}` - so slice 0x04 to expose just the concatenated x and y
  let pubKey = ethers.utils.recoverPublicKey(digest, signature).slice(4);
  let publicKeyX = pubKey.substring(0, 64);
  let publicKeyY = pubKey.substring(64);
  console.log("\x1b[34m%s\x1b[0m", "public key x coordinate 📊: ", publicKeyX);
  console.log("\x1b[34m%s\x1b[0m", "public key y coordinate 📊: ", publicKeyY);

  // build based on cli input
  if (useNargo) buildNargoOutputs(publicKeyX, publicKeyY, signature, digest);
  else await compileWithWasm(build, publicKeyX, publicKeyY, signature, digest);
}

main()
  .then(() => process.exit(0))
  .catch(console.log);
