import { Barretenberg, Fr } from "@aztec/bb.js";
import { derivePublicKey } from "@aztec/circuits.js";
import { writeFileSync } from "fs";
import inquirer from "inquirer";
import { cpus } from "node:os";
import { hashMessage } from "viem";
import { PrivateKeyAccount, privateKeyToAccount } from "viem/accounts";
import { Fq } from "./utils/grumpkinpk";
import {
  evauluatePolynomial,
  hexToUint8Array,
  kChooseN,
  print,
  rootsToPolynomial,
} from "./utils";

const MAX_SIGNERS = 8;
const DEFAULT_SIGNERS_PK = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
  "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
  "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba",
  "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e",
  "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356",
] as const;

const DEFAULT_SIGNERS = DEFAULT_SIGNERS_PK.map((pk) => privateKeyToAccount(pk));

let barretenberg: Barretenberg;

export async function main() {
  const signers: PrivateKeyAccount[] = await inquirer
    .prompt({
      message: "Select signers",
      name: "signers",
      type: "checkbox",
      choices: [
        ...DEFAULT_SIGNERS.map((account) => ({
          value: account,
          name: account.address,
        })),
        new inquirer.Separator(),
      ],
    })
    .then(({ signers }: { signers: PrivateKeyAccount[] }) => {
      if (signers.length < 2)
        throw new Error("Must select at least two signers");
      return signers;
    });

  const threshold = await inquirer
    .prompt({
      message: "Enter a signing threshold",
      name: "threshold",
      type: "number",
    })
    .then(({ threshold }: { threshold: number }) => {
      if (threshold == 0) throw new Error("Threshold must be greater than 0");
      if (threshold > signers.length)
        throw new Error("Threshold is greater than signer count");

      return threshold;
    });

  print("Given a Threshold of: ", threshold);
  print(
    "And the following of signers: ",
    signers.map(({ address }) => address)
  );

  const combinations = kChooseN(
    signers.map(({ address }) => BigInt(address)),
    threshold
  );
  print(
    "Yields the combinations: ",
    combinations.map((c) => `0x` + c.toString(16))
  );

  const roots = combinations.map((c) => derivePublicKey(new Fq(c)).x.value);
  print(
    "And roots: ",
    roots.map((c) => `0x` + c.toString(16))
  );

  const P =
    // interpolate the roots to a polynomial
    rootsToPolynomial(roots)
      //pad the polynomial to 70 coefficients
      .concat(new Array(100).fill(0n))
      .slice(0, 71);

  print(
    "And the polynomial",
    P.map((p) => p.toString(16))
  );

  // sanity check that f(x) == 0 in all cases
  roots.forEach((combo, i) => {
    const result = evauluatePolynomial(P, combo);
    print({ x: combo.toString(16), result });
    if (result !== 0n)
      throw new Error(
        "Evaluation of combo @ index: " +
          i +
          " did not constrain to 0!\n" +
          result
      );
    print("f(x) @ index: " + i, " = " + result);
  });

  const { message } = await inquirer.prompt({
    message: "Type message for all users to sign...",
    name: "message",
  });

  const pubKeyAndSigners = await Promise.all(
    signers.slice(0, threshold).map(async (account) => {
      const pubKey = account.publicKey.slice(4); // remove 0x04 prefix
      const fullSig = await account.signMessage({ message });

      return {
        should_calculate: 1,
        pub_key_x: hexToUint8Array(pubKey.slice(0, 64)),
        pub_key_y: hexToUint8Array(pubKey.slice(64)),
        signature: Uint8Array.from(
          Buffer.from(fullSig.slice(2).slice(0, 128), "hex")
        ),
      };
    })
  );

  const pubKeyAndSignersWithEmpty = pubKeyAndSigners.concat(
    new Array(MAX_SIGNERS - pubKeyAndSigners.length).fill({
      ...pubKeyAndSigners[0],
      should_calculate: 0,
    })
  );

  barretenberg = await Barretenberg.new(Math.floor(cpus.length / 2));
  const polynomial_commitment = await barretenberg
    .pedersenCommit(P.map((p) => new Fr(p)))
    .then((point) => point.x);

  writeFileSync(
    "circuits/Prover.toml",
    `polynomial = [\n${
      P.map((p) => `\t"0x${p.toString(16)}"`).join(",\n") + "\n"
    }]\n` +
      `polynomial_commitment = "${polynomial_commitment}"\n` +
      `safe_message_hash = [${hexToUint8Array(hashMessage(message))}]\n` +
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

  console.log("\nWrote Prover.toml ✨\n");

  console.log("run:\n\n cd/circuits && nargo build\n\nto start execute proofs");
}

main()
  .catch(console.error)
  .finally(async () => await barretenberg.destroy());
