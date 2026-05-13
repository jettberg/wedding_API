const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true },
  role:  { type: String, enum: ['owner', 'editor', 'viewer'], required: true },
});

const linkSchema = new mongoose.Schema({
  label: { type: String, default: '' },
  url:   { type: String, required: true },
}, { _id: false });

const eventSchema = new mongoose.Schema({
  clientId:  { type: String, default: '' },   // optional — frontend uses its own ids
  personId:  { type: String, required: true },
  label:     { type: String, default: 'Untitled' },
  startSlot: { type: Number, required: true },
  endSlot:   { type: Number, required: true },
  notes:     { type: String, default: '' },
  links:     { type: [linkSchema], default: [] },
  colorIdx:  { type: Number, default: 0 },
}, { _id: false });

const personSchema = new mongoose.Schema({
  clientId: { type: String, default: '' },   // optional — frontend uses its own ids
  name:     { type: String, default: 'Unnamed' },
  role:     { type: String, default: '' },
  colorIdx: { type: Number, default: 0 },
}, { _id: false });

const timelineSchema = new mongoose.Schema({
  weddingName:  { type: String, default: 'Wedding Timeline' },
  ownerEmail:   { type: String, required: true, lowercase: true, trim: true },
  permissions:  { type: [permissionSchema], default: [] },
  people:       { type: [personSchema],    default: [] },
  events:       { type: [eventSchema],     default: [] },
  lastUpdated:  { type: Date, default: Date.now },
}, { timestamps: true });

timelineSchema.pre('save', async function() {
  const hasOwner = this.permissions.some(
    p => p.email === this.ownerEmail && p.role === 'owner'
  );
  if (!hasOwner) {
    this.permissions.unshift({ email: this.ownerEmail, role: 'owner' });
  }
  this.lastUpdated = new Date();
});

const sessionSchema = new mongoose.Schema({
  email:     { type: String, required: true, lowercase: true, trim: true },
  token:     { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now, expires: '30d' },
});

const Timeline = mongoose.model('Timeline', timelineSchema);
const Session  = mongoose.model('Session',  sessionSchema);

module.exports = { Timeline, Session };