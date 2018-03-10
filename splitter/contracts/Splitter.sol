pragma solidity ^0.4.0;
contract Splitter {
    
    mapping (address => uint) public balances;
    
    event LogWithdrawal(address indexed withdrawer, uint amountWithDrawn);
    event LogSplitEther(address indexed from, uint value, address  indexed payeeOne, address indexed payeeTwo);
    
    function splitEther(address payeeOne, address payeeTwo) public payable {
        require(msg.value > 0);
        uint etherValueHalf = msg.value / 2;
        balances[payeeOne] += etherValueHalf;
        balances[payeeTwo] += etherValueHalf;
        LogSplitEther(msg.sender, msg.value, payeeOne, payeeTwo);
    }    
    
    function withdraw() public {
        uint amount = balances[msg.sender];
        require(amount > 0);
        balances[msg.sender] = 0;
        LogWithdrawal(msg.sender, amount);
        msg.sender.transfer(amount);
    }
}