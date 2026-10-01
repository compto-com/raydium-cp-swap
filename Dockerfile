FROM solanafoundation/anchor:v1.0.2

ARG SURFPOOL_VERSION=v1.6.0
RUN curl -sL https://github.com/solana-foundation/surfpool/releases/download/${SURFPOOL_VERSION}/surfpool-linux-x64.tar.gz \
    | tar -xz -C /usr/local/bin surfpool \
    && chmod +x /usr/local/bin/surfpool
