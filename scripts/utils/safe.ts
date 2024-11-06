import { calculateSafeTransactionHash } from "@safe-global/protocol-kit/dist/src/utils/index";
import { OperationType } from "@safe-global/types-kit";
import { zeroAddress } from "viem";

export const getSafeTransactionHash = ({
  to,
  value,
}: {
  to: string;
  value: bigint;
}) => {
  // return 'hellow world'
  return calculateSafeTransactionHash(
    "0xA360eE3FA17237b416821f25A05F504469DC58E1",
    {
      to,
      data: "",
      baseGas: "0",
      gasPrice: "0",
      gasToken: zeroAddress,
      nonce: 1,
      operation: OperationType.Call,
      refundReceiver: zeroAddress,
      safeTxGas: "0",
      value: value.toString(),
    },
    "1.4.1",
    31337n
  );
};
