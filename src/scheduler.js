const cron = require('node-cron');
const { handleIntent } = require('./router');

function initScheduler(broadcast) {
  // 07:00 Morning Planning
  cron.schedule('0 7 * * *', async () => {
    console.log('Running 07:00 Morning Routine...');
    const result = await handleIntent('It is 7 AM. Plan the sound for today based on my routines and weather.');
    broadcast({ type: 'DJ_ROUTINE', ...result });
  });

  // Hourly Check-ins
  cron.schedule('0 * * * *', async () => {
    console.log('Running Hourly Context Check...');
    const result = await handleIntent('Hourly update. Check the environment and adjust the vibe if needed.');
    broadcast({ type: 'DJ_ROUTINE', ...result });
  });

  console.log('Scheduler initialized.');
}

module.exports = { initScheduler };
