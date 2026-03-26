// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/**
 * @title CapabilityRegistry
 * @dev ERC-721 token that represents a trading strategy capability as per ERC-8004.
 *      Each token encodes a strategyId, modelHash, permitted pairs, and maxSlippage.
 */
contract CapabilityRegistry is ERC721 {
    // Struct to hold the capability data for a token
    struct Capability {
        string strategyId;
        bytes32 modelHash;
        address[] permittedToken0;  // Array of token0 addresses for each pair
        address[] permittedToken1;  // Array of token1 addresses for each pair (same length as permittedToken0)
        uint256 maxSlippage;        // In basis points (e.g., 100 = 1%)
    }

    // Mapping from tokenId to its capability data
    mapping(uint256 => Capability) private _capabilities;

    /**
     * @dev Emitted when a capability is minted.
     * @param tokenId The ID of the minted token
     * @param strategyId The strategy identifier
     * @param modelHash The hash of the model used
     * @param permittedToken0 Array of token0 addresses for permitted pairs
     * @param permittedToken1 Array of token1 addresses for permitted pairs
     * @param maxSlippage The maximum slippage allowed (basis points)
     */
    event CapabilityMinted(
        uint256 indexed tokenId,
        string strategyId,
        bytes32 modelHash,
        address[] permittedToken0,
        address[] permittedToken1,
        uint256 maxSlippage
    );

    /**
     * @dev Emitted when a capability is burned.
     * @param tokenId The ID of the burned token
     */
    event CapabilityBurned(uint256 indexed tokenId);

    /**
     * @dev Mints a new capability token.
     * @param to The address that will receive the minted token
     * @param strategyId The strategy identifier
     * @param modelHash The hash of the model used
     * @param permittedToken0 Array of token0 addresses for permitted pairs
     * @param permittedToken1 Array of token1 addresses for permitted pairs (must same length as permittedToken0)
     * @param maxSlippage The maximum slippage allowed (basis points)
     * @return tokenId The ID of the newly minted token
     */
    function mintCapability(
        address to,
        string calldata strategyId,
        bytes32 modelHash,
        address[] calldata permittedToken0,
        address[] calldata permittedToken1,
        uint256 maxSlippage
    ) public returns (uint256) {
        require(permittedToken0.length == permittedToken1.length, "Pairs length mismatch");
        uint256 tokenId = _nextTokenId();
        _safeMint(to, tokenId);
        _capabilities[tokenId] = Capability({
            strategyId: strategyId,
            modelHash: modelHash,
            permittedToken0: permittedToken0,
            permittedToken1: permittedToken1,
            maxSlippage: maxSlippage
        });
        emit CapabilityMinted(tokenId, strategyId, modelHash, permittedToken0, permittedToken1, maxSlippage);
        return tokenId;
    }

    /**
     * @dev Burns the capability token, destroying it.
     * @param tokenId The ID of the token to burn
     */
    function burnCapability(uint256 tokenId) public {
        require(_exists(tokenId), "ERC721: burn nonexistent token");
        _burn(tokenId);
        delete _capabilities[tokenId];
        emit CapabilityBurned(tokenId);
    }

    /**
     * @dev Verifies if the given tokenId matches the provided capability parameters.
     * @param tokenId The ID of the token to verify
     * @param strategyId The strategy identifier to check against
     * @param modelHash The model hash to check against
     * @param permittedToken0 Array of token0 addresses for permitted pairs to check against
     * @param permittedToken1 Array of token1 addresses for permitted pairs to check against
     * @param maxSlippage The maximum slippage allowed (basis points) to check against
     * @return true if the tokenId exists and all fields match exactly, false otherwise
     */
    function verifyCapability(
        uint256 tokenId,
        string calldata strategyId,
        bytes32 modelHash,
        address[] calldata permittedToken0,
        address[] calldata permittedToken1,
        uint256 maxSlippage
    ) public view returns (bool) {
        if (!_exists(tokenId)) {
            return false;
        }
        Capability storage cap = _capabilities[tokenId];
        
        // Check strategyId
        if (keccak256(bytes(cap.strategyId)) != keccak256(bytes(strategyId))) {
            return false;
        }
        // Check modelHash
        if (cap.modelHash != modelHash) {
            return false;
        }
        // Check maxSlippage
        if (cap.maxSlippage != maxSlippage) {
            return false;
        }
        // Check permittedToken0 length
        if (cap.permittedToken0.length != permittedToken0.length) {
            return false;
        }
        // Check permittedToken1 length
        if (cap.permittedToken1.length != permittedToken1.length) {
            return false;
        }
        // Check each address in permittedToken0
        for (uint256 i = 0; i < cap.permittedToken0.length; i++) {
            if (cap.permittedToken0[i] != permittedToken0[i]) {
                return false;
            }
        }
        // Check each address in permittedToken1
        for (uint256 i = 0; i < cap.permittedToken1.length; i++) {
            if (cap.permittedToken1[i] != permittedToken1[i]) {
                return false;
            }
        }
        return true;
    }

    /**
     * @dev Returns the capability data for a given tokenId.
     * @param tokenId The ID of the token to query
     * @return strategyId The strategy identifier
     * @return modelHash The hash of the model used
     * @return permittedToken0 Array of token0 addresses for permitted pairs
     * @return permittedToken1 Array of token1 addresses for permitted pairs
     * @return maxSlippage The maximum slippage allowed (basis points)
     */
    function getCapability(uint256 tokenId)
        public
        view
        returns (
            string memory strategyId,
            bytes32 modelHash,
            address[] memory permittedToken0,
            address[] memory permittedToken1,
            uint256 maxSlippage
        )
    {
        require(_exists(tokenId), "ERC721: nonexistent token");
        Capability storage cap = _capabilities[tokenId];
        return (cap.strategyId, cap.modelHash, cap.permittedToken0, cap.permittedToken1, cap.maxSlippage);
    }

    // The following functions are overrides required by ERC721.

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
