use dep::ecrecover::{secp256k1};
use dep::std;

// 1. check that sigs are valid for the pub message hash
// 2. check that signers are actually signers for the polynomial

fn dark_safe(
    r: Field,
    pub_keys: [secp256k1::PubKey],
    signatures: [[u8; 64]],
    safe_message_hash: [u8; 32],
    polynomial: [Field],
    polynomial_commitment: Field
) {
    assert(pub_keys.len() == signatures.len());

    let mut root: Field = 0;

    for i in 0..signatures.len() {
        let recovered_addr: Field = pub_keys[i].ecrecover(
            signatures[i],
            safe_message_hash
        );

        // create a combination root
        root += std::hash::pedersen([recovered_addr, r])[0];
    }

    // check it's a root of a polynomial
    assert(evaluate_polynomial(polynomial, root) == 0);
    // check the polynomial matches the public polynomial commitment
    assert(std::hash::pedersen(polynomial)[0] == polynomial_commitment);
 }

fn evaluate_polynomial(poly: [Field], x: Field) -> Field {
    let mut point: Field = 0;
    // x_i^poly.len() - i 
    // 
    // for i in 0..poly.len() {
    //     // polynomial is reverse encoded
    //     let exponent = poly.len() - i;
        
    //     let num = poly[exponent];
    //     point += .pow_32(i);
    // }

    point
}

// 3/5 safe
fn main(
    r: Field,
    pub_keys: [secp256k1::PubKey; 3],
    signatures: [[u8; 64]; 3],
    safe_message_hash: pub [u8; 32],
    polynomial: [Field; 11],
    polynomial_commitment: pub Field
) {
    dark_safe(r, pub_keys, signatures, safe_message_hash, polynomial, polynomial_commitment);
}