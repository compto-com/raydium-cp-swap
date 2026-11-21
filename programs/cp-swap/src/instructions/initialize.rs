use crate::curve::CurveCalculator;
use crate::error::ErrorCode;
use crate::states::*;
use crate::utils::*;
use anchor_lang::{accounts::interface_account::InterfaceAccount, prelude::*};
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

#[derive(Accounts)]
pub struct Initialize<'info> {
    /// Only the admin can create the pool, and pays for its accounts.
    #[account(mut, address = crate::admin::ID)]
    pub creator: Signer<'info>,

    /// CHECK: pool vault authority
    #[account(
        seeds = [
            crate::AUTH_SEED,
        ],
        bump,
    )]
    pub authority: UncheckedAccount<'info>,

    /// The program's single pool.
    #[account(
        init,
        seeds = [POOL_SEED],
        bump,
        payer = creator,
        space = PoolState::LEN,
    )]
    pub pool_state: Box<Account<'info, PoolState>>,

    /// Token_0 mint, the key must smaller than token_1 mint.
    #[account(
        constraint = token_0_mint.key() < token_1_mint.key(),
        mint::token_program = token_0_program,
    )]
    pub token_0_mint: Box<InterfaceAccount<'info, Mint>>,

    /// Token_1 mint, the key must grater then token_0 mint.
    #[account(
        mint::token_program = token_1_program,
    )]
    pub token_1_mint: Box<InterfaceAccount<'info, Mint>>,

    /// creator token0 account
    #[account(
        mut,
        token::mint = token_0_mint,
        token::authority = creator,
    )]
    pub creator_token_0: Box<InterfaceAccount<'info, TokenAccount>>,

    /// creator token1 account
    #[account(
        mut,
        token::mint = token_1_mint,
        token::authority = creator,
    )]
    pub creator_token_1: Box<InterfaceAccount<'info, TokenAccount>>,

    /// Token_0 vault for the pool
    #[account(
        init,
        seeds = [
            POOL_VAULT_SEED,
            pool_state.key().as_ref(),
            token_0_mint.key().as_ref()
        ],
        bump,
        payer = creator,
        token::mint = token_0_mint,
        token::authority = authority,
        token::token_program = token_0_program,
    )]
    pub token_0_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    /// Token_1 vault for the pool
    #[account(
        init,
        seeds = [
            POOL_VAULT_SEED,
            pool_state.key().as_ref(),
            token_1_mint.key().as_ref()
        ],
        bump,
        payer = creator,
        token::mint = token_1_mint,
        token::authority = authority,
        token::token_program = token_1_program,
    )]
    pub token_1_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    /// an account to store oracle observations
    #[account(
        init,
        seeds = [
            OBSERVATION_SEED,
            pool_state.key().as_ref(),
        ],
        bump,
        payer = creator,
        space = ObservationState::LEN
    )]
    pub observation_state: AccountLoader<'info, ObservationState>,

    /// Spl token program or token program 2022
    pub token_0_program: Interface<'info, TokenInterface>,
    /// Spl token program or token program 2022
    pub token_1_program: Interface<'info, TokenInterface>,
    /// To create a new program account
    pub system_program: Program<'info, System>,
}

pub fn initialize(ctx: Context<Initialize>, init_amount_0: u64, init_amount_1: u64) -> Result<()> {
    if !(is_supported_mint(&ctx.accounts.token_0_mint)?
        && is_supported_mint(&ctx.accounts.token_1_mint)?)
    {
        return err!(ErrorCode::NotSupportMint);
    }
    CurveCalculator::validate_supply(init_amount_0, init_amount_1)?;

    ctx.accounts.observation_state.load_init()?.pool_id = ctx.accounts.pool_state.key();

    transfer_from_user_to_pool_vault(
        ctx.accounts.creator.to_account_info(),
        ctx.accounts.creator_token_0.to_account_info(),
        ctx.accounts.token_0_vault.to_account_info(),
        ctx.accounts.token_0_mint.to_account_info(),
        ctx.accounts.token_0_program.to_account_info(),
        init_amount_0,
        ctx.accounts.token_0_mint.decimals,
    )?;

    transfer_from_user_to_pool_vault(
        ctx.accounts.creator.to_account_info(),
        ctx.accounts.creator_token_1.to_account_info(),
        ctx.accounts.token_1_vault.to_account_info(),
        ctx.accounts.token_1_mint.to_account_info(),
        ctx.accounts.token_1_program.to_account_info(),
        init_amount_1,
        ctx.accounts.token_1_mint.decimals,
    )?;

    let pool_state = &mut ctx.accounts.pool_state;
    pool_state.token_0_vault = ctx.accounts.token_0_vault.key();
    pool_state.token_1_vault = ctx.accounts.token_1_vault.key();
    pool_state.token_0_mint = ctx.accounts.token_0_mint.key();
    pool_state.token_1_mint = ctx.accounts.token_1_mint.key();
    pool_state.token_0_program = ctx.accounts.token_0_program.key();
    pool_state.token_1_program = ctx.accounts.token_1_program.key();
    pool_state.observation_key = ctx.accounts.observation_state.key();
    pool_state.auth_bump = ctx.bumps.authority;
    pool_state.mint_0_decimals = ctx.accounts.token_0_mint.decimals;
    pool_state.mint_1_decimals = ctx.accounts.token_1_mint.decimals;

    Ok(())
}
