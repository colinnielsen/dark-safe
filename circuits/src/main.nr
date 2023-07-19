use dep::ecrecover;
use dep::std;

// 1. check that sigs are valid for the pub message hash
// 2. check that signers are actually signers for the polynomial
fn main(
    r: Field,
    pub_keys: [ecrecover::secp256k1::PubKey],
    signatures: [[u8; 64]],
    safe_message_hash: pub [u8; 32],
    polynomial: [Field],
    poly_commit: pub Field
) {
    assert(pub_keys.len() == signatures.len());

    let mut point: Field = 0;
    let mut prev_addr: Field = 0;

    for i in 0..signatures.len() {
        let recovered_addr: Field = ecrecover::ecrecover(
            pub_keys[i].pub_x,
            pub_keys[i].pub_y,
            signatures[i],
            safe_message_hash
        );

        // check for duplicates
        assert(recovered_addr > prev_addr);
        // memoize the last address
        prev_addr = recovered_addr;

        // create a combination point
        point += recovered_addr;
    }

    // check the point is within the polynomial
    assert(compute_poly(point) == 0);
    // check the polynomial matches the public polynomial commitment
    assert(std::hash::pederesen(polynomial) == poly_commit);
 }

fn compute_poly(poly: [Field], point: Field) -> Field {
    let mut point: Field = 0;
    for i in 0..poly.len() {
        point += poly[poly.len() - i] * point.pow(i);
    }
}