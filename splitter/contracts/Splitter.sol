pragma solidity ^0.4.0;
contract Splitter {
    
    mapping (address => uint) public payeeBalances;
    
    event LogWithdrawal(address withdrawer, uint amountWithDrawn);
    event LogSplitEther(address from, uint value, address payeeOne, address payeeTwo);
    
    function splitEther(address payeeOne, address payeeTwo) public payable {
        require(msg.value > 0);
        uint etherValueHalf = msg.value / 2;
        payeeBalances[payeeOne] += etherValueHalf;
        payeeBalances[payeeTwo] += etherValueHalf;
        LogSplitEther(msg.sender, msg.value, payeeOne, payeeTwo);
    }    
    
    function withdraw() public {
        uint amount = payeeBalances[msg.sender];
        require(amount > 0);
        payeeBalances[msg.sender] = 0;
        msg.sender.transfer(amount);
        LogWithdrawal(msg.sender, amount);
    }
}