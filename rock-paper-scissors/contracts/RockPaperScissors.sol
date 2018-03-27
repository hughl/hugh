pragma solidity ^0.4.19;

import "./GameHub.sol";

contract RockPaperScissors {
    
    event LogPlayerMove(address indexed game, address player, bytes32 secretMove);
    event LogRevealMove(address indexed game, address player, uint move);
    event LogEndGame(address indexed game, address playerEnded);

    enum Move { None, Rock, Paper, Scissors}
    
    struct Player {
        address account;
        bytes32 secretMove;
        Move revealedMove;
        bool joined;
    }
    
    Player[] players;
    address gameHub;
    uint public cost;
    uint public expiryTime;

    function RockPaperScissors(address p1, address p2, address hub, uint gameCost) public {
        createPlayer(p1);
        createPlayer(p2);
        gameHub = hub;
        cost = gameCost;
        expiryTime = now + 5 days;
    }

    function createPlayer(address playerAddress) private {
        Player memory playerOne = Player(playerAddress, 0, Move.None, false);
        players.push(playerOne);
    }

    function createSecretMove(address player, uint8 playerMove, bytes32 password) public pure returns (bytes32) {
        Move move = Move(playerMove);
        return keccak256(player, move, password);
    }

    function playerJoined(address playerAddress) public returns (bool) {
        require(msg.sender == gameHub);
        Player storage playerStruct = players[getPlayerIndex(playerAddress)];
        require(playerStruct.account == playerAddress);
        require(playerStruct.joined == false);
        playerStruct.joined = true;

        return true;
    }

    function getPlayerIndex(address playerAddress) private view returns (uint) {
        if (players[0].account == playerAddress) {
            return 0;
        } else if (players[1].account == playerAddress) {
            return 1;
        }else {
            revert();
        }
    }

    function playMove(bytes32 secretMove) public returns (bool) {
        Player storage playerStruct = players[getPlayerIndex(msg.sender)];
        require(playerStruct.joined);
        playerStruct.secretMove = secretMove;
        LogPlayerMove(this, msg.sender, secretMove);

        return true;
    }

    function revealMove(uint8 move, bytes32 password) public returns (bool) {
        // check each player has played their move before revealing
        for (uint i = 0; i < players.length; i++) {
            require(players[i].secretMove > 0);
        }

        Player storage playerStruct = players[getPlayerIndex(msg.sender)];

        bytes32 secretMove = createSecretMove(msg.sender, move, password);
        require(secretMove == playerStruct.secretMove);
        playerStruct.revealedMove = Move(move);
        
        Player storage playerOne = players[0];
        Player storage playerTwo = players[1];

        // If both moves are revealed give balance to winner.  
        if (playerOne.revealedMove != Move.None && playerTwo.revealedMove != Move.None) {
            GameHub gHub = GameHub(gameHub);
            uint result = (3 + uint(playerOne.revealedMove) - uint(playerTwo.revealedMove)) % 3;
            if (result == 1) {
                gHub.gameResult(this, playerOne.account, playerTwo.account, GameHub.GameResult.PlayerOneWin, cost);
            } else if (result == 2) {
                gHub.gameResult(this, playerOne.account, playerTwo.account, GameHub.GameResult.PlayerTwoWin, cost);
            } else if (result == 0) {
                gHub.gameResult(this, playerOne.account, playerTwo.account, GameHub.GameResult.Tied, cost);
            }
        }
        LogRevealMove(this, msg.sender, uint(playerStruct.revealedMove));
        return true;
    }

    // can request endgame if it has expired with a player not having played a move
    function requestEndGame() public  {
    
        // todo allow the non revealed 
        require(now >= expiryTime);
        Player storage player1Struct = players[0];
        Player storage player2Struct = players[1];
        require(msg.sender == player1Struct.account || msg.sender == player2Struct.account);

        // the game is over if both players have revealed moves
        require (uint(player1Struct.revealedMove) == 0 || uint(player2Struct.revealedMove) == 0);
        GameHub gHub = GameHub(gameHub);
        if (uint(player1Struct.revealedMove) == 0) {
            gHub.gameResult(this, player1Struct.account, player2Struct.account, GameHub.GameResult.PlayerTwoWin, cost);
        } else {
            gHub.gameResult(this, player1Struct.account, player2Struct.account, GameHub.GameResult.PlayerOneWin, cost);
        }
        LogEndGame(this, msg.sender);
    }
}