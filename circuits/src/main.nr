// std dependencies
use dep::std;
use dep::std::field::bn254;
use dep::std::scalar_mul::{fixed_base_embedded_curve};

// import ecrecover
use dep::ecrecover::{ecrecover};

// pull in the lib.nr module
mod lib;

// a struct containing all the data needed to prove a signature of the safe message hash
struct PubKeyAndSigs {
    should_calculate: bool, // a no-op flag to signify an empty struct
    pub_key_x: [u8; 32], // x coordinate of the public key
    pub_key_y: [u8; 32], // y coordinate of the public key
    signature: [u8; 64], // signature of the safe_message_hash
}

fn main(
    signature_data: [PubKeyAndSigs; lib::MAX_SIGNER_COUNT],
    safe_message_hash: pub [u8; 32],
    polynomial: [Field; lib::MAX_POLYNOMIAL_DEGREE],
    polynomial_commitment: pub Field
) {
    let mut combination: Field = 0;

    // loop through each signature
    for i in 0..lib::MAX_SIGNER_COUNT {
        if (signature_data[i].should_calculate) {
            // and find the ethereum address that signed it
            let recovered_addr: Field = ecrecover(
                signature_data[i].pub_key_x,
                signature_data[i].pub_key_y,
                signature_data[i].signature,
                safe_message_hash
            );

            // add the address together to yield an intermediary "combination variable"
            combination += recovered_addr;
        }
    }

    // scalar mul the combination by the generator
    //      this makes the combinations non brute-forcable
    let (low, high) = bn254::decompose(combination);
    let root = fixed_base_embedded_curve(low, high)[0];

    // check it's a root of a polynomial
    assert(lib::evaluate_polynomial(polynomial, root) == 0);

    // check the polynomial matches the public polynomial commitment
    let out = std::hash::pedersen_commitment(polynomial).x;

    assert(out == polynomial_commitment);
}
