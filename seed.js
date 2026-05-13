require('dotenv').config();
const mongoose = require('mongoose');
const { Timeline } = require('./models');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);

  const existing = await Timeline.findOne({ ownerEmail: 'brooke.steele.2026@gmail.com' });
  if (existing) {
    console.log('Timeline already exists! ID:', existing._id);
    process.exit(0);
  }

  const timeline = new Timeline({
    weddingName: 'The Bergs 09.19.2026',
    ownerEmail:  'brooke.steele.2026@gmail.com',
    permissions: [{ email: 'brooke.steele.2026@gmail.com', role: 'owner' }],
    people: [],
    events: [],
  });

  await timeline.save();
  console.log('✅ Timeline created! ID:', timeline._id);
  console.log('📋 Copy this ID — you need it for the frontend!');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });