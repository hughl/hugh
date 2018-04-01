pragma solidity ^0.4.19;

import "./GameHub.sol";

contract RockPaperScissors {
    
    event LogPlayerMove(address indexed game, address player, bytes32 secretMove);
    event LogRevealMove(address indexed game, address player, uint move);
    event LogRequestEndGame(address indexed game, address playerEnded);

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
        require(players[0].secretMove > 0);
        require(players[1].secretMove > 0);

        Player storage playerStruct = players[getPlayerIndex(msg.sender)];
        bytes32 secretMove = createSecretMove(msg.sender, move, password);
        require(secretMove == playerStruct.secretMove);
        playerStruct.revealedMove = Move(move);

        if (players[0].revealedMove != Move.None && players[1].revealedMove != Move.None) {
            sendGameResultToHub(players[0], players[1]);
        }
        LogRevealMove(this, msg.sender, uint(playerStruct.revealedMove));
        return true;
    }

    function sendGameResultToHub(Player playerOne, Player playerTwo) private {
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

    // can request endgame if it has expired with a player not having played a move
    function requestEndGame() public  {    
        require(msg.sender == players[0].account || msg.sender == players[1].account);
        bool expired = now >= expiryTime;
        uint playerEndingIndex = getPlayerIndex(msg.sender);
        uint otherPlayerIndex = playerEndingIndex == 0 ? 1 : 0;
        Player storage playerEnding = players[playerEndingIndex];
        Player storage otherPlayer = players[otherPlayerIndex];
        GameHub gHub = GameHub(gameHub);
        
         // If playerEnding has not revealed their move but other has, forfeit the game
        if (playerEnding.revealedMove == Move.None && uint(otherPlayer.revealedMove) > 0) {
            GameHub.GameResult result = playerEndingIndex == 0 ? GameHub.GameResult.PlayerTwoWin : GameHub.GameResult.PlayerOneWin;
            gHub.gameResult(this, players[0].account, players[1].account, result, cost);    
        }
        // Tie game if no one has made a move regardless of expiry time
        else if (playerEnding.secretMove == 0 && otherPlayer.secretMove == 0) {
            gHub.gameResult(this, players[0].account, players[1].account, GameHub.GameResult.Tied, cost);
        }
        else if(expired) {
            // if either player has not played a move and the other other has, the other wins
            if (players[0].secretMove > 0 && players[1].secretMove == 0 || players[0].revealedMove != Move.None && players[1].revealedMove == Move.None) {
                gHub.gameResult(this, players[0].account, players[1].account, GameHub.GameResult.PlayerOneWin, cost);    
            } else {
                gHub.gameResult(this, players[0].account, players[1].account, GameHub.GameResult.PlayerTwoWin, cost);    
            }
        } else {    
            // revert if other conditions not met
            revert();    
        }

        LogRequestEndGame(this, msg.sender);
    }
}