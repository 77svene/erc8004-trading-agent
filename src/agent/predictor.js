const fs = require('fs');
const path = require('path');
const ort = require('onnxruntime-node');

// Model and normalization parameters paths
const MODEL_PATH = path.resolve(__dirname, 'model.onnx');
const NORMS_PATH = path.resolve(__dirname, 'norm_params.json');

// Cached model session and normalization parameters
let session = null;
let normParams = { mean: [], std: [] };

// Initialize the model and load normalization parameters
async function initialize() {
  try {
    // Load normalization parameters
    const normsData = fs.readFileSync(NORMS_PATH, 'utf8');
    normParams = JSON.parse(normsData);
    
    // Load the ONNX model
    session = await ort.InferenceSession.create(MODEL_PATH);
    console.log('Model and normalization parameters loaded successfully');
  } catch (error) {
    console.error('Failed to initialize predictor:', error);
    throw error;
  }
}

// Initialize on module load
initialize().catch(console.error);

/**
 * Fetches the latest 20 candles (hourly data) for a given Uniswap v3 pool from The Graph subgraph.
 * @param {string} poolAddress - The address of the Uniswap v3 pool
 * @returns {Promise<Array<Array<number>>>} - Array of 20 candles, each candle is [open, high, low, close, volume]
 */
async function fetchLatestCandles(poolAddress) {
  const subgraphUrl = 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3';
  
  const query = {
    query: `
      query GetPoolHourData($pool: String!) {
        pool(id: $pool) {
          poolHourData(orderBy: periodStartUnix, orderDirection: desc, first: 20) {
            periodStartUnix
            open
            high
            low
            close
            volumeToken0
          }
        }
      }
    `,
    variables: { pool: poolAddress.toLowerCase() }
  };

  try {
    const response = await fetch(subgraphUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query)
    });

    if (!response.ok) {
      throw new Error(`The Graph request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.errors) {
      throw new Error(`GraphQL error: ${result.errors.map(e => e.message).join(', ')}`);
    }

    const poolData = result.data.pool;
    if (!poolData || !poolData.poolHourData) {
      throw new Error('No pool data returned from The Graph');
    }

    const candles = poolData.poolHourData.map(hourData => [
      parseFloat(hourData.open),
      parseFloat(hourData.high),
      parseFloat(hourData.low),
      parseFloat(hourData.close),
      parseFloat(hourData.volumeToken0)
    ]);

    // Ensure we have exactly 20 candles, pad with last available if necessary (though we requested 20)
    if (candles.length < 20) {
      console.warn(`Only ${candles.length} candles received, padding with last candle`);
      const lastCandle = candles[candles.length - 1] || [0,0,0,0,0];
      while (candles.length < 20) {
        candles.push(lastCandle);
      }
    } else if (candles.length > 20) {
      candles.length = 20; // Trim to 20
    }

    // Reverse to get chronological order (oldest first) for model input
    return candles.reverse();
  } catch (error) {
    console.error('Error fetching candles from The Graph:', error);
    throw error;
  }
}

/**
 * Normalizes candle data using pre-loaded mean and standard deviation.
 * @param {Array<Array<number>>} candles - Array of candles, each [open, high, low, close, volume]
 * @returns {Array<Array<number>>} - Normalized candles
 */
function normalizeCandles(candles) {
  if (normParams.mean.length === 0 || normParams.std.length === 0) {
    throw new Error('Normalization parameters not loaded');
  }
  
  return candles.map(candle => {
    return candle.map((value, index) => {
      const mean = normParams.mean[index] || 0;
      const std = normParams.std[index] || 1;
      return std !== 0 ? (value - mean) / std : 0;
    });
  });
}

/**
 * Predicts the next period price and confidence for a given Uniswap v3 pool.
 * @param {string} poolAddress - The address of the Uniswap v3 pool
 * @returns {Promise<{ predictedPrice: number, confidence: number }>} - Predicted price and confidence
 */
async function predictPrice(poolAddress) {
  if (!session) {
    await initialize(); // Ensure model is loaded
  }

  try {
    // Fetch latest 20 candles
    const candles = await fetchLatestCandles(poolAddress);
    
    // Normalize the candle data
    const normalized = normalizeCandles(candles);
    
    // Prepare input tensor: shape [1, 20, 5]
    const inputTensor = new ort.Tensor('float32', normalized.flat(), [1, 20, 5]);
    
    // Run inference
    const feeds = { input: inputTensor };
    const results = await session.run(feeds);
    
    // Assuming model output is [1, 2]: [predicted_price, confidence]
    const output = outputs.output.data; // Adjust based on actual model output name
    
    // Denormalize the predicted price if necessary (assuming model output is normalized)
    // We assume the model was trained on normalized data and outputs normalized price.
    // We need to denormalize using the mean and std of the close price (index 3)
    const priceMean = normParams.mean[3] || 0;
    const priceStd = normParams.std[3] || 1;
    const predictedPrice = output[0] * priceStd + priceMean;
    const confidence = Math.max(0, Math.min(1, output[1])); // Clamp confidence to [0,1]
    
    return { predictedPrice, confidence };
  } catch (error) {
    console.error('Error during price prediction:', error);
    throw error;
  }
}

module.exports = {
  predictPrice,
  fetchLatestCandles,
  initialize
};
