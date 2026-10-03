//! All fee information, to be used for validation currently

pub const FEE_RATE_DENOMINATOR_VALUE: u64 = 1_000_000;

pub struct Fees {}

fn ceil_div(token_amount: u128, fee_numerator: u128, fee_denominator: u128) -> Option<u128> {
    if fee_denominator == 0 {
        return None;
    }
    token_amount
        .checked_mul(fee_numerator)?
        .checked_add(fee_denominator)?
        .checked_sub(1)?
        .checked_div(fee_denominator)
}

/// Helper function for calculating swap fee
pub fn floor_div(token_amount: u128, fee_numerator: u128, fee_denominator: u128) -> Option<u128> {
    if fee_denominator == 0 {
        return None;
    }
    token_amount
        .checked_mul(fee_numerator)?
        .checked_div(fee_denominator)
}

impl Fees {
    /// Calculate the trading fee in trading tokens
    pub fn trading_fee(amount: u128, trade_fee_rate: u64) -> Option<u128> {
        ceil_div(
            amount,
            u128::from(trade_fee_rate),
            u128::from(FEE_RATE_DENOMINATOR_VALUE),
        )
    }

    /// Calculate the owner protocol fee in trading tokens
    pub fn protocol_fee(amount: u128, protocol_fee_rate: u64) -> Option<u128> {
        floor_div(
            amount,
            u128::from(protocol_fee_rate),
            u128::from(FEE_RATE_DENOMINATOR_VALUE),
        )
    }

    /// Calculate the owner fund fee in trading tokens
    pub fn fund_fee(amount: u128, fund_fee_rate: u64) -> Option<u128> {
        floor_div(
            amount,
            u128::from(fund_fee_rate),
            u128::from(FEE_RATE_DENOMINATOR_VALUE),
        )
    }

    /// Calculate the creator fee
    pub fn creator_fee(amount: u128, creator_fee_rate: u64) -> Option<u128> {
        ceil_div(
            amount,
            u128::from(creator_fee_rate),
            u128::from(FEE_RATE_DENOMINATOR_VALUE),
        )
    }

    pub fn split_creator_fee(
        total_fee: u128,
        trade_fee_rate: u64,
        creator_fee_rate: u64,
    ) -> Option<u128> {
        if trade_fee_rate == 0 && creator_fee_rate == 0 {
            return Some(0);
        }
        floor_div(
            total_fee,
            u128::from(creator_fee_rate),
            u128::from(trade_fee_rate + creator_fee_rate),
        )
    }

    pub fn calculate_pre_fee_amount(post_fee_amount: u128, trade_fee_rate: u64) -> Option<u128> {
        if trade_fee_rate == 0 {
            Some(post_fee_amount)
        } else {
            let numerator = post_fee_amount.checked_mul(u128::from(FEE_RATE_DENOMINATOR_VALUE))?;
            let denominator =
                u128::from(FEE_RATE_DENOMINATOR_VALUE).checked_sub(u128::from(trade_fee_rate))?;

            numerator
                .checked_add(denominator)?
                .checked_sub(1)?
                .checked_div(denominator)
        }
    }
}

#[cfg(test)]
mod fees_test {
    use super::*;

    #[test]
    fn zero_fee_rate_yields_zero_fees() {
        assert_eq!(Fees::trading_fee(123_456, 0), Some(0));
        assert_eq!(Fees::protocol_fee(123_456, 0), Some(0));
        assert_eq!(Fees::fund_fee(123_456, 0), Some(0));
        assert_eq!(Fees::creator_fee(123_456, 0), Some(0));
    }

    #[test]
    fn zero_amount_yields_zero_fees_regardless_of_rate() {
        assert_eq!(Fees::trading_fee(0, 2_500), Some(0));
        assert_eq!(Fees::protocol_fee(0, 120_000), Some(0));
        assert_eq!(Fees::fund_fee(0, 40_000), Some(0));
        assert_eq!(Fees::creator_fee(0, 2_500), Some(0));
    }

    #[test]
    fn split_creator_fee_with_zero_total_fee_is_zero() {
        assert_eq!(Fees::split_creator_fee(0, 2_500, 2_500), Some(0));
    }

    #[test]
    fn split_creator_fee_with_zero_rates_is_zero() {
        // trade_fee_rate + creator_fee_rate == 0 would otherwise divide by zero;
        // both rates being zero means there is no fee to split.
        assert_eq!(Fees::split_creator_fee(100, 0, 0), Some(0));
        assert_eq!(Fees::split_creator_fee(0, 0, 0), Some(0));
    }

    #[test]
    fn calculate_pre_fee_amount_with_zero_rate_is_identity() {
        assert_eq!(Fees::calculate_pre_fee_amount(1_000_000, 0), Some(1_000_000));
        assert_eq!(Fees::calculate_pre_fee_amount(0, 0), Some(0));
    }

    #[test]
    fn ceil_div_with_zero_denominator_is_none() {
        assert_eq!(ceil_div(100, 10, 0), None);
    }

    #[test]
    fn floor_div_with_zero_denominator_is_none() {
        assert_eq!(floor_div(100, 10, 0), None);
    }
}
