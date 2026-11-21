//! Swap calculations

use crate::curve::constant_product::ConstantProductCurve;
use crate::error::ErrorCode;
use anchor_lang::prelude::*;

/// Encodes all results of swapping from a source token to a destination token
#[derive(Debug, PartialEq)]
pub struct SwapResult {
    /// The new amount in the input token vault
    pub new_input_vault_amount: u128,
    /// The new amount in the output token vault
    pub new_output_vault_amount: u128,
    /// Amount the user pays in
    pub input_amount: u128,
    /// Amount the user receives
    pub output_amount: u128,
}

/// Constant product swap calculator. There are no fees.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct CurveCalculator {}

impl CurveCalculator {
    pub fn validate_supply(token_0_amount: u64, token_1_amount: u64) -> Result<()> {
        if token_0_amount == 0 || token_1_amount == 0 {
            return Err(ErrorCode::EmptySupply.into());
        }
        Ok(())
    }

    /// Calculate how much destination token will be provided given an amount of source token.
    pub fn swap_base_input(
        input_amount: u128,
        input_vault_amount: u128,
        output_vault_amount: u128,
    ) -> Option<SwapResult> {
        let output_amount = ConstantProductCurve::swap_base_input(
            input_amount,
            input_vault_amount,
            output_vault_amount,
        );
        Some(SwapResult {
            new_input_vault_amount: input_vault_amount.checked_add(input_amount)?,
            new_output_vault_amount: output_vault_amount.checked_sub(output_amount)?,
            input_amount,
            output_amount,
        })
    }

    /// Calculate how much source token is required to receive an amount of destination token.
    pub fn swap_base_output(
        output_amount: u128,
        input_vault_amount: u128,
        output_vault_amount: u128,
    ) -> Option<SwapResult> {
        let input_amount = ConstantProductCurve::swap_base_output(
            output_amount,
            input_vault_amount,
            output_vault_amount,
        );
        Some(SwapResult {
            new_input_vault_amount: input_vault_amount.checked_add(input_amount)?,
            new_output_vault_amount: output_vault_amount.checked_sub(output_amount)?,
            input_amount,
            output_amount,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn swap_base_input_matches_curve() {
        let input_amount = 10_000u128;
        let input_vault_amount = 1_000_000u128;
        let output_vault_amount = 2_000_000u128;

        let result =
            CurveCalculator::swap_base_input(input_amount, input_vault_amount, output_vault_amount)
                .unwrap();
        let expected_output = ConstantProductCurve::swap_base_input(
            input_amount,
            input_vault_amount,
            output_vault_amount,
        );

        assert_eq!(result.input_amount, input_amount);
        assert_eq!(result.output_amount, expected_output);
        assert_eq!(
            result.new_input_vault_amount,
            input_vault_amount + input_amount
        );
        assert_eq!(
            result.new_output_vault_amount,
            output_vault_amount - expected_output
        );
    }

    #[test]
    fn swap_base_output_matches_curve() {
        let output_amount = 10_000u128;
        let input_vault_amount = 1_000_000u128;
        let output_vault_amount = 2_000_000u128;

        let result = CurveCalculator::swap_base_output(
            output_amount,
            input_vault_amount,
            output_vault_amount,
        )
        .unwrap();
        let expected_input = ConstantProductCurve::swap_base_output(
            output_amount,
            input_vault_amount,
            output_vault_amount,
        );

        assert_eq!(result.output_amount, output_amount);
        assert_eq!(result.input_amount, expected_input);
        assert_eq!(
            result.new_input_vault_amount,
            input_vault_amount + expected_input
        );
        assert_eq!(
            result.new_output_vault_amount,
            output_vault_amount - output_amount
        );
    }

    #[test]
    fn swap_base_input_zero_amount_is_noop() {
        let result = CurveCalculator::swap_base_input(0, 500_000, 750_000).unwrap();
        assert_eq!(result.input_amount, 0);
        assert_eq!(result.output_amount, 0);
        assert_eq!(result.new_input_vault_amount, 500_000);
        assert_eq!(result.new_output_vault_amount, 750_000);
    }
}
