
var GameHubContract = artifacts.require("./GameHub.sol");
var RockPaperScissorsContract = artifacts.require("./RockPaperScissors.sol");
Promise = require("bluebird");
Promise.promisifyAll(web3.eth, { suffix: "Promise" });
const Web3Utils = require('web3-utils');
const expectedExceptionPromise = require("./expected_exception_testRPC_and_geth.js");
web3.eth.getTransactionReceiptMined = require("./getTransactionReceiptMined.js");

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

    const tie_game = 0;
    const player_one_win = 1;
    const player_two_win = 2;

    const getGameResultEvent = () => {
        return new Promise((resolve, reject) => {
           var event = gameHubContract.LogGameResult().watch(function(error, result) {
                event.stopWatching();
                return resolve(result);
            })
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
        var gameAddress = await runGame(SCISSORS, ROCK, game_cost);
        
        // check the balances have been updated according to who wins
        var playerBalance = await gameHubContract.playerBalances(player_one);
        var player2Balance = await gameHubContract.playerBalances(player_two);
        assert.strictEqual(Number(playerBalance), 0, "Player1 lost so should be 0");
        assert.strictEqual(Number(player2Balance), 1000, "Player2 won so should be 1000");

        assertGameResult(gameAddress, player_one, player_two, player_two_win, game_cost * 2); 
    });

    it("should handle a tied game", async () => {
        var gameAddress = await runGame(ROCK, ROCK, game_cost);
       
        // check the balances have been updated according to the tie
        var playerBalance = await gameHubContract.playerBalances(player_one);
        var player2Balance = await gameHubContract.playerBalances(player_two);
        assert.strictEqual(Number(playerBalance), game_cost, "Game tied - player should get money back");
        assert.strictEqual(Number(player2Balance), game_cost, "Game tied - player should get money back");
        
        assertGameResult(gameAddress, player_one, player_two, tie_game, 500);
    });

     it("should allow a player to play a game using previous winnings", async () => {
        var gameAddress = await runGame(SCISSORS, ROCK, game_cost);
        
        var txObj = await gameHubContract.createRockPaperScissorsGame(player_one, player_two, 1000);
        var gameAddress = assertGameCreated(txObj, 1000);
        // Player2 won so should have the funds for the new game
        var joinGame2TxObj = await joinGame(gameAddress, player_two, 0);
        assertGameJoined(joinGame2TxObj, player_one, gameAddress);
     });

     it("should allow a player to forfeit a game if they know they have lost without playing a move", async () => {
        var gameAddress = await setupJoinedGame(game_cost);
        var rpsGame = RockPaperScissorsContract.at(gameAddress);
  
        var player1SecretMove = await rpsGame.createSecretMove(player_one, ROCK, password);
        await rpsGame.playMove(player1SecretMove,{from:player_one});
        var player2SecretMove = await rpsGame.createSecretMove(player_two, SCISSORS, password);
        await rpsGame.playMove(player2SecretMove,{from:player_two});

        await rpsGame.revealMove(ROCK, password, {from:player_one});
        
        var txObj = await rpsGame.requestEndGame({from:player_two});
        var endGameEvent = txObj.logs[0];
        assert.strictEqual(endGameEvent.args.game, gameAddress);
        assert.strictEqual(endGameEvent.args.playerEnded, player_two);

        assertGameResult(gameAddress, player_one, player_two, player_one_win, game_cost * 2) ;
     });

     it("should not allow a player to end the game before the exipiry time if they have already played a move", async () => {
        var gameAddress = await setupJoinedGame(game_cost);
        var rpsGame = RockPaperScissorsContract.at(gameAddress);
  
        var player1SecretMove = await rpsGame.createSecretMove(player_one, ROCK, password);
        await rpsGame.playMove(player1SecretMove,{from:player_one});

        return expectedExceptionPromise(function () {
            return rpsGame.requestEndGame({from:player_one});
        });
     });

     it("should allow a player to end the game and win if the other player has not revealed a move after the game expires ", async () => {
        var gameAddress = await setupJoinedGame(game_cost);
        var rpsGame = RockPaperScissorsContract.at(gameAddress);
  
        var p1Move = ROCK;
        var p2Move = SCISSORS;
        var player1SecretMove = await rpsGame.createSecretMove(player_one, p1Move, password);
        var player2SecretMove = await rpsGame.createSecretMove(player_two, p2Move, password);

        await rpsGame.playMove(player1SecretMove,{from:player_one});
        await rpsGame.playMove(player2SecretMove,{from:player_two});
     
        await rpsGame.revealMove(p1Move, password, {from:player_one});

        // move block time past game expiry
        var fiveDaysInSeconds = 86400 * 6;
        await setBlockchainTime(fiveDaysInSeconds) ;

        var txObj = await rpsGame.requestEndGame({from:player_one});
        var endGameEvent = txObj.logs[0];
        assert.strictEqual(endGameEvent.args.game, gameAddress);
        assert.strictEqual(endGameEvent.args.playerEnded, player_one);

        assertGameResult(gameAddress, player_one, player_two, player_one_win, game_cost * 2) 

        var winnersBalance = await gameHubContract.playerBalances(player_one);
        assert.strictEqual(Number(winnersBalance    ), (game_cost * 2), "Player1 won - balnce should be above 0");
     });

     it("should allow a player to end the game and win if the other player has not played a move after the game expires ", async () => {
        var gameAddress = await setupJoinedGame(game_cost);
        var rpsGame = RockPaperScissorsContract.at(gameAddress);
  
        var p1Move = ROCK;
        var p2Move = SCISSORS;
        var player1SecretMove = await rpsGame.createSecretMove(player_one, p1Move, password);

        await rpsGame.playMove(player1SecretMove,{from:player_one});

        // move block time past game expiry
        var fiveDaysInSeconds = 86400 * 6;
        await setBlockchainTime(fiveDaysInSeconds) ;

        var txObj = await rpsGame.requestEndGame({from:player_one});
        var endGameEvent = txObj.logs[0];
        assert.strictEqual(endGameEvent.args.game, gameAddress);
        assert.strictEqual(endGameEvent.args.playerEnded, player_one);

        var gameResultEvent = await getGameResultEvent();
        assert.strictEqual(gameResultEvent.args.gameAddress, gameAddress);
        assert.strictEqual(gameResultEvent.args.playerOne, player_one);
        assert.strictEqual(gameResultEvent.args.playerTwo, player_two);
        assert.strictEqual(Number(gameResultEvent.args.result), 1);
        assert.equal(gameResultEvent.args.winningAmount, game_cost * 2);

        assertGameResult(gameAddress, player_one, player_two, player_one_win, game_cost * 2);

        var winnersBalance = await gameHubContract.playerBalances(player_one);
        assert.strictEqual(Number(winnersBalance    ), (game_cost * 2), "Player1 won - balnce should be above 0");
     });

    /** Utility Functions **/

    async function createGame(cost) {
        return await gameHubContract.createRockPaperScissorsGame(player_one, player_two, cost);
    }

    function assertGameCreated(txObj, cost) {
        var gameCreatedEvent = txObj.logs[0];
        // Assert fundTranssferEvent details
        assert.strictEqual(txObj.logs.length, 1);
        var gameAddress = gameCreatedEvent.args.gameAddress;
        assert.isTrue(gameAddress > 0);
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
        
        return gameAddress;
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

    async function assertGameResult(gameAddress, playerOne, playerTwo, result, amount) {
        var gameResultEvent = await getGameResultEvent();
        assert.strictEqual(gameResultEvent.args.gameAddress, gameAddress);
        assert.strictEqual(gameResultEvent.args.playerOne, playerOne);
        assert.strictEqual(gameResultEvent.args.playerTwo, playerTwo);
        assert.strictEqual(Number(gameResultEvent.args.result), result);
        assert.equal(gameResultEvent.args.winningAmount, amount);
    }
});