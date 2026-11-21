use crate::curve::calculator::CurveCalculator;
use crate::error::ErrorCode;
use crate::states::*;
use crate::utils::token::*;
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

#[derive(Accounts)]
pub struct Swap<'info> {
    /// The user performing the swap
    pub payer: Signer<'info>,

    /// CHECK: pool vault authority
    #[account(
        seeds = [
            crate::AUTH_SEED,
        ],
        bump = pool_state.auth_bump,
    )]
    pub authority: UncheckedAccount<'info>,

    /// The program's single pool
    pub pool_state: Box<Account<'info, PoolState>>,

    /// The user token account for input token
    #[account(mut)]
    pub input_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The user token account for output token
    #[account(mut)]
    pub output_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The vault token account for input token
    #[account(
        mut,
        constraint = input_vault.key() == pool_state.token_0_vault || input_vault.key() == pool_state.token_1_vault,
        token::token_program = input_token_program.key(),
    )]
    pub input_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The vault token account for output token
    #[account(
        mut,
        constraint = output_vault.key() == pool_state.token_0_vault || output_vault.key() == pool_state.token_1_vault,
        token::token_program = output_token_program.key(),
    )]
    pub output_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    /// SPL program for input token transfers
    pub input_token_program: Interface<'info, TokenInterface>,

    /// SPL program for output token transfers
    pub output_token_program: Interface<'info, TokenInterface>,

    /// The mint of input token
    #[account(
        address = input_vault.mint
    )]
    pub input_token_mint: Box<InterfaceAccount<'info, Mint>>,

    /// The mint of output token
    #[account(
        address = output_vault.mint
    )]
    pub output_token_mint: Box<InterfaceAccount<'info, Mint>>,

    /// The program account for the most recent oracle observation
    #[account(mut, address = pool_state.observation_key)]
    pub observation_state: AccountLoader<'info, ObservationState>,
}

pub fn swap_base_input(ctx: Context<Swap>, amount_in: u64, minimum_amount_out: u64) -> Result<()> {
    let pool_id = ctx.accounts.pool_state.key();
    let pool_state = &ctx.accounts.pool_state;

    require_gt!(amount_in, 0);

    let total_input_token_amount = ctx.accounts.input_vault.amount;
    let total_output_token_amount = ctx.accounts.output_vault.amount;
    let (token_0_price_x32, token_1_price_x32) = pool_state.pre_swap_prices_x32(
        ctx.accounts.input_vault.key(),
        ctx.accounts.output_vault.key(),
        total_input_token_amount,
        total_output_token_amount,
    )?;
    let constant_before = u128::from(total_input_token_amount)
        .checked_mul(u128::from(total_output_token_amount))
        .unwrap();

    let result = CurveCalculator::swap_base_input(
        u128::from(amount_in),
        u128::from(total_input_token_amount),
        u128::from(total_output_token_amount),
    )
    .ok_or(ErrorCode::ZeroTradingTokens)?;

    let constant_after = result
        .new_input_vault_amount
        .checked_mul(result.new_output_vault_amount)
        .unwrap();
    #[cfg(feature = "enable-log")]
    msg!(
        "input_amount:{}, output_amount:{}, constant_before:{},constant_after:{}",
        result.input_amount,
        result.output_amount,
        constant_before,
        constant_after,
    );
    // output < output vault balance, so it always fits in a u64
    let amount_out = u64::try_from(result.output_amount).unwrap();
    require_gt!(amount_out, 0, ErrorCode::ZeroTradingTokens);
    require_gte!(amount_out, minimum_amount_out, ErrorCode::ExceededSlippage);

    emit!(SwapEvent {
        pool_id,
        input_vault_before: total_input_token_amount,
        output_vault_before: total_output_token_amount,
        input_amount: amount_in,
        output_amount: amount_out,
        base_input: true,
        input_mint: ctx.accounts.input_token_mint.key(),
        output_mint: ctx.accounts.output_token_mint.key(),
    });
    require_gte!(constant_after, constant_before);

    transfer_from_user_to_pool_vault(
        ctx.accounts.payer.to_account_info(),
        ctx.accounts.input_token_account.to_account_info(),
        ctx.accounts.input_vault.to_account_info(),
        ctx.accounts.input_token_mint.to_account_info(),
        ctx.accounts.input_token_program.to_account_info(),
        amount_in,
        ctx.accounts.input_token_mint.decimals,
    )?;

    transfer_from_pool_vault_to_user(
        ctx.accounts.authority.to_account_info(),
        ctx.accounts.output_vault.to_account_info(),
        ctx.accounts.output_token_account.to_account_info(),
        ctx.accounts.output_token_mint.to_account_info(),
        ctx.accounts.output_token_program.to_account_info(),
        amount_out,
        ctx.accounts.output_token_mint.decimals,
        &[&[crate::AUTH_SEED, &[pool_state.auth_bump]]],
    )?;

    // update the previous price to the observation
    ctx.accounts.observation_state.load_mut()?.update(
        oracle::block_timestamp(),
        token_0_price_x32,
        token_1_price_x32,
    )?;

    Ok(())
}
