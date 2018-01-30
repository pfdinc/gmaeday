var socketServer = require('../app.js').socket
var mongoose = require('mongoose')
var Schema = mongoose.Schema
require('../models/game.js')
var ioexports = {}

// Sets up game model
var GameModel = mongoose.model('Game')

socketServer.sockets.on('connection', function (socket) { // On connection to the web socket
    console.log('New connection: ' + socket.id) // Debug purposes.

    // Gets called when a user requests a new game
    socket.on('newGame', function (data) {
        // Make sure the socket is not connected to a different game already
        GameModel.findOne({'players.socketID': socket.id}, function (err, gameObject) {
            if (err) {
                console.log(err)
            } else {
                // If game exists
                if (gameObject == null) {
                } else {
                    // Determines the player number
                    for (var i = 0; i < 2; i++) {
                        if (gameObject.players[i].socketID == socket.id) {
                            var playerNum = gameObject.players[i].playerNum;
                        }
                    }
                    // Determine playerID
                    var playerID = gameObject.players[playerNum-1]._id
                    // Update the game so they are not connected
                    GameModel.update({'players._id': playerID}, {
                        '$set': {
                            'players.$.socketID': null
                        }
                    }, function (err) {
                        if (err) {
                            console.log(err)
                        } else {
                            console.log(socket.id + " Disconnect from game " + gameObject._id)
                        }
                    })

                }
            }
        })
        // GAME CREATION
        // Call for a shuffled deck
        var gameDeck = createDeck()
        var gameBoard = emptyBoardObject()
        var playerOneHand = []
        var playerTwoHand = []
        // Fills player hand with 4 cards each from the returned deck
        for (var i = 0; i < 4; i++) {
            playerOneHand.push(gameDeck.pop())
            playerTwoHand.push(gameDeck.pop())
        }
        // Stages a new game for the database
        var newGame = new GameModel({
            deck: gameDeck,
            board: gameBoard,
            players: [
                {playerNum: 1, hand: playerOneHand},
                {playerNum: 2, hand: playerTwoHand}
            ]
        })
        // Writes to the database the new game
        newGame.save(function (err, gameObject) {
            if (err) {
                console.log('Creating game: Problem: ' + err)
            } else {
                // Emits to the player their playerID and the second players ID
                socket.emit('receiveGame', {
                    playerOneID: gameObject.players[0]._id,
                    playerTwoID: gameObject.players[1]._id
                })
            }
        })
    })

    // Gets called when a user requests to join a game
    socket.on('joinGame', function (data) {
        // Finds game based on playerID
        GameModel.findOne({'players._id': data.playerID}, function (err, gameObject) {
            if (err) {
                console.log(err)
            } else {
                if (gameObject == null) {
                    //console.log("Socket not connected to a game")
                    socket.emit('errorMSG', {MSG: "Im sorry, but this game does not exist"})
                    return
                }
                // Checks to make sure the game is not over
                if (gameObject.won) {
                    // If the game is over, it will tell the user
                    socket.emit('errorMSG', {MSG: "Game is already over"})
                } else {
                    // Determines the player number based on playerID
                    for (var i = 0; i < 2; i++) {
                        if (gameObject.players[i]._id == data.playerID) {
                            var playerNum = gameObject.players[i].playerNum;
                        }
                    }
                    //console.log(playerNum)
                    // If there is no one connected as that player
                    if (gameObject.players[playerNum-1].socketID == null) {
                        // Connect the current socket to this game
                        GameModel.update({'players._id': data.playerID}, {
                            '$set': {
                                'players.$.socketID': socket.id
                            }
                        }, function (err) {
                            if (err) {
                                console.log(err)
                            } else {
                                // Connect the player to the game Session
                                socket.join(gameObject._id)
                                // Emit to the player that they have correctly connected to the game
                                socket.broadcast.to(gameObject._id).emit('MSG', {MSG: "Your opponent has connected to the game"})
                                //console.log(socket.id + " joined game: " + gameObject._id)
                                // Emit to the player their hand and player number
                                socket.emit('receiveHand', {hand: gameObject.players[playerNum-1].hand})
                                socket.emit('receivePlayerNumber', {playerNum: playerNum})
                                // Emit to player the current plays in the game
                                for (var i = 0; i < gameObject.plays.length; i++){
                                socket.emit('receivePlay', gameObject.plays[i]);
                                }
                            }
                        })
                    } else {
                        // Emit to the player that another person is connected as that player in that game.
                        socket.emit('errorMSG', {MSG: "Player already filled"})
                    }
                }
            }
        })
    })

    // Gets called when socket disconnects from the server
    socket.on('disconnect', function () {
        // Finds game based on users socket id
        GameModel.findOne({'players.socketID': socket.id}, function (err, gameObject) {
            if (err) {
                console.log(err)
            } else {
                // If game exists
                if (gameObject == null) {
                } else {
                    // Determines the player number
                    for (var i = 0; i < 2; i++) {
                        if (gameObject.players[i].socketID == socket.id) {
                            var playerNum = gameObject.players[i].playerNum;
                        }
                    }
                    // Gets player ID from gameObject
                    var playerID = gameObject.players[playerNum-1]._id
                    // Alert the room that the user has disconnected
                    socketServer.in(gameObject._id).emit('errorMSG', {MSG: "Your opponent has disconnected from the game"})
                    // Emit to the player that they disconnected
                    socket.emit('MSG', {MSG: "You have disconnected from the game"})
                    // Removes socket from room
                    socket.leave(gameObject._id)
                    // Setting socketID in database to null for current player AKA player has disconnected from game
                    GameModel.update({'players._id': playerID}, {
                        '$set': {
                            'players.$.socketID': null
                        }
                    }, function (err) {
                        if (err) {
                            console.log(err)
                        } else {
                            console.log(socket.id + " Disconnect from game " + gameObject._id)
                        }
                    })

                }
            }
        })
    })

    // Gets called when a user requests to makes a play
    socket.on('makePlay', function (data) {
        // Finds game based on users socket id
        GameModel.findOne({'players.socketID': socket.id}, function (err, gameObject) {
            if (err) {
                console.log(err)
            } else {
                // If game exists
                if (gameObject == null) {
                    socket.emit('errorMSG', {MSG: "Im sorry, but this game does not exist"})
                } else {
                    // Check if the game is already over.
                    if (gameObject.won == true){
                        // If the game is over tell the user
                        socket.emit('errorMSG', {MSG: "The game is already over"})
                        // End the function here
                        return
                    }
                    // Determines the player number
                    for (var i = 0; i < 2; i++) {
                        if (gameObject.players[i].socketID == socket.id) {
                            var playerNum = gameObject.players[i].playerNum;
                        }
                    }
                    // Gets all plays from game object
                    var plays = gameObject.plays
                    // Gets players hand
                    var playerHand = gameObject.players[playerNum - 1].hand
                    // Get playerID
                    var playerID = gameObject.players[playerNum - 1]._id
                    // Check that if it is not this players turn
                    if (gameObject.turnNumber%2 +1 !== playerNum){
                        // Tell the player it is not their turn
                        socket.emit('errorMSG', {MSG: "It is currently not your turn"})
                        // End the function here
                        return
                    }
                    // Check to make sure the location number is within the range of the board
                    if (data.locationNum < 0 || data.locationNum > 99){
                        // If they are trying to play in location that does not exists tell them
                        socket.emit('errorMSG', {MSG: "Cannot play in that location, it does not exist"})
                        // End function
                        return
                    }
                    // Check to make sure the card number is less than location number
                    if (data.locationNum < data.cardUsed){
                        // If the card is greater than the location tell user
                        socket.emit('errorMSG', {MSG: "Cannot play in that location with that card"})
                        // End the function here
                        return
                    }
                    // Check to see if player has the card they are requesting to play
                    if (checkForCarInHand(playerHand, data.cardUsed) == false){
                        // If they don't have the card they are using, tell user
                        socket.emit('errorMSG', {MSG: "You do not have that card to play"})
                        // End the function here
                        return
                    }
                    // Check if the location is filled
                    for (var i = 0; i < gameObject.plays.length; i++){
                        if (gameObject.plays[i].locationNum == data.locationNum){
                            // Tell user that the location is filled
                            socket.emit('errorMSG', {MSG: "That location is already filled"})
                            // End the function here
                            return
                        }
                    }
                    // Update local hand by removing played card
                    var cardIndex = playerHand.indexOf(data.cardUsed)
                    playerHand.splice(cardIndex,1)
                    // Get current board from game object and add play
                    var board = gameObject.board
                    board[data.locationNum] = playerNum;
                    // Update hand in database to new player hand
                    GameModel.update({'players._id': playerID}, {
                        '$set': {
                            'players.$.hand': playerHand
                        }
                    }, function (err) {
                        if (err) {
                            console.log(err)
                            return
                        }
                    })
                    // Create play object for inserting into DB
                    var playObject = {playerNum: playerNum,
                        turnNum: gameObject.turnNumber,
                        draw: false,
                        cardNum: data.cardUsed,
                        locationNum: data.locationNum}
                    // Add play to database
                    GameModel.update({'players._id': playerID}, {
                        '$push': {
                            'plays': playObject
                        }
                    }, function (err) {
                        if (err) {
                            console.log(err)
                            return
                        }
                    })
                    // Increment the turn number
                    GameModel.update({'players._id': playerID}, {
                        '$inc': {
                            'turnNumber':1
                        }
                    }, function (err) {
                        if (err) {
                            console.log(err)
                            return
                        }
                    })
                    // Update the board object to contain the players new play
                    GameModel.update({'players._id': playerID}, {
                        '$set': {
                            'board': board
                        }
                    }, function (err) {
                        if (err) {
                            console.log(err)
                            return
                        }
                    })
                    // Change highest playable if current highest playable was just played
                    if (data.locationNum == gameObject.highestPlayable){
                        var newHighestPlayable = determineHighestPlayable(gameObject.highestPlayable, board);
                        GameModel.update({'players._id': playerID}, {
                            '$set': {
                                'highestPlayable': newHighestPlayable
                            }
                        }, function (err) {
                            if (err) {
                                console.log(err)
                                return
                            }
                        })
                    }
                    // Send player hand to player
                    socket.emit('receiveHand', {hand: playerHand})
                    // Send Play to everyone in the room
                    socketServer.in(gameObject._id).emit('receivePlay', playObject);
                    // Send msg to players to tell them the play
                    socket.broadcast.to(gameObject._id).emit('MSG', {MSG: "Your opponent has played the " + data.cardUsed + " in the " + data.locationNum})
                    // Emit to the player their move
                    socket.emit('MSG', {MSG: "You have played the: " + data.cardUsed + " in the: " + data.locationNum})
                    // If win condition is true, set won flag to true in DB and emit to the room the winner
                    if (checkWinCondition(gameObject, playObject)){
                        socket.broadcast.to(gameObject._id).emit('receiveWin', {'MSG':"Your opponent has won by playing the " + data.cardUsed + " in the " + data.locationNum + "!!"})
                        socket.emit('receiveWin', {'MSG':"Congratulations! You have won by playing the " + data.cardUsed + " in the " + data.locationNum + "!!"})
                        GameModel.update({'players._id': playerID}, {
                            '$set': {
                                'won': true
                            }
                        }, function (err) {
                            if (err) {
                                console.log(err)
                                return
                            }
                        })
                    }
                }
            }
        })
    })

    // Gets called when a user requests to draw
    socket.on("makeDraw", function () {
        // Finds game based on users socket id
        GameModel.findOne({'players.socketID': socket.id}, function (err, gameObject) {
            // Determine the player number: Remember to subtract 1 if using as index
            if (err) {
                console.log(err)
                return
            } else {
                // If game exists
                if (gameObject == null) {
                    socket.emit('errorMSG', {MSG: "Im sorry, but this game does not exist"})
                } else {
                    // Check if the game is already over.
                    if (gameObject.won == true){
                        // If the game is over tell the user
                        socket.emit('errorMSG', {MSG: "The game is already over"})
                        // End the function here
                        return
                    }
                    // Determines the player number
                    for (var i = 0; i < 2; i++) {
                        if (gameObject.players[i].socketID == socket.id) {
                            var playerNum = gameObject.players[i].playerNum
                        }
                    }
                    // Get local version of players hand from gameObject
                    var playerHand = gameObject.players[playerNum - 1].hand
                    // Get player id
                    var playerID = gameObject.players[playerNum - 1]._id
                    // Get local version of deck from gameObject
                    var deck = gameObject.deck
                    // Check if it is the current players turn
                    if (gameObject.turnNumber % 2 + 1 !== playerNum) {
                        // Tell the player it is not their turn
                        socket.emit('errorMSG', {MSG: "It is currently not your turn"})
                        // End the function here
                        return
                    }
                    // Check if the current player has less than 4 cards
                    if (playerHand.length >= 4) {
                        socket.emit('errorMSG', {MSG: "You cannot Draw, you already have 4 cards"})
                        return
                    }
                    // Get the top of the deck
                    var topDeck = deck.pop()
                    // Add card to local hand
                    playerHand.push(topDeck)
                    // Update hand in database to new hand
                    GameModel.update({'players._id': playerID}, {
                        '$set': {
                            'players.$.hand': playerHand
                        }
                    }, function (err) {
                        if (err) {
                            console.log(err)
                            return
                        }
                    })
                    // Update entire deck in DB to what the local version is
                    GameModel.update({'players._id': playerID}, {
                        '$set': {
                            'deck': deck
                        }
                    }, function (err) {
                        if (err) {
                            console.log(err)
                            return
                        }
                    })
                    // Create play object for inserting into DB: draw:true, cardNum:-1, locationNum:-1
                    var playObject = {
                        playerNum: playerNum,
                        turnNum: gameObject.turnNumber,
                        draw: true,
                        cardNum: -1,
                        locationNum: -1
                    }
                    // Increment the turn number
                    GameModel.update({'players._id': playerID}, {
                        '$inc': {
                            'turnNumber': 1
                        }
                    }, function (err) {
                        if(err) {console.log(err)
                            return
                        }
                    })
                    // Send Play to everyone in the roomto database
                    GameModel.update({'players._id': playerID}, {
                        '$push': {
                            'plays': playObject
                        }
                    }, function (err) {
                        if(err) {console.log(err)
                            return
                        }
                    })
                    // Emit to the game room the new play
                    socketServer.in(gameObject._id).emit('receivePlay', playObject)
                    // Emit to the room that the player drew
                    socket.broadcast.to(gameObject._id).emit('MSG', {MSG: "Your opponent has drawn a card"})
                    // Emit to the player their new hand
                    socket.emit('receiveHand', {hand: playerHand})
                    // Emit to the player their move
                    socket.emit('MSG', {MSG: "You have drawn a card"})
                    // Check to make sure the players had is not full of dead cards
                    if (playerHand.length == 4){
                        for (var i = 0; i < 4; i++){
                            // if at least one of their cards is playable, do nothing
                            if (playerHand[i] < gameObject.highestPlayable){
                                return
                            }
                        }
                        // If all their cards are higher than highestPlayable, then end the game
                        socket.emit('receiveWin', {'MSG':"Your opponent has won because your hand contains four dead cards and you cannot play anymore"})
                        socket.broadcast.to(gameObject._id).emit('receiveWin', {'MSG':"Congratulations! You have won because your opponents hand contains four dead cards and therefore cannot play anymore"})
                        GameModel.update({'players._id': playerID}, {
                            '$set': {
                                'won': true
                            }
                        }, function (err) {
                            if (err) {
                                console.log(err)
                                return
                            }
                        })
                    }
                }
            }
        })
    })
    
    
})

