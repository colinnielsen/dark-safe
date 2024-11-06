import { hashMessage } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const bn_254_fp =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

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

export const DEFAULT_SIGNERS = DEFAULT_SIGNERS_PK.map((pk) =>
  privateKeyToAccount(pk)
);

const DEBUG = process.argv.includes("--debug");

export const printDebug = (...args: any) => {
  if (DEBUG) console.log(args);
};

export function kChooseN(k: bigint[], n: number): bigint[] {
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

// interpolate a polynomial from a set of roots
export function interpolatePolynomial(roots: bigint[]): bigint[] {
  // start with a polynomial of degree 0: f(x) = 1
  let coefficients: bigint[] = [1n];

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

// compute f(x) for a polynomial
export function evauluatePolynomial(P: bigint[], x: bigint) {
  return P.reduce(
    (acc, coefficient, degree) =>
      (acc + ((coefficient * (x ** BigInt(degree) % bn_254_fp)) % bn_254_fp)) %
      bn_254_fp,
    0n
  );
}

export const hexToUint8Array = (hex: string) =>
  Uint8Array.from(
    Buffer.from(hex.startsWith("0x") ? hex.slice(2) : hex, "hex")
  );

export function validatePolynomialRoots(polynomial: bigint[], roots: bigint[]) {
  roots.forEach((root, i) => {
    const result = evauluatePolynomial(polynomial, root);
    printDebug({ x: root.toString(16), result });

    if (result !== 0n)
      throw new Error(
        `Evaluation of root at index ${i} did not constrain to 0!\nResult: ${result}`
      );

    printDebug(`f(x) @ index: ${i} = ${result}`);
  });
}
