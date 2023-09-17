use dep::ecrecover::ecrecover;
use dep::std;

// the max amount of signers allowed on a safe
global MAX_SIGNER_COUNT: Field = 8;
// K choose N for 8 choose 4 is 70
global MAX_POLYNOMIAL_DEGREE: Field = 70;

struct PubKeyAndSigs {
    isEmpty: bool, // a no-op flag to signify an empty array
    pub_key_x: [u8; 32], // x coordinate of the public key
    pub_key_y: [u8; 32], // y coordinate of the public key
    signature: [u8; 64], // signature of the safe_message_hash
}

// fn main(
//     r: Field, // random number
//     signature_data: [PubKeyAndSigs; MAX_SIGNER_COUNT],
//     safe_message_hash: [u8; 32],
//     polynomial: [Field; MAX_POLYNOMIAL_DEGREE],
//     polynomial_commitment: Field
// ) {
//     // assert(pub_keys.len() == signatures.len());

//     let mut root: Field = 0;
//     // let mut last_addr: Field = 0; // todo

//     for i in 0..MAX_SIGNER_COUNT {
//         if(!signature_data[i].isEmpty) {

//         let recovered_addr: Field = ecrecover(
//             signature_data[i].pub_key_x,
//             signature_data[i].pub_key_y,
//             signature_data[i].signature,
//             safe_message_hash
//         );
//             // assert(); // todo: recovered_addr > last_addr

//             // create a combination root
//             root += recovered_addr; // std::hash::pedersen([recovered_addr, r])[0];
//         }
//     }

//     // check it's a root of a polynomial
//     assert(evaluate_polynomial(polynomial, root) == 0);
//     // check the polynomial matches the public polynomial commitment
//     assert(std::hash::pedersen(polynomial)[0] == polynomial_commitment);
//  }

fn evaluate_polynomial(P: [Field; MAX_POLYNOMIAL_DEGREE], x: Field) -> Field {
    // let mut degree: Field = 0;
    // P.fold(0, |acc, coefficient| {
    //     degree += 1;
    //     acc + coefficient * x.pow_32(degree)
    // })

    let mut result: Field = 0;

    for degree in 0..P.len() {
        let coefficient: Field = P[degree];
        let pow: Field = x.pow_32(degree);
        result += coefficient * pow;
    }

    result
}

fn main (
    polynomial: [Field; MAX_POLYNOMIAL_DEGREE],
    x: Field
) -> pub Field {
    evaluate_polynomial(polynomial, x)
}
