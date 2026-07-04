const cron = require('node-cron');
const { handleIntent } = require('./router');

function initScheduler(broadcast) {
  cron.schedule('0 7 * * *', async () => {
    try {
      const result = await handleIntent('It is 7 AM. Plan the sound for today based on my routines and weather.');
      broadcast({ type: 'DJ_MESSAGE', ...result, timestamp: Date.now() });
    } catch (err) {
      console.error('Morning routine failed:', err.message);
    }
  });

  cron.schedule('0 * * * *', async () => {
    try {
      const result = await handleIntent('Hourly update. Check the environment and adjust the vibe if needed.');
      broadcast({ type: 'DJ_MESSAGE', ...result, timestamp: Date.now() });
    } catch (err) {
      console.error('Hourly check-in failed:', err.message);
    }
  });
}

module.exports = { initScheduler };
