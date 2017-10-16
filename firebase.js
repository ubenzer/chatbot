const {Firestore} = require('@google-cloud/firestore')
const {firebaseCredentials, firebaseProjectId} = require('./config')

const firestore = new Firestore({
  credentials: JSON.parse(firebaseCredentials),
  projectId: firebaseProjectId
})

const waitList = firestore.collection('waitList')
const activePairs = firestore.collection('activePairs')

module.exports = {activePairs, firestore, waitList}

