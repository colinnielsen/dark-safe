use dep::ecrecover::ecrecover;
use dep::std;

// the max amount of signers allowed on a safe
global MAX_SIGNER_COUNT: Field = 8;
// K choose N for 8 choose 4 is 70
global MAX_POLYNOMIAL_DEGREE: Field = 70;

struct PubKeyAndSigs {
    is_empty: bool, // a no-op flag to signify an empty array
    pub_key_x: [u8; 32], // x coordinate of the public key
    pub_key_y: [u8; 32], // y coordinate of the public key
    signature: [u8; 64], // signature of the safe_message_hash
}

fn main(
    r: Field, // random number
    signature_data: [PubKeyAndSigs; MAX_SIGNER_COUNT],
    safe_message_hash: [u8; 32],
    polynomial: [Field; MAX_POLYNOMIAL_DEGREE],
    polynomial_commitment: Field
) {
    let mut root: Field = 0;
    // let mut last_addr: Field = 0; // todo

    for i in 0..MAX_SIGNER_COUNT {
        if(signature_data[i].is_empty == false) {
            std::println("computing");

            let recovered_addr: Field = ecrecover(
                signature_data[i].pub_key_x,
                signature_data[i].pub_key_y,
                signature_data[i].signature,
                safe_message_hash
            );
            // assert(recovered_addr > last_addr); // todo

            root += recovered_addr; // std::hash::pedersen([recovered_addr, r])[0];
        } else {
            std::println("empty");
            root += 0;
        }

    }

    // check it's a root of a polynomial
    assert(evaluate_polynomial(polynomial, root) == 0);
    // check the polynomial matches the public polynomial commitment
    // assert(std::hash::pedersen(polynomial)[0] == polynomial_commitment);
 }

fn evaluate_polynomial(P: [Field; MAX_POLYNOMIAL_DEGREE], x: Field) -> Field {
    let degree = &mut 0;

    P.fold(0, |acc, coefficient| {
        *degree += 1;
        acc + coefficient * x.pow_32(*degree)
    })
}