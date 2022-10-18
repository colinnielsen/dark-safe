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

async function main() {
  const message = process.argv[2];
  const build = process.argv[3];

  const wallet = new ethers.Wallet(
    "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
  );

  const digest = ethers.utils.hashMessage(message);
  console.log({ digest });

  const signature = await wallet.signMessage(message);

  let pubKey = ethers.utils.recoverPublicKey(digest, signature).slice(4); // remove 0x04
  let publicKeyX = pubKey.substring(0, 64);
  let publicKeyY = pubKey.substring(64);

  const abi = {
    publicKeyX: hexToUint8Array(publicKeyX),
    publicKeyY: hexToUint8Array(publicKeyY),
    signature: Uint8Array.from(
      Buffer.from(signature.slice(2).slice(0, 128), "hex")
    ),
    hashedMessage: hexToUint8Array(digest.slice(2)),
  };

  Object.entries(abi).forEach(([key, value]) => {
    console.log(key, value.toString());
  });

  const proverToml = `publicKeyX = [${abi.publicKeyX}]\npublicKeyY = [${abi.publicKeyY}]\nsignature = [${abi.signature}]\nhashedMessage = [${abi.hashedMessage}]`;

  const verifierToml = `hashedMessage = [${abi.hashedMessage}]\nsetpub = []`;
  fs.writeFileSync("Prover.toml", proverToml);
  fs.writeFileSync("Verifier.toml", verifierToml);

  // let acir = acir_from_bytes(
  //   path_to_uint8array(
  //     path.resolve(__dirname, `../circuits/build/${build}.acir`)
  //   )
  // );
  // let [prover, verifier] = await setup_generic_prover_and_verifier(acir);
  // console.log("Creating proof...");
  // const proof = await create_proof(prover, acir, abi);
  // console.log("Verifying proof...");
  // const verified = await verify_proof(verifier, proof);

  // console.log("Proof : ", proof.toString("hex"));
  // console.log("Is the proof valid : ", verified);
}

main()
  .then(() => process.exit(0))
  .catch(console.log);
