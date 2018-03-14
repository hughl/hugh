pragma solidity ^0.4.17;

contract Remittance {
    
    event LogFundTransferCreated(uint fundTransferId, address indexed fundRecipient, uint amount);
    event LogFundWithdrawal(uint fundTransferId, address indexed fundRecipient, uint amount);

    // A struct that will contain the details of a FundTransfer
    struct FundTransfer {
        uint id;
        address fundRecipient;
        // The combined hash of the two provided hashed passwords
        bytes32 passwordsHash;
        uint amount;
    }
    
    // The number of FundTransfers created 
    uint numberOfTransfers;

    // Store of all FundTransfers created
    mapping (uint => FundTransfer) public fundTransfers;
    
    /**
      * Creates and stores a fund transfer with a unique ID
      *    
      * @param fundRecipient The account that will be the recipient of the funds in this transfer
      * @param passwordOneHash The first keccak256 hashed password required for the recipient to withdraw the funds 
      * @param passwordTwoHash The second keccak256 hashed password required for the recipient to withdraw the funds
      */
    function createFundTransfer(address fundRecipient, bytes32 passwordOneHash, bytes32 passwordTwoHash) public payable {
        require(msg.value > 0);
        
        uint fundTransferId = ++numberOfTransfers;
        bytes32 passwordsHash = keccak256(passwordOneHash, passwordTwoHash);
        fundTransfers[fundTransferId] = FundTransfer(fundTransferId, fundRecipient, passwordsHash, msg.value);
        
        LogFundTransferCreated(fundTransferId, fundRecipient, msg.value);
    }
    
     /**
      * Allows the recipient to withdraw the FundTransfer funds if they are the designated recipient of the FundTrasnfer with
      * the provided ID, and both plain text passes match the originally provided passwords when keccak256 hashed.
      *    
      * @param fundTransferId The ID of the FundTransfer to withdraw funds from 
      * @param passwordOne The plain text password that when keccack256 hashed matches passwordOneHash used to create the FundTrasnfer
      * @param passwordTwo The plain text password that when keccack256 hashed matches passwordTwoHash used to create the FundTrasnfer
      */
    function widthdrawFund(uint fundTransferId, string passwordOne, string passwordTwo) public returns (bool) {
        FundTransfer storage fundTransfer = fundTransfers[fundTransferId];
        require(fundTransfer.id > 0);

        // Only the stored fundRecipient should be allowed to release funds
        require(fundTransfer.fundRecipient == msg.sender);
        require(fundTransfer.amount > 0);

        // CHeck the passwords are correct
        bytes32 passwordOneHash = keccak256(passwordOne);
        bytes32 passwordTwoHash = keccak256(passwordTwo);
        bytes32 passwordsHash = keccak256(passwordOneHash, passwordTwoHash);
        require(fundTransfer.passwordsHash == passwordsHash);
    
        uint amount = fundTransfer.amount;
        fundTransfer.amount = 0;
        
        LogFundWithdrawal(fundTransfer.id, fundTransfer.fundRecipient, amount);
        msg.sender.transfer(amount);
        
        return true;
    }
}