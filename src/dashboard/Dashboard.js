import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

const Dashboard = () => {
  const [agentAddress, setAgentAddress] = useState('');
  const [capabilityTokens, setCapabilityTokens] = useState([]);
  const [capabilityMetadata, setCapabilityMetadata] = useState({});
  const [token0Info, setToken0Info] = useState({ symbol: '', address: '', balance: '0', priceUsd: '0', priceUsd24hAgo: '0' });
  const [token1Info, setToken1Info] = useState({ symbol: '', address: '', balance: '0', priceUsd: '0', priceUsd24hAgo: '0' });
  const [totalValueUsd, setTotalValueUsd] = useState('0');
  const [totalValueUsd24hAgo, setTotalValueUsd24hAgo] = useState('0');
  const [openOrders, setOpenOrders] = useState([]);
  const [chartData, setChartData] = useState({ labels: [], datasets: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const rpcUrl = process.env.REACT_APP_RPC_URL || 'https://cloudflare-eth.com/';
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const agentAddr = process.env.REACT_APP_AGENT_ADDRESS;
        if (!agentAddr) throw new Error('REACT_APP_AGENT_ADDRESS not set');
        setAgentAddress(agentAddr);

        const registryAddr = process.env.REACT_APP_CAPABILITY_REGISTRY_ADDRESS;
        if (!registryAddr) throw new Error('REACT_APP_CAPABILITY_REGISTRY_ADDRESS not set');

        // Minimal ABI for CapabilityRegistry: balanceOf, tokenOfOwnerByIndex, tokenURI
        const registryAbi = [
          "function balanceOf(address) view returns (uint256)",
          "function tokenOfOwnerByIndex(address, uint256) view returns (uint256)",
          "function tokenURI(uint256) view returns (string)"
        ];
        const registry = new ethers.Contract(registryAddr, registryAbi, provider);

        const balance = await registry.balanceOf(agentAddr);
        const tokenIds = [];
        for (let i = 0; i < balance; i++) {
          const tokenId = await registry.tokenOfOwnerByIndex(agentAddr, i);
          tokenIds.push(tokenId.toString());
        }
        setCapabilityTokens(tokenIds);

        // Fetch metadata for each token
        const metadataPromises = tokenIds.map(async (tokenId) => {
          try {
            const tokenUri = await registry.tokenURI(tokenId);
            // If tokenURI is not a base64 JSON, we assume it's a URL
            let metadata = {};
            if (tokenUri.startsWith('data:application/json;base64,')) {
              const base64Data = tokenUri.substring('data:application/json;base64,'.length);
              const jsonStr = atob(base64Data);
              metadata = JSON.parse(jsonStr);
            } else if (tokenUri.startsWith('http')) {
              const response = await fetch(tokenUri);
              metadata = await response.json();
            } else {
              // Assume it's a direct IPFS gateway link? We'll try to fetch as URL
              const response = await fetch(`https://ipfs.io/ipfs/${tokenUri.replace('ipfs://', '')}`);
              metadata = await response.json();
            }
            return [tokenId, metadata];
          } catch (err) {
            console.error(`Failed to fetch metadata for token ${tokenId}:`, err);
            return [tokenId, { error: err.message }];
          }
        });
        const metadataResults = await Promise.all(metadataPromises);
        const metadataObj = {};
        metadataResults.forEach(([tokenId, meta]) => {
          metadataObj[tokenId] = meta;
        });
        setCapabilityMetadata(metadataObj);

        // If we have at least one capability token, get the pair from its metadata
        if (tokenIds.length > 0) {
          const firstTokenId = tokenIds[0];
          const meta = metadataObj[firstTokenId] || {};
          // We expect the metadata to have a 'pair' field with two token addresses
          const pair = meta.pair || [];
          if (pair.length === 2) {
            const [token0Addr, token1Addr] = pair;
            // We need to get the token symbols and decimals? We'll try to fetch from the token contract
            const erc20Abi = [
              "function symbol() view returns (string)",
              "function balanceOf(address) view returns (uint256)",
              "function decimals() view returns (uint8)"
            ];
            const token0Contract = new ethers.Contract(token0Addr, erc20Abi, provider);
            const token1Contract = new ethers.Contract(token1Addr, erc20Abi, provider);

            const [symbol0, symbol1, decimals0, decimals1, balance0, balance1] = await Promise.all([
              token0Contract.symbol(),
              token1Contract.symbol(),
              token0Contract.decimals(),
              token1Contract.decimals(),
              token0Contract.balanceOf(agentAddr),
              token1Contract.balanceOf(agentAddr)
            ]);

            // Format balances
            const formattedBalance0 = ethers.formatUnits(balance0, decimals0);
            const formattedBalance1 = ethers.formatUnits(balance1, decimals1);

            // Fetch prices from CoinGecko
            // We need to map addresses to CoinGecko IDs? We don't have a mapping.
            // We'll use a trusted list of common tokens? Not scalable.
            // For simplicity, we'll assume we can get the price by address via CoinGecko's contract endpoint
            // But note: CoinGecko does not have a direct endpoint by contract address for all chains.
            // We'll use the Ethereum mainnet and hope the tokens are listed.
            // We'll use: https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses={token0Addr},{token1Addr}&vs_currencies=usd
            // And for 24h ago: we need historical data. We'll use the /coins/{id}/history endpoint? But we don't have the coin id.
            // We'll skip 24h change for now and show a placeholder.
            // We'll at least show current prices.
            const priceResponse = await fetch(`https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=${token0Addr.toLowerCase()},${token1Addr.toLowerCase()}&vs_currencies=usd`);
            const priceData = await priceResponse.json();
            const price0Usd = priceData[token0Addr.toLowerCase()]?.usd || 0;
            const price1Usd = priceData[token1Addr.toLowerCase()]?.usd || 0;

            setToken0Info({
              symbol: symbol0,
              address: token0Addr,
              balance: formattedBalance0,
              priceUsd: price0Usd.toFixed(6),
              priceUsd24hAgo: '0' // placeholder
            });
            setToken1Info({
              symbol: symbol1,
              address: token1Addr,
              balance: formattedBalance1,
              priceUsd: price1Usd.toFixed(6),
              priceUsd24hAgo: '0' // placeholder
            });

            const totalValue = (parseFloat(formattedBalance0) * price0Usd) + (parseFloat(formattedBalance1) * price1Usd);
            setTotalValueUsd(totalValue.toFixed(2));
            setTotalValueUsd24hAgo('0'); // placeholder
          }
        }

        // Placeholder for open orders and chart
        setOpenOrders([{ id: 1, description: 'Placeholder open order' }]);
        setChartData({
          labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
          datasets: [
            {
              label: 'Actual Price',
              data: [65, 59, 80, 81, 56, 55, 40, 60, 70, 75, 60, 50],
              borderColor: 'blue',
              fill: false
            },
            {
              label: 'Predicted Price',
              data: [60, 55, 75, 80, 50, 50, 45, 55, 65, 70, 55, 45],
              borderColor: 'red',
              fill: false
            }
          ]
        });

        setLoading(false);
      } catch (err) {
        console.error('Dashboard error:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    init();
  },
  []
);

  if (loading) return <div className="dashboard">Loading...</div>;
  if (error) return <div className="dashboard">Error: {error}</div>;

  return (
    <div className="dashboard">
      <h1>AutoTradeX Dashboard</h1>

      <div className="section">
        <h2>Agent Information</h2>
        <p><strong>Address:</strong> {agentAddress}</p>
      </div>

      <div className="section">
        <h2>Capability Tokens Owned</h2>
        {capabilityTokens.length === 0 ? (
          <p>No capability tokens owned.</p>
        ) : (
          <ul>
            {capabilityTokens.map((tokenId) => (
              <li key={tokenId}>
                Token ID: {tokenId}
                {capabilityMetadata[tokenId] && capabilityMetadata[tokenId].pair && (
                  <br/>
                  Pair: {capabilityMetadata[tokenId].pair.join(' / ')}
                )}
              </li>
            ))}
          </ul>
        )
      </div>

      <div className="section">
        <h2>Holdings Value (USD)</h2>
        {token0Info.symbol && token1Info.symbol && (
          <div>
            <div>
              <strong>{token0Info.symbol}:</strong> {token0Info.balance} (${token0Info.priceUsd} each)
            </div>
            <div>
              <strong>{token1Info.symbol}:</strong> {token1Info.balance} (${token1Info.priceUsd} each)
            </div>
            <div>
              <strong>Total Value:</strong> ${totalValueUsd}
            </div>
            <div>
              <strong>Value 24h Ago:</strong> ${totalValueUsd24hAgo} (placeholder)
            </div>
          </div>
        )}
      </div>

      <div className="section">
        <h2>Open Orders</h2>
        {openOrders.length === 0 ? (
          <p>No open orders.</p>
        ) : (
          <ul>
            {openOrders.map((order, index) => (
              <li key={index}>{order.description}</li>
            ))}
          </ul>
        )
      </div>

      <div className="section">
        <h2>Price Prediction Chart</h2>
        <div>
          {/* In a real app, we would render a chart here using a library like Chart.js or Recharts.
              For simplicity, we show a placeholder. */}
          <p>Chart placeholder: Predicted vs Actual Price</p>
          <pre>{JSON.stringify(chartData, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
