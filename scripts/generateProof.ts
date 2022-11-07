import { SinglePedersen } from "@noir-lang/barretenberg/dest/crypto/pedersen";
import { BarretenbergWasm } from "@noir-lang/barretenberg/dest/wasm";
import { ethers } from "ethers";

import {
  buildNargoOutputs,
  compileWithWasm,
  getPublicKeyFromTxHash,
  toFixedHex,
} from "./common";

const WITHDRAWAL_SECRET = 0;

const getWithdrawKey = async (
  publicKeyX: string,
  publicKeyY: string,
  withdrawContractAdddress: string
) => {
  if (publicKeyX.slice(0, 2) === "0x") publicKeyX = publicKeyX.slice(2);
  if (publicKeyY.slice(0, 2) === "0x") publicKeyY = publicKeyY.slice(2);
  if (withdrawContractAdddress.slice(0, 2) === "0x") withdrawContractAdddress = withdrawContractAdddress.slice(2);

  const barretenberg = await BarretenbergWasm.new();
  await barretenberg.init();
  const pedersen = new SinglePedersen(barretenberg);

  return pedersen
    .compressInputs([
      Buffer.from(publicKeyX, "hex"),
      Buffer.from(publicKeyY, "hex"),
      Buffer.from(withdrawContractAdddress, "hex"),
      Buffer.from(toFixedHex(WITHDRAWAL_SECRET, false), "hex"),
    ])
    .toString("hex");
};

async function generateProof() {
  const useNargo = process.argv[2] === "Nargo";
  const build = process.argv[3];
  const message = process.argv.slice(4).join(" ");

  const FAKE_CONTRACT_ADDRESS = "0x0000000000000000000000000000000b0f00a020";
  const RECIPIENT_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
  const recipientTx =
    "0xd0f1a10ce5a68cadefc5bc54ec4140b0388f45a1fd370fcd9b2399577e2972f9";
  // // hardhat wallet 0
  const wallet = new ethers.Wallet(
    "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
  );

  
  // creating a withdraw key from an address, instead, the user will list an address, then pass it in. get a transaction from the wallet and get the public key from the transaction
  
  console.log("\x1b[34m%s\x1b[0m", "signing message 🖋: ", message);
  const signature = await wallet.signMessage(message); // get the signature of the message, this will be 130 bytes (r, s, and v)
  console.log("\x1b[34m%s\x1b[0m", "signature 📝: ", signature);
  
  const digest = ethers.utils.hashMessage(message); // this hash digest of the message as defined in EIP -
  
  // recoverPublicKey returns `0x{hex"4"}{pubKeyXCoord}{pubKeyYCoord}` - so slice 0x04 to expose just the concatenated x and y
  let pubKey = ethers.utils.recoverPublicKey(digest, signature).slice(4);
  console.log("pubKeyFromSignature: ", pubKey);
  
  let publicKeyX = pubKey.substring(0, 64);
  let publicKeyY = pubKey.substring(64);
  // const withdrawKey = await getWithdrawKey(publicKeyX, publicKeyY, FAKE_CONTRACT_ADDRESS);

  // console.log("withdrawKey!: ", withdrawKey);
  // console.log("withdrawKey!: ", withdrawKey.length);
  console.log("\x1b[34m%s\x1b[0m", "public key x coordinate 📊: ", publicKeyX);
  console.log("\x1b[34m%s\x1b[0m", "public key y coordinate 📊: ", publicKeyY);

  // build based on cli input
  // if (useNargo) buildNargoOutputs(publicKeyX, publicKeyY, signature, digest);
  // else await compileWithWasm(build, publicKeyX, publicKeyY, signature, digest);
}

generateProof()
  .then(() => process.exit(0))
  .catch(console.log);
