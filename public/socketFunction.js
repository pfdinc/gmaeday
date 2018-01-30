var socket = io()

// Local Variables
var playerNumber;
var turnNumber = 0;
var currentPlayersTurn;

// Join Game
function joinGame(cookieValue){
    socket.emit("joinGame", {playerID: cookieValue});
}

// Sending move to backend
function makePlay(locationNum, cardUsed){
  socket.emit("makePlay", {locationNum: locationNum, cardUsed: cardUsed});
}

// Sending draw to backend
function draw(){
    socket.emit("makeDraw", {});
}

// Emit new game
function newGame() {
  socket.emit("disconnect");
  socket.emit("newGame", {});
    resetBoard(true);
}
socket.on('connect', function(){
    checkCookie();
})

// Added
socket.on('receivePlayerNumber', function(data){
    playerNumber = data.playerNum;
    showCurrentPlayerTab()
})
// Error
socket.on('errorMSG',function(data){
    console.log(data);
    $.notify({
        // options
        message: data.MSG
    },{
        // settings
        type: 'danger'
    });
})

socket.on('MSG',function(data){
    console.log(data);
    $.notify({
        // options
        message: data.MSG
    },{
        // settings
        type: 'success'
    });
})
//receive Game
socket.on('receiveGame', function(data){
    var player1ID = data.playerOneID;
    var player2ID = data.playerTwoID;
    var player2URL = "connect5.online/#"+player2ID;
    setCookie('playerID',player1ID);
    joinGame(player1ID);
    document.getElementById("player2Link").setAttribute('value', player2URL);
})

// receive Play
socket.on('receivePlay', function(data){
    var location = data.locationNum;
    var cardUsed = data.cardNum;
    var turnNum = data.turnNum;
    turnNumber = turnNum + 1;
    addPreviousPlay(turnNum, data.playerNum, location, cardUsed);
    createPopover();
    colorPlayed(location, data.playerNum);
    showCurrentPlayerTab();
})
// receive Hand
socket.on('receiveHand', function(data){
  var hand = data.hand;
  fillPlayerHand(hand);
})
socket.on('receiveWin', function(data){
  showWinner(data.MSG);
})


// Setting cookies
function setCookie(cname,cvalue) {
    document.cookie = cname+"="+cvalue;
}
// Getting cookie
function getCookie(cname) {
    var name = cname + "=";
    var ca = document.cookie.split(';');
    for(var i=0; i<ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0)==' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}
// Checking cookies
function checkCookie() {
    var tester=getCookie("playerID");
    if(window.location.hash!=""){
        var cookie = window.location.hash;
        cookie = cookie.slice(1, cookie.length);
        setCookie('playerID',cookie);
        joinGame(cookie);
        return;
    }
    if (tester != "") {
        joinGame(tester);
    }
}
// Sets the player tabs to show when it's your turn
// This was added
function showCurrentPlayerTab() {
    if (turnNumber % 2 == 0){
        currentPlayersTurn = 1;
    } else {
        currentPlayersTurn = 2;
    }
    if (currentPlayersTurn == playerNumber){
        createPlayerTabs(true);
    } else {
        createPlayerTabs(false)
    }
}