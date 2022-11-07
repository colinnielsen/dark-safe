import {
  create_proof,
  setup_generic_prover_and_verifier,
  verify_proof,
} from "@noir-lang/barretenberg/dest/client_proofs";
import { acir_from_bytes } from "@noir-lang/noir_wasm";
import { ethers, UnsignedTransaction } from "ethers";
import fs, { readFileSync } from "fs";
import path from "path";

export const toFixedHex = (number: number, pad0x: boolean, length = 32) => {
  let hexString = number.toString(16).padStart(length * 2, "0");
  return pad0x ? `0x` + hexString : hexString;
};

export const path_to_uint8array = (path: string) => {
  let buffer = readFileSync(path);
  return new Uint8Array(buffer);
};

export const hexToUint8Array = (hex: string) =>
  Uint8Array.from(Buffer.from(hex, "hex"));

export const getPublicKeyFromTxHash = async (txHash: string) => {
  const provider = new ethers.providers.JsonRpcProvider(
    "https://mainnet.infura.io/v3/8fb974170b1743288e9e6fac3bed68a0"
  );
  const tx = await provider.getTransaction(txHash);
  if (tx.r == null || tx.s == null || tx.v == null)
    throw new Error("Transaction is not signed");

  const expandedSig = {
    r: tx.r,
    s: tx.s,
    v: tx.v,
  };

  const signature = ethers.utils.joinSignature(expandedSig);

  let transactionHashData: UnsignedTransaction;
  switch (tx.type) {
    case 0:
      transactionHashData = {
        gasPrice: tx.gasPrice,
        gasLimit: tx.gasLimit,
        value: tx.value,
        nonce: tx.nonce,
        data: tx.data,
        chainId: tx.chainId,
        to: tx.to,
      };
      break;
    case 2:
      transactionHashData = {
        gasLimit: tx.gasLimit,
        value: tx.value,
        nonce: tx.nonce,
        data: tx.data,
        chainId: tx.chainId,
        to: tx.to,
        type: 2,
        maxFeePerGas: tx.maxFeePerGas,
        maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
      };
      break;
    default:
      throw "Unsupported transactionHash type";
  }

  const raw = ethers.utils.serializeTransaction(transactionHashData); // returns RLP encoded transactionHash
  const msgHash = ethers.utils.keccak256(raw); // as specified by ECDSA
  const msgBytes = ethers.utils.arrayify(msgHash); // create binary hash
  const recoveredPubKey = ethers.utils.recoverPublicKey(msgBytes, signature);
  return recoveredPubKey;
};

export const buildNargoOutputs = (
  publicKeyX: string, // these are all hex strings
  publicKeyY: string,
  signature: string,
  hashedMessage: string
) => {
  const abi = {
    public_key_x: hexToUint8Array(publicKeyX),
    public_key_y: hexToUint8Array(publicKeyY),
    signature: Uint8Array.from(
      Buffer.from(signature.slice(2).slice(0, 128), "hex")
    ),
    hashed_message: hexToUint8Array(hashedMessage.slice(2)),
  };

  console.log("\x1b[35m%s\x1b[0m", "Writing to Prover/Verifier.toml: ");
  Object.entries(abi).forEach(([key, value]) => {
    console.log("\x1b[33m%s\x1b[0m", key, value.toString());
  });

  const proverToml = `public_key_x = [${abi.public_key_x}]\public_key_y = [${abi.public_key_y}]\nsignature = [${abi.signature}]\hashed_message = [${abi.hashed_message}]`;

  const verifierToml = `hashed_message = [${abi.hashed_message}]\nsetpub = []`;
  fs.writeFileSync("Prover.toml", proverToml);
  fs.writeFileSync("Verifier.toml", verifierToml);
};

export const compileWithWasm = async (
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
