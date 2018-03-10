
var SplitterContract = artifacts.require("./Splitter.sol");
Promise = require("bluebird");
Promise.promisifyAll(web3.eth, { suffix: "Promise" });

contract('Splitter', function(accounts) {
    var splitterContract;
    /** The account that will send ether to be split */
    const account_sender = accounts[0];
    /** An account that will be specified as a payee in the splitEther contract function */ 
    const account_payee1 = accounts[1];
    /** Another account that will be specified as a payee in the splitEther contract function */ 
    const account_payee2 = accounts[2];

    const contractCreator = accounts[3];

    beforeEach('setup contract for each test', function () {
        return SplitterContract.new({from:contractCreator}).then(function(instance) {
            console.log("created new contract");
            splitterContract = instance;
        });
    });
  
  it("should split ether", function() {
    return splitterContract.splitEther(account_payee1, account_payee2, {from: account_sender, value: 10}).then(
        (result) => {
            var splitEtherEvent = result.logs[0];
            assert.equal(result.logs.length, 1);
            assert.equal(splitEtherEvent.args.from, account_sender);
            assert.equal(splitEtherEvent.args.value, 10);
            assert.equal(splitEtherEvent.args.payeeOne, account_payee1);
            assert.equal(splitEtherEvent.args.payeeTwo, account_payee2); 

            return splitterContract.balances(account_payee1);
        } ).then(amount =>  {
            console.log("amount = " + JSON.stringify(amount));
            assert.equal(amount, 5, "Invalid amount transferred to payee1");
            
            return splitterContract.balances.call(account_payee2);
        }).then(amount =>  {
            assert.equal(amount, 5, "Invalid amount transferred to payee2");
        });;
    });

    it("should allow accounts to withdraw split ether", async() => {
        const payee1InitialBalance = await web3.eth.getBalancePromise(account_payee1);
        const payee2InitialBalance = await web3.eth.getBalancePromise(account_payee2);
        const ethToSplit = web3.toWei(2, "ether");

        await splitterContract.splitEther(account_payee1, account_payee2, {from: account_sender, value: ethToSplit });

        // payee 1 withdraw
        var payee1TxObj = await splitterContract.withdraw({from: account_payee1});
        var withdrawalEvent = payee1TxObj.logs[0];
        // check for withdrawal event
        assert.equal(payee1TxObj.logs.length, 1);
        assert.equal(withdrawalEvent.args.withdrawer, account_payee1);
        assert.equal(withdrawalEvent.args.amountWithDrawn, ethToSplit / 2);

        var payee1ExpectedBalance =  await getExpectedBalanceAfterWithdraw(account_payee1, payee1InitialBalance, payee1TxObj.receipt, ethToSplit);
        var payee1NewBalance = await web3.eth.getBalance(account_payee1);

        // payee 2 withdraw
        var payee2TxObj = await splitterContract.withdraw({from: account_payee2});
        var withdrawalEvent2 = payee2TxObj.logs[0];
        // check for withdrawal event
        assert.equal(payee2TxObj.logs.length, 1);
        assert.equal(withdrawalEvent2.args.withdrawer, account_payee2);
        assert.equal(withdrawalEvent2.args.amountWithDrawn, ethToSplit / 2);

        var payee2ExpectedBalance =  await getExpectedBalanceAfterWithdraw(account_payee2, payee2InitialBalance, payee2TxObj.receipt, ethToSplit);
        var payee2NewBalance = await web3.eth.getBalance(account_payee2);

        console.log ("payee1  initialBalance: " + payee1InitialBalance + ", newBalance:" + payee1NewBalance + ", expected: " + payee1ExpectedBalance);
        console.log ("payee2 initBalance: " + payee1InitialBalance + ", newBalance: " + payee2NewBalance + ", expected: " + payee2ExpectedBalance);

        assert.equal(payee1NewBalance.toString[10], payee1ExpectedBalance.toString[10], "Payee1 balance incorrect after split");
        assert.equal(payee2NewBalance.toString[10], payee2ExpectedBalance.toString[10], "Payee2 balance incorrect after split");
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
        var tx = await web3.eth.getTransactionPromise(withDrawTransactionReceipt.transactionHash);
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
            await splitterContract.withdraw({from: account_payee1});
          } catch (error) {
            err = error
          }
      
          assert.ok(err instanceof Error, "withdraw with 0 balnace should have been reverted");
    });
});