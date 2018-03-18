pragma solidity ^0.4.17;

contract Remittance {
    
    event LogFundTransferCreated(address indexed fundCreator, address indexed fundRecipient, uint amount, uint createAt, uint expiryInDays);
    event LogFundWithdrawal(address indexed fundRecipient, uint amount);
    event LogFundReclaimed(address indexed fundReclaimer, uint amount);

    // A struct that will contain the details of a FundTransfer
    struct FundTransfer {
        address fundCreator;
        uint amount;
        uint createdAt;
        uint expiry;
    }

    // Store of all FundTransfers created
    mapping (bytes32 => FundTransfer) public fundTransfers;
    
    function createPuzzle(address fundRecipient, string password) public pure returns (bytes32) {
        return keccak256(fundRecipient, password);
    }

    /**
      * Creates and stores a fund transfer with a unique ID
      *    
      * @param puzzle The puzzle that needs to be solved to withdraw
      * @param expiryInDays the expiry date of the transfer
      */
    function createFundTransfer(bytes32 puzzle, address fundRecipient, uint expiryInDays) public payable returns(bool) {
        require(msg.value > 0);

        FundTransfer storage fundTransfer = fundTransfers[puzzle];
        require(fundTransfer.fundCreator == 0);
        fundTransfer.fundCreator = msg.sender;
        fundTransfer.amount = msg.value;
        fundTransfer.createdAt = now;
        fundTransfer.expiry = expiryInDays;

        LogFundTransferCreated(msg.sender, fundRecipient, fundTransfers[puzzle].amount, now, expiryInDays);
        return true;
    }
    
     /**
      * Allows the recipient to withdraw the FundTransfer funds if they have 
      * correct password and they are the designated fundRecipient
      *    
      * @param password The passsword
      */
    function widthdrawFund(string password) public returns (bool) {
        bytes32 puzzle = createPuzzle(msg.sender, password);
        FundTransfer storage fundTransfer = fundTransfers[puzzle];
        uint amount = fundTransfer.amount;
        require(fundTransfer.amount > 0);
        
        // Only the stored fundRecipient should be allowed to release funds
        fundTransfer.amount = 0;
        LogFundWithdrawal(msg.sender, amount);
        msg.sender.transfer(amount);
        
        return true;
    }

    function reclaimFunds(address fundRecipient, string password)  public returns (bool) {
        bytes32 puzzle = createPuzzle(fundRecipient, password);
        FundTransfer storage fundTransfer = fundTransfers[puzzle];
        uint amount = fundTransfer.amount;   
        require(amount > 0);
        // check that the fundTansfer has expired
        require(now >= (fundTransfer.createdAt + fundTransfer.expiry * 1 days));
        require(msg.sender == fundTransfer.fundCreator);
       
        fundTransfer.amount = 0;
        LogFundReclaimed(msg.sender, amount);
        msg.sender.transfer(amount);

        return true;
    }
}