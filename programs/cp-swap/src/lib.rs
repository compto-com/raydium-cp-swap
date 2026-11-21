pub mod curve;
pub mod error;
pub mod instructions;
pub mod states;
pub mod utils;
use anchor_lang::prelude::*;
use instructions::*;

declare_id!("GVSzpfu4CzCxgU7wNeNy4eCeDX6R7ecY3vKSRLuDJfu1");

pub mod admin {
    use super::{constant, Pubkey};

    #[cfg(not(feature = "localnet"))]
    use super::pubkey;

    #[cfg(feature = "localnet")]
    pub const ID: Pubkey = Pubkey::from_str_const(env!(
        "CPSWAP_LOCALNET_ADMIN",
        "the `localnet` feature needs CPSWAP_LOCALNET_ADMIN=<admin pubkey> at build time (run `yarn test`)"
    ));
    #[cfg(not(feature = "localnet"))]
    pub const ID: Pubkey = pubkey!("AvLfQNWrZGKtNtTts54vu7Bh7ib6Kg2boTSszviofZit");

    #[constant]
    pub const ADMIN: Pubkey = ID;
}

#[constant]
pub const AUTH_SEED: &[u8] = b"vault_and_lp_mint_auth_seed";

#[program]
pub mod raydium_cp_swap {
    use super::*;

    /// Creates the program's single pool and seeds it with its permanent liquidity.
    /// Admin only, and can only succeed once: the pool lives at a fixed PDA.
    ///
    /// # Arguments
    ///
    /// * `ctx`- The context of accounts
    /// * `init_amount_0` - the initial amount_0 to deposit
    /// * `init_amount_1` - the initial amount_1 to deposit
    ///
    pub fn initialize(
        ctx: Context<Initialize>,
        init_amount_0: u64,
        init_amount_1: u64,
    ) -> Result<()> {
        instructions::initialize(ctx, init_amount_0, init_amount_1)
    }

    /// Swap the tokens in the pool base input amount
    ///
    /// # Arguments
    ///
    /// * `ctx`- The context of accounts
    /// * `amount_in` -  input amount to transfer, output to DESTINATION is based on the exchange rate
    /// * `minimum_amount_out` -  Minimum amount of output token, prevents excessive slippage
    ///
    pub fn swap_base_input(
        ctx: Context<Swap>,
        amount_in: u64,
        minimum_amount_out: u64,
    ) -> Result<()> {
        instructions::swap_base_input(ctx, amount_in, minimum_amount_out)
    }

    /// Swap the tokens in the pool base output amount
    ///
    /// # Arguments
    ///
    /// * `ctx`- The context of accounts
    /// * `max_amount_in` -  input amount prevents excessive slippage
    /// * `amount_out` -  amount of output token
    ///
    pub fn swap_base_output(ctx: Context<Swap>, max_amount_in: u64, amount_out: u64) -> Result<()> {
        instructions::swap_base_output(ctx, max_amount_in, amount_out)
    }
}
