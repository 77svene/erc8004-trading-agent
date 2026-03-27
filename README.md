# AutoTradeX: ERC-8004 Autonomous Trading Agent

## Project Overview
AutoTradeX is an autonomous agent that continuously monitors ERC-20 token pairs on Uniswap v3 via The Graph subgraph, applies a lightweight offline-trained LSTM model (exported as ONNX and run with ONNX Runtime in Node.js) to predict short-term price moves, and when a threshold is met, creates and signs a limit order using the Uniswap v3 Permit2 interface. The agent's strategy (pair, model version, risk parameters) is minted as an ERC-8004 capability NFT, which can be queried by other contracts to verify the agent's authorized actions. A simple React dashboard (HTML/JS) displays live P&L, open positions, and the capability token metadata. All interactions use public RPC endpoints (Cloudflare Ethereum gateway) and free APIs (CoinGecko for token metadata, The Graph for pool data). No proprietary accounts are required; the agent operates solely with a locally managed Ethereum wallet (generated from a mnemonic) for signing transactions.

## Novel Angle
First agent that registers its trading strategy as an ERC-8004 capability token, enabling on-chain verification and composable delegation while executing AI-driven limit orders on Uniswap v3. This creates a self-enforcing system where the agent's permissions are cryptographically verifiable on-chain, allowing for trustless delegation and composability with other DeFi protocols.

## Setup Instructions

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd AutoTradeX
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   MNEMONIC="your 12 or 24 word ethereum wallet mnemonic"
   RPC_URL="https://cloudflare-eth.com"  # or any public Ethereum RPC
   GRAPH_URL="https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3"  # Uniswap v3 subgraph
   COINGECKO_API_URL="https://api.coingecko.com/api/v3"  # optional, defaults to this
   ```
   > **WARNING**: Never commit your `.env` file to version control. It contains sensitive information.

4. (Optional) Train your own model or use the provided one:
   ```bash
   python train_model.py
   ```
   This will generate an ONNX model in `src/agent/model.onnx`.

## How to Run

### Start the Autonomous Agent
```bash
npm run agent
```
This will start the agent loop, which:
- Connects to the Ethereum network via the provided RPC
- Loads your wallet from the mnemonic
- Fetches pool data from The Graph subgraph
- Runs the LSTM model to predict price movements
- When a threshold is met, creates and signs a limit order via Permit2
- Mints an ERC-8004 capability token representing the strategy used

### Start the Dashboard
```bash
npm run dashboard
```
This will start a React development server at `http://localhost:3000` showing:
- Live P&L from executed trades
- Open positions and limit orders
- Metadata of your ERC-8004 capability tokens
- Interactive chart of price predictions

## ERC-8004 Capability Usage

The ERC-8004 standard defines a way to represent capabilities as NFTs. In AutoTradeX:

1. **Strategy Registration**: When the agent decides to execute a trade based on its AI model, it mints an ERC-721 token (via our `CapabilityRegistry` contract) that encodes:
   - The token pair being traded
   - The version of the AI model used
   - Risk parameters (max slippage, order size limits)
   - A unique strategy ID

2. **On-Chain Verification**: Any smart contract can query the `CapabilityRegistry` to check if a given agent (by wallet address) is authorized to perform a specific action (e.g., trade a specific pair with specific parameters) by calling `isAuthorized(agentAddress, capabilityId)`.

3. **Composable Delegation**: The capability token can be transferred or delegated to other contracts or agents, allowing them to act on behalf of the original agent with the same verified permissions. This enables complex strategies where multiple agents collaborate under a shared, verifiable policy.

4. **Trustless Execution**: Since the capabilities are stored on-chain and enforced by the `CapabilityRegistry` contract, there is no need to trust the agent's off-chain claims about its permissions. The blockchain itself guarantees the correctness of the permission checks.

## Deployed Contracts (Testnet)

Note: These are placeholders. Replace with actual testnet deployments after testing.

- **CapabilityRegistry**: `0xYourCapabilityRegistryAddressOnGoerli`
  - [Etherscan (Goerli)](https://goerli.etherscan.io/address/0xYourCapabilityRegistryAddressOnGoerli)

- **Uniswap v3 Permit2**: `0x000000000022D473030F116dDEE9F6B43aC78BA3` (standard address)
  - [Etherscan (Goerli)](https://goerli.etherscan.io/address/0x000000000022D473030F116dDEE9F6B43aC78BA3)

## Architecture Diagram

```
+------------------+       +------------------+       +------------------+
|   Ethereum Node  |       |   The Graph      |       |   CoinGecko API  |
| (Cloudflare RPC) |<----->| (Uniswap v3 Sub) |<----->| (Token Metadata) |
+------------------+       +------------------+       +------------------+
         ^                         ^                         ^
         |                         |                         |
         |                         |                         |
+--------v--------+    +----------v----------+    +--------v--------+
|   Wallet Loader  |    |   Subgraph Listener |    |   Metadata Fetcher|
| (ethers.js)      |    |   (graphql-request) |    |   (fetch)         |
+--------+--------+    +----------+----------+    +--------+--------+
         |                         |                         |
         |                         |                         |
         v                         v                         v
+--------+--------+    +----------v----------+    +--------v--------+
|   AI Predictor   |    |   Order Builder     |    |   Dashboard     |
| (ONNX Runtime)   |    |   (Permit2 + ABI)   |    |   (React)       |
|   - LSTM Model   |    |   - Limit Orders    |    |   - P&L Display |
|   - Signal Gen   |    |   - Signature       |    |   - Open Orders |
+--------+--------+    +----------+----------+    +--------+--------+
         |                         |                         |
         |                         |                         |
         v                         v                         v
+--------+--------+    +----------v----------+    +--------v--------+
|   Tx Signer     |    |   Capability Minter |    |   Capability Viewer|
|   (ethers.js)   |    |   (ERC-8004)        |    |   (Contract Calls)|
+------------------+    +---------------------+    +------------------+
```

## License
MIT
