const { getUserByEmail } = require('../db/users');
getUserByEmail('test@gmail.com')
  .then(u => console.log(u ? 'found: ' + u.email : 'not found'))
  .catch(e => console.log('Error: ' + e.message));
