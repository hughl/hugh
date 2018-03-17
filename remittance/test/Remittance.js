
var RemittanceContract = artifacts.require("./Remittance.sol");

Promise = require("bluebird");
Promise.promisifyAll(web3.eth, { suffix: "Promise" });
const Web3Utils = require('web3-utils');
const expectedExceptionPromise = require("./expected_exception_testRPC_and_geth.js");

contract('Remittance', function (accounts) {
    var remittanceContract;

    const contractCreator = accounts[3];
    const account_fund_creator = accounts[0];
    const account_fund_recipient = accounts[1];
    const fund_transfer_amount = web3.toWei(2, "ether");;
    const password_one = "p455w0rd123";
    var puzzle;
    const expiry_in_days = 2;

    const setBlockchainTime = function (time) {
        return new Promise((resolve, reject) => {
          web3.currentProvider.sendAsync({
            jsonrpc: "2.0",
            method: "evm_increaseTime",
            params: [time], // 86400 is num seconds in day
            id: new Date().getTime()
          }, (err, result) => {
            if(err){ return reject(err) }
            return resolve(result)
          });
        })
      }


    beforeEach('setup contract for each test', function () {
        return RemittanceContract.new({ from: contractCreator }).then(function (instance) {
            console.log("created new contract");
            remittanceContract = instance;
        });
    });

    it("should allow creation of a fund transfer", async () => {
        var txObj = await createFundTransfer();
        assertFundTransferCreated(txObj, fund_transfer_amount, expiry_in_days);
    });

    async function createFundTransfer() {
        puzzle = await remittanceContract.createPuzzle(account_fund_recipient, password_one);
        return await remittanceContract.createFundTransfer(puzzle, expiry_in_days,
            { from: account_fund_creator, value: fund_transfer_amount });
    }

    function assertFundTransferCreated(txObj, fundTransferAmount, expiryInDays) {
        var createFundEvent = txObj.logs[0];
        // Assert fundTranssferEvent details
        assert.strictEqual(txObj.logs.length, 1);
        assert.strictEqual(createFundEvent.args.fundCreator, account_fund_creator);
        assert.strictEqual(createFundEvent.args.amount.toString[10], fundTransferAmount.toString[10]);
        assert.strictEqual(Number(createFundEvent.args.expiryInDays), 2);
    }

    it("should allow fund recipient to withdraw funds with correct password", async () => {
        await createFundTransfer();

        const fund_recipient_initial_balance = await web3.eth.getBalancePromise(account_fund_recipient);

        // Try to withdraw the plain passwords
        var txObj = await remittanceContract.widthdrawFund(password_one, { from: account_fund_recipient });

        // Check the withdrawal event is emitted
        var fundWithdrawalEvent = txObj.logs[0];
        assert.strictEqual(txObj.logs.length, 1);
        assert.strictEqual(fundWithdrawalEvent.args.fundRecipient, account_fund_recipient);
        assert.strictEqual(fundWithdrawalEvent.args.amount.toString[10], fund_transfer_amount.toString[10]);

        // Check the Fund recipients account has increased by the fund_transfer_amount - gas cost
        var fundRecipientExpectedBalance = getExpectedBalanceAfterWithdraw(account_fund_recipient, fund_recipient_initial_balance, txObj.receipt, fund_transfer_amount)
        var fundRecipientNewBalance = await web3.eth.getBalancePromise(account_fund_recipient);
        assert.strictEqual(fundRecipientNewBalance.toString[10], fundRecipientExpectedBalance.toString[10], "fund recipient balance incorrect after withdrawal");
    });

    /**
     * This gets the expected balance after the given account has withdrawn their split of the Ether.
     * 
     * @param {*} address the address of the person withdrawing
     * @param {*} initialBalance the initial ether balance of the account
     * @param {*} withDrawTransactionReceipt the transaction receipt from the withdraw transaction
     * @param {*} amount the amount
     */
    async function getExpectedBalanceAfterWithdraw(address, initialBalance, withDrawTransactionReceipt, amount) {
        var tx = await web3.eth.getTransactionPromise(withDrawTransactionReceipt.transactionHash);
        var gasUsed = web3.toBigNumber(withDrawTransactionReceipt.gasUsed);
        var gasCost = tx.gasPrice.times(gasUsed);

        // expected balance has to take in to account the gas cost of the withdraw transaction
        var expectedBalance = (initialBalance.plus(amount)).minus(gasCost);
        return expectedBalance;
    }

    it("should not allow fund recipient to withdraw funds with incorrect passwords", async () => {
        createFundTransfer();

        // Try to withdraw with incorrect passwords
        return expectedExceptionPromise(function () {
            return remittanceContract.widthdrawFund("incorrect1", { from: account_fund_recipient });
        });
    });

    it("should not allow any one but the designated fund recipient to withdraw funds", async () => {
        createFundTransfer();

        // Try to withdraw from the an account that is not the designated fund recipient
        return expectedExceptionPromise(function () {
            return remittanceContract.widthdrawFund(password_one, { from: account_fund_creator});
        });
    });

    it("should allow the fund creator to withdraw the funds after the expiry time", async () => {
        await  createFundTransfer();
        
        var threeDaysInSeconds = 86400 * 3;
        await setBlockchainTime(threeDaysInSeconds) ;
        
        var txObj = await remittanceContract.reclaimFunds(account_fund_recipient, password_one,{from: account_fund_creator});        
        var fundReclaimedEvent = txObj.logs[0];

        assert.strictEqual(txObj.logs.length, 1);
        assert.strictEqual(fundReclaimedEvent.args.fundReclaimer, account_fund_creator);
        assert.strictEqual(fundReclaimedEvent.args.amount.toString[10], fund_transfer_amount.toString[10]);
    });

    it("should not allow the fund creator to reclaim the funds before the expiry time", async () => {
        await  createFundTransfer();
        
        // Try to reclaim funds before expiry
        return expectedExceptionPromise(function () {
            return remittanceContract.reclaimFunds(account_fund_recipient, password_one,{from: account_fund_creator});        
        });
    });

    it("should not allow someone other than the fund creator to reclaim the funds after the expiry time", async () => {
        await  createFundTransfer();
        
        var threeDaysInSeconds = 86400 * 3;
        await setBlockchainTime(threeDaysInSeconds) ;

        // Try to reclaim funds before expiry
        return expectedExceptionPromise(function () {
            return remittanceContract.reclaimFunds(account_fund_recipient, password_one,{from: account_fund_recipient});        
        });
    });
});