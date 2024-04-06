import inquirer from "inquirer";

import { writeFileSync } from "fs";
import { hashMessage } from "viem";
import { PrivateKeyAccount, privateKeyToAccount } from "viem/accounts";
import { createHash } from "node:crypto";
import { Fq } from "./grumpkinpk";
import { derivePublicKey } from "@aztec/circuits.js";

const MAX_SIGNERS = 8;
const SIGNER_COUNT = process.argv[2] ? +process.argv[2] : null;
const THRESHOLD = process.argv[3] ? +process.argv[3] : null;

const bn_254_fp =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const MESSAGE = "hello world";
const MESSAGE_HASH = hashMessage(MESSAGE);

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

async function main() {
  const signers: PrivateKeyAccount[] = SIGNER_COUNT
    ? DEFAULT_SIGNERS.slice(0, SIGNER_COUNT)
    : await inquirer
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

  const threshold = THRESHOLD
    ? THRESHOLD
    : await inquirer
        .prompt({
          message: "Enter a signing threshold",
          name: "threshold",
          type: "number",
        })
        .then(({ threshold }: { threshold: number }) => {
          if (threshold == 0)
            throw new Error("Threshold must be greater than 0");
          if (threshold > signers.length)
            throw new Error("Threshold is greater than signer count");

          return threshold;
        });

  console.log("Given a Threshold of: ", threshold);
  console.log(
    "And the following of signers: ",
    signers.map(({ address }) => address)
  );

  const combinations = kChooseN(
    signers.map(({ address }) => BigInt(address)),
    threshold
  );
  console.log(
    "Yields the combinations: ",
    combinations.map((c) => `0x` + c.toString(16))
  );

  const roots = combinations.map((c) => derivePublicKey(new Fq(c)).x.value);
  console.log(
    "And roots: ",
    roots.map((c) => `0x` + c.toString(16))
  );

  const _P = rootsToPolynomial(roots);
  // pad the polynomial to 70 coefficients
  const P = _P.concat(new Array(100).fill(0n)).slice(0, 71);

  console.log(
    "And the polynomial",
    P.map((p) => p.toString(16))
  );
  console.log(
    `Evaluating polynomial P of degree ${P.length} \n================`
  );

  roots.forEach((combo, i) => {
    const result = evauluatePolynomial(P, combo);
    console.log({ x: combo.toString(16), result });
    if (result === 0n) console.log("f(x) @ index: " + i, " = " + result);
    else
      throw new Error(
        "Evaluation of combo @ index: " +
          i +
          " did not constrain to 0!\n" +
          result
      );
  });

  const pubKeyAndSigners = await Promise.all(
    signers.slice(0, threshold).map(async (account) => {
      const pubKey = account.publicKey.slice(4); // remove 0x04 prefix
      const fullSig = await account.signMessage({ message: MESSAGE });

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

  const polynomial_commitment = hashToField(P);

  writeFileSync(
    "circuits/Prover.toml",
    `polynomial = [\n${
      P.map((p) => `\t"0x${p.toString(16)}"`).join(",\n") + "\n"
    }]\n` +
      `polynomial_commitment = "${polynomial_commitment}"\n` +
      `safe_message_hash = [${hexToUint8Array(MESSAGE_HASH)}]\n` +
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
}

main().catch(console.error);

//
//// utils
//

function toBufferBE(num: bigint, width: number) {
  if (num < BigInt(0)) {
    throw new Error(
      `Cannot convert negative bigint ${num.toString()} to buffer with toBufferBE.`
    );
  }
  const hex = num.toString(16);
  const buffer = Buffer.from(
    hex.padStart(width * 2, "0").slice(0, width * 2),
    "hex"
  );
  if (buffer.length > width) {
    throw new Error(`Number ${num.toString(16)} does not fit in ${width}`);
  }
  return buffer;
}

function hashToField(P: bigint[]) {
  const buffer = P.reduce<Buffer>((buff, p) => {
    return !buff ? toBufferBE(p, 32) : Buffer.concat([buff, toBufferBE(p, 32)]);
  }, null);

  const hash: bigint = BigInt(
    "0x" + createHash("BLAKE2s256").update(buffer).digest().toString("hex")
  );

  const onField = hash > bn_254_fp ? hash % bn_254_fp : hash;

  return "0x" + onField.toString(16).padStart(64, "0");
}

function kChooseN(k: bigint[], n: number): bigint[] {
  if (n === 1) return k;
  if (n > k.length || n <= 0) return [];
  if (n === k.length) return [k.reduce((a, b) => a + b, 0n)];

  let result: bigint[] = [];
  for (let i = 0; i < k.length; i++) {
    const smallerCombinations = kChooseN(k.slice(i + 1), n - 1);

    for (let j = 0; j < smallerCombinations.length; j++)
      result.push(k[i] + smallerCombinations[j]);
  }

  return result;
}

function rootsToPolynomial(roots: bigint[]): bigint[] {
  let coefficients: bigint[] = [1n]; // Start with a polynomial of degree 0: f(x) = 1

  for (let i = 0; i < roots.length; i++) {
    let root = roots[i];
    let newCoefficients: bigint[] = new Array(coefficients.length + 1).fill(0n);
    newCoefficients[0] = (coefficients[0] * -root) % bn_254_fp;

    for (let j = 1; j < coefficients.length; j++) {
      newCoefficients[j] =
        (((coefficients[j] * -root) % bn_254_fp) +
          (coefficients[j - 1] % bn_254_fp)) %
        bn_254_fp;
    }

    newCoefficients[coefficients.length] =
      coefficients[coefficients.length - 1];
    coefficients = newCoefficients;
  }

  // if there are negative coefficients, normalize them as the field representation
  return coefficients.map((c) =>
    c < 0 ? c + bn_254_fp : c > bn_254_fp ? c - bn_254_fp : c
  );
}

// Evaluate the polynomial at x
function evauluatePolynomial(P: bigint[], x: bigint) {
  return P.reduce(
    (acc, coefficient, degree) =>
      (acc + ((coefficient * (x ** BigInt(degree) % bn_254_fp)) % bn_254_fp)) %
      bn_254_fp,
    0n
  );
}

const hexToUint8Array = (hex: string) =>
  Uint8Array.from(
    Buffer.from(hex.startsWith("0x") ? hex.slice(2) : hex, "hex")
  );
