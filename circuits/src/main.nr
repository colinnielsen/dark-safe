use dep::std;

fn main(
  publicKeyX: [u8; 32],
  publicKeyY: [u8; 32],
  signature: [u8; 64],
  hashedMessage: pub [u8; 32]
  // payrollContractAddress: pub Field,
  // withdrawal_key: pub Field
) {
  let isValid = std::ecdsa_secp256k1::verify_signature(publicKeyX, publicKeyY, signature, hashedMessage);
  constrain isValid == 1;
  
  let mut pubKey: [u8; 64] = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];

  for i in 0..64 {
    if i < 32 {
        pubKey[i] = publicKeyX[i];
    } else {
        pubKey[i] = publicKeyY[i - 32];
    }
  };

  let pubKeyHash = std::hash::sha256(pubKey);
  let mut recipientAddress: [u8; 20] = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
  for i in 0..20 {
    recipientAddress[i] = pubKeyHash[i + 12];
  };
  // let withdrawl_hash = std::hash::pedersen(recipientAddress, payrollContractAddress);
  // constrain withdraw_hash == withdraw_key;
}