const mongoose = require('mongoose');
 
// ─── Permission Schema ─────────────────────────────────────────────────────
// Stores who has access to a timeline and at what role
const permissionSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true },
  role:  { type: String, enum: ['owner', 'editor', 'viewer'], required: true },
});
 
// ─── Event Schema ──────────────────────────────────────────────────────────
const linkSchema = new mongoose.Schema({
  label: { type: String, default: '' },
  url:   { type: String, required: true },
}, { _id: false });
 
const eventSchema = new mongoose.Schema({
  clientId:  { type: String, required: true },   // the id used in the frontend (e.g. 'ev0')
  personId:  { type: String, required: true },   // matches Person.clientId
  label:     { type: String, default: 'Untitled' },
  startSlot: { type: Number, required: true },
  endSlot:   { type: Number, required: true },
  notes:     { type: String, default: '' },
  links:     { type: [linkSchema], default: [] },
  colorIdx:  { type: Number, default: 0 },
}, { _id: false });
 
// ─── Person Schema ─────────────────────────────────────────────────────────
const personSchema = new mongoose.Schema({
  clientId: { type: String, required: true },    // the id used in the frontend (e.g. 'p0')
  name:     { type: String, default: 'Unnamed' },
  role:     { type: String, default: '' },
  colorIdx: { type: Number, default: 0 },
}, { _id: false });
 
// ─── Timeline Schema ───────────────────────────────────────────────────────
// One document = one shared wedding timeline
const timelineSchema = new mongoose.Schema({
  weddingName:  { type: String, default: 'Wedding Timeline' },
  ownerEmail:   { type: String, required: true, lowercase: true, trim: true },
  permissions:  { type: [permissionSchema], default: [] },
  people:       { type: [personSchema],    default: [] },
  events:       { type: [eventSchema],     default: [] },
  lastUpdated:  { type: Date, default: Date.now },
}, { timestamps: true });
 
// Ensure the owner always appears in permissions
timelineSchema.pre('save', function(next) {
  const hasOwner = this.permissions.some(
    p => p.email === this.ownerEmail && p.role === 'owner'
  );
  if (!hasOwner) {
    this.permissions.unshift({ email: this.ownerEmail, role: 'owner' });
  }
  this.lastUpdated = new Date();
  next();
});
 
// ─── Session Schema ────────────────────────────────────────────────────────
// Lightweight email-based sessions (no password auth — just email gate)
const sessionSchema = new mongoose.Schema({
  email:      { type: String, required: true, lowercase: true, trim: true },
  token:      { type: String, required: true, unique: true },
  createdAt:  { type: Date, default: Date.now, expires: '30d' },  // auto-delete after 30 days
});
 
const Timeline = mongoose.model('Timeline', timelineSchema);
const Session  = mongoose.model('Session',  sessionSchema);
 
module.exports = { Timeline, Session };