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
    isTalkingWithBot: null,
    pairId: null,
    user: {id: message.user}
  }

  activePairs
    .where(message.user, '==', true).get()
    .then((snapshot) => {
      if (snapshot.size > 0) {
        const pair = snapshot.docs[0].data()
        session.chattingWith = Object.keys(pair).filter((x) => x !== message.user)[0]
        session.pairId = snapshot.docs[0].id
      }
    })
    .then(() => {
      session.isTalkingWithBot = !session.chattingWith ||
       (message.text && (message.text.startsWith('BOT:') || message.text.startsWith('bot:')))
    })
    .then(() => {
      if (!session.isTalkingWithBot) {
        return relayMessage(bot, session.chattingWith, message)
      }
      // talking with bot
      if (message.text && (message.text.startsWith('BOT:') || message.text.startsWith('bot:'))) {
        message.text = message.text.substr(4).trim()
      }

      return seen(bot, session.user.id)
        .then(() => determineIntent(message.text))
        .then((nlpResult) => {
          session.intents = nlpResult.intents
        })
        .then(() => typing(bot, session.user.id))
        .then(() => {
          if (session.intents.wantToEndTheChat) {
            if (session.chattingWith) {
              return endChat(bot, session)
            }
            return sendText(bot, message.user, 'Şu an kimseyle muhabbet etmiyorsun.')
          }
          if (session.intents.lookingForChat) {
            if (session.chattingWith) {
              return sendText(bot, message.user, 'Dostum önce bu muhabbeti bitir.')
            }
            return lookingForChat(bot, message)
          }
          return sendText(bot, message.user, 'Dostum dediğini anlamıyorum.')
        })
        .catch((error) => {
          sendText(bot, message.user, 'Zzzt erenköy!')
          throw error
        })
    })
    .catch(console.error)
})

function determineIntent(text) {
  const response = {
    intents: {
      lookingForChat: false,
      wantToEndTheChat: false
    }
  }

  return wit.message(text, {})
    .then((data) => {
      if (data.entities.intent) {
        const intent = data.entities.intent[0]
        if (intent.value === 'chat') {
          response.intents.lookingForChat = true
        } else if (intent.value === 'chat_end') {
          response.intents.wantToEndTheChat = true
        }
      }
      return response
    })
}

function seen(bot, to) {
  return new Promise((resolve, reject) => {
    bot.say({
      channel: to,
      sender_action: 'mark_seen' // eslint-disable-line camelcase
    }, (err) => {
      if (err) {
        reject(err)
        return
      }
      resolve()
    })
  })
}

function typing(bot, to) {
  return new Promise((resolve, reject) => {
    bot.say({
      channel: to,
      sender_action: 'typing_on' // eslint-disable-line camelcase
    }, (err) => {
      if (err) {
        reject(err)
        return
      }
      resolve()
    })
  })
}

function relayMessage(bot, to, message) {
  const newMessage = {}
  if (message.text) {
    newMessage.text = message.text
  }
  if (message.attachments && message.attachments.length > 0) {
    const attachment = message.attachments[0]
    if (attachment.type === 'image' || attachment.type === 'audio' ||
      attachment.type === 'video' || attachment.type === 'file') {
      newMessage.attachment = {
        payload: {url: attachment.payload.url},
        type: attachment.type
      }
    } else {
      console.error(`Weird type: ${attachment.type}`)
    }
  }
  newMessage.channel = to

  return new Promise((resolve, reject) => {
    bot.say(newMessage, (err) => {
      if (err) {
        reject(err)
        return
      }
      resolve()
    })
  })
}

function sendText(bot, to, messageText) {
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

function endChat(bot, session) {
  activePairs.doc(session.pairId)
    .delete()
    .then(() => sendText(bot, session.chattingWith, `${session.user.id} seninle muhabbet etmeyi bıraktı. :(`))
    .then(() => sendText(bot, session.user.id, 'Artık kimseyle muhabbet etmiyorsun. Yine bana kaldın. :D'))
}

function lookingForChat(bot, message) {
  return waitList
    .get()
    .then((snapshot) => {
      if (snapshot.size === 0) {
        return sendText(bot, message.user,
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
        return sendText(bot, message.user,
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
          sendText(bot, message.user, `Şu an ${candidate} ile muhabbet ediyorsun.`),
          sendText(bot, candidate,
            `Demiştim ben sana birini bulurum diye! Şu an ${message.user} ile muhabbet ediyorsun.`)
        ]))
    })
}
