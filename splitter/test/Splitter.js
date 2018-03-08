var SplitterContract = artifacts.require("./Splitter.sol");

contract('Splitter', function(accounts) {
    var contract;
    /** The account that will send ether to be split */
    var account_sender = accounts[0];
    /** An account that will be specified as a payee in the splitEther contract function */ 
    var account_payee1 = accounts[1];
    /** Another account that will be specified as a payee in the splitEther contract function */ 
    var account_payee2 = accounts[2];

    beforeEach('setup contract for each test', function () {
        return SplitterContract.new().then(function(instance) {
            console.log("created new contract");
            contract = instance;
        });
    });

  it("should split ether", function() {
    return contract.splitEther(account_payee1, account_payee2, {from: account_sender, value: 10}).then(
        (txn) => {
            return contract.payeeBalances.call(account_payee1);
        } ).then(amount =>  {
            assert.equal(amount, 5, "Invalid amount transferred to payee1");
            
            return contract.payeeBalances.call(account_payee1);
        }).then(amount =>  {
            assert.equal(amount, 5, "Invalid amount transferred to payee2");
        });;
    });

    it("should allow accounts to withdraw split ether", async() => {
        const payee1InitialBalance = await web3.eth.getBalance(account_payee1);
        const payee2InitialBalance = await web3.eth.getBalance(account_payee2);
        const ethToSplit = web3.toWei(2, "ether");

        await contract.splitEther(account_payee1, account_payee2, {from: account_sender, value: ethToSplit });

        var payee1TxObj = await contract.withdraw({from: account_payee1});
        var payee1ExpectedBalance =  await getExpectedBalanceAfterWithdraw(account_payee1, payee1InitialBalance, payee1TxObj.receipt, ethToSplit);
        var payee1NewBalance = await web3.eth.getBalance(account_payee1);

        var payee2TxObj = await contract.withdraw({from: account_payee2});
        var payee2ExpectedBalance =  await getExpectedBalanceAfterWithdraw(account_payee2, payee2InitialBalance, payee2TxObj.receipt, ethToSplit);
        var payee2NewBalance = await web3.eth.getBalance(account_payee2);

        console.log ("payee1  initialBalance: " + payee1InitialBalance + ", newBalance:" + payee1NewBalance + ", expected: " + payee1ExpectedBalance);
        console.log ("payee2 initBalance: " + payee1InitialBalance + ", newBalance: " + payee2NewBalance + ", expected: " + payee2ExpectedBalance);

        assert.equal("" +payee1NewBalance, "" +payee1ExpectedBalance, "Payee1 balance incorrect after split");
        assert.equal("" +payee2NewBalance, "" +payee2ExpectedBalance, "Payee2 balance incorrect after split");
    });

    /**
     * This gets the expected balance after the given account has withdrawn their split of the Ether.
     * 
     * @param {*} address the address of the person withdrawing
     * @param {*} initialBalance the initial ether balance of the account
     * @param {*} withDrawTransactionReceipt the transaction receipt from the withdraw transaction
     * @param {*} amountSplit the amount of ether that was originally split
     */
    async function getExpectedBalanceAfterWithdraw (address, initialBalance, withDrawTransactionReceipt, amountSplit) {
        var tx = await web3.eth.getTransaction(withDrawTransactionReceipt.transactionHash);
        var gasUsed = web3.toBigNumber(withDrawTransactionReceipt.gasUsed);
        var gasCost = tx.gasPrice.times(gasUsed);
        console.log("gas cost: " + gasCost);
        var splitVal = amountSplit / 2;

        // expected balance has to take in to account the gas cost of the withdraw transaction
        var expectedBalance = (initialBalance.plus(splitVal)).minus(gasCost);
        return expectedBalance;
    }

    it("should require a > 0 balance on the contract for an account to withdraw", async() => {
        const payee1InitialBalance = await web3.eth.getBalance(account_payee1);
        var err = null;
        try {
            await contract.withdraw({from: account_payee1});
          } catch (error) {
            err = error
          }
      
          assert.ok(err instanceof Error, "withdraw with 0 balnace should have been reverted");
    });
});