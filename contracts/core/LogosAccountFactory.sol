// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./LogosAccount.sol";
import "./NameRegistry.sol";

/**
 * @title LogosAccountFactory
 * @notice Factory for creating LogosAccount instances with handle registration
 * @dev Creates account and registers handle in one transaction
 */
contract LogosAccountFactory {
    
    // Custom errors
    error HandleNotAvailable();
    error InvalidHandle();
    
    // Events
    event LogosCreated(
        address indexed account,
        address indexed owner,
        address indexed agent,
        string handle
    );
    
    // References
    NameRegistry public immutable nameRegistry;
    
    // Tracking
    mapping(address => address) public ownerToAccount;
    address[] public allAccounts;
    
    constructor(address _nameRegistry) {
        nameRegistry = NameRegistry(_nameRegistry);
    }
    
    /**
     * @notice Create a new Logos account with handle registration
     * @param owner The owner's public key address
     * @param agent The agent's public key address  
     * @param handle The desired handle (must be available)
     * @return account The created LogosAccount address
     */
    function createLogos(
        address owner,
        address agent,
        string calldata handle
    ) external returns (address account) {
        // Check handle availability
        if (!nameRegistry.isAvailable(handle)) {
            revert HandleNotAvailable();
        }
        
        // Deploy LogosAccount
        LogosAccount logos = new LogosAccount(owner, agent, handle);
        account = address(logos);
        
        // Register handle pointing to the account
        nameRegistry.registerName(handle, account);
        
        // Track
        ownerToAccount[owner] = account;
        allAccounts.push(account);
        
        emit LogosCreated(account, owner, agent, handle);
        
        return account;
    }
    
    /**
     * @notice Get total number of created accounts
     */
    function totalAccounts() external view returns (uint256) {
        return allAccounts.length;
    }
    
    /**
     * @notice Get account by index
     */
    function getAccount(uint256 index) external view returns (address) {
        return allAccounts[index];
    }
}

