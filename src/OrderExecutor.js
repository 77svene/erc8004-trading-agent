const { ethers } = require('ethers');

// Configuration
const RPC_URL = process.env.RPC_URL || 'https://eth-cloudflare.blockpi.network/v1/rpc/public';
const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY) {
  throw new Error('PRIVATE_KEY environment variable is required');
}

// Constants
const UNISWAP_V3_FACTORY_ADDRESS = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3';
const UNISWAP_V3_ROUTER_ADDRESS = '0xE592427A0AEce92De3Edee1F18E0157C05861564';

// ABIs
const FACTORY_ABI = [
  "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)"
];

const POOL_ABI = [
  "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  "function liquidity() external view returns (uint128)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)"
];

const PERMIT2_ABI = [
  "function nonces(address owner) external view returns (uint256)",
  "function permit(address tokenOwner, address spender, uint256 nonce, uint256 expiry, bool allowed, uint8 v, bytes32 r, bytes32 s) external"
];

const ROUTER_ABI = [
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)"
];

// Initialize provider and wallet
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// Get contract instances
const factory = new ethers.Contract(UNISWAP_V3_FACTORY_ADDRESS, FACTORY_ABI, wallet);
const permit2 = new ethers.Contract(PERMIT2_ADDRESS, PERMIT2_ABI, wallet);
const router = new ethers.Contract(UNISWAP_V3_ROUTER_ADDRESS, ROUTER_ABI, wallet);

/**
 * Get pool data for a token pair on Uniswap v3
 * @param {string} tokenIn - Address of the input token
 * @param {string} tokenOut - Address of the output token
 * @returns {Promise<Object>} Pool data including sqrtPriceX96, tick, liquidity, token0, token1
 */
async function getPoolData(tokenIn, tokenOut) {
  // Ensure tokenIn < tokenOut for consistent pool lookup (Uniswap v3 uses sorted tokens)
  const [tokenA, tokenB] = tokenIn.toLowerCase() < tokenOut.toLowerCase() ? [tokenIn, tokenOut] : [tokenOut, tokenIn];
  const feeTiers = [100, 500, 3000]; // 0.01%, 0.05%, 0.3%

  for (const fee of feeTiers) {
    try {
      const poolAddress = await factory.getPool(tokenA, tokenB, fee);
      if (poolAddress === '0x0000000000000000000000000000000000000000') {
        continue; // Pool not initialized
      }

      const pool = new ethers.Contract(poolAddress, POOL_ABI, wallet);
      const [sqrtPriceX96, tick] = await pool.slot0();
      const liquidity = await pool.liquidity();
      const [token0, token1] = await Promise.all([pool.token0(), pool.token1()]);

      return {
        sqrtPriceX96,
        tick,
        liquidity,
        token0,
        token1,
        fee,
        poolAddress
      };
    } catch (error) {
      // Continue to next fee tier if call fails
      continue;
    }
  }

  throw new Error(`No pool found for token pair ${tokenIn}/${tokenOut}`);
}

/**
 * Calculate the limit order amount based on price prediction and slippage
 * @param {number} pricePrediction - Predicted price (tokenOut per tokenIn)
 * @param {number} slippage - Slippage tolerance (e.g., 0.01 for 1%)
 * @returns {ethers.BigNumber} Amount of tokenIn to trade (in wei, assuming 18 decimals)
 */
function calculateLimitAmount(pricePrediction, slippage) {
  // Placeholder: trade 1 ether worth of tokenIn
  // In a real implementation, this would use the agent's balance and price prediction
  return ethers.utils.parseEther('1');
}

/**
 * Create a Permit2 signature for approving token spending
 * @param {Object} orderParams - Parameters for the order
 * @param {string} orderParams.tokenIn - Address of the token to approve{