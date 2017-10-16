const Botkit = require('botkit')
const {port, facebookAccess, facebookVerify, facebookSecret} = require('./config')

/* eslint-disable camelcase */
const controller = Botkit.facebookbot({
  access_token: facebookAccess,
  app_secret: facebookSecret,
  validate_requests: true,
  verify_token: facebookVerify
})
/* eslint-enable */
const bot = controller.spawn({})
controller.setupWebserver(port, (err, webserver) => {
  if (err) {
    throw err
  }
  controller.createWebhookEndpoints(webserver, bot, () => {
    console.log('This bot is online. \\o/')
  })
})

module.exports = {bot, controller}
