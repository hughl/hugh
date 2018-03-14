
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
    const password_two = "t35tP455";
    const hashed_password_one = Web3Utils.soliditySha3(password_one);
    const hashed_password_two = Web3Utils.soliditySha3(password_two);

    beforeEach('setup contract for each test', function () {
        return RemittanceContract.new({ from: contractCreator }).then(function (instance) {
            console.log("created new contract");
            remittanceContract = instance;
        });
    });

    it("should allow creation of a fund transfer", async () => {
        var txObj = await remittanceContract.createFundTransfer(account_fund_recipient, hashed_password_one, hashed_password_two,
            { from: account_fund_creator, value: fund_transfer_amount });
        var expectedFundTransferId = 1;
        // Access the  mapping (uint => FundTransfer) public fundTransfers directly and check it has been stored
        var fundTransferMappingValue = await remittanceContract.fundTransfers(expectedFundTransferId);
        assertFundTransferCreated(expectedFundTransferId, txObj, fundTransferMappingValue, fund_transfer_amount);
    });

    function assertFundTransferCreated(expectedFundTransferId, txObj, fundTransferMappingValue, fundTransferAmount) {
        var createFundEvent = txObj.logs[0];
        // Assert fundTranssferEvent details
        assert.strictEqual(txObj.logs.length, 1);
        assert.strictEqual(Number(createFundEvent.args.fundTransferId), expectedFundTransferId, "Fund Transfer ID invalid");
        assert.strictEqual(createFundEvent.args.fundRecipient, account_fund_recipient);
        assert.strictEqual(createFundEvent.args.amount.toString[10], fundTransferAmount.toString[10]);

        // Assert a FundTransfer is inserted into the fundTransfers mapping
        assert.strictEqual(Number(fundTransferMappingValue[0]), expectedFundTransferId, "Fund Transfer ID invalid");
        assert.strictEqual(fundTransferMappingValue[1], account_fund_recipient, "Fund Transfer recipient invalid");
        var fundTransferPassHash = Web3Utils.soliditySha3(hashed_password_one, hashed_password_two);
        assert.strictEqual(fundTransferMappingValue[2], fundTransferPassHash, "Fund Transfer passwords invalid");
        assert.strictEqual(fundTransferMappingValue[3].toString[10], fundTransferAmount.toString[10], "Fund Transfer amount invalid");
    }

    it("should increment Fund Transfer ID on subsequent creations of FundTransfers", async () => {
        var txObj1 = await remittanceContract.createFundTransfer(account_fund_recipient, hashed_password_one, hashed_password_two,
            { from: account_fund_creator, value: fund_transfer_amount });
        // Access the  mapping (uint => FundTransfer) public fundTransfers directly and check it has been stored
        var fundTransferMappingValue1 = await remittanceContract.fundTransfers(1);
        assertFundTransferCreated(1, txObj1, fundTransferMappingValue1, fund_transfer_amount);

        var txObj2 = await remittanceContract.createFundTransfer(account_fund_recipient, hashed_password_one, hashed_password_two,
            { from: account_fund_creator, value: fund_transfer_amount });
        var fundTransferMappingValue2 = await remittanceContract.fundTransfers(2);
        assertFundTransferCreated(2, txObj2, fundTransferMappingValue2, fund_transfer_amount);
    });

    it("should allow fund recipient to withdraw funds with correct passwords", async () => {
        const fund_recipient_initial_balance = await web3.eth.getBalancePromise(account_fund_recipient);

        // perhaps wait on mined
        await remittanceContract.createFundTransfer(account_fund_recipient, hashed_password_one, hashed_password_two,
            { from: account_fund_creator, value: fund_transfer_amount });

        // Try to withdraw the plain passwords
        var txObj = await remittanceContract.widthdrawFund(1, password_one, password_two, { from: account_fund_recipient });

        // Check the withdrawal event is emitted
        var fundWithdrawalEvent = txObj.logs[0];
        assert.strictEqual(txObj.logs.length, 1);
        assert.strictEqual(Number(fundWithdrawalEvent.args.fundTransferId), 1, "Fund Transfer ID invalid");
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
        await remittanceContract.createFundTransfer(account_fund_recipient, hashed_password_one, hashed_password_two,
            { from: account_fund_creator, value: fund_transfer_amount });

        // Try to withdraw with incorrect passwords
        return expectedExceptionPromise(function () {
            return remittanceContract.widthdrawFund(1, "incorrect1", "incorrect2", { from: account_fund_recipient });
        });
    });

    it("should not allow fund recipient to withdraw funds with one correct and one incorrect password", async () => {
        await remittanceContract.createFundTransfer(account_fund_recipient, hashed_password_one, hashed_password_two,
            { from: account_fund_creator, value: fund_transfer_amount });

        // Try to withdraw with one incorrect password
        return expectedExceptionPromise(function () {
            return remittanceContract.widthdrawFund(1, password_one, "incorrect2", { from: account_fund_recipient });
        });
    });

    it("should not allow any one but the designated fund recipient to withdraw funds", async () => {
        await remittanceContract.createFundTransfer(account_fund_recipient, hashed_password_one, hashed_password_two,
            { from: account_fund_creator, value: fund_transfer_amount });

        // Try to withdraw from the an account that is not the designated fund recipient
        return expectedExceptionPromise(function () {
            return remittanceContract.widthdrawFund(1, password_one, password_two, { from: account_fund_creator});
        });
    });
});