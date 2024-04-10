
// the max amount of signers allowed on a safe
global MAX_SIGNER_COUNT: u64 = 8;

// N choose K for 8 choose 4 is 70 + 1 degree
global MAX_POLYNOMIAL_DEGREE: Field = 71;

pub fn evaluate_polynomial(P: [Field; MAX_POLYNOMIAL_DEGREE], x: Field) -> Field {
    let degree = &mut 0;

    P.fold(
        0,
        |acc, coefficient| {
        *degree += 1;
        acc + coefficient * x.pow_32(*degree)
    }
    )
}
