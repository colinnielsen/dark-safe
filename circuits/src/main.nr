use dep::std;

fn main(
  public_key_x: [u8; 32],
  public_key_y: [u8; 32],
  signature: [u8; 64], // clip v value
  // withdrawal_secret: [u8; 32],
  hashed_message: pub [u8; 32],
  // payroll_deposit_address: pub [u8; 32], // padded to 32 bytes
  // withdrawal_key: pub Field
) {
  let is_valid = std::ecdsa_secp256k1::verify_signature(public_key_x, public_key_y, signature, hashed_message);
  constrain is_valid == 1;

  // let withdrawal_hash = std::hash::pedersen([std::array::sum(public_key_x), std::array::sum(public_key_y), std::array::sum(payroll_deposit_address), std::array::sum(withdrawal_secret)]);
  // constrain withdrawal_hash[0] == withdrawal_key;
}