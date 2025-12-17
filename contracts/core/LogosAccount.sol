// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title LogosAccount
 * @notice Smart Account for Logos identity with two-key architecture
 * @dev Owner key has full control, Agent key has limited autonomous capabilities
 * 
 * Two-Key Architecture:
 * - Owner Key: User's primary key, stored encrypted in browser, full control
 * - Agent Key: AI's key, stored on backend, limited actions (sign messages, etc.)
 */
contract LogosAccount {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;
    
    // Custom errors
    error NotOwner();
    error NotOwnerOrAgent();
    error InvalidSignature();
    error CallFailed();
    
    // Events
    event AgentKeyUpdated(address indexed oldAgent, address indexed newAgent);
    event MessageSigned(bytes32 indexed messageHash, address indexed signer);
    
    // Immutable state
    address public immutable owner;
    string public handle;
    
    // Mutable state  
    address public agent;
    uint256 public nonce;
    
    // Signed messages log (for verification)
    mapping(bytes32 => bool) public signedMessages;
    
    /**
     * @notice Initialize the Logos account
     * @param _owner The owner's public key address
     * @param _agent The agent's public key address
     * @param _handle The Logos handle (NEXO)
     */
    constructor(address _owner, address _agent, string memory _handle) {
        owner = _owner;
        agent = _agent;
        handle = _handle;
    }
    
    /**
     * @notice Get the DID for this Logos
     * @return string The DID in format did:logos:HANDLE
     */
    function getDID() external view returns (string memory) {
        return string(abi.encodePacked("did:logos:", handle));
    }
    
    /**
     * @notice Update the agent key (owner only)
     * @param newAgent The new agent address
     */
    function setAgent(address newAgent) external {
        if (msg.sender != owner) revert NotOwner();
        
        address oldAgent = agent;
        agent = newAgent;
        
        emit AgentKeyUpdated(oldAgent, newAgent);
    }
    
    /**
     * @notice Execute a call (owner only)
     * @param target The target contract
     * @param value ETH value to send
     * @param data The calldata
     */
    function execute(address target, uint256 value, bytes calldata data) external returns (bytes memory) {
        if (msg.sender != owner) revert NotOwner();
        
        (bool success, bytes memory result) = target.call{value: value}(data);
        if (!success) revert CallFailed();
        
        return result;
    }
    
    /**
     * @notice Record a signed message (agent or owner)
     * @param messageHash The hash of the signed message
     */
    function recordSignedMessage(bytes32 messageHash) external {
        if (msg.sender != owner && msg.sender != agent) revert NotOwnerOrAgent();
        
        signedMessages[messageHash] = true;
        emit MessageSigned(messageHash, msg.sender);
    }
    
    /**
     * @notice Verify a signature from owner or agent
     * @param messageHash The message hash
     * @param signature The signature
     * @return signer The address that signed (owner, agent, or address(0) if invalid)
     */
    function verifySignature(bytes32 messageHash, bytes calldata signature) 
        external 
        view 
        returns (address signer) 
    {
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        signer = ethSignedHash.recover(signature);
        
        if (signer != owner && signer != agent) {
            return address(0);
        }
        
        return signer;
    }
    
    /**
     * @notice Check if an address is owner or agent
     */
    function isAuthorized(address addr) external view returns (bool) {
        return addr == owner || addr == agent;
    }
    
    // Receive ETH
    receive() external payable {}
}