// Returns an array after shuffling it
function shuffle(array) {
  var currentIndex = array.length, temporaryValue, randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}

// Returns an array with numbers 0-99
function createDeck(){
  var cards = [];
  for (var i = 0; i < 100; i ++){
    cards.push(i);
  }
  cards = shuffle(cards);
  return cards;
}
// Returns true if the hand array contains the card
function checkForCarInHand(hand, card) {
    for(var i = 0; i < hand.length; i ++){
        if (hand[i] == card){
            return true;
        }
    }
    return false;
}

// Checks for win condition in given gameObject
function checkWinCondition(gameObject, playObject) {
    var board =  gameObject.board
    var playerNum = playObject.playerNum
    var locationNum = playObject.locationNum
    // Call the recursive search for each direction from current location
    var NW_SE = recursiveBoardSearch(locationNum, playerNum, 0, board) + recursiveBoardSearch(locationNum, playerNum, 4, board);
    var N_S = recursiveBoardSearch(locationNum, playerNum, 1, board) + recursiveBoardSearch(locationNum, playerNum, 5, board);
    var NE_SW = recursiveBoardSearch(locationNum, playerNum, 2, board) + recursiveBoardSearch(locationNum, playerNum, 6, board);
    var W_E = recursiveBoardSearch(locationNum, playerNum, 3, board) + recursiveBoardSearch(locationNum, playerNum, 7, board);
    //console.log(NW_SE +" "+ N_S +" "+ NE_SW +" "+ W_E)
    // If any of the recursive functions returns at least 6 the return true, the game is over.
    if (NW_SE >= 6 || N_S >= 6 || NE_SW >= 6 || W_E >= 6){
        return true
    }
    // Otherwise return false and the game continues
    return false
}

