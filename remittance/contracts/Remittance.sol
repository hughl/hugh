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
    
    /**
      * Creates and stores a fund transfer with a unique ID
      *    
      * @param fundRecipient The account that will be the recipient of the funds in this transfer
      * @param password The password
      */
    function createFundTransfer(address fundRecipient, string password, uint expiryInDays) public payable {
        require(msg.value > 0);
        
        bytes32 fundTransferKey = keccak256(fundRecipient, password);
        fundTransfers[fundTransferKey] = FundTransfer({
                fundCreator: msg.sender,
                amount: msg.value,
                createdAt: now,
                expiry : expiryInDays
            });
        LogFundTransferCreated(msg.sender, fundRecipient, msg.value, now, expiryInDays);
    }
    
     /**
      * Allows the recipient to withdraw the FundTransfer funds if they are the designated recipient of the FundTrasnfer
      * with the correct password
      *    
      * @param password The passsword
      */
    function widthdrawFund(string password) public returns (bool) {
        bytes32 fundTransferKey = keccak256(msg.sender, password);
        FundTransfer storage fundTransfer = fundTransfers[fundTransferKey];
        uint amount = fundTransfer.amount;
        require(amount > 0);
        
        // Only the stored fundRecipient should be allowed to release funds
        fundTransfer.amount = 0;
        LogFundWithdrawal(msg.sender, amount);
        msg.sender.transfer(amount);
        
        return true;
    }

    function reclaimFunds(address fundRecipient, string password)  public returns (bool) {
        bytes32 fundTransferKey = keccak256(fundRecipient, password);
        FundTransfer storage fundTransfer = fundTransfers[fundTransferKey];
        uint amount = fundTransfer.amount;

        // check that the fundTansfer has expired
        require(now >= (fundTransfer.createdAt + fundTransfer.expiry * 1 days));
        require(msg.sender == fundTransfer.fundCreator);
       
        fundTransfer.amount = 0;
        LogFundReclaimed(msg.sender, amount);
        msg.sender.transfer(amount);

        return true;
    }
}