const {controller} = require('./botkit')
const wit = require('./wit')
const {activePairs, waitList} = require('./firebase')
const randomName = require('node-random-name')

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
          if (session.intents.asksForHelp) {
            return handleHelp(bot, session.user.id)
          }
          if (session.intents.saysHi) {
            return handleGreeting(bot, session.user.id)
          }
          if (session.intents.saysHowAreYou) {
            return handleHowAreYou(bot, session.user.id)
          }
          return sendText(bot, message.user, "Dostum dediğini anlamıyorum. Yardıma ihtiyacın varsa 'BOT: yardım' yaz.")
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
      asksForHelp: false,
      lookingForChat: false,
      saysHi: false,
      saysHowAreYou: false,
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
        } else if (intent.value === 'greeting') {
          response.intents.saysHi = true
        } else if (intent.value === 'how_are_you') {
          response.intents.saysHowAreYou = true
        } else if (intent.value === 'help') {
          response.intents.asksForHelp = true
        }
      }
      return response
    })
}

function handleHelp(bot, user) {
  const msg1 = 'Merhaba! Benim adım Ortam Çocuğu. Ben bir botum.'
  const msg2 = 'Muhabbet edecek birini arayanlar bana gelirler ve takma isimler altında sohbet ederler.'
  const msg3 = `Mesela senin adın bundan sonra ${generateANameForUser(user)}.`
  const msg4 = "Bana 'Muhabbet edecek birini arıyorum' diye yazdığın zaman, seni başka birine bağlayacağım."
  const msg5 = 'Bana yazdığın her şeyi ona ileteceğim. İstediğiniz kadar sohbet edebilirsiniz!'
  const msg6 = "Başka biriyle yazışırken ban 'BOT: ' diye seslenebilirsin."
  const msg7 = "Örneğin, sohbetini sonlandırmak istersen 'BOT: Muhabbeti bitir' diyebilirsin."
  const msg8 = "Yardıma ihtiyacın olduğunda 'BOT: yardım' yazabilirsin."
  const msg9 = 'Umuyorum ilginç, eğlenceli ve sohbeti koyu insanlar ile karşılaşırsın.'
  const msg10 = 'Lütfen dikkatli ol! Kişisel bilgilerini, şifeni asla paylaşma! Ne benimle, ne diğerleriyle!'
  const msg11 = 'Kib bye!'

  return sendText(bot, user, msg1)
    .then(typing.bind(null, bot, user))
    .then(waitABit)

    .then(sendText.bind(null, bot, user, msg2))
    .then(typing.bind(null, bot, user))
    .then(waitABit)

    .then(sendText.bind(null, bot, user, msg3))
    .then(typing.bind(null, bot, user))
    .then(waitABit)

    .then(sendText.bind(null, bot, user, msg4))
    .then(typing.bind(null, bot, user))
    .then(waitABit)

    .then(sendText.bind(null, bot, user, msg5))
    .then(typing.bind(null, bot, user))
    .then(waitABit)

    .then(sendText.bind(null, bot, user, msg6))
    .then(typing.bind(null, bot, user))
    .then(waitABit)

    .then(sendText.bind(null, bot, user, msg7))
    .then(typing.bind(null, bot, user))
    .then(waitABit)

    .then(sendText.bind(null, bot, user, msg8))
    .then(typing.bind(null, bot, user))
    .then(waitABit)

    .then(sendText.bind(null, bot, user, msg9))
    .then(typing.bind(null, bot, user))
    .then(waitABit)

    .then(sendText.bind(null, bot, user, msg10))
    .then(typing.bind(null, bot, user))
    .then(waitABit)

    .then(sendText.bind(null, bot, user, msg11))
}

function waitABit(n) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve()
    }, n || 1000)
  })
}

function handleGreeting(bot, user) {
  return sendText(bot, user, "Merhaba! Benim adım Ortam Çocuğu. Ben bir botum. Eğer yardıma ihtiyacın varsa 'yardım' yazman yeterli.")
}

function handleHowAreYou(bot, user) {
  return sendText(bot, user, "İyiyim, idare ediyorum bir şekilde. Çok naziksin. :-)")
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
    .then(() => sendText(bot, session.chattingWith, `${generateANameForUser(session.user.id)} seninle muhabbet etmeyi bıraktı. :(`))
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
          sendText(bot, message.user, `Şu an ${generateANameForUser(candidate)} ile muhabbet ediyorsun.`),
          sendText(bot, candidate,
            `Demiştim ben sana birini bulurum diye! Şu an \
${generateANameForUser(message.user)} ile muhabbet ediyorsun.`)
        ]))
    })
}

function generateANameForUser(userId) {
  let randomNo = userId
  while (randomNo > 1) { randomNo /= 10 }
  return randomName({random: () => randomNo})
}
