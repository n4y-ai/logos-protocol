// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title NameRegistry
 * @notice Global registry for unique Logos handles (NEXOs)
 * @dev Handles are Base36 (A-Z, 0-9), uppercase, 4-10 characters
 * 
 * Deployments:
 * - Base Mainnet (V2): 0x87B9fD42553067BeBc2Abf42c7045C8F2F7D1A79
 * - Legacy (V1): see `n4y.ai/logos/DEPLOYMENT.md`
 */
contract NameRegistry {
    
    // Custom errors for gas efficiency
    error HandleAlreadyRegistered();
    error InvalidHandleLength();
    error InvalidHandleCharacter();
    error HandleNotRegistered();
    
    // Events
    event NameRegistered(string indexed handle, address indexed controller);
    
    // Storage
    mapping(string => address) private _handleToController;
    mapping(address => string) private _controllerToHandle;
    
    /**
     * @notice Check if a handle is available for registration
     * @param handle The handle to check (will be validated)
     * @return bool True if available
     */
    function isAvailable(string calldata handle) external view returns (bool) {
        if (!_isValidHandle(handle)) return false;
        return _handleToController[handle] == address(0);
    }
    
    /**
     * @notice Resolve a handle to its controller address
     * @param handle The handle to resolve
     * @return address The controller address (0x0 if not registered)
     */
    function resolve(string calldata handle) external view returns (address) {
        return _handleToController[handle];
    }
    
    /**
     * @notice Get the handle for a controller address
     * @param controller The controller address
     * @return string The handle (empty if not registered)
     */
    function reverseResolve(address controller) external view returns (string memory) {
        return _controllerToHandle[controller];
    }
    
    /**
     * @notice Register a new handle
     * @param handle The handle to register (must be valid Base36, 4-10 chars)
     * @param controller The controller address for this handle
     */
    function registerName(string calldata handle, address controller) external {
        // Validate handle format
        if (!_isValidHandle(handle)) {
            bytes memory h = bytes(handle);
            if (h.length < 4 || h.length > 10) {
                revert InvalidHandleLength();
            }
            revert InvalidHandleCharacter();
        }
        
        // Check availability
        if (_handleToController[handle] != address(0)) {
            revert HandleAlreadyRegistered();
        }
        
        // Register
        _handleToController[handle] = controller;
        _controllerToHandle[controller] = handle;
        
        emit NameRegistered(handle, controller);
    }
    
    /**
     * @dev Validate handle format: Base36 (A-Z, 0-9), 4-10 characters
     */
    function _isValidHandle(string calldata handle) internal pure returns (bool) {
        bytes memory h = bytes(handle);
        
        // Length check: 4-10 characters
        if (h.length < 4 || h.length > 10) {
            return false;
        }
        
        // Character check: A-Z (65-90) or 0-9 (48-57)
        for (uint i = 0; i < h.length; i++) {
            bytes1 char = h[i];
            bool isUpperLetter = (char >= 0x41 && char <= 0x5A); // A-Z
            bool isDigit = (char >= 0x30 && char <= 0x39);       // 0-9
            
            if (!isUpperLetter && !isDigit) {
                return false;
            }
        }
        
        return true;
    }
}

