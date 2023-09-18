const inquirer = require("inquirer");
import { writeFileSync } from "fs";
import { hashMessage } from "viem";
import { PrivateKeyAccount, privateKeyToAccount } from "viem/accounts";

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

const MAX_SIGNERS = DEFAULT_SIGNERS.length;

async function main() {
  const SIGNERS: PrivateKeyAccount[] = await inquirer
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
    .then(({ signers }: { signers: bigint[] }) => {
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
      if (threshold > SIGNERS.length)
        throw new Error("Threshold is greater than signer count");

      return threshold;
    });

  console.log("Given a Threshold of: ", threshold);
  console.log(
    "And the following of signers: ",
    SIGNERS.map(({ address }) => address)
  );

  const combinations = generateCombinations(
    SIGNERS.map(({ address }) => BigInt(address)),
    threshold
  );
  console.log("Yields the combinations: ", combinations);

  const _P = computePolynomial(combinations);
  // pad the polynomial to 70 coefficients
  const P = _P.concat(new Array(100).fill(0n)).slice(0, 70);
  console.log(
    "And the polynomial",
    P.map((p) => p.toString(10))
  );
  console.log(
    `Evaluating polynomial P of degree ${P.length} \n================`
  );

  combinations.forEach((combo, i) => {
    const result = evauluatePolynomial(P, combo);
    console.log({ x: combo.toString(10), result });
    if (result === 0n)
      console.log("Evaluation of combo @ index: " + i, " = " + result);
    else
      throw new Error(
        "Evaluation of combo @ index: " +
          i +
          " did not constrain to 0!\n" +
          result
      );
  });

  const emptyPubKeyAndSigners = new Array(MAX_SIGNERS).fill({
    should_calculate: 0,
    pub_key_x: null,
    pub_key_y: null,
    signature: null,
  });

  const pubKeyAndSigners = await Promise.all(
    SIGNERS.map(async (account) => {
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
    emptyPubKeyAndSigners.slice(SIGNERS.length)
  );
  writeFileSync(
    "circuits/Prover.toml",
    `polynomial = [${P.map((p) => `"${p.toString(10)}"`)}]\n` +
      `r = 0\n` +
      `polynomial_commitment = 0\n` +
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

function generateCombinations(array: bigint[], k: number): bigint[] {
  if (k > array.length || k <= 0) return [];
  if (k === array.length) return [array.reduce((a, b) => a + b, 0n)];
  if (k === 1) return array;

  let result: bigint[] = [];
  for (let i = 0; i < array.length; i++) {
    const smallerCombinations = generateCombinations(array.slice(i + 1), k - 1);
    for (let j = 0; j < smallerCombinations.length; j++) {
      result.push(array[i] + smallerCombinations[j]);
    }
  }

  return result;
}

// Multiply two polynomials
function multiplyPolynomials(p1: bigint[], p2: bigint[]): bigint[] {
  const result: bigint[] = new Array(p1.length + p2.length - 1).fill(0n);

  for (let i = 0; i < p1.length; i++) {
    for (let j = 0; j < p2.length; j++) {
      result[i + j] =
        (result[i + j] + (((p1[i] * p2[j]) % bn_254_fp) % bn_254_fp)) %
        bn_254_fp;
    }
  }

  return result;
}

// Given an array of roots, compute the coefficients of the polynomial
// TODO: need to hash and addmod f_p
function computePolynomial(roots: bigint[]): bigint[] {
  const polynomial = roots.reduce(
    (poly, root) => multiplyPolynomials(poly, [-root, 1n]),
    [1n]
  );

  return polynomial.map((p) => (p < 0n ? p + bn_254_fp : p));
}

// Evaluate the polynomial at x
function evauluatePolynomial(P: bigint[], x: bigint) {
  return P.reduce((acc, coefficient, degree) => {
    return (
      (acc += (coefficient * (x ** BigInt(degree) % bn_254_fp)) % bn_254_fp) %
      bn_254_fp
    );
  }, 0n);
}

const hexToUint8Array = (hex: string) =>
  Uint8Array.from(
    Buffer.from(hex.startsWith("0x") ? hex.slice(2) : hex, "hex")
  );
