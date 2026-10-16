use anchor_lang::prelude::*;

#[constant]
pub const PERMISSION_SEED: &[u8] = b"permission";

/// Holds the current owner of the factory
#[account]
#[derive(Default, Debug)]
pub struct Permission {
    /// authority
    pub authority: Pubkey,
    /// padding
    pub padding: [u64; 30],
}

impl Permission {
    pub const LEN: usize = 8 + 32 + 8 * 30;
}
