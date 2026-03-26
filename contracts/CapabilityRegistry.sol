pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CapabilityRegistry is ERC721URIStorage, Ownable {
    // Struct to hold strategy details
    struct Strategy {
        bytes32 strategyId;
        bytes32 modelHash;
        address[] permittedPairs;
        uint256 maxSlippage;
    }

    // Mapping from tokenId to strategy details
    mapping(uint256 => Strategy) private _strategies;
    // Mapping from strategyId to tokenId (to enforce uniqueness and enable lookup)
    mapping(bytes32 => uint256) private _strategyIdToTokenId;
    // Mapping from tokenId to strategyId (for burning cleanup)
    mapping(uint256 => bytes32) private _tokenIdToStrategyId;
    // Counter for token IDs
    uint256 private _tokenCounter;

    // Events
    event StrategyCapabilityMinted(uint256 indexed tokenId, bytes32 strategyId);
    event StrategyCapabilityBurned(uint256 indexed tokenId, bytes32 strategyId);

    constructor() ERC721("Capability Registry", "CAP") {
        _tokenCounter = 1;
    }

    /// @dev Mints a new capability token representing a trading strategy.
    /// @param to The address that will receive the minted token.
    /// @param strategyId Unique identifier for the strategy.
    /// @param modelHash Hash of the off-chain model used.
    /// @param permittedPairs Array of token pair addresses the strategy is allowed to trade.
    /// @param maxSlippage Maximum slippage allowed (in basis points).
    /// @return tokenId The ID of the newly minted token.
    function mintCapability(
        address to,
        bytes32 strategyId,
        bytes32 modelHash,
        address[] memory permittedPairs,
        uint256 maxSlippage
    ) public onlyOwner returns (uint256) {
        require(_strategyIdToTokenId[strategyId] == 0, "Strategy ID already exists");
        uint256 tokenId = _tokenCounter++;
        _safeMint(to, tokenId);
        // Set token URI (placeholder)
        _setTokenURI(tokenId, "ipfs://placeholder/");
        // Store strategy details
        _strategies[tokenId] = Strategy(strategyId, modelHash, permittedPairs, maxSlippage);
        _strategyIdToTokenId[strategyId] = tokenId;
        _tokenIdToStrategyId[tokenId] = strategyId;
        emit StrategyCapabilityMinted(tokenId, strategyId);
        return tokenId;
    }

    /// @dev Burns a capability token, destroying the strategy association.
    /// @param tokenId The ID of the token to burn.
    function burnCapability(uint256 tokenId) public onlyOwner {
        require(_exists(tokenId), "Token does not exist");
        bytes32 strategyId = _tokenIdToStrategyId[tokenId];
        _burn(tokenId);
        delete _strategies[tokenId];
        delete _strategyIdToTokenId[strategyId];
        delete _tokenIdToStrategyId[tokenId];
        emit StrategyCapabilityBurned(tokenId, strategyId);
    }

    /// @dev Returns the strategy details associated with a token ID.
    /// @param tokenId The ID of the token to query.
    /// @return strategyId The strategy identifier.
    /// @return modelHash The hash of the model used.
    /// @return permittedPairs The array of permitted token pairs.
    /// @return maxSlippage The maximum slippage allowed (in basis points).
    function capabilityInfo(uint256 tokenId)
        public
        view
        returns (bytes32 strategyId, bytes32 modelHash, address[] memory permittedPairs, uint256 maxSlippage)
    {
        require(_exists(tokenId), "Token does not exist");
        Strategy memory s = _strategies[tokenId];
        return (s.strategyId, s.modelHash, s.permittedPairs, s.maxSlippage);
    }

    /// @dev Checks if a caller is authorized to use a strategy on a target contract.
    /// @param caller The address of the caller attempting to execute the strategy.
    /// @param strategyId The strategy identifier to check authorization for.
    /// @param target The target contract address (e.g., a Uniswap pool or router).
    /// @return true if the caller is authorized to use the strategy on the target, false otherwise.
    function isAuthorized(address caller, bytes32 strategyId, address target)
        public
        view
        returns (bool)
    {
        uint256 tokenId = _strategyIdToTokenId[strategyId];
        if (tokenId == 0) {
            return false;
        }
        // Check token exists (if strategyId mapping is non-zero, token should exist unless burned, but we clean mapping on burn)
        if (!_exists(tokenId)) {
            return false;
        }
        // Check ownership
        if (ownerOf(tokenId) != caller) {
            return false;
        }
        // Check if target is in permittedPairs
        Strategy memory s = _strategies[tokenId];
        for (uint256 i = 0; i < s.permittedPairs.length; i++) {
            if (s.permittedPairs[i] == target) {
                return true;
            }
        }
        return false;
    }

    // Helper to check if a token exists (internal to ERC721, but we expose a public view)
    function _exists(uint256 tokenId) internal view returns (bool) {
        return _tokenIdToStrategyId[tokenId] != bytes32(0);
    }
}
