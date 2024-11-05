import { Barretenberg, Fr } from "@aztec/bb.js";
import { writeFileSync } from "fs";
import { cpus } from "node:os";
import { hashMessage, toHex } from "viem";
import { PrivateKeyAccount } from "viem/accounts";
import {
  generateSafeMessage,
  hexToUint8Array,
  interpolatePolynomial,
  kChooseN,
  print,
  validatePolynomialRoots,
} from "./utils";
import {
  promptForMessage,
  promptForSigners,
  promptForThreshold,
} from "./utils/inquirer";

const MAX_SIGNERS = 8;

let barretenberg: Barretenberg;

export async function main() {
  //
  //// PART 1 :: POLYNOMIAL SET UP
  // Here we will set up a polynomial to represent a set of all the valid signer sets on the Safe
  ///
  console.log("\nGenerating polynomial...\n");

  // ask the user in the CLI for the signer addresses they'd like to select
  const signers: PrivateKeyAccount[] = await promptForSigners();
  // ask the user for the signing threshold of the safe
  const threshold: number = await promptForThreshold(signers.length);
  // ask the user for a UTF-8 string they'd like to sign over
  const safe_message_hash: string = await generateSafeMessage();

  print("Given a Threshold of: ", threshold);
  print(
    "And the following of signers: ",
    signers.map(({ address }) => address)
  );

  // represent the hex addresses as normal ppl numbers
  const addresses_bigInt = signers.map(({ address }) => BigInt(address));

  // sum up all the unique combinations of addresses
  const combinations: bigint[] = kChooseN(addresses_bigInt, threshold);
  print(
    "Yields the combinations: ",
    combinations.map((c) => `0x` + c.toString(16))
  );

  // the roots of a new polynomial will be all the unique combinations
  const roots = combinations;
  print(
    "And roots: ",
    roots.map((c) => `0x` + c.toString(16))
  );

  const P =
    // convert the roots of the polynomial into an array-encoded polynomial
    interpolatePolynomial(roots)
      // pad the polynomial to up to 70 empty coefficients
      // so: [4, 2, 4, 5]
      // becomes: [4, 2, 4, 5, 0, 0, 0, ...]
      .concat(new Array(100).fill(0n))
      .slice(0, 71);

  print(
    "And the polynomial",
    P.map((p) => p.toString(16))
  );

  // sanity check that f(x) == 0 in all cases
  validatePolynomialRoots(P, roots);

  console.log("\nPolynomial generated and validated ✨\n");

  //
  //// PART 2 :: PROVER.TOML SETUP
  // Here we will:
  // - find the pubkey_x and pubkey_y values of the private key accounts, (derivable from every ethereum transaction)
  // - hash the polynomial with pedersen
  // - write the prover.toml
  ///
  console.log("\nGenerating prover.toml...\n");

  type PubKeyAndSigner = {
    should_calculate: number;
    pub_key_x: Uint8Array;
    pub_key_y: Uint8Array;
    signature: Uint8Array;
  };

  const pubKeyAndSigners: PubKeyAndSigner[] = await Promise.all(
    signers.slice(0, threshold).map(async (account) => {
      // secp256k1 public keys are encoded with a 1 byte prefix to self-describe their representation
      // https://crypto.stackexchange.com/questions/108091/how-to-determine-the-prefix-of-a-secp256k1-compressed-public-key
      // so we'll remove that first byte by removing the '0x04' utf-8 characters
      const pubKey: string = account.publicKey.slice(4);
      const pubKeyX = pubKey.slice(0, 64);
      const pubKeyY = pubKey.slice(64);

      // we will sign over the message with the PK
      const signature = await account.signMessage({
        message: safe_message_hash,
      });

      return {
        should_calculate: 1,
        pub_key_x: hexToUint8Array(pubKeyX),
        pub_key_y: hexToUint8Array(pubKeyY),
        signature: Uint8Array.from(
          Buffer.from(signature.slice(2).slice(0, 128), "hex")
        ),
      };
    })
  );

  // fill the rest of the prover toml with empty PubKeyAndSigner structs (the no-op flag is `should_calculate`)
  const pubKeyAndSignersWithEmpty: PubKeyAndSigner[] = pubKeyAndSigners.concat(
    new Array(MAX_SIGNERS - pubKeyAndSigners.length).fill({
      ...pubKeyAndSigners[0],
      should_calculate: 0,
    })
  );

  // we hash that 'ish and write the prover.toml
  barretenberg = await Barretenberg.new(Math.floor(cpus.length / 2));
  const polynomial_hash = await barretenberg
    .pedersenCommit(P.map((p) => new Fr(p)))
    .then((point) => point.x);

  // write the prover.toml
  writeFileSync(
    "circuits/Prover.toml",
    `polynomial = [\n${
      P.map((p) => `\t"0x${p.toString(16)}"`).join(",\n") + "\n"
    }]\n` +
      `polynomial_hash = "${polynomial_hash}"\n` +
      `safe_message_hash = [${hexToUint8Array(safe_message_hash)}]\n` +
      `${pubKeyAndSignersWithEmpty
        .map(
          (v) =>
            "\n[[signature_data]]\n" +
            `should_calculate = ${v.should_calculate}\n` +
            `pub_key_x = [${v.pub_key_x ?? new Array(32).fill(0)}]\n` +
            `pub_key_y = [${v.pub_key_y ?? new Array(32).fill(0)}]\n` +
            `signature = [${v.signature ?? new Array(64).fill(0)}]
      `
        )
        .join("")}
    `
  );

  // write inputs/*.json
  writeFileSync(
    "contracts/inputs/polynomial.json",
    JSON.stringify({
      polynomial: P.map((p) => toHex(p, { size: 32 })),
      polynomial_hash: polynomial_hash.toString(),
    })
  );

  console.log("\nWrote Prover.toml ✨\n");

  console.log(
    "\x1b[1m\x1b[32mrun:\n\n cd ./circuits && nargo build\n\n...to start executing proofs\x1b[0m"
  );
}

main()
  .catch(console.error)
  .finally(async () => await barretenberg.destroy());
