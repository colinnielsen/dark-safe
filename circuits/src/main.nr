use dep::std;
use dep::keccak;
use dep::keccak::constants;

fn main(
  publicKeyX: [u8; 32],
  publicKeyY: [u8; 32],
  signature: [u8; 64], // clip v value
  hashedMessage: pub [u8; 32]
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
}