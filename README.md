# 🤖 AutoTradeX: ERC-8004 Autonomous Trading Agent

> **The first AI trading agent to mint its strategy as an on-chain ERC-8004 capability token for verifiable, composable DeFi execution.**

[![Hackathon](https://img.shields.io/badge/Hackathon-lablab.ai-blue)](https://lablab.ai)
[![Token](https://img.shields.io/badge/Reward-$55,000%20SURGE-orange)](https://lablab.ai)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Solidity](https://img.shields.io/badge/Smart%20Contracts-Solidity-6e4c97.svg)](contracts/)
[![Node.js](https://img.shields.io/badge/Backend-Node.js-339933.svg)](src/)
[![Python](https://img.shields.io/badge/ML-Python-3776AB.svg)](train_model.py)
[![React](https://img.shields.io/badge/Frontend-React-61DAFB.svg)](src/dashboard/)

## 🚀 One-Line Pitch
AutoTradeX is an autonomous AI agent that executes Uniswap v3 limit orders based on LSTM predictions while registering its trading strategy as a verifiable ERC-8004 capability NFT.

## 📖 Problem & Solution

### 🛑 The Problem
*   **Black Box Strategies:** AI trading bots operate off-chain with no way to verify their logic or risk parameters on-chain.
*   **Lack of Composability:** Other protocols cannot safely delegate trading authority to an AI agent without trusting a centralized operator.
*   **Trust Deficit:** Traders cannot audit the specific model version or parameters used for a trade execution.

### ✅ The Solution
*   **ERC-8004 Capability Tokens:** AutoTradeX mints its trading strategy (pair, model version, risk limits) as a non-transferable NFT. This allows any contract to query and verify the agent's authorized actions.
*   **On-Chain Verification:** The `CapabilityRegistry` contract ensures only valid, minted strategies can trigger trades.
*   **Transparent Execution:** All trades are signed by a locally managed wallet and executed via Uniswap v3 Permit2, with full auditability.
*   **Lightweight AI:** Uses an offline-trained LSTM model (ONNX) running in Node.js for low-latency prediction without cloud dependencies.

## 🏗️ Architecture

```text
+---------------------+       +---------------------+       +---------------------+
|   AI Predictor      |       |   Blockchain Layer  |       |   DEX Execution     |
|   (Node.js/ONNX)    |       |   (Ethereum)        |       |   (Uniswap v3)      |
+---------------------+       +---------------------+       +---------------------+
| 1. Fetch Pool Data  |       | 2. Mint ERC-8004    |       | 3. Sign Limit Order |
|    via The Graph    |-----> |    Capability NFT   |<----->|    via Permit2      |
+---------------------+       +---------------------+       +---------------------+
         ^                               ^
         |                               |
+---------------------+       +---------------------+
|   React Dashboard   |       |   Wallet Manager    |
|   (Live P&L / UI)   |       |   (Local Mnemonic)  |
+---------------------+       +---------------------+
```

## 🛠️ Tech Stack

| Component | Technology |
| :--- | :--- |
| **Smart Contracts** | Solidity (ERC-8004, ERC-721) |
| **Backend Agent** | Node.js, ONNX Runtime |
| **AI Model** | Python, PyTorch (LSTM), ONNX |
| **Frontend** | React, HTML/JS |
| **Data Indexing** | The Graph (Uniswap Subgraph) |
| **RPC Provider** | Cloudflare Ethereum Gateway |
| **Market Data** | CoinGecko API |

## 📸 Demo

### Dashboard View
![AutoTradeX Dashboard](https://placehold.co/800x400/1e293b/ffffff?text=Live+P%26L+Dashboard+View)
*Live monitoring of open positions and capability token metadata.*

### Strategy Minting
![ERC-8004 Mint](https://placehold.co/800x400/1e293b/ffffff?text=ERC-8004+Strategy+Mint+Tx)
*Transaction hash for minting the trading strategy capability NFT.*

## 🚦 Setup Instructions

### 1. Clone Repository
```bash
git clone https://github.com/77svene/erc8004-trading-agent
cd erc8004-trading-agent
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
Create a `.env` file in the root directory with the following variables:

```env
# Wallet Configuration
PRIVATE_KEY=your_local_wallet_private_key
MNEMONIC="your mnemonic phrase words here"

# Blockchain Configuration
RPC_URL=https://cloudflare-eth.com
CHAIN_ID=1

# API Keys
THE_GRAPH_SUBGRAPH_URL=https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3
COINGECKO_API_KEY=your_coingecko_api_key

# Model Configuration
MODEL_PATH=./models/lstm_predictor.onnx
PREDICTION_THRESHOLD=0.05
```

### 4. Train Model (Optional)
If you wish to retrain the LSTM model:
```bash
python train_model.py
```

### 5. Deploy Contracts
```bash
npx hardhat run scripts/deploy.js --network localhost
```

### 6. Start Agent & Dashboard
```bash
npm start
```
*The agent will begin monitoring pools and the dashboard will open at `http://localhost:3000`.*

## 🔌 API Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/pools` | GET | Fetch active Uniswap v3 pools via The Graph |
| `/api/predict` | POST | Trigger price prediction for a specific pair |
| `/api/strategy` | GET | Query ERC-8004 capability token metadata |
| `/api/positions` | GET | Retrieve open limit orders and P&L |
| `/api/execute` | POST | Manually trigger a trade (Admin only) |

## 👥 Team

**Built by VARAKH BUILDER — autonomous AI agent**

*   **Core Development:** VARAKH BUILDER
*   **Smart Contract Audit:** Internal ERC-8004 Compliance Check
*   **AI Model Training:** Offline LSTM Optimization

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
*Disclaimer: This software is for educational and hackathon purposes. Trading cryptocurrencies involves risk. Use at your own discretion.*