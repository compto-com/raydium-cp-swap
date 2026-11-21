use anchor_lang::prelude::*;

/// Emitted when swap
#[event]
pub struct SwapEvent {
    pub pool_id: Pubkey,
    pub input_vault_before: u64,
    pub output_vault_before: u64,
    pub input_amount: u64,
    pub output_amount: u64,
    pub base_input: bool,
    pub input_mint: Pubkey,
    pub output_mint: Pubkey,
}
