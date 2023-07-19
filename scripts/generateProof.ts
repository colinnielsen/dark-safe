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

const compileWithNargo = (
  pub_key_x: string, // these are all hex strings
  pub_key_y: string,
  signature: string,
  hashed_message: string
) => {
  const abi = {
    pub_key_x: hexToUint8Array(pub_key_x),
    pub_key_y: hexToUint8Array(pub_key_y),
    signature: Uint8Array.from(
      Buffer.from(signature.slice(2).slice(0, 128), "hex")
    ),
    hashed_message: hexToUint8Array(hashed_message.slice(2)),
  };

  console.log("\x1b[35m%s\x1b[0m", "Writing to Prover/Verifier.toml: ");
  Object.entries(abi).forEach(([key, value]) => {
    console.log("\x1b[33m%s\x1b[0m", key, value.toString());
  });

  const proverToml = `pub_key_x = [${abi.pub_key_x}]\npub_key_y = [${abi.pub_key_y}]\nsignature = [${abi.signature}]\nhashed_message = [${abi.hashed_message}]`;

  const verifierToml = `hashed_message = [${abi.hashed_message}]\nsetpub = []`;
  fs.writeFileSync("Prover.toml", proverToml);
  fs.writeFileSync("Verifier.toml", verifierToml);
};

const compileWithWasm = async (
  buildName: string,
  pub_key_x: string, // these are all hex strings
  pub_key_y: string,
  signature: string,
  hashed_message: string
) => {
  let acir = acir_from_bytes(
    path_to_uint8array(
      path.resolve(__dirname, `../circuits/build/${buildName}.acir`)
    )
  );
  let [prover, verifier] = await setup_generic_prover_and_verifier(acir);

  console.log("Proof inputs:");
  const inputs = [
    "0x" + pub_key_x,
    "0x" + pub_key_y,
    signature.slice(0, -2), // slice off the V value
    hashed_message,
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
  const sender = new ethers.Wallet(
    "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
  );
  const digest = ethers.utils.hashMessage(message); // this hash digest of the message as defined in EIP -

  console.log("\x1b[34m%s\x1b[0m", "signing message 🖋: ", message);
  const signature = await sender.signMessage(message); // get the signature of the message, this will be 130 bytes (r, s, and v)
  console.log("\x1b[34m%s\x1b[0m", "signature 📝: ", signature);

  // recoverPublicKey returns `0x{hex"4"}{pubKeyXCoord}{pubKeyYCoord}` - so slice 0x04 to expose just the concatenated x and y
  let pubKey = ethers.utils.recoverPublicKey(digest, signature).slice(4);
  console.log("entire pub key ", pubKey);
  let pub_key_x = pubKey.substring(0, 64);
  let pub_key_y = pubKey.substring(64);
  console.log("\x1b[34m%s\x1b[0m", "public key x coordinate 📊: ", pub_key_x);
  console.log("\x1b[34m%s\x1b[0m", "public key y coordinate 📊: ", pub_key_y);

  // build based on cli input
  if (useNargo) compileWithNargo(pub_key_x, pub_key_y, signature, digest);
  else await compileWithWasm(build, pub_key_x, pub_key_y, signature, digest);
}

main()
  .then(() => process.exit(0))
  .catch(console.log);
