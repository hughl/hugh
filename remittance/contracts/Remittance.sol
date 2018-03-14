pragma solidity ^0.4.17;

contract Remittance {
    
    event LogFundTransferCreated(address fundCreator, address indexed fundRecipient, uint amount);
    event LogFundWithdrawal(address indexed fundRecipient, uint amount);

    // A struct that will contain the details of a FundTransfer
    struct FundTransfer {
        address fundRecipient;
        uint amount;
    }

    // Store of all FundTransfers created
    mapping (bytes32 => FundTransfer) public fundTransfers;
    
    /**
      * Creates and stores a fund transfer with a unique ID
      *    
      * @param fundRecipient The account that will be the recipient of the funds in this transfer
      * @param puzzle The puzzle that needs to ba solved by the fundRecipient to withdraw the funds
      */
    function createFundTransfer(address fundRecipient, bytes32 puzzle) public payable {
        require(msg.value > 0);
        
        fundTransfers[puzzle] = FundTransfer(fundRecipient, msg.value);
        LogFundTransferCreated(msg.sender, fundRecipient, msg.value);
    }
    
     /**
      * Allows the recipient to withdraw the FundTransfer funds if they are the designated recipient of the FundTrasnfer with
      * the provided ID, and both plain text passes match the originally provided passwords when keccak256 hashed.
      *    
      * @param passwordOne The password to the first part of the puzzle
      * @param passwordTwo The password to the second part of the puzzle
      */
    function widthdrawFund(string passwordOne, string passwordTwo) public returns (bool) {
        FundTransfer storage fundTransfer = fundTransfers[keccak256(passwordOne, passwordTwo)];
        uint amount = fundTransfer.amount;
        require(amount > 0);

        // Only the stored fundRecipient should be allowed to release funds
        require(fundTransfer.fundRecipient == msg.sender);
        
        fundTransfer.amount = 0;
        LogFundWithdrawal(fundTransfer.fundRecipient, amount);
        msg.sender.transfer(amount);
        
        return true;
    }
}