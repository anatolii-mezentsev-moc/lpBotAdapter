const log = require('./logger')(__filename);



module.exports = {
  LOG_LEVEL: 'trace',
  LOG_ENABLED: true,

  LP_CSDS: 'adminlogin.liveperson.net',
 // LP_ACCOUNT: process.env.LP_ACCOUNT || log.fatal('LP_ACCOUNT should be defined as an env var!'),
 // LP_USER: process.env.LP_USER || log.fatal('LP_USER should be defined as an env var!'),
//  LP_PASS: process.env.LP_PASS,
//  LP_APP_KEY: process.env.LP_APP_KEY,
//  LP_SECRET: process.env.LP_SECRET,
//  LP_ACCESS_TOKEN: process.env.LP_ACCESS_TOKEN,
//  LP_ACCESS_TOKEN_SECRET: process.env.LP_ACCESS_TOKEN_SECRET,
//  LP_INITIAL_SKILL:
//    process.env.LP_INITIAL_SKILL || log.fatal('LP_INITIAL_SKILL should be defined as an env var!'),
//  LP_NEXT_SKILL:
//    process.env.LP_NEXT_SKILL || log.fatal('LP_NEXT_SKILL should be defined as an env var!'),
//  LP_TRANSFER_INPUT:
//    process.env.LP_TRANSFER_INPUT ||
 //   log.fatal('LP_TRANSFER_INPUT should be defined as an env var!'),
  LP_PING_INPUT:  'ping',
  LP_API_RESEND_RETRIES: parseInt(process.env.LP_API_RESEND_RETRIES, 10) || 5,
  LP_API_RESEND_DELAY: parseInt(process.env.LP_API_RESEND_DELAY, 10) || 2000,

  SOCKET_PING_INTERVAL: parseInt(process.env.SOCKET_PING_INTERVAL, 10) || 10000, // 10 seconds
  SOCKET_RECONNECT_MAX_INTERVAL: parseInt(process.env.SOCKET_RECONNECT_MAX_INTERVAL, 10) || 300000, // 5 minutes
  SOCKET_RECONNECT_STEP_INTERVAL: parseInt(process.env.SOCKET_RECONNECT_STEP_INTERVAL, 10) || 10000, // 10 seconds
  SOCKET_RECONNECT_INTERVAL_RESET_DELAY:
    parseInt(process.env.SOCKET_RECONNECT_INTERVAL_RESET_DELAY, 10) || 60000, // 1 minute

  MESSAGE_DELAY: parseInt(process.env.MESSAGE_DELAY, 10) || 1000, // 1 second
};
