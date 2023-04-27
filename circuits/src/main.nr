use dep::ecrecover;
use dep::std;

global SIGNER_COUNT = 3;

fn main(
    root: Field,
    pub_keys: [ecrecover::secp256k1::PubKey; SIGNER_COUNT],
    signatures: [[u8; 64]; SIGNER_COUNT],
    // threshold: pub Field,
    safe_message_hash: pub [u8; 32]
) {
    // constrain threshold < 8;
    constrain pub_keys.len() == signatures.len();

    let mut addrs: [Field; SIGNER_COUNT] = [0; SIGNER_COUNT];

    for i in 0..SIGNER_COUNT {
        let recovered_addr = ecrecover::ecrecover(
            pub_keys[i].pub_x,
            pub_keys[i].pub_y,
            signatures[i],
            safe_message_hash
        );

        // constrain prevAddr <= recovered_addr;
        addrs[i] = recovered_addr;
    }

    let sorted = addrs.sort();
    let mut prev: Field = 0;

    for i in 0..SIGNER_COUNT {
        constrain prev != sorted[i];
        prev = sorted[i];
    }

    let computed_root = std::hash::pedersen(sorted);

    constrain computed_root[0] == root;
}
