pragma solidity ^0.4.19;

import "./RockPaperScissors.sol";

contract GameHub {
    event LogGameCreated(address indexed gameAddress, address indexed playerOne, address indexed playerTwo, uint cost);
    event LogPlayerJoined(address indexed gameAddress, address indexed player);
    event LogGameResult(address indexed gameAddress, string winner, uint winningAmount);

    mapping(address => uint) gameMap;
    address[] public games;
    
    mapping (address => uint) public playerBalances;
    
    enum GameResult { Tied, PlayerOneWin, PlayerTwoWin}
    
    function createRockPaperScissorsGame(address playerOne, address playerTwo, uint cost) public returns (address) {
        require(playerOne > 0 && playerTwo > 0);
        require(playerOne != playerTwo);
        
        RockPaperScissors rpsGame = new RockPaperScissors(playerOne, playerTwo, this, cost);
        games.push(rpsGame);
        gameMap[rpsGame] = games.length - 1;

        LogGameCreated(rpsGame, playerOne, playerTwo, cost);

        return rpsGame;
    }

    function joinGame(address gameAddress) payable public returns (bool) {
        require(gameAddress > 0);
        uint gameLocation = gameMap[gameAddress];
        address game = games[gameLocation];
        require(game == gameAddress);
        RockPaperScissors g = RockPaperScissors(game);
    
        playerBalances[msg.sender] += msg.value;
        
        uint gameCost = g.cost();
        require(playerBalances[msg.sender] >= gameCost);

        playerBalances[msg.sender] -= gameCost;

        g.playerJoined(msg.sender);
        LogPlayerJoined(gameAddress, msg.sender);

        return true;
    }

    function gameResult(address gameAddress, address playerOne, address playerTwo,
        GameResult result, uint cost) public returns (bool) {
        require(gameAddress > 0);
        uint gameLocation = gameMap[gameAddress];
        address game = games[gameLocation];
        assert(game == gameAddress);
        
        address winner;
        uint winningAmount = cost * 2;
        if (result == GameResult.Tied) {
            playerBalances[playerOne] += cost;
            playerBalances[playerTwo] += cost;
            LogGameResult(gameAddress, "TIED", cost);
        } else if(result == GameResult.PlayerOneWin) {
            
            playerBalances[playerOne] += winningAmount;
            winner = playerOne;
            LogGameResult(gameAddress, "PLAYER_ONE", winningAmount);
        } else if (result == GameResult.PlayerTwoWin) {
            playerBalances[playerTwo] += winningAmount;
            winner = playerTwo;
            LogGameResult(gameAddress, "PLAYER_TWO", winningAmount);
        } else {
            revert();
        }
    
        return true;
    }
}