// Recursive location checking for win condition
function recursiveBoardSearch(locationNumber, playerNum, direction, board){
    // If the location being checked was played by the current player
    if (board[locationNumber] == playerNum){
        // Get the next location in this direction
        var nextLocation = locationData[locationNumber].adjacentLocations[direction]
        // If the next direction is null then return 1
        if (nextLocation == null){
            return 1
        }
        // Call the function again with the new direction
        return (1 + recursiveBoardSearch(nextLocation, playerNum, direction, board))
    }
    // If this location is not filled by current player return 0
    return 0
}

function determineHighestPlayable(currentHighestPlayable, board) {
    for (var i = currentHighestPlayable; i > 0; i--){
        if (board[i] == 0){
            return i;
        }
    }
    return 0;
}

// Returns an empty board array
function emptyBoardObject(){
    var board = []
    for (var i = 0; i < 100; i++){
        board[i] = 0
    }
    return board
}

module.exports = ioexports

var locationData = [
    {"boardValue":0,"adjacentLocations":[null,null,null,null,null,99,64,65]},
    {"boardValue":1,"adjacentLocations":[13,14,15,4,3,2,11,12]},
    {"boardValue":2,"adjacentLocations":[12,1,4,3,8,9,10,11]},
    {"boardValue":3,"adjacentLocations":[1,4,5,6,7,8,9,2]},
    {"boardValue":4,"adjacentLocations":[14,15,16,5,6,3,2,1]},
    {"boardValue":5,"adjacentLocations":[15,16,35,34,33,6,3,4]},
    {"boardValue":6,"adjacentLocations":[4,5,34,33,32,7,8,3]},
    {"boardValue":7,"adjacentLocations":[3,6,33,32,31,30,29,8]},
    {"boardValue":8,"adjacentLocations":[2,3,6,7,30,29,28,9]},
    {"boardValue":9,"adjacentLocations":[11,2,3,8,29,28,27,10]},
    {"boardValue":10,"adjacentLocations":[24,11,2,9,28,27,26,25]},
    {"boardValue":11,"adjacentLocations":[23,12,1,2,9,10,25,24]},
    {"boardValue":12,"adjacentLocations":[22,13,14,1,2,11,24,23]},
    {"boardValue":13,"adjacentLocations":[21,20,19,14,1,12,23,22]},
    {"boardValue":14,"adjacentLocations":[20,19,18,15,4,1,12,13]},
    {"boardValue":15,"adjacentLocations":[19,18,17,16,5,4,1,14]},
    {"boardValue":16,"adjacentLocations":[18,17,36,35,34,5,4,15]},
    {"boardValue":17,"adjacentLocations":[61,62,63,36,35,16,15,18]},
    {"boardValue":18,"adjacentLocations":[60,61,62,17,16,15,14,19]},
    {"boardValue":19,"adjacentLocations":[59,60,61,18,15,14,13,20]},
    {"boardValue":20,"adjacentLocations":[58,59,60,19,14,13,22,21]},
    {"boardValue":21,"adjacentLocations":[57,58,59,20,13,22,55,56]},
    {"boardValue":22,"adjacentLocations":[56,21,20,13,12,23,54,55]},
    {"boardValue":23,"adjacentLocations":[55,22,13,12,11,24,53,54]},
    {"boardValue":24,"adjacentLocations":[54,23,12,11,10,25,52,53]},
    {"boardValue":25,"adjacentLocations":[53,24,11,10,27,26,51,52]},
    {"boardValue":26,"adjacentLocations":[52,25,10,27,48,49,50,51]},
    {"boardValue":27,"adjacentLocations":[25,10,9,28,47,48,49,26]},
    {"boardValue":28,"adjacentLocations":[10,9,8,29,46,47,48,27]},
    {"boardValue":29,"adjacentLocations":[9,8,7,30,45,46,47,28]},
    {"boardValue":30,"adjacentLocations":[8,7,32,31,44,45,46,29]},
    {"boardValue":31,"adjacentLocations":[7,32,41,42,43,44,45,30]},
    {"boardValue":32,"adjacentLocations":[6,33,40,41,42,31,30,7]},
    {"boardValue":33,"adjacentLocations":[5,34,39,40,41,32,7,6]},
    {"boardValue":34,"adjacentLocations":[16,35,38,39,40,33,6,5]},
    {"boardValue":35,"adjacentLocations":[17,36,37,38,39,34,5,16]},
    {"boardValue":36,"adjacentLocations":[62,63,64,37,38,35,16,17]},
    {"boardValue":37,"adjacentLocations":[63,64,99,98,97,38,35,36]},
    {"boardValue":38,"adjacentLocations":[36,37,98,97,96,39,34,35]},
    {"boardValue":39,"adjacentLocations":[35,38,97,96,95,40,33,34]},
    {"boardValue":40,"adjacentLocations":[34,39,96,95,94,41,32,33]},
    {"boardValue":41,"adjacentLocations":[33,40,95,94,93,42,31,32]},
    {"boardValue":42,"adjacentLocations":[32,41,94,93,92,43,44,31]},
    {"boardValue":43,"adjacentLocations":[31,42,93,92,91,90,89,44]},
    {"boardValue":44,"adjacentLocations":[30,31,42,43,90,89,88,45]},
    {"boardValue":45,"adjacentLocations":[29,30,31,44,89,88,87,46]},
    {"boardValue":46,"adjacentLocations":[28,29,30,45,88,87,86,47]},
    {"boardValue":47,"adjacentLocations":[27,28,29,46,87,86,85,48]},
    {"boardValue":48,"adjacentLocations":[26,27,28,47,86,85,84,49]},
    {"boardValue":49,"adjacentLocations":[51,26,27,48,85,84,83,50]},
    {"boardValue":50,"adjacentLocations":[80,51,26,49,84,83,82,81]},
    {"boardValue":51,"adjacentLocations":[79,52,25,26,49,50,81,80]},
    {"boardValue":52,"adjacentLocations":[78,53,24,25,26,51,80,79]},
    {"boardValue":53,"adjacentLocations":[77,54,23,24,25,52,79,78]},
    {"boardValue":54,"adjacentLocations":[76,55,22,23,24,53,78,77]},
    {"boardValue":55,"adjacentLocations":[75,56,21,22,23,54,77,76]},
    {"boardValue":56,"adjacentLocations":[74,57,58,21,22,55,76,75]},
    {"boardValue":57,"adjacentLocations":[73,72,71,58,21,56,75,74]},
    {"boardValue":58,"adjacentLocations":[72,71,70,59,20,21,56,57]},
    {"boardValue":59,"adjacentLocations":[71,70,69,60,19,20,21,58]},
    {"boardValue":60,"adjacentLocations":[70,69,68,61,18,19,20,59]},
    {"boardValue":61,"adjacentLocations":[69,68,67,62,17,18,19,60]},
    {"boardValue":62,"adjacentLocations":[68,67,66,63,36,17,18,61]},
    {"boardValue":63,"adjacentLocations":[67,66,65,64,37,36,17,62]},
    {"boardValue":64,"adjacentLocations":[66,65,0,99,98,37,36,63]},
    {"boardValue":65,"adjacentLocations":[null,null,null,0,99,64,63,66]},
    {"boardValue":66,"adjacentLocations":[null,null,null,65,64,63,62,67]},
    {"boardValue":67,"adjacentLocations":[null,null,null,66,63,62,61,68]},
    {"boardValue":68,"adjacentLocations":[null,null,null,67,62,61,60,69]},
    {"boardValue":69,"adjacentLocations":[null,null,null,68,61,60,59,70]},
    {"boardValue":70,"adjacentLocations":[null,null,null,69,60,59,58,71]},
    {"boardValue":71,"adjacentLocations":[null,null,null,70,59,58,57,72]},
    {"boardValue":72,"adjacentLocations":[null,null,null,71,58,57,74,73]},
    {"boardValue":73,"adjacentLocations":[null,null,null,72,57,74,null,null]},
    {"boardValue":74,"adjacentLocations":[null,73,72,57,56,75,null,null]},
    {"boardValue":75,"adjacentLocations":[null,74,57,56,55,76,null,null]},
    {"boardValue":76,"adjacentLocations":[null,75,56,55,54,77,null,null]},
    {"boardValue":77,"adjacentLocations":[null,76,55,54,53,78,null,null]},
    {"boardValue":78,"adjacentLocations":[null,77,54,53,52,79,null,null]},
    {"boardValue":79,"adjacentLocations":[null,78,53,52,51,80,null,null]},
    {"boardValue":80,"adjacentLocations":[null,79,52,51,50,81,null,null]},
    {"boardValue":81,"adjacentLocations":[null,80,51,50,83,82,null,null]},
    {"boardValue":82,"adjacentLocations":[null,81,50,83,null,null,null,null]},
    {"boardValue":83,"adjacentLocations":[81,50,49,84,null,null,null,82]},
    {"boardValue":84,"adjacentLocations":[50,49,48,85,null,null,null,83]},
    {"boardValue":85,"adjacentLocations":[49,48,47,86,null,null,null,84]},
    {"boardValue":86,"adjacentLocations":[48,47,46,87,null,null,null,85]},
    {"boardValue":87,"adjacentLocations":[47,46,45,88,null,null,null,86]},
    {"boardValue":88,"adjacentLocations":[46,45,44,89,null,null,null,87]},
    {"boardValue":89,"adjacentLocations":[45,44,43,90,null,null,null,88]},
    {"boardValue":90,"adjacentLocations":[44,43,92,91,null,null,null,89]},
    {"boardValue":91,"adjacentLocations":[43,92,null,null,null,null,null,90]},
    {"boardValue":92,"adjacentLocations":[42,93,null,null,null,91,90,43]},
    {"boardValue":93,"adjacentLocations":[41,94,null,null,null,92,43,42]},
    {"boardValue":94,"adjacentLocations":[40,95,null,null,null,93,42,41]},
    {"boardValue":95,"adjacentLocations":[39,96,null,null,null,94,41,40]},
    {"boardValue":96,"adjacentLocations":[38,97,null,null,null,95,40,39]},
    {"boardValue":97,"adjacentLocations":[37,98,null,null,null,96,39,38]},
    {"boardValue":98,"adjacentLocations":[64,99,null,null,null,97,38,37]},
    {"boardValue":99,"adjacentLocations":[65,0,null,null,null,98,37,64]}
];