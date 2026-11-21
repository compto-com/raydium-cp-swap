/// Errors that may be returned by the program.
use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    /// The input token account is empty.
    #[msg("Input token account empty")]
    EmptySupply,
    /// Exceeds desired slippage limit
    #[msg("Exceeds desired slippage limit")]
    ExceededSlippage,
    /// Swap amount results in zero trading tokens
    #[msg("Swap amount results in zero trading tokens")]
    ZeroTradingTokens,
    #[msg("Not support token_2022 mint extension")]
    NotSupportMint,
    #[msg("invaild vault")]
    InvalidVault,
    #[msg("Math overflow")]
    MathOverflow,
}
