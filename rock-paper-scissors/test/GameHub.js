
var GameHubContract = artifacts.require("./GameHub.sol");
var RockPaperScissorsContract = artifacts.require("./RockPaperScissors.sol");
Promise = require("bluebird");
Promise.promisifyAll(web3.eth, { suffix: "Promise" });
const Web3Utils = require('web3-utils');
const expectedExceptionPromise = require("./expected_exception_testRPC_and_geth.js");
web3.eth.getTransactionReceiptMined = require("./getTransactionReceiptMined.js");

contract('GameHub', function (accounts) {
    var gameHubContract;

    const contractCreator = accounts[3];
    const player_one = accounts[0];
    const player_two = accounts[1];
    const password = "p455w0rd123";

    const game_cost = 500;
    const expiry_in_days = 2;
    const ROCK = 1;
    const PAPER = 2;
    const SCISSORS = 3;

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
        return GameHubContract.new({ from: contractCreator }).then(function (instance) {
            console.log("created new contract");
            gameHubContract = instance;
        });
    });

    it("should create a RockPaperScissors spoke contract", async () => {
        var txObj = await createGame(game_cost);
        assertGameCreated(txObj, game_cost);
    });

    it("should allow both players to join a game", async () => {
        var txObj = await createGame(game_cost);
        var gameAddress = assertGameCreated(txObj, game_cost);
        
        var joinTxObj1 = await joinGame(gameAddress, player_one, game_cost);
        assertGameJoined(joinTxObj1, player_one, gameAddress);

        var joinTxObj2 = await joinGame(gameAddress, player_two, game_cost);
        assertGameJoined(joinTxObj2, player_two, gameAddress);
    });

    it("should not allow a player to join the same game twice", async () => {
        var txObj = await createGame(game_cost);
        var gameAddress = assertGameCreated(txObj, game_cost);
        
        var joinTxObj1 = await joinGame(gameAddress, player_one, game_cost);
        assertGameJoined(joinTxObj1, player_one, gameAddress);
        
          // Try to withdraw with incorrect passwords
          return expectedExceptionPromise(function () {
            return gameHubContract.joinGame(gameAddress, {from: player_one, value: game_cost});
        }). then(function (err)  {
            return gameHubContract.playerBalances(player_one);
        }). then (function (balance) { 
            assert.strictEqual(Number(balance), 0, "The TX should have been reverted so the player should not have a balance");
        }); 
    });

    it("should only allow designated players to join a game", async () => {
        var txObj = await createGame(game_cost);
        var gameAddress = assertGameCreated(txObj, game_cost);
        
        return expectedExceptionPromise(function () {
            return gameHubContract.joinGame(gameAddress, {from: accounts[4], value: game_cost});
        });
    });

    it("should determine a winner", async () => {
        await runGame(SCISSORS, ROCK, game_cost);
        
        // check the balances have been updated according to who wins
        var playerBalance = await gameHubContract.playerBalances(player_one);
        var player2Balance = await gameHubContract.playerBalances(player_two);
        console.log("p2 bal " + player2Balance);
        assert.strictEqual(Number(playerBalance), 0, "Player1 lost so should be 0");
        assert.strictEqual(Number(player2Balance), 1000, "Player2 won so should be 1000");
    });

    it("should handle a tied game", async () => {
        await runGame(ROCK, ROCK, game_cost);
       
        // check the balances have been updated according to the tie
        var playerBalance = await gameHubContract.playerBalances(player_one);
        var player2Balance = await gameHubContract.playerBalances(player_two);
        assert.strictEqual(Number(playerBalance), game_cost, "Game tied - player should get money back");
        assert.strictEqual(Number(player2Balance), game_cost, "Game tied - player should get money back");
    });

     it("should allow a player to play a game using previous winnings", async () => {
        await runGame(SCISSORS, ROCK, game_cost);
        
        var txObj = await gameHubContract.createRockPaperScissorsGame(player_one, player_two, 1000);
        var gameAddress = assertGameCreated(txObj, 1000);
        // Player2 won so should have the funds for the new game
        var joinGame2TxObj = await joinGame(gameAddress, player_two, 0);
        assertGameJoined(joinGame2TxObj, player_one, gameAddress);
     });

    async function createGame(cost) {
        return await gameHubContract.createRockPaperScissorsGame(player_one, player_two, cost);
    }

    function assertGameCreated(txObj, cost) {
        var gameCreatedEvent = txObj.logs[0];
        // Assert fundTranssferEvent details
        assert.strictEqual(txObj.logs.length, 1);
        var gameAddress = gameCreatedEvent.args.gameAddress;
        assert.isTrue(gameAddress > 0);
        console.log(gameCreatedEvent.args.gameAddress);
        assert.strictEqual(gameCreatedEvent.args.playerOne, player_one);
        assert.strictEqual(gameCreatedEvent.args.playerTwo, player_two);
        assert.strictEqual(gameCreatedEvent.args.cost.toString[10], cost.toString[10]);

        return gameAddress
    }

     async function joinGame(gameAddress, player, cost) {
        return await gameHubContract.joinGame(gameAddress, {from: player, value: cost});
    }

    async function assertGameJoined(txObj, playerAddress, gameAddress) {
        var gameCreatedEvent = txObj.logs[0];
    
        // Assert fundTranssferEvent details
        assert.strictEqual(txObj.logs.length, 1);
        assert.strictEqual(gameCreatedEvent.args.gameAddress, gameAddress);
        assert.strictEqual(gameCreatedEvent.args.player, playerAddress);
    }

     async function runGame(p1Move, p2Move, cost) {
        var gameAddress = await setupJoinedGame(cost);
        var rpsGame = RockPaperScissorsContract.at(gameAddress);
  
        var player1SecretMove = await rpsGame.createSecretMove(player_one, p1Move, password);
        var player2SecretMove = await rpsGame.createSecretMove(player_two, p2Move, password);
 
        await rpsGame.playMove(player1SecretMove,{from:player_one});
        await rpsGame.playMove(player2SecretMove,{from:player_two});
     
        await rpsGame.revealMove(p1Move, password, {from:player_one});
        await rpsGame.revealMove(p2Move, password, {from:player_two});
     }

     async function setupJoinedGame(cost) {
        var txObj = await gameHubContract.createRockPaperScissorsGame(player_one, player_two, cost);
        var gameAddress = assertGameCreated(txObj, cost);
        
        var joinTxObj1 = await joinGame(gameAddress, player_one, cost);
        assertGameJoined(joinTxObj1, player_one, gameAddress);

        var joinTxObj2 = await joinGame(gameAddress, player_two, cost);
        assertGameJoined(joinTxObj2, player_two, gameAddress);
        
        return gameAddress;
    }
});