# 🥷🏽 Dark Safe 🏦

## Deep Dive Video 📺

[![deep dive video](https://img.youtube.com/vi/7GUZNb0jpDE/0.jpg)](https://www.youtube.com/watch?v=7GUZNb0jpDE)

<details>
<summary>Repo Structure</summary>

```plaintext
├── circuits # contains the noir code
│   ├── src
│   │   └── main.nr # the DarkSafe Noir circuit
│   ├── Prover.toml # contains all the private inputs / data
│   └── Verifier.toml # contains all the public inputs / data
├── contracts
│   ├── DarkSafe.sol # the Zodiac Module to be installed on the safe
│   └── Verifier.sol # the `nargo` cli generated contract used to verify the a generated proof
├── scripts
│   └── build.ts # A CLI tool to help generate the input data
```

</details>

## What

A zodiac-compatible [Safe](https://app.safe.global) module that shields the ethereum addresses of up to 8 authorized "dark signers".

## Background

The idea for this project started back at devcon 6 - where I saw Noir had efficient keccak256 and secp256k1 signature verification circuits.

I spent the plane ride home wondering if Noir could enable Gnosis Safes with a shielded set of signers, removing the attack vector of publically stored signer addresses.

This would allow for anonymous onchain orgs, where signers could coordinate to execute transactions.

### Problem

Using this project as a research playground, I wanted to find an _~ elegant ~_ data structure that represented **_the set of valid sigers_** and **_the signing threshold_** in a **single hash**.

- I knew I did not want to store all the leaves of some `n` depth merkle tree, nor do hash path and leaf index computation off-chain. Also... Merkle trees are boring 🚫🌳

### Solution

Thanks to some great help from [@autoparallel](https://github.com/autoparallel) and [@0xjepsen](https://github.com/0xjepsen), I ended up representing valid signer sets (including signing threshold) into a polynomial.

This polynomial is [emitted in an event onchain](contracts/DarkSafe.sol#L48) as a _reverse_ encoded array, of 32 byte coefficiencts, with the array index representing the degree of the `x` value's exponent. For example:

```plaintext
# Polynomial in array form: index represents exponent degree.
[42, 1, 9, 145, 1]

# Polynomial in standard algebraic form
Polynomial = x^4 + 145x^3 + 9x^2 + x + 42
              👆🏼                   👆🏼   👆🏼
# (implied) (1x^4)             (1x^1) (42x^0)
```

This polynomial represents all the valid combinations of the signers.

Just like Safe, it protects against:

- double signing
- under signing
- non-signer signatures

## A TLDR Of How It works

### 👷🏽‍♂️ Setup

1. An admin selects up to 8 Ethereum EOA `addresses` as signers on the safe and a signing `threshold`
   - (Note: to prevent brute-force attacks decoding who the signers are, add at least **one** fresh EOA as a signer).
2. [`K choose N`](scripts/build.ts#L53) over the signer set and the threshold to find all possible _additive_ combinations of the Ethereum addresses (remember, an eth address is just a number, so you can use addition to express a combination of multiple addresses).
3. Consider those combinations as ["roots"](scripts/build.ts#L60) and [Lagrange Interpolate](scripts/build.ts#L68) a polynomial that passes through all those points where `y=0`.
4. Take the [Pedersen hash](scripts/build.ts#L137) of the polynomial as a suscinct commitment to the polynomial.
5. Deploy a new instance of [DarkSafe](contracts/DarkSafe.sol#L31), via the [ModuleProxyFactory](lib/zodiac/contracts/factory/ModuleProxyFactory.sol#L40) passing the `polynomialHash` and the `polynomial` as initialization params.
   - The contract will emit the `polynomial` and `polynomialHash` in a `SignersRotated()` event as decentralized, succinct data stucture to represent the signer set and threshold.

### ✍️ Signing

1. Sign over a [SafeMessageHash](lib/safe-contracts/contracts/Safe.sol#L427) with an EOA Private Key (via `eth_personalSign`).
2. Pass your signature to the next signer.
3. Repeat steps 1+2 until a valid signer until a valid proof can be generated via the Noir circuit.
   - This keeps other signers anonymous on a "need-to-know" basis. In other words, not all signers need to be known at proof generation.
4. Have some relayer call the [\_execute](contracts/DarkSafe.sol#L55) function, passing only the safe TX data, and the valid noir proof.
5. 🍃 Transaction is executed 🍃

## See it in action

```bash
yarn && yarn build --debug
```

## Run tests

```bash
yarn && yarn build

cd circuits/ && nargo prove

forge test
```

## Notes

- Check out [DRY](https://github.com/dry-ethglobal-brussels/dry-mobile-app) - a cool merkle tree implementation with FaceID by some noir OGs

- This project is just for fun, demonstrating a relatively efficient and elegant usecase for Noir and shouldn't be used in production unless we work together on this and get it audited

- Interpolating a polynomial over the K choose N of the signer set is _not_ secure enough for me to be comfortable. It is not impossible to brute force k choose n up to 8 over all the Ethereum addresses and compute f(x) to try and brute-force find out who's on the safe.

Some possible solutions are:

- Always spin up a fresh EOA to add as a signer, it's important this account has never made an Ethereum transaction on any chain.
- Refactor the code to accept a bit of randomness: an `r` value to hash together with each `root`. This makes it impossible to brute force. The `r` value can be as simple as a known `password` has to at least be known by the prover.


## Massive Thanks to...
the boiz
- [@autoparallel](https://github.com/autoparallel)
- [@0xjepsen](https://github.com/0xjepsen)

noir guys
- [@TomAFrench](https://github.com/TomAFrench)
- [@kevaundray](https://github.com/kevaundray)
- [@signorecello](https://github.com/signorecello)
- [@critesjosh](https://github.com/critesjosh)
