#!/usr/bin/env bash

#
# Runs nargo build and compile before generating a proof.
# If Prover.toml is malformed, it will still generate the proof using the last valid build.
#

printf "Name of your build : "
read name_build

printf "message to sign : "
read message

cd circuits/

printf "\n💻 nargo build 💻\n\n"
nargo build

printf "\n💻 nargo compile 💻\n\n"
nargo compile ${name_build}

printf "\n💻 generateSigProof script 💻\n\n"
npx ts-node ../scripts/generateProof.ts ${message} ${name_build}

printf "\n💻 nargo prove 💻\n\n"
nargo prove ${name_build}

printf "\n💻 nargo verify 💻\n\n"
nargo verify ${name_build}
