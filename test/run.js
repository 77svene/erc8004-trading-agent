const { expect } = require("chai");
const { ethers } = require("hardhat");
const nock = require("nock");
const { spawn } = require("child_process");

// Helper to sleep
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe("AutoTradeX Integration Test", function () {
  this.timeout(0);

  let capabilityRegistry;
  let deployer, agent;
  let mockGraphPort = 4001;
  let hardhatNode;
  let agentLoop;
  let agentOutput = "";

  before(async function () {
    // Start Hardhat node
    hardhatNode = spawn("npx", ["hardhat", "node"], { stdio: "ignore" });
    await sleep(5000); // wait for node to start

    [deployer, agent] = await ethers.getSigners();

    // Deploy CapabilityRegistry
    const CapabilityRegistry = await ethers.getContractFactory("CapabilityRegistry");
    capabilityRegistry = await CapabilityRegistry.deploy("AutoTradeX Capability", "ATCX");
    await capabilityRegistry.deployed();

    // Mint a capability for a dummy strategy
    const strategyId = ethers.utils.formatBytes32String("dummy");
    const modelHash = ethers.utils.formatBytes32String("0x123");
    const permittedPairs = [ethers.constants.AddressZero]; // dummy pair
    const maxSlippage = 50; // 0.5% in bips

    const tx = await capabilityRegistry.mintCapability(agent.address, {
      strategyId,
      modelHash,
      permittedPairs,
      maxSlippage
    });
    const receipt = await tx.wait();
    const tokenId = receipt.events.find(e => e.event === "Transfer").args.tokenId;

    // Set environment variables for the agent
    const privateKey = agent._signingKey().privateKey;
    process.env.PRIVATE_KEY = "0x" + privateKey.toString("hex");
    process.env.RPC_URL = "http://localhost:8545";
    process.env.CAPABILITY_REGISTRY_ADDRESS = capabilityRegistry.address;
    process.env.TOKEN_ID = tokenId.toString();
    process.env.GRAPH_ENDPOINT = `http://localhost:${mockGraphPort}/subgraphs/name/uniswap/uniswap-v3`;

    // Start mock Graph server
    nock(`http://localhost:${mockGraphPort}`)
      .post("/subgraphs/name/uniswap/uniswap-v3")
      .reply(200, {
        data: {
          pool: {
            id: "0xPoolAddress",
            token0: { symbol: "WETH" },
            token1: { symbol: "USDC" }
          },
          candleData: [
            { time_start: 1, open: 100, high: 101, low: 99, close: 100 },
            { time_start: 2, open: 100, high: 102, low: 100, close: 101 },
            { time_start: 3, open: 101, high: 103, low: 101, close: 102 },
            { time_start: 4, open: 102, high: 104, low: 102, close: 103 },
            { time_start: 5, open: 103, high: 105, low: 103, close: 104 },
            { time_start: 6, open: 104, high: 106, low: 104, close: 105 },
            { time_start: 7, open: 105, high: 107, low: 105, close: 106 },
            { time_start: 8, open: 106, high: 108, low: 106, close: 107 },
            { time_start: 9, open: 107, high: 109, low: 107, close: 108 },
            { time_start: 10, open: 108, high: 110, low: 108, close: 109 }
          ]
        }
      })
      .persist();

    // Start the agent loop
    agentLoop = spawn("node", ["src/agent/loop.js"], {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    agentLoop.stdout.on("data", data => {
      agentOutput += data.toString();
    });
    agentLoop.stderr.on("data", data => {
      agentOutput += data.toString();
    });

    // Wait for agent to produce output indicating a limit order was created
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timed out waiting for agent output"));
      }, 30000);

      const checkInterval = setInterval(() => {
        if (agentOutput.includes("Created limit order") || agentOutput.includes("Signature")) {
          clearInterval(timeout);
          clearInterval(checkInterval);
          resolve();
        }
      }, 1000);

      agentLoop.on("error", err => {
        clearInterval(timeout);
        clearInterval(checkInterval);
        reject(err);
      });
    });
  });

  after(async function () {
    if (agentLoop) {
      agentLoop.kill();
    }
    if (hardhatNode) {
      hardhatNode.kill();
    }
    nock.cleanAll();
  });

  it("should create a limit order when price moves up", async function () {
    // If we reach here, the agent produced the expected output
    expect(agentOutput.includes("Created limit order") || agentOutput.includes("Signature")).to.be.true;
    // Additional checks: we could verify the signature format, but we rely on the agent's internal correctness
    // For now, we just check that the agent didn't crash and produced the expected log.
  });
});
