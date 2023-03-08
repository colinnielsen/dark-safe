use dep::std;
use dep::keccak;
use dep::keccak::constants;

fn merge_pub_key_to_u64(
    array_x: [u8; 32],
    array_y: [u8; 32],
) -> [u64; 16] {
    let mut combined_u64: [u64; 16] = [0; 16];
    
    for i in 0..4 {
        let mut value: u64 = 0;
        for j in 0..8 {
            value |= (array_x[i*8+j] as u64) << ((56 - j*8) as u64);
        }
        combined_u64[i] = value;
    }
    for i in 4..8 {
        let mut value: u64 = 0;
        for j in 0..8 {
            value |= (array_y[(i-4)*8+j] as u64) << ((56 - j*8) as u64);
        }
        combined_u64[i] = value;
    }
    combined_u64
}

#[test]
fn test_merge_pub_key_to_u64() {
  let pub_key_x: [u8; 32] = [
    0x04, 0x9b, 0x1c, 0x7f, 0x2a, 0x5d, 0x6f, 0x98,
    0x80, 0x3a, 0x60, 0x9b, 0x26, 0x2c, 0x32, 0x0b,
    0x3c, 0xb5, 0x0f, 0x0c, 0x08, 0x4a, 0x08, 0x08,
    0x3c, 0xb5, 0x0f, 0x0c, 0x08, 0x4a, 0x08, 0x08
  ];
  let pub_key = merge_pub_key_to_u64(pub_key_x, pub_key_x);

  constrain pub_key[0] == 331890330039054232;
  constrain pub_key[1] == 9239803804980621835;
  constrain pub_key[2] == 4374419157413398536;
  constrain pub_key[3] == 4374419157413398536;
  constrain pub_key[4] == 331890330039054232;
  constrain pub_key[5] == 9239803804980621835;
  constrain pub_key[6] == 4374419157413398536;
  constrain pub_key[7] == 4374419157413398536;
}

// fn main(pub_key_x: [u8; 32], pub_key_y: [u8; 32], input_length: u64) -> pub [u64; 4] {
//   let pub_key = merge_pub_key_to_u64(pub_key_x, pub_key_y);
//   keccak::keccak(pub_key, input_length)
// }

// fn main(
//   pub_key_x: [u8; 32],
//   pub_key_y: [u8; 32],
//   signature: [u8; 64], // clip v value
//   hashed_message: pub [u8; 32]
// ) -> pub [u64; 4] { // return hashed address
//   let isValid = std::ecdsa_secp256k1::verify_signature(pub_key_x, pub_key_y, signature, hashed_message);
//   constrain isValid == 1;

//   let mut pub_key = merge_pub_key_to_u64(pub_key_x, pub_key_y);
//   keccak::keccak(pub_key, 16)
// }


// __mind map__
// the private module signers are stored publicly the merkle root on the DarkSafe contract

// this circuit will:
// forEach signer:
//    1. verify the signature
//    2. verify the signer exists is in the merkle root
//    3. constrain the address to be the same as the signer
//    (Safe duplicate signer check)
//    4. contstrain the previous address to be greater than the current address
//    5. memoize the address as Field 
