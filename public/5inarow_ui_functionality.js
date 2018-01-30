// Global Variables
// Array for the board
var positionOrder = [73, 72, 71, 70, 69, 68, 67, 66, 65, 0, 74, 57, 58, 59, 60, 61, 62, 63, 64, 99, 75, 56, 21, 20, 19, 18, 17, 36, 37, 98,
76, 55, 22, 13, 14, 15, 16, 35, 38, 97, 77, 54, 23, 12, 1, 4, 5, 34, 39, 96, 78, 53, 24, 11, 2, 3, 6, 33, 40, 95, 79, 52, 25, 10, 9, 8, 7, 32, 41, 94,
80, 51, 26, 27, 28, 29, 30, 31, 42, 93, 81, 50, 49, 48, 47, 46, 45, 44, 43, 92, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91]
// Current Player
var currentPlayer = "player1";
// Showing playable location index
var showingplayable = 101;


/*
 * Player Status Functions
 */

// Creates number of pills to show which player is currently active
// This was changed
function createPlayerTabs(ifYourTurn) {
 	var playerTabs = '';
	if (ifYourTurn){
		playerTabs += '<h3><span class="label label-primary">Your Turn</span></h3>';
	}else {
		playerTabs += '<h3><span class="label label-default">Opponents Turn</span></h3>';
	}
 	document.getElementById("playerTabs").innerHTML = playerTabs;
 }

function createPopoverIcon() {
  	var popoverHTML = '<a href="#" id="popoverTable" data-toggle="popover" data-trigger="hover" data-placement="bottom" ><i class="fa fa-table fa-2x"></i></a>';
  	document.getElementById("previousPlayTable").innerHTML = popoverHTML;
}
/*
 * Board functionality and creation
 */

// Fills the HTML table with the contents of the array to create the board
function drawBoard() {
	var tableHTML = '';
	var position = 0;

	for(var i = 0; i < 10; i++){
		tableHTML += '<tr>';
		for(var j = 0; j < 10; j++){
			currentPosition = positionOrder[position];
			tableHTML += '<td id="' + currentPosition + '" class="" onclick="sendLocationPlayed(this)">' + currentPosition + '</td>';
			position++;
		}
		tableHTML += '</tr>';
	}
	document.getElementById("board").innerHTML = tableHTML;
}

// Will fill a board location with the player that played it
function colorPlayed(location, playerNumber) {
  element = document.getElementById(location);
	$(element).addClass("filled");
	$(element).addClass("player" + playerNumber);
	$(element).removeClass("playable");
	resetBoard(false);
}

function sendLocationPlayed(element) {
  makePlay(element.id, showingplayable);
}

// Shows which locations can be played
function colorPlayable(location) {
	resetBoard(false);
	if (showingplayable == location) {
		showingplayable = 101;
		return;
	};
	for(var i = location; i < 100; i++){
		if (!$("#"+i+"").hasClass("filled")) {
			$("#"+i+"").addClass("playable");
		}
	}
	showingplayable = location;
}


// Resets board and removes all classes applied during gameplay
function resetBoard(full){
	if(full){
		document.getElementById('drawBody').innerHTML = '';
		for(var i = 0; i < 100; i++){
		$("#"+i+"").removeClass();
		}
	} else {
		for(var i = 0; i < 100; i++){
			if (!$("#"+i+"").hasClass("filled") && $("#"+i+"").hasClass("playable")) {
				$("#"+i+"").removeClass("playable");
			}
		}
	}
}

/*
 * Player's Hand Function
 */
 // Sets the hand for the current player
function fillPlayerHand(hand) {
 	var currentPlayerHand = '';
 	for(var i = 0; i < hand.length; i++){
 		currentPlayerHand += '<div id="playerHand" class="btn-group"' +
 		'role="group" aria-label="..." align="center">' +
 		'<button type="button" class="btn card btn-primary btn-xs" onclick="colorPlayable(' +
 		hand[i] + ')">' + hand[i] + '</button></div>' + '\n';
 	}
 	document.getElementById("bottomColumn").innerHTML = currentPlayerHand;
 }


// Set popover table
function createPopover(){
	$('#popoverTable').popover({
		  content: function() {
	          return $('#tableContainer').html();
	        },
			html: true,
			selector: '.fa'
	});
}
// Inserts into table the previous play
function addPreviousPlay(turnNumber,playerNumber,locationNumber,cardNumber) {

	var table = document.getElementById('drawBody');
	var row = table.insertRow(0);
	var cellTurnNumber = row.insertCell(0);
	var cellPlayerNumber = row.insertCell(1);
	var cellLocationNumber = row.insertCell(2);
	var cellCardNumber = row.insertCell(3);
	if (locationNumber == -1) {
		cellTurnNumber.innerHTML = (turnNumber+1);
		cellPlayerNumber.innerHTML = playerNumber;
		cellLocationNumber.innerHTML = "Draw";
		cellCardNumber.innerHTML = "Draw";
	} else {
		cellTurnNumber.innerHTML = (turnNumber+1);
		cellPlayerNumber.innerHTML = playerNumber;
		cellLocationNumber.innerHTML = cardNumber;
		cellCardNumber.innerHTML = locationNumber;
	}
	var numberOfCells = document.getElementById("drawBody").rows.length;
	if (numberOfCells >= 6){
		document.getElementById("drawBody").deleteRow(5);
	}
}

// Displays winner modal
function showWinner(winMessage) {
  $("#winBody").html("<h3 style='text-align: center'> " + winMessage + "</h3>");
  $("#winModal").modal();
}

// Displays rules modal
function showRules() {
	$("#rulesModal").modal();
}

function switchCSS(){
    var href;
    var currentStyle = document.getElementById('pageStyle').getAttribute('href');
    if (currentStyle == "5ive_board.css"){
        href = "5ive_board_dark.css"
    } else {
        href = "5ive_board.css"
    }
    document.getElementById('pageStyle').href = href;
}
