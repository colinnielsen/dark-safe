const bn_254_fp =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

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

export function rootsToPolynomial(roots: bigint[]): bigint[] {
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

const DEBUG = process.argv.includes("--debug");

export const print = (...args: any) => {
  if (DEBUG) console.log(args);
};
