# Add signers to a safe and keep them secret

<details>
<summary>Project Structure</summary>

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

## Setup

```bash
yarn && yarn build
```

## Run tests
```bash
yarn && yarn build

cd circuits/ && nargo prove

forge test
```