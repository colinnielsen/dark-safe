use dep::std;
use dep::keccak;
use dep::keccak::constants;

fn main(
  publicKeyX: [u8; 32],
  publicKeyY: [u8; 32],
  signature: [u8; 64], // clip v value
  hashedMessage: pub [u8; 32]
  // payrollContractAddress: pub Field,
  // withdrawal_key: pub Field
) -> pub [u64; 4] { // return address
  let isValid = std::ecdsa_secp256k1::verify_signature(publicKeyX, publicKeyY, signature, hashedMessage);
  constrain isValid == 1;
  let mut pub_key: [u64; 16] = [0; 16];

  for i in 0..64 {
    let mut key_index = i / 4;
    if i < 32 {
        pub_key[key_index] = pub_key[key_index] << publicKeyX[i] as u64;
    } else {
        pub_key[key_index] = pub_key[key_index] << publicKeyY[i - 32] as u64;
    }
  };

  keccak::keccak(pub_key, 64)
  // let mut pubKey: [u8; 64] = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];

  // for i in 0..64 {
  //   if i < 32 {
  //       pubKey[i] = publicKeyX[i];
  //   } else {
  //       pubKey[i] = publicKeyY[i - 32];
  //   }
  // };

  // let pubKeyHash = std::hash::sha256(pubKey);
  // let mut recipientAddress: [u8; 20] = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
  // for i in 0..20 {
  //   recipientAddress[i] = pubKeyHash[i + 12];
  // };
  // let withdrawl_hash = std::hash::pedersen(publicKeyX, publicKeyY, payrollContractAddress);
  // constrain withdraw_hash == withdraw_key;
}