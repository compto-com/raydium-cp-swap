# raydium-cp-swap

Compto's stripped-down fork of Raydium's constant product AMM. Each deployment holds exactly one pool:

- **One pool**, created once by the admin at a fixed PDA (`[POOL_SEED]`)
- **Zero fees**: swaps follow pure `x * y = k`, with no trade, protocol, fund, creator or pool-creation fees
- **Permanent liquidity**: the liquidity supplied at `initialize` can never be withdrawn, and there are no LP tokens
- Token-2022 mints are supported, except mints with the transfer-fee extension, which `initialize` rejects so no swap ever pays a fee
- Built-in TWAP price oracle

Instructions: `initialize`, `swap_base_input`, `swap_base_output`.

This fork diverges heavily from the upstream program, so Raydium's audit and bug bounty do not cover it.

## Environment Setup

1. Install `Rust`

   ```shell
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   rustup default 1.91.0
   ```

2. Install `Solana `

   ```shell
   sh -c "$(curl -sSfL https://release.anza.xyz/v3.1.10/install)"
   ```

   then run `solana-keygen new` to create a keypair at the default location.

3. install `Anchor`

   ```shell
   # Installing using Anchor version manager (avm)
   cargo install --git https://github.com/solana-foundation/anchor avm --locked --force
   # Install anchor
   avm install 1.0.2
   avm use 1.0.2
   ```

## Quickstart

Clone the repository and test the program.

```shell

git clone https://github.com/compto-com/raydium-cp-swap
cd raydium-cp-swap && yarn && yarn test
```

## License

Raydium constant product swap is licensed under the Apache License, Version 2.0.
