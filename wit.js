const {wit: accessToken} = require('./config')

const {Wit} = require('node-wit')
const client = new Wit({accessToken})

module.exports = client
