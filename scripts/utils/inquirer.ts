import inquirer from "inquirer";
import { parseArgs } from "node:util";
import { PrivateKeyAccount } from "viem/accounts";
import { DEFAULT_SIGNERS } from ".";

function parseCliArgs() {
  const args = parseArgs({
    options: {
      signers: { type: "string" },
      threshold: { type: "string" },
      debug: { type: "boolean" },
    },
  });

  return {
    signerCount: args.values.signers ? parseInt(args.values.signers as string) : undefined,
    threshold: args.values.threshold ? parseInt(args.values.threshold as string) : undefined,
  };
}

export async function promptForSigners(): Promise<PrivateKeyAccount[]> {
  const { signerCount } = parseCliArgs();

  if (signerCount) {
    if (signerCount < 2) 
      throw new Error("Must select at least two signers");
    
    if (signerCount > DEFAULT_SIGNERS.length)
      throw new Error(`Cannot select more than ${DEFAULT_SIGNERS.length} signers`);
    
    return DEFAULT_SIGNERS.slice(0, signerCount);
  }

  return inquirer
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
}

export async function promptForThreshold(signersCount: number): Promise<number> {
  const { threshold } = parseCliArgs();

  if (threshold !== undefined) {
    if (threshold === 0) 
      throw new Error("Threshold must be greater than 0");
    
    if (threshold > signersCount)
      throw new Error("Threshold is greater than signer count");
    
    return threshold;
  }

  return inquirer
    .prompt({
      message: "Enter a signing threshold",
      name: "threshold",
      type: "number",
    })
    .then(({ threshold }: { threshold: number }) => {
      if (threshold === 0) throw new Error("Threshold must be greater than 0");
      if (threshold > signersCount)
        throw new Error("Threshold is greater than signer count");
      return threshold;
    });
}

export async function promptForMessage(): Promise<string> {
  return inquirer
    .prompt({
      message: "Type message for all users to sign...",
      name: "message",
      type: "input",
    })
    .then(({ message }) => message);
}
