const {controller} = require('./botkit')
const wit = require('./wit')
const {activePairs, waitList} = require('./firebase')

// this is triggered when a user clicks the send-to-messenger plugin
controller.on('facebook_optin', (bot, message) => {
  bot.reply(message, 'Welcome to my app!')
})

controller.on('message_received', (bot, message) => {
  const session = {
    chattingWith: null,
    isTalkingWithBot: null
  }

  activePairs
    .where(message.user, '==', true).get()
    .then((snapshot) => {
      if (snapshot.size > 0) {
        const pair = snapshot.docs[0].data()
        session.chattingWith = Object.keys(pair).filter((x) => x !== message.user)[0]
      }
    })
    .then(() => {
      session.isTalkingWithBot = !session.chattingWith
      if (message.text.startsWith('BOT:')) {
        session.isTalkingWithBot = true
        message.text = message.text.substr(4).trim()
      }
    })
    .then(() => {
      if (session.chattingWith && !session.isTalkingWithBot) {
        return sendMessage(bot, session.chattingWith, message.text)
      }
      return determineIntent(message.text)
        .then((nlpResult) => {
          session.intents = nlpResult.intents
        })
        .then(() => {
          if (!session.intents.lookingForChat) {
            return sendMessage(bot, message.user, 'Dostum dediğini anlamıyorum.')
          }
          return lookingForChat(bot, message)
        })
    })
    .catch(console.error)
})

function determineIntent(text) {
  const response = {intents: {lookingForChat: false}}

  return wit.message(text, {})
    .then((data) => {
      if (data.entities.intent) {
        const intent = data.entities.intent[0]
        if (intent.value === 'chat') {
          response.intents.lookingForChat = true
        }
      }
      return response
    })
}

function sendMessage(bot, to, messageText) {
  return new Promise((resolve, reject) => {
    bot.say({
      channel: to,
      text: messageText
    }, (err) => {
      if (err) {
        reject(err)
        return
      }
      resolve()
    })
  })
}

function lookingForChat(bot, message) {
  return waitList
    .get()
    .then((snapshot) => {
      if (snapshot.size === 0) {
        return sendMessage(bot, message.user,
          'Şu an muhabbet etmek için bekleyen kimse yok. Beklemeye alıyorum seni, birisi gelince haber vereceğim.')
          .then(() => {
            waitList.doc(message.user).set({waiting: true})
          })
      }
      const candidates = []
      snapshot.forEach((item) => {
        const id = item.id
        if (id !== message.user) {
          candidates.push(id)
        }
      })

      if (candidates.length === 0) {
        return sendMessage(bot, message.user,
          'Dostum zaten bekleme listsindesin ama adam yok ben napayım? Birisi gelince yazacağım ben sana...')
      }

      const candidate = candidates[0]
      // TODO TRANSACTION
      Promise.all([
        waitList.doc(candidate).delete(),
        waitList.doc(message.user).delete()
      ])
        .then(() => activePairs.add({
          [message.user]: true,
          [candidate]: true
        }))
        .then(() => Promise.all([
          sendMessage(bot, message.user, `Şu an ${candidate} ile muhabbet ediyorsun.`),
          sendMessage(bot, candidate,
            `Demiştim ben sana birini bulurum diye! Şu an ${message.user} ile muhabbet ediyorsun.`)
        ]))
    })
}
