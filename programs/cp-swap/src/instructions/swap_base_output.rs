use super::swap_base_input::Swap;
use crate::curve::calculator::CurveCalculator;
use crate::error::ErrorCode;
use crate::states::*;
use crate::utils::token::*;
use anchor_lang::prelude::*;

pub fn swap_base_output(ctx: Context<Swap>, max_amount_in: u64, amount_out: u64) -> Result<()> {
    require_gt!(amount_out, 0);
    let pool_id = ctx.accounts.pool_state.key();
    let pool_state = &ctx.accounts.pool_state;

    let total_input_token_amount = ctx.accounts.input_vault.amount;
    let total_output_token_amount = ctx.accounts.output_vault.amount;
    let (token_0_price_x32, token_1_price_x32) = pool_state.pre_swap_prices_x32(
        ctx.accounts.input_vault.key(),
        ctx.accounts.output_vault.key(),
        total_input_token_amount,
        total_output_token_amount,
    )?;
    // The curve can never pay out the whole output vault.
    require_gt!(
        total_output_token_amount,
        amount_out,
        ErrorCode::ZeroTradingTokens
    );
    let constant_before = u128::from(total_input_token_amount)
        .checked_mul(u128::from(total_output_token_amount))
        .unwrap();

    let result = CurveCalculator::swap_base_output(
        u128::from(amount_out),
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
        "input_amount:{}, output_amount:{}, constant_before:{}, constant_after:{}",
        result.input_amount,
        result.output_amount,
        constant_before,
        constant_after,
    );

    let amount_in = u64::try_from(result.input_amount).map_err(|_| ErrorCode::MathOverflow)?;
    require_gt!(amount_in, 0);
    require_gte!(max_amount_in, amount_in, ErrorCode::ExceededSlippage);

    emit!(SwapEvent {
        pool_id,
        input_vault_before: total_input_token_amount,
        output_vault_before: total_output_token_amount,
        input_amount: amount_in,
        output_amount: amount_out,
        base_input: false,
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
