use crate::error::ErrorCode;
use anchor_lang::prelude::*;
/// Seed to derive account address and signature
#[constant]
pub const POOL_SEED: &[u8] = b"pool";
#[constant]
pub const POOL_VAULT_SEED: &[u8] = b"pool_vault";

pub const Q32: u128 = (u32::MAX as u128) + 1; // 2^32

/// The program's single pool. Fee-less, and its liquidity is permanent:
/// there are no LP tokens and no way to withdraw.
#[account]
#[derive(Default, Debug, InitSpace)]
pub struct PoolState {
    /// Token A
    pub token_0_vault: Pubkey,
    /// Token B
    pub token_1_vault: Pubkey,
    /// Mint information for token A
    pub token_0_mint: Pubkey,
    /// Mint information for token B
    pub token_1_mint: Pubkey,
    /// token_0 program
    pub token_0_program: Pubkey,
    /// token_1 program
    pub token_1_program: Pubkey,
    /// observation account to store oracle data
    pub observation_key: Pubkey,
    /// bump of the vault authority PDA
    pub auth_bump: u8,
    /// mint0 and mint1 decimals
    pub mint_0_decimals: u8,
    pub mint_1_decimals: u8,
}

impl PoolState {
    pub const LEN: usize = 8 + Self::INIT_SPACE;

    pub fn token_price_x32(vault_0: u64, vault_1: u64) -> (u128, u128) {
        (
            vault_1 as u128 * Q32 / vault_0 as u128,
            vault_0 as u128 * Q32 / vault_1 as u128,
        )
    }

    /// Validates that `input_vault` and `output_vault` are this pool's two
    /// distinct vaults, and returns the pre-swap (token_0, token_1) prices in Q32.32.
    pub fn pre_swap_prices_x32(
        &self,
        input_vault_key: Pubkey,
        output_vault_key: Pubkey,
        input_vault_amount: u64,
        output_vault_amount: u64,
    ) -> Result<(u128, u128)> {
        if input_vault_key == self.token_0_vault && output_vault_key == self.token_1_vault {
            Ok(Self::token_price_x32(
                input_vault_amount,
                output_vault_amount,
            ))
        } else if input_vault_key == self.token_1_vault && output_vault_key == self.token_0_vault {
            Ok(Self::token_price_x32(
                output_vault_amount,
                input_vault_amount,
            ))
        } else {
            err!(ErrorCode::InvalidVault)
        }
    }
}
