import inquirer from "inquirer";
import { PrivateKeyAccount } from "viem/accounts";
import { DEFAULT_SIGNERS } from ".";

// Define and export getSigners, getThreshold, getMessage functions here

// Rename and export getSigners to promptForSigners
export async function promptForSigners(): Promise<PrivateKeyAccount[]> {
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

// Rename and export getThreshold to promptForThreshold
export async function promptForThreshold(
  signersCount: number
): Promise<number> {
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

// Rename and export getMessage to promptForMessage
export async function promptForMessage(): Promise<string> {
  return inquirer
    .prompt({
      message: "Type message for all users to sign...",
      name: "message",
      type: "input",
    })
    .then(({ message }) => message);
}
