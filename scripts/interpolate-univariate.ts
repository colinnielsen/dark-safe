const inquirer = require("inquirer");

const bn_254_fp =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

const DEFAULT_SIGNERS = [
  0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266n,
  0x70997970c51812dc3a010c7d01b50e0d17dc79c8n,
  0x3c44cdddb6a900fa2b585dd299e03d12fa4293bcn,
  0x90f79bf6eb2c4f870365e785982e1f101e93b906n,
  0x15d34aaf54267db7d7c367839aaf71a00a2c6a65n,
  0x9965507d1a55bcc2695c58ba16fb37d819b0a4dcn,
  0x976ea74026e726554db657fa54763abd0c3a0aa9n,
  0x14dc79964da2c08b23698b3d3cc7ca32193d9955n,
];

async function main() {
  const SIGNERS: bigint[] = await inquirer
    .prompt({
      message: "Select signers",
      name: "signers",
      type: "checkbox",
      choices: [
        ...DEFAULT_SIGNERS.map((s) => ({
          value: s,
          name: "0x" + s.toString(16),
        })),
        new inquirer.Separator(),
      ],
    })
    .then(({ signers }: { signers: bigint[] }) => {
      if (signers.length < 2)
        throw new Error("Must select at least two signers");
      return signers;
    });

  console.log(SIGNERS);
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
    SIGNERS.map((s) => "0x" + s.toString(16))
  );

  const combinations = generateCombinations(SIGNERS, threshold);
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
