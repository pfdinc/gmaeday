var mongoose = require('mongoose')
var shortid = require('shortid')
var Schema = mongoose.Schema

var gameSchema = new Schema ({
  _id: { type: String, require: true, default: shortid.generate},
  players: [{
      _id: { type: String, require: true, default: shortid.generate},
      playerNum: {type: Number},
      hand: [{type: Number, min: 0, max: 99}],
      socketID: {type: String}
  }],
  plays: [{
    playerNum: {type: Number},
    turnNum: {type: Number},
    draw: {type: Boolean},
    cardNum: {type: Number},
    locationNum: {type: Number}
  }],
  deck: [{type: Number}],
  board: [{type: Number}],
  highestPlayable: {type: Number, default: 99},
  turnNumber: {type: Number, default: 0},
  won: {type: Boolean, default: false}
})


mongoose.model('Game', gameSchema)
